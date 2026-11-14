# Sum型とパターンマッチング

バックエンドで使っている Sum 型（判別共用体）と、それを ts-pattern で処理する書き方をまとめます。

コード例はすべて実装済みのコード（Salon ドメインと共通部分）からの抜粋で、先頭にファイルパスを示しています。コメントは日本語に置き換え、省いた箇所は `// ...` としています。正確な内容は各ファイルを見てください。

この文書が扱うのは Sum 型の定義と `match` の使い方です。`any`・型アサーション・型ガード・例外を使わないという規則と、その代わりに使うもの（境界での Zod による検証、`satisfies`、ブランド型）は [型安全性の原則](./type-safety-principles.md) にあります。

## コードにある Sum 型

| 型 | 定義場所 | ケース |
|----|----------|--------|
| `Result<T, E>` | `backend/packages/utility/src/result/result.ts` | `success` / `error` |
| `DomainError` | `backend/packages/domain/src/shared/errors.ts` | `validation` / `unauthenticated` / `forbidden` / `notFound` / `alreadyExists` / `conflict` / `database` |
| `HttpError` | `backend/packages/api/src/shared/problem-details.ts` | `routeNotFound` / `malformedBody` / `unsupportedMediaType` / `bodyTooLarge` / `badRequest` / `rateLimited` / `unexpected` |
| `ApiError` | 同上 | `DomainError` と `HttpError` の和 |
| `OpeningHoursChange` | `backend/packages/domain/src/models/salon.ts` | `keep` / `replace` |
| `ActorScope` | `backend/packages/domain/src/models/auth.ts` | `platform` / `salon` / `customer` / `none` |
| `PasswordVerification` | `backend/packages/domain/src/services/password-hasher.ts` | `match` / `mismatch` |
| `PasswordCheck` | `backend/packages/domain/src/business-logic/auth/_shared/password-check.ts` | `accepted` / `refused` |
| `SecondFactorCheck` | `backend/packages/domain/src/business-logic/auth/_shared/second-factor.ts` | `accepted` / `refused` |
| `StartFailure` | `backend/apps/server/src/server.ts` | `databaseUnreachable` / `listenFailed` |

どの型も同じ書き方に従っています。

- 判別子は `type` プロパティで、値は camelCase の文字列リテラル
- ケースごとのデータは `type` と同じ階層に置く（`{ type: 'notFound'; entity: string; id: string }`）
- 「ある場合とない場合」を optional なプロパティで表さず、ケースを分ける。更新時の営業日カレンダーは `openingHours?: ...` ではなく次の型です

```typescript
// backend/packages/domain/src/models/salon.ts
export type OpeningHoursChange =
  | { type: 'keep' }
  | { type: 'replace'; openingHours: DbNewOpeningHours[] }
```

## Result 型

失敗しうる処理は例外を投げず、`Result` を返します。

```typescript
// backend/packages/utility/src/result/result.ts
export type Result<T, E> =
  | { type: 'success'; data: T }
  | { type: 'error'; error: E }
```

同名のオブジェクト `Result` に、生成と合成の関数があります。関数はこの7つだけです。成功か失敗かを調べる専用の関数はなく、`type` を比較するか `match` を使います。

| 関数 | 用途 |
|------|------|
| `Result.success(data)` / `Result.error(error)` | 値を作る |
| `Result.map(result, fn)` | 成功値を変換する |
| `Result.mapError(result, fn)` | エラーを変換する |
| `Result.flatMap(result, fn)` | 成功値から次の `Result` を作る |
| `Result.fromThrowable(fn)` | 失敗を例外で知らせる関数を呼び、投げられた例外を `Result<T, Error>` の `error` にする |
| `Result.fromPromise(promise)` | Promise の reject を `Result<T, Error>` の `error` にする |

### 途中の失敗はそのまま返す

手順が直列に続くユースケースでは、各手順の結果を `type` で調べ、失敗ならその値をそのまま返します。

