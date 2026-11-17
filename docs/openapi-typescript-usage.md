# OpenAPI TypeScript 型利用ガイド

このドキュメントは、OpenAPI から生成した TypeScript 型（`@beauty-salon-backend/generated`）をバックエンドがどう使っているかを説明します。生成の手順とコマンドは [Type Generation System](./type-generation-system.md) を参照してください。

バックエンドで実装されているのは Salon ドメイン、サロンのサービスカテゴリーとサービス（[サービスメニュー](./service-menu.md)）、顧客台帳（[顧客台帳](./customers.md)）、予約台帳（[予約台帳](./bookings.md)）、スタッフ台帳、スタッフの勤務スケジュール、スタッフの招待、スタッフに紐づいたアカウント、顧客に見せるスタッフのプロフィール、スタッフ本人のプロフィール（[スタッフ台帳](./staff.md)）、売上台帳（[売上台帳](./sales.md)）、支払い方法と支払い（[支払い](./payments.md)）、売上レポート（[売上レポート](./sales-reports.md)）、ポイント台帳（[ポイント台帳](./points.md)）、レビュー（[レビュー](./reviews.md)）、認証（[認証と認可](./authentication.md)）、システムエンドポイントです。認証、サービスカテゴリー、サービス、顧客台帳、顧客の好み設定、予約台帳、スタッフ台帳、スタッフの勤務スケジュール、スタッフの招待、スタッフのアカウント、スタッフのプロフィール、売上台帳、支払い方法と支払い、売上レポート、ポイント台帳、レビューも生成型を同じ形で使っているので（`backend/packages/domain/src/models/auth.ts`、`backend/packages/api/src/routes/auth/_shared/types.ts`、`backend/packages/domain/src/models/service-category.ts`、`backend/packages/api/src/routes/service-category/_shared/types.ts`、`backend/packages/domain/src/models/service.ts`、`backend/packages/api/src/routes/service/_shared/types.ts`、`backend/packages/domain/src/models/booking.ts`、`backend/packages/api/src/routes/booking/_shared/types.ts`、`backend/packages/domain/src/models/customer.ts`、`backend/packages/api/src/routes/customer/_shared/types.ts`、`backend/packages/domain/src/models/customer-preferences.ts`、`backend/packages/api/src/routes/customer-preferences/_shared/types.ts`、`backend/packages/domain/src/models/staff.ts`、`backend/packages/api/src/routes/staff/_shared/types.ts`、`backend/packages/domain/src/models/staff-profile.ts`、`backend/packages/api/src/routes/staff-profile/_shared/types.ts`、`backend/packages/domain/src/models/staff-schedule.ts`、`backend/packages/api/src/routes/staff-schedule/_shared/types.ts`、`backend/packages/domain/src/models/staff-invitation.ts`、`backend/packages/api/src/routes/staff-invitation/_shared/types.ts`、`backend/packages/domain/src/models/staff-account.ts`、`backend/packages/api/src/routes/staff-account/_shared/types.ts`、`backend/packages/domain/src/models/sale.ts`、`backend/packages/api/src/routes/sale/_shared/types.ts`、`backend/packages/domain/src/models/payment-method.ts`、`backend/packages/api/src/routes/payment-method/_shared/types.ts`、`backend/packages/domain/src/models/payment.ts`、`backend/packages/api/src/routes/payment/_shared/types.ts`、`backend/packages/domain/src/models/sales-report.ts`、`backend/packages/api/src/routes/sales-report/_shared/types.ts`、`backend/packages/domain/src/models/point.ts`、`backend/packages/api/src/routes/point/_shared/types.ts`、`backend/packages/domain/src/models/review.ts`、`backend/packages/api/src/routes/review/_shared/types.ts`、`backend/packages/domain/src/models/review-report.ts`、`backend/packages/api/src/routes/review-report/_shared/types.ts`）、例はすべて参照実装である Salon の実コードからの抜粋です。コード中のコメントは説明用に日本語で付けています。

## 生成されるもの

`pnpm generate`（バックエンドの型だけなら `pnpm generate:backend`）が `backend/packages/generated/src/` に次の3ファイルを書き出します。生成物はコミット対象で、手で編集しません。

| ファイル | 内容 |
|----------|------|
| `api-types.ts` | `openapi-typescript` 7 の出力。`paths`・`components`・`operations` |
| `schema.ts` | OpenAPI の文字列 enum ごとの Zod スキーマと型（例: `DayOfWeekTypeSchema` / `DayOfWeekType`） |
| `index.ts` | 上の2ファイルの再エクスポート |

