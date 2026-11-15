# TypeScriptバックエンドアーキテクチャガイドライン

この文書は、バックエンドのコードを**各レイヤーでどう書くか**をまとめたものです。参照実装は Salon ドメインで、掲載しているコードはすべて実ファイルからの抜粋です（コメントだけ日本語にしています）。

ほかの文書との分担は次のとおりです。

- [アーキテクチャ概要](./architecture-overview.md): システム全体の説明。パッケージの依存関係、型生成の流れ、リクエストの流れ、実装済みの範囲はそちらにあり、本書では繰り返しません。
- [CLAUDE.md](../CLAUDE.md): 規約とコマンドの正本。Salon ドメインの全レイヤーのシグネチャもそこにまとまっています。本書は規約の適用のしかたと理由を説明します。

バックエンドで実装済みなのは、Salon ドメイン、サロンのサービスカテゴリー（`/api/v1/salons/{salonId}/service-categories`）、サロンのサービス（`/api/v1/salons/{salonId}/services`）、サロンのスタッフ台帳（`/api/v1/salons/{salonId}/staff`。`StaffCrud` の、スタッフの一覧、登録、1 件の取得、更新、削除）、スタッフの勤務スケジュール（`/api/v1/salons/{salonId}/staff/{id}/schedules`。`StaffSchedules` の一覧と更新）、スタッフのログインアカウントへの招待（`/api/v1/salons/{salonId}/staff/{id}/invitation` と `/api/v1/auth/staff-invitation`。`StaffInvitations` の取得、作成、取り消しと、`AuthCrud` の招待の確認、受け入れ、参加）、スタッフに紐づいたアカウント（`/api/v1/salons/{salonId}/staff/{id}/account`。`StaffAccounts` の取得、ロールの変更、紐づけの解除）、顧客に見せるスタッフのプロフィール（`/api/v1/staff-profiles`。`StaffProfile` の一覧と 1 件の取得）、スタッフ本人のプロフィール（`/api/v1/staff-profiles/me`。`StaffOwnProfile` の取得と更新）、顧客台帳（`/api/v1/customers`。`CustomerCrud` のうち、顧客の一覧、登録、1 件の取得、更新、削除）、顧客本人のプロフィール（`/api/v1/customers/me`。`CustomerProfile` の取得、作成、更新）、顧客の好み設定（`/api/v1/customers/{id}/preferences` と `/api/v1/customers/me/preferences`。`CustomerCrud` と `CustomerProfile` の、好み設定の取得と更新）、予約台帳（`/api/v1/bookings`。`BookingCrud` のうち、予約の一覧、作成、1 件の取得）、認証のすべてのオペレーション（ログイン、トークンの再発行、ログアウト、全セッションのログアウト、自分の情報の取得、ユーザー登録、メールアドレスの確認、パスワードの再設定と変更、スタッフの招待の確認、受け入れ、参加、2 要素認証、セッションの一覧と無効化、管理者の操作）、システムエンドポイントだけです。ほかのドメインを実装するときは、Salon のファイルと同じ構成で書いてください。データが 1 つのサロンに属するドメインでは、書き方がいくつか変わります。その例がサービスカテゴリーで、違いは「[9. サロンに属するデータ](#9-サロンに属するデータ-サロンはパスで受け取る)」にまとめています。サービスカテゴリーにはなくサービスにあるもの（2 つのテーブルの行を含むリクエスト、2 つの項目を結ぶ規則、一括更新、論理削除）も、同じ節にあります。サロンに属し、公開のオペレーションがないデータの例がスタッフ台帳で、その違い（どのオペレーションでも最初に判定する権限、操作者自身のスタッフ情報を守る規則、サロンの中での 2 つの一意性）も、同じ節の最後にあります。サロンの 1 つのレコードに属し、全体を置き換える行の例がスタッフの勤務スケジュールで、その違い（レコードの下にマウントするルーター、2 段階の権限、行をロックして置き換えるトランザクション）も、同じ節の最後にあります。メールで送ったトークンで届くレコードの例がスタッフの招待で、その違い（招待する側と招待された側の 2 つのルーター、本文を検証してから判定する 2 つめの権限、結果を直和型で返すリポジトリ、スタッフの行をロックしてから判定し直す書き込み）も、同じ節の最後にあります。テーブルを持たず、ほかのテーブルの行の一部をサロンに扱わせるデータの例がスタッフのアカウントで、その違い（カラムの Enum より狭い Enum、操作者自身のアカウントを守る規則）も、同じ節の最後にあります。公開しないデータのうち、誰にでも見せる部分の例がスタッフのプロフィールで、その違い（見せる列だけを読むリポジトリ、サロンの下に置かない公開のルート、アカウントが対象を決める本人のルート）も、同じ節の最後にあります。サロンに属さず、公開のオペレーションもないデータの例が顧客台帳です。書き方の違い（何も変換しない Write マッパー、操作者だけで最初に判定する権限、依存から受け取る現在時刻、範囲の違う 2 つの一意性、権限のあとで返すクエリのエラー）は、実装パターンの 3、5、6、7、8 のそれぞれの箇所に書いてあります。行が保存されていてもいなくても、どのレコードにも「ある」付随データの例が顧客の好み設定です。その違い（作成と削除のないオペレーション、行がないときに返す空の値、保存されている値と照らす規則、顧客の行をロックしてから判定する書き込み）は、[ドメイン実装リファレンス](./domain-implementation-reference.md#a-record-every-customer-has-the-preferences) にまとめています。サロンに属するが、ルートをサロンの下に置かないデータの例が予約台帳です。その違い（操作者に届く範囲を先に決め、リクエストがサロンを指定してから判定する 2 段階の権限、参照する行から書く行を決める純粋な関数、参照する行をロックし、スタッフの占有を確かめてから書くトランザクション、システムが決める番号の発行）は、[ドメイン実装リファレンス](./domain-implementation-reference.md#data-of-a-salon-whose-routes-are-not-below-it-the-booking-ledger) にまとめています。認証と認可の仕様は [認証と認可](./authentication.md)、サービスカテゴリーとサービスの規則は [サービスメニュー](./service-menu.md)、顧客台帳の規則は [顧客台帳](./customers.md)、スタッフ台帳の規則は [スタッフ台帳](./staff.md)、予約台帳の規則は [予約台帳](./bookings.md) にあり、本書ではコードの書き方だけを扱います。

---

## 依存ルールと禁止事項

アプリケーションコード（`backend/packages` の `api`・`domain`・`infrastructure`・`config`・`utility` と `backend/apps/server`）では、次を守ります。

| ルール | 代わりにどうするか |
|--------|--------------------|
| `any`、型アサーション（`as`）、型ガードを書かない | 外から来た値は Zod スキーマで検証し、分岐は ts-pattern か `type` プロパティの比較で絞り込む |
| `throw` しない | 失敗は `Result<T, E>` で返す |
| `try`/`catch` を新たに書かない | アプリケーションコードの `try`/`catch` は `Result.fromPromise` と `Result.fromThrowable`（`backend/packages/utility/src/result/result.ts`）の2か所だけ。外部のコードが投げる例外は、Promise なら `fromPromise` に、同期の関数なら `fromThrowable` に渡して `Result` に変える。ハンドラーにも書かない（Express 5 は reject された Promise をエラーハンドラーに渡す） |
| `process.env` を読まない | 設定は `parseAppConfig` が一度だけ読み、値として引数で渡す |
| `console` を使わない | リクエスト中は `req.log`、それ以外は注入された `Logger` を使う |
| グローバルを経由して依存を取り出さない | リポジトリなどの依存は起動時に一度作り、引数で渡す |

依存の向きは次のとおりです。

- `domain` は I/O を行うパッケージを import しません。`database` から import するのは型だけです。
- `infrastructure` は `domain` が宣言したインターフェースを実装します。リポジトリのほか、パスワードのハッシュ（`IPasswordHasher`）、トークンの生成（`ITokenIssuer`。セッションのトークンと、メールで送るトークン）、2 要素認証のシークレットとコード（`ITwoFactorAuthenticator`）、メールの送信（`IMailer`）も同じ形です。
- `api` はユースケースを呼び出し、結果を HTTP に変換するだけです。認証も同じで、`Authorization` ヘッダーをユースケースに渡して操作者（`Actor`）を受け取るだけです。ロールや権限は判定しません。
- 環境変数を読み、プロセスを終了させるのは `backend/apps/server/src/index.ts` だけです。

データベースのスクリプト（`backend/packages/database/src/scripts`）、シード、テストはサーバーが実行するコードではないので、`throw` や `console` を使ってかまいません。

---

## ディレクトリ構造

種類ごとのディレクトリの下に、ドメインごとのファイルを置きます。`<domain>` は `salon` のようなドメイン名です。

| 書くもの | 置き場所 | Salon の実ファイル |
|----------|----------|--------------------|
| 型（ID・API 型・DB 型） | `domain/src/models/<domain>.ts` | `backend/packages/domain/src/models/salon.ts` |
| リクエストの検証スキーマ | `domain/src/schemas/<domain>.schema.ts` | `backend/packages/domain/src/schemas/salon.schema.ts` |
| API → DB の変換（変換が必要な列がなく、リクエストが 1 つのテーブルの行だけなら、なくてもよい） | `domain/src/mappers/write/<domain>.mapper.ts` | `backend/packages/domain/src/mappers/write/salon.mapper.ts` |
| DB → API の変換 | `domain/src/mappers/read/<domain>.mapper.ts` | `backend/packages/domain/src/mappers/read/salon.mapper.ts` |
| リポジトリのインターフェース | `domain/src/repositories/<domain>.repository.ts` | `backend/packages/domain/src/repositories/salon.repository.ts` |
| ユースケース（1操作1ファイル） | `domain/src/business-logic/<domain>/<action>-<domain>.usecase.ts` | `backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts` ほか4つ |
| ユースケースの依存 | `domain/src/business-logic/<domain>/_shared/dependencies.ts` | `backend/packages/domain/src/business-logic/salon/_shared/dependencies.ts` |
| 権限の判定 | `domain/src/business-logic/<domain>/_shared/authorization.ts` | `backend/packages/domain/src/business-logic/salon/_shared/authorization.ts` |
| リポジトリの実装 | `infrastructure/src/repositories/<domain>.repository.impl.ts` | `backend/packages/infrastructure/src/repositories/salon.repository.impl.ts` |
| ハンドラー（1操作1ファイル） | `api/src/routes/<domain>/<action>-<domain>.handler.ts` | `backend/packages/api/src/routes/salon/create-salon.handler.ts` ほか4つ |
| ルーター | `api/src/routes/<domain>/index.ts` | `backend/packages/api/src/routes/salon/index.ts` |
| ルート固有の補助（リンク、クエリの変換、レスポンス型） | `api/src/routes/<domain>/_shared/` | `backend/packages/api/src/routes/salon/_shared` |

ドメインをまたいで使うものは次の場所にあります。

- `backend/packages/domain/src/shared`: `DomainError`、`DomainErrors`、`parseWith`
- `backend/packages/domain/src/models/auth.ts`: 操作者を表す `Actor` と `ActorScope`
- `backend/packages/domain/src/schemas/rules.ts`: 複数のドメインのリクエストスキーマが共通で使うルール（`nonBlankText`、`lowerCaseEmail`、`phoneNumber`、`MAX_INTEGER`、`noRepeatedEntries`、`atLeastOneProperty`）
- `backend/packages/domain/src/models/salon.ts` の `parseSalonIdOfPath` と `backend/packages/domain/src/business-logic/_shared/existing-salon.ts` の `requireSalon`: サロンの下にあるルートのユースケースが、パスのサロン ID を検証し、サロンが存在することを確かめるのに使う
- `backend/packages/domain/src/mappers/read/columns.ts`: Read マッパーが共通で使う列の変換（`numericSchema`、`timestampSchema`）
- `backend/packages/infrastructure/src/database/attempt.ts`: 想定している失敗がないクエリを `Result` に変える `attempt`
- `backend/packages/infrastructure/src/database/like.ts`: キーワードを文字どおりに探す LIKE のパターンを作る `containing`（Salon と顧客の一覧のキーワード検索が使う）
- `backend/packages/api/src/shared`: `sendProblem`、`responseMeta`、`toProblemDetails`、`createAuthenticated`（`authenticated` を作る）、生成型から JSON の本文を取り出す `JsonBody`、一覧のページのリンクを作る `pageLinks`、クエリパラメータを型に直す部品（`numberParameter`、`booleanParameter`、`listParameter`）、API バージョン
- `backend/packages/api/src/middleware`: リクエストログ、レート制限、エラーハンドラー
- `backend/packages/utility/src`: `Result`（`success`・`error`・`map`・`mapError`・`flatMap`・`fromThrowable`・`fromPromise`）、`DeepRequired`、`Omit`

`domain` パッケージが外に公開するのは、ユースケース、モデル、リポジトリとサービスのインターフェース、エラーと検証の共通部品です（`backend/packages/domain/src/index.ts`）。リクエストのスキーマとマッパーはパッケージの中だけで使います。

---

## 実装パターン

下のレイヤーから順に説明します。新しいドメインもこの順で書きます。

### 1. モデル: 型は宣言せず、導出する

```typescript
// backend/packages/domain/src/models/salon.ts（抜粋）
export const salonIdSchema = uuidSchema.brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

// API 型: TypeSpec から生成された型
export type ApiSalonResponse = components['schemas']['Models.SalonResponse']
export type ApiSalonCreateRequest =
  components['schemas']['Models.SalonCreateRequest']

// DB 型: Drizzle スキーマから推論
export type DbSalon = DeepRequired<typeof salons.$inferSelect>

type SalonManagedColumn =
  | 'id'
  | 'rating'
  | 'reviewCount'
  | 'cancellationPolicy'
  | 'bookingPolicy'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewSalon = DeepRequired<
  Omit<typeof salons.$inferInsert, SalonManagedColumn>
>
export type DbSalonChanges = Partial<DbNewSalon>
```

- 型を手で宣言しません。DB 型は Drizzle スキーマから `DeepRequired` で推論し、API 型は生成型から取り出します。テーブルや API 契約が変わると、マッパーが型エラーになって気づけます。
- ID は Zod のブランド付き UUID です。`salonIdSchema` で検証した値だけが `SalonId` になるので、未検証の文字列をリポジトリに渡せません。パスパラメータは `parseSalonId` で検証します。
- リクエストから書き込まない列（DB が採番する列、ほかの機能が更新する列、API に公開していない列）は `SalonManagedColumn` のようにまとめて除外します。同じ列を `backend/packages/database/src/scripts/api-consistency-rules.ts` の `omittedColumns` にも書きます。
- 取りうる状態が複数ある値は Sum 型にします。たとえば更新時の営業日カレンダーは `{ type: 'keep' } | { type: 'replace'; openingHours: DbNewOpeningHours[] }`（`OpeningHoursChange`）です。

型の導出について詳しくは [DB駆動ドメインモデル](./db-driven-domain-model.md) を参照してください。

### 2. バリデーションスキーマ: リクエスト1つにスキーマ1つ

```typescript
// backend/packages/domain/src/schemas/salon.schema.ts（抜粋）
export const salonUpdateRequestSchema = salonCreateRequestSchema
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiSalonUpdateRequest>
```

```typescript
// backend/packages/domain/src/schemas/rules.ts（抜粋）
// 更新のスキーマ用。プロパティを 1 つも指定しないリクエストは何も変えないので拒否する。
// 未知のプロパティはそのエラーとして報告し、「空のリクエスト」とは報告しない
export const atLeastOneProperty = (
  context: z.core.ParsePayload<object>,
): void => {
  if (context.issues.length === 0 && Object.keys(context.value).length === 0) {
    context.issues.push({
      code: 'custom',
      path: [],
      message: 'At least one property must be specified',
      input: context.value,
    })
  }
}
```

- スキーマの末尾に `satisfies z.ZodType<生成された API 型>` を付けます。スキーマと API 契約がずれるとコンパイルエラーになります。
- オブジェクトは `z.strictObject` で定義し、未知のプロパティを拒否します。
- 文字数の上限は DB の列の長さに、`.nullable()` は DB の NULL 許可に合わせます。
- Create は全プロパティ必須です（値は `null` でもよい）。Update は Create のスキーマに `.exactPartial()` を付けて全プロパティを省略可能にし、`.check(atLeastOneProperty)` でプロパティが 1 つもないリクエストを拒否します。Search の絞り込み条件は `.exactOptional()` で省略可能にします。
- 複数の項目にまたがるルールは `.check()` に書き、`context.issues.push` で項目のパスを付けて報告します。ただし、部分更新で片方だけを指定できる 2 つの項目を結ぶルールは、リクエストだけでは判定できないので、スキーマには書きません（[9. サロンに属するデータ](#9-サロンに属するデータ-サロンはパスで受け取る) のサービスの `serviceRuleIssues`）。
- 複数のドメインのスキーマが共通で使うルールは `backend/packages/domain/src/schemas/rules.ts` にあります。空白だけの文字列を拒否する `nonBlankText`、小文字にそろえて保存し比較するメールアドレスの `lowerCaseEmail`、電話番号の `phoneNumber`、`integer` 列の最大値である `MAX_INTEGER`、同じ値を重ねて指定できない配列のための `noRepeatedEntries`、上の `atLeastOneProperty` です。ドメインごとに書き直しません。
- スキーマが扱うのは、入力だけで判定できるルールです。DB を見ないと分からないこと（メールアドレスの重複）は、一意制約に任せてリポジトリが報告します。現在時刻で決まるルール（顧客の生年月日が未来の日付でないこと）も、スキーマには書きません。ユースケースが判定します（[5. ユースケース](#5-ユースケース-検証して変換して保存する)）。

検証は `parseWith` で実行します。破られたルールはすべて `ValidationIssue`（`field`・`rule`・`message`）になり、`validation` エラーとして返ります。

```typescript
// backend/packages/domain/src/shared/validation.ts（シグネチャ）
export const parseWith = <T>(
  schema: z.ZodType<T>,
  input: unknown,
  message: string,
): Result<T, DomainError>
```

### 3. マッパー: プロパティ名は変えず、表現だけを変える

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
}
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

const toApiSalon = (
  salon: DbSalon,
  openingHours: DbOpeningHours[],
): Result<ApiSalonResponse, DomainError> => {
  const { deletedAt, cancellationPolicy, bookingPolicy, ...columns } = salon

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, salon, 'Invalid stored salon'),
      (converted) => ({
        ...columns,
        ...converted,
        openingHours: openingHours.map(toApiOpeningHours),
      }),
    ),
    // リクエストは正しい。壊れているのは保存されている行のほう
    (error) =>
      DomainErrors.database(
        `Stored salon ${salon.id} does not match the API model`,
        error,
      ),
  )
}
```

- API のプロパティ名は DB の列名と同じなので、大半の項目はスプレッドでそのまま渡ります。マッパーで名前を付け替えません。
- 変換するのは表現だけです。`numeric` 列はドライバーが文字列で読み書きするので number と相互に変換し、`timestamptz` は ISO 8601 に直し、`jsonb` は API モデルのスキーマで検査します。
- `null` を空文字や既定値に置き換えません。
- Read マッパーは `Result` を返します。保存されているデータが API モデルに合わない場合は、クライアントの誤りではないので `validation` ではなく `database` エラーにします。
- 変換する列が 1 つもない Read マッパーは、失敗することがないので、`Result` ではなく値を返します。スタッフのプロフィール（`backend/packages/domain/src/mappers/read/staff-profile.mapper.ts`）がその例で、レスポンスのプロパティを 1 つずつ名指しするだけです。
- Update では、リクエストに存在するプロパティだけを変更にします（`fromUpdateRequest`）。プロパティがなければその列に触れず、`null` なら列を NULL にします。
- Write マッパーが要るのは、表現を変える列があるときと、リクエストが複数のテーブルの行を含むときです。サービスカテゴリーにはどちらもなく、Write マッパーもありません。リクエストのプロパティがそのまま列で、どの列も API と DB で表現が同じなので、検証済みのリクエストをそのままリポジトリに渡します（`backend/packages/domain/src/models/service-category.ts` の `ServiceCategoryManagedColumn` のコメント）。サービスにも表現を変える列はありませんが、リクエストがサービスの行とオプション（`service_options`）の行を含むので、`ServiceWriteMapper`（`backend/packages/domain/src/mappers/write/service.mapper.ts`）がその 2 つを分けます。顧客にもどちらもありませんが、`CustomerWriteMapper`（`backend/packages/domain/src/mappers/write/customer.mapper.ts`）があります。何も変換せず、リクエストをそのまま行として返すだけです。リクエストの型と行の型が合っていることを、コンパイラがここで検査します。スタッフには表現を変える列が 1 つあります。`numeric` 列の `commissionRate` で、`StaffWriteMapper`（`backend/packages/domain/src/mappers/write/staff.mapper.ts`）が number を文字列に変えます。ほかの項目はそのまま渡します。

### 4. リポジトリインターフェース: DB 型と Result で宣言する

インターフェースの全体は `backend/packages/domain/src/repositories/salon.repository.ts` と [CLAUDE.md](../CLAUDE.md) にあります。書くときの決まりは次のとおりです。

- 引数と戻り値は DB 型（`DbNewSalon`、`SalonWithOpeningHours` など）です。API 型は使いません。
- すべてのメソッドが `Promise<Result<T, DomainError>>` を返します。
- 「見つからない」はエラーにせず、`null`（`findById`・`update`）や `false`（`delete`）で返します。それを `notFound` にするのはユースケースです。
- `null` や `false` では区別できない結果は Sum 型で返します。サービスカテゴリーの `update` の結果は `updated`・`notFound`・`parentNotFound`・`parentWithinSubtree` のどれか（`backend/packages/domain/src/repositories/service-category.repository.ts` の `ServiceCategoryUpdate`）で、ユースケースが `match` で網羅します。サービスの書き込みは、拒否の理由がさらに多くなります（`backend/packages/domain/src/repositories/service.repository.ts` の `ServiceWriteRefusal`、`ServiceChangeRefusal`）。作成・更新・一括更新の拒否をクライアントに返すエラーに変えるのは、`backend/packages/domain/src/business-logic/service/_shared/refusals.ts` の `toRefusalError` の 1 か所です。
- 一覧の条件は `SalonListCriteria` のように専用の型で受け取り、「`null` は絞り込まない」ことを型で表します。
- 論理削除された行（`deletedAt`）は、どのメソッドからも見えません。書き込みは原子的で、サロンと営業日カレンダーは同時に変わるか、どちらも変わりません。

### 5. ユースケース: 検証して、変換して、保存する

```typescript
// backend/packages/domain/src/business-logic/salon/get-salon.usecase.ts
export class GetSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

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
}
```

- 1操作につき1クラスです。基底クラスは作りません。依存は `SalonUseCaseDependencies` のオブジェクト1つをコンストラクタで受け取ります。引数の順序に依存せず、テストで1つだけ差し替えられます。
- 現在時刻が要るユースケースは、`new Date()` を呼ばず、依存の `clock`（`() => Date`）から受け取ります。認証のユースケース（`AuthUseCaseDependencies`）と顧客のユースケース（`CustomerUseCaseDependencies`）がそうです。顧客の登録と更新は、生年月日が未来の日付でないことを、`customerRuleIssues`（`backend/packages/domain/src/business-logic/customer/_shared/rules.ts`）に `clock()` の値を渡して判定します。テストでは時刻を固定できます。
- `execute` の入力は `unknown` です。検証はここで一度だけ行います（本文は `parseWith`、ID は `parseSalonId`）。
- 公開でないオペレーションのユースケースは、第 1 引数に操作者（`actor: Actor`）を取ります。上の取得と一覧は公開なので取りません。
- 書き込みの手順は「権限の判定 → 検証 → API から DB への変換 → 保存 → DB から API への変換」です（`create-salon.usecase.ts`）。

権限は、ユースケースが最初に判定します。判定そのものは `_shared/authorization.ts` に純粋な関数として置き、許可されなければ `DomainErrors.forbidden()` を返します。

```typescript
// backend/packages/domain/src/business-logic/salon/_shared/authorization.ts（抜粋）
// 管理者と、そのサロンのオーナー
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