```typescript
// backend/packages/domain/src/business-logic/salon/get-salon.usecase.ts
async execute(id: unknown): Promise<Result<ApiSalonResponse, DomainError>> {
  const salonId = parseSalonId(id)
  if (salonId.type === 'error') {
    return salonId
  }

  const found = await this.dependencies.salonRepository.findById(salonId.data)
  if (found.type === 'error') {
    return found
  }
  if (found.data === null) {
    return Result.error(DomainErrors.notFound('Salon', salonId.data))
  }

  return SalonReadMapper.toApiSalon(found.data.salon, found.data.openingHours)
}
```

`salonId.type === 'error'` の比較で `salonId` は `{ type: 'error'; error: DomainError }` に絞り込まれるので、成功値の型が違う戻り値型にもそのまま返せます。`if` を抜けた後は `salonId.data` が使えます。この形なら `match` を入れ子にせずに済みます。

### 変換をつなぐ

成功値やエラーを変換するだけなら、分岐を書かずに `Result.map` / `Result.mapError` を使います。

```typescript
// backend/packages/domain/src/mappers/read/salon.mapper.ts（toApiSalon の戻り値）
return Result.mapError(
  Result.map(
    parseWith(convertedColumnsSchema, salon, 'Invalid stored salon'),
    (converted) => ({
      ...columns,
      ...converted,
      openingHours: openingHours.map(toApiOpeningHours),
    }),
  ),
  // リクエストは正しく、保存されている行のほうが API モデルに合っていない
  (error) =>
    DomainErrors.database(
      `Stored salon ${salon.id} does not match the API model`,
      error,
    ),
)
```

### Promise の失敗を値にする

ドライバやライブラリの Promise は reject されることがあります。リポジトリはクエリを次の `attempt` に渡し、reject を `DomainError` に変換します。

```typescript
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts
const attempt = async <T>(
  message: string,
  email: string | null,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, email),
  )
```

同期の関数が例外を投げる場合は `Result.fromThrowable` に渡します。使っているのは `TotpAuthenticator`（`backend/packages/infrastructure/src/security/totp-authenticator.ts`）で、`node:crypto` が復号の失敗を例外で知らせるためです。

アプリケーションコードで `try` / `catch` を書いているのは、`Result.fromPromise` と `Result.fromThrowable` の中だけです。

## DomainError

ユースケースが返すエラーはこの7種類です。

```typescript
// backend/packages/domain/src/shared/errors.ts
export type AuthenticationFailure =
  | 'missingCredentials'
  | 'invalidToken'
  | 'expiredToken'
  | 'invalidCredentials'
  | 'twoFactorRequired'

export type DomainError =
  | { type: 'validation'; message: string; issues: ValidationIssue[] }
  | { type: 'unauthenticated'; reason: AuthenticationFailure }
  | { type: 'forbidden' }
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'conflict'; message: string }
  | { type: 'database'; message: string; cause: unknown }
```

値は同じファイルの `DomainErrors.validation(...)`、`DomainErrors.notFound(...)` などで作ります。

| ケース | 作られる場所 | HTTP ステータス |
|--------|--------------|-----------------|
| `validation` | `parseWith`（`backend/packages/domain/src/shared/validation.ts`）が Zod の検証結果から作る。認証のユースケースは、スキーマでは確認できない規則（推測されやすいパスワード、現在のパスワードの誤り、使えないトークン、受け付けられない 2 要素認証のコード）についても作る | 400 |
| `unauthenticated` | 認証のユースケース（`backend/packages/domain/src/business-logic/auth/`）。有効なアクセストークンがない、ログインやトークンの再発行に失敗したとき。2 要素認証が有効なアカウントのログインで、コードがない・受け付けられないときも含む。理由は `reason` が持つ | 401 |
| `forbidden` | ユースケース。操作者にその操作の権限がないとき | 403 |
| `notFound` | ユースケース。リポジトリが `null`（削除では `false`）を返したとき | 404 |
| `alreadyExists` | リポジトリ。メールアドレスの一意制約に違反したとき | 409 |
| `conflict` | 2 要素認証のユースケース。リクエストは正しいが、対象の状態がその操作を許さないとき（すでに有効なのに設定を開始する、など） | 409 |
| `database` | リポジトリ（想定外のクエリ失敗）、読み取りマッパー（保存値が API モデルに合わない） | 500 |