型は名前で引きます。

| 欲しい型 | 引き方 | 例 |
|----------|--------|-----|
| モデル | `components['schemas']['Models.<モデル名>']` | `components['schemas']['Models.SalonResponse']` |
| 操作（パラメータ・リクエスト・レスポンス） | `operations['<operationId>']` | `operations['SalonCrud_list']` |

operationId は、TypeSpec で操作を囲むインターフェース（または名前空間）の名前と操作名を `_` でつないだものです（`SalonCrud` の `list` → `SalonCrud_list`、`SystemOperations` の `alive` → `SystemOperations_alive`）。`paths` も生成されますが、バックエンドのコードは `components` と `operations` だけを使っています。

OpenAPI ドキュメントには TypeSpec で定義した全ドメインが含まれるため、Inventory や Treatment などの型も生成されています。Treatment の型を使うドメイン・リポジトリ・ルートのコードはまだありません。Inventory の型は、商品の 5 オペレーション（`ProductCrud` の `list`・`create`・`get`・`update`・`delete`）と、在庫の 9 オペレーション（`InventoryCrud` の `list`・`create`・`get`・`update`・`delete`・`listLowStock`・`listExpiring`・`recordMovement`・`listMovements`）のものだけを、コードが使っています。Review の型は、`ReviewCrud` の 8 オペレーション（`list`・`create`・`get`・`update`・`delete`・`markHelpful`・`report`・`respond`）、`ReviewReportCrud` の 2 オペレーション（`list`・`dismiss`）と、集計の 2 オペレーション（`SalonReviewSummary` の `getSummary`、`StaffReviewSummary` の `getStaffSummary`）のものだけを、コードが使っています。Payment の型は、売上台帳の 8 オペレーション（`SaleCrud` の `list`・`create`・`get`・`update`・`voidSale`・`process`・`getReceipt`・`calculate`）、支払い方法の 5 オペレーション（`PaymentMethodCrud` の `list`・`create`・`get`・`update`・`delete`）、返金（`PaymentCrud` の `refund`）と、売上レポートの 6 オペレーション（`SalesReportCrud` の `get`・`getDaily`・`getByStaff`・`getByCategory`・`getTrends`・`export`）と、ポイント台帳の 7 オペレーション（`PointCrud` の `getBalance`・`listTransactions`・`getExpiring`・`earn`・`use`・`adjust`・`expire`）のものだけを、コードが使っています。Booking の型は、予約台帳の 11 オペレーション（`BookingCrud` の `list`・`create`・`get`・`update`・`delete`、ステータスの操作の `confirm`・`cancel`・`start`・`complete`・`noShow`、日時の変更の `reschedule`）と、施術明細の 3 オペレーション（`BookingServiceCrud` の `create`・`get`・`delete`）、空き枠の 2 オペレーション（`AvailableSlotCrud` の `list`・`check`）、顧客が自分で入れる予約の 5 オペレーション（`CustomerBookings` の `list`・`create`・`get`・`cancel`・`reschedule`）のもので、コントラクトのすべてをコードが使っています。Customer の型は、顧客台帳の 5 つのオペレーション（`CustomerCrud` の `list`・`create`・`get`・`update`・`delete`）、顧客本人のプロフィールの 3 つのオペレーション（`CustomerProfile` の `get`・`create`・`update`）、好み設定の 4 つのオペレーション（`CustomerCrud` と `CustomerProfile` の `getPreferences`・`updatePreferences`）のものだけをコードが使っています。Staff の型は、スタッフ台帳の 5 つのオペレーション（`StaffCrud` の `list`・`create`・`get`・`update`・`delete`）、勤務スケジュールの 2 つのオペレーション（`StaffSchedules` の `list`・`update`）、招待の 3 つのオペレーション（`StaffInvitations` の `get`・`create`・`delete`）、アカウントの 3 つのオペレーション（`StaffAccounts` の `get`・`update`・`delete`）、顧客に見せるプロフィールの 2 つのオペレーション（`StaffProfile` の `list`・`get`）、本人のプロフィールの 2 つのオペレーション（`StaffOwnProfile` の `get`・`update`）のもので、コントラクトのすべてをコードが使っています。`CustomerCrud` の残りのオペレーションの型は、生成されているだけです。

