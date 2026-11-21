# 開発ワークフローガイド

セットアップから、日々の開発、コミット前の確認、CI までの手順をまとめます。
ここに出てくるコマンドは、ルートの `package.json` の `scripts` と `Makefile`
にあるものだけです。`make help` で Makefile のターゲット一覧を表示できます。

## 目次

1. [セットアップ](#セットアップ)
2. [日々の開発](#日々の開発)
3. [TypeSpec を変更する](#typespec-を変更する)
4. [データベースを変更する](#データベースを変更する)
5. [エンドポイントやドメインを追加する](#エンドポイントやドメインを追加する)
6. [依存関係を追加する](#依存関係を追加する)
7. [バグを修正する](#バグを修正する)
8. [コミット前の確認](#コミット前の確認)
9. [CI が実行する内容](#ci-が実行する内容)
10. [トラブルシューティング](#トラブルシューティング)

## セットアップ

### 必要なもの

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | 26.13.1 | `.node-version` で固定。fnm など、このファイルを読むバージョンマネージャーなら自動で切り替わる |
| pnpm | 12.21.0 | `package.json` の `packageManager` で固定 |
| PostgreSQL | 18 | Docker で起動する（`make infra-up`）か、手元のインスタンスを使う |
| Docker | - | `make infra-up`、testcontainers を使う統合テスト、イメージのビルドに必要 |

### 初回の手順

```bash
pnpm install        # 依存関係をインストールする。husky の pre-commit フックも設定される
make infra-up       # PostgreSQL、Mailpit（メールの受信サーバー）、SeaweedFS（添付ファイルの保存先）を Docker で起動し、使えるようになるまで待つ
pnpm db:fresh       # sql/setup.sql からスキーマを作成する
pnpm db:seed        # サンプルデータを投入する（任意）。ログインできるアカウントも作る
pnpm dev            # バックエンド :3000、フロントエンド :3001〜3003
```

- **`pnpm db:seed` が作るアカウント**は、すべて同じパスワード
  （`backend/packages/database/src/seeds/seed-data/users.ts` の `SEED_PASSWORD`）でログインできます。
  公開されているパスワードなので、`NODE_ENV=production` では `pnpm db:seed` は実行を拒否します。
  アカウントの一覧は [認証と認可](./authentication.md#シードのアカウント) にあります。
- **生成ファイルはコミット済み**です。TypeSpec を変更しない限り `pnpm generate` は不要です。
- **ビルドが必要なのは `pnpm typecheck` とビルド済みサーバーの起動（`pnpm start:backend`）だけ**です。
  `pnpm dev:backend`、データベースのコマンド（`pnpm db:fresh` など）、テストは、エクスポート条件
  `@beauty-salon-backend/source` によってワークスペースパッケージをソースから読みます。クローン直後でも
  動き、依存先のパッケージを変更してもビルドし直す必要はありません。
- **`make infra-up` のサービスは、1 台のマシンに 1 組**です。`docker-compose.yml` は、Compose の
  プロジェクト名（`beauty-salon`）、コンテナの名前、ホストのポートを固定しています。リポジトリを
  別のディレクトリにも置いている場合（`git worktree`、2 つ目の clone）、どのディレクトリから実行しても、
  同じコンテナとボリュームを指します。ポートは、どれも `127.0.0.1` にだけ公開するので、ほかのマシンからは
  届きません。
- **手元で起動するサーバーも、このマシンだけで待ち受けます**。バックエンドは `.env.localhost` の
  `HOST=127.0.0.1`、フロントエンドの開発サーバーとプレビューは各アプリの `vite.config.ts` の
  `server.host` です。`pnpm db:seed` が作るアカウントのパスワードはリポジトリに書いてあるので、
  同じネットワークのほかのマシンから届かないようにしています。画面をほかの端末から開くときは、
  その実行だけ `--host` を付けます（[環境変数](./env-configuration.md#フロントエンドの環境変数)）。
- **`make infra-up` の PostgreSQL** は `docker-compose.yml` の既定値で起動し、`.env.localhost` の
  `DATABASE_URL` はそれに合わせてあります。
- **`pnpm db:seed` は、データのないデータベースに投入します**。決まった行を入れるので、データが
  あるところへ足すことはできません。データがあると、何も書き込まずに終了コード 1 で終わり、
  選択肢を表示します。入れ直すときは `pnpm db:seed --reset`（全テーブルの行を消してから投入）、
  データがあればそのままにするときは `pnpm db:seed --if-empty` です。「データがある」は、サロンが
  1 件以上あることです。
- **`make infra-up` の Mailpit** は、サーバーが送るメール（メールアドレスの確認、パスワードの再設定など）を
  受け取ります。メールは外へ送られず、`http://localhost:8025` で読めます。`.env.localhost` の `SMTP_*` は
  この Mailpit に合わせてあります（[メール送信](./email.md#ローカル開発mailpit)）。
- **`make infra-up` の SeaweedFS** は、添付ファイルの中身を置く S3 互換のオブジェクトストレージです
  （`http://localhost:8333`）。バケットは起動のときに作られ、`.env.localhost` の `STORAGE_*` は
  この SeaweedFS に合わせてあります（[添付ファイル](./attachments.md#ローカル開発seaweedfs)）。
- **Docker を使わない場合**は、PostgreSQL 18 を用意し、シェルで `DATABASE_URL` を設定します
  （プロセスの環境変数は `.env` ファイルより優先されます）。メールを受け取るには SMTP サーバーも用意し、
  `SMTP_*` を設定します。SMTP サーバーがなくてもサーバーは起動しますが、メールは届かず、送信の失敗が
  ログに残ります。添付ファイルを使うには S3 互換のオブジェクトストレージも用意し、`STORAGE_*` を
  設定します。ストレージがなくてもサーバーは起動しますが、添付ファイルのアップロードの完了と削除が
  500 になります。

### 環境変数ファイル

ローカル開発のために `.env` を作る必要はありません。`NODE_ENV` を指定しなければ、サーバーも
データベースのスクリプトも `.env.localhost` を読み込みます。どのファイルがいつ使われるか、
各変数の意味と制約は [環境変数設定ガイド](./env-configuration.md) を参照してください。

## 日々の開発

### 起動

| コマンド | 内容 |
|----------|------|
| `pnpm dev` | フロントエンドのパッケージをビルドしたあと、全パッケージの `dev` を並列実行する。バックエンド（:3000）、portal-app（:3001）、admin-app（:3002）、dashboard-app（:3003） |
| `pnpm dev:backend` | バックエンドのみ。ソースの変更で再起動する |
| `make backend-dev` | `make infra-up` のあとに `pnpm dev:backend` を実行する |
| `pnpm dev:watch:admin-app` | admin-app と、フロントエンドのパッケージの watch ビルドを同時に起動する（`portal-app`、`dashboard-app` も同様） |

バックエンドは起動時に設定を検証し、データベースに接続できることを確認します。どちらかに失敗すると
起動しません（[トラブルシューティング](#トラブルシューティング)）。SMTP サーバーには、メールを送るときに
だけ接続します。

```bash
curl http://localhost:3000/api/system/ready   # データベースに接続できていれば 200
curl http://localhost:3000/api/v1/salons      # サロン一覧（認証なしで呼べる）
```

実装済みの API は、Salon ドメイン、サロンのサービスカテゴリー
（`/api/v1/salons/{salonId}/service-categories`）、サロンのサービス
（`/api/v1/salons/{salonId}/services`）、サロンのスタッフ台帳
（`/api/v1/salons/{salonId}/staff` の一覧、登録、1 件の取得、更新、削除）、
スタッフの勤務スケジュール（`/api/v1/salons/{salonId}/staff/{id}/schedules` の一覧、更新）、
スタッフのログインアカウントへの招待（`/api/v1/salons/{salonId}/staff/{id}/invitation` の取得、作成、取り消しと、
`/api/v1/auth/staff-invitation` の確認、受け入れ、参加）、
スタッフに紐づいたアカウント（`/api/v1/salons/{salonId}/staff/{id}/account` の取得、ロールの変更、紐づけの解除）、
顧客に見せるスタッフのプロフィール（`/api/v1/staff-profiles` の一覧、1 件の取得）、
スタッフ本人のプロフィール（`/api/v1/staff-profiles/me` の取得、更新）、
顧客台帳（`/api/v1/customers` の一覧、登録、1 件の取得、更新、削除）、
顧客本人のプロフィール（`/api/v1/customers/me` の取得、作成、更新）、
顧客の好み設定（`/api/v1/customers/{id}/preferences` と `/api/v1/customers/me/preferences` の取得、更新）、
予約台帳（`/api/v1/bookings` の一覧、作成、1 件の取得、更新、削除、ステータスの 5 つの操作、日時の変更と、
`/api/v1/bookings/{bookingId}/services` の施術明細の追加、1 件の取得、削除）、
空き枠（`/api/v1/salons/{salonId}/available-slots` の一覧と確認）、
顧客が自分で入れる予約（`/api/v1/customers/me/bookings` の一覧、作成、1 件の取得、キャンセル、日時の変更）、
売上台帳（`/api/v1/sales` の一覧、作成、1 件の取得、更新、取り消し、`/api/v1/sales/{id}/receipt` のレシート、`/api/v1/sales/calculate` の金額の計算）、
支払い方法（`/api/v1/salons/{salonId}/payment-methods` の一覧、作成、1 件の取得、更新、削除）、
商品（`/api/v1/salons/{salonId}/products` の一覧、作成、1 件の取得、更新、削除）、
在庫（`/api/v1/inventory` の一覧、作成、1 件の取得、更新、削除、`/low-stock` の在庫僅少、`/expiring` の期限切れ間近、`/movement` の在庫の移動の記録、`/{id}/movements` の履歴、`/stock-count` の棚卸し、`/value-report` の在庫評価額）、
売上の支払い（`/api/v1/sales/{id}/process` の記録と、`/api/v1/payments/{id}/refund` の返金）、
売上レポート（`/api/v1/sales-reports` の期間のレポート、1 日の売上、スタッフ別、カテゴリー別、推移、CSV の出力）、
ポイント台帳（`/api/v1/points` の顧客の残高、履歴、有効期限が近いポイント、付与、利用、調整、失効）、
レビュー（`/api/v1/reviews` の一覧、投稿、1 件の取得、修正、削除、参考になった、通報、サロンからの返信と、`/api/v1/review-reports` の通報の一覧と却下、サロンとスタッフのレビューの集計）、
認証のすべてのオペレーション（`/api/v1/auth` のログイン、トークンの更新、
ログアウト、現在のユーザーの取得、ユーザー登録、メールアドレスの確認、パスワードの再設定と変更、
スタッフの招待の確認、受け入れ、参加、2 要素認証、セッションの一覧と無効化、および `/api/v1/admin/auth` の管理者の操作）、
システムエンドポイント（`/api/system/alive`、`/api/system/ready`、`/api/system/health`）だけです。
顧客と支払いとレビューのそれ以外のオペレーションと他のドメインは、TypeSpec とデータベーススキーマにだけ存在します。

サロン、サービスカテゴリー、サービスの作成・更新・削除（サービスは一括更新も）にはアクセストークンが
必要です。顧客台帳は、一覧と取得を含むすべてのオペレーションに、`admin` か、サロンの `owner`・
`manager`・`staff` のアクセストークンが必要です（削除は `staff` にはできません）。
スタッフ台帳は、一覧と取得を含むすべてのオペレーションに、`admin` か、そのサロンの `owner` の
アクセストークンが必要です。スタッフのプロフィールは、認証なしで読めます。
スタッフ本人のプロフィールには、サロンに届く `owner`・`manager`・`staff` のアクセストークンが必要です。
顧客本人のプロフィールには、顧客のアカウントのアクセストークンが必要です。
顧客の好み設定は、台帳のルートには顧客台帳と同じアクセストークンが、本人のルートには
プロフィールのある顧客のアカウントのアクセストークンが必要です。
予約台帳は、すべてのオペレーションに、`admin` か、予約のサロンの `owner`・`manager`・`staff` の
アクセストークンが必要です。顧客のアカウントでは使えません。
売上台帳も、すべてのオペレーションに、`admin` か、売上のサロンの `owner`・`manager`・`staff` の
アクセストークンが必要で、顧客のアカウントでは使えません（売上の取り消しは、`staff` も使えません）。
レシートと金額の計算も、同じアクセストークンで使えます。どちらも何も書かないので、シードのデータで試せます。
支払い方法は、読むのに、`admin` か、そのサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、
設定（作成、更新、削除）は、`staff` にはできません。顧客のアカウントでは使えません。
商品も、読むのに、`admin` か、そのサロンの `owner`・`manager`・`staff` のアクセストークンが必要で、
作成、更新、削除は、`staff` にはできません。顧客のアカウントでは使えません。シードの商品のうち、在庫のレコードがある 6 件は削除できません（409）。
在庫も同じアクセストークンで使え、作成、更新、削除は、`staff` にはできません。シードの在庫の行は、使用期限（2025-12-31）が
過ぎているので、期限切れ間近の一覧に出ます。在庫があるので、削除できません（409）。
在庫の移動は、`staff` も仕入れ、販売、施術での使用、返品を記録できます（調整、廃棄、移動、棚卸し、在庫評価額は、`staff` にはできません）。シードの在庫の行は、在庫数 20 の開始の在庫移動を 1 件ずつ持っています。
支払いの記録には、売上台帳と同じアクセストークンが必要で、返金は、`staff` にはできません。
売上レポートは、`admin` か、そのサロンの `owner`・`manager` のアクセストークンで読めます（`staff` は読めません）。シードには売上がないので、売上を作成するまで、どの値も 0 です。
ポイント台帳は、`admin` か、どのサロンの `owner`・`manager`・`staff` のアクセストークンでも使えます（調整は、`staff` にはできません。失効は、`admin` だけができます）。シードの 4 人の顧客は、ポイントの残高と、それと同じ開始残高の調整を 1 件ずつ持っています。
レビューと、その集計は、認証なしで読めます。投稿と修正は、済んだ予約の顧客のアカウントだけが、削除は、その顧客と `admin` ができます。参考になったは、顧客のアカウントが、ほかの顧客のレビューに 1 回だけできます。通報は、顧客のアカウントと、レビューのサロンの `owner`・`manager` が 1 回だけでき、通報の一覧と却下は `admin` だけができます。返信は、レビューのサロンの `owner`・`manager` が書き、`admin` は取り下げだけができます。シードには、済んだ来店へのレビューが 5 件あり、サロンの評価とレビュー件数は、そこから数えた値です。レビューの参考になった数は、シードの顧客が評価した数です。シードには、`admin` が却下した通報と、`pending` の通報が 1 件ずつあります。
シードのアカウントでログインしてトークンを取得する手順と、ロールごとの権限は
[認証と認可](./authentication.md) を、サービスカテゴリーとサービスの規則は
[サービスメニュー](./service-menu.md) を、顧客台帳、顧客本人のプロフィール、好み設定の規則は
[顧客台帳](./customers.md) を、スタッフ台帳の規則は [スタッフ台帳](./staff.md) を、予約台帳の規則は
[予約台帳](./bookings.md) を、売上台帳の規則は [売上台帳](./sales.md) を、支払い方法と支払いの規則は
[支払い](./payments.md) を、商品の規則は [商品](./products.md) を、在庫の規則は [在庫](./inventory.md) を、発注の規則は [発注](./purchase-orders.md) を、在庫のアラートの規則は [在庫のアラート](./inventory-alerts.md) を、施術記録の規則は [施術記録](./treatments.md) を、売上レポートの規則は [売上レポート](./sales-reports.md) を、ポイント台帳の規則は
[ポイント台帳](./points.md) を、レビューの規則は [レビュー](./reviews.md) を、添付ファイルの規則は
[添付ファイル](./attachments.md) を参照してください。

ユーザー登録やパスワードの再設定で送られるメールは Mailpit（`http://localhost:8025`）に届きます。
メールのリンクは、portal-app（`pnpm dev` で `http://localhost:3001`）の `/verify-email`、`/reset-password`、
`/accept-staff-invitation` を開きます。画面を使わずに、リンクの `#token=` のあとの値を API に送って続ける
手順の例は、[メール送信](./email.md#ローカル開発mailpit) にあります。

### Docker Compose で全体を起動する

```bash
make docker-up     # 全サービスを起動する（バックエンドのコンテナを含む）
make docker-logs   # ログを追う
make docker-down   # 停止する
make docker-clean  # 停止してボリュームも削除する（データベースの中身が消える）
```

`docker-compose.yml` の `migration` サービスが、バックエンドの起動前に `db:migrate` と
`db:seed --if-empty` を実行します。空のデータベースにはスキーマとサンプルデータを作り、
既存のデータベースには未適用のマイグレーションだけを適用するので、データは保持されます。
バックエンドのコンテナは、同じ Compose の `mailpit` サービスにメールを送ります
（`SMTP_HOST` が `mailpit` に上書きされる）。添付ファイルの保存先には、同じ Compose の `storage`
サービスに接続します（`STORAGE_ENDPOINT` が `http://storage:8333` に上書きされる。ブラウザーに渡す
URL は `http://localhost:8333` のまま）。

### ポート

| サービス | ポート |
|----------|--------|
| バックエンド API | 3000 |
| portal-app / admin-app / dashboard-app（`pnpm dev`、`pnpm preview:frontend`） | 3001 / 3002 / 3003 |
| admin / portal / dashboard の Docker イメージ | 4001 / 4002 / 4003 |
| PostgreSQL | 5432 |
| Mailpit（SMTP / 受け取ったメールの画面） | 1025 / 8025 |
| SeaweedFS（添付ファイルの保存先の S3 API） | 8333 |

## TypeSpec を変更する

API の契約は `specs/` の TypeSpec が出発点です。モデルと列の対応ルールは
[TypeSpec API 型定義ルール](./typespec-api-type-rules.md)、生成の仕組みは
[型生成システム](./type-generation-system.md) を参照してください。

```bash
# 1. specs/models/ や specs/operations/ の .tsp を編集する

# 2. 生成する（編集中は pnpm generate:watch で変更のたびに再生成できる）
pnpm generate
#   pnpm generate:spec     TypeSpec → OpenAPI
#   pnpm generate:api      OpenAPI → フロントエンドの API クライアント（orval）
#   pnpm generate:backend  OpenAPI → バックエンドの型（openapi-typescript）

# 3. 生成された型に合わせて実装とテストを直す

# 4. API モデルとデータベーススキーマの整合を確認する
pnpm check:api-db
```

生成されるファイル:

| 出力先 | 内容 |
|--------|------|
| `specs/tsp-output/@typespec/openapi3/generated/openapi.yaml` | OpenAPI ドキュメント |
| `backend/packages/generated/src/` | バックエンドの型（`api-types.ts`）と Zod スキーマ（`schema.ts`） |
| `frontend/packages/api-client/src/generated/` | フロントエンドの API クライアント（`endpoints/`、`models/`） |

生成ファイルは TypeSpec の変更と同じコミットに含めます。`pnpm check:generated` は再生成したうえで
コミット済みの内容と比較し、差分があれば失敗します（CI でも実行されます）。未コミットの生成物が
あると失敗するので、コミットしてから実行します。

## データベースを変更する

データベースが Drizzle スキーマの正です。`schema.ts` を手で編集するのではなく、SQL マイグレーションを
書いて、そこからスキーマを生成し直します。以下のコマンドはすべて、起動中の PostgreSQL が必要です。

```bash
# 1. マイグレーションを書く（YYYYMMDDHHMM_description.sql）
#    backend/packages/database/sql/migrations/ に置く

# 2. 適用する。未適用のものだけが、名前順に、1 ファイル 1 トランザクションで適用される
pnpm db:migrate

# 3. schema.ts と relations.ts を再生成する（drizzle-kit はこの読み取りにだけ使う）
pnpm db:introspect

# 4. sql/setup.sql を再生成する
pnpm db:generate-sql

# 5. マイグレーション、schema.ts、relations.ts、sql/setup.sql をコミットする
```

- 適用済みのマイグレーションは `migration_history.applied_migrations` に記録されます。どこかで
  適用されたマイグレーションは編集せず、新しいファイルを書きます。
- 作成中のマイグレーションを試すには `pnpm db:migrate <ファイル>` を使います。そのファイルだけを
  実行し、適用済みとして記録しません。相対パスは `backend/packages/database` からの相対です。
- 空のデータベースに対する `pnpm db:migrate` は `sql/setup.sql` からスキーマを作り、既存の
  マイグレーションをすべて適用済みとして記録します。
- `pnpm check:db-schema`（`make db-check`）は、データベースを作り直して `schema.ts`、`relations.ts`、
  `sql/setup.sql` を再生成し、コミット済みの内容と一致するかを確認します。**接続先のデータベースの
  中身はすべて削除されます。**
- マイグレーションを追加しただけで 3・4 を実行していないと、統合テスト（`pnpm test:integration`）が
  失敗します。`sql/setup.sql` から作ったデータベースにマイグレーションを適用すると、スキーマが
  変わるからです。
- 列を変えたら API モデルも合わせます。`pnpm check:api-db` が OpenAPI ドキュメントとスキーマを比較します。

その他のコマンド:

| コマンド | 内容 |
|----------|------|
| `pnpm db:fresh` | すべて削除し、`sql/setup.sql` からスキーマを作り直す |
| `pnpm db:seed` | データのないデータベースに、サンプルデータを投入する。データがあると、何も書き込まずに失敗する。`--reset` は全テーブルの行を消してから投入し、`--if-empty` はデータがあれば何もせずに成功する。本番環境（`NODE_ENV=production`）では実行を拒否する |
| `pnpm db:truncate` | 全テーブルの行を削除する。スキーマは残る |

接続先は `DATABASE_URL` で決まります。別のデータベースを対象にするときは、コマンドの前に
`DATABASE_URL=...` を付けます（[環境変数設定ガイド](./env-configuration.md)）。

## エンドポイントやドメインを追加する

Salon ドメインがリファレンス実装です。新しいドメインは同じ構成・同じ順序で追加します。規約は
ルートの `CLAUDE.md`、各層の詳細は [ドメイン実装リファレンス](./domain-implementation-reference.md)
にあります。ここでは作業の順序と、手本にする Salon のファイルだけを示します。

| 順序 | 作業 | Salon での場所 |
|------|------|----------------|
| 1 | テーブルを追加・変更する（[データベースを変更する](#データベースを変更する)） | `backend/packages/database/sql/migrations/` |
| 2 | モデルと操作を TypeSpec に定義し、生成する（[TypeSpec を変更する](#typespec-を変更する)） | `specs/models/salon.tsp`、`specs/operations/salon-operations.tsp` |
| 3 | モデルの型（DB スキーマと生成された API 型から導出） | `backend/packages/domain/src/models/salon.ts` |
| 4 | リクエストの Zod スキーマ | `backend/packages/domain/src/schemas/salon.schema.ts` |
| 5 | マッパー（Write マッパーがリクエストを作り替えるのは、表現を変える列があるときと、リクエストが複数のテーブルの行を含むときだけ。どちらもないサービスカテゴリーには Write マッパーがなく、顧客の Write マッパーはリクエストをそのまま行として返す） | `backend/packages/domain/src/mappers/read/salon.mapper.ts`、`backend/packages/domain/src/mappers/write/salon.mapper.ts` |
| 6 | リポジトリのインターフェースと実装 | `backend/packages/domain/src/repositories/salon.repository.ts`、`backend/packages/infrastructure/src/repositories/salon.repository.impl.ts` |
| 7 | ユースケースと権限の判定（公開でないオペレーションは `actor` を受け取り、最初に権限を判定する） | `backend/packages/domain/src/business-logic/salon/`、その中の `_shared/authorization.ts` |
| 8 | ハンドラーとルーター、アプリへの登録（公開でないオペレーションのハンドラーは `authenticated` で包む） | `backend/packages/api/src/routes/salon/`、`backend/packages/api/src/index.ts` |
| 9 | API と DB の整合ルールにモデルを登録する | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 10 | テスト（スキーマ・マッパー・ユースケースの単体テスト、エンドポイントごとの統合テスト。公開でないオペレーションは、許可されるユーザーと拒否されるユーザーの両方） | `backend/packages/domain/src/__tests__/`、`backend/packages/api/src/__tests__/salon.integration.test.ts` |

データが 1 つのサロンに属するドメインは、ルートをサロンの下（`/api/v1/salons/{salonId}/…`）に置きます。
手本はサービスカテゴリー（`backend/packages/domain/src/business-logic/service-category/`、
`backend/packages/api/src/routes/service-category/`）で、Salon と違う点は
[ドメイン実装リファレンス](./domain-implementation-reference.md#data-that-belongs-to-a-salon) にまとめてあります。
サービスカテゴリーにないもの（2 つのテーブルの行を含むリクエスト、2 つの項目を結ぶ規則、一括更新、
論理削除）は、サービス（`backend/packages/domain/src/business-logic/service/`、
`backend/packages/api/src/routes/service/`）が手本で、同じ節に挙げてあります。
サロンに属し、公開のオペレーションがないデータは、スタッフ台帳
（`backend/packages/domain/src/business-logic/staff/`、`backend/packages/api/src/routes/staff/`）が
手本です。一覧と取得を含むすべてのオペレーションで、パスのサロンだけで最初に権限を判定します。
これも同じ節に挙げてあり、規則は [スタッフ台帳](./staff.md) にあります。
公開のオペレーションがなく、読める人と書ける人が違うデータは、支払い方法
（`backend/packages/domain/src/business-logic/payment-method/`、
`backend/packages/api/src/routes/payment-method/`）が手本です。読む権限と設定する権限を、
どちらもパスのサロンだけで判定し、更新は、行をロックしてから、2 つの項目を結ぶ規則を
更新後の行で確かめます。これも同じ節に挙げてあり、規則は [支払い](./payments.md) にあります。
3 つの項目を結ぶ規則があり、ほかのテーブルの行がある間は削除を断る論理削除のデータは、商品
（`backend/packages/domain/src/business-logic/product/`、`backend/packages/api/src/routes/product/`）が
手本です。組ごとに比べる純粋な関数を、スキーマとリポジトリの両方が使い、削除は、行をロックしてから
在庫の行を探します。これも同じ節に挙げてあり、規則は [商品](./products.md) にあります。
ほかのテーブルの値で決まる規則があり、ルートをサロンの下に置かないマスターは、在庫
（`backend/packages/domain/src/business-logic/inventory/`、`backend/packages/api/src/routes/inventory/`）が
手本です。ロット番号の規則は、商品の行をロックしてから確かめ、ロット番号のない行の一意性は、部分一意
インデックスが守ります。これも同じ節に挙げてあり、規則は [在庫](./inventory.md) にあります。
レコードの下に行を書き、その行からレコードの値を数え直すデータは、売上の支払い
（`backend/packages/domain/src/business-logic/payment/`、`backend/packages/api/src/routes/payment/`）が
手本です。レコード（売上）の行をロックしてから下の行を読み、値を数え、行と値を 1 つのトランザクションで
書きます。これも同じ節に挙げてあり、規則は [支払い](./payments.md#支払いの記録と返金) にあります。
サロンの 1 つのレコードに属し、全体をまとめて置き換える行は、スタッフの勤務スケジュール
（`backend/packages/domain/src/business-logic/staff-schedule/`、
`backend/packages/api/src/routes/staff-schedule/`）が手本です。ルーターをレコードの下にマウントし、
権限をサロンと対象の 2 段階で判定し、リポジトリが行をロックして 1 つのトランザクションで置き換えます。
メールで送ったトークンで届くレコードは、スタッフの招待
（`backend/packages/domain/src/business-logic/staff-invitation/`、
`backend/packages/api/src/routes/staff-invitation/`）が手本です。招待する側のルーターと、
トークンを持つ人のための公開のルーターを分け、リポジトリが結果を直和型で返し、
書き込みの前にスタッフの行をロックして、判定に使う値を読み直します。
ほかのテーブルの行の一部を、サロンに読ませて書かせるときは、スタッフのアカウント
（`backend/packages/domain/src/business-logic/staff-account/`、
`backend/packages/api/src/routes/staff-account/`）が手本です。見せるカラムだけを読むリポジトリ、
カラムの Enum より狭い API の Enum、操作者自身のアカウントを守る規則があります。
公開しないデータの一部を誰にでも見せるときは、スタッフのプロフィール
（`backend/packages/domain/src/business-logic/staff-profile/`、
`backend/packages/api/src/routes/staff-profile/`）が手本です。見せる項目だけのモデル、リポジトリ、
ユースケース、ルーターを、台帳とは別に持ちます。
レコードの持ち主に、自分のレコードの一部を書かせるときは、同じディレクトリのスタッフ本人のプロフィール
（`*-own-staff-profile.usecase.ts`、`*-own-staff-profile.handler.ts`）が手本です。パスに ID を置かず
（`/me`）、対象は操作者から決め、リクエストは持ち主が書ける項目だけを持ちます。

サロンに属さず、公開もしないデータは、ルートをサロンの下に置かず、すべてのオペレーションを
`authenticated` で包みます。権限は操作者だけで決まるので、ユースケースは ID、クエリ、本文を見る前に
判定します。手本は顧客台帳（`backend/packages/domain/src/business-logic/customer/`、
`backend/packages/api/src/routes/customer/`）で、権限は
[認証と認可](./authentication.md#顧客台帳の権限)、規則は [顧客台帳](./customers.md) にあります。

サロンに属するが、コントラクトがルートをサロンの下に置いていないデータは、サロンをパスから
受け取れません。操作者に届く範囲を最初に決め、リクエストの本文やクエリがサロンを指定したところで、
そのサロンが範囲に入るかを判定します。保存されている行を読むクエリには、範囲を条件として渡します。
リクエストが行の一部しか持たず、残りを参照する行から決めるときは、その計算を純粋な関数にして、
参照する行をロックしたトランザクションの中で呼びます。手本は予約台帳
（`backend/packages/domain/src/business-logic/booking/`、`backend/packages/api/src/routes/booking/`）で、
権限は [認証と認可](./authentication.md#予約台帳の権限)、規則は [予約台帳](./bookings.md) にあります。
売上台帳（`backend/packages/domain/src/business-logic/sale/`、`backend/packages/api/src/routes/sale/`）も
同じ形です。リクエストが金額まで持つので、行を決める関数は、算出するよりも、確かめます
（[売上台帳](./sales.md)）。

テストの基準は [テスト要件](./testing-requirements.md)、統合テストの書き方は
[API テストガイド](./api-testing-guide.md) を参照してください。

## 依存関係を追加する

依存関係は、それを使うパッケージに追加します。

```bash
pnpm --filter @beauty-salon-backend/api add <パッケージ名>
pnpm --filter @beauty-salon-frontend/portal-app add -D <パッケージ名>
```

- 追加後に `pnpm knip` を実行すると、使われていない依存関係・ファイル・エクスポートが分かります。
- 新しいリリースがある依存関係は `pnpm update:check` で一覧できます。
- CI は `pnpm audit --audit-level=high` で脆弱性を確認します（`make audit`）。
- 修正版のない勧告は、`pnpm-workspace.yaml` の `audit.ignore` に載せ、理由と外す条件をコメントに書き、イシューで追います。いま載せているのは、開発ツールからだけ入る picomatch の [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) です（#226）。本番の依存関係（`pnpm audit --prod`）には、除外している勧告はありません。

## バグを修正する

1. 不具合を再現するテストを、修正する層のテストに追加する。たとえばユースケースなら
   `backend/packages/domain/src/__tests__/salon.usecase.test.ts`、HTTP の振る舞いなら
   `backend/packages/api/src/__tests__/` の統合テスト
2. テストが失敗することを確認する
3. 修正し、テストが通ることを確認する

```bash
pnpm --filter @beauty-salon-backend/domain run test                      # パッケージの単体テスト
pnpm --filter @beauty-salon-backend/domain run test salon.usecase        # ファイル名で絞り込む
pnpm --filter @beauty-salon-backend/api run test:integration salon       # 統合テスト（PostgreSQL が必要）
```

調査には構造化ログを使います。`.env.localhost` では `LOG_LEVEL=debug`、`LOG_FORMAT=pretty` です。
レスポンスの `X-Request-Id` ヘッダー（成功時は `meta.correlationId`、エラー時は `correlationId`）と
同じ ID が、そのリクエストのすべてのログ行に付きます。アプリケーションコードに `console` は書きません。

## コミット前の確認

```bash
pnpm format:fix    # Biome の整形・import の並べ替え・安全な修正を適用し、TypeSpec も整形する
pnpm lint          # Biome の lint
pnpm typecheck     # 型チェック（先にビルドが必要）
pnpm test          # 単体テスト
```

まとめて確認するには `make ci-check` を使います。CI ワークフローのチェックを、次の順に実行します。
最初の失敗で止まります。

```bash
pnpm install --frozen-lockfile
pnpm check:versions     # Node.js のバージョン指定が .node-version と一致しているか
pnpm check:generated    # 生成ファイルが TypeSpec と一致しているか
pnpm check:api-db       # API モデルとデータベーススキーマが一致しているか
pnpm lint
pnpm format:check
pnpm build:prod
pnpm typecheck
pnpm knip
pnpm test
pnpm test:integration   # Docker が必要（TEST_DATABASE_URL を設定すると PostgreSQL のコンテナは起動しない）
pnpm test:e2e           # ブラウザーで通すテスト。先に 1 回、pnpm test:e2e:install でブラウザーを入れる
pnpm audit --audit-level=high
```

CI のチェックのうち、`pnpm check:db-schema` だけは `make ci-check` に含まれません。CI では実行されますが、
接続先のデータベースを作り直すため、手元では `make db-check` として分けてあります。スキーマや
マイグレーションを変更したときに、消えてもよいデータベースに対して実行します。

チェックとは別に、CI は `dev`・`test`・`stg` 向けのビルド（`make ci-check` は `build:prod` のみ）と、
Docker イメージのビルドも行います。イメージは、手元では `make ci-check-dockerfile` で本番用の 4 つを
ビルドできます（Docker が必要）。

### pre-commit フック

`git commit` のたびに husky が lint-staged を実行します（`.husky/pre-commit`、`.lintstagedrc.json`）。

- ステージされた `*.{ts,tsx,js,jsx,json,jsonc,css}` に `biome check --write`
- ステージされた `*.tsp` に `tsp format`

フックが行うのは整形と lint だけです。型チェックとテストは実行しません。

## CI が実行する内容

### `.github/workflows/ci.yml`

`main`・`develop` への push と、すべてのプルリクエストで実行されます。

| ジョブ | 内容 |
|--------|------|
| `quality` | `check:versions`、`check:generated`、`check:api-db`、`lint`、`format:check`、`build:prod`、`typecheck`、`knip`。OpenAPI ドキュメントをアーティファクトとして保存する |
| `scope` | 単体テストと統合テストを走らせるパッケージを決める。フロントエンド（`frontend/`）、ドキュメント（`docs/`、`.md`）、スキル（`.claude/`）だけを変えるプルリクエストでは、変えたパッケージとそれに依存するパッケージ（pnpm の `--filter "...[<ベース>]"`。ベースは、マージのコミットの 1 つ目の親）。ほかのファイルを 1 つでも変えるプルリクエストと、push では、すべてのパッケージ。画面のテストはバックエンドのテスト用サーバーを別のプロセスとして起動し、`package.json` の依存にないので、バックエンドの変更ではすべてを走らせる。ルートのファイルは、どのパッケージにも数えられない |
| `unit` | `build:prod` のあと、`scope` のパッケージの単体テスト |
| `test` | `build:prod` のあと、`scope` のパッケージの統合テストを、データベースの用意の仕方を変えて 2 通り実行する。`external`: サービスコンテナの PostgreSQL を `TEST_DATABASE_URL` で使う。`testcontainers`: テスト自身が PostgreSQL のコンテナを起動する。どちらも、すべてのパッケージのテストのファイルを 4 つに分け（Vitest の `--shard`）、1 つずつを別のジョブで並べて実行する（8 つのジョブ）。ファイルが 4 つより少ないパッケージには、ファイルのない部分ができる（`--passWithNoTests`）。`check:db-schema` は、`external` の 1 つ目の部分で実行する。メール送信の統合テストは、どちらの場合も Mailpit のコンテナを、添付ファイルの保存先の統合テストは SeaweedFS のコンテナを、自分で起動する |
| `e2e` | ブラウザーで通すテスト（`pnpm test:e2e`）。Playwright の Chromium を入れ、サービスコンテナの PostgreSQL を `TEST_DATABASE_URL` で使う。失敗したときは、レポートと、失敗したテストのトレースをアーティファクトとして保存する |
| `build` | `pnpm build:dev`、`build:test`、`build:stg`、`build:prod` をそれぞれ実行する |
| `security` | `pnpm audit --audit-level=high` |
| `publish-staging-images` | `main` への push のときだけ、上の `quality`・`unit`・`test`・`e2e`・`build` が成功したあとに `publish-images.yml` を呼び出し、staging のイメージを GitHub Container Registry に push する |

### `.github/workflows/docker-validation.yml`

Dockerfile、`backend/`、`frontend/`、`specs/`、`shared-config/`、ロックファイルなどを変更する
プルリクエストで実行されます。バックエンドと 3 つのフロントエンドのイメージをビルドし、コンテナを
起動して応答を確認します。バックエンドは `/api/system/ready` が応答することと、停止時の終了コードが
0 であることを確認します。フロントエンドは、バンドルにその環境の `VITE_*` の値が入っていることも
確認します（staging 向けのビルドは admin で確認）。

### `.github/workflows/publish-images.yml`

イメージをビルドして GitHub Container Registry に push します。`ci.yml` から呼び出されるほか、
手動でも実行できます。内容と、自動化されていない作業は
[リリースワークフローガイド](./release-workflow.md) を参照してください。

## トラブルシューティング

| 症状 | 原因と対処 |
|------|-----------|
| `pnpm typecheck` が `@beauty-salon-backend/*` や `@beauty-salon-frontend/*` を解決できずに失敗する | パッケージがビルドされていない。型検査はビルドした型定義を参照する。`pnpm build:dev` を実行する |
| バックエンドが `Invalid configuration` を出力して終了する | 環境変数が不足しているか不正。ログの `issues` に変数名と理由が並ぶ（[環境変数設定ガイド](./env-configuration.md)） |
| バックエンドが `Cannot start: the database is unreachable` を出力して終了する | PostgreSQL が起動していないか、`DATABASE_URL` が違う。`make infra-up` で起動する |
| フロントエンドの開発サーバーが起動しない | ポート 3001〜3003 が使用中。各アプリは決まったポートでしか起動しない（`strictPort`） |
| `make infra-up` が `Conflict. The container name "/beauty-salon-db" is already in use` で失敗する | 同じ名前のコンテナが、別の Compose のプロジェクトに残っている（プロジェクト名を固定する前に起動したもの。プロジェクト名は、起動したディレクトリの名前だった）。`docker rm -f beauty-salon-db beauty-salon-mail beauty-salon-storage` で消してから、`make infra-up` を実行する。前のボリュームのデータは引き継がれないので、`pnpm db:fresh` と `pnpm db:seed` で作り直す。前のボリュームは `docker volume ls` で確かめて、`docker volume rm` で消す |
| `pnpm db:seed` が `The database already has data` で失敗する | データのあるデータベースには投入しない。`pnpm db:seed --reset` で入れ直すか、そのまま使う |
| 添付ファイルのアップロードの完了や削除が 500 になる | SeaweedFS が起動していないか、`STORAGE_*` が違う。`make infra-up` で起動する。バックエンドのログに `Failed to read the stored file` などが、原因（`cause`）と一緒に出る（[添付ファイル](./attachments.md#ストレージのエラー)） |
| 登録や再設定のメールが届かない | Mailpit が起動していない。`make infra-up` で起動し、`http://localhost:8025` を開く。送信に失敗すると、バックエンドのログに `Failed to deliver mail` が出る（[メール送信](./email.md)）。ログに失敗がなければ、メールを送らない場合に当たっている（すでに登録済みのアドレス、直前に送ったばかりのときなど。[認証と認可](./authentication.md)） |
| `pnpm test:integration` がコンテナを起動できない | Docker が起動していない。`TEST_DATABASE_URL` に既存の PostgreSQL を指定すれば PostgreSQL のコンテナは不要になるが、`infrastructure` パッケージのメール送信のテストは Mailpit のコンテナを、添付ファイルの保存先のテストは SeaweedFS のコンテナを起動するので、全体の実行には Docker が必要。Docker Desktop 以外（Colima など）では、ソケットの場所を環境変数で指定する（[API テストガイド](./api-testing-guide.md#running)） |
| `pnpm test:e2e` が `Executable doesn't exist` で失敗する | Playwright のブラウザーが入っていないか、Playwright を更新した。`pnpm test:e2e:install` を実行する |
| `pnpm test:e2e` が `is already used` または `EADDRINUSE` で失敗する | ポート 4100〜4103 のどれかが使用中。ブラウザーで通すテストは、決まったポートでしか起動しない（残っているサーバーをテストしないため）。そのポートを使っているプロセスを止める |
| 生成された型と実装が合わない | `pnpm generate` を実行する |
| ビルド成果物や `node_modules` が壊れている | `pnpm clean` でビルド成果物を削除する。`pnpm fresh` はビルド成果物と `node_modules` を削除して再インストールする |
