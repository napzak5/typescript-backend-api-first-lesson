# API-DB型制約マッピング

DB のカラムの型と制約が、Drizzle スキーマ、TypeSpec、生成された型、Zod スキーマのそれぞれでどう表されるかの対応表と、その一致を機械的に検査する `pnpm check:api-db` の説明。

対応表は、実装済みの Salon ドメイン（`salons` と `opening_hours`）が実際に行っていることを書いている。ほかのドメインは TypeSpec と DB スキーマにあるだけで、マッパーも Zod スキーマもない（GitHub issue #91）。

- ルールそのもの（プロパティ名 = カラム名、NULL 許可の一致、Optional の制約）: [CLAUDE.md](../CLAUDE.md)
- TypeSpec での書き方: [TypeSpec API型定義ルール](./typespec-api-type-rules.md)
- DB を正とする考え方とスキーマ変更の手順: [DB駆動ドメインモデル](./db-driven-domain-model.md)

## 層と定義の場所

| 層 | 場所 | 作り方 |
|---|---|---|
| PostgreSQL | `backend/packages/database/sql/migrations/`、`backend/packages/database/sql/setup.sql` | SQL マイグレーションを書く |
| Drizzle スキーマ | `backend/packages/database/src/schema.ts` | `pnpm db:introspect` が DB から生成する |
| DB の行の型 | `backend/packages/domain/src/models/salon.ts` | `DeepRequired<typeof salons.$inferSelect>` で推論する |
| API 定義 | `specs/models/salon.tsp` | TypeSpec を書く |
| API の型 | `backend/packages/generated/src/api-types.ts` | `pnpm generate` が OpenAPI から生成する |
| リクエストの検証 | `backend/packages/domain/src/schemas/salon.schema.ts` | Zod スキーマを書き、API の型と `satisfies` で突き合わせる |
| 表現の変換 | `backend/packages/domain/src/mappers/write/salon.mapper.ts`、`backend/packages/domain/src/mappers/read/salon.mapper.ts` | マッパーを書く |

## 型の対応

| PostgreSQL | `schema.ts` | DB の行の型 | TypeSpec | API の型（OpenAPI） | 例 |
|---|---|---|---|---|---|
| `uuid` | `uuid()` | `string` | ID スカラー（`SalonId`） | `string`（`format: uuid`） | `salons.id` |
| `varchar(n)` | `varchar({ length: n })` | `string` | `string` と `@maxLength(n)` | `string` | `name` |
| `text` | `text()` | `string` | `string` | `string` | `description` |
| `text[]` | `text().array()` | `string[]` | `string[]` | `string[]` | `imageUrls` |
| `integer` | `integer()` | `number` | `int32` | `number`（`format: int32`） | `reviewCount` |
| `boolean` | `boolean()` | `boolean` | `boolean` | `boolean` | `isActive` |
| `numeric(p, s)` | `numeric({ precision: p, scale: s })` | `string` | `float64` / `float32` | `number`（`format: double` / `float`） | `latitude`、`taxRate`、`rating` |
| `jsonb` | `jsonb()` | `unknown` | モデル（`BusinessHours[]`） | そのモデルの型 | `businessHours` |
| `timestamp with time zone` | `timestamp({ withTimezone: true, mode: 'string' })` | `string`（PostgreSQL のテキスト形式） | `utcDateTime` | `string`（`format: date-time`） | `createdAt` |
| `date` | `date()` | `string`（`YYYY-MM-DD`） | `plainDate` | `string`（`format: date`） | `opening_hours.date` |
| `time` | `time()` | `string`（`HH:mm:ss`） | `string` | `string` | `opening_hours.openTime` |
| enum 型（`day_of_week`） | `pgEnum('day_of_week', [...])` | 値のユニオン | `enum DayOfWeekType` | 値のユニオン | `opening_hours.dayOfWeek` |

NULL 許可のカラムは、どの層でも null を許す形になる: `schema.ts` では `.notNull()` なし、行の型と API の型では `| null`、TypeSpec では `Type | null`、OpenAPI では `nullable: true`、Zod では `.nullable()`。

カラム名は DB の中でも camelCase（`"nameKana"`、`"websiteUrl"`）なので、DB から API までプロパティ名は 1 種類しかない。

### リクエストを検証する Zod スキーマ

