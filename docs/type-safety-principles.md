# 型安全性の原則

バックエンドの型安全性の規則と、規則が禁じているものの代わりに何を書くかを定義します。

規則そのものは [CLAUDE.md](../CLAUDE.md) の「Absolute Rules」です。この文書は、それぞれの規則がどこに適用され、実装済みのコードでどう満たされているかを示します。コード例は実際のファイルからの抜粋で、先頭にパスを示しています（コメントは日本語に置き換えています）。

Sum 型の定義と ts-pattern の書き方は [Sum型とパターンマッチング](./sum-types-pattern-matching.md)、コンパイラ設定は [TypeScript設定ガイド](./typescript-configuration.md) にあります。

## 規則と代替手段

| 禁止 | 代わりに使うもの | 機械的な検査 |
|------|------------------|--------------|
| `any` 型 | `unknown` で受けて Zod で検証する。型は生成された API 型と DB スキーマから得る | Biome `noExplicitAny`（error） |
| 型アサーション（`as`、`as const`、`<T>value`、非 null アサーション `!`） | Zod の検証結果、`satisfies`、ts-pattern、`=== undefined` などの比較 | `as` などは Biome プラグイン `no-type-assertion`、`!` は Biome `noNonNullAssertion`（どちらも error） |
| 型ガード（`value is T`、`asserts value is T` を返す関数） | 判別共用体の `type` の比較、ts-pattern、Zod | Biome プラグイン `no-type-guard`（error） |
| 例外を投げる（`throw`） | `Result` 型を返す | Biome プラグイン `no-throw`（error） |

`typeof` や `instanceof`、`=== null` といった言語組み込みの絞り込みは型ガードの禁止に含まれません。禁じているのは、検査の正しさをコンパイラが確かめられない自作の型述語です。