```typescript
// backend/packages/domain/src/business-logic/salon/delete-salon.usecase.ts（抜粋）
async execute(
  actor: Actor,
  id: unknown,
): Promise<Result<SalonId, DomainError>> {
  const salonId = parseSalonId(id)
  if (salonId.type === 'error') {
    return salonId
  }
  if (!mayDeleteSalon(actor, salonId.data)) {
    return Result.error(DomainErrors.forbidden())
  }
```

- 判定に使うのは `actor.scope`（`ActorScope`）です。`users.role` や `users.permissions` を直接読みません。
- 対象が 1 つのサロンに属する操作では、操作者のサロンと対象のサロンを比べます。パスの ID だけで判定できるときは、ID を検証した直後、本文の検証や検索の前に判定します。サロンの下にあるルートでは、対象のサロンはパスの `salonId` です（[9. サロンに属するデータ](#9-サロンに属するデータ-サロンはパスで受け取る)）。
- 操作者だけで決まる権限は、ID、クエリ、本文を見る前に判定します。顧客台帳はサロンに属さず、公開のオペレーションもないので、5 つのユースケースがすべてこの形です（`backend/packages/domain/src/business-logic/customer/_shared/authorization.ts` の `mayHandleCustomers` と `mayDeleteCustomers`）。権限のない操作者には、ID、クエリ、本文が不正でも、顧客が存在しなくても `forbidden`（403）を返します。
- 失敗した `Result` は `result.type === 'error'` で絞り込み、そのまま返します。
- 戻り値は API モデルか `DomainError` です。HTTP ステータスはユースケースでは決めません。
- 一意制約で検出できる重複を、事前の検索で確かめません。リポジトリが `alreadyExists` を返します。

### 6. リポジトリの実装: 例外を Result に変える

```typescript
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts（抜粋）
const attempt = async <T>(
  message: string,
  email: string | null,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, email),
  )

const notDeleted = isNull(salons.deletedAt)

export class SalonRepository implements ISalonRepository {
  constructor(private readonly db: Database) {}

  async findById(
    id: SalonId,
  ): Promise<Result<SalonWithOpeningHours | null, DomainError>> {
    return attempt('Failed to find salon', null, async () => {
      const [salon] = await this.db
        .select()
        .from(salons)
        .where(and(eq(salons.id, id), notDeleted))
        .limit(1)

      return salon === undefined ? null : withOpeningHours(this.db, salon)
    })
  }
}
```

- クエリは `attempt` で包みます。ドライバーが投げた例外は `Result.fromPromise` が `Result` に変え、`toDomainError` が `DomainError` に変えます。リポジトリ自身は `try`/`catch` を書きません。
- 想定している失敗だけを個別のエラーにします。Salon では `email` の一意制約違反が `alreadyExists` になり、それ以外はすべて `database` です。顧客のリポジトリ（`customer.repository.impl.ts`）には、範囲の違う 2 つの一意性があります。`email` は削除されていない顧客の間で一意（部分一意インデックス `customers_email_unique`）、`referralCode` は削除済みを含むすべての顧客の間で一意（一意制約 `customers_referral_code_unique`）です。どちらに違反したかを制約の名前で見分け、どちらも `alreadyExists` にします。スタッフのリポジトリ（`staff.repository.impl.ts`）も同じ書き方で、一意性の範囲が 1 つのサロンの中になります。`email` は同じサロンの削除されていないスタッフの間で一意（部分一意インデックス `staff_email_salon_unique`）、`staffCode` は同じサロンの削除済みを含むすべてのスタッフの間で一意（一意制約 `staff_code_salon_unique`）です。個別にするエラーがないリポジトリ（`user.repository.impl.ts`、`session.repository.impl.ts`、`service-category.repository.impl.ts`、`service.repository.impl.ts`）は、共通の `attempt(message, run)`（`backend/packages/infrastructure/src/database/attempt.ts`）を使います。
- `database` エラーの `cause` には `describeDatabaseError`（`backend/packages/infrastructure/src/database/failure.ts`）の結果を入れます。SQL 文と SQLSTATE は残し、バインドされた値は残しません。顧客のデータがログに出ないようにするためです。
- 複数のテーブルに書き込むときは `this.db.transaction` を使います（`create`・`update`）。
- 配列の先頭は `const [row] = ...` で取り出し、`row === undefined` を確認します。
- 一覧はキーセットページネーションです。`(createdAt, id)` の降順に並べ、`limit + 1` 件を取得して次のページがあるかを判定します。並び順は一覧ごとに決めます。サービスカテゴリーの一覧はメニューに表示する順で、`(displayOrder, id)` の昇順です。サービスの一覧も同じ考え方で、`(sortOrder, id)` の昇順です。顧客の一覧は、Salon と同じ `(createdAt, id)` の降順です。スタッフの一覧は登録された順で、`(createdAt, id)` の昇順です。
- 日時で絞り込む一覧は、API が返す精度で比べます。`timestamptz` 列はマイクロ秒まで持ち、レスポンスの日時はミリ秒までです。顧客の一覧は、登録日時を `date_trunc('milliseconds', …)` でミリ秒にそろえてから `registeredFrom`・`registeredTo` と比べます（`customer.repository.impl.ts` の `registeredAt`）。列の値のまま比べると、レスポンスの `createdAt` を `registeredTo` に指定しても、その顧客自身が一致しません。
- `deletedAt` 列のあるテーブルでは、削除は論理削除です。`deletedAt` を設定し、クエリに `notDeleted` の条件を付けて、削除済みの行がどのメソッドの結果にも現れないようにします。`deletedAt` 列のない `service_categories` では、行を削除します。サービスのリポジトリは、結果として返さない行に限って、削除済みの行も読みます。一覧のカーソルが指す行（行が残っているので、削除された後もページの開始位置が分かる）と、書き込みがロックする行（`lockServices`。ロックしてから、削除済みかどうかを判定する）です。顧客のリポジトリとスタッフのリポジトリも、一覧のカーソルが指す行は、削除済みでも読みます。

### 7. ハンドラーとルーター: 依存を受け取り、結果を HTTP に変換する

```typescript
// backend/packages/api/src/routes/salon/get-salon.handler.ts
export const getSalonHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<{ id: string }, GetSalonResponse | ProblemDetails> => {
  const useCase = new GetSalonUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.id)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: salonLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
```

- ハンドラーは、依存を受け取って `RequestHandler` を返す関数です。ユースケースは最初に一度だけ生成します。
- `RequestHandler` の型引数で、パスパラメータとレスポンス本文の型を決めます。レスポンスの型は `_shared/types.ts` で生成型の `operations` から取り出します。リクエスト本文の型は `unknown` です。
- ハンドラーは検証しません。`req.body` と `req.params.id` をそのままユースケースに渡します。
- クエリ文字列だけは例外です。文字列しか運べないので、一覧のハンドラーは `decodeSalonSearchQuery`（`_shared/query.ts`）で数値・真偽値・配列に直してから渡します。変換の部品はどの一覧でも同じで、`backend/packages/api/src/shared/query-parameters.ts` にあります。値のルールを判定するのはユースケースです。
- 権限の判定がある一覧では、直せなかったクエリのエラーも、権限を判定したあとで返します。顧客の一覧のハンドラー（`backend/packages/api/src/routes/customer/list-customers.handler.ts`）は、`decodeCustomerSearchQuery` の結果を `Result` のままユースケースに渡します。`ListCustomersUseCase` の `execute(actor, query)` は、権限を判定してから、その `Result` がエラーならそれを返します。スタッフの一覧のハンドラー（`backend/packages/api/src/routes/staff/list-staff.handler.ts`）も同じで、`ListStaffUseCase` の `execute(actor, salon, query)` に `decodeStaffSearchQuery` の結果を渡します。Salon の一覧とスタッフのプロフィールの一覧は公開で権限の判定がないので、ハンドラーがユースケースを呼ばずに変換のエラーを返します。
- 結果は `match(result)…exhaustive()` で分岐します。成功は `{ data, meta: responseMeta(req), links }`、失敗は必ず `sendProblem(req, res, error)` です。ハンドラーでステータスコードとエラーの対応を書きません。
- リンクは `req.baseUrl` から組み立てます。マウント先のパスをハンドラーに書きません。一覧のページのリンクは、どの一覧でも `pageLinks`（`backend/packages/api/src/shared/page-links.ts`）で作ります。
- ルーターは `createSalonRouter(dependencies, authenticated)` のように依存と `authenticated` を受け取り、各ハンドラーに渡します。

公開でないオペレーションのハンドラーは、`authenticated` で包みます（`backend/packages/api/src/shared/authentication.ts`）。

```typescript
// backend/packages/api/src/routes/salon/delete-salon.handler.ts
export const deleteSalonHandler = (
  dependencies: SalonUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<{ id: string }, ProblemDetails> => {
  const useCase = new DeleteSalonUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id)

    match(result)
      .with({ type: 'success' }, () => {
        res.status(204).end()
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}
```

- `authenticated` は `Authorization: Bearer <アクセストークン>` を検証し、包んだハンドラーを操作者（`actor`）付きで呼びます。有効なトークンがなければ 401 を返し、ハンドラーは実行されません。
- `actor` を受け取れるのは包まれたハンドラーだけです。包み忘れたハンドラーは、`actor` を要求するユースケースを呼べません（コンパイルエラーになります）。
- ハンドラーは `actor` をユースケースに渡すだけで、ロールを見ません。

ファイルの分け方について詳しくは [API Route Modular Structure](./api-route-modular-structure.md) を参照してください。

### 8. アプリケーションへの組み込み

```typescript
// backend/packages/api/src/index.ts（抜粋）
const clock = (): Date => new Date()

const authDependencies: AuthUseCaseDependencies = {
  userRepository: new UserRepository(database),
  sessionRepository: new SessionRepository(database),
  passwordHasher: new Argon2PasswordHasher(),
  tokenIssuer: new RandomTokenIssuer(),
  twoFactorAuthenticator,
  mailer,
  publicAppUrl: settings.publicAppUrl,
  clock,
}
const authenticated = createAuthenticated(authDependencies)

app.use(
  `${API_BASE_PATH}/auth`,
  createAuthRouter(authDependencies, authenticated),
)
app.use(
  `${API_BASE_PATH}/admin/auth`,
  createAdminAuthRouter(authDependencies, authenticated),
)
const salonRepository = new SalonRepository(database)
const staffInvitationDependencies: StaffInvitationUseCaseDependencies = {
  staffInvitationRepository: new StaffInvitationRepository(database),
  salonRepository,
  passwordHasher: authDependencies.passwordHasher,
  tokenIssuer: authDependencies.tokenIssuer,
  mailer,
  publicAppUrl: settings.publicAppUrl,
  clock,
}
app.use(
  `${API_BASE_PATH}/auth/staff-invitation`,
  createStaffInvitationAcceptanceRouter(
    staffInvitationDependencies,
    authenticated,
  ),
)
app.use(
  `${API_BASE_PATH}/salons`,
  createSalonRouter({ salonRepository }, authenticated),
)
app.use(
  `${API_BASE_PATH}/salons/:salonId/service-categories`,
  createServiceCategoryRouter(
    {
      serviceCategoryRepository: new ServiceCategoryRepository(database),
      salonRepository,
    },
    authenticated,
  ),
)
app.use(
  `${API_BASE_PATH}/salons/:salonId/services`,
  createServiceRouter(
    { serviceRepository: new ServiceRepository(database), salonRepository },
    authenticated,
  ),
)
app.use(
  `${API_BASE_PATH}/salons/:salonId/staff`,
  createStaffRouter(
    { staffRepository: new StaffRepository(database), salonRepository },
    authenticated,
  ),
)
app.use(
  `${API_BASE_PATH}/salons/:salonId/staff/:id/invitation`,
  createStaffInvitationRouter(staffInvitationDependencies, authenticated),
)
app.use(
  `${API_BASE_PATH}/salons/:salonId/staff/:id/account`,
  createStaffAccountRouter(
    {
      staffAccountRepository: new StaffAccountRepository(database),
      salonRepository,
    },
    authenticated,
  ),
)
app.use(
  `${API_BASE_PATH}/salons/:salonId/staff/:id/schedules`,
  createStaffScheduleRouter(
    {
      staffScheduleRepository: new StaffScheduleRepository(database),
      salonRepository,
    },
    authenticated,
  ),
)

app.use(
  `${API_BASE_PATH}/staff-profiles`,
  createStaffProfileRouter(
    { staffProfileRepository: new StaffProfileRepository(database) },
    authenticated,
  ),
)
const customerPreferencesDependencies = {
  customerPreferencesRepository: new CustomerPreferencesRepository(database),
}
// "me" first: the router below it would take it for the ID of a customer.
app.use(
  `${API_BASE_PATH}/customers/me/preferences`,
  createOwnCustomerPreferencesRouter(
    customerPreferencesDependencies,
    authenticated,
  ),
)
app.use(
  `${API_BASE_PATH}/customers/:id/preferences`,
  createCustomerPreferencesRouter(
    customerPreferencesDependencies,
    authenticated,
  ),
)
app.use(
  `${API_BASE_PATH}/customers`,
  createCustomerRouter(
    { customerRepository: new CustomerRepository(database), clock },
    authenticated,
  ),
)
app.use(
  `${API_BASE_PATH}/bookings`,
  createBookingRouter(
    {
      bookingRepository: new BookingRepository(database),
      bookingNumberIssuer: new RandomBookingNumberIssuer(),
    },
    authenticated,
  ),
)
```

- リポジトリは `createApp` の中で一度だけ生成し、ルーターに渡します。`authenticated` も一度だけ作り、公開でないオペレーションを持つルーターに渡します。
- 現在時刻を返す `clock` も一度だけ作り、認証の依存（`authDependencies`）と顧客台帳の依存の両方に渡します。
- サロンの下にあるルーターは、`:salonId` を含むパスにマウントし、Salon のルーターと同じ `salonRepository` も渡します。
- スタッフの招待の 2 つのルーターには、同じ依存（`staffInvitationDependencies`）を渡します。パスワードのハッシュとトークンの発行は認証の依存のものを使い、メールの送信と時計も同じものです。招待された側のルーター（`/auth/staff-invitation`）にも `authenticated` を渡します。3 つのルートのうち、確認と受け入れは公開で、参加だけがログインを求めます。
- スタッフのアカウントのルーターには、自分のリポジトリと `salonRepository` だけを渡します。メールを送らず、パスワードも保存しないので、認証の依存は要りません。
- 顧客台帳はサロンに属さないので、ルーターは `${API_BASE_PATH}/customers` にマウントします。パスにサロンの ID はなく、`salonRepository` も渡しません。
- 顧客の好み設定の 2 つのルーターは、パスの全体（`/customers/me/preferences`、`/customers/:id/preferences`）にマウントし、同じ依存（`customerPreferencesDependencies`）を渡します。`me` のほうを先にマウントします。逆にすると、`:id` のルーターが `me` を顧客の ID として受け取ります。
- 予約台帳はサロンのデータですが、ルーターは `${API_BASE_PATH}/bookings` にマウントします。パスにサロンの ID がないので、`salonRepository` は渡しません。リクエストが指定したサロンが存在するかは、予約のリポジトリが、作成のトランザクションの中で確かめます。予約番号を発行する `RandomBookingNumberIssuer` も、ここで生成して渡します。
- 新しいルーターは `express.json` の後、`notFoundHandler` の前にマウントします。ミドルウェアの順序とその理由は [アーキテクチャ概要](./architecture-overview.md) にあります。
- `api` パッケージは `config` に依存しません。新しい設定値が必要なときは `AppSettings`（`backend/packages/api/src/settings.ts`）に追加し、`backend/apps/server/src/server.ts` の `startServer` で `AppConfig` から渡します。

### 9. サロンに属するデータ: サロンはパスで受け取る

データが 1 つのサロンに属するドメインは、ルートをサロンの下（`/api/v1/salons/{salonId}/…`）に置きます。1〜8 と書き方が違うのは次の点です。例はサービスカテゴリーです（`backend/packages/domain/src/business-logic/service-category`、`backend/packages/api/src/routes/service-category`）。

```typescript
// backend/packages/domain/src/business-logic/service-category/delete-service-category.usecase.ts（抜粋）
async execute(
  actor: Actor,
  salon: unknown,
  id: unknown,
): Promise<Result<CategoryId, DomainError>> {
  const salonId = parseSalonIdOfPath(salon)
  if (salonId.type === 'error') {
    return salonId
  }
  if (!mayManageServiceCategories(actor, salonId.data)) {
    return Result.error(DomainErrors.forbidden())
  }
  const categoryId = parseCategoryId(id)
  if (categoryId.type === 'error') {
    return categoryId
  }

  const { serviceCategoryRepository, salonRepository } = this.dependencies
  const salonExists = await requireSalon(salonRepository, salonId.data)
  if (salonExists.type === 'error') {
    return salonExists
  }

  const deleted = await serviceCategoryRepository.delete(
    salonId.data,
    categoryId.data,
  )
```

- 作成と更新のリクエストに `salonId` はありません。サロンはパスで決まります。`salonId` は、リクエストから書き込まない列（`ServiceCategoryManagedColumn`）と `api-consistency-rules.ts` の `omittedColumns` に入れます。
- パスのサロン ID は `parseSalonIdOfPath`（`backend/packages/domain/src/models/salon.ts`）で検証します。失敗は `salonId` という項目名で報告されます。
- 権限は、パスのサロンだけで判定します。本文の検証や検索より前です。
- サロンがあるかどうかは `requireSalon`（`backend/packages/domain/src/business-logic/_shared/existing-salon.ts`）で確かめます。存在しないサロンと削除済みのサロンは `notFound`（404）です。そのため、ユースケースの依存には `salonRepository` も入れます（`ServiceCategoryUseCaseDependencies`）。公開のオペレーション（一覧、1 件の取得）でも確かめます。
- リポジトリのすべてのメソッドがサロンの ID を受け取り、すべてのクエリの条件に入れます。パスのサロンに属さないリソースは、存在しないリソースと同じ 404 です。
- ルーターは `Router({ mergeParams: true })` で作ります（`backend/packages/api/src/routes/service-category/index.ts`）。`salonId` はマウント先のパスのパラメータなので、この指定がないとハンドラーから見えません。ハンドラーは `req.params.salonId` を検証せずにユースケースに渡します。

サービス（`backend/packages/domain/src/business-logic/service`、`backend/packages/api/src/routes/service`）も、上のとおりに書いてあります。サービスカテゴリーにないものは次の点です。

- リクエストが 2 つのテーブルの行を含みます（サービスと、そのオプション）。表現を変える列はありませんが、Write マッパー（`ServiceWriteMapper`）が 2 つを分けます。更新では、オプションを残すか置き換えるか（`ServiceOptionsChange`）もここで決まります。
- 2 つの項目を結ぶ規則（`discountPrice` は `price` 以下、`isPackage` と `packageServiceIds` の組み合わせ）は、スキーマの `.check()` ではなく、純粋な関数 `serviceRuleIssues`（`backend/packages/domain/src/business-logic/service/_shared/rules.ts`）に書いてあります。部分更新は片方の項目だけを指定できるので、規則は更新後に保存される行に対して判定しなければなりません。作成ではユースケースが検証済みのリクエストに対して呼び、更新ではリポジトリがトランザクションの中で、ロックした行に変更を重ねた値に対して呼びます。
- リポジトリの書き込みの結果は、拒否の理由が 3 つ以上ある Sum 型です（`ServiceCreation`、`ServiceUpdate`、`ServiceBulkUpdate`、`ServiceDeletion`）。作成・更新・一括更新の拒否は、`_shared/refusals.ts` の `toRefusalError` がエラーに変えます。ユースケースごとには書きません。
- 一括更新（`PATCH /bulk`）は、指定されたすべてのサービスに同じ変更を 1 つのトランザクションで適用し、1 件でも適用できなければどのサービスも変えません（リポジトリの `updateMany`）。ルーターでは `/bulk` を `/:id` より前に登録します（`backend/packages/api/src/routes/service/index.ts`）。後に登録すると、`/:id` が `bulk` をサービスの ID として受け取ります。
- 削除は論理削除で、削除済みのサービスは存在しないサービスと同じ 404 です。パッケージに含まれているサービスは削除できず、ユースケースが `DomainErrors.conflict`（409）を返します。
- DB の制約では保証できないこと（カテゴリーとパッケージの構成サービスが同じサロンのものであること）は、リポジトリが確認と書き込みを 1 つのトランザクションで行います。どの行をどの順にロックするかは、`backend/packages/infrastructure/src/repositories/service.repository.impl.ts` の `lockCategory`、`lockServices`、`applyChanges` のコメントにあります。

スタッフ台帳（`backend/packages/domain/src/business-logic/staff`、`backend/packages/api/src/routes/staff`）も、上のとおりに書いてあります。サービスカテゴリーにもサービスにもないものは次の点です。

- 公開のオペレーションがありません。一覧と 1 件の取得を含む 5 つのユースケースがすべて、パスのサロンだけで最初に権限を判定します（`_shared/authorization.ts` の `mayKeepStaffLedger`。管理者と、そのサロンの `owner` だけ）。権限のない操作者には、スタッフの ID、クエリ、本文が不正でも、サロンやスタッフが存在しなくても `forbidden`（403）を返します。一覧のクエリを権限のあとで判定する方法は、実装パターンの 7 にあります。
- 操作者と対象の組み合わせで決まる規則があります。自分のアカウントが属しているスタッフ情報は、無効化（`isActive: false`）も削除もできません。操作者のスコープの `staffId` と対象の ID を比べる `isOwnStaffRecord`（`_shared/authorization.ts`）で判定し、`DomainErrors.conflict`（409）を返します（`_shared/refusals.ts` の `ownRecordStaysActive` と `ownRecordStays`）。権限がないのではなく、その操作が成り立たないので、`forbidden` にはしません。判定に DB は要らないので、ID と本文を検証した直後、サロンを検索する前に判定します。
- 一意性が 2 つあり、どちらも 1 つのサロンの中のものです（実装パターンの 6）。事前の検索はせず、リポジトリが制約の名前から `alreadyExists` を返します。
- 更新と削除は 1 つの文です（`UPDATE … WHERE … AND deleted_at IS NULL … RETURNING`）。行が返らなければ、スタッフは存在しないか、同時に届いた削除が先に終わっています。どちらも `notFound`（404）です。ロックもトランザクションも使いません。

スタッフの勤務スケジュール（`backend/packages/domain/src/business-logic/staff-schedule`、`backend/packages/api/src/routes/staff-schedule`）は、サロンのスタッフ 1 人に属する行（`staff_schedules`）です。スタッフ台帳と同じく公開のオペレーションはなく、次の点が違います。

- ルーターを、サロンではなくスタッフの下にマウントします（`/salons/:salonId/staff/:id/schedules`）。`Router({ mergeParams: true })` で作り、ハンドラーは `salonId` と `id` の両方をパスから受け取ります。スケジュール自身の ID はなく、ルートは `GET /` と `PUT /` の 2 つです。
- 更新は部分更新ではなく、全体の置き換えです。本文は行の配列で（`StaffScheduleUpdateRequest`）、送らなかった行は残りません。メソッドが `PUT` なのは、このためです。行のモデル（`StaffSchedule`）は、リクエストとレスポンスで同じです。
- 権限の判定が 2 段階あります。まずパスのサロンで判定し（`_shared/authorization.ts` の `mayPlanSchedules` と `mayReadSchedules`）、スタッフの ID の形式を確認してから、読む場合は誰のスケジュールかを判定します（`mayReadScheduleOf`。`staff` は自分のものだけ）。どちらも、クエリや本文の検証、検索より前です。
- スキーマは、行ごとの規則と、行どうしの規則（同じ曜日、同じ日付の行が 2 つないこと）の両方を、配列の `.check()` まで含めて 1 回で報告します（`backend/packages/domain/src/schemas/staff-schedule.schema.ts`）。行ごとの `.check()` が出す issue に `continue: true` を付けているのは、付けないと、Zod が配列の `.check()` を実行しないからです。同じ規則を、テーブルの CHECK 制約と部分一意インデックスも守ります。
- リポジトリの `replace` は、1 つのトランザクションで、スタッフの行を `FOR UPDATE` でロックし（そのサロンの、削除されていないスタッフ）、いまの行を消して、新しい行を入れ、一覧と同じ並びで読み直します。スタッフ台帳の更新と違ってロックを使うのは、複数の文で 1 つの状態を作るからです。同時に届いた置き換えは 1 件ずつ処理され、2 つのリクエストの行が混ざりません。スタッフが見つからなければ、どちらのメソッドも null を返し、ユースケースが `notFound`（404）にします。
- ある日付に適用される行を決める規則は、純粋な関数です（`_shared/applicable-schedule.ts` の `scheduleOn`）。一覧のユースケースが `date` のあるリクエストで使い、予約の実装も同じ関数を使います。

スタッフの招待（`backend/packages/domain/src/business-logic/staff-invitation`、`backend/packages/api/src/routes/staff-invitation`）は、スタッフ 1 人に 1 つまでの行（`staff_invitations`）で、台帳のスタッフが自分のログインアカウントを作るためのものです。勤務スケジュールと同じくスタッフの下にマウントし、次の点が違います。

- ルーターが 2 つあります。招待する側（`createStaffInvitationRouter`）は `/salons/:salonId/staff/:id/invitation` にマウントし、`GET /`、`POST /`、`DELETE /` の 3 つをすべて `authenticated` で包みます。スタッフが持てる招待は 1 つなので、招待の ID を持つルートはありません。招待された側（`createStaffInvitationAcceptanceRouter`）は `/auth/staff-invitation` にマウントし、`POST /verify` と `POST /accept` を包みません。招待された人にはまだアカウントがなく、メールで届いたトークンを本文で送るからです。`POST /join` だけは包みます。すでにあるアカウントでログインした人が、そのアカウントをスタッフに紐づけるからです。コントラクトでも、この 3 つは `AuthCrud` のオペレーションです。ユースケースと依存は 6 つのオペレーションで共通なので、ディレクトリは 1 つにしています。
- 作成の権限の判定が 2 段階あり、2 つめには本文が要ります。まずパスのサロンで判定し（`_shared/authorization.ts` の `mayInviteStaff`。スタッフ台帳を扱える人）、本文を検証してから、そのロールを与えられるかを判定します（`mayGiveRole`。`owner` を与えられるのは管理者だけ）。どちらも `forbidden`（403）で、2 つめも、サロンやスタッフを検索する前です。
- リクエストは宛先を指定しません。宛先は台帳のメールアドレスで、リポジトリが、招待を保存するトランザクションの中で読みます。応答は、そのアドレスにアカウントがあるかどうかで変わりません。
- トークンは、パスワードの再設定と同じ「メールで送るトークン」です（`backend/packages/domain/src/business-logic/auth/_shared/mailed-token.ts` の `STAFF_INVITATION`）。保存するのはハッシュだけで、使えない理由が何であっても同じ 400 を返します（`_shared/refusals.ts` の `invitationRefused`）。
- リポジトリは、行か null ではなく、結果を直和型で返します（`backend/packages/domain/src/repositories/staff-invitation.repository.ts`。たとえば `issue` は `issued` | `staffNotFound` | `linked` | `inactive` | `mailedMomentsAgo`）。1 つのトランザクションの中で分かる結果が 3 つ以上あり、null では区別できないからです。ユースケースは `match(...).exhaustive()` で、それぞれを `notFound`（404）や `conflict`（409）にします。
- 書き込み（`issue`、`revoke`、`accept`、`join`）はどれも、最初にスタッフの行を `FOR UPDATE` でロックし、判定に使う値をロックのあとで読み直します。台帳の更新と削除の文も同じ行のロックを待つので、招待の受け入れと、取り消し、招待のし直し、スタッフの無効化や削除が同時に届いても、1 件ずつ処理され、あとの処理は先の処理の結果を見ます。
- 受け入れは、アカウントを 1 つの文で作ります（`INSERT … ON CONFLICT (email) WHERE "deletedAt" is null DO UPDATE … WHERE …`）。アドレスにアカウントがなければ作り、メールアドレスを確認していない、登録しただけのアカウントはこのアカウントに置き換え、それ以外のアカウントには何も書きません。行が返らなければ、ユースケースが `alreadyExists`（409）にします。事前の検索の結果に頼らないので、同じアドレスの登録が同時に届いても、アカウントは 1 つです。
- 参加（`join`）は、すでにあるアカウントをスタッフに紐づけます。使えるのは、サロンのロールを持ち、どのサロンにも届かないアカウントで、その条件は、操作者の範囲 `none` と同じ 1 つの関数です（`backend/packages/domain/src/business-logic/auth/_shared/actor.ts` の `isWithoutSalon`）。ユースケースは、操作者の範囲で先に断ります（顧客と管理者は `forbidden`、サロンに届くアカウントは `conflict`）。リポジトリは、ロックを取ったあとで、同じ関数で判定し直します。ロックは、参加するスタッフと、アカウントがいま指しているスタッフの 2 行に ID の順で取り、続けてアカウントの行に取ります。紐づけを書く操作は、どれもスタッフの行、アカウントの行の順にロックするので、参加と紐づけの解除が互いを待ち合うことはありません。
- 確認（`verify`）のユースケースは、招待と、次に進むルートの名前（`accept` か `join`）を返し、ハンドラーが、その名前で `links` を 1 つ作ります。宛先にアカウントがあるかどうかを知るのは、トークンを持つ人だけです。

スタッフのアカウント（`backend/packages/domain/src/business-logic/staff-account`、`backend/packages/api/src/routes/staff-account`）は、スタッフに紐づいたアカウント（`users` の行）を、サロンの側から読み、ロールを変え、紐づけを解除するためのものです。招待する側のルーターと同じくスタッフの下にマウントし（`/salons/:salonId/staff/:id/account`）、次の点が違います。

- テーブルを持ちません。対象は、そのスタッフを `users.staffId` で指している、削除されていないユーザーです。リポジトリは見せる列だけを SELECT します（`backend/packages/infrastructure/src/repositories/staff-account.repository.impl.ts` の `accountColumns`）。行の型は、`DbUser` から見せる列を `Pick` した `DbStaffAccount` です（`backend/packages/domain/src/models/staff-account.ts`）。認証に使う値は、読みません。
- `role` は、カラムの Enum（`user_role`）より狭い Enum（`SalonRoleType`）です。読み出しのマッパーが、保存されている値を `SalonRoleTypeSchema` で検証し、合わなければ `database` エラーにします。スタッフを指すユーザーのロールは、CHECK 制約（`users_staff_needs_salon_role`）が 3 つに限っています。`pnpm check:api-db` には、規則の `narrowed` で、この項目が Enum の値の一部だけを取ることを伝えます。
- 更新の権限の判定は、招待の作成と同じ 2 段階です（`_shared/authorization.ts` の `mayKeepStaffAccounts` と、本文を検証したあとの `mayGiveRole`）。そのあとで、操作者自身のアカウントでないことを確認します（台帳と同じ `isOwnStaffRecord`）。操作者とパスのサロンで決まる権限は `forbidden`（403）、操作者自身の記録についての規則は `conflict`（409）にする使い分けも、台帳と同じです。
- リポジトリは、結果を直和型で返します（`backend/packages/domain/src/repositories/staff-account.repository.ts`。`findByStaff` は `found` | `staffNotFound` | `none`）。スタッフがいないことと、スタッフにアカウントがないことは、別の 404 だからです。
- ロールの変更と紐づけの解除は、スタッフの行を `FOR UPDATE` でロックしてから書きます。解除は、同じトランザクションで `users.staffId` と `staff.userId` を null にします。
- セッションは消しません。操作者の範囲はリクエストのたびに作り直すので、変更は、そのアカウントの次のリクエストから効きます。

スタッフのプロフィール（`backend/packages/domain/src/business-logic/staff-profile`、`backend/packages/api/src/routes/staff-profile`）は、同じ `staff` の行のうち顧客に見せる部分を、認証なしで読ませます。サロンに属するデータですが、上の書き方とは次の点が違います。

- モデル、リポジトリ、ユースケース、ルーターを、台帳とは別に持ちます。台帳のユースケースに、公開のための分岐は足しません。見せる列（`profileColumns`）と、見せるスタッフの条件（`shown`）は、`backend/packages/infrastructure/src/repositories/staff-profile.repository.impl.ts` の 1 か所で決まります。
- リポジトリは見せる列だけを SELECT します。行の型は、`DbStaff` から見せる列を `Pick` した `DbStaffProfile` です（`backend/packages/domain/src/models/staff-profile.ts`）。
- ルートはサロンの下に置きません（`/api/v1/staff-profiles`）。サロンをまたいで探す一覧だからです。サロンは一覧の任意の絞り込みで、`parseSalonIdOfPath` も `requireSalon` も使いません。存在しないサロンでの絞り込みは、404 ではなく空の一覧です。
- 一覧と取得のユースケースは `actor` を受け取らず、ハンドラーを `authenticated` で包みません。ルーターのファクトリー（`createStaffProfileRouter`）が受け取る `authenticated` は、次の本人のプロフィールの 2 つのハンドラーだけに渡します。
- 一覧のカーソルは位置だけを決めます。見せなくなったスタッフや、絞り込みに合わないスタッフを指していても、そこから続けます。どのスタッフも指していないカーソルのときだけ、リポジトリが null を返し、ユースケースが `validation`（400）にします。

スタッフ本人のプロフィール（同じディレクトリの `*-own-staff-profile.usecase.ts` と `*-own-staff-profile.handler.ts`、`/api/v1/staff-profiles/me`）は、同じ行のうち本人に書かせる部分を、ログインしたスタッフに読み書きさせます。

- パスは対象を指定しません。対象は、操作者の範囲から決めます（`backend/packages/domain/src/business-logic/staff-profile/_shared/own-profile.ts` の `ownProfileOf`）。範囲が `salon` なら、その `staffId` のスタッフで、それ以外は `forbidden` です。結果は直和型（`ownProfile` | `notAStaffMember`）で、ユースケースは `match` で分けます。顧客本人のプロフィール（`business-logic/customer/_shared/profile.ts`）と同じ形です。
- 更新のユースケースは、権限を判定してから本文を検証します。スキーマ（`staffProfileUpdateRequestSchema`）は、台帳の登録のスキーマから、本人が書ける 5 項目を `pick` して作ります。規則を書き写さないので、台帳の規則を変えれば、こちらも変わります。
- Write マッパーはありません。リクエストのプロパティ名と型が、カラムと同じだからです。検証した値を、そのままリポジトリの `update(id, changes)` に渡します（`StaffProfileChanges` は、`DbStaffProfile` から書ける列を `Pick` した型）。
- リポジトリの `update` は、見せるスタッフの条件（`shown`）を WHERE に含めた 1 つの文で書き、見せる列を `RETURNING` で返します。サロンの条件があるので、`UPDATE … FROM salons` です。条件に合う行がなければ null を返し、ユースケースが `notFound` にします。先に読んでから書くことはしません。
- ルーターは、`/me` を `/:id` より前に登録します。逆にすると、`me` が ID として検証されます。

権限の規則は [認証と認可](./authentication.md#サロンの下にあるルートの権限)、サービスカテゴリーとサービスの規則は [サービスメニュー](./service-menu.md)、スタッフ台帳、勤務スケジュール、招待、アカウント、プロフィールの規則は [スタッフ台帳](./staff.md) にあります。

---

## エラー処理

- ユースケースが返すエラーは `DomainError` の7種類（`validation`・`unauthenticated`・`forbidden`・`notFound`・`alreadyExists`・`conflict`・`database`）です。`DomainErrors.*` で作ります（`backend/packages/domain/src/shared/errors.ts`）。
- `unauthenticated`（401）を返すのは認証のユースケースだけです。それ以外のユースケースが権限について返すのは `forbidden`（403）です。401 には `sendProblem` が `WWW-Authenticate` ヘッダーを付けます。
- ユースケースの外で起きる失敗（存在しないルート、読めない本文、レート制限、想定外の例外）は API 層の `HttpError` です。
- どちらも `sendProblem` を通り、RFC 9457 の problem details になります。エラーの種類と HTTP ステータス・エラーコードの対応は、`backend/packages/api/src/shared/problem-details.ts` の `toProblemDetails` の1か所にあります。
- `database` エラーの `cause` と想定外の例外の内容は、レスポンスに含めません。ログに記録します。

エラーの種類を増やすときは、`DomainError`（または `HttpError`）に追加し、`problem-details.ts` の `match` に分岐を足します。`exhaustive()` なので、足し忘れるとコンパイルエラーになります。

---

## ロギング

- リクエストの処理中は `req.log` を使います。リクエスト ID が自動的に付きます。それ以外の場所では、引数で受け取った `Logger` を使います。
- リクエスト ID（`req.id`）は自分で作りません。レスポンスへの記載は `responseMeta(req)` と `sendProblem` が行います。
- 値は文字列に連結せず、オブジェクトで渡します。

  ```typescript
  // backend/packages/api/src/shared/responses.ts（抜粋）
  if (error.type === 'database') {
    req.log.error({ cause: error.cause }, error.message)
  }
  ```

- ヘッダー、リクエスト本文、SQL にバインドされた値はログに出しません。認証情報や顧客の個人情報が含まれるためです。

---

## 設定

- 環境変数は `parseAppConfig`（`backend/packages/config/src/app-config.ts`）が起動時に一度だけ検証し、`AppConfig` として返します。不足や形式の誤りがあれば、サーバーは起動しません。
- 変数を追加するときは、`app-config.ts` のスキーマと `AppConfig` に追加し、すべての `.env.*` ファイルと [README](../README.md) の変数表にも追加します。

---

## テスト戦略

| 対象 | 種類 | 場所 |
|------|------|------|
| スキーマ、マッパー、ユースケース（権限の判定を含む） | ユニット（`pnpm test`） | `backend/packages/domain/src/__tests__` |
| パスワードのハッシュ、トークンの生成、2 要素認証のシークレット・コード・バックアップコード | ユニット（`pnpm test`） | `backend/packages/infrastructure/src/security/__tests__` |
| SMTP でのメールの送信 | ユニット（`pnpm test`）と統合（`pnpm test:integration`。testcontainers で Mailpit のコンテナを起動する） | `backend/packages/infrastructure/src/mail/__tests__` |
| クエリの変換、リンク、problem details、ミドルウェア | ユニット（`pnpm test`） | `backend/packages/api/src` の各 `__tests__` |
| エンドポイント（リポジトリの実装を含む） | 統合（`pnpm test:integration`） | `backend/packages/api/src/__tests__/salon.integration.test.ts`、`auth.integration.test.ts`、`service-category.integration.test.ts`（サロンの下にあるルート）、`service.integration.test.ts`（一括更新、サロンの下にあるリソースの論理削除）、`customer.integration.test.ts` と `customer-profile.integration.test.ts`（サロンに属さず、公開のオペレーションがないルート）、`customer-preferences.integration.test.ts`（行が保存されていなくても答えるルートと、顧客の行をロックする更新）、`staff.integration.test.ts`（サロンの下にあり、公開のオペレーションがないルート）、`staff-schedule.integration.test.ts`（スタッフの下にあり、全体を置き換えるルート）、`staff-invitation.integration.test.ts`（メールで送ったトークンで届くレコード。招待する側のルートと、招待された側の公開のルート）、`staff-account.integration.test.ts`（スタッフに紐づいたアカウントのルートと、すでにあるアカウントでの招待への参加）、`staff-profile.integration.test.ts`（公開しないデータの一部を、認証なしで見せるルート）、`staff-own-profile.integration.test.ts`（アカウントが対象を決める、本人のルート）、`booking.integration.test.ts`（サロンに属し、サロンの下にないルートと、参照する行をロックしてスタッフの占有を確かめる作成） |
| リクエスト ID、エラー応答、CORS、レート制限、プローブ | 統合（`pnpm test:integration`） | `backend/packages/api/src/__tests__/app.integration.test.ts` |
| 起動と停止 | 統合（`pnpm test:integration`） | `backend/apps/server/src/__tests__/server.integration.test.ts` |

- ユースケースのテストでは、リポジトリを `ISalonRepository` を満たすオブジェクトに差し替えます（`backend/packages/domain/src/__tests__/fixtures.ts` の `salonRepositoryWith`）。DB は使いません。認証のユースケースでは、2つのリポジトリ、パスワードのハッシュ、トークンの発行、2 要素認証のコードの確認、メールの送信も差し替え、時計を固定します（`backend/packages/domain/src/__tests__/auth-fixtures.ts` の `authDependencies`）。スタッフの招待のユースケースでは、招待のリポジトリも差し替えます（`staff-invitation-fixtures.ts` の `staffInvitationDependencies`）。スタッフのアカウントのユースケースも同じです（`staff-account-fixtures.ts` の `staffAccountDependencies`）。顧客の好み設定のユースケースも、リポジトリを差し替えます（`customer-preferences-fixtures.ts` の `customerPreferencesDependencies`）。予約のユースケースでは、リポジトリと、予約番号の発行を差し替えます（`booking-fixtures.ts` の `bookingDependencies`）。リクエストと参照する行から書く行を決める `planBooking` と、占有の規則（`isOccupiedBeyondCapacity`、`occupancyWindowOf`）は純粋な関数なので、何も差し替えずにテストします（`booking.plan.test.ts`、`booking.rules.test.ts`）。
- リポジトリの実装は、エンドポイントの統合テストで実際の PostgreSQL に対して検証します。テストごとに専用のデータベースを作り（スキーマを適用したテンプレートの複製）、本番と同じ `createApp` を使います（`backend/packages/api/src/__tests__/_shared/test-helpers.ts` の `createTestApp`）。メールは送らずに記録し、2 要素認証には本番と同じ `TotpAuthenticator` を使います。`service.integration.test.ts` は、同じデータベースに対して `ServiceRepository` を直接呼ぶテストと、テーブルの制約が拒否する行を確かめるテストも含みます。`customer.integration.test.ts` と `staff.integration.test.ts` も同じで、`CustomerRepository`、`StaffRepository` を直接呼ぶテストと、それぞれのテーブルの制約のテストを含みます。`staff-profile.integration.test.ts` は、`StaffProfileRepository` を直接呼ぶテストと、台帳だけにある値がレスポンスのどこにも出ないことのテストを含みます。`staff-own-profile.integration.test.ts` は、`StaffProfileRepository` の `update` を直接呼ぶテストと、スタッフの行を書いているトランザクションの完了を待ってから条件を確かめ直すことのテスト（無効化、削除、台帳の更新）を含みます。`staff-schedule.integration.test.ts` は、`StaffScheduleRepository` を直接呼ぶテスト、`staff_schedules` の制約のテストと、同時に届いた置き換えで行が混ざらないことのテストを含みます。`staff-invitation.integration.test.ts` は、`StaffInvitationRepository` を直接呼ぶテスト、`staff_invitations` の制約と、アカウントとスタッフを 1 対 1 に保つ一意インデックスのテスト、同時に届いたリクエスト（複数の受け入れ、受け入れと取り消し・招待のし直し・スタッフの削除・同じアドレスの登録）のテストを含みます。`staff-account.integration.test.ts` は、`StaffAccountRepository` を直接呼ぶテスト、`StaffInvitationRepository` の `join` と `findUsable` を直接呼ぶテスト、CHECK 制約 `users_staff_needs_salon_role` のテスト、同時に届いたリクエスト（複数の参加、2 つのサロンの招待への参加、参加と取り消し・受け入れ・紐づけの解除、ロールの変更と解除）のテストを含みます。`customer-preferences.integration.test.ts` は、`CustomerPreferencesRepository` を直接呼ぶテスト、`customer_preferences` の制約のテストと、同時に届いたリクエスト（最初の更新どうし、同じスタッフを希望する更新と避ける更新、更新と顧客の削除・台帳の更新）のテストを含みます。`booking.integration.test.ts` は、`BookingRepository` を直接呼ぶテスト、`bookings` と `booking_services` の制約とインデックスのテストと、同時に届いたリクエスト（同じスタッフの同じ時間を求める複数の作成、2 人のスタッフを逆の順序で求める作成、作成とスタッフの削除・サービスの料金の変更）のテストを含みます。
- 統合テストでアクセストークンが必要なときは、ユーザーの行を挿入し、`POST /api/v1/auth/login` でログインします（`backend/packages/api/src/__tests__/_shared/auth-helpers.ts`）。
- エンドポイントごとに、エラーのシナリオを5つ以上テストします。公開でないエンドポイントでは、トークンのないリクエスト（401）と、許可されていないユーザーからのリクエスト（403）を含めます。

詳しくは [Testing Requirements](./testing-requirements.md) と [API Testing Guide](./api-testing-guide.md) を参照してください。

---

## 新しいドメインを実装する手順

1. **API 契約**: `specs/models/<domain>.tsp` と `specs/operations/<domain>-operations.tsp` を確認し、必要なら直して `pnpm generate` を実行します。モデル名や nullable の決まりは [TypeSpec API型定義ルール](./typespec-api-type-rules.md) にあります。
2. **データベース**: テーブルを変える必要があれば SQL マイグレーションを書き、`pnpm db:migrate`、`pnpm db:introspect`、`pnpm db:generate-sql` の順に実行します。
3. **API と DB の整合**: テーブルに対応するモデルは `backend/packages/database/src/scripts/api-consistency-rules.ts` に `omittedColumns` 付きで登録されています。TypeSpec かテーブルを変えたら、そのドメインのルールを合わせ、`pnpm check:api-db` が成功することを確認します。食い違いを許容する仕組みはありません。
4. **domain**: モデル、スキーマ、マッパー、リポジトリインターフェース、権限の判定（`_shared/authorization.ts`）、ユースケースの順に書き、ユニットテストを付けます。公開するものを `backend/packages/domain/src/index.ts` に追加します。データがサロンに属するドメインでは、実装パターンの 9 に従います。
5. **infrastructure**: リポジトリを実装し、`backend/packages/infrastructure/src/index.ts` から公開します。
6. **api**: ハンドラーとルーターを書き、公開でないオペレーションのハンドラーを `authenticated` で包み、`createApp` にマウントして、統合テストを付けます。
7. **確認**: `make ci-check` を実行します。

各ステップの詳しい説明は [Domain Implementation Reference](./domain-implementation-reference.md) にあります。

---

## 実装チェックリスト

- [ ] TypeSpec を変更したら `pnpm generate` を実行し、生成ファイルを一緒にコミットした
- [ ] 型を手で宣言していない（DB 型は Drizzle スキーマから、API 型は生成型から取っている）
- [ ] スキーマに `satisfies z.ZodType<…>` を付け、検証はユースケースで一度だけ行っている
- [ ] ハンドラーは本文を `unknown` のままユースケースに渡している
- [ ] 公開でないオペレーションは、ハンドラーを `authenticated` で包み、ユースケースが `actor` から最初に権限を判定している（TypeSpec では `SessionErrors` または `CommonErrors`）
- [ ] 公開のオペレーションは、TypeSpec に `@useAuth(NoAuth)` と `PublicErrors` がある
- [ ] マッパーでプロパティ名を変えていない。`null` を別の値に置き換えていない
- [ ] 失敗はすべて `Result` で返している。`throw`、`any`、`as` がなく、`try`/`catch` を新たに書いていない（外部の例外は `Result.fromPromise` か `Result.fromThrowable` で受けている）
- [ ] `match(...).exhaustive()` で分岐している
- [ ] エラー応答は `sendProblem` だけが返している
- [ ] `console` と `process.env` を使っていない
- [ ] 複数テーブルへの書き込みはトランザクションで行っている
- [ ] 論理削除された行が、どのクエリからも見えない
- [ ] データがサロンに属する場合: パスのサロンで権限を判定し、`requireSalon` でサロンの存在を確かめ、すべてのクエリにサロンの ID を付け、ルーターを `Router({ mergeParams: true })` で作っている
- [ ] ユニットテストと、エンドポイントごとに5つ以上のエラーシナリオを含む統合テストがある

---

## 参考資料

- [`CLAUDE.md`](../CLAUDE.md) - 規約、コマンド、Salon ドメインの全レイヤー
- [`docs/architecture-overview.md`](./architecture-overview.md) - システム全体の構成
- [`docs/domain-implementation-reference.md`](./domain-implementation-reference.md) - ドメイン実装リファレンス
- [`docs/api-route-modular-structure.md`](./api-route-modular-structure.md) - ルートのファイル構成
- [`docs/uniform-implementation-guide.md`](./uniform-implementation-guide.md) - 統一実装パターン
- [`docs/authentication.md`](./authentication.md) - 認証と認可
- [`docs/service-menu.md`](./service-menu.md) - サービスメニュー（サービスカテゴリーとサービスの規則）
- [`docs/customers.md`](./customers.md) - 顧客台帳（顧客の規則）
- [`docs/staff.md`](./staff.md) - スタッフ台帳（スタッフの規則）
- [`docs/bookings.md`](./bookings.md) - 予約台帳（予約の規則）
- [`docs/db-driven-domain-model.md`](./db-driven-domain-model.md) - DB駆動ドメインモデル
- [`docs/sum-types-pattern-matching.md`](./sum-types-pattern-matching.md) - Sum型とパターンマッチング
- [`docs/type-safety-principles.md`](./type-safety-principles.md) - 型安全性の原則
- [`docs/type-generation-system.md`](./type-generation-system.md) - 型生成システム
- [`docs/testing-requirements.md`](./testing-requirements.md) - テスト要件