`database` の `cause` はログに書くためのもので、レスポンスには含めません。HTTP ステータスへの対応は次節の `toProblem` が決めています。

## `match` の使い方

### ケースを列挙できる型は `.exhaustive()` で終える

```typescript
// backend/packages/api/src/routes/salon/create-salon.handler.ts
const result = await useCase.execute(actor, req.body)

match(result)
  .with({ type: 'success' }, ({ data }) => {
    const links = salonLinks(req.baseUrl, data.id)
    res
      .status(201)
      .location(links.self)
      .json({ data, meta: responseMeta(req), links })
  })
  .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
  .exhaustive()
```

`.exhaustive()` は、型のケースがすべて `.with()` で扱われていなければコンパイルエラーにします。`.otherwise()` で終えるとケースを足しても検出されないので、ケースを列挙できる型の `match` には使いません。

残りのケースをすべて同じ値にする `match` も、そのケースを 1 つの `.with()` に並べて `.exhaustive()` で終えます。権限の判定は、拒否するケースを並べています。`ActorScope` やロールにケースを足すと、許可するか拒否するかを書くまでコンパイルが通りません。

```typescript
// backend/packages/domain/src/business-logic/salon/_shared/authorization.ts
export const mayDeleteSalon = (actor: Actor, salonId: SalonId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon', role: 'owner' },
      (scope) => scope.salonId === salonId,
    )
    .with(
      { type: 'salon', role: P.union('manager', 'staff') },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
```

`toBearerChallenge`（`backend/packages/api/src/shared/problem-details.ts`）は、`unauthenticated` のときだけ `reason` を同じように `match` して `WWW-Authenticate` の値を返し、それ以外のエラーには `null` を返します。

エラーから問題詳細への変換も同じ形です。`ApiError` の14ケースを1つの `match` で扱っています。`unauthenticated` は `reason` によってコードが違うので、`type` と `reason` を1つのパターンに書き、`reason` ごとに分岐しています。

```typescript
// backend/packages/api/src/shared/problem-details.ts（抜粋）
const toProblem = (error: ApiError): Problem =>
  match(error)
    .returnType<Problem>()
    // ... validation
    .with({ type: 'unauthenticated', reason: 'missingCredentials' }, () => ({
      type: 'urn:beauty-salon:problem:authentication-required',
      title: 'Authentication required',
      status: 401,
      detail:
        'Send the access token in the Authorization header as a Bearer token',
      code: '1001',
      errors: null,
    }))
    // ... unauthenticated の残りの4つの reason、forbidden
    .with({ type: 'notFound' }, ({ entity, id }) => ({
      type: 'urn:beauty-salon:problem:not-found',
      title: 'Resource not found',
      status: 404,
      detail: `${entity} ${id} was not found`,
      code: '3001',
      errors: null,
    }))
    // ... alreadyExists、conflict、database、HttpError の7ケース
    .exhaustive()
```

`.returnType<Problem>()` を付けると、各分岐の戻り値が `Problem` に合うかどうかが分岐ごとに検査されます。オブジェクトリテラルを返す分岐で、`code` のようなリテラル型のプロパティを型アサーションなしで書けます。

判別子が `type` でないライブラリの共用体も同じように扱えます。`parseWith` は Zod の `safeParse` の結果を `{ success: true }` / `{ success: false }` で分岐しています。

### 入れ子のケースをまとめて書く

`Result` の中のエラーがさらに Sum 型のときは、外側と内側の判別子を1つのパターンに書きます。

```typescript
// backend/apps/server/src/index.ts（抜粋）
match(started)
  .with({ type: 'success' }, ({ data: server }) => {
    // ... 起動のログ出力とシグナルハンドラの登録
  })
  .with(
    { type: 'error', error: { type: 'databaseUnreachable' } },
    ({ error }) => {
      logger.fatal(
        { error: error.error },
        'Cannot start: the database is unreachable',
      )
      process.exit(1)
    },
  )
  .with({ type: 'error', error: { type: 'listenFailed' } }, ({ error }) => {
    logger.fatal({ err: error.error }, 'Cannot start: cannot listen')
    process.exit(1)
  })
  .exhaustive()
```

