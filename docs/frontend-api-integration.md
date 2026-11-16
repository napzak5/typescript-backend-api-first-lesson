# フロントエンドAPI統合ガイド（Orval）

このドキュメントは、フロントエンドが API とつながるために現在リポジトリにあるものと、まだないものを説明します。コードは実ファイルからの抜粋で、コメントは省いています（「アプリから使う」の節のサンプルだけは本書のために書いたものです）。

## 現状

**3つのフロントエンドアプリは、現時点ではどこからも API を呼んでいません。** 各画面は `src/App.tsx` に書かれた固定のデータを表示しています。

あるもの:

- OpenAPI ドキュメントから Orval が生成した API クライアント（`@beauty-salon-frontend/api-client`）。型、fetch 関数、TanStack Query のフックを含む
- そのクライアントが HTTP 呼び出しに使う fetch ラッパー（`@beauty-salon-frontend/io` の `customInstance`）。生成コードが期待するとおりに動くことを、テストと実際のサーバーへの呼び出しで確認している
- 各アプリの TanStack Query の初期設定（`QueryClientProvider`）
- 環境変数 `VITE_BACKEND_BASE_URL`（API サーバーのオリジン）

ないもの:

- 生成クライアントを使うコンポーネント、画面、カスタムフック（アプリは `api-client` にも `io` にも依存していない）
- 認証（バックエンドはアクセストークンを検証するが、フロントエンドにはログイン画面も、トークンを保持する場所も、`Authorization` ヘッダーを付ける仕組みもない。生成されたフックから呼べるのは、認証なしのオペレーションだけ。[fetch ラッパー](#fetch-ラッパーcustominstance)の制約を参照）
- API のモックサーバーと、ブラウザーから API までを通すテスト
- Salon、サロンのサービスカテゴリーとサービス、顧客台帳、予約台帳、空き枠、顧客が自分で入れる予約、スタッフ台帳、スタッフの勤務スケジュール、スタッフの招待、スタッフのアカウント、スタッフのプロフィール、売上台帳、支払い方法と支払い、売上レポート、ポイント台帳（有効期限の 2 つのオペレーションを除く）、認証、システムエンドポイント以外のバックエンド実装（クライアントは OpenAPI の全操作について生成されるが、サーバーが応答するのは `/api/v1/salons` と `/api/v1/salons/{id}`、`/api/v1/salons/{salonId}/service-categories` 以下、`/api/v1/salons/{salonId}/services` 以下、`/api/v1/customers` と `/api/v1/customers/{id}`（顧客の一覧、登録、1 件の取得、更新、削除）、`/api/v1/customers/me`（顧客本人のプロフィールの取得、作成、更新）、`/api/v1/customers/{id}/preferences` と `/api/v1/customers/me/preferences`（顧客の好み設定の取得、更新）、`/api/v1/bookings` と `/api/v1/bookings/{id}`（予約の一覧、作成、1 件の取得、更新、削除）、`/api/v1/bookings/{id}/confirm`・`/cancel`・`/start`・`/complete`・`/no-show`（予約のステータスの操作）、`/api/v1/bookings/{id}/reschedule`（予約の日時の変更）、`/api/v1/bookings/{bookingId}/services` と `/api/v1/bookings/{bookingId}/services/{id}`（予約の施術明細の追加、1 件の取得、削除）、`/api/v1/salons/{salonId}/staff` と `/api/v1/salons/{salonId}/staff/{id}`（スタッフの一覧、登録、1 件の取得、更新、削除）、`/api/v1/salons/{salonId}/staff/{id}/schedules`（スタッフの勤務スケジュールの一覧、更新）、`/api/v1/salons/{salonId}/staff/{id}/invitation`（スタッフの招待の取得、作成、取り消し）、`/api/v1/salons/{salonId}/staff/{id}/account`（スタッフに紐づいたアカウントの取得、ロールの変更、紐づけの解除）、`/api/v1/staff-profiles` と `/api/v1/staff-profiles/{id}`（顧客に見せるスタッフのプロフィールの一覧、1 件の取得）、`/api/v1/staff-profiles/me`（スタッフ本人のプロフィールの取得、更新）、`/api/v1/salons/{salonId}/available-slots` と `/api/v1/salons/{salonId}/available-slots/check`（空き枠の一覧、確認）、`/api/v1/customers/me/bookings` 以下（顧客が自分で入れる予約の一覧、作成、1 件の取得、キャンセル、日時の変更）、`/api/v1/sales` 以下（売上の一覧、作成、1 件の取得、更新、取り消し、支払いの記録、レシート、金額の計算）、`/api/v1/salons/{salonId}/payment-methods` 以下（支払い方法の一覧、作成、1 件の取得、更新、削除）、`/api/v1/payments/{id}/refund`（返金）、`/api/v1/sales-reports` 以下（売上レポート）、`/api/v1/points/customer/{customerId}/balance` と `/api/v1/points/customer/{customerId}/transactions`（顧客のポイントの残高、履歴）、`/api/v1/points/earn`・`/use`・`/adjust`（ポイントの付与、利用、調整）、`/api/v1/auth` 以下、`/api/v1/admin/auth` 以下、および `/api/system/alive`、`/api/system/ready`、`/api/system/health` だけ。`/api/v1/salons/{salonId}/reviews/summary` など、サロンの下にあるほかのルート、`/api/v1/customers/{id}/history` など顧客のほかのルートには応答しない）

## 構成

### アプリ

| アプリ | ディレクトリ | 開発サーバーのポート |
|--------|--------------|----------------------|
| portal-app | `frontend/apps/portal-app` | 3001 |
| admin-app | `frontend/apps/admin-app` | 3002 |
| dashboard-app | `frontend/apps/dashboard-app` | 3003 |

いずれも Vite 8 + React 19 + react-router-dom 7 の SPA です。ワークスペースのパッケージで依存しているのは `@beauty-salon-frontend/ui` と `@beauty-salon-frontend/theme` だけです。

### 共有パッケージ（`frontend/packages/`）

| パッケージ | 役割 | 使っているもの |
|------------|------|----------------|
| `api-client` | Orval の生成物（`src/generated/`）と、その再エクスポート | なし |
| `io` | fetch ラッパー `customInstance` | `api-client` |
| `config` | `import.meta.env` を読む `env` オブジェクトと、モード判定関数（`isProductionMode` など） | `io`、`ui`（型のみ） |
| `theme` | Tailwind CSS のプリセットと CSS 変数（`styles/base.css`） | 3つのアプリ、`ui` |
| `ui` | `Button`、`Card`、`EnvironmentBanner` | 3つのアプリ |
| `assets` | 画像アセット | なし |

アプリが実際に使っているのは `ui` と `theme` だけです（`ui` は `config` から型を1つ借りています）。`api-client` と `io` は、どのアプリからも使われていません。

各パッケージの TypeScript は rslib でビルドした `dist/` を通して参照されます。`pnpm dev` は最初にフロントエンドのパッケージをビルドしてから、各パッケージの監視ビルドと各アプリの開発サーバー（とバックエンド）を起動します。テストはビルドを必要としません（[テスト](#テスト)）。

## 型の流れ（TypeSpec からコンポーネントまで）

```
specs/models/salon.tsp                       model SalonResponse
    │  pnpm generate:spec
    ▼
specs/tsp-output/@typespec/openapi3/generated/openapi.yaml
                                             components.schemas["Models.SalonResponse"]
    │  pnpm generate:api（orval）
    ▼
frontend/packages/api-client/src/generated/
    models/modelsSalonResponse.ts            interface ModelsSalonResponse
    endpoints/salons/salons.ts               useSalonCrudList() など
    │  import { ... } from '@beauty-salon-frontend/api-client'
    ▼
アプリのコンポーネント（未実装）
```

生成の手順、生成物がコミット対象であること、`pnpm check:generated` による検査は [Type Generation System](./type-generation-system.md) にまとめてあります。バックエンドは同じ OpenAPI ドキュメントから別の型（`@beauty-salon-backend/generated`）を生成します。

## 生成クライアント（Orval）

設定は `frontend/packages/api-client/orval.config.ts` です。

| 設定 | 値 | 意味 |
|------|-----|------|
| `input.target` | `specs/tsp-output/@typespec/openapi3/generated/openapi.yaml`（相対パスで指定） | 入力の OpenAPI ドキュメント |
| `output.mode` | `tags-split` | OpenAPI のタグごとにファイルを分ける |
| `output.target` / `output.schemas` | `./src/generated/endpoints` / `./src/generated/models` | 出力先 |
| `output.client` | `react-query` | TanStack Query 5 のフックを生成する |
| `output.httpClient` | `fetch` | fetch ベースの関数を生成する |
| `output.mock` | `false` | モックは生成しない |
| `output.clean` | `true` | 生成前に出力先を消す |
| `output.override.mutator` | `./src/mutator.ts` の `customInstance` | HTTP 呼び出しをこの関数に任せる |

`frontend/packages/api-client/src/mutator.ts` は `@beauty-salon-frontend/io` の `customInstance` を再エクスポートしているだけです。

### 生成されるもの（Salon の例）

`frontend/packages/api-client/src/generated/endpoints/salons/salons.ts` には、`SalonCrud` の操作ごとに次のものがあります。

| 操作 | fetch 関数 | フック | そのほか（主なもの） |
|------|------------|--------|----------|
| `GET /api/v1/salons` | `salonCrudList(params?)` | `useSalonCrudList(params?)` | `getSalonCrudListUrl`、`getSalonCrudListQueryKey`、`getSalonCrudListQueryOptions` |
| `POST /api/v1/salons` | `salonCrudCreate(body)` | `useSalonCrudCreate()` | `getSalonCrudCreateMutationOptions` |
| `GET /api/v1/salons/{id}` | `salonCrudGet(id)` | `useSalonCrudGet(id)` | `getSalonCrudGetQueryKey`、`getSalonCrudGetQueryOptions` |
| `PATCH /api/v1/salons/{id}` | `salonCrudUpdate(id, body)` | `useSalonCrudUpdate()` | `getSalonCrudUpdateMutationOptions` |
| `DELETE /api/v1/salons/{id}` | `salonCrudDelete(id)` | `useSalonCrudDelete()` | `getSalonCrudDeleteMutationOptions` |

型は `frontend/packages/api-client/src/generated/models/` にあります。

| 型 | 元になる定義 |
|----|--------------|
| `ModelsSalonResponse`、`ModelsSalonCreateRequest`、`ModelsSalonUpdateRequest` | TypeSpec の同名モデル（`Models.` 名前空間が接頭辞 `Models` になる） |
| `SalonCrudListParams` | 一覧のクエリパラメータ（`limit`、`cursor`、`keyword` など） |
| `SalonCrudList200`、`SalonCrudCreate201`、`SalonCrudGet200`、`SalonCrudUpdate200` | 成功レスポンスの本体（`data`、`meta`、`links`） |
| `ModelsProblemDetails` | エラーレスポンスの本体（RFC 9457 problem details） |
| `ModelsSalonId` | `string` の別名（ブランド型ではない） |

パッケージの入口は `.` だけです（`frontend/packages/api-client/src/index.ts` が endpoints と models をすべて再エクスポートする）。`generated/` 以下を直接 import するパスは公開されていません。

fetch 関数の戻り値の型は、ステータスコードで判別できるユニオンです。API のエラーは例外ではなく値として表されています。サーバーがどのルートでも返す 429 と 500、本文を受け取るオペレーションの 413 と 415、認証が必要なオペレーション（登録・更新・削除）の 401 と 403 もユニオンに含まれます（`salons.ts` より）。

```typescript
export type salonCrudListResponse200 = {
  data: SalonCrudList200
  status: 200
}

export type salonCrudListResponse400 = {
  data: ModelsProblemDetails
  status: 400
}
```

一覧はキーセット方式のページネーションです。次のページは `SalonCrudList200` の `meta.nextCursor` を `cursor` に渡して取得します。

## fetch ラッパー（`customInstance`）

実装は `frontend/packages/io/src/libs/fetcher/fetcher.ts` です。生成コードは、すべてのリクエストでこの関数を呼びます。

```typescript
// frontend/packages/io/src/libs/fetcher/fetcher.ts
export function customInstance<T>(url: string, options: RequestInit): Promise<T>
```

リクエスト:

- URL は `VITE_BACKEND_BASE_URL`（API サーバーのオリジン）に、生成コードのパス（`/api/v1/salons` など）をつなげたもの
- メソッド、ヘッダー、本文は生成コードが渡したものをそのまま送る。本文は生成コードが JSON にしているので、ここでは変換しない
- タイムアウトは 30 秒。呼び出し側が渡した `signal` があれば、それとタイムアウトのどちらでも中断される

レスポンス:

- **どの HTTP ステータスでも** `{ data, status, headers }` で resolve する。API のエラー応答は reject ではなく値で、呼び出し側が `status` で分岐する
- `data` は、`Content-Type` が `application/json` か `+json`（エラーの `application/problem+json`）なら JSON として読んだ値、本文が空（204）なら `undefined`、それ以外は文字列
- reject するのは、返すレスポンスがないときだけ: ネットワークの失敗、`signal` またはタイムアウトによる中断、`Content-Type` が JSON なのに本文が JSON として読めない、`VITE_BACKEND_BASE_URL` が設定されていない

知っておくべき制約:

- 型引数 `T` は生成コードがその操作について指定するレスポンスの型で、**実行時に本文を `T` と照合してはいません**。クライアントとサーバーが同じ OpenAPI ドキュメントから生成されていることが、型と実際の値が一致する根拠です
- JSON 以外の本文は文字列で返します。バイナリを返す操作（未実装の顧客エクスポート）を実装するときは、ここに対応が必要です
- `Authorization` などの共通ヘッダーを付ける仕組みはありません。生成された fetch 関数は最後の引数に `options?: RequestInit` を取るので、呼び出しごとに `headers` を渡すことはできますが、生成されたフックはこの引数にヘッダーを渡しません。そのため、実装済みのオペレーションのうちフックから呼べるのは認証なしのもの（システムのオペレーション、サロンの一覧と 1 件の取得、サービスカテゴリーの一覧と 1 件の取得、サービスの一覧と 1 件の取得、スタッフのプロフィールの一覧と 1 件の取得、ログイン、トークンの再発行、ユーザー登録、メールアドレスの確認、パスワードの再設定）だけで、それ以外は 401 になります。顧客台帳、顧客本人のプロフィール、顧客の好み設定、予約台帳、スタッフ台帳、スタッフ本人のプロフィールのオペレーションは、一覧と 1 件の取得を含めて、すべてアクセストークンが必要です。トークンの保持と付与は、フロントエンドの認証を実装するときに設計します（サーバー側の仕様は [認証と認可](./authentication.md)）

## TanStack Query の設定

3つのアプリとも `src/main.tsx` で同じ設定の `QueryClient` を作り、`QueryClientProvider` でアプリ全体を包んでいます（`frontend/apps/admin-app/src/main.tsx` より）。

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
})
```

`VITE_MODE` が `production` 以外のときは React Query Devtools も表示します。クエリやミューテーションを実行しているコードはまだありません。

`retry: 3` が再試行するのは、クエリが失敗（reject）したとき、つまり通信そのものが失敗したときです。API のエラー応答は値として返るので、再試行の対象になりません。

## 環境変数（`VITE_*`）

変数は各アプリのディレクトリにある `.env.<mode>` に置き、Vite がビルド時（開発サーバーでは起動時）に値を埋め込みます。リポジトリ直下の `.env.*` はバックエンド用で、`VITE_*` は入っていません。

| 変数 | 使っている場所 |
|------|----------------|
| `VITE_MODE` | `App.tsx` の `EnvironmentBanner` と環境名の表示、`main.tsx` の Devtools の表示判定 |
| `VITE_APP_TITLE` | `App.tsx` のヘッダー |
| `VITE_BACKEND_BASE_URL` | API サーバーのオリジン（パスは付けない）。`config` パッケージの `env` を通して `customInstance` が使う。アプリのコードからは使われていない |

- どのファイルが読まれるかは Vite のモードで決まります。開発サーバー（`pnpm dev`）と `build:dev` は `development`、`build:localhost` は `localhost`、`build:test` は `test`、`build:stg` は `staging`、`build:prod` は `production` です。3つのアプリとも、この 5 つのモードの `.env.<mode>` を持っています。
- ローカル用の 3 つ（`localhost`、`development`、`test`）の `VITE_BACKEND_BASE_URL` は `http://localhost:3000` で、リポジトリ直下の `.env.*` の `PORT` と同じです。
- `config` パッケージの `env` は、設定されていない変数を `undefined` として返します。

