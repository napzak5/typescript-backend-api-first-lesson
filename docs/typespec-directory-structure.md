# TypeSpecディレクトリ構成ガイド

API 定義（TypeSpec）は `specs/` にある。このドキュメントは、そこに何があり、どのコマンドで何が生成されるかを説明する。モデルやオペレーションの書き方は [TypeSpec API型定義ルール](./typespec-api-type-rules.md) を参照。

## ディレクトリ構成

```
specs/
├── main.tsp                  # エントリーポイント
├── tspconfig.yaml            # エミッターの設定
├── package.json              # @beauty-salon/specs（compile / format / format:check）
├── models/                   # モデル定義（namespace BeautySalon.Models）
│   ├── _shared/
│   │   ├── common.tsp               # ID スカラー、共通 Enum、共通モデル
│   │   └── common-api-patterns.tsp  # エラー、ページネーション、レスポンスの共通ラッパー
│   ├── attachment.tsp
│   ├── auth.tsp
│   ├── booking.tsp
│   ├── customer.tsp
│   ├── inventory.tsp
│   ├── payment.tsp
│   ├── permission.tsp
│   ├── review.tsp
│   ├── salon.tsp
│   ├── service.tsp
│   ├── staff.tsp
│   └── treatment.tsp
├── operations/               # オペレーション定義（namespace BeautySalon.Operations）
│   ├── attachment-operations.tsp
│   ├── auth-operations.tsp
│   ├── booking-operations.tsp
│   ├── customer-operations.tsp
│   ├── inventory-operations.tsp
│   ├── payment-operations.tsp
│   ├── permission-operations.tsp
│   ├── review-operations.tsp
│   ├── salon-operations.tsp
│   ├── service-operations.tsp
│   ├── staff-operations.tsp
│   ├── system-operations.tsp        # /api/system の alive / ready / health
│   └── treatment-operations.tsp
└── tsp-output/               # 生成物（コミットする）
    └── @typespec/openapi3/generated/openapi.yaml
```

ドメインごとに、モデルを `models/<domain>.tsp`、オペレーションを `operations/<domain>-operations.tsp` に置き、両方を `main.tsp` から import する。予約（booking）は、予約とその施術明細（旧 reservation）を 1 つのドメインとして `booking.tsp` に定義している。

## 定義と実装の対応

TypeSpec に定義があっても、バックエンドに実装があるとは限らない。

