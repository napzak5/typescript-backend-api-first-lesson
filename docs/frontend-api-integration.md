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
- 認証（バックエンドに認証・認可の実装がなく、`customInstance` にも `Authorization` ヘッダーを付ける仕組みはない）
- API のモックサーバーと、ブラウザーから API までを通すテスト
- Salon とシステムエンドポイント以外のバックエンド実装（クライアントは OpenAPI の全操作について生成されるが、サーバーが応答するのは `/api/v1/salons` 以下と `/api/system/alive`、`/api/system/ready`、`/api/system/health` だけ）

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
| `types` | `ApplicationError` とエラー表示の補助、ページ番号方式の `Pagination` 型 | なし |
| `utils` | 日付、ファイル、書式、クエリ文字列などの汎用関数 | `types`、`validations` |
| `validations` | 入力値の検証関数。結果は `neverthrow` の `Result`（例: `validateEmail` は `Result<Email, z.ZodError>` を返す） | なし |
| `message` | 画面に出す日本語メッセージ（`messageFactory`） | なし |
| `stores` | `localStorage` のラッパー | なし |
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

fetch 関数の戻り値の型は、ステータスコードで判別できるユニオンです。API のエラーは例外ではなく値として表されています。サーバーがどのルートでも返す 429 と 500、本文を受け取るオペレーションの 413 と 415 もユニオンに含まれます（`salons.ts` より）。

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

一覧はキーセット方式のページネーションです。次のページは `SalonCrudList200` の `meta.nextCursor` を `cursor` に渡して取得します。`types` パッケージの `Pagination` 型（`page` / `per_page` / `total`）はこの API の形ではありません。

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
- `Authorization` などの共通ヘッダーを付ける仕組みはありません。認証を実装するときに設計します

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

以下は、最初の画面を API につなぐときの手順と推奨です。リポジトリにはまだ存在しません。対象は実装済みの Salon API です。

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
- 登録・更新・削除は `useSalonCrudCreate` などのミューテーションフックを使い、結果も同じく `status` で分岐する。成功したら `getSalonCrudListQueryKey()` を使って一覧のキャッシュを無効化する
- フォームの入力検証は `@beauty-salon-frontend/validations`（`neverthrow` の `Result` を返す）で行い、サーバーの検証エラーは `ModelsProblemDetails` の `errors` から表示する
- 429 のときは、レスポンスの `headers` から `Retry-After`（秒）を読める
- 未実装のドメイン（Customer、Booking など）のフックは生成されていても呼ばない。サーバーが 404 を返す

## テスト

フロントエンドのテストは Vitest の単体テストです（`pnpm test:frontend`）。パッケージをまたぐ import はソースから解決するので（エクスポート条件 `@beauty-salon-frontend/source`）、ビルドなしで実行できます。

- 各アプリの `src/App.test.tsx`: `MemoryRouter` で画面を描画し、表示内容を検証する
- `config`、`message`、`stores`、`types`、`ui`、`utils`、`validations` の各パッケージ: モジュールの隣に `*.test.ts(x)`
- `io` の `src/libs/fetcher/fetcher.test.ts`: `customInstance` を、スタブにした `fetch` に対して検証する（URL、本文、ステータスごとの戻り値、problem details、reject する条件）
- `api-client` の `src/salons.test.ts`: 生成された Salon の関数を、実際の `customInstance` を通して検証する（リクエストの形、ステータスごとに型が絞られること、通信の失敗、TanStack Query との組み合わせ）

API のモックサーバーと、ブラウザーから API までを通すテストはありません。

## 関連ドキュメント

- [Type Generation System](./type-generation-system.md)
- [OpenAPI TypeScript 型利用ガイド](./openapi-typescript-usage.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [Architecture Overview](./architecture-overview.md)