## バックエンドでの使い方（Salon）

### 1. モデルの別名を1か所で定義する

`backend/packages/domain/src/models/salon.ts`

```typescript
import type { components, operations } from '@beauty-salon-backend/generated'

// TypeSpec から生成された API 型
export type ApiSalonResponse = components['schemas']['Models.SalonResponse']
export type ApiSalonCreateRequest =
  components['schemas']['Models.SalonCreateRequest']
export type ApiSalonUpdateRequest =
  components['schemas']['Models.SalonUpdateRequest']
export type ApiSalonSearchRequest = NonNullable<
  operations['SalonCrud_list']['parameters']['query']
>
export type ApiOpeningHours = components['schemas']['Models.OpeningHours']
export type ApiBusinessHours = components['schemas']['Models.BusinessHours']
export type ApiPaginationMeta = components['schemas']['Models.PaginationMeta']
```

- API 型には `Api`、Drizzle スキーマから推論した DB 型には `Db` の接頭辞を付けます（`DbSalon`、`DbNewSalon`）。どちらも推論・参照だけで、手書きの型定義はありません。
- `SalonSearchRequest` はクエリパラメータとして展開されるため、`components` ではなく操作型の `parameters.query` から取ります。
- ドメイン層のスキーマ・マッパー・ユースケースは、API 型をこのファイルから import します。

### 2. ID のブランド化はドメイン側で行う

生成型の `Models.SalonId` はただの `string` です。検証済みの ID だけを受け付けるためのブランド型は、同じファイルで Zod から作ります。

```typescript
export const salonIdSchema = uuidSchema.brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>
```

文字列は、`parseSalonId`（`Result<SalonId, DomainError>` を返す）か、`salonIdSchema` を含むスキーマの検証を通って初めて `SalonId` になります。

### 3. Zod スキーマを生成型に対して検査する

`backend/packages/domain/src/schemas/salon.schema.ts`

```typescript
export const salonCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(255),
  nameKana: nonBlankText.max(255).nullable(),
  // ...（中略）
  isActive: z.boolean(),
  openingHours: openingHoursListSchema,
}) satisfies z.ZodType<ApiSalonCreateRequest>
```

`satisfies z.ZodType<ApiSalonCreateRequest>` は、スキーマの出力型が生成型に代入できることをコンパイル時に検査します。TypeSpec にプロパティを追加した、あるいは型を変えたのにスキーマが追従していなければ、ここが型エラーになります。型アサーションは使いません。

TypeSpec からプロパティを削除した場合は、この検査では検出されません（余分なプロパティを持つ型は代入可能なため）。スキーマからも手で削除してください。

更新・検索のスキーマも同じ形です。

```typescript
export const salonUpdateRequestSchema = salonCreateRequestSchema
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiSalonUpdateRequest>

export const salonSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: salonIdSchema.exactOptional(),
  // ...（中略）
}) satisfies z.ZodType<ApiSalonSearchRequest>
```

長さの上限は DB カラムのもの、それ以外はビジネスルールです。生成型が表すのは形だけなので、値の規則はこのスキーマに書きます。`atLeastOneProperty` はプロパティが 1 つもない更新リクエストを拒否するルールで、`nonBlankText` とともに `backend/packages/domain/src/schemas/rules.ts` にあります。複数のドメインのスキーマがこのファイルから import します（ほかに、小文字にそろえて保存するメールアドレスの `lowerCaseEmail`、電話番号の `phoneNumber`、`integer` 列の最大値 `MAX_INTEGER`、同じ値を重ねて指定できない配列のための `noRepeatedEntries`、リクエストの日付と日時を 1900-01-01 から 2999-12-31 までに限る `calendarDate`、`momentOfRequest`、`momentInUtc` があります）。

### 4. enum は生成された Zod スキーマを使う

同じファイルで、曜日の enum は `schema.ts` に生成されたスキーマをそのまま使っています。

```typescript
import { DayOfWeekTypeSchema } from '@beauty-salon-backend/generated'

const openingHoursSchema = z
  .strictObject({
    dayOfWeek: DayOfWeekTypeSchema,
    date: calendarDate,
    // ...（中略）
  })
```

enum の値を手書きで並べ直しません。

### 5. ユースケースは `unknown` を受け取り、API 型を返す

`backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts`

```typescript
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
    // ここから先、request.data は検証済みの値
```

