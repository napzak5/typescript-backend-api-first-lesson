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
- Salon、サロンのサービスカテゴリーとサービス、顧客台帳、予約台帳、スタッフ台帳、スタッフの勤務スケジュール、スタッフの招待、スタッフのアカウント、スタッフのプロフィール、認証、システムエンドポイント以外のバックエンド実装（クライアントは OpenAPI の全操作について生成されるが、サーバーが応答するのは `/api/v1/salons` と `/api/v1/salons/{id}`、`/api/v1/salons/{salonId}/service-categories` 以下、`/api/v1/salons/{salonId}/services` 以下、`/api/v1/customers` と `/api/v1/customers/{id}`（顧客の一覧、登録、1 件の取得、更新、削除）、`/api/v1/customers/me`（顧客本人のプロフィールの取得、作成、更新）、`/api/v1/customers/{id}/preferences` と `/api/v1/customers/me/preferences`（顧客の好み設定の取得、更新）、`/api/v1/bookings` と `/api/v1/bookings/{id}`（予約の一覧、作成、1 件の取得）、`/api/v1/salons/{salonId}/staff` と `/api/v1/salons/{salonId}/staff/{id}`（スタッフの一覧、登録、1 件の取得、更新、削除）、`/api/v1/salons/{salonId}/staff/{id}/schedules`（スタッフの勤務スケジュールの一覧、更新）、`/api/v1/salons/{salonId}/staff/{id}/invitation`（スタッフの招待の取得、作成、取り消し）、`/api/v1/salons/{salonId}/staff/{id}/account`（スタッフに紐づいたアカウントの取得、ロールの変更、紐づけの解除）、`/api/v1/staff-profiles` と `/api/v1/staff-profiles/{id}`（顧客に見せるスタッフのプロフィールの一覧、1 件の取得）、`/api/v1/staff-profiles/me`（スタッフ本人のプロフィールの取得、更新）、`/api/v1/auth` 以下、`/api/v1/admin/auth` 以下、および `/api/system/alive`、`/api/system/ready`、`/api/system/health` だけ。`/api/v1/salons/{salonId}/available-slots` など、サロンの下にあるほかのルート、`/api/v1/customers/{id}/history` など顧客のほかのルート、`/api/v1/bookings/{id}/confirm` など予約のほかのルートには応答しない）

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
- `endpoints/bookings/bookings.ts` のフックのうち、サーバーに実装があるのは、一覧、作成、1 件の取得の 3 つ（`useBookingCrudList`、`useBookingCrudCreate`、`useBookingCrudGet`）だけである。どれも `admin` か、予約のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。フックはトークンを送らないので、フロントエンドの認証を実装するまでは 401 が返る。作成に渡すのは、サロン、顧客、担当スタッフ、施術明細（サービス、スタッフ、開始日時）と、内金、要望、メモ、受付経路だけである。終了日時、所要時間、金額、予約番号、来店日はサーバーが決めて返すので、画面で計算した値を送らない。`services[].startTime` は UTC（`Z`）の分単位で送る。409 は、スタッフがその時間に空いていないことを表す（`detail` にスタッフの ID が入る）。予約のそれ以外のフック（`useBookingCrudUpdate`、`useBookingCrudConfirm`、`useBookingServiceCrudCreate`、`useAvailableSlotCrudList` など）は、サーバーに実装がないので呼ばない
- 未実装のドメイン（Review、Payment など）のフックは生成されていても呼ばない。サーバーが 404 を返す。`endpoints/services/services.ts` のフックは、カテゴリーのもの（`useServiceCategoryCrudList` など）も、サービスのもの（`useServiceCrudList` など）も、サーバーに実装がある
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