| 定義 | バックエンドの実装 |
|---|---|
| `models/salon.tsp`、`operations/salon-operations.tsp`（`SalonCrud` の 5 オペレーション） | `backend/packages/api/src/routes/salon/`。定義と実装は一致している |
| `operations/system-operations.tsp` の `SystemOperations`（`alive`、`ready`、`health`） | `backend/packages/api/src/routes/system/index.ts`。定義と実装は一致している |
| `models/auth.tsp`、`operations/auth-operations.tsp` の `AuthCrud` の 19 オペレーションのうち 16（`register`、`login`、`refreshToken`、`logout`、`logoutAll`、`getCurrentUser`、`sendEmailVerification`、`confirmEmailVerification`、`forgotPassword`、`verifyResetToken`、`resetPassword`、`changePassword`、`enableTwoFactor`、`verifyTwoFactor`、`disableTwoFactor`、`generateBackupCodes`）と `SessionCrud` の 2 オペレーション（`getSessions`、`revokeSession`） | `backend/packages/api/src/routes/auth/`。定義と実装は一致している |
| `models/auth.tsp` の招待のリクエスト（`AuthStaffInvitationVerifyRequest`、`AuthStaffInvitationAcceptRequest`、`AuthStaffInvitationJoinRequest`）、`operations/auth-operations.tsp` の `AuthCrud` の残りの 3 オペレーション（`verifyStaffInvitation`、`acceptStaffInvitation`、`joinStaffInvitation`） | `backend/packages/api/src/routes/staff-invitation/`（招待された側のルーター）。定義と実装は一致している（[スタッフ台帳](./staff.md#スタッフのログインアカウント)） |
| `operations/auth-operations.tsp` の `AdminAuthCrud` の 3 オペレーション（`getUser`、`unlockAccount`、`resetTwoFactor`） | `backend/packages/api/src/routes/admin-auth/`。定義と実装は一致している（[認証と認可](./authentication.md#管理者の操作)） |
| `models/service.tsp` のカテゴリーのモデル、`operations/service-operations.tsp` の `ServiceCategoryCrud` の 5 オペレーション（`list`、`create`、`get`、`update`、`delete`） | `backend/packages/api/src/routes/service-category/`。定義と実装は一致している（[サービスメニュー](./service-menu.md)） |
| `models/service.tsp` のサービスのモデル、`operations/service-operations.tsp` の `ServiceCrud` の 6 オペレーション（`list`、`create`、`get`、`update`、`delete`、`bulkUpdate`） | `backend/packages/api/src/routes/service/`。定義と実装は一致している（[サービスメニュー](./service-menu.md)） |
| `models/customer.tsp` の顧客のモデル（`CustomerResponse`、`CustomerCreateRequest`、`CustomerUpdateRequest`、`CustomerSearchRequest`）、`operations/customer-operations.tsp` の `CustomerCrud` の 19 オペレーションのうち 5 つ（`list`、`create`、`get`、`update`、`delete`） | `backend/packages/api/src/routes/customer/`。この 5 つは、定義と実装が一致している（[顧客台帳](./customers.md)） |
| `models/customer.tsp` のプロフィールのモデル（`CustomerProfileResponse`、`CustomerProfileCreateRequest`、`CustomerProfileUpdateRequest`）、`operations/customer-operations.tsp` の `CustomerProfile` の 5 オペレーションのうち 3 つ（`get`、`create`、`update`） | 同じ `backend/packages/api/src/routes/customer/` の `*-customer-profile.handler.ts`。定義と実装は一致している（[顧客台帳](./customers.md#顧客本人のプロフィール)） |
| `models/customer.tsp` の好み設定のモデル（`CustomerPreferencesResponse`、`CustomerPreferencesUpdateRequest`、`StylePreference`）、`operations/customer-operations.tsp` の `CustomerCrud` と `CustomerProfile` の、それぞれ 2 オペレーション（`getPreferences`、`updatePreferences`） | `backend/packages/api/src/routes/customer-preferences/`（顧客本人のものは `*-own-customer-preferences.handler.ts`）。定義と実装は一致している（[顧客台帳](./customers.md#好み設定)） |
| `CustomerCrud` の残りの 12 オペレーション（`batchGet`、`bulkCreate`、`bulkUpdate`、`bulkDelete`、`export`、`getHistory`、`getVersion`、`restore`、`getStatistics`、`merge`、`exportData`、`requestDeletion`） | なし |
| `models/staff.tsp` のスタッフのモデル（`StaffResponse`、`StaffCreateRequest`、`StaffUpdateRequest`、`StaffSearchRequest`）、`operations/staff-operations.tsp` の `StaffCrud` の 5 オペレーション（`list`、`create`、`get`、`update`、`delete`） | `backend/packages/api/src/routes/staff/`。定義と実装は一致している（[スタッフ台帳](./staff.md)） |
| `models/staff.tsp` のプロフィールのモデル（`StaffProfileResponse`、`StaffProfileSearchRequest`、`StaffProfileUpdateRequest`）、`operations/staff-operations.tsp` の `StaffProfile` の 2 オペレーション（`list`、`get`）と `StaffOwnProfile` の 2 オペレーション（`get`、`update`） | `backend/packages/api/src/routes/staff-profile/`（本人のプロフィールは `*-own-staff-profile.handler.ts`）。定義と実装は一致している（[スタッフ台帳](./staff.md#顧客に見せるプロフィール)） |
| `models/staff.tsp` の勤務スケジュールのモデル（`StaffSchedule`、`StaffScheduleUpdateRequest`、`StaffScheduleSearchRequest`）、`operations/staff-operations.tsp` の `StaffSchedules` の 2 オペレーション（`list`、`update`） | `backend/packages/api/src/routes/staff-schedule/`。定義と実装は一致している（[スタッフ台帳](./staff.md#勤務スケジュール)） |
| `models/staff.tsp` の招待のモデル（`StaffInvitationResponse`、`StaffInvitationCreateRequest`、`SalonRoleType`）、`operations/staff-operations.tsp` の `StaffInvitations` の 3 オペレーション（`get`、`create`、`delete`） | `backend/packages/api/src/routes/staff-invitation/`（招待する側のルーター）。定義と実装は一致している（[スタッフ台帳](./staff.md#スタッフのログインアカウント)） |
| `models/staff.tsp` のアカウントのモデル（`StaffAccountResponse`、`StaffAccountUpdateRequest`）、`operations/staff-operations.tsp` の `StaffAccounts` の 3 オペレーション（`get`、`update`、`delete`） | `backend/packages/api/src/routes/staff-account/`。定義と実装は一致している（[スタッフ台帳](./staff.md#紐づいたアカウントの管理)） |
| `models/booking.tsp` の予約のモデル（`BookingResponse`、`BookingServiceResponse`、`BookingCreateRequest`、`BookingServiceCreateRequest`、`BookingUpdateRequest`、`BookingSearchRequest`）、`operations/booking-operations.tsp` の `BookingCrud` の 11 オペレーション（`list`、`create`、`get`、`update`、`delete`、`confirm`、`cancel`、`start`、`complete`、`noShow`、`reschedule`）と、その本文のモデル（`BookingCancelRequest`、`BookingCompleteRequest`、`BookingRescheduleRequest`） | `backend/packages/api/src/routes/booking/`。定義と実装が一致している（[予約台帳](./bookings.md)） |
| `operations/booking-operations.tsp` の `BookingServiceCrud` の 3 オペレーション（`create`、`get`、`delete`）。モデルは、予約の作成とレスポンスが使う `BookingServiceCreateRequest` と `BookingServiceResponse` | `backend/packages/api/src/routes/booking-service/`。定義と実装が一致している（[予約台帳](./bookings.md#施術明細の追加と削除)） |
| `operations/booking-operations.tsp` の `AvailableSlotCrud` の 2 オペレーション（`list`、`check`）と、`models/booking.tsp` の空き枠のモデル（`AvailableSlotSearchRequest`、`AvailableSlotResponse`、`AvailableSlotCheckRequest`、`AvailableSlotCheckResponse`） | `backend/packages/api/src/routes/available-slot/`。定義と実装が一致している（[予約台帳](./bookings.md#空き枠)）。空き枠にはテーブルがなく、モデルは `pnpm check:api-db` の対象ではない |
| `operations/booking-operations.tsp` の `CustomerBookings` の 5 オペレーション（`list`、`create`、`get`、`cancel`、`reschedule`）と、`models/booking.tsp` の `CustomerBookingResponse`、`CustomerBookingServiceResponse`、`CustomerBookingCreateRequest`、`CustomerBookingSearchRequest` | `backend/packages/api/src/routes/customer-booking/`。定義と実装が一致している（[予約台帳](./bookings.md#顧客が自分で入れる予約)）。キャンセルの本文は、台帳と同じ `BookingCancelRequest` |
| `models/payment.tsp` の売上のモデル（`SaleResponse`、`SalesDetail`、`PaymentResponse`、`SaleCreateRequest`、`SaleUpdateRequest`、`SaleVoidRequest`、`SaleSearchRequest`）、`operations/payment-operations.tsp` の `SaleCrud` の 8 オペレーションのうち 5 つ（`list`、`create`、`get`、`update`、`voidSale`） | `backend/packages/api/src/routes/sale/`。定義と実装は一致している（[売上台帳](./sales.md)） |
| `models/payment.tsp` のレシートと金額の計算のモデル（`SaleReceiptResponse`、`SaleCalculateRequest`、`SaleCalculateResponse`、`SaleBreakdownResponse`）、`SaleCrud` の `getReceipt`、`calculate` | `backend/packages/api/src/routes/sale/get-sale-receipt.handler.ts`、`calculate-sale.handler.ts`。定義と実装は一致している（[売上台帳](./sales.md#レシート)） |
| `models/payment.tsp` の支払い方法のモデル（`PaymentMethodResponse`、`PaymentMethodCreateRequest`、`PaymentMethodUpdateRequest`、`PaymentMethodSearchRequest`）、`operations/payment-operations.tsp` の `PaymentMethodCrud` の 5 オペレーション（`list`、`create`、`get`、`update`、`delete`） | `backend/packages/api/src/routes/payment-method/`。定義と実装は一致している（[支払い](./payments.md)） |
| `models/payment.tsp` の支払いのモデル（`SaleProcessRequest`、`PaymentRefundRequest`、`PaymentResponse`）、`SaleCrud` の `process`、`PaymentCrud` の `refund` | `backend/packages/api/src/routes/sale/process-sale.handler.ts`、`backend/packages/api/src/routes/payment/`。定義と実装は一致している（[支払い](./payments.md#支払いは受け取った結果の記録)） |
| `models/payment.tsp` の売上レポートのモデル（`SalesReportGetRequest`、`DailySalesGetRequest`、`SalesTrendsGetRequest`、`SalesTrendPeriodType`、`SalesReportResponse`、`SalesByMethodResponse`、`SalesByCategoryResponse`、`SalesByStaffResponse`、`DailySalesResponse`、`SalesTrendsResponse`）、`operations/payment-operations.tsp` の `SalesReportCrud` の 6 オペレーション（`get`、`getDaily`、`getByStaff`、`getByCategory`、`getTrends`、`export`） | `backend/packages/api/src/routes/sales-report/`。定義と実装は一致している（[売上レポート](./sales-reports.md)）。レポートにはテーブルがなく、モデルは `pnpm check:api-db` の対象ではない |
| `models/payment.tsp` のポイントのモデル（`PointTransactionType`、`PointReferenceType`、`PointTransactionResponse`、`PointTransactionSearchRequest`、`PointBalanceResponse`、`PointEarnRequest`、`PointUseRequest`、`PointAdjustRequest`、`PointExpiringResponse`、`PointExpireRequest`、`PointExpireResponse`）、`operations/payment-operations.tsp` の `PointCrud` の 7 オペレーション（`getBalance`、`listTransactions`、`getExpiring`、`earn`、`use`、`adjust`、`expire`） | `backend/packages/api/src/routes/point/`。定義と実装は一致している（[ポイント台帳](./points.md)）。モデルは `customer_points` と `customers.loyaltyPoints` と一致している（`pnpm check:api-db`） |
| `models/review.tsp`（`ReviewSortType`、`ReviewReportReasonType`、`ReviewReportStatusType`、`ReviewResponse`、`ReviewCreateRequest`、`ReviewSearchRequest`、`ReviewRespondRequest`、`ReviewReportRequest`、`ReviewReportResponse`、`ReviewSummaryResponse` など）、`operations/review-operations.tsp` の `ReviewCrud` のすべてのオペレーション、`ReviewReportCrud` の `list`、`dismiss` と、`SalonReviewSummary` の `getSummary`、`StaffReviewSummary` の `getStaffSummary` | `backend/packages/api/src/routes/review/`、`backend/packages/api/src/routes/review-report/`。定義と実装は一致している（[レビュー](./reviews.md)）。モデルは `reviews` と `review_reports` と一致している（`pnpm check:api-db`）。誰が参考になったと評価したか（`review_helpful_votes`）は、API に出さない |
| `models/inventory.tsp` の商品のモデル（`ProductResponse`、`ProductCreateRequest`、`ProductUpdateRequest`、`ProductSearchRequest`）、`operations/inventory-operations.tsp` の `ProductCrud` の 5 オペレーション（`list`、`create`、`get`、`update`、`delete`） | `backend/packages/api/src/routes/product/`。定義と実装は一致している（[商品](./products.md)） |
| `models/inventory.tsp` の在庫の行のモデル（`InventoryResponse`、`InventoryCreateRequest`、`InventoryUpdateRequest`、`InventorySearchRequest`、`InventoryLowStockSearchRequest`、`InventoryExpiringSearchRequest`）、`operations/inventory-operations.tsp` の `InventoryCrud` の 7 オペレーション（`list`、`create`、`get`、`update`、`delete`、`listLowStock`、`listExpiring`） | `backend/packages/api/src/routes/inventory/`。定義と実装は一致している（[在庫](./inventory.md)） |
| 上記以外のドメイン（treatment と、inventory の在庫の移動・棚卸し・在庫評価額） | なし。TypeSpec は DB のテーブルと一致している（`pnpm check:api-db`）が、ドメイン・リポジトリ・ルートのコードはない |
| attachment、permission と、inventory の発注・アラート、treatment のカルテ、customer の監査履歴・エクスポート・データ削除リクエスト | なし。対応するテーブルもまだない（[API-DB型制約マッピング](./api-db-type-constraints-mapping.md#ルールに載せるモデル載せないモデル)） |

`main.tsp` は `@useAuth(BearerAuth)` を宣言しており、認証なしで呼べるオペレーション（システムのオペレーション、サロンの一覧と 1 件の取得、サービスカテゴリーの一覧と 1 件の取得、サービスの一覧と 1 件の取得、スタッフのプロフィールの一覧と 1 件の取得、登録・ログインなどの認証フロー、共有リンク）には `@useAuth(NoAuth)` が付いている。実装済みのオペレーションでは、`@useAuth(NoAuth)` のないものをサーバーがアクセストークンで認証し、権限をユースケースで判定する（[認証と認可](./authentication.md)）。

## 各ファイルの内容

### `main.tsp`

すべてのモデルとオペレーションを import し、サービスを定義する。

```typespec
// specs/main.tsp（抜粋）
import "./models/_shared/common-api-patterns.tsp";
import "./models/auth.tsp";
import "./models/salon.tsp";
// ...

import "./operations/system-operations.tsp";
import "./operations/auth-operations.tsp";
import "./operations/salon-operations.tsp";
// ...

@service(#{ title: "Beauty Salon API" })
@server("https://api.beauty-salon.com", "Production API Server")
@server("https://staging-api.beauty-salon.com", "Staging API Server")
@server("http://localhost:3000", "Local Development Server")
@versioned(VersionType)
@useAuth(BearerAuth)
namespace BeautySalon {
```

`models/_shared/common.tsp` は各モデルファイルが import するので、`main.tsp` には書かれていない。

### `models/_shared/`

| ファイル | 内容 |
|---|---|
| `common.tsp` | ID スカラー（`SalonId`、`CustomerId` など。`@format("uuid")`）、複数のドメインが使う Enum（`DayOfWeekType`、`StaffLevelType`、`ServiceCategoryType` など）、複数のドメインが使うモデル（`OpeningHours`、`BusinessHours`、`TimeSlot`、`AuditInfo`、`Money` など） |
| `common-api-patterns.tsp` | エラー（`ProblemDetails`、`ProblemResponse<TStatus>`、`UnauthenticatedResponse`、`PermissionDeniedResponse`、`PublicErrors`、`SessionErrors`、`CommonErrors`、`RequestBodyErrors`、`ErrorCodeType`、`ValidationError`）、レスポンスのラッパー（`ApiResponse<T>`、`ResponseMeta`、`CursorPaginationResponse<T>`、`PaginationMeta`、`PaginationLinks`）、ヘルスチェック（`HealthStatus`、`HealthCheck`、`SystemReadyResponse`） |

1 つのドメインだけが使う Enum やモデルは、そのドメインのファイルに置く。どこからも参照されない定義は残さない（TypeSpec は参照されないモデルも OpenAPI に出力する）。

### `operations/system-operations.tsp`

`SystemOperations`: `/api/system` 以下の運用系オペレーション（`alive`、`ready`、`health`）。認証は不要で、503 のレスポンスは `ProblemDetails` ではなく、200 と同じモデルを返す。

### モデルファイルとオペレーションファイル

モデルは `BeautySalon.Models`、オペレーションは `BeautySalon.Operations` の namespace に定義する。モデルファイルは `_shared` と参照する他ドメインのモデルを、オペレーションファイルは使うモデルのファイルと `_shared` を import する。

```typespec
// specs/models/salon.tsp
import "@typespec/http";
import "./_shared/common.tsp";
import "./_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using BeautySalon.Models;

namespace BeautySalon.Models {
```

```typespec
// specs/operations/salon-operations.tsp
import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";
import "../models/salon.tsp";
import "../models/_shared/common.tsp";
import "../models/_shared/common-api-patterns.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using BeautySalon.Models;

namespace BeautySalon.Operations {
  @route("/api/v1/salons")
  @tag("Salons")
  namespace SalonOperations {
    interface SalonCrud {
```

namespace とインターフェースの名前は、生成物の名前になる。

| TypeSpec | OpenAPI | バックエンドの型 |
|---|---|---|
| `BeautySalon.Models.SalonResponse` | `components.schemas` の `Models.SalonResponse` | `components['schemas']['Models.SalonResponse']` |
| `SalonCrud` の `list` | `operationId: SalonCrud_list` | `operations['SalonCrud_list']` |
| `SystemOperations` の `alive` | `operationId: SystemOperations_alive` | `operations['SystemOperations_alive']` |

### `tspconfig.yaml`

```yaml
emit:
  - "@typespec/openapi3"

options:
  "@typespec/openapi3":
    output-file: "generated/openapi.yaml"
```

エミッターは `@typespec/openapi3` だけで、OpenAPI 3.0 のドキュメントを `specs/tsp-output/@typespec/openapi3/generated/openapi.yaml` に出力する。

## 生成コマンド

| コマンド | 実行内容 | 出力 |
|---|---|---|
| `pnpm generate:spec` | `specs` の `compile`（`tsp compile .`） | `specs/tsp-output/@typespec/openapi3/generated/openapi.yaml` |
| `pnpm generate:api` | orval（`frontend/packages/api-client/orval.config.ts`） | `frontend/packages/api-client/src/generated/`（`endpoints/`、`models/`） |
| `pnpm generate:backend` | `backend/packages/generated/scripts/generate-types.ts`（openapi-typescript） | `backend/packages/generated/src/` の `api-types.ts`、`schema.ts`（Enum の Zod スキーマ）、`index.ts` |
| `pnpm generate` | 上の 3 つを順に実行 | |
| `pnpm generate:watch` | `.tsp` が変わるたびに `pnpm generate` を実行（`scripts/generate-watch.ts`） | |
| `pnpm check:generated` | `pnpm generate` を実行し、上の 3 か所の出力がコミット済みの内容と違えば失敗する | |

生成物はすべてコミットする。TypeSpec を変更したら `pnpm generate` を実行し、生成物を同じコミットに含める。CI は `pnpm check:generated` でこれを確認する。

TypeSpec のフォーマットは `tsp format` で、ルートの `pnpm format:check`（確認）と `pnpm format:fix`（適用）に含まれている。

生成された型の使い方は [型生成システム](./type-generation-system.md) を参照。

## トラブルシューティング

| エラー | 原因と対処 |
|---|---|
| `import-not-found: Couldn't resolve import "..."` | 相対パスの誤り。`models/` 直下からは `./_shared/`、`operations/` 直下からは `../models/`、`operations/_shared/` からは `../../models/` で参照する |
| `duplicate-symbol: Duplicate name: "..."` | 同じ namespace に同名の型が 2 つある。モデルはすべて `BeautySalon.Models` に入るので、ファイルが違っても名前は重複できない。共通の型は `models/_shared/` に 1 つだけ定義する |
| `invalid-decorator-location: Cannot decorate spread property.` | spread（`...Model`）に `@doc` などのデコレーターを付けている。デコレーターは spread 元のモデルのプロパティに付ける |

## 関連ドキュメント

- [TypeSpec API型定義ルール](./typespec-api-type-rules.md)
- [型生成システム](./type-generation-system.md)
- [API-DB型制約マッピング](./api-db-type-constraints-mapping.md)
- [認証と認可](./authentication.md)