`actor` は認証済みの操作者で、サロンの作成は権限の確認があるので最初に判定します（[認証と認可](./authentication.md)）。生成型が関わるのは `input` と戻り値です。

`parseWith`（`backend/packages/domain/src/shared/validation.ts`）がスキーマで検証し、失敗を `validation` の `DomainError` にします。検証済みの値はマッパー（`backend/packages/domain/src/mappers/write/salon.mapper.ts` と `backend/packages/domain/src/mappers/read/salon.mapper.ts`）が `ApiSalonCreateRequest` → `DbNewSalon`、`DbSalon` → `ApiSalonResponse` に変換します。プロパティ名は変えず、表現だけを変えます。

### 6. レスポンス本体の型は操作型から取り出す

`backend/packages/api/src/routes/salon/_shared/types.ts`

```typescript
import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type ListSalonsResponse = JsonBody<
  operations['SalonCrud_list']['responses'][200]['content']
>
export type CreateSalonResponse = JsonBody<
  operations['SalonCrud_create']['responses'][201]['content']
>
export type GetSalonResponse = JsonBody<
  operations['SalonCrud_get']['responses'][200]['content']
>
export type UpdateSalonResponse = JsonBody<
  operations['SalonCrud_update']['responses'][200]['content']
>
```

`JsonBody` は、生成されたレスポンスの `content` から `application/json` の本体を取り出す型です（`backend/packages/api/src/shared/operation-types.ts`）。

```typescript
export type JsonBody<Content> = Content extends {
  'application/json': infer Body
}
  ? Body
  : never
```

`{ data, meta, links }` という包みの形も TypeSpec で決まっているので、ここでも手書きしません。削除は本体のない 204 を返すので、レスポンス型はありません。

### 7. ハンドラーに型を付ける

`backend/packages/api/src/routes/salon/create-salon.handler.ts`

```typescript
export const createSalonHandler = (
  dependencies: SalonUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CreateSalonResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateSalonUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
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
  })
}
```

`RequestHandler` の型引数は順に、パスパラメータ、レスポンス本体、リクエスト本体です。`authenticated`（`backend/packages/api/src/shared/authentication.ts`）で包んでも型引数は同じで、包まれたハンドラーの `req` と `res` にも同じ型が付きます。

- レスポンス本体は `CreateSalonResponse | ProblemDetails` なので、`res.json(...)` に渡す値が OpenAPI の定義と合わなければ型エラーになります。
- リクエスト本体は `unknown` です。生成型を当てて信用することはせず、ユースケースが検証します。
- クエリ文字列は文字列しか運べないため、一覧では `decodeSalonSearchQuery`（`backend/packages/api/src/routes/salon/_shared/query.ts`）が数値・真偽値・配列に直してからユースケースに渡します。

共通のレスポンス型も生成型の別名です。

| 型 | 定義場所 | 生成型 |
|----|----------|--------|
| `ProblemDetails` | `backend/packages/api/src/shared/problem-details.ts` | `components['schemas']['Models.ProblemDetails']` |
| `ResponseMeta` | `backend/packages/api/src/shared/responses.ts` | `components['schemas']['Models.ResponseMeta']` |
| `PaginationMeta` / `PaginationLinks` | `backend/packages/api/src/shared/page-links.ts` | `components['schemas']['Models.PaginationMeta']` / `['Models.PaginationLinks']` |

認証のルート（`backend/packages/api/src/routes/auth/_shared/types.ts`、`backend/packages/api/src/routes/admin-auth/_shared/types.ts`）、サービスカテゴリーのルート（`backend/packages/api/src/routes/service-category/_shared/types.ts`）、サービスのルート（`backend/packages/api/src/routes/service/_shared/types.ts`）、顧客のルート（`backend/packages/api/src/routes/customer/_shared/types.ts`）、顧客の好み設定のルート（`backend/packages/api/src/routes/customer-preferences/_shared/types.ts`）、予約のルート（`backend/packages/api/src/routes/booking/_shared/types.ts`）、売上のルート（`backend/packages/api/src/routes/sale/_shared/types.ts`）、支払い方法のルート（`backend/packages/api/src/routes/payment-method/_shared/types.ts`）、返金のルート（`backend/packages/api/src/routes/payment/_shared/types.ts`）、売上レポートのルート（`backend/packages/api/src/routes/sales-report/_shared/types.ts`）、ポイントのルート（`backend/packages/api/src/routes/point/_shared/types.ts`）、レビューのルート（`backend/packages/api/src/routes/review/_shared/types.ts`）、通報のルート（`backend/packages/api/src/routes/review-report/_shared/types.ts`）、システムエンドポイント（`backend/packages/api/src/routes/system/index.ts`）も、同じ `JsonBody<operations[...]>` の形でレスポンス型を取り出しています。