### 分岐の中で非同期処理をする

各分岐を `async` 関数にし、`match` 全体を `await` します。

```typescript
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts（update のトランザクション内）
await match(openingHoursChange)
  .with({ type: 'keep' }, async () => undefined)
  .with({ type: 'replace' }, async (replacement) => {
    await tx.delete(openingHours).where(eq(openingHours.salonId, id))
    await insertOpeningHours(tx, id, replacement.openingHours)
  })
  .exhaustive()
```

### 形のわからない値は `P` のパターンで調べる

`unknown` の値（ミドルウェアに渡されたエラー、ドライバのエラーオブジェクト、リクエストヘッダー）は、型ガードを書かずに `P` のパターンで形を調べます。こちらはケースを列挙できないので `.otherwise()` で終えます。

```typescript
// backend/packages/api/src/middleware/errors.ts
export const toHttpError = (error: unknown): HttpError =>
  match(error)
    .returnType<HttpError>()
    .with({ type: 'entity.parse.failed' }, () => ({ type: 'malformedBody' }))
    .with({ type: 'entity.too.large' }, () => ({ type: 'bodyTooLarge' }))
    .with(
      { type: P.union('encoding.unsupported', 'charset.unsupported') },
      () => ({ type: 'unsupportedMediaType' }),
    )
    .with({ status: P.number.between(400, 499) }, () => ({
      type: 'badRequest',
    }))
    .otherwise(() => ({ type: 'unexpected' }))
```

コードで使っている `P` のパターンは次のとおりです。

| パターン | 用途 | 使用箇所 |
|----------|------|----------|
| `P.string` / `P.number` | プロパティがその型のときだけ取り出す | `describeDatabaseError`（`backend/packages/infrastructure/src/database/failure.ts`）、`portOf`（`backend/apps/server/src/server.ts`） |
| `P.select()` | 一致した値の一部だけを分岐に渡す | `describeDatabaseError` |
| `P.union(...)` | 複数の形のどれか | `toHttpError`、`toDomainError`（`backend/packages/infrastructure/src/repositories/salon.repository.impl.ts`）、`mayUpdateSalon`、`mayDeleteSalon` |
| `P.string.regex(...)` | 文字列の形式 | `assignRequestId`（`backend/packages/api/src/middleware/request-logging.ts`） |
| `P.number.between(...)` / `P.number.gte(...)` | 数値の範囲 | `toHttpError`、`requestLogging` のログレベル判定 |

### `if` で足りるとき

1つのケースだけを特別に扱うなら、`type` の比較で十分です。

```typescript
// backend/packages/api/src/shared/responses.ts（sendProblem の冒頭）
if (error.type === 'database') {
  req.log.error({ cause: error.cause }, error.message)
}
```

使い分けは次のとおりです。

- すべてのケースで違うことをする: `match(...).exhaustive()`
- 失敗をそのまま呼び出し元へ返す、または1ケースだけ扱う: `if (x.type === '...')`
- 成功値やエラーを変換するだけ: `Result.map` / `Result.mapError` / `Result.flatMap`

## ケースを追加するとき

`DomainError` または `HttpError` にケースを足す手順です。

1. 型にケースを足す（`DomainError` なら `DomainErrors` にファクトリも足す）
2. `toProblem` の `.exhaustive()` がコンパイルエラーになるので、ステータス・`code`・`detail` を決めて分岐を足す。api パッケージは domain パッケージの型をビルド成果物から読むため、ビルドしてから `pnpm typecheck` を実行する（理由は [TypeScript設定ガイド](./typescript-configuration.md)）
3. `backend/packages/api/src/shared/__tests__/problem-details.test.ts` に、そのケースのテストを足す

`.otherwise()` で終えている `match`（`toHttpError` など）は、ケースを足してもコンパイラが教えてくれません。`HttpError` にケースを足したときは、それを作る場所も自分で足します。
