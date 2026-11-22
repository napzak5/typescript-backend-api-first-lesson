# Sum型とパターンマッチング

バックエンドで使っている Sum 型（判別共用体）と、それを ts-pattern で処理する書き方をまとめます。

コード例はすべて実装済みのコード（Salon ドメインと共通部分）からの抜粋で、先頭にファイルパスを示しています。コメントは日本語に置き換え、省いた箇所は `// ...` としています。正確な内容は各ファイルを見てください。

この文書が扱うのは Sum 型の定義と `match` の使い方です。`any`・型アサーション・型ガード・例外を使わないという規則と、その代わりに使うもの（境界での Zod による検証、`satisfies`、ブランド型）は [型安全性の原則](./type-safety-principles.md) にあります。

## コードにある Sum 型

| 型 | 定義場所 | ケース |
|----|----------|--------|
| `Result<T, E>` | `backend/packages/utility/src/result/result.ts` | `success` / `error` |
| `DomainError` | `backend/packages/domain/src/shared/errors.ts` | `validation` / `unauthenticated` / `forbidden` / `passwordRequired` / `notFound` / `alreadyExists` / `conflict` / `database` / `storage` |
| `HttpError` | `backend/packages/api/src/shared/problem-details.ts` | `routeNotFound` / `malformedBody` / `unsupportedMediaType` / `bodyTooLarge` / `badRequest` / `rateLimited` / `unexpected` |
| `ApiError` | 同上 | `DomainError` と `HttpError` の和 |
| `OpeningHoursChange` | `backend/packages/domain/src/models/salon.ts` | `keep` / `replace` |
| `ServiceCategoryCreation` | `backend/packages/domain/src/repositories/service-category.repository.ts` | `created` / `parentNotFound` |
| `ServiceCategoryUpdate` | 同上 | `updated` / `notFound` / `parentNotFound` / `parentWithinSubtree` |
| `ServiceOptionsChange` | `backend/packages/domain/src/models/service.ts` | `keep` / `replace` |
| `ServiceWriteRefusal` | `backend/packages/domain/src/repositories/service.repository.ts` | `categoryNotFound` / `packageMemberNotFound` / `packageMemberIsPackage` |
| `ServiceChangeRefusal` | 同上 | `ServiceWriteRefusal` のケースと、`notFound` / `invalid` / `containedInPackage` |
| `ServiceCreation` | 同上 | `created` と、`ServiceWriteRefusal` のケース |
| `ServiceUpdate`、`ServiceBulkUpdate` | 同上 | `updated` と、`ServiceChangeRefusal` のケース |
| `ServiceDeletion` | 同上 | `deleted` / `notFound` / `containedInPackage` / `bookingsUnfinished` |
| `CustomerCreation` | `backend/packages/domain/src/repositories/customer.repository.ts` | `created` / `referrerNotFound` |
| `CustomerUpdate` | 同上 | `updated` / `notFound` / `referrerNotFound` |
| `CustomerDeletion` | 同上 | `deleted` / `notFound` / `bookingsUnfinished` |
| `SalonDeletion` | `backend/packages/domain/src/repositories/salon.repository.ts` | `deleted` / `notFound` / `bookingsUnfinished` |
| `StaffDeletion` | `backend/packages/domain/src/repositories/staff.repository.ts` | `deleted` / `notFound` / `bookingsUnfinished` |
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
// backend/packages/domain/src/mappers/read/salon.mapper.ts（toApiSalon の戻り値と、そのエラー）
return Result.mapError(
  Result.map(
    parseWith(convertedColumnsSchema, salon, 'Invalid stored salon'),
    (converted) => ({
      ...columns,
      ...converted,
      openingHours: openingHours.map(toApiOpeningHours),
    }),
  ),
  (error) => storedDoesNotMatch(salon.id, error),
)

