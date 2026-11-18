# 環境変数設定ガイド

バックエンドの API サーバーとデータベーススクリプト、フロントエンドアプリが、どの環境変数を
どこから読むかを説明します。運用者向けの変数一覧はルートの [README](../README.md) の
"Operating the API Server" にあります。このガイドは、それに加えて開発者が知る必要のあることを扱います。

## 目次

1. [バックエンドの設定の仕組み](#バックエンドの設定の仕組み)
2. [どのファイルが使われるか](#どのファイルが使われるか)
3. [サーバーが読む 28 個の変数](#サーバーが読む-28-個の変数)
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

- サーバーが読む変数は 28 個で、**すべて必須**です。コードの中に既定値はありません。
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
  const { NODE_ENV } = process.env
  const environment = environmentSchema.catch('localhost').parse(NODE_ENV)

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
| `.env.localhost` | ローカル開発の既定 |
| `.env.development`、`.env.test` | `NODE_ENV` が対応する値のときに読まれる。手元で起動するための設定 |
| `.env.staging`、`.env.production` | `NODE_ENV` が対応する値のときに読まれる。接続先や秘密の値はプレースホルダー |
| `.env.test.ci` | CI の Docker イメージの起動確認（`docker-validation.yml`）で、コンテナに渡す設定 |
| `.env`（Git で追跡されない） | 置けば `.env.<NODE_ENV>` の代わりに読まれる |

注意点:

- `.env.localhost`、`.env.development`、`.env.test`、`.env.example` のデータベース設定は同じで、
  `make infra-up` が既定値で起動する PostgreSQL（[Docker Compose](#docker-compose)）を指しています。
  `DATABASE_URL` と `POSTGRES_*` も同じ接続先を表しています。どちらも `config` パッケージのテスト
  （`backend/packages/config/src/__tests__/app-config.test.ts`）が確認します。
- そのため `NODE_ENV=test` で起動したサーバーも、ローカル開発と同じデータベースを使います。分けたい
  ときは `DATABASE_URL` を環境変数で上書きします。統合テストはこの設定を使いません
  （[データベーススクリプトとテストの接続先](#データベーススクリプトとテストの接続先)）。
- 同じ 4 つのファイルのメールの設定（`SMTP_*`）は、`make infra-up` が起動する Mailpit を指しています
  （[メール送信](./email.md#ローカル開発mailpit)）。送ったメールは外へ出ず、<http://localhost:8025> で読めます。
- 同じ 4 つのファイルの保存先の設定（`STORAGE_*`）は、`make infra-up` が起動する SeaweedFS を指しています
  （[添付ファイル](./attachments.md#ローカル開発seaweedfs)）。バケットの名前と認証情報は、`docker-compose.yml` の
  `storage` サービスの既定値と同じです。これも `config` パッケージのテストが確認します。
- ルートの `.env` は Docker Compose も読みます。`DATABASE_URL` と `POSTGRES_*` を変えるときは、
  同じ接続先を表すようにそろえてください。

## サーバーが読む 28 個の変数

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
| `SMTP_HOST` | 空でない文字列 | `mail.host` | メールを送る SMTP サーバーのホスト |
| `SMTP_PORT` | 1〜65535 | `mail.port` | SMTP サーバーのポート |
| `SMTP_TLS` | `implicit`、`starttls`、`none` | `mail.tls` | SMTP の接続の暗号化。`implicit` は最初から TLS（465）、`starttls` は STARTTLS で切り替える（587）、`none` は暗号化しない |
| `SMTP_USER` | 空でない文字列 | `mail.user` | SMTP 認証のユーザー名 |
| `SMTP_PASSWORD` | 空でない文字列 | `mail.password` | SMTP 認証のパスワード |
| `MAIL_FROM` | メールアドレス、または `名前 <メールアドレス>` | `mail.from` | すべてのメールの差出人 |
| `PUBLIC_APP_URL` | オリジン 1 つ | `publicAppUrl` | メールのリンクが指す Web アプリケーションのオリジン |
| `TWO_FACTOR_ENCRYPTION_KEY` | 32 文字以上の文字列 | `twoFactor.encryptionKey` | 2 要素認証のシークレットを暗号化して保存するための鍵 |
| `STORAGE_ENDPOINT` | `http://` か `https://` のオリジン 1 つ | `storage.endpoint` | 添付ファイルを置く S3 互換のオブジェクトストレージに、サーバーが接続する先 |
| `STORAGE_PUBLIC_ENDPOINT` | `http://` か `https://` のオリジン 1 つ | `storage.publicEndpoint` | 同じストレージに、ブラウザーが接続する先。アップロードとダウンロードの署名付き URL は、これを指す |
| `STORAGE_REGION` | 空でない文字列 | `storage.region` | ストレージのリージョン。署名に使う |
| `STORAGE_BUCKET` | 3〜63 文字の、英小文字・数字・`.`・`-`（先頭と末尾は英小文字か数字） | `storage.bucket` | ファイルを置くバケット。サーバーは作らない |
| `STORAGE_ACCESS_KEY_ID` | 空でない文字列 | `storage.accessKeyId` | ストレージの認証情報（キー ID） |
| `STORAGE_SECRET_ACCESS_KEY` | 空でない文字列 | `storage.secretAccessKey` | ストレージの認証情報（シークレット）。署名付き URL は、これで署名する |
| `LOG_LEVEL` | `fatal`、`error`、`warn`、`info`、`debug`、`trace`、`silent` | `logging.level` | 出力するログの最低レベル |
| `LOG_FORMAT` | `json`、`pretty` | `logging.format` | `json` は 1 行 1 オブジェクト、`pretty` はターミナル向け |

`CORS_ORIGIN` の各要素は `https://example.com` のようなオリジンそのものでなければなりません。
パスや末尾の `/` が付いたもの、スキームのないもの、`*` は不正です。`PUBLIC_APP_URL`、
`STORAGE_ENDPOINT`、`STORAGE_PUBLIC_ENDPOINT` も同じ形のオリジンです。

`NODE_ENV` が `staging` または `production` のときは、変数どうしの組み合わせも検証します
（`deployedVariablesSchema`）。次の値ではサーバーは起動しません。

| 変数 | 拒否する値 | 理由 |
|------|------------|------|
| `SMTP_TLS` | `none` | SMTP の認証情報と、メールに含まれるトークンが平文で流れる |
| `PUBLIC_APP_URL` | `https://` で始まらないもの | メールのリンクにトークンが含まれる |
| `STORAGE_ENDPOINT`、`STORAGE_PUBLIC_ENDPOINT` | `https://` で始まらないもの | ファイルは顧客のもので、URL は署名を含む |

メールの送信の仕組みと、ローカルでのメールの確認は [メール送信](./email.md) にあります。

`STORAGE_*` の 6 つは、添付ファイルの保存先です（[添付ファイル](./attachments.md#ストレージ)）。

- 2 つのエンドポイントは、ふつう同じ値です。違うのは、サーバーが内部のネットワークの名前でストレージに
  接続するときだけです（Docker Compose の `backend` サービスがその例）
- サーバーは、起動のときにストレージへ接続しません。値が誤っていても起動し、添付ファイルのルートが
  500 を返します。デプロイ先の値は、[ストレージのテスト](./attachments.md#テスト)で確かめられます
- `STORAGE_SECRET_ACCESS_KEY` は秘密です。知っている人は、どのファイルの URL にも署名できます

`TWO_FACTOR_ENCRYPTION_KEY` は、認証アプリのシークレットを DB に保存するときの暗号化に使います
（[認証と認可](./authentication.md#2-要素認証)）。

- 環境ごとに別の、ランダムな値にします。例: `openssl rand -base64 32`
- 値を変えると、保存済みのシークレットはどれも復号できなくなり、2 要素認証を有効にしている利用者は
  認証アプリのコードでログインできなくなります（バックアップコードは使えます）。鍵を切り替える仕組みは
  ないので、いちど使い始めた値は変えません
- リポジトリの `.env.*` ファイルに入っている値は、誰でも読める値です。`.env.staging` と
  `.env.production` の値はプレースホルダーで、デプロイ先では必ず環境変数で置き換えます

この表と README の表は同じ内容を保ちます。

## サーバーが読まない変数

`.env.*` ファイルには、上の 28 個のほかに次の 5 個だけが入っています。

- **Docker Compose が使うもの**: `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_PORT`
- **`getDatabaseUrl()` が `DATABASE_URL` のないときに使うもの**: `POSTGRES_USER`、`POSTGRES_PASSWORD`、
  `DB_HOST`、`POSTGRES_PORT`、`POSTGRES_DB`

どのコードも読まない変数は、環境ファイルに置きません。`config` パッケージのテスト
（`backend/packages/config/src/__tests__/app-config.test.ts`）が、すべての環境ファイルについて、
上の 33 個以外の変数がないことを確認します。変数を増やすときは、それを読むコードと一緒に追加します
（[変数を追加する](#変数を追加する)）。

`parseAppConfig` は知らない変数を無視するので、プロセスの環境にほかの変数があってもサーバーの起動には
影響しません。

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

Compose のプロジェクト名は、`docker-compose.yml` の `name`（`beauty-salon`）で固定しています。コンテナの
名前とホストのポートも固定なので、1 台のマシンで動くのは 1 組で、どのディレクトリから実行しても、同じ
コンテナとボリューム（`beauty-salon_postgres18_data` など）を指します。ホストに公開するポートは、どれも
`127.0.0.1` だけです。

- `postgres` サービス: `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_PORT`。
  ポート（既定は 5432）を `127.0.0.1` に公開する。既定のユーザーとパスワードはリポジトリに書いて
  あるので、ほかのマシンからは届かないようにしている
- `mailpit` サービス: 変数を使わない。SMTP（1025）と画面（8025）を `127.0.0.1` に公開する
- `storage` サービス（SeaweedFS）: `STORAGE_BUCKET`、`STORAGE_ACCESS_KEY_ID`、`STORAGE_SECRET_ACCESS_KEY`。
  S3 の API（8333）を `127.0.0.1` に公開し、起動のときにバケットを作る
- `backend` サービス: ポート（`PORT`、既定は 3000）を `127.0.0.1` に公開する。
  `.env.localhost` の内容をコンテナの環境変数として渡したうえで、`NODE_ENV`
  （既定は `development`）、`PORT`、`DATABASE_URL`（Compose 内の `postgres` サービス宛て）、`SMTP_HOST`
  （Compose 内の `mailpit` サービス宛て）、`STORAGE_ENDPOINT`（Compose 内の `storage` サービス宛て。
  `STORAGE_PUBLIC_ENDPOINT` は `http://localhost:8333` のまま）などを上書きする
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
   `startServer` → `createApp` の `settings`、または設定から作った部品。例: `TotpAuthenticator`）。
   アプリケーションコードで `process.env` を読まない
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
