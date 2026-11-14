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
| `models/auth.tsp`、`operations/auth-operations.tsp` の `AuthCrud` のうち `login`、`refreshToken`、`logout`、`logoutAll`、`getCurrentUser` | `backend/packages/api/src/routes/auth/`。この 5 オペレーションは定義と実装が一致している |
| `operations/auth-operations.tsp` の残り（`AuthCrud` の登録・メールアドレスの確認・パスワードの再設定と変更・2 要素認証、`SessionCrud`、`AdminAuthCrud`） | なし（[認証と認可](./authentication.md#実装範囲)） |
| 上記以外のドメイン（customer、staff、service、booking、review、treatment、payment、inventory） | なし。TypeSpec は DB のテーブルと一致している（`pnpm check:api-db`）が、ドメイン・リポジトリ・ルートのコードはない |
| attachment、permission と、inventory の発注・アラート、treatment のカルテ | なし。対応するテーブルもまだない（[API-DB型制約マッピング](./api-db-type-constraints-mapping.md#ルールに載せるモデル載せないモデル)） |

`main.tsp` は `@useAuth(BearerAuth)` を宣言しており、認証なしで呼べるオペレーション（システムのオペレーション、サロンの一覧と 1 件の取得、登録・ログインなどの認証フロー、共有リンク）には `@useAuth(NoAuth)` が付いている。実装済みのオペレーションでは、`@useAuth(NoAuth)` のないものをサーバーがアクセストークンで認証し、権限をユースケースで判定する（[認証と認可](./authentication.md)）。

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
