# API-DB型制約マッピング

DB のカラムの型と制約が、Drizzle スキーマ、TypeSpec、生成された型、Zod スキーマのそれぞれでどう表されるかの対応表と、その一致を機械的に検査する `pnpm check:api-db` の説明。

対応表は、実装済みの Salon ドメイン（`salons` と `opening_hours`）が実際に行っていることを書いている。認証（`users` と `sessions`）も同じ対応に従っており、Read マッパー（`backend/packages/domain/src/mappers/read/user.mapper.ts`、`session.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/auth.schema.ts`）を持つ。サロンのサービスカテゴリー（`service_categories`）も同じで、Read マッパー（`backend/packages/domain/src/mappers/read/service-category.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/service-category.schema.ts`）を持つ。Write マッパーはない（理由は[表現の変換](#表現の変換)）。サロンのサービス（`services` と `service_options`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/service.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/service.schema.ts`）を持つ。Write マッパー（`backend/packages/domain/src/mappers/write/service.mapper.ts`）もあるが、値は変換しない（これも[表現の変換](#表現の変換)）。顧客台帳（`customers`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/customer.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/customer.schema.ts`）を持つ。Write マッパー（`backend/packages/domain/src/mappers/write/customer.mapper.ts`）は、リクエストをそのまま行として返す（これも[表現の変換](#表現の変換)）。スタッフ台帳（`staff`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/staff.mapper.ts`）、リクエストの Zod スキーマ（`backend/packages/domain/src/schemas/staff.schema.ts`）、歩合率（`numeric` の `commissionRate`）を文字列にする Write マッパー（`backend/packages/domain/src/mappers/write/staff.mapper.ts`）を持つ。それ以外のドメインは TypeSpec と DB スキーマにあるだけで、マッパーも Zod スキーマもない。それらの TypeSpec も、この対応表に従って DB と一致させてある。

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
| `uuid[]` | `uuid().array()` | `string[]` | ID スカラーの配列（`ServiceId[]`） | `string[]`（要素は `format: uuid`） | `services.packageServiceIds` |
| `integer` | `integer()` | `number` | `int32` | `number`（`format: int32`） | `reviewCount` |
| `boolean` | `boolean()` | `boolean` | `boolean` | `boolean` | `isActive` |
| `numeric(p, s)` | `numeric({ precision: p, scale: s })` | `string` | `float64` / `float32` | `number`（`format: double` / `float`） | `latitude`、`taxRate`、`rating` |
| `jsonb` | `jsonb()` | `unknown` | モデル（`BusinessHours[]`） | そのモデルの型 | `businessHours` |
| `timestamp with time zone` | `timestamp({ withTimezone: true, mode: 'string' })` | `string`（PostgreSQL のテキスト形式） | `utcDateTime` | `string`（`format: date-time`） | `createdAt` |
| `date` | `date()` | `string`（`YYYY-MM-DD`） | `plainDate` | `string`（`format: date`） | `opening_hours.date` |
| `time` | `time()` | `string`（`HH:mm:ss`） | `string` | `string` | `opening_hours.openTime` |
| enum 型（`day_of_week`） | `pgEnum('day_of_week', [...])` | 値のユニオン | `enum DayOfWeekType` | 値のユニオン | `opening_hours.dayOfWeek` |
| enum 型の配列（`booking_requirement[]`） | `bookingRequirement().array()` | 値のユニオンの配列 | `BookingRequirementType[]` | 値のユニオンの配列 | `services.bookingRequirements` |

NULL 許可のカラムは、どの層でも null を許す形になる: `schema.ts` では `.notNull()` なし、行の型と API の型では `| null`、TypeSpec では `Type | null`、OpenAPI では `nullable: true`、Zod では `.nullable()`。

カラム名は DB の中でも camelCase（`"nameKana"`、`"websiteUrl"`）なので、DB から API までプロパティ名は 1 種類しかない。

### リクエストを検証する Zod スキーマ

リクエストの値は、ユースケースが `backend/packages/domain/src/schemas/salon.schema.ts` の Zod スキーマで検証する。カラムの型ごとに、次のスキーマを使っている。

| PostgreSQL | Zod | 例 |
|---|---|---|
| `uuid`（ID） | `uuidSchema.brand<'SalonId'>()`（`models/salon.ts` の `salonIdSchema`。`uuidSchema` は `shared/identifier.ts` にあり、UUID を検証して小文字にそろえる） | パスの `id`、`cursor` |
| `varchar(n)` | `nonBlankText.max(n)`。内容に応じて `z.email().max(n)`、`z.httpUrl().max(n)`、`phoneNumber`（`schemas/rules.ts`） | `name`、`email`、`websiteUrl`、`phoneNumber` |
| `text` | `nonBlankText`（空白だけの文字列を拒否する `z.string()`） | `description` |
| `text[]` | `z.array(nonBlankText)`、`z.array(z.httpUrl())` | `features`、`imageUrls` |
| `boolean` | `z.boolean()` | `isActive` |
| `numeric(p, s)` | `z.number().min().max()` | `latitude`、`taxRate` |
| `jsonb` | モデルの形を表すスキーマ（`businessHoursListSchema`） | `businessHours` |
| `date` | `z.iso.date()` | `openingHours` の `date` |
| `time` | `timeOfDaySchema`（`HH:mm` または `HH:mm:ss`） | `openingHours` の `openTime` |
| enum 型 | 生成された `DayOfWeekTypeSchema`（`@beauty-salon-backend/generated`） | `openingHours` の `dayOfWeek` |

`integer` と `timestamp with time zone` のカラムは、Salon ではリクエストに含まれない（`reviewCount`、`createdAt` など）。Salon にないカラムの型は、サービスカテゴリーとサービスのスキーマ（`backend/packages/domain/src/schemas/service-category.schema.ts`、`backend/packages/domain/src/schemas/service.schema.ts`）が次のように検証する。

| PostgreSQL | Zod | 例 |
|---|---|---|
| `integer` | `z.number().int().min(下限).max(MAX_INTEGER)`。`MAX_INTEGER` は `integer` のカラムの最大値。業務上の上限があるカラムは、その値を上限にする（`duration` は 1440） | サービスカテゴリーの `displayOrder`、サービスの `duration`、`price`、`discountPrice`、`maxBookingsPerDay`、`sortOrder`、オプションの `additionalTime`、`additionalPrice`、`maxQuantity`、`sortOrder` |
| `uuid[]` | ID のスキーマの配列（`z.array(serviceIdSchema)`）。同じ値を重ねて指定できない配列には `.check(noRepeatedEntries)` を付ける | `packageServiceIds` |
| enum 型の配列 | 生成された enum のスキーマの配列（`z.array(BookingRequirementTypeSchema)`）と `.check(noRepeatedEntries)` | `bookingRequirements` |

顧客のスキーマ（`backend/packages/domain/src/schemas/customer.schema.ts`）には、`varchar(n)` のカラムのうち、DB が CHECK 制約で値を限っているものがある。

| PostgreSQL | Zod | 例 |
|---|---|---|
| `varchar(255)`。小文字で保存するメールアドレス（CHECK 制約 `customers_email_lower_case`） | `lowerCaseEmail`（メールアドレスとして検証し、小文字にそろえる） | 顧客の `email` |
| `varchar(20)`。決まった値のどれか（CHECK 制約 `customers_gender_known`）で、API では Enum | 生成された Enum のスキーマ（`CustomerGenderTypeSchema`） | 顧客の `gender` |

`nonBlankText` は Salon だけのものではない。複数のドメインのスキーマが共通で使うルール（`nonBlankText`、`lowerCaseEmail`、`phoneNumber`、`MAX_INTEGER`、`noRepeatedEntries`、`atLeastOneProperty`）は、`backend/packages/domain/src/schemas/rules.ts` に定義してある。

## 表現の変換

型が層によって違うのは `numeric`、`timestamp with time zone`、`jsonb` の 3 種類だけで、マッパーはこの 3 種類だけを変換する。それ以外のカラムは値をそのまま受け渡し、プロパティ名はどのカラムでも変えない。例外は顧客の `gender`（DB では `varchar`、API では Enum）だけで、この節の最後に書く。

| カラムの型 | DB → API（`SalonReadMapper`） | API → DB（`SalonWriteMapper`） |
|---|---|---|
| `numeric` | 文字列を `number` にする | `String(value)` で文字列にする |
| `timestamp with time zone` | PostgreSQL のテキスト形式を ISO 8601（UTC）にする | 変換なし。リクエストに含まれず、DB が `now()` で設定する |
| `jsonb` | 保存されている値を API モデルの Zod スキーマで検査する | 検証済みのリクエストの値をそのまま保存する |

`numeric` と `timestamp with time zone` の変換は、どの Read マッパーも同じものを使う。

```typescript
// backend/packages/domain/src/mappers/read/columns.ts
export const numericSchema = z.string().transform(Number).pipe(z.number())

export const timestampSchema = z
  .string()
  .transform((value) => parseISO(value))
  .pipe(z.date())
  .transform((value) => value.toISOString())
```

```typescript
// backend/packages/domain/src/mappers/read/salon.mapper.ts（抜粋）
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

リクエストで書けるカラムに上の 3 種類がないテーブルには、Write マッパーを書かない。`service_categories` がその例で、検証済みのリクエストをそのままリポジトリに渡す（`backend/packages/domain/src/models/service-category.ts` の `DbNewServiceCategory`）。Read マッパーが変換するのは `createdAt` と `updatedAt` だけである。

`services` も、リクエストで書けるカラムに上の 3 種類がない。それでも Write マッパー（`backend/packages/domain/src/mappers/write/service.mapper.ts`）があるのは、リクエストが `services` の行と `service_options` の行を含むからで、マッパーは値を変換せず、2 つのテーブルの行に分ける。Read マッパーが変換するのは、ここでも `createdAt` と `updatedAt` だけである。

`customers` は、リクエストで書けるカラムに `jsonb`（`preferences`）があるが、`numeric` はなく、`jsonb` は書き込みでは変換しない。`CustomerWriteMapper`（`backend/packages/domain/src/mappers/write/customer.mapper.ts`）は何も変換せず、リクエストをそのまま `DbNewCustomer` として返す。プロパティ名と表現が行と一致していることを、型検査がここで確認する。Read マッパー（`backend/packages/domain/src/mappers/read/customer.mapper.ts`）は、`createdAt` と `updatedAt` を変換し、`preferences` を検査する。

`time` のカラムは変換しない。DB は `HH:mm:ss` で返し、リクエストは `HH:mm` と `HH:mm:ss` のどちらも受け付ける。

顧客の `gender` は、DB では `varchar(20)`（行の型は `string`）、API では `CustomerGenderType` である。CHECK 制約 `customers_gender_known` が、値を Enum の 4 つのどれかに限っている。Read マッパーは、保存されている値を生成された `CustomerGenderTypeSchema` で検査する。書き込みでは変換しない（Enum の値は、そのまま文字列として保存できる）。

## 制約の対応

| DB | TypeSpec | Zod（`salon.schema.ts`） | 実行時の扱い |
|---|---|---|---|
| `NOT NULL` | `Type` | `.nullable()` を付けない | null は検証エラー（400） |
| NULL 許可 | `Type \| null` | `.nullable()` | null をそのまま保存し、そのまま返す |
| `varchar(n)` | `@maxLength(n)` | `.max(n)` | 超過は検証エラー（400） |
| `numeric(p, s)` | `@minValue` / `@maxValue` | `.min()` / `.max()`。`taxRate` は `.multipleOf(0.01)` | 範囲外は検証エラー（400） |
| `uuid` の主キー | ID スカラー | `uuidSchema.brand<'SalonId'>()`（`salonIdSchema`） | UUID でない ID は検証エラー（400）。大文字で書かれた ID は小文字にそろえる |
| 一意インデックス（`salons_email_unique`。削除されていない行が対象） | `@doc` に「削除されていないサロンの間で一意」と書き、オペレーションに 409 を列挙する | 検証しない | リポジトリが一意性の違反（SQLSTATE `23505`）を `alreadyExists` に変換する（409） |
| 範囲の違う 2 つの一意性（`customers_email_unique` は削除されていない行だけが対象の一意インデックス、`customers_referral_code_unique` は削除済みの行も対象の一意制約） | それぞれの `@doc` に範囲を書き（「削除されていない顧客の間で一意」、「削除済みを含むすべての顧客の間で一意」）、オペレーションに 409 を列挙する | 検証しない | リポジトリが、違反した制約の名前でどちらの値かを見分け、`alreadyExists` に変換する（409） |
| 外部キー（`opening_hours.salonId`、`ON DELETE CASCADE`） | 親モデルに `openingHours` として埋め込む | 配列として検証する | リポジトリが親と子を 1 つのトランザクションで書く |
| 外部キー（`service_categories.salonId`、`ON DELETE CASCADE`）。サロンの下のルートを持つリソース | パスの `salonId`。Create / Update のモデルには含めず、Response には含める | パスの値を `parseSalonIdOfPath`（`models/salon.ts`）で検証する | サロンがなければ 404。リポジトリはすべてのクエリにサロンの ID を付けるので、ほかのサロンの行は見つからない（404） |

リクエストで書けるカラムと書けないカラムの扱い:

- `DEFAULT` のあるカラムでも、リクエストで書けるもの（`timezone`、`currency`、`taxRate`、`isActive`）は Create で必須にする。`DbNewSalon` は `DeepRequired` で全キーが必須なので、API は DB の既定値に頼らない
- DB やほかの機能が値を決めるカラム（`id`、`rating`、`reviewCount`、`createdAt`、`updatedAt` など）は Create / Update に含めない。リクエストのスキーマは `z.strictObject` なので、これらを送ると未知のプロパティとして検証エラーになる
- 行が属するサロンを指すカラム（`service_categories.salonId`）も Create / Update に含めない。値はパスの `salonId` で決まり、あとから変えられない。`api-consistency-rules.ts` では `omittedColumns` に入れる（`serviceCategoryManagedColumns`）
- `deletedAt`（論理削除）は API に出さない。リポジトリのメソッドが返す行と変更する行は、`deletedAt IS NULL` の行だけである。一覧のカーソルだけは、削除済みの行を指していてもよい（サロン、サービス、顧客の一覧。行が残っているので、ページの開始位置が分かる）

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

### CHECK 制約

`services` と `service_options` には、1 行だけで判定できる規則を CHECK 制約として持たせてある（`backend/packages/database/sql/migrations/202611150300_services_columns.sql`）。リクエストは、DB に届く前に同じ規則で検証する。

| CHECK 制約 | TypeSpec | 同じ規則を検証する場所 |
|---|---|---|
| `services_duration_positive`（`duration > 0`） | `@minValue(1)` | スキーマの `duration`（1 以上） |
| `services_price_not_negative`（`price >= 0`） | `@minValue(0)` | スキーマの `price`（0 以上） |
| `services_discount_price_within_price`（`discountPrice` は NULL か、0 以上 `price` 以下） | `@minValue(0)`。`price` 以下であることは `@doc` に書く | スキーマの `discountPrice`（0 以上）と、`serviceRuleIssues`（`price` 以下） |
| `services_max_bookings_per_day_positive`（`maxBookingsPerDay` は NULL か、1 以上） | `@minValue(1)` | スキーマの `maxBookingsPerDay`（1 以上） |
| `services_package_members`（`isPackage` が true なら `packageServiceIds` は 2〜20 件、false なら 0 件） | `@maxItems(20)`。`isPackage` との組み合わせは `@doc` に書く | スキーマの `packageServiceIds`（20 件以下）と、`serviceRuleIssues`（パッケージは 2 件以上、パッケージでなければ 0 件） |
| `service_options_additional_time_not_negative`、`service_options_additional_price_not_negative` | `@minValue(0)` | オプションのスキーマの `additionalTime`、`additionalPrice`（0 以上） |
| `service_options_max_quantity_positive`（`maxQuantity > 0`） | `@minValue(1)` | オプションのスキーマの `maxQuantity`（1 以上） |

1 つのカラムの範囲は `backend/packages/domain/src/schemas/service.schema.ts` のスキーマにあり、2 つのカラムを結ぶ規則は `backend/packages/domain/src/business-logic/service/_shared/rules.ts` の `serviceRuleIssues` にある。部分更新は片方のカラムだけを指定できるので、後者はリクエストではなく、更新後に保存される行に対して判定する。作成ではユースケースが、更新ではリポジトリがトランザクションの中で呼ぶ。どちらの違反も検証エラー（400）になる。

`customers` にも CHECK 制約が 4 つある（`backend/packages/database/sql/migrations/202611150900_customers_columns.sql`）。

| CHECK 制約 | TypeSpec | 同じ規則を検証する場所 |
|---|---|---|
| `customers_email_lower_case`（`email` は小文字） | `@doc` に「小文字にそろえて保存する」と書く | スキーマの `email`（`lowerCaseEmail` が小文字にそろえる。大文字を含むリクエストは拒否せず、小文字にして保存する） |
| `customers_gender_known`（`gender` は NULL か、`male`、`female`、`other`、`prefer_not_to_say` のどれか） | `CustomerGenderType \| null` | スキーマの `gender`（生成された `CustomerGenderTypeSchema`） |
| `customers_not_referred_by_itself`（`referredBy` は NULL か、その行の `id` 以外） | 更新リクエストの `@doc` に「この顧客以外の顧客を指定する」と書く | `referredByItself`（`backend/packages/domain/src/business-logic/customer/_shared/rules.ts`）。更新のユースケースが呼ぶ。登録では `id` を DB が決めるので、自分自身は指定できない |
| `customers_preferences_is_an_object`（`preferences` は NULL かオブジェクト） | `CustomerBasicPreferences \| null` | スキーマの `preferences`。オブジェクトの中の形（`preferredServices` と `notes`）は DB では保証できないので、リクエストはスキーマが検証し、保存されている値は Read マッパーが読み出すときに検査する |

## `pnpm check:api-db`

生成済みの OpenAPI ドキュメント（`specs/tsp-output/@typespec/openapi3/generated/openapi.yaml`）と Drizzle スキーマ（`schema.ts`）を比べ、API モデルがテーブルと食い違っていれば失敗する。DB は使わない。CI の `quality` ジョブと `make ci-check` で実行される。

| ファイル | 役割 |
|---|---|
| `backend/packages/database/src/scripts/api-consistency-rules.ts` | どの API モデルがどのテーブルに対応するか（`modelRules`）。ドメインごとのブロックに分かれている |
| `backend/packages/database/src/scripts/api-consistency.ts` | 比較の関数（副作用なし）。テストは `backend/packages/database/src/scripts/__tests__/api-consistency.test.ts` |
| `backend/packages/database/src/scripts/check-api-consistency.ts` | ファイルを読み、比較し、結果を出力する |

食い違いを許容する仕組み（ベースライン）はない。テーブルに対応するモデルはすべてルールに載っており、1 件でも食い違えば失敗する。

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
| `computed` | カラムではないプロパティ（サーバーがレスポンスのたびに求め、どこにも保存しない値）。カラムとの照合を省く。`SessionResponse` の `current` に使っている |
| `omittedColumns` | モデルが意図して含めないカラム。それ以外のカラムがモデルにない場合は報告される。すべてのルールが指定する（テストで確認している） |

報告される食い違い:

| 種類 | 内容 |
|---|---|
| `unknownProperty` | API のプロパティと同じ名前のカラムがない（`embedded` と `computed` に挙げたプロパティを除く） |
| `missingColumn` | モデルにも `omittedColumns` にもないカラムがある |
| `shouldBeRequired` | `response` / `create` のプロパティが Optional になっている |
| `shouldBeOptional` | `update` のプロパティが必須になっている |
| `shouldBeNullable` | カラムが NULL 許可なのに、API が null を許していない |
| `shouldNotBeNullable` | カラムが `NOT NULL` なのに、API が null を許している |
| `enumMismatch` | カラムが PostgreSQL の Enum 型（またはその配列）なのに、API のプロパティが取りうる値がその Enum の値と一致しない |

検査しないもの:

- 型の対応（`numeric` と `number` など）と文字列長。実装済みのドメインでは、マッパーと `satisfies` を通じて型検査が検出する
- `XXXSearchRequest`（クエリパラメーターはカラムと 1 対 1 ではない）
- ルールに載っていないモデルと、プロパティの内側にネストしたオブジェクト

ルールが存在しないテーブルやモデルを指している場合も失敗する。

検査は生成済みのファイルを読むので、TypeSpec を変えたあとは `pnpm generate`、テーブルを変えたあとは `pnpm db:introspect` を先に実行する。

### ルールに載せるモデル、載せないモデル

テーブルの行を読み書きするモデルは、必ずルールに載せる。

| モデル | ルール |
|---|---|
| `XXXResponse`、`XXXCreateRequest`、`XXXUpdateRequest` | 載せる（`response` / `create` / `update`） |
| 親に埋め込む子テーブルの行（`OpeningHours`、`ServiceOption`、`BookingServiceResponse` など） | 載せる。親のルールでは `embedded` にプロパティ名を書く |
| テーブルの行に、サーバーがレスポンスのたびに求める値を加えたモデル（`SessionResponse` の `current`） | 載せる。ルールの `computed` にそのプロパティ名を書く |
| 行を追加するアクションのリクエスト（`PointEarnRequest`、`SaleProcessRequest` など） | カラムと 1 対 1 なら `create` として載せる |
| `XXXSearchRequest` | 載せない |
| 既存の行の一部だけを書き換えるアクションのリクエスト（`BookingCancelRequest`、`PaymentRefundRequest` など） | 載せない。プロパティ名と null 許可はカラムに合わせる |
| 集計・計算結果（`ReviewSummaryResponse`、`SalesReportResponse` など） | 載せない |
| テーブルがまだない機能のモデル（下の表） | 載せない |

テーブルがまだない機能は次のとおりである。これらの TypeSpec は命名・レスポンスの形・エラーの規約には従っているが、プロパティを照合する相手がない。実装するときは、先にテーブルを設計してマイグレーションを書き、モデルをルールに載せる。

| 機能 | TypeSpec |
|---|---|
| ロール、権限、ロールの割り当て、アクセス判定 | `specs/models/permission.tsp` |
| 添付ファイル、共有リンク | `specs/models/attachment.tsp` |
| 発注（purchase orders）、在庫アラート | `specs/models/inventory.tsp` の `PurchaseOrder*`、`InventoryAlert*`、`ReorderSuggestion*` |
| カルテ（medical charts） | `specs/models/treatment.tsp` の `MedicalChart*` |
| 顧客の監査履歴・版、エクスポートジョブ、データ削除リクエスト | `specs/models/customer.tsp` の `CustomerAuditEntry*`、`CustomerExport*`、`CustomerDataDeletion*` |

### ドメインを実装するとき

TypeSpec のモデルは、全ドメインで DB と一致している。ドメインを実装するときに API か DB を変える場合は、次の順に進める。

1. カラムを足す・変える必要があれば、マイグレーションを書き、`pnpm db:migrate` と `pnpm db:introspect` で `schema.ts` を更新する
2. TypeSpec のモデルを直し、`api-consistency-rules.ts` の該当ドメインのブロックを合わせる（新しいカラムを公開しない場合は `omittedColumns` に足す）
3. `pnpm generate` のあと `pnpm check:api-db` が成功することを確認する

## 関連ドキュメント

- [DB駆動ドメインモデル](./db-driven-domain-model.md)
- [TypeSpec API型定義ルール](./typespec-api-type-rules.md)
- [型生成システム](./type-generation-system.md)
- [バックエンドアーキテクチャガイドライン](./backend-architecture-guidelines.md)
