# メール送信

API サーバーがメールを送る仕組みを説明します。いつ・誰に・何を送るか（認証の流れ）は
[認証と認可](./authentication.md) にあります。

## 目次

1. [概要](#概要)
2. [送るメール](#送るメール)
3. [構成](#構成)
4. [送信の流れ](#送信の流れ)
5. [SMTP の設定](#smtp-の設定)
6. [ローカル開発（Mailpit）](#ローカル開発mailpit)
7. [ログ](#ログ)
8. [テスト](#テスト)
9. [メールを追加する](#メールを追加する)
10. [していないこと](#していないこと)

## 概要

- メールは SMTP で送ります。どのプロバイダーを使うかは、SMTP の接続先（環境変数）で決まります。
  プロバイダーごとのコードはありません。
- 本文はテキストだけです（HTML、添付ファイル、テンプレートエンジンは使いません）。
- 送信はリクエストの応答を待たせません。ユースケースはメールを**渡すだけ**で、配送は応答のあとに
  進みます。メールを送ったかどうかで応答時間が変わらないので、応答からアカウントの有無は分かりません。
- 配送に失敗したメールは、ログに記録して破棄します。再送はしません。利用者がもう一度要求します。

## 送るメール

| メール | 件名 | 送るとき | 本文のリンク |
|---|---|---|---|
| メールアドレスの確認 | `メールアドレスの確認` | ユーザー登録、確認メールの再送 | `<PUBLIC_APP_URL>/verify-email#token=<トークン>` |
| パスワードの再設定 | `パスワードの再設定` | パスワードの再設定の要求 | `<PUBLIC_APP_URL>/reset-password#token=<トークン>` |
| スタッフアカウントへの招待 | `スタッフアカウントへの招待` | スタッフの招待の作成（招待し直しを含む）。宛先は台帳のメールアドレス | `<PUBLIC_APP_URL>/accept-staff-invitation#token=<トークン>` |
| パスワードの変更の通知 | `パスワードが変更されました` | パスワードの再設定、パスワードの変更 | なし |
| 2 要素認証の有効化の通知 | `2 要素認証が有効になりました` | 2 要素認証の設定をコードで確認したとき | なし |
| 2 要素認証の無効化の通知 | `2 要素認証が無効になりました` | 2 要素認証を無効にしたとき | なし |
| バックアップコードの再発行の通知 | `バックアップコードが再発行されました` | バックアップコードを発行し直したとき | なし |
| バックアップコードの使用の通知 | `バックアップコードでログインしました` | バックアップコードでログインしたとき（本文に残りの個数） | なし |
| 管理者による 2 要素認証のリセットの通知 | `2 要素認証が管理者によって無効にされました` | 管理者が利用者の 2 要素認証をリセットしたとき | なし |

本文は `backend/packages/domain/src/business-logic/auth/_shared/mails.ts` にあります。

通知（リンクのない 6 つ）は、本人の操作や依頼でなかったときに気づけるようにするためのもので、
パスワードの再設定を案内します。シークレット、コード、バックアップコードは本文に含めません。

- リンクは設定値の `PUBLIC_APP_URL` から組み立てます。リクエストの `Host` ヘッダーは使いません。
- トークンは URL のフラグメント（`#token=`）に置きます。ブラウザーはフラグメントをサーバーに送らず、
  `Referer` にも含めません。
- リンク先のページ（`/verify-email`、`/reset-password`、`/accept-staff-invitation`）は、フロントエンドにまだありません。
- 招待のメールは、本文にサロンの名前を含みます。サロンが決めた文字列なので、本文にだけ入れ、件名などのヘッダーには入れません。招待の規則は [スタッフのログインアカウント](./staff.md#スタッフのログインアカウント) にあります。

## 構成

| 層 | ファイル | 役割 |
|---|---|---|
| ドメイン | `backend/packages/domain/src/services/mailer.ts` | `Mail`（宛先・件名・本文）と `IMailer`。ユースケースはこのインターフェースだけを知る |
| ドメイン | `backend/packages/domain/src/business-logic/auth/_shared/mails.ts` | メールの文面を作る関数 |
| インフラ | `backend/packages/infrastructure/src/mail/smtp-mailer.ts` | `SmtpMailer`: SMTP で送る `IMailer` の実装（nodemailer） |
| 設定 | `backend/packages/config/src/app-config.ts` | `AppConfig.mail`、`AppConfig.publicAppUrl` |
| サーバー | `backend/apps/server/src/server.ts` | `SmtpMailer` を作って `createApp` に渡し、停止時に閉じる |

```typescript
// backend/packages/domain/src/services/mailer.ts
export type Mail = {
  to: string
  subject: string
  text: string
}

export interface IMailer {
  deliver(mail: Mail): void
}
```

`deliver` は `Promise` も `Result` も返しません。呼び出した側は配送の結果を知りません。失敗の報告は
実装（`SmtpMailer`）の仕事です。

## 送信の流れ

1. ユースケースが、DB の更新に成功したあとで `mailer.deliver(mail)` を呼ぶ。`deliver` はすぐに戻る
2. ハンドラーが応答を返す
3. `SmtpMailer` が SMTP サーバーに接続して送る。結果をログに 1 行出力する（[ログ](#ログ)）

サーバーの起動時には SMTP サーバーに接続しません。最初のメールを送るときに接続するので、SMTP サーバーが
止まっていても API は起動し、メールを送らないオペレーションは動きます。`/api/system/ready` も SMTP
サーバーを確認しません。

サーバーの停止時（`SIGTERM` など）は、リクエストの受け付けを止め、処理中のリクエストを終え、
**配送中のメールが終わるのを待ってから**、データベースの接続を閉じます。配送にはタイムアウトがあるので、
SMTP サーバーが応答しなくても停止は終わります。

| タイムアウト | 値 |
|---|---|
| 接続の確立 | 10 秒 |
| 接続後のあいさつ（greeting） | 10 秒 |
| 通信が止まってから切断するまで | 30 秒 |

## SMTP の設定

サーバーが読む環境変数です。すべて必須です（[環境変数設定ガイド](./env-configuration.md)）。

| 変数 | 意味 |
|---|---|
| `SMTP_HOST`、`SMTP_PORT` | SMTP サーバー |
| `SMTP_TLS` | 接続の暗号化（下の表） |
| `SMTP_USER`、`SMTP_PASSWORD` | SMTP 認証。サーバーは常に認証して送る |
| `MAIL_FROM` | すべてのメールの差出人。`no-reply@example.com` か `Beauty Salon <no-reply@example.com>` の形 |
| `PUBLIC_APP_URL` | メールのリンクが指す Web アプリケーションのオリジン（パスや末尾の `/` は付けない） |

| `SMTP_TLS` | 動作 | 使う場面 |
|---|---|---|
| `implicit` | 最初から TLS で接続する | ポート 465 |
| `starttls` | 平文で接続し、STARTTLS で TLS に切り替える。サーバーが STARTTLS に対応していなければ送らない | ポート 587 |
| `none` | 暗号化しない | 手元のメールキャッチャー（Mailpit）だけ |

`NODE_ENV` が `staging` または `production` のとき、次の設定ではサーバーは起動しません。

- `SMTP_TLS=none`（認証情報とトークンが平文で流れる）
- `https://` で始まらない `PUBLIC_APP_URL`（リンクにトークンが含まれる）

プロバイダーを変えるときは、これらの変数をそのプロバイダーの SMTP の接続情報にします。コードの変更は
要りません。差出人のドメインの送信ドメイン認証（SPF、DKIM など）はプロバイダーと DNS の設定で、
このリポジトリは扱いません。

## ローカル開発（Mailpit）

`make infra-up` は PostgreSQL と一緒に [Mailpit](https://mailpit.axllent.org/) を起動します
（`docker-compose.yml` の `mailpit` サービス）。Mailpit は受け取ったメールを外へ送らず、画面に表示します。

| | |
|---|---|
| SMTP | `localhost:1025` |
| 受け取ったメールの画面 | <http://localhost:8025> |

- ポートは `127.0.0.1` にだけ公開しています。
- `.env.localhost`、`.env.development`、`.env.test`、`.env.example` のメールの設定は、この Mailpit を
  指しています（`SMTP_TLS=none`。Mailpit は任意のユーザー名とパスワードを受け付ける設定で起動する）。
- Docker Compose で `backend` サービスを動かすときは、`SMTP_HOST` が Compose 内の `mailpit` サービスに
  上書きされます。
- `PUBLIC_APP_URL` は portal-app（`http://localhost:3001`）です。

登録からログインまでを手元で試す例です。

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"taro@example.com","password":"violet tram under the bridge"}'
# http://localhost:8025 で確認メールを開き、リンクの #token= のあとの値をコピーする
curl -i -X POST http://localhost:3000/api/v1/auth/verify-email/confirm \
  -H 'Content-Type: application/json' \
  -d '{"token":"<トークン>"}'
```

## ログ

配送の結果は、メール 1 通につき 1 行です。

| レベル | メッセージ | フィールド |
|---|---|---|
| `info` | `Mail delivered` | `subject` |
| `error` | `Failed to deliver mail` | `subject`、`failure`（`message`、`code`、`command`、`responseCode`） |

- `subject` でメールの種類が分かります。宛先と本文（トークンを含む）は、どちらの行にも出力しません。
- `failure.code` と `failure.command` は nodemailer のエラーの値で、SMTP のどの段階で失敗したかを表します。
  SMTP サーバーに接続できないときは `code` が `ESOCKET`、`command` が `CONN` になります。
  `responseCode` は SMTP サーバーが返した応答コードで、応答がなければ `null` です。

`Failed to deliver mail` が続くときは、SMTP の設定（接続先、認証情報、`SMTP_TLS`）とプロバイダーの状態を
確認します。利用者には、確認メールや再設定メールをもう一度要求してもらいます。

## テスト

- ユースケースの単体テストと API の統合テストは SMTP を使いません。`IMailer` を、渡されたメールを記録する
  実装に置き換えます。API の統合テストでは `createTestApp({ mails })` に配列を渡すと、アプリケーションが
  渡したメールがそこに入ります（`backend/packages/api/src/__tests__/_shared/test-helpers.ts`）。
- `SmtpMailer` は、testcontainers で起動した Mailpit のコンテナに実際に送る統合テストで確認します
  （`backend/packages/infrastructure/src/mail/__tests__/smtp-mailer.integration.test.ts`、
  `pnpm --filter @beauty-salon-backend/infrastructure test:integration`）。

## メールを追加する

1. 文面を作る関数を、そのドメインの `_shared/mails.ts` に追加する。戻り値は `Mail`。リンクを入れるなら
   `publicAppUrl` を引数で受け取り、秘密の値はフラグメントに置く
2. ユースケースの依存に `mailer: IMailer`（リンクを作るなら `publicAppUrl` も）を加え、DB の更新に
   成功したあとで `mailer.deliver(...)` を呼ぶ。`deliver` の前後で処理を分けない（メールを送る場合と
   送らない場合で、応答が同じになるようにする）
3. `backend/packages/api/src/index.ts` の `createApp` で、そのユースケースの依存に `mailer` を渡す
4. テスト: ユースケースの単体テストで、渡されるメール（宛先、件名、リンク）と、渡されない条件を確認する

## していないこと

- **再送とキュー**: 配送に失敗したメールは破棄します。サーバーのプロセスが強制終了されたとき、配送中の
  メールは失われます。
- **バウンスと苦情の処理**: プロバイダーからの通知（Webhook）は受け取りません。
- **HTML メール、添付ファイル、多言語**: 文面は日本語のテキストだけです。
- **送信数の制限**: アカウントごと・種類ごとに 60 秒に 1 通の間隔（[認証と認可](./authentication.md#メールで送るトークン)）
  のほかに、メールに固有の制限はありません。API 全体のレート制限は別にあります。スタッフの招待の間隔は、
  スタッフが持っている招待についてのもので、招待を取り消してから招待し直す場合や、スタッフを台帳に
  登録し直した場合には働きません。宛先のメールアドレスごとの上限はありません。
