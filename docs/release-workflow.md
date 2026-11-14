# リリースワークフローガイド

環境ごとのビルド、Docker イメージ、GitHub Actions が行うこと、そしてリリースのうち
**自動化されていない作業**を説明します。

このリポジトリが自動で行うのは、イメージをビルドして GitHub Container Registry に push する
ところまでです。イメージをデプロイ先に展開する処理、デプロイ時のデータベースマイグレーション、
ロールバック、監視は、リポジトリに含まれていません。

## 目次

1. [自動化されている範囲](#自動化されている範囲)
2. [環境とビルド](#環境とビルド)
3. [Docker イメージ](#docker-イメージ)
4. [GitHub Actions](#github-actions)
5. [リリースの流れ](#リリースの流れ)
6. [運用者が行う作業](#運用者が行う作業)
7. [リリース前の確認](#リリース前の確認)

## 自動化されている範囲

| 作業 | 自動化 | 場所 |
|------|--------|------|
| lint・型チェック・テストなどの品質チェック | されている | `.github/workflows/ci.yml` |
| プルリクエストでのイメージのビルドと起動確認 | されている | `.github/workflows/docker-validation.yml` |
| イメージのビルドとレジストリへの push | されている | `.github/workflows/ci.yml`、`.github/workflows/deploy.yml` |
| デプロイ先の環境変数の設定 | されていない | 運用者 |
| データベースのマイグレーション | されていない | 運用者が `pnpm db:migrate` を実行する |
| イメージのデプロイ先への展開 | されていない | 運用者 |
| ロールバック、監視 | されていない | リポジトリに手順も設定もない |

## 環境とビルド

| 環境（`NODE_ENV`） | ビルド | バックエンドの環境変数ファイル | フロントエンドアプリの Vite モード |
|--------------------|--------|-------------------------------|-----------------------------------|
| `development` | `pnpm build:dev` | `.env.development` | `dev` |
| `test` | `pnpm build:test` | `.env.test` | `test` |
| `staging` | `pnpm build:stg` | `.env.staging` | `staging` |
| `production` | `pnpm build:prod`（`pnpm build` も同じ） | `.env.production` | `production` |

ローカル開発の既定は `localhost`（`.env.localhost`）です。

ビルドの違い:

- **rslib でビルドするパッケージ**（`backend/packages/*` と `frontend/packages/*`）は、`production` の
  ときだけ minify し、それ以外ではソースマップを出力します。
- **サーバーアプリ**（`backend/apps/server`）は `tsc` でビルドし、どの環境向けでも出力は同じです。
- **フロントエンドアプリ**は Vite のモードに対応する `.env.<モード>` を読み、`VITE_*` の値をビルド時に
  埋め込みます。

バックエンドのビルド成果物に設定は含まれません。設定は起動時に環境変数から読み込むので、同じ
ビルド・同じイメージをどの環境でも動かせます（[環境変数設定ガイド](./env-configuration.md)）。

### ビルドしたものを手元で動かす

```bash
pnpm build:prod         # 全パッケージを本番向けにビルドする
pnpm start:backend      # ビルド済みのバックエンドを起動する（PostgreSQL が必要）
pnpm preview:frontend   # ビルド済みのフロントエンドアプリを :3001〜3003 で配信する
```

`pnpm start:backend` は、`NODE_ENV` を指定しなければ `.env.localhost` の設定で起動します。
`NODE_ENV=staging pnpm start:backend` のように指定すると `.env.staging` を読みますが、その
`DATABASE_URL` が指すデータベースに接続できなければ起動しません。Makefile には同じことをする
パターンターゲット（`build-%`、`backend-start-%`）があります。

## Docker イメージ

### バックエンド（`Dockerfile.backend`）

| ステージ | 内容 |
|----------|------|
| `builder` | すべての依存関係をインストールし、バックエンドを `build:prod` でビルドする |
| `development` | ソースと開発用の依存関係を含む。`docker-compose.yml` の `backend` と `migration` サービスが使う |
| `production` | 本番用の依存関係と、各パッケージ・サーバーの `dist` だけを含む |

`production` ステージのイメージ:

- 非 root ユーザーで `node backend/apps/server/dist/index.js` を実行し、ポート 3000 を公開する
- `HEALTHCHECK` は `/api/system/alive` を確認する
- `NODE_ENV=production` が設定済み。`.env` ファイルは入っていないので、それ以外の設定はすべて
  コンテナの環境変数で渡す
- ソースと開発用の依存関係を含まないため、`pnpm db:migrate` などのデータベーススクリプトは
  実行できない

### フロントエンド（`Dockerfile.frontend`）

1 つの Dockerfile で 3 つのアプリをビルドします。ビルド引数 `APP`（`admin`、`portal`、`dashboard`）で
アプリを、`APP_PORT`（4001、4002、4003）でポートを選びます。

- ビルドステージは `pnpm generate`、`pnpm prepare:frontend` のあと、選んだアプリを **常に
  `build:prod`** でビルドする。`VITE_*` の値は `frontend/apps/<app>-app/.env.production` のものが
  埋め込まれる
- 実行ステージは、ビルドした静的ファイルを `serve` の SPA モードで配信する。非 root ユーザーで動き、
  `HEALTHCHECK` は `/` を確認する

### 手元でビルドを確認する

```bash
make ci-check-dockerfile     # 本番イメージ 4 つをビルドする（Docker が必要）
make docker-check-backend    # バックエンドだけ
make docker-check-frontend   # フロントエンド 3 つだけ
```

## GitHub Actions

### CI（`.github/workflows/ci.yml`）

`main`・`develop` への push とプルリクエストで品質チェックを実行します（内容は
[開発ワークフローガイド](./development-workflow.md) を参照）。`main` への push では、`quality`・`test`・
`build` の各ジョブが成功したあとに、`docker-backend` と `docker-frontend-apps` がイメージをビルドして
push します。

### Docker Build Validation（`.github/workflows/docker-validation.yml`）

Dockerfile やソースを変更するプルリクエストで、4 つのイメージをビルドし、コンテナを起動して確認します。
バックエンドは、`.env` ファイルなしで環境変数だけを渡して起動し、`/api/system/ready` が応答すること、
停止時に終了コード 0 で終わることを確認します。イメージは push しません。

### Deploy（`.github/workflows/deploy.yml`）

名前は Deploy ですが、行うのはイメージのビルドと push です。

- **きっかけ**: `main` への push（環境は `staging`）、または手動実行（`staging` か `production` を選ぶ）
- **実行環境**: 選ばれた環境と同じ名前の GitHub Environment でジョブが動く
- **バックエンド**: ランナー上で `build:stg` または `build:prod` を実行したあと、`Dockerfile.backend` の
  `production` ステージをビルドして push する
- **フロントエンド**: アプリごとに `pnpm generate`、`pnpm prepare:frontend`、`build:prod` を実行したあと、
  `Dockerfile.frontend` をビルドして push する
- **最後のステップ**はメッセージを出力するだけで、どこにもデプロイしない

知っておくべき点:

- Deploy は CI とは別のワークフローで、CI の結果を待ちません。`main` への push で両方が同時に
  始まるので、CI が失敗したコミットでも `staging` のイメージは作られます。
- イメージの中身は Dockerfile がソースからビルドします（`.dockerignore` が `dist` を除外するため、
  ランナー上のビルド結果は使われません）。バックエンドもフロントエンドも Dockerfile 内では常に
  `build:prod` なので、同じコミットの `staging` イメージと `production` イメージは同じ手順で作られ、
  違うのはタグだけです。フロントエンドの `staging` イメージにも `.env.production` の `VITE_*` が入ります。

### イメージ名とタグ

| イメージ | 名前 |
|----------|------|
| バックエンド | `ghcr.io/<owner>/<repository>-backend` |
| フロントエンド | `ghcr.io/<owner>/<repository>-frontend-admin`、`-frontend-portal`、`-frontend-dashboard` |

| ワークフロー | きっかけ | タグ |
|--------------|----------|------|
| CI | `main` への push（チェック成功後） | `main`、`main-<短縮 SHA>`、`latest` |
| Deploy | `main` への push | `staging-latest`、`staging-<短縮 SHA>` |
| Deploy | 手動実行 | `<環境>-latest`、`<環境>-<短縮 SHA>` |

## リリースの流れ

1. プルリクエストを `main` にマージする。CI と Deploy が動き、`staging-latest` と
   `staging-<短縮 SHA>` のイメージが push される
2. 本番用のイメージが必要なら、GitHub の Actions タブで Deploy ワークフローを選び、
   「Run workflow」で `production` を指定して実行する。`production-latest` と
   `production-<短縮 SHA>` のイメージが push される
3. ここから先は自動化されていない。次の節の作業を運用者が行う

## 運用者が行う作業

デプロイ先のプラットフォームはリポジトリで決まっていません。以下は、どのプラットフォームでも
必要になる作業と、そのときに前提にできるサーバーの振る舞いです。

### 1. 環境変数を設定する

サーバーは 14 個の環境変数をすべて必須とし、起動時に検証します。不足や不正があれば、変数名の一覧を
ログに出力して終了コード 1 で終了します。新しいバージョンが変数を追加している場合は、起動前に
デプロイ先へ設定します。変数の一覧はルートの [README](../README.md) の "Operating the API Server" と
[環境変数設定ガイド](./env-configuration.md) にあります。

### 2. データベースをマイグレーションする

新しいバージョンを起動する**前**に、対象のデータベースへ `pnpm db:migrate` を実行します。

```bash
DATABASE_URL=<対象データベースの接続 URL> pnpm db:migrate
```

- 本番イメージでは実行できません。リリースするコミットをチェックアウトし、依存関係のインストールと
  バックエンドのビルド（`pnpm build:backend`）を済ませた環境で実行します。
- `DATABASE_URL` はプロセスの環境変数で明示します。未設定の場合は `.env` または `.env.<NODE_ENV>` の
  値が使われます。
- 空のデータベースには `sql/setup.sql` からスキーマを作り、それ以外には未適用のマイグレーションだけを、
  名前順に、1 ファイル 1 トランザクションで適用します。適用済みのものは
  `migration_history.applied_migrations` に記録されるので、毎回実行しても安全です。同時に実行した場合は
  互いに待ち合わせます。
- マイグレーションは前進だけです。取り消すためのスクリプトはありません。

### 3. イメージを展開する

レジストリからイメージを取得し、コンテナを起動または入れ替えます。手順はプラットフォームによるため、
ここでは定めません。サーバー側で前提にできること:

- 設定が不正な場合と、データベースに接続できない場合は起動せず、終了コード 1 で終了する
- `GET /api/system/alive` は生存確認、`GET /api/system/ready` は受付可否の確認に使える
  （データベースが応答しなければ 503）
- `SIGTERM` を受けると新しい接続の受付をやめ、処理中のリクエストを最大 10 秒待ち、データベース接続を
  閉じて終了コード 0 で終了する
- ログは標準出力に出る

詳細は [README](../README.md) の "Operating the API Server" を参照してください。

### 4. ロールバックと監視

どちらもリポジトリに手順や設定はありません。イメージにはコミットの短縮 SHA を含むタグが付くので、
以前のバージョンのイメージを特定できます。データベースは自動では元に戻りません。

## リリース前の確認

```bash
make ci-check              # CI のチェック（check:db-schema 以外。Docker か TEST_DATABASE_URL が必要）
make ci-check-dockerfile   # 本番イメージをビルドできるか（Docker が必要）
```

- [ ] `main` の CI が成功している（Deploy は CI を待たないので、自分で確認する）
- [ ] `backend/packages/database/sql/migrations/` に、対象のデータベースへ未適用のマイグレーションがあるか
      把握している
- [ ] 追加された環境変数があれば、デプロイ先に設定してある
- [ ] フロントエンドを出す場合、各アプリの `.env.production` の `VITE_*` がリリース先に合っている