検査はどれも `pnpm lint`（`make ci-check`、CI、コミット時の lint-staged）で行われ、違反があると失敗します。プラグインは `shared-config/biome/` にある GritQL のファイルで、`biome.json` の `overrides` がアプリケーションコードにだけ適用しています（対象は [機械的な検査の対象](#機械的な検査の対象)）。

## 適用範囲

規則は**アプリケーションコード**に適用します。サーバーとして動くコードのことで、次の場所です。

- `backend/packages/{api,config,domain,infrastructure,utility}/src`
- `backend/apps/server/src`

次のものはアプリケーションコードではなく、例外を投げたり `try` / `catch` を使ったり `console` に出力したりしてかまいません。スクリプトは失敗したら異常終了すればよく、テストは例外で失敗を知らせるからです。

- コマンドラインから実行するスクリプト: `backend/packages/database/src/scripts`、`backend/packages/database/src/seeds`、`backend/packages/generated/scripts/generate-types.ts`、リポジトリ直下の `scripts/`
- テスト（`__tests__` ディレクトリと `*.test.ts`）

生成されたファイル（`backend/packages/generated/src`、`backend/packages/database/src/schema.ts`、`backend/packages/database/src/relations.ts`）は手で編集しないので、規則の対象外です。

### 機械的な検査の対象

Biome プラグイン（`as`、型ガード、`throw`）が検査するのは、`backend/packages/*/src`、`backend/apps/*/src`、`frontend/packages/*/src`、`frontend/apps/*/src` です。新しいパッケージは、何もしなくても対象になります。次のものは `biome.json` で対象から外しています。

| 対象外 | 理由 |
|--------|------|
| `__tests__` ディレクトリ、`*.test.ts(x)`、`*.stories.tsx` | テストコード |
| `backend/packages/database/src/scripts`、`backend/packages/database/src/seeds` | コマンドラインから実行するスクリプトとシードデータ |
| `frontend/apps/*/src/main.tsx` | アプリの起動点。描画先の要素がないときに `throw` で起動を止める |

`backend/packages/generated/src` と `frontend/packages/api-client/src/generated` は、Biome の対象そのものから外れています。`any` と `!` の検査（`noExplicitAny`、`noNonNullAssertion`）は、Biome が見るすべてのファイルに適用されます。

## 例外を投げない

失敗は `Result<T, E>` の値として返します。ユースケース、読み取りマッパー、リポジトリ、設定の読み込み（`parseAppConfig`）、サーバーの起動（`startServer`）は、どれも `Result` を返します。型と関数の一覧は [Sum型とパターンマッチング](./sum-types-pattern-matching.md) を見てください。

アプリケーションコードに `throw` はありません。外から来る例外は次の4か所で値に変えています。アプリケーションコードの `try` / `catch` は、最初の 2 つ（`Result.fromPromise` と `Result.fromThrowable`）の中だけです。

| 例外の出どころ | 変換する場所 | 変換後 |
|----------------|--------------|--------|
| ライブラリの Promise の reject（Drizzle、postgres.js） | `Result.fromPromise`（`backend/packages/utility/src/result/result.ts`） | `Result<T, Error>` |
| 同期の関数が投げる例外（`node:crypto` の復号の失敗） | `Result.fromThrowable`（同じファイル）。`TotpAuthenticator`（`backend/packages/infrastructure/src/security/totp-authenticator.ts`）が使う | `Result<T, Error>` |
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
| `Authorization` ヘッダー | `string \| undefined` | `AuthenticateUseCase`（`backend/packages/domain/src/business-logic/auth/authenticate.usecase.ts`）がトークンを取り出してセッションを検索し、操作者を `actorSchema` で検証して `Actor` にする |
| 環境変数 | `Record<string, string \| undefined>` | `parseAppConfig`（`backend/packages/config/src/app-config.ts`） |
| DB から読んだ値のうち DB が形を保証しないもの（`jsonb`、文字列で返る `numeric` と `timestamptz`） | Drizzle の推論型 | 読み取りマッパーの `convertedColumnsSchema`（`backend/packages/domain/src/mappers/read/salon.mapper.ts`） |
| ライブラリが渡すエラー | `unknown` | ts-pattern の `P` パターン（[Sum型とパターンマッチング](./sum-types-pattern-matching.md)） |

検証を通った値だけが型を持つので、`req.body as ApiSalonCreateRequest` のようなアサーションは必要になりません。

```typescript
// backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts
async execute(
  actor: Actor,
  input: unknown,
): Promise<Result<ApiSalonResponse, DomainError>> {
  if (!mayCreateSalon(actor)) {
    return Result.error(DomainErrors.forbidden())
  }

  const request = parseWith(salonCreateRequestSchema, input, 'Invalid salon')
  if (request.type === 'error') {
    return request
  }
  // ここから request.data は ApiSalonCreateRequest
```

`actor` も同じ考え方です。アプリケーションコードで `Actor` を作るのは `AuthenticateUseCase`（`business-logic/auth/_shared/actor.ts` の `toActor`）だけで、ハンドラーは `authenticated` で包まれたときだけそれを受け取ります。包まれていないハンドラーには渡せる `actor` がないので、`actor` を要求するユースケースを呼ぶコードはコンパイルできません（[認証と認可](./authentication.md)）。

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

API の入出力を表すスキーマは、どこにあっても生成された型に結びつけます。スキーマが API の値の一部だけを扱うときは、その部分を `Pick` で選びます。契約からプロパティの名前がなくなると `Pick` の制約で、型が変わると `satisfies` で、ビルドが失敗します。

| スキーマ | 満たす型 | 例 |
|---|---|---|
| リクエストの本文と検索のパラメーター（ドメイン） | リクエストの型の全体 | `salonCreateRequestSchema`（`schemas/salon.schema.ts`） |
| クエリ文字列を型に直す前段（API 層） | 検索のリクエストの、直すパラメーターだけ | `satisfies z.ZodType<Pick<ApiSalonSearchRequest, 'limit' \| …>>`（`routes/salon/_shared/query.ts`） |
| 数に直すパスのパラメーター | オペレーションの `parameters.path` の、そのパラメーター | `customerVersionNumberSchema`（`schemas/customer-version.schema.ts`） |
| 読み取りマッパーが直す列（`jsonb`、`numeric`、`timestamptz`） | 返す API の値の、その列だけ。直したあとでもう一度変える値は、その型を足す | `convertedColumnsSchema`（`mappers/read/salon.mapper.ts`）、在庫の評価額の区分（`mappers/read/inventory-report.mapper.ts`。金額は、合計してから数にするので `bigint`） |
| `jsonb` に保存する API の値 | その API の型 | `storedTimeSlotsSchema satisfies z.ZodType<ApiTimeSlot[]>`（`schemas/customer-preferences.schema.ts`） |
| フロントエンドが API の応答を読むところ | 生成された応答の型の、読むところだけ | problem details の `code`（`api-client` の `src/fetcher/fetcher.ts`）、セッションの更新の応答（同じく `src/fetcher/renew-session.ts`）、顧客の CSV の好みとタグ（admin-app の `src/customers/customer-file.ts`） |
| テストが API の応答を読むところ | 同じ | サインインの応答（portal-app の `src/bookings/__tests__/arrangements.ts`、`frontend/e2e/src/sign-in.ts`） |

`zod/mini` のスキーマには `z.ZodType` がないので、`satisfies z.ZodMiniType<…>` で結びつけます。

結びつけないのは、API の値でないものです。設定（`parseAppConfig`）、DB から読んだ行、ID のパスパラメーター（ブランド型の UUID で、生成された `string` をそのまま満たす）、テストのサーバーとのやりとりです。例外が 1 つあります。`@beauty-salon-frontend/testing` の自分のテスト（`src/api/test-api.integration.test.ts`）は、API の応答を生成された型に結びつけません。このパッケージは、それを使ってテストされる `api-client` に依存できない（pnpm が循環を拒む）からです。理由はそのファイルにも書いています。

## ブランド型の ID

エンティティの ID は、検証済みであることを型で区別します。

```typescript
// backend/packages/domain/src/models/salon.ts
export const salonIdSchema = uuidSchema.brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

const salonIdParameterSchema = z.object({ id: salonIdSchema })

export const parseSalonId = (id: unknown): Result<SalonId, DomainError> =>
  Result.map(
    parseWith(salonIdParameterSchema, { id }, 'Invalid salon ID'),
    (parameters) => parameters.id,
  )
```

`SalonId` を得る方法は、スキーマで検証することだけです。リポジトリのメソッドは `id: SalonId` を受け取るので、検証していない `string` を渡すとコンパイルエラーになります。一覧のカーソルも `salonIdSchema` で検証しています。

`uuidSchema`（`backend/packages/domain/src/shared/identifier.ts`）は、UUID であることを検証し、小文字にそろえます。UUID の英字は大文字でも小文字でも書けますが、PostgreSQL は常に小文字で返します。ID は文字列として比べる箇所がある（操作者のサロンか、管理者自身のアカウントか、パッケージが自分自身を含んでいないか、ID の一覧に同じ ID が 2 回ないか、顧客の紹介元がその顧客自身でないか）ので、検証済みの ID は必ず DB の値と同じ表記にします。ID のスキーマは、すべて `uuidSchema` から作ります。

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
- `any`・`as`・型ガード・`throw` は `pnpm lint`（Biome とそのプラグイン）が検出する