リクエストの値は、ユースケースが `backend/packages/domain/src/schemas/salon.schema.ts` の Zod スキーマで検証する。カラムの型ごとに、次のスキーマを使っている。

| PostgreSQL | Zod | 例 |
|---|---|---|
| `uuid`（ID） | `z.uuid().brand<'SalonId'>()`（`models/salon.ts` の `salonIdSchema`） | パスの `id`、`cursor` |
| `varchar(n)` | `nonBlankText.max(n)`。内容に応じて `z.email().max(n)`、`z.httpUrl().max(n)`、`phoneNumberSchema` | `name`、`email`、`websiteUrl`、`phoneNumber` |
| `text` | `nonBlankText`（空白だけの文字列を拒否する `z.string()`） | `description` |
| `text[]` | `z.array(nonBlankText)`、`z.array(z.httpUrl())` | `features`、`imageUrls` |
| `boolean` | `z.boolean()` | `isActive` |
| `numeric(p, s)` | `z.number().min().max()` | `latitude`、`taxRate` |
| `jsonb` | モデルの形を表すスキーマ（`businessHoursListSchema`） | `businessHours` |
| `date` | `z.iso.date()` | `openingHours` の `date` |
| `time` | `timeOfDaySchema`（`HH:mm` または `HH:mm:ss`） | `openingHours` の `openTime` |
| enum 型 | 生成された `DayOfWeekTypeSchema`（`@beauty-salon-backend/generated`） | `openingHours` の `dayOfWeek` |

`integer` と `timestamp with time zone` のカラムは、Salon ではリクエストに含まれない（`reviewCount`、`createdAt` など）。

## 表現の変換

型が層によって違うのは `numeric`、`timestamp with time zone`、`jsonb` の 3 種類だけで、マッパーはこの 3 種類だけを変換する。それ以外のカラムは値をそのまま受け渡し、プロパティ名はどのカラムでも変えない。

| カラムの型 | DB → API（`SalonReadMapper`） | API → DB（`SalonWriteMapper`） |
|---|---|---|
| `numeric` | 文字列を `number` にする | `String(value)` で文字列にする |
| `timestamp with time zone` | PostgreSQL のテキスト形式を ISO 8601（UTC）にする | 変換なし。リクエストに含まれず、DB が `now()` で設定する |
| `jsonb` | 保存されている値を API モデルの Zod スキーマで検査する | 検証済みのリクエストの値をそのまま保存する |

```typescript
// backend/packages/domain/src/mappers/read/salon.mapper.ts（抜粋）
const numericSchema = z.string().transform(Number).pipe(z.number())

const timestampSchema = z
  .string()
  .transform((value) => parseISO(value))
  .pipe(z.date())
  .transform((value) => value.toISOString())

const convertedColumnsSchema = z.object({
  latitude: numericSchema.nullable(),
  longitude: numericSchema.nullable(),
  rating: numericSchema.nullable(),
  taxRate: numericSchema,
  businessHours: z.array(storedBusinessHoursSchema).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
```

保存されている行がこのスキーマに合わない場合、`toApiSalon` は `validation` ではなく `database` エラーを返す（リクエストではなく保存データの問題なので、レスポンスは 500 になる）。

```typescript
// backend/packages/domain/src/mappers/write/salon.mapper.ts（抜粋）
const toNumeric = (value: number): string => String(value)

export const SalonWriteMapper = {
  fromCreateRequest(request: ApiSalonCreateRequest): {
    salon: DbNewSalon
    openingHours: DbNewOpeningHours[]
  } {
    const { openingHours, latitude, longitude, taxRate, ...columns } = request

    return {
      salon: {
        ...columns,
        latitude: latitude === null ? null : toNumeric(latitude),
        longitude: longitude === null ? null : toNumeric(longitude),
        taxRate: toNumeric(taxRate),
      },
      openingHours: toDbOpeningHours(openingHours),
    }
  },
  // ...
}
```

`...columns` でリクエストをそのまま行にできるのは、プロパティ名と NULL 許可が DB と一致しているからである。どちらかがずれると、`DbNewSalon` に代入できず型検査で失敗する。

`time` のカラムは変換しない。DB は `HH:mm:ss` で返し、リクエストは `HH:mm` と `HH:mm:ss` のどちらも受け付ける。

## 制約の対応