// リクエストは正しく、保存されている行のほうが API モデルに合っていない
const storedDoesNotMatch = (id: string, cause: unknown): DomainError =>
  DomainErrors.database(
    `Stored salon ${id} does not match the API model`,
    cause,
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

ユースケースが返すエラーはこの 9 種類です。

```typescript
// backend/packages/domain/src/shared/errors.ts
export type AuthenticationFailure =
  | 'missingCredentials'
  | 'invalidToken'
  | 'expiredToken'
  | 'invalidCredentials'
  | 'twoFactorRequired'

export type DomainError =
  | { type: 'validation'; message: Told; issues: ValidationIssue[] }
  | { type: 'unauthenticated'; reason: AuthenticationFailure }
  | { type: 'forbidden' }
  | { type: 'passwordRequired' }
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'conflict'; message: string }
  | { type: 'database'; message: string; cause: unknown }
  | { type: 'storage'; message: string; cause: unknown }
```

値は同じファイルの `DomainErrors.validation(...)`、`DomainErrors.notFound(...)` などで作ります。

`Told`（`backend/packages/domain/src/shared/told.ts`）は、エラーの文の型です。すべての言語で書いた文（`LocalizedText`）か、英語だけの文字列です。ドメインが書く文をすべての言語で書き終えるまでの間だけ、文字列も受け付けます。検証のエラーの見出しと、決まりごとの `message` が、この型です（[多言語](./i18n.md)）。

| ケース | 作られる場所 | HTTP ステータス |
|--------|--------------|-----------------|
| `validation` | `parseWith`（`backend/packages/domain/src/shared/validation.ts`）が Zod の検証結果から作る。認証のユースケースは、スキーマでは確認できない規則（推測されやすいパスワード、現在のパスワードの誤り、使えないトークン、受け付けられない 2 要素認証のコード、そのユーザーのセッションを指していないセッション一覧のカーソル）についても作る。サービスカテゴリーのユースケースも、親にできないカテゴリーを指す `parentId`（同じサロンのカテゴリーでない、またはそのカテゴリー自身かその下位のカテゴリー）と、そのサロンのカテゴリーを指していない一覧のカーソルについて作る。サービスのユースケースも、2 つの項目を結ぶ規則（`discountPrice` と `price`、`isPackage` と `packageServiceIds`）に反するサービス、同じサロンのものでないカテゴリー、パッケージの構成にできないサービス、パッケージに含まれているサービスをパッケージにする変更、そのサロンのサービスを指していない一覧のカーソルについて作る。リポジトリの拒否（`ServiceChangeRefusal`）から作る場所は、`backend/packages/domain/src/business-logic/service/_shared/refusals.ts` の `toRefusalError` の 1 か所である。顧客のユースケースも、生年月日の範囲（1900-01-01 以降で、未来の日付でない。未来かどうかは、依存の `clock` が返す現在時刻で決まる）、紹介元にできない顧客を指す `referredBy`（その顧客自身、または存在しないか削除済みの顧客）、顧客を指していない一覧のカーソルについて作る。スタッフの一覧のユースケースも、そのサロンのスタッフを指していないカーソルについて作る | 400 |
| `unauthenticated` | 認証のユースケース（`backend/packages/domain/src/business-logic/auth/`）。有効なアクセストークンがない、ログインやトークンの再発行に失敗したとき。2 要素認証が有効なアカウントのログインで、コードがない・受け付けられないときも含む。理由は `reason` が持つ | 401 |
| `forbidden` | ユースケース。操作者にその操作の権限がないとき | 403 |
| `passwordRequired` | 共有リンクの閲覧のユースケース。パスワードで保護した共有リンクに、受け付けられるパスワードが届かなかったとき（ない、違う、ロック中） | 403 |
| `notFound` | ユースケース。リポジトリが `null`（削除では `false`）を返したとき、またはリポジトリの結果が `notFound` のケースだったとき（`ServiceCategoryUpdate`、`ServiceUpdate`、`ServiceBulkUpdate`、`ServiceDeletion`、`CustomerUpdate`）。サロンの下にあるルートでは、パスのサロンが存在しないときも作る（`backend/packages/domain/src/business-logic/_shared/existing-salon.ts` の `requireSalon`） | 404 |
| `alreadyExists` | リポジトリ。書き込みが一意性に違反したとき。サロンのメールアドレス、顧客のメールアドレス（削除されていない顧客の間で一意）、顧客の紹介コード（削除済みを含むすべての顧客の間で一意）、スタッフのメールアドレス（同じサロンの削除されていないスタッフの間で一意）、スタッフコード（同じサロンの、削除済みを含むすべてのスタッフの間で一意）。どれに違反したかは、違反した制約の名前で見分ける | 409 |
| `conflict` | 2 要素認証のユースケースと、管理者の操作のユースケース。リクエストは正しいが、対象の状態がその操作を許さないとき（すでに有効なのに設定を開始する、ロックされていないアカウントのロックを解除する、など）。サービスの削除のユースケースも、パッケージに含まれているサービスについて作る。顧客、スタッフ、サービス、サロンの削除のユースケースは、終わっていない予約が参照しているときにも作る（`backend/packages/domain/src/business-logic/_shared/unfinished-bookings.ts`）。スタッフの更新と削除のユースケースは、操作者が自分のアカウントの属するスタッフ情報を無効化または削除しようとしたときに作る（`backend/packages/domain/src/business-logic/staff/_shared/refusals.ts`）。権限がないのではなく、その操作が成り立たないので、`forbidden` ではない | 409 |
| `database` | リポジトリ（想定外のクエリ失敗）、読み取りマッパー（保存値が API モデルに合わない） | 500 |
| `storage` | 添付ファイルの保存先（`S3FileStorage`）。オブジェクトストレージの呼び出しが失敗したとき、拒否されたとき | 500 |

`database` と `storage` の `cause` はログに書くためのもので、レスポンスには含めません。HTTP ステータスへの対応は次節の `toProblem` が決めています。

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

エラーから問題詳細への変換も同じ形です。`ApiError` の 16 のケースを 1 つの `match` で扱っています。`unauthenticated` は `reason` によってコードが違うので、`type` と `reason` を1つのパターンに書き、`reason` ごとに分岐しています。

```typescript
// backend/packages/api/src/shared/problem-details.ts（抜粋）
const toProblem = (error: ApiError, language: Locale): Problem => {
  const said = (text: LocalizedText): string => textIn(text, language)

  return match(error)
    .returnType<Problem>()
    // ... validation
    .with({ type: 'unauthenticated', reason: 'missingCredentials' }, () => ({
      type: 'urn:beauty-salon:problem:authentication-required',
      title: said(problemMessages.authenticationRequired.title),
      status: 401,
      detail: said(problemMessages.authenticationRequired.detail),
      code: '1001',
      errors: null,
    }))
    // ... unauthenticated の残りの4つの reason、forbidden、passwordRequired
    .with({ type: 'notFound' }, ({ entity, id }) => ({
      type: 'urn:beauty-salon:problem:not-found',
      title: said(problemMessages.notFound.title),
      status: 404,
      detail: `${entity} ${id} was not found`,
      code: '3001',
      errors: null,
    }))
    // ... alreadyExists、conflict、database、storage、HttpError の7ケース
    .exhaustive()
}
```

`title` と、API の層が決める `detail` は、すべての言語で書いたメッセージ（`@beauty-salon-shared/i18n/messages/api` の `problemMessages`）で、`said` がその応答の言語で読みます（[多言語](./i18n.md)）。

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
| `P.union(...)` | 複数の形のどれか | `toHttpError`、`toDomainError`（`backend/packages/infrastructure/src/repositories/salon.repository.impl.ts`、`customer.repository.impl.ts`、`staff.repository.impl.ts`）、`mayUpdateSalon`、`mayDeleteSalon`、`mayManageServiceCategories`、`mayManageServices`、`mayDeleteCustomers`、`mayKeepStaffLedger`、`CreateServiceUseCase`（リポジトリが拒否した理由をまとめて受ける） |
| `P.not(...)` | 1 つの値以外のすべて | `UpdateServiceUseCase`、`BulkUpdateServicesUseCase`（`updated` 以外の結果、つまり拒否をまとめて `toRefusalError` に渡す。拒否の理由は `toRefusalError` の `match` が網羅する） |
| `P.array()` | 配列であること | `describeDatabaseError` |
| `P.string.regex(...)` | 文字列の形式 | `assignRequestId`（`backend/packages/api/src/middleware/request-logging.ts`） |
| `P.number.between(...)` / `P.number.gte(...)` | 数値の範囲 | `toHttpError`、`requestLogging` のログレベル判定 |

### `if` で足りるとき

1 つか 2 つのケースだけを特別に扱うなら、`type` の比較で十分です（下の例は、原因をログに書く 2 つのケース）。

```typescript
// backend/packages/api/src/shared/responses.ts（sendProblem の冒頭）
if (error.type === 'database' || error.type === 'storage') {
  req.log.error({ cause: error.cause }, error.message)
}
```

使い分けは次のとおりです。

- すべてのケースで違うことをする: `match(...).exhaustive()`
- 失敗をそのまま呼び出し元へ返す、または 1 つか 2 つのケースだけ扱う: `if (x.type === '...')`
- 成功値やエラーを変換するだけ: `Result.map` / `Result.mapError` / `Result.flatMap`

## ケースを追加するとき

`DomainError` または `HttpError` にケースを足す手順です。

1. 型にケースを足す（`DomainError` なら `DomainErrors` にファクトリも足す）
2. `toProblem` と `languageOf`（そのエラーを言う言語）の `.exhaustive()` がコンパイルエラーになるので、ステータス・`code`・`detail` と、`detail` をだれが書くか（ドメインか、API の層か）を決めて、両方に分岐を足す。`title` と、API の層が決める `detail` は、`shared-i18n/src/messages/api/problems.ts` に、英語と日本語で書く。api パッケージは domain パッケージの型をビルド成果物から読むため、ビルドしてから `pnpm typecheck` を実行する（理由は [TypeScript設定ガイド](./typescript-configuration.md)）
3. `backend/packages/api/src/shared/__tests__/problem-details.test.ts` に、そのケースのテストを足す

`.otherwise()` で終えている `match`（`toHttpError` など）は、ケースを足してもコンパイラが教えてくれません。`HttpError` にケースを足したときは、それを作る場所も自分で足します。