## アプリから使う（未実装）

以下は、最初の画面を API につなぐときの手順と推奨です。リポジトリにはまだ存在しません。対象は実装済みの Salon API のうち、認証なしで呼べる一覧です。

準備:

- 使うアプリの `package.json` に `@beauty-salon-frontend/api-client` と `ts-pattern` を追加する
- API サーバーの `CORS_ORIGIN` にそのアプリのオリジンが含まれていることを確認する。リポジトリ直下の `.env.localhost` と `.env.development` は、3つのアプリのオリジン（`http://localhost:3001`〜`3003`）を許可している

コンポーネントは生成されたフックと型だけを使います。レスポンスは `status` で分岐し、`.exhaustive()` で網羅を保証します。

```tsx
import { useSalonCrudList } from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

export function SalonList() {
  const salons = useSalonCrudList({ limit: 20 })

  if (salons.isPending) {
    return <p>読み込み中...</p>
  }
  if (salons.isError) {
    // 通信そのものの失敗（ネットワーク断、タイムアウト）
    return <p role='alert'>API に接続できませんでした</p>
  }

  return match(salons.data)
    .with({ status: 200 }, ({ data: page }) => (
      <ul>
        {page.data.map((salon) => (
          <li key={salon.id}>{salon.name}</li>
        ))}
      </ul>
    ))
    .with({ status: P.union(400, 429, 500) }, ({ data: problem }) => (
      <p role='alert'>{problem.title}</p>
    ))
    .exhaustive()
}
```