| DB | TypeSpec | Zod（`salon.schema.ts`） | 実行時の扱い |
|---|---|---|---|
| `NOT NULL` | `Type` | `.nullable()` を付けない | null は検証エラー（400） |
| NULL 許可 | `Type \| null` | `.nullable()` | null をそのまま保存し、そのまま返す |
| `varchar(n)` | `@maxLength(n)` | `.max(n)` | 超過は検証エラー（400） |
| `numeric(p, s)` | `@minValue` / `@maxValue` | `.min()` / `.max()`。`taxRate` は `.multipleOf(0.01)` | 範囲外は検証エラー（400） |
| `uuid` の主キー | ID スカラー | `z.uuid().brand<'SalonId'>()`（`salonIdSchema`） | UUID でない ID は検証エラー（400） |
| 一意インデックス（`salons_email_unique`。削除されていない行が対象） | `@doc` に「削除されていないサロンの間で一意」と書き、オペレーションに 409 を列挙する | 検証しない | リポジトリが一意性の違反（SQLSTATE `23505`）を `alreadyExists` に変換する（409） |
| 外部キー（`opening_hours.salonId`、`ON DELETE CASCADE`） | 親モデルに `openingHours` として埋め込む | 配列として検証する | リポジトリが親と子を 1 つのトランザクションで書く |

リクエストで書けるカラムと書けないカラムの扱い:

- `DEFAULT` のあるカラムでも、リクエストで書けるもの（`timezone`、`currency`、`taxRate`、`isActive`）は Create で必須にする。`DbNewSalon` は `DeepRequired` で全キーが必須なので、API は DB の既定値に頼らない
- DB やほかの機能が値を決めるカラム（`id`、`rating`、`reviewCount`、`createdAt`、`updatedAt` など）は Create / Update に含めない。リクエストのスキーマは `z.strictObject` なので、これらを送ると未知のプロパティとして検証エラーになる
- `deletedAt`（論理削除）は API に出さない。リポジトリのすべてのメソッドが `deletedAt IS NULL` の行だけを扱う

Zod スキーマは API の型と突き合わせてあるので、TypeSpec の形を変えてスキーマを直し忘れると型検査で失敗する。

```typescript
// backend/packages/domain/src/schemas/salon.schema.ts（抜粋）
export const salonCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(255),
  nameKana: nonBlankText.max(255).nullable(),
  // ...
  latitude: z.number().min(-90).max(90).nullable(),
  // ...
  // カラムは小数第 2 位までを保持する
  taxRate: z.number().min(0).max(100).multipleOf(0.01),
  isActive: z.boolean(),
  openingHours: openingHoursListSchema,
}) satisfies z.ZodType<ApiSalonCreateRequest>
```

DB にも TypeSpec にも表せない規則（空白だけの文字列を拒否する、電話番号や URL の形式、営業時間の前後関係、日付と曜日の一致など）は、Zod スキーマだけにある。

## `pnpm check:api-db`

生成済みの OpenAPI ドキュメント（`specs/tsp-output/@typespec/openapi3/generated/openapi.yaml`）と Drizzle スキーマ（`schema.ts`）を比べ、API モデルがテーブルと食い違っていれば失敗する。DB は使わない。CI の `quality` ジョブと `make ci-check` で実行される。

| ファイル | 役割 |
|---|---|
| `backend/packages/database/src/scripts/api-consistency-rules.ts` | どの API モデルがどのテーブルに対応するか（`modelRules`） |
| `backend/packages/database/src/scripts/api-consistency.ts` | 比較の関数（副作用なし）。テストは `backend/packages/database/src/scripts/__tests__/api-consistency.test.ts` |
| `backend/packages/database/src/scripts/check-api-consistency.ts` | ファイルを読み、比較し、結果を出力する |
| `backend/packages/database/api-consistency-baseline.json` | いまは許容している食い違い（ベースライン） |

### 検査する内容

ルールは、モデルごとにテーブルと種類（`kind`）を指定する。

```typescript
// backend/packages/database/src/scripts/api-consistency-rules.ts（抜粋）
const salonRules: ModelRule[] = [
  {
    model: 'Models.SalonResponse',
    table: 'salons',
    kind: 'response',
    embedded: ['openingHours'],
    omittedColumns: ['cancellationPolicy', 'bookingPolicy', 'deletedAt'],
  },
  {
    model: 'Models.SalonCreateRequest',
    table: 'salons',
    kind: 'create',
    embedded: ['openingHours'],
    omittedColumns: salonManagedColumns,
  },
  // ...
]
```

