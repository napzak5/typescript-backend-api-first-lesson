# フロントエンドAPI統合ガイド（Orval）

このドキュメントは、フロントエンドが API とつながるために現在リポジトリにあるものと、まだないものを説明します。コードは実ファイルからの抜粋で、コメントは省いています（「アプリから使う」の節のサンプルだけは本書のために書いたものです）。

## 現状

**3つのフロントエンドアプリにある画面は、サインインと、アプリの枠だけです。** 業務の画面（予約、顧客台帳、会計など）は、まだありません。API を呼ぶための土台（生成クライアント、fetch ラッパー、セッション）はあります。`src/App.tsx` が、共有の枠（`ui` の `AppShell`。アプリ名とアカウント欄のヘッダー、本文へ移動するリンク、本文）の中に、「画面は準備中です。」と表示するトップページと、存在しないパスのためのページを持ち、サインインしていない人にはサインインの画面を出します（[画面とサインイン](#画面とサインイン)）。

あるもの:

- OpenAPI ドキュメントから Orval が生成した API クライアント（`@beauty-salon-frontend/api-client`）。型、fetch 関数、TanStack Query のフックを含む
- そのクライアントが HTTP 呼び出しに使う fetch ラッパー（`@beauty-salon-frontend/io` の `customInstance`）。生成コードが期待するとおりに動くことを、テストと実際のサーバーへの呼び出しで確認している
- セッション: ブラウザーに保存したトークンをリクエストに付け、期限が切れたら再発行して送り直す仕組み（`io`）と、サインインしているのがだれかを返すフック、サインインとサインアウト、サインインの画面、サインインが要る画面の出し分け、ヘッダーのアカウント欄（`@beauty-salon-frontend/session`）。[セッション](#セッション)を参照
- 各アプリの TanStack Query の初期設定（`QueryClientProvider`）
- UI の土台: デザイントークン（`@beauty-salon-frontend/theme`）、CSS Modules で書いた共有コンポーネントとそのカタログ（`@beauty-salon-frontend/ui`、Storybook）、テストが共有する道具（`@beauty-salon-frontend/testing`）。[UI とテストの規則](#ui-とテストの規則)を参照
- 環境変数 `VITE_BACKEND_BASE_URL`（API サーバーのオリジン）

ないもの:

- 生成クライアントを使う業務の画面（いま API を呼ぶ画面は、サインインとサインアウトだけ）
- ユーザー登録、メールアドレスの確認、パスワードの再設定、スタッフの招待の受け入れ、2 要素認証の設定、セッションの一覧の画面
- API のモックサーバー（画面のテストは、jsdom からも、実際のブラウザーからも、実際の API を呼ぶ。[テスト](#実際の-api-と-db-を使うテストpnpm-testintegration)）
- 共有リンクを開く画面（サーバーには、共有リンクのオペレーションがすべてある。クライアントは OpenAPI の全オペレーションについて生成され、そのすべてに、サーバーの実装がある）

## 構成

### アプリ

| アプリ | ディレクトリ | 開発サーバーのポート |
|--------|--------------|----------------------|
| portal-app | `frontend/apps/portal-app` | 3001 |
| admin-app | `frontend/apps/admin-app` | 3002 |
| dashboard-app | `frontend/apps/dashboard-app` | 3003 |

いずれも Vite 8 + React 19 + react-router 8 の SPA です。ワークスペースのパッケージで依存しているのは `@beauty-salon-frontend/ui`、`@beauty-salon-frontend/theme`、`@beauty-salon-frontend/session`、それにテストのための `@beauty-salon-frontend/testing` だけです。

### 共有パッケージ（`frontend/packages/`）

| パッケージ | 役割 | 使っているもの |
|------------|------|----------------|
| `api-client` | Orval の生成物（`src/generated/`）と、その再エクスポート | `session` |
| `io` | fetch ラッパー `customInstance` と、ブラウザーに保存するセッション `sessionStore` | `api-client`、`session` |
| `session` | アプリのセッション: 状態を返すフック `useSession`、`signIn`、`signOut`、ユーザーが替わったときに取得済みのデータを消す `keepQueriesOfOneUser`、サインインが要る画面を囲む `RequireSession`（サインインの画面を含む）、ヘッダーのアカウント欄 `SessionAccount` | 3つのアプリ（`src/main.tsx`、`src/App.tsx`） |
| `config` | `import.meta.env` を読む `env` オブジェクトと、モード判定関数（`isProductionMode` など） | `io`、`ui`（型のみ） |
| `theme` | デザイントークン（`src/tokens.css`）、リセットと素の要素のスタイル、スタイルの規則の検査（`src/style-rules.ts`） | 3つのアプリ、`ui`（カタログとテスト） |
| `ui` | 共有コンポーネント（`Button`、フォームの部品 `TextField`・`TextArea`・`Select`・`RadioGroup`・`Checkbox`、メッセージの `Alert`、画面の骨組みの部品 `AppShell`・`Navigation`・`PageHeader`・`Card`・`DescriptionList`・`Badge`・`Table`・`EmptyState`・`LoadingIndicator`・`Dialog`、リンクの `LinkProvider`・`ButtonLink`、通知の `NotificationProvider`・`useNotifications`、`EnvironmentBanner`）、クラス名をつなぐ `classNames`、カタログ（Storybook。`session` のストーリーも表示する） | 3つのアプリ、`session` |
| `testing` | テストが共有するもの: jest-dom のマッチャー、jsdom にない `dialog` 要素のメソッド（`showModal`・`close`）、アクセシビリティの検査（axe-core）、ストーリーごとにその検査を宣言する関数、実際の API を使うテストの仕組み（`testing/api`） | `ui`、`session`、3つのアプリのテスト、`frontend/e2e` |
| `assets` | 画像アセット | なし |

アプリが直接使っているのは `ui`、`theme`、`session` です（`ui` は `config` から型を1つ借りています）。`api-client` と `io` は、`session` を通して使われています。

実際のブラウザーで通すテスト（`@beauty-salon-frontend/e2e`）は、`frontend/e2e` にあります。`testing` から、テスト用のサーバーを呼ぶコードと、アクセシビリティの検査の規則を使います。

アプリのビルド（`vite build`）は、`api-client`、`io`、`session`、`config`、`ui`、`assets` を、rslib でビルドした `dist/` を通して参照します。`theme` と `testing` はビルドせず、ソースのまま参照されます。`ui` のコンポーネントは自分のスタイルシートを自分で読み込むので、アプリが読み込むスタイルシートは `theme` の 1 つだけです（`src/main.tsx`）。アプリの開発サーバーとテストは、エクスポート条件 `@beauty-salon-frontend/source` を持つパッケージ（`ui`、`io`、`config`、`api-client`、`session`）をソースから読みます。コンポーネントの変更は、パッケージのビルドを待たずに画面に出ます。`pnpm dev` は最初にフロントエンドのパッケージをビルドしてから、各パッケージの監視ビルドと各アプリの開発サーバー（とバックエンド）を起動します。テストはビルドを必要としません（[テスト](#テスト)）。

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
- セッションが保存されていれば、`Authorization: Bearer <アクセストークン>` を付ける。期限切れの 401 には、セッションを再発行して、同じリクエストを 1 回だけ送り直す（[セッション](#セッション)）
- タイムアウトは 30 秒。呼び出し側が渡した `signal` があれば、それとタイムアウトのどちらでも中断される

レスポンス:

- **どの HTTP ステータスでも** `{ data, status, headers }` で resolve する。API のエラー応答は reject ではなく値で、呼び出し側が `status` で分岐する
- `data` は、`Content-Type` が `application/json` か `+json`（エラーの `application/problem+json`）なら JSON として読んだ値、本文が空（204）なら `undefined`、それ以外は文字列
- reject するのは、返すレスポンスがないときだけ: ネットワークの失敗、`signal` またはタイムアウトによる中断、`Content-Type` が JSON なのに本文が JSON として読めない、`VITE_BACKEND_BASE_URL` が設定されていない

知っておくべき制約:

- 型引数 `T` は生成コードがその操作について指定するレスポンスの型で、**実行時に本文を `T` と照合してはいません**。クライアントとサーバーが同じ OpenAPI ドキュメントから生成されていることが、型と実際の値が一致する根拠です
- JSON 以外の本文は文字列で返します。ファイルを返す操作のうち、売上レポートと台帳の CSV は文字列、顧客のデータの出力は JSON として読んだ値です。本文は `response.text()` で読むので、台帳の CSV の先頭の BOM は取り除かれます。ファイルとして保存させるときは、BOM を付け直します。ファイル名は `Content-Disposition` にありますが、`data` には入りません。バイナリを返す操作はありません
- `Authorization` ヘッダーは、この関数が付けます。呼び出し側が渡すものではありません。サインインしている間は、認証なしのオペレーション（サロンの一覧など）にも付きます。送り先は、いつも `VITE_BACKEND_BASE_URL` の API です

## セッション

サーバーのセッションは、アクセストークン（15 分）とリフレッシュトークンです（[認証と認可](./authentication.md#セッション)）。この節は、ブラウザーの側の決まりです。

### 保存（`io` の `sessionStore`）

実装は `frontend/packages/io/src/libs/session/stored-session.ts` です。

- 2 つのトークンと、その持ち主のユーザーの ID を、`localStorage` の 1 つのキー（`beauty-salon:session`）に、1 つの値として保存する。別々のキーに書くと、ほかのタブが、片方だけ新しい状態を読むことがあるため
- 値の形はクエリ文字列で、`URLSearchParams` で読む（読めない値に例外を投げないパーサー）。3 つの値がそろっていなければ、セッションがないものとして扱う
- `subscribe` で変更を購読できる。同じタブでの変更と、ほかのタブでの変更（`storage` イベント）の両方が伝わる。あるタブでサインアウトすると、ほかのタブもサインアウトの状態になる
- ブラウザーが `localStorage` へのアクセスを拒むとき（サイトのデータを保存させない設定の訪問者）は、セッションがないものとして扱う。サインインの要らない呼び出しは、そのまま行える。保存はできないので、その訪問者はサインインできない

`localStorage` に置く理由: API は、トークンを本文で受け渡しします（Cookie は使いません）。ページを読み込み直してもサインインが続くには、リフレッシュトークンを、スクリプトから読める場所に置く必要があります。そこに置く以上、アクセストークンをメモリだけに置いても、守れるものは増えません。備えは、トークンの側にあります。アクセストークンは 15 分で切れ、リフレッシュトークンは 1 回しか使えず、セッションは一覧から無効にできます。`rememberMe` で保存先を変えることはしません。セッションの長さは、サーバーが決めます。

### 401 の扱い（`io` の `customInstance`）

| API の応答 | すること |
|---|---|
| 401、コード `1003`（アクセストークンの期限切れ） | セッションを再発行し、同じリクエストを、新しいトークンで 1 回だけ送り直す。呼び出し側に返るのは、送り直した結果 |
| 401、コード `1004`（トークンに対応するセッションがない） | 保存されているトークンが、送ったものと同じなら、セッションを消す（サインアウトの状態になる）。違っていれば、送ったあとに再発行で替わったトークンなので、新しいトークンで 1 回だけ送り直す |
| そのほかの 401（ヘッダーなしの `1001`、サインインの失敗の `1002`、2 要素認証のコードの要求の `1007` など） | そのまま返す |

再発行（`frontend/packages/io/src/libs/session/renew-session.ts`）:

- **同時に 1 つだけ行う。** API は、リフレッシュトークンを 1 回しか受け付けず、再発行すると、それまでのトークンは使えなくなるため。同じページの中では、期限切れを受け取ったリクエストが、1 つの再発行を共有する。タブの間では、Web Locks API（`navigator.locks`）で順番に行う
- 再発行の前に、保存されているセッションを読み直す。ほかのリクエストやタブがすでに替えていれば、通信せずにそれを使う
- API が断ったら（401）、セッションを消す。呼び出し側には、元の 401 が返る。ただし、その時点で、保存されているセッションが別のものに替わっていれば（Web Locks のないブラウザーで、ほかのタブが先に再発行した）、消さずに、それで送り直す
- 通信の失敗、401 以外のステータス、読めない応答では、セッションを消さない。呼び出し側には、元の 401 が返る。次のリクエストが、もう一度再発行を試みる
- 期限の前に、先回りして再発行することはしない。期限切れの 401 を受けてから行う
- 再発行のリクエストは、`customInstance` が自分で送る（生成クライアントが `customInstance` を呼ぶので、その逆はできない）。再発行のパスと、2 つのエラーコードは `io` が持ち、`api-client` の `src/session.test.ts` が、生成されたものと同じであることを確かめる
- 応答から読むのは、エラーコードと、再発行の応答の 2 つのトークンとユーザーの ID だけ。形は `zod/mini` で確かめる（`zod` の全体は、アプリのバンドルに入れない）

### アプリのセッション（`@beauty-salon-frontend/session`）

```typescript
// frontend/packages/session/src/use-session.ts
export type Session =
  | { type: 'loading' }
  | { type: 'signedOut' }
  | { type: 'signedIn'; user: ModelsUserResponse }
  | { type: 'unavailable'; retry: () => void }

export const useSession = (): Session
```

- **サインインしているかどうか**は、保存されているセッションから決まる。どのタブでも同じになる
- **だれであるか**は、`GET /api/v1/auth/me` に尋ねる。尋ねるのは、ユーザーごと・ページの読み込みごとに 1 回で、フックを使うコンポーネントがいくつあっても変わらない。結果は古くならない（`staleTime` は無限）ので、あとから起きた一時的な失敗で、表示中の画面が消えることはない。ユーザーの内容を変える操作のあとは、`getAuthCrudGetCurrentUserQueryKey()` のクエリを無効にする。画面を保ったまま、取得し直す
- `unavailable` は、セッションはあるのに、API がだれのものかを答えなかった状態（応答がない、500、429 など）。`retry` で尋ね直す
- `signIn(request)` は、API が受け付けたら（200）セッションを保存する。戻り値は、画面が分岐するための直和型 `SignInOutcome` で、`signedIn`、`wrongCredentials`（401 の `1002`）、`twoFactorCodeRequired`（401 の `1007`）、`invalid`（400。`fields` に、API が受け付けなかった項目の名前）、`tooManyAttempts`（429）、`notStored`（API は受け付けたが、ブラウザーが保存を拒んだ。サインインしていない状態のまま）、`failed`（応答がない、500 など）のどれか
- `signOut()` は、API にセッションの終了を伝えてから、ブラウザーのセッションを消す。API がエラーを返しても、届かなくても、消す（共用のパソコンでサインアウトした人が、通信の失敗でサインインしたままにならないように）。そのとき、サーバーのセッションは期限まで残る
- `keepQueriesOfOneUser(queryClient)` は、保存されているユーザーが替わったとき（サインアウト、別の人のサインイン。ほかのタブでのものを含む）に、取得済みのデータをすべて消す。次にサインインした人に、前の人のデータを見せないため。同じユーザーのトークンの再発行では消さない。3つのアプリの `src/main.tsx` が、`QueryClient` を作ったところで呼んでいる

### 画面とサインイン

サインインに関わる画面の部品は、`session` パッケージにあります。3つのアプリの `src/App.tsx` が使います。

```tsx
// frontend/apps/admin-app/src/App.tsx
const ROLES: RequireSessionProps['roles'] = ['owner', 'manager', 'staff', 'admin']

<NotificationProvider>
  <AppShell title={import.meta.env.VITE_APP_TITLE} account={<SessionAccount />}>
    <RequireSession roles={ROLES}>
      <Routes>…</Routes>
    </RequireSession>
  </AppShell>
</NotificationProvider>
```

`RequireSession` は、囲んだ画面を、`roles` のどれかのロールでサインインしている人にだけ見せます。

| セッションの状態 | 表示 |
|---|---|
| サインインしていない | サインインの画面。**アドレスは変えない**（リダイレクトしない）ので、サインインすると、開こうとしていた画面がそのまま出る |
| だれであるかを確かめている | 「サインインを確認しています」 |
| サインインしていて、ロールが `roles` にある | 囲んだ画面 |
| サインインしていて、ロールが `roles` にない | 「このアプリケーションは利用できません」と、サインアウトのボタン |
| API がだれであるかを答えなかった | 「サインインを確認できません」と、「もう一度試す」のボタン |

| アプリ | 使えるロール |
|---|---|
| portal-app | サインインなしで見られる（いまあるトップページと、存在しないパスのページ）。サインインの画面は `/sign-in` にあり、どのロールでもサインインできる。サインインすると、トップページへ移る。顧客だけの画面は、その画面を `RequireSession roles={['customer']}` で囲む |
| admin-app | `owner`、`manager`、`staff`、`admin`。すべての画面にサインインが要る |
| dashboard-app | `owner`、`manager`、`admin`。すべての画面にサインインが要る |

これは、画面を見せるかどうかの決まりです。操作を許すかどうかは、リクエストごとに API が決めます（[認可](./authentication.md#認可)）。

- **サインインの画面**（`SignInScreen`、フォームは `SignInForm`）は 2 段階。メールアドレスとパスワードを送り、API が 2 要素認証のコードを求めたら（401 の `1007`）、コードの入力に替わる（認証アプリの 6 桁のコードか、バックアップコード）。「30 日間サインインしたままにする」は `rememberMe` で、セッションの長さを決めるのはサーバー
- **断られたとき**は、メールアドレスとパスワードのどちらが誤っているかを言わない（API が区別しないため）。5 回続けて誤ると 15 分ロックされることを、同じメッセージで伝える。コードが誤っていたときは、コードの欄にそう表示する
- **フォームの値**は、ブラウザーが持つ（`value` を React の状態にしない）。送信のときに `FormData` として読み、純粋な関数 `readAttempt`（`sign-in-screen/sign-in-flow.ts`）が確かめる。空の欄と、メールアドレスの形でない値は、API に送らずに、その欄にメッセージを出す。API の応答からフォームの状態を決めるのも、純粋な関数 `afterAttempt`。送信は TanStack Query の `useMutation` で、送信中はボタンが `aria-busy` になり、2 回目の送信は無視する
- **メッセージ**は、欄のものは欄の下に（`aria-describedby`、`aria-invalid`）、試行の全体についてのものはフォームの先頭に `Alert` で出す。ブラウザーの検証の吹き出しは使わない（`noValidate`）。フォーカスは、誤りのある最初の欄へ移る
- **`SessionAccount`** は、ヘッダーのアカウント欄。サインインしている人のメールアドレスと、サインアウトのボタンを出す。狭い画面ではメールアドレスを隠す（読み上げには残る）。`signInHref` を渡すと、サインインしていない人にサインインの画面へのリンクを出す（portal-app）
- **サインアウト**すると、「サインアウトしました。」と通知し、サインインが要る画面はサインインの画面に替わる。ほかのタブも同じ状態になる
- **画面が替わったとき**は、`ui` の `AppShell` と `PageHeader` が、文書のタイトルを「画面の名前 | アプリの名前」にし、フォーカスを画面の見出し（`h1`）へ移す。サインインのあとも、サインアウトのあとも、ルートの移動でも同じ。ページを読み込んだ直後の最初の画面では、フォーカスを動かさない

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

`VITE_MODE` が `production` 以外のときは React Query Devtools も表示します。`QueryClient` を作ったあと、`keepQueriesOfOneUser(queryClient)` を呼びます（[セッション](#アプリのセッションbeauty-salon-frontendsession)）。クエリを実行するコードは `useSession` だけです（`RequireSession` と `SessionAccount` が使います）。

`retry: 3` が再試行するのは、クエリが失敗（reject）したとき、つまり通信そのものが失敗したときです。API のエラー応答は値として返るので、再試行の対象になりません。

## 環境変数（`VITE_*`）

変数は各アプリのディレクトリにある `.env.<mode>` に置き、Vite がビルド時（開発サーバーでは起動時）に値を埋め込みます。リポジトリ直下の `.env.*` はバックエンド用で、`VITE_*` は入っていません。

| 変数 | 使っている場所 |
|------|----------------|
| `VITE_MODE` | `App.tsx` の `EnvironmentBanner`（本番以外で、画面の隅に環境名を表示する）、`main.tsx` の Devtools の表示判定 |
| `VITE_APP_TITLE` | `App.tsx` のヘッダーとトップページの見出し |
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
- 登録・更新・削除は `useSalonCrudCreate` などのミューテーションフックを使い、結果も同じく `status` で分岐する。成功したら `getSalonCrudListQueryKey()` を使って一覧のキャッシュを無効化する。ただし、この 3 つはアクセストークンが必要である。トークンは、サインインしていれば `customInstance` が付ける（[セッション](#セッション)）。サインインしていなければ 401 が返る
- サーバーの検証エラーは `ModelsProblemDetails` の `errors`（項目ごとの `field`・`rule`・`message`）から表示する
- 429 のときは、レスポンスの `headers` から `Retry-After`（秒）を読める
- `endpoints/bookings/bookings.ts` のフックには、すべてサーバーに実装がある。`BookingCrud` の 11 個、`BookingServiceCrud` の 3 個、`AvailableSlotCrud` の 2 個、`CustomerBookings` の 5 個である。`BookingCrud` のフックは、一覧、作成、1 件の取得、更新、削除の 5 つ（`useBookingCrudList`、`useBookingCrudCreate`、`useBookingCrudGet`、`useBookingCrudUpdate`、`useBookingCrudDelete`）、ステータスの 5 つの操作（`useBookingCrudConfirm`、`useBookingCrudCancel`、`useBookingCrudStart`、`useBookingCrudComplete`、`useBookingCrudNoShow`）、日時の変更（`useBookingCrudReschedule`）である。どれも `admin` か、予約のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。削除は、サロンの `staff` でも 403 になる。サインインしていなければ 401 が返る。作成に渡すのは、サロン、顧客、担当スタッフ、施術明細（サービス、スタッフ、開始日時）と、内金、要望、メモ、受付経路だけである。終了日時、所要時間、金額、予約番号、来店日はサーバーが決めて返すので、画面で計算した値を送らない。`services[].startTime` は UTC（`Z`）の分単位で送る。作成の 409 は、スタッフがその時間に空いていないことを表す（`detail` にスタッフの ID が入る）。ステータスの操作は、操作のあとの予約を返すので、その値で表示を更新する。操作の 409 は、予約がその操作のできるステータスでないこと（`detail` に、いまのステータスと、操作できるステータスが入る）、または開始日時の前に無断キャンセルを記録しようとしたことを表す。別の画面が先にステータスを変えたときにも返るので、予約を読み直して表示する。どの操作ができるかは、予約の `status` から決まる（[予約台帳](./bookings.md#ステータスの操作)）。キャンセルと完了は本文が必須で、理由や実際の日時を記録しないときも、項目を null で送る。更新に渡すのは、内金、要望、メモ、受付経路のうち、変える項目だけである（値を消すときは null）。ステータスと日時は、更新では変えられない（400）。日時の変更には、新しい開始日時（`startTime`。UTC の分単位）と担当スタッフ（`staffId`）の両方を渡す。担当を変えないときも、いまの担当スタッフを渡す。サーバーが、施術明細を同じ時間だけ動かし、変更前の担当スタッフの明細を新しい担当スタッフに付け替えるので、返ってきた予約で表示を更新する。日時の変更の 409 は、予約が動かせるステータス（`draft`・`pending`・`confirmed`）でないこと、スタッフがその時間に空いていないこと、またはサロンのタイムゾーンをサーバーが知らないことを表す。`staffId` の 400 は、予約のサロンのスタッフでないことを表す。削除の成功は 204 で、本文がない。売上か施術記録が参照する予約の削除は 409 になる（[予約台帳](./bookings.md#削除)）。顧客、スタッフ、サービス、サロンの削除（`useCustomerCrudDelete`、`useStaffCrudDelete`、`useServiceCrudDelete`、`useSalonCrudDelete`）も、終わっていない予約（`draft`・`pending`・`confirmed`・`in_progress`）が参照している間は 409 になる（[予約台帳](./bookings.md#予約が参照するものの削除)）。画面は、予約の一覧を `customerId`・`staffId`・`salonId` と `status` で絞り込んで、妨げている予約を示す。`BookingServiceCrud` のフックは、施術明細の追加（`useBookingServiceCrudCreate`）、1 件の取得（`useBookingServiceCrudGet`）、削除（`useBookingServiceCrudDelete`）である。必要なアクセストークンは `BookingCrud` と同じで、明細の削除は、サロンの `staff` にもできる。追加に渡すのは、作成の `services[]` の 1 件と同じ形（サービス、スタッフ、UTC の分単位の開始日時、メモ）である。追加と削除ができるのは、終わっていない予約（`draft`・`pending`・`confirmed`・`in_progress`）だけで、サーバーが、予約の日時と金額を明細から算出し直す。追加が返すのは明細だけで、削除の成功は 204 なので、どちらのあとも、予約を読み直して表示する。追加の 409 は、予約が終わっていること、明細がすでに 20 件あること、明細が最も早い明細の開始から 24 時間以内に始まらないこと、スタッフがその時間に空いていないこと、金額が上限を超えること、またはサロンのタイムゾーンをサーバーが知らないことを表す。削除の 409 は、予約が終わっていること、予約の最後の明細であること（来店がなくなった予約は、キャンセルする）、またはサーバーが予約を算出し直せないこと（タイムゾーン、金額の上限）を表す。明細を書き換えるフックはない。明細の担当スタッフや開始日時を変えるには、新しい明細を追加してから、古い明細を削除する（[予約台帳](./bookings.md#施術明細の追加と削除)）。
- 空き枠のフックは 2 つある。`useAvailableSlotCrudList` は、サロン、サービス、日付（サロンのタイムゾーンでの日付）を渡すと、スタッフがそのサービスを始められる開始日時の一覧を返す。サインインしていれば、どのロールでも呼べる。`staffId` を渡すと、そのスタッフの枠だけになる。枠は `startTime`（UTC）の早い順で、1 ページは `limit` 件（既定は 20）。続きは `meta.nextCursor` を `cursor` に渡して読む。予約できない日（休業日、サービスを受け付けない日、過ぎた日）は、エラーではなく空の一覧なので、空の状態を表示する。サロンのタイムゾーンをサーバーが知らないときは 409 が返る。`useAvailableSlotCrudCheck` は、スタッフ、サービス、開始日時（UTC の分単位）を渡すと、その時間にスタッフが空いているか（`isAvailable`）と、重なっている予約の ID（`conflicts`）を返す。予約台帳と同じアクセストークンが必要で、顧客のアカウントでは 403 になる。確かめるのはスタッフの占有だけで、営業時間や勤務スケジュールは確かめない。どちらのフックも枠を押さえないので、そのあとの予約の作成が 409 になることがある。そのときは、空き枠を読み直す（[予約台帳](./bookings.md#空き枠)）
- 顧客が自分で入れる予約のフックは 5 つある。どれも、プロフィールのある、ロール `customer` のアカウントのアクセストークンが必要で、ほかのロールでは 403、プロフィールを作る前は 404 になる。`useCustomerBookingsCreate` は、空き枠の一覧の枠を 1 つ渡す（`salonId`、`serviceId`、枠の `staffId` と `startTime`、`customerRequest`。すべて必須で、要望がなければ `customerRequest` は null）。成功は 201 で、予約は `pending`（サロンの確定を待つ）なので、確定した予約としては表示しない。409 は、その時間が空き枠でなくなったこと、同じ時間に自分のほかの予約があること、サロンがこの顧客の予約をオンラインで受け付けていないことのどれかで、`detail` を表示して、空き枠を読み直す。`useCustomerBookingsList`（`status`、`bookingDateFrom`、`bookingDateTo` で絞り込み、`meta.nextCursor` で続きを読む）と `useCustomerBookingsGet` は、どのサロンの予約も、サロンが台帳に入れた予約も返す。レスポンスは `CustomerBookingResponse` で、サロン内のメモ、キャンセルした人と理由は含まない。`useCustomerBookingsCancel` は、`draft`・`pending`・`confirmed` の予約を、開始日時より前にだけキャンセルできる（そのあとは 409）。`useCustomerBookingsReschedule` は、`draft`・`pending`・`confirmed` の予約を、開始日時より前にだけ、別の空き枠に移す（`startTime` と `staffId`。どちらも必須で、担当を変えないときは、いまの `staffId` を渡す）。移せる先は、空き枠の一覧を、予約の明細の `serviceId` と `duration` で読んで出す。成功は 200 で、確定済みだった予約は `pending` に戻る（サロンの確定を待つ表示に戻す）。409 は、枠でなくなった、開始日時を過ぎた、明細が 2 件以上ある（サロンだけが移せる）、などで、`detail` を表示して、空き枠を読み直す。サービスは変えられない。キャンセルして、入れ直す（[予約台帳](./bookings.md#顧客による日時の変更)）
- `endpoints/sales/sales.ts` のフックには、すべてサーバーに実装がある。台帳の 5 つは、`useSaleCrudList`、`useSaleCrudCreate`、`useSaleCrudGet`、`useSaleCrudUpdate`、`useSaleCrudVoidSale` である。どれも、`admin` か、売上のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。`useSaleCrudVoidSale` は、サロンの `staff` でも 403 になる。`useSaleCrudCreate` には、明細の金額を計算して渡す。サーバーは、明細の `totalAmount` が `quantity` × `unitPrice` − `discountAmount` + `taxAmount` と合わなければ 400 を返し、黙って直さない。売上の `subtotal`、`taxAmount`、`totalAmount`、`saleNumber`、`saleDate` は、サーバーが決めて返す。400 の `errors` の `field` は、`details.0.totalAmount` のように、明細の番号を含む。409 は、その予約に取り消していない売上がすでにあるか、サロンのタイムゾーンをサーバーが知らないことを表す。一覧は会計日時の新しい順で、取り消した売上も含む。`useSaleCrudUpdate` には、変える項目だけを渡す。`details` を渡すと、明細の全体が置き換わり、売上の金額が計算し直されるので、残す明細も含める。取り消した売上の更新と、支払い状態が `pending` でない売上の `details` は 409 になる。`useSaleCrudVoidSale` の本文は `voidReason` だけで（null でもよいが、キーは必須）、取り消し済みの売上と、返金していない支払いがある売上は 409 になる。取り消しは、元に戻せない（[売上台帳](./sales.md)）。`useSaleCrudProcess` は、受け取った支払いを記録する（本文は `paymentMethodId`、`amount`、`cardLastFour`、`cardBrand` で、どのキーも必須。カードの 2 項目は、支払い方法の区分が `credit_card` か `debit_card` でなければ null）。決済代行会社とは接続していないので、お金を受け取ってから呼ぶ。分けて支払うときは、もう一度呼ぶ。`amount` が未払い残額を超えると 400、取り消した売上、返金のある売上、未払い残額のない売上は 409 になる。レスポンスは決済取引（`PaymentResponse`）なので、売上の `paymentStatus` と `payments` は、売上を読み直して表示する。`endpoints/payments/payments.ts` の `usePaymentCrudRefund` は、`completed` の決済取引を 1 回だけ返金する（本文は `refundAmount` と `refundReason` で、どちらのキーも必須）。`staff` では 403、`completed` でない決済取引（返金済みを含む）は 409 になる（[支払い](./payments.md)）。`useSaleCrudGetReceipt` は、売上のレシートを返す（`receiptNumber` は売上番号、`sale` は 1 件の取得と同じ売上、`issuedAt` は作った時刻）。レシートは保存されないので、印刷し直すときも、もう一度呼ぶ。取り消した売上と、受け取った金額が合計金額に達していない売上は 409 になる。`useSaleCrudCalculate` は、売上を入れる前に金額を計算する（本文は `salonId`、`bookingId`（予約がなければ null）、`services`（加えるサービスの ID。加える数だけ書く）で、どのキーも必須）。何も書かない。`breakdown` は売上と同じ名前の金額（`subtotal`、`discountAmount`、`taxAmount`、`totalAmount`）、`recommendedMethods` は合計金額を 1 回で受け取れる支払い方法の種類である。サロンのものでない予約やサービスと、数える明細がないリクエストは 400 になる。売上の作成は、計算の結果と比べないので、作成には明細の金額を渡す（[売上台帳](./sales.md#金額の計算)）。`endpoints/sales-reports/sales-reports.ts` のフック（`useSalesReportCrudGet`、`useSalesReportCrudGetDaily`、`useSalesReportCrudGetByStaff`、`useSalesReportCrudGetByCategory`、`useSalesReportCrudGetTrends`、`useSalesReportCrudExport`）は、すべて使える。使えるのは `admin` と、サロンの `owner`・`manager` で、`staff` は 403 になる。クエリの `salonId` と期間（`startDate`、`endDate`。`YYYY-MM-DD`。両方とも必須で、366 日まで）に既定値はないので、「今月」などは、サロンのタイムゾーンの日付にして渡す。存在しないサロンは 400（`salonId` の `not_found`）になる。`percentage` は小数第 1 位までで、行の合計が 100 にならないことがある（[売上レポート](./sales-reports.md)）。`salesReportCrudExport` は、期間の売上の CSV を、文字列のまま `data` に返す（`fetcher` は、JSON でない本文を文字列で返す）。ダウンロードさせるには、`new Blob([data], { type: 'text/csv' })` にして、`Content-Disposition` の名前（`sales-report-<startDate>-<endDate>.csv`）を付ける。サーバーは、ファイルを保存しない。`endpoints/points/points.ts` のフック（`usePointCrudGetBalance`、`usePointCrudListTransactions`、`usePointCrudGetExpiring`、`usePointCrudEarn`、`usePointCrudUse`、`usePointCrudAdjust`、`usePointCrudExpire`）は、すべて使える。使えるのは `admin` と、どのサロンの `owner`・`manager`・`staff` も（調整は `staff` には 403、失効は `admin` のほかは 403）で、顧客のアカウントは 403 になる。`usePointCrudGetExpiring` は、有効期限が今日（UTC）から `days` 日後（既定は 30、1〜365）までの、使われずに残っているポイントを返し、期限を過ぎて、まだ失効させていないものも含む。残高は、顧客のプロフィール（`/api/v1/customers/me`）の `loyaltyPoints` でも読める。付与と利用は、会計を記録したあとで、その売上を `referenceType: 'sale'` と `referenceId` で参照して送る。同じ記録への 2 回目の付与と利用、取り消した売上、残高を超える利用は 409 になる（[ポイント台帳](./points.md)）
- `endpoints/payment-methods/payment-methods.ts` の 5 つのフック（`usePaymentMethodCrudList`、`usePaymentMethodCrudCreate`、`usePaymentMethodCrudGet`、`usePaymentMethodCrudUpdate`、`usePaymentMethodCrudDelete`）は、サーバーに実装がある。サロンが受け付ける支払い方法の設定で、どれも、パスに `salonId` を渡す。読む 2 つは、`admin` か、そのサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、作成、更新、削除は、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる（顧客に見せる支払い方法の一覧は、まだない）。作成には、すべてのキーを渡す（値がないものは null）。更新には、変える項目だけを渡す。`method` は、作成のあとで変えられず、更新に渡すと 400 になる。`minimumAmount` が `maximumAmount` より大きくなる作成と更新は 400 で、片方だけを渡した更新では、渡した項目の `errors` になる。削除の 409 は、その支払い方法を指す支払いがあることを表す。画面は、削除の代わりに、`isActive` を false にする更新を勧める。一覧は `sortOrder` の順で、使っていないものも含む。使っているものだけを読むには、`isActive: true` を渡す（[支払い](./payments.md)）
- `endpoints/products/products.ts` の 5 つのフック（`useProductCrudList`、`useProductCrudCreate`、`useProductCrudGet`、`useProductCrudUpdate`、`useProductCrudDelete`）は、サーバーに実装がある。サロンの商品で、どれも、パスに `salonId` を渡す。読む 2 つは、`admin` か、そのサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、作成、更新、削除は、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる。作成には、すべてのキーを渡す（値がないものは null）。更新には、変える項目だけを渡す。在庫の水準が `minimumStock` ≦ `reorderPoint` ≦ `maximumStock` の順に並ばない作成と更新は 400 で、片方だけを渡した更新では、保存されている水準と比べ、渡した項目の `errors` になる。商品コードが、そのサロンの削除されていない商品と重なると 409 になる。削除の 409 は、その商品に在庫のレコードがあることを表す。画面は、削除の代わりに、`isActive` を false にする更新を勧める。一覧は `productCode` の順で、取り扱いをやめたものも含む（[商品](./products.md)）
- `endpoints/reviews/reviews.ts` のフックのうち、サーバーに実装があるのは、`useReviewCrudList`、`useReviewCrudGet`、`useReviewCrudCreate`、`useReviewCrudUpdate`、`useReviewCrudDelete`、`useReviewCrudMarkHelpful`、`useReviewCrudReport`、`useReviewCrudRespond`、`useReviewReportCrudList`、`useReviewReportCrudDismiss`、`useSalonReviewSummaryGetSummary`、`useStaffReviewSummaryGetStaffSummary` の 12 個である。読む 4 つは、認証なしで呼べるので、サロンを選ぶ画面に使える。サロンのレビューは `useReviewCrudList({ salonId })` で読み、並び順は `sortBy`（`recent`、`rating`、`helpful`）で選ぶ。集計の `ratingDistribution` は、キー `"1"`〜`"5"` を 0 件でも必ず含むので、そのまま棒グラフにできる。`averageRating` は小数第 2 位までで、サロンの `rating` と同じ値になる。`useReviewCrudCreate` には、ロール `customer` で、顧客のプロフィールがあるアカウントのアクセストークンが要り、`admin` とサロンのメンバーは 403 になる。本文の `customerId` には自分の顧客 ID を、`bookingId` には、ステータスが `completed` の自分の予約を、`salonId` には、その予約のサロンを渡す。`staffId` は、その予約を担当したスタッフか null で、null なら `staffRating` も null にする。画像がなければ `imageUrls` は空の配列にする（null は 400）。済んでいない予約と、レビューがすでにある予約は 409 になるので、画面は、自分の予約のうち `completed` のものだけに投稿の操作を出す。`useReviewCrudUpdate` は、レビューを書いた顧客のアカウントだけが呼べ、変える項目だけを送る（空の本文は 400）。`staffId` が null のレビューに `staffRating` を送ると 400 になる。`useReviewCrudDelete` は、書いた顧客のアカウントと `admin` が呼べ、サロンのメンバーは 403 になるので、サロンの画面には削除の操作を出さない。`useReviewCrudMarkHelpful` は、顧客のプロフィールがあるアカウントだけが呼べ、自分のレビュー、`admin`、サロンのメンバーは 403 になるので、ほかの顧客のレビューにだけ操作を出す。1 人 1 回で、2 回目は数を変えずに 200 で今の `helpfulCount` を返すので、何度押されても、返った数を表示すればよい。取り消しはない。`useReviewCrudReport` は、顧客のプロフィールがあるアカウント（ほかの顧客のレビュー）と、サロンの `owner`・`manager`（自分のサロンのレビュー）が呼べ、`admin`、`staff`、自分のレビュー、ほかのサロンのレビューは 403 になる。`reason` は一覧の値から選ばせ、`other` のときは `details` を必須にする（null は 400）。1 つのアカウントで 1 回だけで、2 回目は、却下のあとも 409 なので、409 は「通報済み」と表示する。通報しても、レビューは変わらない。`useReviewCrudRespond` で返信を書けるのは、レビューのサロンの `owner`・`manager` だけで、`staff`、顧客、ほかのサロンは 403 になるので、サロンの管理画面で、自分のサロンのレビューにだけ返信の操作を出す。`ownerResponse` に null を送ると返信を取り下げ、`admin` は取り下げだけができる（文字列は 403）。同じ返信をもう一度送っても、`ownerRespondedAt` は変わらない。`useReviewReportCrudList` と `useReviewReportCrudDismiss` は `admin` だけが呼べ、ほかのアカウントは 403 になる。一覧は古い順で、`status=pending` で未処理の通報を読む。規則に反するレビューは `useReviewCrudDelete` で削除し、その通報も消える（[レビュー](./reviews.md)）
- `endpoints/inventory/inventory.ts` のうち、在庫の行の 7 つのフック（`useInventoryCrudList`、`useInventoryCrudCreate`、`useInventoryCrudGet`、`useInventoryCrudUpdate`、`useInventoryCrudDelete`、`useInventoryCrudListLowStock`、`useInventoryCrudListExpiring`）は、サーバーに実装がある。読む 4 つは、`admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で、作成、更新、削除は、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる。作成には、すべてのキーを渡す（値がないものは null）。在庫の数は渡せず、作成した行の数は 0 になる。ロットで分ける商品（`requiresLotTracking`）はロット番号を、分けない商品は null を渡し、合わなければ 400 になる。同じ商品の同じロット（ロット番号のない行は 1 つまで）は 409 になる。削除の 409 は、在庫数が 0 でないことを表す。在庫僅少と期限切れ間近には `salonId` を渡す（[在庫](./inventory.md)）
- 在庫の移動の 2 つのフック（`useInventoryCrudRecordMovement`、`useInventoryCrudListMovements`）も、サーバーに実装がある。記録は、在庫を読める人が使えるが、`staff` の `adjustment`、`disposal`、`transfer` は 403 になる。`quantity` は、入庫が正、出庫が負で、区分に合わない符号は 400 になる。`adjustment` と `disposal` には `reason` を渡す。在庫が引き当てた数を下回るか、99,999,999.99 を超える記録は 409 になる。レスポンスは 200 で、`balanceAfter` が移動後の在庫数である。履歴は新しい順で、`startDate` と `endDate` には、レスポンスの `createdAt` をそのまま渡せる（[在庫の移動](./inventory.md#在庫の移動)）
- 棚卸しのフック（`useInventoryCrudPerformStockCount`）と在庫評価額のフック（`useInventoryCrudGetValueReport`）も、サーバーに実装がある。どちらも、`staff` には 403 になる。棚卸しは、数えた行だけを `items` に渡し、差のあった行の調整の在庫の移動と差を、`items` の順に返す。数えた数が引き当てた数を下回る行があると 409 で、何も書かない。在庫評価額は、カテゴリごとの評価額（円）と、在庫のある商品の数を返す（[棚卸し](./inventory.md#棚卸し)、[在庫評価額](./inventory.md#在庫評価額)）
- `endpoints/purchase-orders/purchase-orders.ts` のうち、6 つのフック（`usePurchaseOrderCrudList`、`usePurchaseOrderCrudCreate`、`usePurchaseOrderCrudGet`、`usePurchaseOrderCrudUpdate`、`usePurchaseOrderCrudApprove`、`usePurchaseOrderCrudCancel`）は、サーバーに実装がある。一覧、作成、取得、更新は、`admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で、承認と取り消しは、`staff` では 403 になる。顧客のアカウントでは、どれも 403 になる。作成の明細には、在庫の行の ID、数量、単価、メモを渡す。商品の名前と金額は渡せず、サーバーが明細の金額、小計、合計を計算して返す。更新は、ステータスを 1 つだけ進める（`draft` → `pending`、`approved` → `ordered`、`ordered` → `shipped`）か、納品予定日とメモだけを書き、ほかのステータスへの更新は 409 になる。承認は `pending` の発注だけで、本文は要らない。取り消しには `cancellationReason` を渡す。`delivered` と `cancelled` の発注は、どれも 409 になる。入荷（`usePurchaseOrderCrudReceive`）は、`ordered` か `shipped` の発注に、届いた明細の在庫の行と数量を渡し、発注を `delivered` にして在庫を増やす。書かなかった明細は受け取らない。発注の提案（`usePurchaseOrderCrudListReorderSuggestions`）は、`salonId` のサロンで頼むとよい商品と数量を、商品ごとに返す。提案は商品を返すので、発注を作るときは、その商品の在庫の行を選んで渡す（[発注](./purchase-orders.md)）
- `endpoints/inventory-alerts/inventory-alerts.ts` の 3 つのフック（`useInventoryAlertCrudList`、`useInventoryAlertCrudAcknowledge`、`useInventoryAlertCrudGetSummary`）も、サーバーに実装がある。どれも `admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる。一覧と件数には `salonId` を渡す。アラートには ID がなく、確認には、種類（`alert`）、商品の ID、在庫の行の ID（商品のアラートでは null）、メモを渡す。今出ていないアラートは 404、確認がまだ効いているアラートは 409 になる。確認は、在庫が補充されたあとにまた減るなど、状態が変わると効かなくなるので、画面は、一覧の `acknowledgement` が null のアラートを、まだ誰も見ていないものとして表示する（[在庫のアラート](./inventory-alerts.md)）
- `endpoints/treatments/treatments.ts` の 8 つのフック（`useTreatmentRecordCrudList`、`useTreatmentRecordCrudCreate`、`useTreatmentRecordCrudGet`、`useTreatmentRecordCrudUpdate`、`useTreatmentRecordCrudDelete`、`useTreatmentRecordCrudAddPhotos`、`useTreatmentRecordCrudRemovePhoto`、`useTreatmentRecordCrudGetStatistics`）は、どれもサーバーに実装がある。どれも `admin` か、予約のサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、削除は `staff` では 403、顧客のアカウントでは、自分の来店の記録も含めて、どれも 403 になる。作成には、すべてのプロパティを渡し、書かない項目は null か空配列にする。施術中か完了でない予約と、施術記録がすでにある予約は 409 になる。更新には変える項目だけを渡し、`materials` は一覧全体を置き換える。写真は保存先の URL で、施術記録 1 件に 20 枚まで、同じ URL は 1 枚。公開する写真には顧客の同意が要る。統計には `salonId` が必須（[施術記録](./treatments.md)）
- `endpoints/medical-charts/medical-charts.ts` のうち、4 つのフック（`useMedicalChartCrudList`、`useMedicalChartCrudCreate`、`useMedicalChartCrudGetByCustomer`、`useMedicalChartCrudUpdate`）は、サーバーに実装がある。どれも `admin` か、どのサロンの `owner`・`manager`・`staff` のアクセストークンでも使え、顧客のアカウントでは、自分のカルテも含めて 403 になる。カルテは顧客の ID で読み、カルテの ID で更新する。作成には、すべてのプロパティを渡し、書かない項目は null か空配列にする。カルテのある顧客は 409 になる。顧客のアレルギーの 4 つ（`useMedicalChartCrudListAllergies`、`useMedicalChartCrudAddAllergy`、`useMedicalChartCrudUpdateAllergy`、`useMedicalChartCrudRemoveAllergy`）にも実装がある。追加は、顧客がすでに持つアレルゲンなら 409 になり、削除は `staff` では 403 になる（[カルテ](./medical-charts.md)）
- `endpoints/attachments/attachments.ts` のうち、添付ファイルの 7 つのフック（`useAttachmentCrudGetUploadUrl`、`useAttachmentCrudComplete`、`useAttachmentCrudList`、`useAttachmentCrudGet`、`useAttachmentCrudGetDownloadUrl`、`useAttachmentCrudDelete`、`useAttachmentCrudPurge`）は、サーバーに実装がある。どれも `admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要で、顧客のアカウントでは 403 になる（削除は、`staff` では自分がアップロードしたものだけ。掃除は `admin` だけ）。**ファイルの中身は、フックでは送らない**。`useAttachmentCrudGetUploadUrl` に名前・種類・サイズ・サロンを渡し、返ってきた `uploadUrl` に、`uploadHeaders` のヘッダーをそのまま付けて、ファイルを `fetch` の `PUT` で送る（送り先はストレージなので、`customInstance` は使わず、`Authorization` ヘッダーも付けない）。そのあと `useAttachmentCrudComplete` を呼ぶ。409 は、ファイルがまだ届いていない（もう一度呼べる）か、申告と違うファイルだった（添付ファイルは削除されるので、発行からやり直す）かで、`detail` で区別する。表示とダウンロードには、`useAttachmentCrudGetDownloadUrl(id, { inline })` の `downloadUrl` を使う。5 分で切れるので、保存せず、使う直前に取得する（[添付ファイル](./attachments.md)）
- `endpoints/attachments/attachments.ts` の共有リンクの 4 つのフック（`useShareLinkCrudCreate`、`useShareLinkCrudList`、`useShareLinkCrudGet`、`useShareLinkCrudDelete`）も、サーバーに実装がある。`admin` か、添付ファイルのサロンの `owner`・`manager` のアクセストークンが必要で、`staff` と顧客のアカウントでは 403 になる。**トークンは、発行の応答（`data.token`）にだけある**。一覧や取得では得られないので、発行した画面で閲覧者に渡す。`endpoints/share/share.ts` の 2 つのフック（`useSharedFileCrudGet`、`useSharedFileCrudGetDownloadUrl`）は、認証なしで呼べる。どちらも `POST`（ミューテーション）で、トークンとパスワードを本文で渡す（`password` は、保護されていなければ null）。保護された共有リンクで、パスワードがないか違うと 403（`password-required`）、開けないトークンは、理由によらず 404 になる。画面の URL でトークンを受け取るときは、フラグメント（`#` のあと）を使う（[共有リンク](./attachments.md#共有リンク)）。`endpoints/services/services.ts` のフックは、カテゴリーのもの（`useServiceCategoryCrudList` など）も、サービスのもの（`useServiceCrudList` など）も、サーバーに実装がある
- `endpoints/customers/customers.ts` のフックには、すべてサーバーの実装がある。一覧、登録、1 件の取得、更新、削除の 5 つ（`useCustomerCrudList`、`useCustomerCrudCreate`、`useCustomerCrudGet`、`useCustomerCrudUpdate`、`useCustomerCrudDelete`）は、どれも `admin` か、サロンの `owner`・`manager`・`staff` のアクセストークンが必要である（削除は `staff` を除く）。サインインしていなければ 401 が返る。顧客本人のプロフィールの 3 つ（`useCustomerProfileGet`、`useCustomerProfileCreate`、`useCustomerProfileUpdate`）にも実装があり、ロール `customer` のアクセストークンが必要である。一括の操作の 4 つ（`useCustomerCrudBatchGet`、`useCustomerCrudBulkCreate`、`useCustomerCrudBulkUpdate`、`useCustomerCrudBulkDelete`）にも実装があり、どれも 100 件までを、すべてか何もしないかで扱う（一括削除は `staff` を除く。[一括の操作](./customers.md#一括の操作)）。統計の `useCustomerCrudGetStatistics(id, { salonId, startDate, endDate })` にも実装があり、`admin` か、`salonId` のサロンの `owner`・`manager`・`staff` のアクセストークンが必要である（[顧客台帳](./customers.md#統計)）。変更履歴の `useCustomerCrudGetHistory(id, { limit, cursor })`、版の `useCustomerCrudGetVersion(id, version)`、復元の `useCustomerCrudRestore`、統合の `useCustomerCrudMerge`、台帳の CSV 出力の `useCustomerCrudExport`、顧客のデータの出力の `useCustomerCrudExportData`、削除の依頼の受け付け・確認・取り消しの `useCustomerCrudRequestDeletion`、`useCustomerCrudGetDeletionRequest`、`useCustomerCrudCancelDeletionRequest` にも実装があり、`admin` か、サロンの `owner`・`manager` のアクセストークンが必要である。消去の実行の `useCustomerCrudExecuteDeletionRequests` は、`admin` のアクセストークンが必要である（[削除の依頼](./customers.md#削除の依頼)）。削除した顧客の変更履歴と版も読める（[顧客台帳](./customers.md#変更履歴と版)）。好み設定の 4 つにも実装がある。台帳を扱うユーザーのための `useCustomerCrudGetPreferences(id)` と `useCustomerCrudUpdatePreferences`、顧客本人のための `useCustomerProfileGetPreferences` と `useCustomerProfileUpdatePreferences`（引数に ID はなく、どの顧客かはトークンが決める）である。何も設定していない顧客にも、200 で空の好み設定（一覧は `[]`、ほかは null）が返るので、404 を「未設定」として扱わない。台帳のフックの 404 は顧客がいないことを、本人のフックの 404 はプロフィールをまだ作っていないことを表す。更新には変える項目だけを渡し、`stylePreferences` は 4 項目をまとめて渡す。保存されているスタッフの ID は、そのスタッフが削除されても残るので、画面は、スタッフのプロフィール（`useStaffProfileGet`）が 404 のスタッフを表示しない
- `endpoints/staff/staff.ts` のフックのうち、サーバーに実装があるのは、台帳の一覧、登録、1 件の取得、更新、削除の 5 つ（`useStaffCrudList`、`useStaffCrudCreate`、`useStaffCrudGet`、`useStaffCrudUpdate`、`useStaffCrudDelete`）、勤務スケジュールの一覧と更新の 2 つ（`useStaffSchedulesList`、`useStaffSchedulesUpdate`）、招待の取得、作成、取り消しの 3 つ（`useStaffInvitationsGet`、`useStaffInvitationsCreate`、`useStaffInvitationsDelete`）、アカウントの取得、ロールの変更、紐づけの解除の 3 つ（`useStaffAccountsGet`、`useStaffAccountsUpdate`、`useStaffAccountsDelete`）、プロフィールの一覧と 1 件の取得の 2 つ（`useStaffProfileList`、`useStaffProfileGet`）、本人のプロフィールの取得と更新の 2 つ（`useStaffOwnProfileGet`、`useStaffOwnProfileUpdate`）で、このファイルのフックのすべてである。台帳の 5 つは、どれも `admin` か、そのサロンの `owner` のアクセストークンが必要で、レスポンスは給与と個人の連絡先を含むので、顧客に見せる画面には使わない。顧客に見せる画面は、認証なしで呼べるプロフィールの 2 つを使う。1 つのサロンのスタッフは `useStaffProfileList({ salonId })` で読む。本人のプロフィールの 2 つは、サロンに届く `owner`・`manager`・`staff` のアクセストークンが必要で、どのスタッフかはトークンが決める（引数に ID はない）。`useStaffOwnProfileUpdate` には、変える項目だけを渡す。渡せるのは `specialties`、`bio`、`imageUrl`、`yearsOfExperience`、`certifications` の 5 つで、`displayName` などの台帳の項目を渡すと 400 になる。レスポンスの `links.profile` は、顧客が同じプロフィールを読むパスである。勤務スケジュールの 2 つは、`admin` か、そのサロンの `owner`・`manager` のアクセストークンが必要で、`staff` は自分のスケジュールだけを `useStaffSchedulesList` で読める。`useStaffSchedulesUpdate` は、送った配列でスケジュール全体を置き換えるので、1 行だけを変える画面も、読んだ全体に変更を加えて送る（読んだ `data` は、そのまま本文にできる）。`useStaffSchedulesList(salonId, id, { date })` は、その日付に適用される行だけを返し、`data` は 0 個か 1 個である。スケジュールは顧客に見せる画面には使わない。招待の 3 つは、台帳と同じく `admin` か、そのサロンの `owner` のアクセストークンが必要である。`useStaffInvitationsCreate` は、スタッフに、ログインアカウントを作るためのリンクをメールで送る（本文はアカウントのロールだけで、宛先は台帳のメールアドレス）。`useStaffInvitationsGet` の 404 は、スタッフが招待を持っていないことを表す。招待されたスタッフがリンクから開く画面（`/accept-staff-invitation`）は、URL のフラグメントからトークンを取り出し、`endpoints/authentication/authentication.ts` の `useAuthCrudVerifyStaffInvitation` で招待の内容（宛先とロール）を表示する。次に何をするかは、そのレスポンスの `links` で決める。`links.accept` があれば、パスワードを尋ねて、`useAuthCrudAcceptStaffInvitation` でトークンと新しいパスワードを送る。どちらもアクセストークンは要らない。受け入れのあと、スタッフは、招待の宛先のメールアドレスとそのパスワードでログインする。`links.join` があれば、その宛先のスタッフのアカウントがすでにあるので、パスワードは尋ねず、そのアカウントでのログインを求めてから、`useAuthCrudJoinStaffInvitation` でトークンを送る（アクセストークンが要る）。参加のあと、同じアクセストークンのまま、新しいサロンの画面を開ける。409 は、ログインしているアカウントがすでにサロンに属しているか、招待の宛先と違うメールアドレスのアカウントであることを表す（`detail` で区別する）。アカウントの 3 つは、台帳と同じく `admin` か、そのサロンの `owner` のアクセストークンが必要である。`useStaffAccountsGet` の 404 は、スタッフにアカウントがないことを表す（まだ招待を受け入れていないか、紐づけを解除した）。`useStaffAccountsUpdate` の本文はロールだけで、`owner` を指定できるのは `admin` である。`useStaffAccountsDelete` は、アカウントを消さずに、スタッフとの紐づけだけを外す。ロールの変更と紐づけの解除は、そのアカウントの次のリクエストから効くので、操作した側の画面は、アカウントを読み直して表示する

## UI とテストの規則

スタイルは CSS Modules で書き、色や余白はデザイントークンから取り、レイアウトは CSS Grid で組みます（flex は使いません）。複数のアプリが使うコンポーネントは `ui` パッケージに置き、状態ごとにストーリーを書いて、そのストーリーからテストします。

規則と手順は、次の 2 つのスキルにあります。`frontend/` 以下を変更する前に読みます。

- [frontend-ui](../.claude/skills/frontend-ui/SKILL.md): トークン、CSS Modules、Grid によるレイアウト、コンポーネントの作り方、フォームの部品と画面の骨組みの部品の使い方
- [frontend-testing](../.claude/skills/frontend-testing/SKILL.md): ストーリーからのテスト、アクセシビリティの検査、Vitest の設定

検査できる規則は `theme` パッケージの `src/style-rules.ts` が検査するので、違反はテストの失敗になります。カタログは `pnpm --filter @beauty-salon-frontend/ui run storybook` で起動します（`http://localhost:6006`）。

## テスト

フロントエンドのテストは Vitest です（`pnpm test:frontend`）。パッケージをまたぐ import はソースから解決するので（エクスポート条件 `@beauty-salon-frontend/source`）、ビルドなしで実行できます。`io`、`api-client`、`session` のテストも jsdom で実行します（セッションを `localStorage` に置くため）。

- `ui` のコンポーネント: ストーリー（`*.stories.tsx`）を `composeStories` で読み込み、jsdom に描画して検証する（`*.test.tsx`）。どのストーリーにも、アクセシビリティの検査（axe-core、WCAG 2.2 AA）がある
- 各アプリの `src/App.test.tsx`: `MemoryRouter` で枠を描画し、サインインしていない人に見えるもの（admin-app と dashboard-app ではサインインの画面、portal-app ではトップページ、存在しないパスのページ、`/sign-in`）、共有コンポーネントのリンクがページを読み込み直さずに移動すること、アクセシビリティを検証する。API は呼ばない
- `theme` の `src/style-rules.test.ts`: すべてのパッケージとアプリのスタイルシートとコンポーネントが、スタイルの規則を守っていることを検証する。`src/tokens.test.ts`: 文字と背景、コントロールの縁に使う色のトークンの組が、必要なコントラスト比を満たすことを検証する
- `config` と `testing` の各パッケージ: モジュールの隣に `*.test.ts`
- `io` の `src/libs/fetcher/fetcher.test.ts`: `customInstance` を、スタブにした `fetch` に対して検証する（URL、本文、ステータスごとの戻り値、problem details、reject する条件）。`fetcher.session.test.ts`: セッションがあるときの動作（トークンを付けること、期限切れのあとの再発行と送り直しが 1 回ずつであること、同時のリクエストで再発行が 1 回であること、ほかのタブが先に替えたセッションを通信せずに使うこと、断られた再発行と失敗した再発行の違い）。`src/libs/session/stored-session.test.ts`: 保存、購読、ほかのタブからの変更
- `api-client` の `src/salons.test.ts`: 生成された Salon の関数を、実際の `customInstance` を通して検証する（リクエストの形、ステータスごとに型が絞られること、通信の失敗、TanStack Query との組み合わせ）。`src/session.test.ts`: `io` が持つ再発行のパスとエラーコードが、生成されたものと同じであること
- `session` の `src/session.test.tsx`: `useSession` を `renderHook` で描画し、`signIn`、`signOut`、`keepQueriesOfOneUser` と一緒に、実際の生成クライアントと `customInstance` を通して、スタブにした `fetch` に対して検証する。`src/components/` の部品（`SignInForm`、`SessionGate`、`AccountMenu`）は、`ui` と同じく、ストーリーから検証する。`sign-in-screen/sign-in-flow.test.ts`: フォームの値の確かめと、API の応答ごとのフォームの状態

### 実際の API と DB を使うテスト（`pnpm test:integration`）

API を呼ぶコードは、`fetch` も API も差し替えずに、本番と同じアプリケーション（`createApp`）と PostgreSQL に対しても確かめます。ファイル名は `*.integration.test.ts(x)` です。

- テストの実行ごとに、バックエンドの**テスト用のサーバー**（`backend/packages/api/src/__tests__/test-server/`）が 1 つ起動します。スキーマとシードのデータ（`pnpm db:seed` と同じもの）を入れたテンプレートの DB を作り、テストファイルごとに、その複製を持つ API を、そのファイルだけのポートで起動します
- テスト対象のコードは、その API を呼びます（`VITE_BACKEND_BASE_URL` が、その API のオリジンになります）。テストが終わるたびに、API の DB は新しい複製に替わり、`localStorage` と `sessionStorage` は空になります
- テストは `testApi()`（`@beauty-salon-frontend/testing/api`）から、API のオリジン、シードのアカウントのパスワード、DB への SQL の実行を使えます。SQL は、画面からも API からも起こせないこと（トークンの期限が切れるだけの時間の経過など）のためのものです
- PostgreSQL は、`TEST_DATABASE_URL` があればそれを、なければコンテナを使います（バックエンドの結合テストと同じ）

いまあるのは、次のものです。

- `session` の `src/session.integration.test.tsx`: サインイン、誤ったパスワード、期限切れのあとの再発行（同時のリクエストで 1 回）、再発行できないセッション、API で終わったセッション、サインアウト
- `session` の `src/sign-in.integration.test.tsx`: サインインの画面を、利用者と同じように操作する（入力して、ボタンを押す）。サインインして開こうとした画面が出ること、「サインインしたままにする」、誤ったパスワードと未登録のメールアドレス、空の欄と形の誤ったメールアドレスでは何も送らないこと、2 要素認証（認証アプリのコード、誤ったコードのあとのバックアップコード、空のコード、最初の段階へ戻る）、サインイン済みの人、ヘッダーからのサインアウト、ロールの合わないアカウント
- 各アプリの `src/App.integration.test.tsx`: そのアプリを使えるロールと使えないロール、開こうとしたアドレスの画面がサインインのあとに出ること、画面の移動、サインアウト、サインインした状態でのアクセシビリティ
- `testing` の `src/api/test-api.integration.test.ts`: この仕組みそのもの（シードのデータがあること、あるテストが書いたものが次のテストに残らないこと、トークンのないリクエストをテスト用のサーバーが受け付けないこと、テスト用のサーバーが返す認証アプリのコードを API が受け付けること、ブラウザーから呼ぶための API が、指定したポートで待ち受け、指定したオリジンだけを許可すること）

画面を操作するテストは、`@testing-library/user-event` で入力し、ボタンを押します。2 要素認証の画面のテストは、API で 2 要素認証を設定し、認証アプリのコードを `testApi().authenticatorCode(secret)` で得ます（テストには認証アプリがないため、テスト用のサーバーが計算します）。

書き方は、スキル [frontend-testing](../.claude/skills/frontend-testing/SKILL.md) にあります。API のモックサーバーはありません。

### 実際のブラウザーで通すテスト（`pnpm test:e2e`）

`frontend/e2e` に、実際のブラウザー（Playwright の Chromium）を操作するテストがあります。ビルドした 3 つのアプリを、同じテスト用のサーバーの API と PostgreSQL に対して操作します。ここでも、何も差し替えません。ファイル名は `*.e2e.test.ts` です。

- 実行のはじめに、テスト用のサーバーを起動し、その上に API を 1 つ、ポート 4100 で起動します。この API は、3 つのアプリのオリジンからの呼び出しを許可します（CORS）
- 3 つのアプリを、その API のために `vite build --mode test` でビルドして（`VITE_BACKEND_BASE_URL` は、環境変数が `.env.test` より優先されます）、配信します。portal-app は 4101、admin-app は 4102、dashboard-app は 4103 です。どれもこのマシンだけで待ち受け、開発サーバー（3000〜3003）とは別のポートなので、`pnpm dev` と同時に動かせます
- アプリは 1 つの API のためにビルドされるので、テストは 1 つずつ順に実行します。テストが終わるたびに、API の DB は新しい複製に替わります。ブラウザーの状態（`localStorage` など）は、テストごとに新しいものです
- アプリのビルドは、ワークスペースのパッケージの `dist/` を読みます。`pnpm test:e2e` は、先にパッケージをビルドします
- ブラウザーは、`pnpm test:e2e:install` で入れます（最初の 1 回と、Playwright を更新したあと）

ここで確かめるのは、主要な経路の全体と、jsdom では確かめられないことです。画面の状態の 1 つ 1 つ（メッセージ、断られた試行、ロールごとの表示）は、jsdom の結合テストで確かめます。

- `src/sign-in.e2e.test.ts`: 開こうとしたアドレスにサインインの画面が出て、サインインするとそのアドレスの画面が出ること、空の欄では何も送らず、最初の欄へフォーカスが移ること、誤ったパスワード、キーボードだけでのサインイン、読み込み直してもサインインが続くこと、別のタブでのサインアウトがこのタブにも及ぶこと、2 要素認証のコード
- `src/applications.e2e.test.ts`: アプリごとの、使えるロールと使えないロール、portal-app のサインインとサインアウト、スマートフォンの幅（390px）の画面

テストが開いた画面では、アクセシビリティ（WCAG 2.2 AA。ブラウザーが描画するので、色のコントラストを含む）、横にはみ出さないこと、flex で配置された要素がないことを確かめます（`src/checks.ts`）。

## 関連ドキュメント

- [Type Generation System](./type-generation-system.md)
- [OpenAPI TypeScript 型利用ガイド](./openapi-typescript-usage.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [認証と認可](./authentication.md)
- [Architecture Overview](./architecture-overview.md)