## TypeSpec の定義と生成型の対応

| TypeSpec（`specs/models/salon.tsp`） | 生成型 | キーと null |
|--------------------------------------|--------|-------------|
| `SalonCreateRequest` | `components['schemas']['Models.SalonCreateRequest']` | 全キー必須。DB で NULL 可のカラムだけ `T \| null` |
| `SalonUpdateRequest` | `components['schemas']['Models.SalonUpdateRequest']` | 全キー省略可。NULL 可のカラムは `null` でクリア |
| `SalonSearchRequest` | `operations['SalonCrud_list']['parameters']['query']` | 全キー省略可 |
| `SalonResponse` | `components['schemas']['Models.SalonResponse']` | 全キー必須 |

`api-types.ts` での現れ方（抜粋）:

```typescript
"Models.SalonCreateRequest": {
    name: string;
    nameKana: string | null;
    // ...
};
"Models.SalonUpdateRequest": {
    name?: string;
    nameKana?: string | null;
    // ...
};
```

ルールそのものは [TypeSpec API Type Rules](./typespec-api-type-rules.md) にあります。

## ルール

- 生成型と同じ形の型を手書きしない。必要なのは別名だけ。
- `any`、型アサーション、型ガードを使わない。外から来た値は Zod スキーマと `parseWith` で検証する。
- 生成ファイルを編集しない。変えたいときは TypeSpec を変えて `pnpm generate` を実行する。
- マッパーでプロパティ名を変えない（API のプロパティ名は DB のカラム名と同じ）。

## 他のドメインを実装するとき

Salon、認証、サロンのサービスカテゴリーとサービス、顧客台帳（`CustomerCrud` の 5 つのオペレーションと、`CustomerProfile` のプロフィールの 3 つ）、顧客の好み設定（`CustomerCrud` と `CustomerProfile` の `getPreferences`・`updatePreferences`）、予約台帳（`BookingCrud` の 11 オペレーション）、スタッフ台帳（`StaffCrud` の 5 つのオペレーション）、スタッフの勤務スケジュール（`StaffSchedules`）、スタッフの招待（`StaffInvitations` と、`AuthCrud` の確認・受け入れ・参加）、スタッフのアカウント（`StaffAccounts`）、スタッフのプロフィール（`StaffProfile` と `StaffOwnProfile`）以外はこれから実装するものです。実装するときは Salon と同じ配置にします（`<domain>` はドメイン名で、サービスカテゴリーでは `service-category`、サービスでは `service`、顧客では `customer`、顧客の好み設定では `customer-preferences`、予約では `booking`、スタッフでは `staff`、スタッフの勤務スケジュールでは `staff-schedule`、スタッフの招待では `staff-invitation`、スタッフのアカウントでは `staff-account`、スタッフのプロフィールでは `staff-profile` です）。

- `backend/packages/domain/src/models/<domain>.ts`: 生成型の別名と DB 型
- `backend/packages/domain/src/schemas/<domain>.schema.ts`: `satisfies z.ZodType<…>` を付けた Zod スキーマ
- `backend/packages/api/src/routes/<domain>/_shared/types.ts`: 操作型から取り出したレスポンス型

## フロントエンド

フロントエンドはこのパッケージを使いません。同じ OpenAPI ドキュメントから Orval が別のクライアントを生成します。[フロントエンドAPI統合ガイド](./frontend-api-integration.md) を参照してください。

## トラブルシューティング

**生成型が見つからない、古い**: `pnpm generate` を実行し、エディタの TypeScript サーバーを再起動します。

**`satisfies z.ZodType<…>` が型エラーになる**: TypeSpec のモデルと Zod スキーマがずれています。スキーマ（または TypeSpec）を直します。型アサーションで黙らせません。

**CI の `pnpm check:generated` が失敗する**: TypeSpec の変更に生成物のコミットが伴っていません。`pnpm generate` を実行して生成物をコミットします。

## 関連ドキュメント

- [Type Generation System](./type-generation-system.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [Backend Architecture Guidelines](./backend-architecture-guidelines.md)
- [Type Safety Principles](./type-safety-principles.md)
