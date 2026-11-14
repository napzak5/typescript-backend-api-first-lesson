# 型安全性の原則

バックエンドの型安全性の規則と、規則が禁じているものの代わりに何を書くかを定義します。

規則そのものは [CLAUDE.md](../CLAUDE.md) の「Absolute Rules」です。この文書は、それぞれの規則がどこに適用され、実装済みのコードでどう満たされているかを示します。コード例は実際のファイルからの抜粋で、先頭にパスを示しています（コメントは日本語に置き換えています）。

Sum 型の定義と ts-pattern の書き方は [Sum型とパターンマッチング](./sum-types-pattern-matching.md)、コンパイラ設定は [TypeScript設定ガイド](./typescript-configuration.md) にあります。

## 規則と代替手段

| 禁止 | 代わりに使うもの | 機械的な検査 |
|------|------------------|--------------|
| `any` 型 | `unknown` で受けて Zod で検証する。型は生成された API 型と DB スキーマから得る | Biome `noExplicitAny`（error） |
| 型アサーション（`as`、非 null アサーション `!`） | Zod の検証結果、`satisfies`、ts-pattern、`=== undefined` などの比較 | `!` のみ Biome `noNonNullAssertion`（warn）。`as` はレビューで確認 |
| 型ガード（`value is T` を返す関数） | 判別共用体の `type` の比較、ts-pattern、Zod | なし。レビューで確認 |
| 例外を投げる（`throw`） | `Result` 型を返す | なし。レビューで確認 |

`typeof` や `instanceof`、`=== null` といった言語組み込みの絞り込みは型ガードの禁止に含まれません。禁じているのは、検査の正しさをコンパイラが確かめられない自作の型述語です。

## 適用範囲

規則は**アプリケーションコード**に適用します。サーバーとして動くコードのことで、次の場所です。

- `backend/packages/{api,config,domain,infrastructure,utility}/src`
- `backend/apps/server/src`

次のものはアプリケーションコードではなく、例外を投げたり `try` / `catch` を使ったり `console` に出力したりしてかまいません。スクリプトは失敗したら異常終了すればよく、テストは例外で失敗を知らせるからです。

- コマンドラインから実行するスクリプト: `backend/packages/database/src/scripts`、`backend/packages/database/src/seeds`、`backend/packages/generated/scripts/generate-types.ts`、リポジトリ直下の `scripts/` と `specs/scripts`
- テスト（`__tests__` ディレクトリと `*.test.ts`）

生成されたファイル（`backend/packages/generated/src`、`backend/packages/database/src/schema.ts`、`backend/packages/database/src/relations.ts`）は手で編集しないので、規則の対象外です。

フロントエンド（`frontend/`）には、この規則を満たしていない箇所があります（型述語は `frontend/packages/utils/src/typeUtil/typeUtil.ts`、ブランド型への `as` は `frontend/packages/validations/src/validateEmail/validateEmail.ts` など）。これらは手本にせず、新しく書くコードは規則に従います。なお、フロントエンドの `Result` は neverthrow のもので、バックエンドの `Result` とは別の型です。

## 例外を投げない

失敗は `Result<T, E>` の値として返します。ユースケース、読み取りマッパー、リポジトリ、設定の読み込み（`parseAppConfig`）、サーバーの起動（`startServer`）は、どれも `Result` を返します。型と関数の一覧は [Sum型とパターンマッチング](./sum-types-pattern-matching.md) を見てください。

アプリケーションコードに `throw` はありません。外から来る例外は次の3か所で値に変えています。

| 例外の出どころ | 変換する場所 | 変換後 |
|----------------|--------------|--------|
| ライブラリの Promise の reject（Drizzle、postgres.js） | `Result.fromPromise`（`backend/packages/utility/src/result/result.ts`）。アプリケーションコードで唯一の `try` / `catch` | `Result<T, Error>` |
| Express とそのボディパーサーが渡すエラー、ハンドラー内の予期しない例外 | `errorHandler` と `toHttpError`（`backend/packages/api/src/middleware/errors.ts`） | `HttpError` → 問題詳細のレスポンス |
| どこにも捕捉されなかった例外と reject | `uncaughtException` / `unhandledRejection` のハンドラー（`backend/apps/server/src/index.ts`） | ログに書いてプロセスを終了 |

ハンドラーは `try` / `catch` を書きません。Express 5 は `async` ハンドラーの reject をエラーハンドラーへ渡すので、`errorHandler` がまとめて処理します。プロセスを終了させる `process.exit` を呼ぶのも `backend/apps/server/src/index.ts` だけです。

## 境界で検証する

外から入ってくる値は `unknown` として受け取り、Zod スキーマで検証して初めて型が付きます。検証の入口は `parseWith` です。

```typescript
// backend/packages/domain/src/shared/validation.ts
export const parseWith = <T>(
  schema: z.ZodType<T>,
  input: unknown,
  message: string,
): Result<T, DomainError> =>
  match(schema.safeParse(input))
    .with({ success: true }, ({ data }) => Result.success(data))
    .with({ success: false }, ({ error }) =>
      Result.error(
        DomainErrors.validation(
          message,
          error.issues.flatMap(toValidationIssues),
        ),
      ),
    )
    .exhaustive()
```

境界ごとの検証箇所は次のとおりです。

