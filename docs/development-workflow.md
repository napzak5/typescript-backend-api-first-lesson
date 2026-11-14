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
| pnpm | 12.18.0 | `package.json` の `packageManager` で固定 |
| PostgreSQL | 18 | Docker で起動する（`make infra-up`）か、手元のインスタンスを使う |
| Docker | - | `make infra-up`、testcontainers を使う統合テスト、イメージのビルドに必要 |

### 初回の手順

```bash
pnpm install        # 依存関係をインストールする。husky の pre-commit フックも設定される
make infra-up       # PostgreSQL と Mailpit（メールの受信サーバー）を Docker で起動し、両方が使えるようになるまで待つ
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
- **`make infra-up` の PostgreSQL** は `docker-compose.yml` の既定値で起動し、`.env.localhost` の
  `DATABASE_URL` はそれに合わせてあります。
- **`make infra-up` の Mailpit** は、サーバーが送るメール（メールアドレスの確認、パスワードの再設定など）を
  受け取ります。メールは外へ送られず、`http://localhost:8025` で読めます。`.env.localhost` の `SMTP_*` は
  この Mailpit に合わせてあります（[メール送信](./email.md#ローカル開発mailpit)）。
- **Docker を使わない場合**は、PostgreSQL 18 を用意し、シェルで `DATABASE_URL` を設定します
  （プロセスの環境変数は `.env` ファイルより優先されます）。メールを受け取るには SMTP サーバーも用意し、
  `SMTP_*` を設定します。SMTP サーバーがなくてもサーバーは起動しますが、メールは届かず、送信の失敗が
  ログに残ります。

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

実装済みの API は、Salon ドメイン、認証の 16 のオペレーション（`/api/v1/auth` のログイン、トークンの更新、
ログアウト、現在のユーザーの取得、ユーザー登録、メールアドレスの確認、パスワードの再設定と変更、
2 要素認証）、システムエンドポイント（`/api/system/alive`、`/api/system/ready`、`/api/system/health`）だけです。
他のドメインは TypeSpec とデータベーススキーマにだけ存在します。

サロンの作成・更新・削除にはアクセストークンが必要です。シードのアカウントでログインしてトークンを
取得する手順と、ロールごとの権限は [認証と認可](./authentication.md) を参照してください。

ユーザー登録やパスワードの再設定で送られるメールは Mailpit（`http://localhost:8025`）に届きます。
メールのリンクが指すページ（`/verify-email`、`/reset-password`）はフロントエンドにまだないので、
リンクの `#token=` のあとの値を API に送って続けます。手順の例は
[メール送信](./email.md#ローカル開発mailpit) にあります。

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
（`SMTP_HOST` が `mailpit` に上書きされる）。

### ポート

| サービス | ポート |
|----------|--------|
| バックエンド API | 3000 |
| portal-app / admin-app / dashboard-app（`pnpm dev`、`pnpm preview:frontend`） | 3001 / 3002 / 3003 |
| admin / portal / dashboard の Docker イメージ | 4001 / 4002 / 4003 |
| PostgreSQL | 5432 |
| Mailpit（SMTP / 受け取ったメールの画面） | 1025 / 8025 |

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
| `pnpm db:seed` | サンプルデータを投入する（`--if-empty` を付けるとデータがないときだけ）。本番環境（`NODE_ENV=production`）では実行を拒否する |
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
| 5 | マッパー | `backend/packages/domain/src/mappers/read/salon.mapper.ts`、`backend/packages/domain/src/mappers/write/salon.mapper.ts` |
| 6 | リポジトリのインターフェースと実装 | `backend/packages/domain/src/repositories/salon.repository.ts`、`backend/packages/infrastructure/src/repositories/salon.repository.impl.ts` |
| 7 | ユースケースと権限の判定（公開でないオペレーションは `actor` を受け取り、最初に権限を判定する） | `backend/packages/domain/src/business-logic/salon/`、その中の `_shared/authorization.ts` |
| 8 | ハンドラーとルーター、アプリへの登録（公開でないオペレーションのハンドラーは `authenticated` で包む） | `backend/packages/api/src/routes/salon/`、`backend/packages/api/src/index.ts` |
| 9 | API と DB の整合ルールにモデルを登録する | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 10 | テスト（スキーマ・マッパー・ユースケースの単体テスト、エンドポイントごとの統合テスト。公開でないオペレーションは、許可されるユーザーと拒否されるユーザーの両方） | `backend/packages/domain/src/__tests__/`、`backend/packages/api/src/__tests__/salon.integration.test.ts` |

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
| `test` | `build:prod` のあと、データベースの用意の仕方を変えて 2 通り実行する。`external`: サービスコンテナの PostgreSQL を `TEST_DATABASE_URL` で使い、単体テスト、統合テスト、`check:db-schema` を実行する。`testcontainers`: テスト自身が PostgreSQL のコンテナを起動し、統合テストだけを実行する。メール送信の統合テストは、どちらの場合も Mailpit のコンテナを自分で起動する |
| `build` | `pnpm build:dev`、`build:test`、`build:stg`、`build:prod` をそれぞれ実行する |
| `security` | `pnpm audit --audit-level=high` |
| `publish-staging-images` | `main` への push のときだけ、上の `quality`・`test`・`build` が成功したあとに `publish-images.yml` を呼び出し、staging のイメージを GitHub Container Registry に push する |

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
| 登録や再設定のメールが届かない | Mailpit が起動していない。`make infra-up` で起動し、`http://localhost:8025` を開く。送信に失敗すると、バックエンドのログに `Failed to deliver mail` が出る（[メール送信](./email.md)）。ログに失敗がなければ、メールを送らない場合に当たっている（すでに登録済みのアドレス、直前に送ったばかりのときなど。[認証と認可](./authentication.md)） |
| `pnpm test:integration` がコンテナを起動できない | Docker が起動していない。`TEST_DATABASE_URL` に既存の PostgreSQL を指定すれば PostgreSQL のコンテナは不要になるが、`infrastructure` パッケージのメール送信のテストは Mailpit のコンテナを起動するので、全体の実行には Docker が必要。Docker Desktop 以外（Colima など）では、ソケットの場所を環境変数で指定する（[API テストガイド](./api-testing-guide.md#running)） |
| 生成された型と実装が合わない | `pnpm generate` を実行する |
| ビルド成果物や `node_modules` が壊れている | `pnpm clean` でビルド成果物を削除する。`pnpm fresh` はビルド成果物と `node_modules` を削除して再インストールする |
