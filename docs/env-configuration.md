# 環境変数設定ガイド

バックエンドの API サーバーとデータベーススクリプト、フロントエンドアプリが、どの環境変数を
どこから読むかを説明します。運用者向けの変数一覧はルートの [README](../README.md) の
"Operating the API Server" にあります。このガイドは、それに加えて開発者が知る必要のあることを扱います。

## 目次

1. [バックエンドの設定の仕組み](#バックエンドの設定の仕組み)
2. [どのファイルが使われるか](#どのファイルが使われるか)
3. [サーバーが読む 14 個の変数](#サーバーが読む-14-個の変数)
4. [サーバーが読まない変数](#サーバーが読まない変数)
5. [データベーススクリプトとテストの接続先](#データベーススクリプトとテストの接続先)
6. [Docker Compose](#docker-compose)
7. [変数を追加する](#変数を追加する)
8. [フロントエンドの環境変数](#フロントエンドの環境変数)
9. [秘密情報の扱い](#秘密情報の扱い)

## バックエンドの設定の仕組み

設定の読み込みと検証は `@beauty-salon-backend/config` パッケージが担当します。

| ファイル | 役割 |
|----------|------|
| `backend/packages/config/src/environment.ts` | 環境名（`production`、`staging`、`development`、`test`、`localhost`）の定義 |
| `backend/packages/config/src/env-loader.ts` | `loadEnvFile()`: 環境変数ファイルを `process.env` に読み込む。`getDatabaseUrl()`: スクリプト用の接続 URL |
| `backend/packages/config/src/app-config.ts` | `parseAppConfig()`: 環境変数を検証して `AppConfig` にする |

原則:

- サーバーが読む変数は 14 個で、**すべて必須**です。コードの中に既定値はありません。
- 検証は起動時に 1 回だけ行い、失敗したらサーバーは起動しません。
- 環境変数を読むのはエントリーポイント（`backend/apps/server/src/index.ts`）だけです。それ以外の
  アプリケーションコードは `process.env` を読まず、`AppConfig` の値を引数として受け取ります。
- 検証エラーに含まれるのは変数名と理由だけです。値は秘密情報の可能性があるので含めません。

### 起動時の流れ

`loadEnvFile()` → `parseAppConfig(process.env)` → `createLogger(...)` → `startServer(config, logger)` の
順に進みます。

```typescript
// backend/apps/server/src/index.ts（抜粋）
const { environment, file } = loadEnvFile()

const parsed = parseAppConfig(process.env)
if (parsed.type === 'error') {
  createLogger({ level: 'info', format: 'json', environment }).fatal(
    { issues: parsed.error },
    'Invalid configuration',
  )
  process.exit(1)
}
```

`parseAppConfig` は例外を投げず、`Result` を返します。問題のある変数は最初の 1 つではなく、すべて
まとめて報告されます。

```typescript
// backend/packages/config/src/app-config.ts（抜粋）
export type ConfigIssue = {
  variable: string
  message: string
}

export const parseAppConfig = (
  variables: Record<string, string | undefined>,
): Result<AppConfig, ConfigIssue[]>
```

設定に問題があると、サーバーは `Invalid configuration` というログを 1 行出力し（`issues` に
`variable` と `message` の一覧）、終了コード 1 で終了します。

## どのファイルが使われるか

```typescript
// backend/packages/config/src/env-loader.ts（抜粋）
export const loadEnvFile = (): LoadedEnvFile => {
  const environment = environmentSchema
    .catch('localhost')
    .parse(process.env.NODE_ENV)

  return {
    environment,
    file: loadFile('.env') ?? loadFile(`.env.${environment}`),
  }
}
```

規則は 3 つです。

1. **すでに設定されている環境変数が優先されます。** ファイルは、プロセスの環境にない変数を補うだけ
   です。デプロイ先では変数を直接設定すればよく、ファイルは不要です。
2. **読み込むファイルは 1 つだけです。** リポジトリのルートに `.env` があればそれを、なければ
   `.env.<NODE_ENV>` を読みます。`NODE_ENV` が未設定、または知らない値のときは `localhost` として
   扱います。
3. **ファイルがなくてもエラーにはなりません。** その場合はプロセスの環境変数だけで検証されます。

| 実行するもの | 読み込まれるファイル |
|--------------|----------------------|
| `pnpm dev`、`pnpm dev:backend`、`pnpm start:backend`（`NODE_ENV` 未指定） | `.env.localhost` |
| `NODE_ENV=staging pnpm start:backend` | `.env.staging` |
| `pnpm db:fresh`、`pnpm db:migrate` などのデータベーススクリプト（`NODE_ENV` 未指定） | `.env.localhost` |
| 本番イメージ（`Dockerfile.backend` の `production` ステージ） | なし。イメージにファイルは入っておらず、`NODE_ENV=production` 以外はすべてコンテナの環境変数で渡す |
| 統合テスト | 読まない。テストは設定をコードで組み立て、データベースは `TEST_DATABASE_URL` で指定する |

### リポジトリにあるファイル

| ファイル | 用途 |
|----------|------|
| `.env.template` | 変数名の一覧。値は空か、プレースホルダー |
| `.env.example` | 値の入った記入例 |
| `.env.localhost` | ローカル開発の既定。`DATABASE_URL` は `make infra-up` が起動する PostgreSQL に合わせてある |
| `.env.development`、`.env.test`、`.env.staging`、`.env.production` | `NODE_ENV` が対応する値のときに読まれる |
| `.env.test.ci` | CI 用。CI はテストの前にこれを `.env.test` へコピーし、Docker イメージの起動確認ではコンテナに渡す |
| `.env`（Git で追跡されない） | 置けば `.env.<NODE_ENV>` の代わりに読まれる |

注意点:

- `.env.development` と `.env.test` の `DATABASE_URL` は、`make infra-up` が作るものとは別のユーザーと
  データベースを指しています。これらの環境名で手元のサーバーを起動するときは、該当のデータベースを
  用意するか、`DATABASE_URL` を環境変数で上書きします。
- ルートの `.env` は Docker Compose も読みます（[Docker Compose](#docker-compose)）。`.env.example` を
  コピーして作る場合は、`DATABASE_URL` と `POSTGRES_*` が同じ接続先を表しているか確認してください。
  `.env.example` のままでは、`DATABASE_URL` のパスワードと `POSTGRES_PASSWORD` が一致していません。

## サーバーが読む 14 個の変数

`backend/packages/config/src/app-config.ts` の `variablesSchema` が定義です。数値は数字だけの文字列で
書きます（`3000.5`、`-1`、`30s` は不正）。

| 変数 | 受け付ける値 | `AppConfig` | 意味 |
|------|--------------|-------------|------|
| `NODE_ENV` | `production`、`staging`、`development`、`test`、`localhost` | `environment` | 実行環境。ログの各行に付く |
| `HOST` | 空でない文字列 | `server.host` | 待ち受けるアドレス |
| `PORT` | 1〜65535 | `server.port` | 待ち受けるポート |
| `TRUST_PROXY_HOPS` | 0〜10 | `server.trustProxyHops` | サーバーの前段にあるリバースプロキシの数（0 = クライアントが直接接続する）。レート制限はクライアントのアドレスごとに数えるので、実際の構成と一致させる |
| `DATABASE_URL` | `postgres://` または `postgresql://` の URL | `database.url` | データベースの接続 URL |
| `DATABASE_POOL_MAX` | 1〜1000 | `database.poolMax` | プールする接続の最大数 |
| `DATABASE_CONNECTION_TIMEOUT` | 1000〜600000 | `database.connectTimeoutMs` | 接続タイムアウト（ミリ秒） |
| `CORS_ORIGIN` | カンマ区切りのオリジン。1 つ以上 | `cors.origins` | ブラウザから API を呼べるオリジン |
| `CORS_CREDENTIALS` | `true`、`false` | `cors.credentials` | 資格情報つきのリクエストを許可するか |
| `CORS_MAX_AGE` | 0〜86400 | `cors.maxAgeSeconds` | プリフライトの結果をキャッシュできる時間（秒） |
| `RATE_LIMIT_WINDOW_MS` | 1000〜86400000 | `rateLimit.windowMs` | レート制限のウィンドウ（ミリ秒） |
| `RATE_LIMIT_MAX_REQUESTS` | 1〜1000000 | `rateLimit.maxRequests` | 1 つのクライアントアドレスがウィンドウ内に送れるリクエスト数（サーバーのインスタンスごとに数える） |
| `LOG_LEVEL` | `fatal`、`error`、`warn`、`info`、`debug`、`trace`、`silent` | `logging.level` | 出力するログの最低レベル |
| `LOG_FORMAT` | `json`、`pretty` | `logging.format` | `json` は 1 行 1 オブジェクト、`pretty` はターミナル向け |

`CORS_ORIGIN` の各要素は `https://example.com` のようなオリジンそのものでなければなりません。
パスや末尾の `/` が付いたもの、スキームのないもの、`*` は不正です。

この表と README の表は同じ内容を保ちます。

## サーバーが読まない変数

`.env.*` ファイルには、上の 14 個以外の変数も多く入っています。

- **Docker Compose が使うもの**: `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_PORT`、
  `MAILHOG_SMTP_PORT`、`MAILHOG_WEB_PORT`、`MINIO_ACCESS_KEY_ID`、`MINIO_SECRET_ACCESS_KEY`、
  `MINIO_BUCKET`、`MINIO_API_PORT`、`MINIO_CONSOLE_PORT`
- **`getDatabaseUrl()` が `DATABASE_URL` のないときに使うもの**: `POSTGRES_USER`、`POSTGRES_PASSWORD`、
  `DB_HOST`、`POSTGRES_PORT`、`POSTGRES_DB`
- **どのコードも読まないもの**: `JWT_*`、`SESSION_*`、`EMAIL_*`、`MAILGUN_*`、`SMTP_*`、`STORAGE_*`、
  `R2_*`、`S3_*`、`CDN_*`、`LOG_FILE_*`、`DATABASE_POOL_MIN`、`DATABASE_POOL_SIZE` など。認証、
  メール送信、ファイルストレージは実装されていません

`parseAppConfig` は知らない変数を無視するので、これらがあってもなくてもサーバーの起動には影響しません。

## データベーススクリプトとテストの接続先

`pnpm db:migrate` などのデータベーススクリプト（`backend/packages/database/src/scripts/`）と drizzle-kit の設定は、
サーバーと同じ規則でファイルを読み込んだあと、`getDatabaseUrl()` で接続先を決めます。

- `DATABASE_URL` があればそれを使います。各環境の `.env.<NODE_ENV>` ファイルはすべて `DATABASE_URL` を
  定義しています。
- `DATABASE_URL` がないときだけ、`POSTGRES_USER`、`POSTGRES_PASSWORD`、`DB_HOST`、`POSTGRES_PORT`、
  `POSTGRES_DB` から URL を組み立てます。それぞれにローカル開発用の既定値があります。

別のデータベースを対象にするときは、環境変数で指定します。

```bash
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database> pnpm db:migrate
```

統合テストは `DATABASE_URL` を使いません。`TEST_DATABASE_URL` が設定されていればその PostgreSQL を使い、
なければ testcontainers でコンテナを起動します（[API テストガイド](./api-testing-guide.md)）。

## Docker Compose

`docker-compose.yml` は `${POSTGRES_USER:-postgres}` のように、変数がなければ既定値を使う形で
書かれています。Docker Compose は、シェルの環境変数と、ルートに `.env` があればその内容を置換に使います。
`.env.localhost` は置換には使われません。

- `postgres` サービス: `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_PORT`
- `backend` サービス: `.env.localhost` の内容をコンテナの環境変数として渡したうえで、`NODE_ENV`
  （既定は `development`）、`PORT`、`DATABASE_URL`（Compose 内の `postgres` サービス宛て）などを上書きする
- `migration` サービス: `DATABASE_URL` だけを受け取り、`db:migrate` と `db:seed --if-empty` を実行する

## 変数を追加する

サーバーの設定を 1 つ増やすときに変更する場所です。

1. **スキーマ**: `backend/packages/config/src/app-config.ts` の `variablesSchema` に変数を、`AppConfig` に
   フィールドを、`toAppConfig` に対応を追加する。必須とし、既定値は付けない
2. **すべての環境変数ファイル**: `.env.localhost`、`.env.development`、`.env.test`、`.env.test.ci`、
   `.env.staging`、`.env.production`、`.env.example` に値を、`.env.template` に変数名を追加する
3. **テスト**: `backend/packages/config/src/__tests__/app-config.test.ts` の `variables` に追加し、不正な値の
   ケースを `should reject` の表に足す。このテストは、上の各ファイルがサーバーを完全に設定できること、
   `.env.template` がすべての変数名を含むことも確認する
4. **値を渡す**: `AppConfig` から、使う場所まで引数で渡す（`backend/apps/server/src/server.ts` の
   `startServer` → `createApp` の `settings`）。アプリケーションコードで `process.env` を読まない
5. **ドキュメント**: README の表と、このガイドの表に追加する
6. **デプロイ先**: 新しいバージョンを起動する前に変数を設定する。設定されていなければサーバーは
   起動しない

```bash
pnpm --filter @beauty-salon-backend/config run test
```

## フロントエンドの環境変数

フロントエンドアプリは Vite の仕組みで `VITE_*` 変数を読みます。値は**ビルド時に**バンドルへ
埋め込まれ、実行時には変えられません。

各アプリのディレクトリ（`frontend/apps/admin-app`、`frontend/apps/portal-app`、
`frontend/apps/dashboard-app`）に、モードごとのファイルがあります。

| 変数 | 用途 |
|------|------|
| `VITE_MODE` | 環境名。環境バナーの表示と、`production` 以外で React Query Devtools を出す判定に使う |
| `VITE_APP_TITLE` | 画面に表示するアプリ名 |
| `VITE_BACKEND_BASE_URL` | API サーバーのオリジン（パスは付けない。ローカルは `http://localhost:3000`） |

| 各アプリのスクリプト | Vite のモード | 読まれるファイル |
|----------------------|---------------|------------------|
| `dev` | `development` | `.env.development` |
| `build:test` | `test` | `.env.test` |
| `build:stg` | `staging` | `.env.staging` |
| `build:prod` | `production` | `.env.production` |
| `build:dev` | `development` | `.env.development` |
| `build:localhost` | `localhost` | `.env.localhost` |

変数の型は各アプリの `src/vite-env.d.ts` に宣言します（例: `frontend/apps/admin-app/src/vite-env.d.ts`）。
変数を追加するときは、各アプリの `.env.<モード>` と `vite-env.d.ts` の両方を更新します。

### `@beauty-salon-frontend/config` パッケージ

`frontend/packages/config/src/env/env.ts` は、`import.meta.env` の値を `env` オブジェクトにまとめて
公開します。`frontend/packages/config/src/envUtil/envUtil.ts` には `isProductionMode()` などの
モード判定があります。検証は行いません。

| `env` のキー | 読む値 |
|--------------|--------|
| `VITE_MODE` | `import.meta.env.MODE`（Vite のモード） |
| `VITE_APP_TITLE` | `VITE_APP_TITLE` |
| `VITE_BACKEND_BASE_URL` | `VITE_BACKEND_BASE_URL` |

設定されていない変数の値は `undefined` です。

現状について:

- `VITE_BACKEND_BASE_URL` を使うのは `frontend/packages/io` の fetcher だけで、3 つのアプリはまだ
  API を呼んでいません。
- アプリの `.env.localhost`、`.env.development`、`.env.test` の `VITE_BACKEND_BASE_URL` は、
  ローカルのバックエンド（`http://localhost:3000`）を指しています。バックエンド側の
  `.env.localhost` と `.env.development` の `CORS_ORIGIN` は、3 つのアプリのオリジン
  （`http://localhost:3001`〜`3003`）を許可しています。

## 秘密情報の扱い

- `.env.staging` と `.env.production` を含め、`.env.*` ファイルは Git で追跡されています。本物の秘密情報を
  書かないでください。デプロイ先では、プロセスの環境変数として設定します。
- `VITE_*` の値はブラウザに配信されるバンドルに入ります。秘密情報を入れてはいけません。
- 設定の検証エラーに入るのは変数名と理由だけで、値は入りません。データベーススクリプトは接続 URL を
  表示するとき、パスワードを伏せます。