| 境界 | 受け取る型 | 検証する場所 |
|------|------------|--------------|
| リクエストボディ | ハンドラーの型引数で `unknown` | ユースケースが `parseWith(salonCreateRequestSchema, input, ...)` |
| パスパラメータ | `string` | ユースケースが `parseSalonId(id)` |
| クエリ文字列 | `unknown` | `decodeSalonSearchQuery`（`backend/packages/api/src/routes/salon/_shared/query.ts`）が文字列を数値・真偽値・配列に直し、ユースケースが `salonSearchRequestSchema` で検証 |
| 環境変数 | `Record<string, string \| undefined>` | `parseAppConfig`（`backend/packages/config/src/app-config.ts`） |
| DB から読んだ値のうち DB が形を保証しないもの（`jsonb`、文字列で返る `numeric` と `timestamptz`） | Drizzle の推論型 | 読み取りマッパーの `convertedColumnsSchema`（`backend/packages/domain/src/mappers/read/salon.mapper.ts`） |
| ライブラリが渡すエラー | `unknown` | ts-pattern の `P` パターン（[Sum型とパターンマッチング](./sum-types-pattern-matching.md)） |

検証を通った値だけが型を持つので、`req.body as ApiSalonCreateRequest` のようなアサーションは必要になりません。

```typescript
// backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts
async execute(
  input: unknown,
): Promise<Result<ApiSalonResponse, DomainError>> {
  const request = parseWith(salonCreateRequestSchema, input, 'Invalid salon')
  if (request.type === 'error') {
    return request
  }
  // ここから request.data は ApiSalonCreateRequest
```

## `satisfies` でスキーマと API 型を照合する

Zod スキーマは手で書きますが、生成された API 型と食い違わないことを `satisfies` で確かめます。

```typescript
// backend/packages/domain/src/schemas/salon.schema.ts（抜粋）
export const salonCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(255),
  nameKana: nonBlankText.max(255).nullable(),
  // ...
  openingHours: openingHoursListSchema,
}) satisfies z.ZodType<ApiSalonCreateRequest>
```

`satisfies` は、スキーマが出力する型を `ApiSalonCreateRequest` として使えることをコンパイル時に検査します。TypeSpec を変更して API 型にプロパティが増えたり型が変わったりすると、スキーマがコンパイルエラーになります。

型アサーションや型注釈と違い、`satisfies` は式の型を変えません。スキーマは `ZodObject` のままなので、更新用のスキーマを `salonCreateRequestSchema.exactPartial()` で派生できます。

## ブランド型の ID

エンティティの ID は、検証済みであることを型で区別します。

```typescript
// backend/packages/domain/src/models/salon.ts
export const salonIdSchema = z.uuid().brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

const salonIdParameterSchema = z.object({ id: salonIdSchema })

export const parseSalonId = (id: unknown): Result<SalonId, DomainError> =>
  Result.map(
    parseWith(salonIdParameterSchema, { id }, 'Invalid salon ID'),
    (parameters) => parameters.id,
  )
```

`SalonId` を得る方法は、スキーマで検証することだけです。リポジトリのメソッドは `id: SalonId` を受け取るので、検証していない `string` を渡すとコンパイルエラーになります。一覧のカーソルも `salonIdSchema` で検証しています。

## 型は宣言せず、推論と生成で得る

エンティティやリクエストの型を手で書きません。DB の型は Drizzle スキーマから、API の型は TypeSpec から生成された型から得ます。

```typescript
// backend/packages/domain/src/models/salon.ts（抜粋）
export type ApiSalonResponse = components['schemas']['Models.SalonResponse']
export type ApiSalonCreateRequest =
  components['schemas']['Models.SalonCreateRequest']

export type DbSalon = DeepRequired<typeof salons.$inferSelect>
export type DbNewSalon = DeepRequired<
  Omit<typeof salons.$inferInsert, SalonManagedColumn>
>
```

2つの型の間の変換はマッパーが行い、どちらの型にも合っていることをコンパイラが検査します。詳しくは [DB駆動ドメインモデル](./db-driven-domain-model.md) と [型生成システム](./type-generation-system.md) を見てください。

## 細かな規約

### 配列の要素は取り出してから調べる

`noUncheckedIndexedAccess` により、添字や分割代入で取り出した要素の型には `undefined` が付きます。長さを先に調べるのではなく、取り出した値を `undefined` と比較します。

```typescript
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts
const [inserted] = await tx.insert(salons).values(salon).returning()
if (inserted === undefined) {
  return null
}
```

### 既定値には `??` を使う

`??` は `null` と `undefined` のときだけ既定値にします。`||` は `0` や空文字列も置き換えてしまうので、真偽値どうしの演算にだけ使います。

```typescript
// backend/packages/domain/src/business-logic/salon/list-salons.usecase.ts
const limit = request.data.limit ?? DEFAULT_LIMIT

// backend/packages/domain/src/schemas/salon.schema.ts
const needsTimes = !isHoliday || openTime !== null || closeTime !== null
```

アプリケーションコードで既定値に `||` を使っているのは、DB スクリプト用の `getDatabaseUrl`（`backend/packages/config/src/env-loader.ts`）だけです。この関数は、空文字列の環境変数も未設定として扱います。

### `null` と `undefined` は明示的に比較する

真偽値でない値を `!value` や `!!value` で調べません。何と比較しているのかを書きます。

```typescript
// backend/packages/domain/src/business-logic/salon/get-salon.usecase.ts
if (found.data === null) {

// backend/packages/domain/src/mappers/write/salon.mapper.ts
latitude: latitude === null ? null : toNumeric(latitude),
```

真偽値の否定（`!isHoliday`、`!deleted.data`）と、真偽値を返すメソッドの否定（`!fs.existsSync(filePath)`）には `!` を使います。

## まとめ

- 外から来た値は `unknown` で受け、Zod で検証してから使う
- 失敗は `Result` で返し、`type` の比較か ts-pattern で分岐する
- 型は DB スキーマと生成された API 型から得て、`satisfies` で実装と照合する
- ID はブランド型にして、検証していない文字列と区別する
- `any` は Biome が検出する。`as`・型ガード・`throw` はツールが検出しないので、レビューで確認する