| 項目 | 意味 |
|---|---|
| `model` | OpenAPI のスキーマ名 |
| `table` | `schema.ts` でのテーブルの export 名（`salons`、`openingHours`） |
| `kind` | `response` / `create`（全プロパティ必須）、`update`（全プロパティ Optional） |
| `embedded` | カラムではないプロパティ（子テーブルの行を埋め込んだもの）。カラムとの照合を省く |
| `omittedColumns` | モデルが意図して含めないカラム。指定すると、それ以外のカラムがモデルにない場合も報告される |

報告される食い違い:

| 種類 | 内容 |
|---|---|
| `unknownProperty` | API のプロパティと同じ名前のカラムがない |
| `missingColumn` | `omittedColumns` を指定したモデルで、モデルにも `omittedColumns` にもないカラムがある |
| `shouldBeRequired` | `response` / `create` のプロパティが Optional になっている |
| `shouldBeOptional` | `update` のプロパティが必須になっている |
| `shouldBeNullable` | カラムが NULL 許可なのに、API が null を許していない |
| `shouldNotBeNullable` | カラムが `NOT NULL` なのに、API が null を許している |

検査しないもの:

- 型の対応（`numeric` と `number` など）、文字列長、Enum の値。実装済みのドメインでは、マッパーと `satisfies` を通じて型検査が検出する
- `XXXSearchRequest`（クエリパラメーターはカラムと 1 対 1 ではない）
- ルールに載っていないモデルと、プロパティの内側にネストしたオブジェクト

ルールが存在しないテーブルやモデルを指している場合も失敗する。

### ベースライン

`api-consistency-baseline.json` は、検出されても失敗にしない食い違いを、モデルごとに `種類:プロパティ名` の形で記録する。次はその一部である。

```json
{
  "Models.Review": ["unknownProperty:createdBy", "unknownProperty:updatedBy"],
  "Models.Session": ["unknownProperty:rememberMe"]
}
```

記録されているのは、仕様だけがあって実装のないドメイン（`api-consistency-rules.ts` の `specifiedOnlyRules`: `Customer`、`Staff`、`Booking`、`Payment` など）の既知の食い違いで、現在はすべて `unknownProperty` である。Salon の 4 モデル（`SalonResponse`、`SalonCreateRequest`、`SalonUpdateRequest`、`OpeningHours`）にエントリはない。

検査は次のどちらでも失敗する。

- ベースラインにない食い違いが見つかった（新しい不整合）
- ベースラインにあるエントリが、もう検出されない（直したのにベースラインが古い）

つまりベースラインは、現在の食い違いと常に一致している必要がある。

### ベースラインの更新

```bash
pnpm check:api-db                     # 検査
pnpm check:api-db --update-baseline   # 現在の食い違いをベースラインとして書き出す
```

`--update-baseline` を使うのは、記録済みの食い違いを解消してエントリを減らすときである。新しい食い違いを受け入れるために使わない。新しい食い違いは、TypeSpec を直すか、マイグレーションでテーブルを変えて解消する。

検査は生成済みのファイルを読むので、TypeSpec を変えたあとは `pnpm generate`、テーブルを変えたあとは `pnpm db:introspect` を先に実行する。

### ドメインを実装するとき

ドメインは、そのモデルが `omittedColumns` 付きでルールに載り、ベースラインにエントリがなくなった時点で、API と DB の整合が取れたとみなす。

1. TypeSpec のモデルを DB に合わせて直す（必要ならマイグレーションでカラムを足す）。Response に加えて Create / Update のモデルもそろえる
2. `api-consistency-rules.ts` で、そのモデルのルールを `specifiedOnlyRules` から外し、`kind`、`embedded`、`omittedColumns` を指定したルールとして書く
3. `pnpm generate` のあと `pnpm check:api-db --update-baseline` を実行し、ベースラインの差分がそのドメインのエントリの削除だけであることを確認する

## 関連ドキュメント

- [DB駆動ドメインモデル](./db-driven-domain-model.md)
- [TypeSpec API型定義ルール](./typespec-api-type-rules.md)
- [型生成システム](./type-generation-system.md)
- [バックエンドアーキテクチャガイドライン](./backend-architecture-guidelines.md)