この分岐（200 と 400・429・500）は、現在の生成クライアントの型に対して網羅になっています。API 定義に新しいステータスが増えると、`.exhaustive()` が型エラーになって気づけます。

- 型は生成されたものをそのまま使う。`ModelsSalonResponse` と同じ形の型を手書きしない。`any` と型アサーションも使わない
- 登録・更新・削除は `useSalonCrudCreate` などのミューテーションフックを使い、結果も同じく `status` で分岐する。成功したら `getSalonCrudListQueryKey()` を使って一覧のキャッシュを無効化する。ただし、この 3 つはアクセストークンが必要で、フックはトークンを送らないので、フロントエンドの認証を実装するまでは 401 が返る
- サーバーの検証エラーは `ModelsProblemDetails` の `errors`（項目ごとの `field`・`rule`・`message`）から表示する
- 429 のときは、レスポンスの `headers` から `Retry-After`（秒）を読める
- `endpoints/bookings/bookings.ts` のフックのうち、すべてサーバーに実装がある。`BookingCrud` の 11 個、`BookingServiceCrud` の 3 個、`AvailableSlotCrud` の 2 個、`CustomerBookings` の 5 個である。`BookingCrud` のフックは、一覧、作成、1 件の取得、更新、削除の 5 つ（`useBookingCrudList`、`useBookingCrudCreate`、`useBookingCrudGet`、`useBookingCrudUpdate`、`useBookingCrudDelete`）、ステータスの 5 つの操作（`useBookingCrudConfirm`、`useBookingCrudCancel`、`useBookingCrudStart`、`useBookingCrudComplete`、`useBookingCrudNoShow`）、日時の変更（`useBookingCrudReschedule`）である。どれも `admin` か、予約のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。削除は、サロンの `staff` でも 403 になる。フックはトークンを送らないので、フロントエンドの認証を実装するまでは 401 が返る。作成に渡すのは、サロン、顧客、担当スタッフ、施術明細（サービス、スタッフ、開始日時）と、内金、要望、メモ、受付経路だけである。終了日時、所要時間、金額、予約番号、来店日はサーバーが決めて返すので、画面で計算した値を送らない。`services[].startTime` は UTC（`Z`）の分単位で送る。作成の 409 は、スタッフがその時間に空いていないことを表す（`detail` にスタッフの ID が入る）。ステータスの操作は、操作のあとの予約を返すので、その値で表示を更新する。操作の 409 は、予約がその操作のできるステータスでないこと（`detail` に、いまのステータスと、操作できるステータスが入る）、または開始日時の前に無断キャンセルを記録しようとしたことを表す。別の画面が先にステータスを変えたときにも返るので、予約を読み直して表示する。どの操作ができるかは、予約の `status` から決まる（[予約台帳](./bookings.md#ステータスの操作)）。キャンセルと完了は本文が必須で、理由や実際の日時を記録しないときも、項目を null で送る。更新に渡すのは、内金、要望、メモ、受付経路のうち、変える項目だけである（値を消すときは null）。ステータスと日時は、更新では変えられない（400）。日時の変更には、新しい開始日時（`startTime`。UTC の分単位）と担当スタッフ（`staffId`）の両方を渡す。担当を変えないときも、いまの担当スタッフを渡す。サーバーが、施術明細を同じ時間だけ動かし、変更前の担当スタッフの明細を新しい担当スタッフに付け替えるので、返ってきた予約で表示を更新する。日時の変更の 409 は、予約が動かせるステータス（`draft`・`pending`・`confirmed`）でないこと、スタッフがその時間に空いていないこと、またはサロンのタイムゾーンをサーバーが知らないことを表す。`staffId` の 400 は、予約のサロンのスタッフでないことを表す。削除の成功は 204 で、本文がない。売上か施術記録が参照する予約の削除は 409 になる（[予約台帳](./bookings.md#削除)）。顧客、スタッフ、サービス、サロンの削除（`useCustomerCrudDelete`、`useStaffCrudDelete`、`useServiceCrudDelete`、`useSalonCrudDelete`）も、終わっていない予約（`draft`・`pending`・`confirmed`・`in_progress`）が参照している間は 409 になる（[予約台帳](./bookings.md#予約が参照するものの削除)）。画面は、予約の一覧を `customerId`・`staffId`・`salonId` と `status` で絞り込んで、妨げている予約を示す。`BookingServiceCrud` のフックは、施術明細の追加（`useBookingServiceCrudCreate`）、1 件の取得（`useBookingServiceCrudGet`）、削除（`useBookingServiceCrudDelete`）である。必要なアクセストークンは `BookingCrud` と同じで、明細の削除は、サロンの `staff` にもできる。追加に渡すのは、作成の `services[]` の 1 件と同じ形（サービス、スタッフ、UTC の分単位の開始日時、メモ）である。追加と削除ができるのは、終わっていない予約（`draft`・`pending`・`confirmed`・`in_progress`）だけで、サーバーが、予約の日時と金額を明細から算出し直す。追加が返すのは明細だけで、削除の成功は 204 なので、どちらのあとも、予約を読み直して表示する。追加の 409 は、予約が終わっていること、明細がすでに 20 件あること、明細が最も早い明細の開始から 24 時間以内に始まらないこと、スタッフがその時間に空いていないこと、金額が上限を超えること、またはサロンのタイムゾーンをサーバーが知らないことを表す。削除の 409 は、予約が終わっていること、予約の最後の明細であること（来店がなくなった予約は、キャンセルする）、またはサーバーが予約を算出し直せないこと（タイムゾーン、金額の上限）を表す。明細を書き換えるフックはない。明細の担当スタッフや開始日時を変えるには、新しい明細を追加してから、古い明細を削除する（[予約台帳](./bookings.md#施術明細の追加と削除)）。
- 空き枠のフックは 2 つある。`useAvailableSlotCrudList` は、サロン、サービス、日付（サロンのタイムゾーンでの日付）を渡すと、スタッフがそのサービスを始められる開始日時の一覧を返す。サインインしていれば、どのロールでも呼べる。`staffId` を渡すと、そのスタッフの枠だけになる。枠は `startTime`（UTC）の早い順で、1 ページは `limit` 件（既定は 20）。続きは `meta.nextCursor` を `cursor` に渡して読む。予約できない日（休業日、サービスを受け付けない日、過ぎた日）は、エラーではなく空の一覧なので、空の状態を表示する。サロンのタイムゾーンをサーバーが知らないときは 409 が返る。`useAvailableSlotCrudCheck` は、スタッフ、サービス、開始日時（UTC の分単位）を渡すと、その時間にスタッフが空いているか（`isAvailable`）と、重なっている予約の ID（`conflicts`）を返す。予約台帳と同じアクセストークンが必要で、顧客のアカウントでは 403 になる。確かめるのはスタッフの占有だけで、営業時間や勤務スケジュールは確かめない。どちらのフックも枠を押さえないので、そのあとの予約の作成が 409 になることがある。そのときは、空き枠を読み直す（[予約台帳](./bookings.md#空き枠)）
- 顧客が自分で入れる予約のフックは 5 つある。どれも、プロフィールのある、ロール `customer` のアカウントのアクセストークンが必要で、ほかのロールでは 403、プロフィールを作る前は 404 になる。`useCustomerBookingsCreate` は、空き枠の一覧の枠を 1 つ渡す（`salonId`、`serviceId`、枠の `staffId` と `startTime`、`customerRequest`。すべて必須で、要望がなければ `customerRequest` は null）。成功は 201 で、予約は `pending`（サロンの確定を待つ）なので、確定した予約としては表示しない。409 は、その時間が空き枠でなくなったこと、同じ時間に自分のほかの予約があること、サロンがこの顧客の予約をオンラインで受け付けていないことのどれかで、`detail` を表示して、空き枠を読み直す。`useCustomerBookingsList`（`status`、`bookingDateFrom`、`bookingDateTo` で絞り込み、`meta.nextCursor` で続きを読む）と `useCustomerBookingsGet` は、どのサロンの予約も、サロンが台帳に入れた予約も返す。レスポンスは `CustomerBookingResponse` で、サロン内のメモ、キャンセルした人と理由は含まない。`useCustomerBookingsCancel` は、`draft`・`pending`・`confirmed` の予約を、開始日時より前にだけキャンセルできる（そのあとは 409）。`useCustomerBookingsReschedule` は、`draft`・`pending`・`confirmed` の予約を、開始日時より前にだけ、別の空き枠に移す（`startTime` と `staffId`。どちらも必須で、担当を変えないときは、いまの `staffId` を渡す）。移せる先は、空き枠の一覧を、予約の明細の `serviceId` と `duration` で読んで出す。成功は 200 で、確定済みだった予約は `pending` に戻る（サロンの確定を待つ表示に戻す）。409 は、枠でなくなった、開始日時を過ぎた、明細が 2 件以上ある（サロンだけが移せる）、などで、`detail` を表示して、空き枠を読み直す。サービスは変えられない。キャンセルして、入れ直す（[予約台帳](./bookings.md#顧客による日時の変更)）
- `endpoints/sales/sales.ts` のフックのうち、サーバーに実装があるのは `useSaleCrudList`、`useSaleCrudCreate`、`useSaleCrudGet`、`useSaleCrudUpdate`、`useSaleCrudVoidSale` の 5 つである。どれも、`admin` か、売上のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。`useSaleCrudVoidSale` は、サロンの `staff` でも 403 になる。`useSaleCrudCreate` には、明細の金額を計算して渡す。サーバーは、明細の `totalAmount` が `quantity` × `unitPrice` − `discountAmount` + `taxAmount` と合わなければ 400 を返し、黙って直さない。売上の `subtotal`、`taxAmount`、`totalAmount`、`saleNumber`、`saleDate` は、サーバーが決めて返す。400 の `errors` の `field` は、`details.0.totalAmount` のように、明細の番号を含む。409 は、その予約に取り消していない売上がすでにあるか、サロンのタイムゾーンをサーバーが知らないことを表す。一覧は会計日時の新しい順で、取り消した売上も含む。`useSaleCrudUpdate` には、変える項目だけを渡す。`details` を渡すと、明細の全体が置き換わり、売上の金額が計算し直されるので、残す明細も含める。取り消した売上の更新と、支払い状態が `pending` でない売上の `details` は 409 になる。`useSaleCrudVoidSale` の本文は `voidReason` だけで（null でもよいが、キーは必須）、取り消し済みの売上と、返金していない支払いがある売上は 409 になる。取り消しは、元に戻せない（[売上台帳](./sales.md)）。`useSaleCrudProcess` は、受け取った支払いを記録する（本文は `paymentMethodId`、`amount`、`cardLastFour`、`cardBrand` で、どのキーも必須。カードの 2 項目は、支払い方法の区分が `credit_card` か `debit_card` でなければ null）。決済代行会社とは接続していないので、お金を受け取ってから呼ぶ。分けて支払うときは、もう一度呼ぶ。`amount` が未払い残額を超えると 400、取り消した売上、返金のある売上、未払い残額のない売上は 409 になる。レスポンスは決済取引（`PaymentResponse`）なので、売上の `paymentStatus` と `payments` は、売上を読み直して表示する。`endpoints/payments/payments.ts` の `usePaymentCrudRefund` は、`completed` の決済取引を 1 回だけ返金する（本文は `refundAmount` と `refundReason` で、どちらのキーも必須）。`staff` では 403、`completed` でない決済取引（返金済みを含む）は 409 になる（[支払い](./payments.md)）。`useSaleCrudGetReceipt` は、売上のレシートを返す（`receiptNumber` は売上番号、`sale` は 1 件の取得と同じ売上、`issuedAt` は作った時刻）。レシートは保存されないので、印刷し直すときも、もう一度呼ぶ。取り消した売上と、受け取った金額が合計金額に達していない売上は 409 になる。`useSaleCrudCalculate` は、売上を入れる前に金額を計算する（本文は `salonId`、`bookingId`（予約がなければ null）、`services`（加えるサービスの ID。加える数だけ書く）で、どのキーも必須）。何も書かない。`breakdown` は売上と同じ名前の金額（`subtotal`、`discountAmount`、`taxAmount`、`totalAmount`）、`recommendedMethods` は合計金額を 1 回で受け取れる支払い方法の種類である。サロンのものでない予約やサービスと、数える明細がないリクエストは 400 になる。売上の作成は、計算の結果と比べないので、作成には明細の金額を渡す（[売上台帳](./sales.md#金額の計算)）。`endpoints/sales-reports/sales-reports.ts` のフック（`useSalesReportCrudGet`、`useSalesReportCrudGetDaily`、`useSalesReportCrudGetByStaff`、`useSalesReportCrudGetByCategory`、`useSalesReportCrudGetTrends`、`useSalesReportCrudExport`）は、すべて使える。使えるのは `admin` と、サロンの `owner`・`manager` で、`staff` は 403 になる。クエリの `salonId` と期間（`startDate`、`endDate`。`YYYY-MM-DD`。両方とも必須で、366 日まで）に既定値はないので、「今月」などは、サロンのタイムゾーンの日付にして渡す。存在しないサロンは 400（`salonId` の `not_found`）になる。`percentage` は小数第 1 位までで、行の合計が 100 にならないことがある（[売上レポート](./sales-reports.md)）。`salesReportCrudExport` は、期間の売上の CSV を、文字列のまま `data` に返す（`fetcher` は、JSON でない本文を文字列で返す）。ダウンロードさせるには、`new Blob([data], { type: 'text/csv' })` にして、`Content-Disposition` の名前（`sales-report-<startDate>-<endDate>.csv`）を付ける。サーバーは、ファイルを保存しない。`endpoints/points/points.ts` のフックのうち、サーバーに実装があるのは、残高、履歴、付与、利用、調整の 5 つ（`usePointCrudGetBalance`、`usePointCrudListTransactions`、`usePointCrudEarn`、`usePointCrudUse`、`usePointCrudAdjust`）で、有効期限が近いポイント（`usePointCrudGetExpiring`）と失効（`usePointCrudExpire`）は 404 になる。使えるのは `admin` と、どのサロンの `owner`・`manager`・`staff` も（調整は `staff` には 403）で、顧客のアカウントは 403 になる。残高は、顧客のプロフィール（`/api/v1/customers/me`）の `loyaltyPoints` でも読める。付与と利用は、会計を記録したあとで、その売上を `referenceType: 'sale'` と `referenceId` で参照して送る。同じ記録への 2 回目の付与と利用、取り消した売上、残高を超える利用は 409 になる（[ポイント台帳](./points.md)）
- `endpoints/payment-methods/payment-methods.ts` の 5 つのフック（`usePaymentMethodCrudList`、`usePaymentMethodCrudCreate`、`usePaymentMethodCrudGet`、`usePaymentMethodCrudUpdate`、`usePaymentMethodCrudDelete`）は、サーバーに実装がある。サロンが受け付ける支払い方法の設定で、どれも、パスに `salonId` を渡す。読む 2 つは、`admin` か、そのサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、作成、更新、削除は、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる（顧客に見せる支払い方法の一覧は、まだない）。作成には、すべてのキーを渡す（値がないものは null）。更新には、変える項目だけを渡す。`method` は、作成のあとで変えられず、更新に渡すと 400 になる。`minimumAmount` が `maximumAmount` より大きくなる作成と更新は 400 で、片方だけを渡した更新では、渡した項目の `errors` になる。削除の 409 は、その支払い方法を指す支払いがあることを表す。画面は、削除の代わりに、`isActive` を false にする更新を勧める。一覧は `sortOrder` の順で、使っていないものも含む。使っているものだけを読むには、`isActive: true` を渡す（[支払い](./payments.md)）
- 未実装のドメイン（Review、Inventory など）のフックは生成されていても呼ばない。サーバーが 404 を返す。`endpoints/services/services.ts` のフックは、カテゴリーのもの（`useServiceCategoryCrudList` など）も、サービスのもの（`useServiceCrudList` など）も、サーバーに実装がある
- `endpoints/customers/customers.ts` のフックのうち、サーバーに実装があるのは、一覧、登録、1 件の取得、更新、削除の 5 つ（`useCustomerCrudList`、`useCustomerCrudCreate`、`useCustomerCrudGet`、`useCustomerCrudUpdate`、`useCustomerCrudDelete`）だけである。どれも `admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で（削除は `staff` を除く）、フックはトークンを送らないので、フロントエンドの認証を実装するまでは 401 が返る。顧客本人のプロフィールの 3 つ（`useCustomerProfileGet`、`useCustomerProfileCreate`、`useCustomerProfileUpdate`）にも実装があり、ロール `customer` のアクセストークンが必要である。好み設定の 4 つにも実装がある。台帳を扱うユーザーのための `useCustomerCrudGetPreferences(id)` と `useCustomerCrudUpdatePreferences`、顧客本人のための `useCustomerProfileGetPreferences` と `useCustomerProfileUpdatePreferences`（引数に ID はなく、どの顧客かはトークンが決める）である。何も設定していない顧客にも、200 で空の好み設定（一覧は `[]`、ほかは null）が返るので、404 を「未設定」として扱わない。台帳のフックの 404 は顧客がいないことを、本人のフックの 404 はプロフィールをまだ作っていないことを表す。更新には変える項目だけを渡し、`stylePreferences` は 4 項目をまとめて渡す。保存されているスタッフの ID は、そのスタッフが削除されても残るので、画面は、スタッフのプロフィール（`useStaffProfileGet`）が 404 のスタッフを表示しない。顧客のそれ以外のフック（`useCustomerCrudExport`、`useCustomerCrudMerge` など）は、サーバーに実装がないので呼ばない
- `endpoints/staff/staff.ts` のフックのうち、サーバーに実装があるのは、台帳の一覧、登録、1 件の取得、更新、削除の 5 つ（`useStaffCrudList`、`useStaffCrudCreate`、`useStaffCrudGet`、`useStaffCrudUpdate`、`useStaffCrudDelete`）、勤務スケジュールの一覧と更新の 2 つ（`useStaffSchedulesList`、`useStaffSchedulesUpdate`）、招待の取得、作成、取り消しの 3 つ（`useStaffInvitationsGet`、`useStaffInvitationsCreate`、`useStaffInvitationsDelete`）、アカウントの取得、ロールの変更、紐づけの解除の 3 つ（`useStaffAccountsGet`、`useStaffAccountsUpdate`、`useStaffAccountsDelete`）、プロフィールの一覧と 1 件の取得の 2 つ（`useStaffProfileList`、`useStaffProfileGet`）、本人のプロフィールの取得と更新の 2 つ（`useStaffOwnProfileGet`、`useStaffOwnProfileUpdate`）で、このファイルのフックのすべてである。台帳の 5 つは、どれも `admin` か、そのサロンの `owner` のアクセストークンが必要で、レスポンスは給与と個人の連絡先を含むので、顧客に見せる画面には使わない。顧客に見せる画面は、認証なしで呼べるプロフィールの 2 つを使う。1 つのサロンのスタッフは `useStaffProfileList({ salonId })` で読む。本人のプロフィールの 2 つは、サロンに届く `owner`・`manager`・`staff` のアクセストークンが必要で、どのスタッフかはトークンが決める（引数に ID はない）。`useStaffOwnProfileUpdate` には、変える項目だけを渡す。渡せるのは `specialties`、`bio`、`imageUrl`、`yearsOfExperience`、`certifications` の 5 つで、`displayName` などの台帳の項目を渡すと 400 になる。レスポンスの `links.profile` は、顧客が同じプロフィールを読むパスである。勤務スケジュールの 2 つは、`admin` か、そのサロンの `owner`・`manager` のアクセストークンが必要で、`staff` は自分のスケジュールだけを `useStaffSchedulesList` で読める。`useStaffSchedulesUpdate` は、送った配列でスケジュール全体を置き換えるので、1 行だけを変える画面も、読んだ全体に変更を加えて送る（読んだ `data` は、そのまま本文にできる）。`useStaffSchedulesList(salonId, id, { date })` は、その日付に適用される行だけを返し、`data` は 0 個か 1 個である。スケジュールは顧客に見せる画面には使わない。招待の 3 つは、台帳と同じく `admin` か、そのサロンの `owner` のアクセストークンが必要である。`useStaffInvitationsCreate` は、スタッフに、ログインアカウントを作るためのリンクをメールで送る（本文はアカウントのロールだけで、宛先は台帳のメールアドレス）。`useStaffInvitationsGet` の 404 は、スタッフが招待を持っていないことを表す。招待されたスタッフがリンクから開く画面（`/accept-staff-invitation`）は、URL のフラグメントからトークンを取り出し、`endpoints/authentication/authentication.ts` の `useAuthCrudVerifyStaffInvitation` で招待の内容（宛先とロール）を表示する。次に何をするかは、そのレスポンスの `links` で決める。`links.accept` があれば、パスワードを尋ねて、`useAuthCrudAcceptStaffInvitation` でトークンと新しいパスワードを送る。どちらもアクセストークンは要らない。受け入れのあと、スタッフは、招待の宛先のメールアドレスとそのパスワードでログインする。`links.join` があれば、その宛先のスタッフのアカウントがすでにあるので、パスワードは尋ねず、そのアカウントでのログインを求めてから、`useAuthCrudJoinStaffInvitation` でトークンを送る（アクセストークンが要る）。参加のあと、同じアクセストークンのまま、新しいサロンの画面を開ける。409 は、ログインしているアカウントがすでにサロンに属しているか、招待の宛先と違うメールアドレスのアカウントであることを表す（`detail` で区別する）。アカウントの 3 つは、台帳と同じく `admin` か、そのサロンの `owner` のアクセストークンが必要である。`useStaffAccountsGet` の 404 は、スタッフにアカウントがないことを表す（まだ招待を受け入れていないか、紐づけを解除した）。`useStaffAccountsUpdate` の本文はロールだけで、`owner` を指定できるのは `admin` である。`useStaffAccountsDelete` は、アカウントを消さずに、スタッフとの紐づけだけを外す。ロールの変更と紐づけの解除は、そのアカウントの次のリクエストから効くので、操作した側の画面は、アカウントを読み直して表示する

## テスト

フロントエンドのテストは Vitest の単体テストです（`pnpm test:frontend`）。パッケージをまたぐ import はソースから解決するので（エクスポート条件 `@beauty-salon-frontend/source`）、ビルドなしで実行できます。

- 各アプリの `src/App.test.tsx`: `MemoryRouter` で画面を描画し、表示内容を検証する
- `config` と `ui` の各パッケージ: モジュールの隣に `*.test.ts(x)`
- `io` の `src/libs/fetcher/fetcher.test.ts`: `customInstance` を、スタブにした `fetch` に対して検証する（URL、本文、ステータスごとの戻り値、problem details、reject する条件）
- `api-client` の `src/salons.test.ts`: 生成された Salon の関数を、実際の `customInstance` を通して検証する（リクエストの形、ステータスごとに型が絞られること、通信の失敗、TanStack Query との組み合わせ）

API のモックサーバーと、ブラウザーから API までを通すテストはありません。

## 関連ドキュメント

- [Type Generation System](./type-generation-system.md)
- [OpenAPI TypeScript 型利用ガイド](./openapi-typescript-usage.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [認証と認可](./authentication.md)
- [Architecture Overview](./architecture-overview.md)
