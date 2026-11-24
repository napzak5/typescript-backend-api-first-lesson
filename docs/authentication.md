# 認証と認可

API の利用者をどう特定し、何を許可するかをまとめます。コントラクトは `specs/operations/auth-operations.tsp`、実装は各層の `auth` 以下にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| `POST /api/v1/auth/login`、`/refresh`、`/logout`、`/logout-all`、`GET /api/v1/auth/me` | 実装済み |
| ユーザー登録（`/register`）、メールアドレスの確認（`/verify-email/send`、`/verify-email/confirm`）、パスワードの再設定（`/forgot-password`、`/reset-password/verify`、`/reset-password`）・変更（`/change-password`） | 実装済み |
| 2 要素認証（`/2fa/enable`、`/2fa/verify`、`/2fa/disable`、`/2fa/backup-codes`）と、ログインでのコードの確認 | 実装済み |
| セッションの一覧（`GET /api/v1/auth/sessions`）と無効化（`DELETE /api/v1/auth/sessions/{sessionId}`） | 実装済み |
| スタッフの招待の確認、受け入れ、参加（`/staff-invitation/verify`、`/staff-invitation/accept`、`/staff-invitation/join`） | 実装済み |
| 管理者の操作（`/api/v1/admin/auth` のユーザーの参照、ロックの解除、2 要素認証のリセット） | 実装済み |

コントラクトの認証のオペレーション（`AuthCrud`、`SessionCrud`、`AdminAuthCrud`）は、すべて実装されています。

登録で作れるのは顧客（ロール `customer`）のアカウントだけです。`owner`、`manager`、`staff` のアカウントは、[スタッフの招待](#スタッフの招待)で作ります。`admin` のアカウントを作る API はないので、シード（`pnpm db:seed`）か SQL で作ります。

## セッション

セッションはサーバー側（`sessions` テーブル）に持ちます。JWT は使いません。

| 項目 | 決まり |
|---|---|
| トークン | アクセストークンとリフレッシュトークン。どちらも CSPRNG で生成した 256 ビットを base64url にした不透明な文字列で、クライアントは内容を解釈しない |
| 保存 | DB にはトークンの SHA-256 ハッシュだけを保存する（`tokenHash`、`refreshTokenHash`）。DB を読まれてもトークンは使えない |
| アクセストークンの有効期間 | 15 分（`expiresAt`）。セッションの終了が先に来る場合はそこまで |
| セッションの終了 | ログインから 8 時間後、`rememberMe: true` なら 30 日後（`refreshExpiresAt`）。トークンを再発行しても延びない |
| 再発行 | 両方のトークンを置き換える。使ったリフレッシュトークンと、それまでのアクセストークンは使えなくなる。同じリフレッシュトークンで同時に 2 回要求しても、成功するのは 1 回 |
| ログアウト | セッションの行を削除する。終了したセッションの行は、そのユーザーが次にログインしたときに削除する |
| `lastActivityAt` | 最後にトークンを発行した（ログインまたは再発行した）日時。リクエストごとには更新しない |

根拠: セッション ID のエントロピーと、検証用の値だけを保存することは OWASP Session Management Cheat Sheet。不透明なトークンは長くランダムなので、保存に必要なのは SHA-256 で、パスワード用のハッシュは要りません。

ブラウザーの側の決まり（トークンを置く場所、期限切れのあとの再発行と送り直し、複数のタブ、サインアウト）は、[フロントエンドAPI統合ガイドの「セッション」](./frontend-api-integration.md#セッション)にあります。実装は `frontend/packages/io/src/libs/session/`（保存）、`frontend/packages/api-client/src/fetcher/`（送ることと再発行）、`frontend/packages/session/` です。

サインインの画面（メールアドレスとパスワード、2 要素認証のコードの 2 段階）、サインインが要る画面の出し分け、アプリごとの使えるロールは、同じガイドの[「画面とサインイン」](./frontend-api-integration.md#画面とサインイン)にあります。画面が出すかどうかは表示の決まりで、操作を許すかどうかは、この文書の[認可](#認可)のとおりに API が決めます。

パスワードの変更、サインインしている端末（セッション）の一覧とそのサインアウト、すべての端末でのサインアウト、2 要素認証の設定、バックアップコードの発行し直し、2 要素認証の無効化の画面は、3 つのアプリにあります（同じガイドの[「アカウントの安全の画面」](./frontend-api-integration.md#アカウントの安全の画面)）。

### 一覧と無効化

ログイン中のユーザーは、自分のアカウントがどこでログインしているかを確かめ、セッションを 1 件ずつ無効にできます（OWASP Session Management Cheat Sheet: 利用者が有効なセッションの詳細を確認し、離れた場所から終了できるようにする）。1 人のユーザーが同時に持てるセッションの数に上限はありません。

`GET /api/v1/auth/sessions`

| 項目 | 決まり |
|---|---|
| 対象 | リクエストしたユーザーの、終了していないセッション（`refreshExpiresAt` が現在より後）。アクセストークンの期限が切れていても、再発行できる間は含む。ほかのユーザーのセッションは含まない |
| 並び | 新しい順（`createdAt`、`id` の降順） |
| 項目 | `id`、`userId`、`ipAddress`、`userAgent`、`expiresAt`、`refreshExpiresAt`、`lastActivityAt`、`createdAt`、`current`。トークンのハッシュは返さない |
| `current` | このリクエストのセッションなら true。クライアントはセッションの ID を知らないので、「この端末」を示すにはこの値を使う。DB のカラムではなく、応答のたびに決める値 |
| ページ | `limit` は 1〜100（省略時 20）。`cursor` は前のページの最後のセッションの ID。`meta.total` は終了していないセッションの総数。前へは戻れない（`prevCursor` は常に null） |
| 無効な `cursor` | 400（`field` は `cursor`）。UUID でなければ `rule` は `invalid_format`、そのユーザーのセッションを指していなければ `not_found`。無効にされたセッションは行ごと消えるので、それを指す `cursor` も `not_found` になる。クライアントは先頭から読み直す |

`DELETE /api/v1/auth/sessions/{sessionId}`

- 自分の、終了していないセッションを削除する（204）。そのセッションのアクセストークンもリフレッシュトークンも、すぐに使えなくなる
- リクエスト自身のセッションも指定できる。結果はログアウトと同じ
- 存在しない、ほかのユーザーのもの、すでに終了しているものは、区別せず 404。ID が UUID でなければ 400（`field` は `sessionId`）
- 所有者と期限を条件に含めた 1 つの DELETE で行うので、同じセッションを同時に 2 回無効にしても、204 になるのは 1 回
- メールは送らない。すべてのセッションを無効にするのは `POST /api/v1/auth/logout-all`

## パスワード

- Argon2id、メモリ 19 MiB（19456 KiB）・反復 2・並列度 1（OWASP Password Storage Cheat Sheet の最小構成）。Node.js 組み込みの `crypto.argon2` を使う（`backend/packages/infrastructure/src/security/argon2-password-hasher.ts`）
- 保存形式は PHC 文字列（`$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`）。ハッシュがパラメーターを持つので、構成を強くしたあとも古いハッシュは検証でき、次にログインに成功した時点で新しい構成のハッシュに置き換わる
- Argon2id の PHC 文字列でない値（以前のシードにあった bcrypt など）は、どのパスワードとも一致しない

### 設定するパスワードの規則

登録・再設定・変更と、スタッフの招待の受け入れで設定するパスワードに適用します。根拠は NIST SP 800-63B-4 3.1.1.2 です。

| 規則 | 内容 |
|---|---|
| 長さ | 15〜128 文字。Unicode のコードポイントで数える（絵文字 1 つは 1 文字）。文字種の組み合わせは要求しない |
| 正規化 | 保存と照合の前に NFC に正規化する。ログインなどで照合するパスワードも同じ |
| ブロックリスト | 推測されやすいパスワードを拒否する（`rule` は `blocklisted`）。比べるのはパスワード全体で、一部に含むだけなら拒否しない |

ブロックリストの対象は次のとおりです（`business-logic/auth/_shared/password-blocklist.ts`）。

- メールアドレスそのもの、メールアドレスの `@` より前（大文字小文字、空白、記号の違いは無視する）
- 同じ文字、または 8 文字以下の並びの繰り返し（`aaaaaaaaaaaaaaaa`、`abc123abc123abc123`）
- 連続した文字の並び（`123456789012345`、`abcdefghijklmnop`）と、キーボードの並び（`qwertyuiopasdfgh`）
- 長いパスワードの例として広く知られているもの（`correct horse battery staple` など）
- `password` という語そのものと、そのあとに数字だけを続けたもの（`password1234567890`、`Passw0rd 2026 1118`。大文字小文字、空白、記号の違いを無視し、`o` を `0` に替えたものも含む）。ほかの語と組み合わせたもの（`password of the salon` など）は拒否しない

[共有リンク](./attachments.md#共有リンクの発行)のパスワードにも、メールアドレスを除いて、同じ一覧を使います（`commonChoiceIssue`）。共有リンクのパスワードは、アカウントのものではないので、長さは 8〜128 文字です。

流出したパスワードの一覧との照合はしていません（外部のサービスかデータが必要になるため）。

### パスワードの確認と試行回数の制限

パスワードを確認する箇所（ログイン、パスワードの変更、2 要素認証の設定の開始と無効化）は、同じ制限を共有します（`business-logic/auth/_shared/password-check.ts`）。誤ると `failedLoginAttempts` が増え、連続 5 回で 15 分ロックし、ロック中は正しいパスワードでも確認に失敗します。[2 要素認証](#2-要素認証)のコードの誤りも、同じ回数に数えます。

## ログイン

- 失敗は原因を区別せず、同じ 401（コード `1002`）を返す。未登録のメールアドレス、パスワードの誤り、ロック中、メールアドレス未確認、停止中、のどれでも同じ
- 2 要素認証が有効なアカウントは、パスワードに加えて `twoFactorCode`（認証アプリのコードかバックアップコード）が要る。パスワードが正しく、コードがない・誤っている・使用済みのときは 401（コード `1007`）を返す（[ログインでの確認](#ログインでの確認)）
- 未登録のメールアドレスでもパスワードのハッシュを 1 回計算し、応答時間で登録の有無が分からないようにする
- メールアドレスは小文字で保存し、小文字にそろえて照合する
- パスワードを連続して 5 回誤ると、アカウントを 15 分ロックする（`status = locked`、`lockedUntil`）。ロック中の試行は数えず、正しいパスワードでも失敗する。ロックが明けたあとは、誤るたびに 15 分ロックする。成功すると失敗回数は 0 に戻り、`status` は `active` に戻る。回数の加算は 1 つの UPDATE で行うので、並行した試行も数え漏らさない
- ロックは新しいログインだけを止める。すでにあるセッションは使い続けられる（他人の失敗でログイン中の利用者を締め出さないため）
- ロックは時間がたてば明ける。待たずに解除できるのは、パスワードの再設定と、管理者によるロックの解除（[管理者の操作](#管理者の操作)）
- ログインと既存のセッションの利用ができるのは、`status` が `active` または `locked`（ロックは上のとおり新しいログインだけを止める）で、削除されていない（`deletedAt` が NULL の）ユーザーだけ。`unverified`、`inactive`、`suspended`、`deleted` のユーザーは、どちらもできない
- 顧客のデータを[削除の依頼](./customers.md#削除の依頼)で消去すると、その顧客のアカウント（前に削除した顧客のアカウントが、そのあと新しいプロフィールを作っていた場合を除く）は `deleted` になり、メールアドレスは `<ユーザーの ID>@erased.invalid` に置き換わり、パスワード、2 要素認証、トークン、セッションが消える。そのアカウントでは、ログインも、それまでのアクセストークンの利用もできない

## ユーザー登録

`POST /api/v1/auth/register` は、メールアドレスが登録済みかどうかにかかわらず 204 を返します（OWASP Authentication Cheat Sheet: 登録の応答からアカウントの有無が分からないようにする）。入力の検証エラー（400）は、アカウントの有無に関係なく返ります。

| メールアドレスの状態 | 動作 |
|---|---|
| 未登録 | ロール `customer`、状態 `unverified` のユーザーを作り、確認メールを送る |
| 登録済みで、状態が `unverified` | 前回の確認メールから 60 秒以上たっていれば、パスワードを今回のものに置き換え、確認メールを送り直す（前のリンクは無効になる）。60 秒以内なら何もしない |
| それ以外（確認済み、停止中など） | 何も変えず、何も送らない |

- どの場合もパスワードのハッシュを 1 回計算し、メールの送信を待たずに応答するので、応答時間でも区別できない
- `unverified` のアカウントはログインできない。確認が済むと `active` になる
- 登録したユーザーは、まだ顧客情報（`customers` の行）を持たない（`customerId` は null）。ログインしたあと、本人が `POST /api/v1/customers/me` でプロフィールを作る。台帳に同じメールアドレスの顧客がいれば、その顧客を引き継ぐ（[顧客本人のプロフィール](./customers.md#顧客本人のプロフィール)）
- 他人のメールアドレスで先に登録されていても、本人があとから登録すればパスワードは本人のものに置き換わる。確認メールのリンクが有効にするのは、最後に登録されたパスワード
- `unverified` のアカウントは、同じメールアドレスへの[スタッフの招待](#スタッフの招待)が受け入れられると、その招待のアカウントになる（パスワードは招待された本人のものに置き換わり、確認メールのリンクは使えなくなる）

## メールで送るトークン

メールアドレスの確認、パスワードの再設定、スタッフの招待は、メールで送ったトークンで本人を確かめます。

| 項目 | 決まり |
|---|---|
| 形式 | セッションのトークンと同じ（CSPRNG の 256 ビット、base64url）。DB には SHA-256 のハッシュだけを保存する（`users` の `emailVerificationTokenHash`、`passwordResetTokenHash`、`staff_invitations` の `tokenHash`） |
| 有効期間 | メールアドレスの確認は 24 時間、パスワードの再設定は 30 分、スタッフの招待は 7 日 |
| 使える回数 | 1 回。新しいトークンを発行すると、前のトークンは使えなくなる（ユーザーごと・種類ごとに 1 つ。招待はスタッフごとに 1 つ） |
| 送信の間隔 | 同じアカウントへは、種類ごとに 60 秒に 1 通まで。それより短い間隔の要求は、何も送らずに 204 を返す。招待は、スタッフが持っている招待を 60 秒に 1 回まで置き換えられ、それより短い間隔の招待は 409 |
| 無効なトークン | 400（`errors[].field` は `token`、`rule` は `invalid_token`）。存在しない、使用済み、期限切れを区別しない。招待は、取り消された、スタッフの状態が変わった、も区別しない |

リンクは `PUBLIC_APP_URL`（設定値）から組み立てます。リクエストの `Host` ヘッダーは使いません（OWASP Forgot Password Cheat Sheet）。トークンは URL のフラグメントに置くので、サーバーのアクセスログにも `Referer` にも残りません。

| メール | リンク |
|---|---|
| メールアドレスの確認 | `<PUBLIC_APP_URL>/verify-email#token=<トークン>` |
| パスワードの再設定 | `<PUBLIC_APP_URL>/reset-password#token=<トークン>` |
| スタッフの招待 | `<PUBLIC_APP_URL>/accept-staff-invitation#token=<トークン>` |

リンク先のページは、フラグメントからトークンを取り出して API（`/verify-email/confirm`、`/reset-password`、`/staff-invitation/accept` か `/staff-invitation/join`）に送ります。招待のページは、先にトークンを `/staff-invitation/verify` に送り、応答の `links` で、パスワードを尋ねるか（`accept`）、ログインを求めるか（`join`）を決めます。これらのページは portal-app にあります（[アカウントの画面](./frontend-api-integration.md#アカウントの画面)）。リンクを開いただけでは、トークンを消費するリクエストを送りません（ボタンを押したときに送ります）。メールのリンクを利用者より先に開くソフトウェアが、リンクを使い切らないようにするためです。

メールは、送るきっかけになったリクエストの言語（`Accept-Language`）で書きます。招待は、招待した人の、管理者による 2 要素認証のリセットの通知は、管理者のリクエストの言語です（[メールの言語](./email.md#メールの言語)）。

メールの送信の仕組みは [メール送信](./email.md) にあります。

### メールアドレスの確認

- `POST /api/v1/auth/verify-email/send`: 確認メールを送り直す。応答は常に 204。送るのは、アカウントがあり、メールアドレスが未確認のときだけ
- `POST /api/v1/auth/verify-email/confirm`: `emailVerified` を true にし、状態が `unverified` なら `active` にする

### パスワードの再設定

- `POST /api/v1/auth/forgot-password`: 再設定メールを送る。応答は常に 204。送るのは、削除されておらず、状態が `active`・`unverified`・期限付きの `locked` のアカウントだけ。要求しただけでは、アカウントは何も変わらない
- `POST /api/v1/auth/reset-password/verify`: トークンがまだ使えるかを答える（204 / 400）。トークンは消費しない
- `POST /api/v1/auth/reset-password`: 新しいパスワードを設定する。同時に次のことが起きる
  - そのユーザーの全セッションを無効にする
  - 失敗回数とロックを解除する
  - メールアドレスを確認済みにする（トークンをメールで受け取れたことが確認になる）。`unverified` のアカウントは `active` になる
  - パスワードが変更されたことをメールで知らせる
  - ログインはしない（セッションを発行しない）。2 要素認証の設定は変えない（再設定のあとも、ログインにはコードが要る）

### パスワードの変更

`POST /api/v1/auth/change-password`（ログイン中のユーザー）は、現在のパスワードを確認してから新しいパスワードを設定します。

- 現在のパスワードの確認は、上の試行回数の制限を通す。確認できなければ 400（`field` は `currentPassword`、`rule` は `incorrect`）
- 新しいパスワードが現在のものと同じなら 400（`rule` は `unchanged`）
- 変更すると、そのユーザーのほかのセッションを無効にし（このリクエストのセッションは残す）、未使用の再設定トークンを無効にし、メールで知らせる

### スタッフの招待

`owner`、`manager`、`staff` のアカウントは、招待で作ります。管理者かサロンの `owner` が、台帳のスタッフをロールを指定して招待し（`POST /api/v1/salons/{salonId}/staff/{id}/invitation`）、招待された本人が、メールのリンクから自分でパスワードを決めます。招待する側の規則（誰がどのロールを与えられるか、誰を招待できるか、取り消し）は [スタッフのログインアカウント](./staff.md#スタッフのログインアカウント) にあります。招待された側のオペレーションは、`/api/v1/auth` の下にあります。確認と受け入れは、アカウントをまだ持たない人が使うので、認証は要りません。参加は、すでにあるアカウントでログインして使います。

- `POST /api/v1/auth/staff-invitation/verify`: トークンがまだ使えるかを答え、使えるなら招待の内容（宛先のメールアドレス、ロール、期限）と、次に進むルート（`links` の `accept` か `join`）を返す（200）。パスワードを尋ねる前に、画面が何のアカウントかを示せるようにするため。トークンは消費しない
- `POST /api/v1/auth/staff-invitation/accept`: パスワードを設定して、アカウントを作る（204）。同時に次のことが起きる
  - 招待の宛先のメールアドレスで、招待のロールの、スタッフに紐づいたアカウントができる（`status` は `active`）
  - メールアドレスは確認済みになる（トークンをメールで受け取れたことが確認になる）
  - 招待は消える。トークンが使えるのは 1 回
  - ログインはしない（セッションを発行しない）。利用者は、このあとログインする
- `POST /api/v1/auth/staff-invitation/join`: ログインしているアカウントを、招待のスタッフに紐づける（204）。使えるのは、宛先のメールアドレスのアカウントで、サロンのロールを持ち、どのサロンにも届かないもの（[認可](#認可) の範囲 `none`。サロンを移ったスタッフなど）
  - アカウントのロールは、招待のロールになる
  - パスワード、2 要素認証、セッションは変わらない。発行済みのアクセストークンのまま、次のリクエストから、新しいサロンに届く
  - 招待は消える
  - 顧客と管理者は 403。サロンに届くアカウントと、宛先と違うメールアドレスのアカウントは 409（コード `3003`）
- 使えないトークンは、理由を区別せずに 400（上の表）。パスワードが規則に合わないとき（400）は、招待は残る
- 宛先のメールアドレスにすでにアカウントがあると、受け入れは 409（コード `3002`）。確認も 409 で、参加できるアカウントのときだけ、200 で `links` に `join` を返す。メールアドレスを確認していない登録（`unverified`）だけは別で、そのアカウントが招待のアカウントになる（[受け入れ](./staff.md#受け入れ)）。招待を作る側の応答は、アカウントの有無で変わらない。アカウントがあることを知るのは、トークンを持つ人、つまりそのメールボックスを読める人だけ
- **招待のトークンは、すでにあるアカウントのパスワードの代わりにならない。** 受け入れは、すでにあるアカウントには何もせず、参加は、そのアカウントのセッションを求める（[参加](./staff.md#参加)）

## 2 要素認証

パスワードに加えて、認証アプリ（TOTP に対応したもの）が表示する 6 桁のコードを確認します。利用者が自分で設定します。ロールによって必須にする仕組みはありません。

| 項目 | 決まり |
|---|---|
| 方式 | TOTP（RFC 6238）。HMAC-SHA-1、6 桁、時間ステップ 30 秒。認証アプリが前提にしている既定値で、ほかの値を無視するアプリがあるため変えない |
| シークレット | CSPRNG で生成した 160 ビット（RFC 4226 が推奨する長さ）。利用者には Base32 の 32 文字で、設定を開始したときに 1 回だけ返す |
| シークレットの保存 | AES-256-GCM で暗号化して保存する（`users.twoFactorSecret`。形式は `aes-256-gcm$<IV>$<暗号文>$<タグ>`）。鍵は設定値 `TWO_FACTOR_ENCRYPTION_KEY` から HKDF-SHA-256 で導出する。DB を読まれただけでは、コードを計算できない |
| 受け付けるコード | 現在の時間ステップのコードと、その前後 1 ステップのコード（時計のずれと入力の遅れのため。RFC 6238 5.2） |
| 使える回数 | 1 回。受け付けたステップを `users.twoFactorLastUsedStep` に記録し、それより後のステップのコードだけを受け付ける。記録は 1 つの UPDATE で行うので、同じコードを同時に 2 回送っても、成功するのは 1 回 |
| バックアップコード | 10 個。1 個は CSPRNG の 80 ビットで、`XXXX-XXXX-XXXX-XXXX`（Base32）の形。それぞれ 1 回だけ使える。入力の大文字と小文字、ハイフン、空白は区別しない |
| バックアップコードの保存 | Argon2id のハッシュを保存する（`users.backupCodes`、未使用のコードのハッシュの配列）。使うと、そのハッシュを配列から取り除く |
| 試行回数の制限 | コードの誤りは、パスワードの誤りと同じ回数に数える（連続 5 回で 15 分ロック）。ロック中は正しいコードでも受け付けない |

根拠: コードを 1 回だけ受け付けること、前後のステップの許容、鍵を保護して保存することは RFC 6238 5.1・5.2。試行回数の制限は RFC 4226 7.3。バックアップコードは鍵より短い（112 ビット未満）ので、パスワードと同じ方式でハッシュし、試行回数を制限する（NIST SP 800-63B-4 3.1.2.2）。

状態は `users.twoFactorStatus` が持ちます。

| 状態 | 意味 | ログインでのコード |
|---|---|---|
| `disabled` | 設定していない。シークレットもバックアップコードも持たない | 不要 |
| `pending` | 設定を開始したが、コードでの確認が済んでいない | 不要 |
| `enabled` | 有効 | 必要 |

### 設定と変更

どのオペレーションもログイン中のユーザーが対象で、セッションだけでは変更できません（セッションを奪われても、設定を変えられないようにする。OWASP Multifactor Authentication Cheat Sheet）。

| オペレーション | 本人確認 | 動作 |
|---|---|---|
| `POST /api/v1/auth/2fa/enable` | パスワード | シークレットとバックアップコードを発行して返し、状態を `pending` にする。`qrCodeUrl` は認証アプリが読み取る `otpauth://` の URI。`pending` の間に呼び直すと、新しいシークレットとバックアップコードに置き換わる |
| `POST /api/v1/auth/2fa/verify` | 認証アプリのコード | 設定を確認し、状態を `enabled` にする。認証アプリがシークレットを持っていることの確認なので、バックアップコードは使えない |
| `POST /api/v1/auth/2fa/disable` | パスワードと、認証アプリのコードまたはバックアップコード | 状態を `disabled` にし、シークレットとバックアップコードを削除する |
| `POST /api/v1/auth/2fa/backup-codes` | 認証アプリのコードまたはバックアップコード | バックアップコードを 10 個発行し直す。それまでのコードは使えなくなる |

- シークレットとバックアップコードを返すのは、発行したレスポンスだけ。あとから取得するオペレーションはない
- パスワードやコードを確認できないときは 400（`field` は `password` または `code`、`rule` は `incorrect`）。401 ではないので、セッションは有効なまま
- 状態が合わないときは 409（コード `3003`）: すでに有効なのに設定を開始する、設定中でないのに確認する、有効でないのに無効化・再発行する
- 確認の順序は、本文の検証 → パスワード → 状態 → コード（`/2fa/verify` と `/2fa/backup-codes` はパスワードを取らないので、状態 → コード）
- 有効にしても無効にしても、セッションはそのまま残る
- 有効にしたとき、無効にしたとき、バックアップコードを発行し直したときは、メールで知らせる（[メール送信](./email.md#送るメール)）
- 認証アプリを使えなくなった利用者は、バックアップコードでログインし、バックアップコードで無効化してから設定し直す
- 認証アプリもバックアップコードも失った利用者は、自分では解除できない。管理者が 2 要素認証をリセットする（[管理者の操作](#管理者の操作)）

### ログインでの確認

`POST /api/v1/auth/login` は 1 回のリクエストで、パスワードと `twoFactorCode` を受け取ります。状態が `enabled` のアカウントでは、次の順に確認します。

| 状況 | 応答 | 失敗回数 |
|---|---|---|
| パスワードの誤り、ロック中、メールアドレス未確認、停止中（コードが正しくても同じ） | 401（コード `1002`） | パスワードの誤りは数える |
| パスワードは正しく、`twoFactorCode` が `null` | 401（コード `1007`） | 数えない |
| パスワードは正しく、コードが誤っている・使用済み | 401（コード `1007`） | 数える |
| パスワードもコードも正しい | 200 | 0 に戻る |

- コード `1007` の応答は、クライアントがコードの入力を求める合図になる。パスワードが正しいときにしか返らない。`WWW-Authenticate` は `Bearer realm="beauty-salon-api"`
- `twoFactorCode` が 6 桁の数字なら認証アプリのコードとして、それ以外ならバックアップコードとして確認する
- バックアップコードでログインすると、そのコードは使えなくなり、残りの個数をメールで知らせる
- 状態が `disabled` または `pending` のアカウントでは、`twoFactorCode` を無視する

### していないこと

- **鍵の交換**: `TWO_FACTOR_ENCRYPTION_KEY` を変えると、保存済みのシークレットはどれも復号できなくなり、コードを確認できなくなる（バックアップコードは使える）。鍵を切り替える仕組みはない
- **ロールごとの必須化、信頼する端末の記憶、SMS やメールでのコード、パスキー**

## リクエストの認証

`Authorization: Bearer <アクセストークン>` を検証します（RFC 6750 2.1）。

| 状況 | ステータス | コード | `WWW-Authenticate` |
|---|---|---|---|
| ヘッダーがない、Bearer 以外のスキーム | 401 | `1001` | `Bearer realm="beauty-salon-api"` |
| トークンに対応するセッションがない、ユーザーが利用できない | 401 | `1004` | `Bearer realm="beauty-salon-api", error="invalid_token"` |
| アクセストークンの有効期限切れ（リフレッシュトークンで再発行できる） | 401 | `1003` | 同上 |
| 認証されているが権限がない | 403 | `1005` | なし |

401 には必ず `WWW-Authenticate` を付けます（RFC 9110 15.5.2）。`/api/v1/auth` と `/api/v1/admin/auth` 以下のレスポンスには `Cache-Control: no-store` を付けます。

認証されたリクエストのログ行（`request completed`）には、ユーザーの ID（`userId`）が入ります。応答が 403 や 404 でも入るので、誰がどの操作を試みたかを、リクエスト ID と合わせて追えます。認証されなかったリクエストの行には入りません。トークンとそのハッシュはログに出力しません（OWASP Session Management Cheat Sheet: セッション ID そのものを記録しない。この API でそれに当たるのはトークン）。`sessions` の行の ID は認証に使えない値で、セッションを無効にするリクエストのパスや、一覧の `cursor` としてログ行の `url` に残ります。

## 認可

認可は**ユースケースで判定**します。HTTP 層はトークンから操作者（`Actor`）を特定してユースケースに渡すだけで、ロールの判定はしません。

操作者の範囲（`ActorScope`）は、`users.role` と、ユーザーに紐づくレコードから決まります。

| 範囲 | 対象 | 届くもの |
|---|---|---|
| `platform` | `admin` | すべてのサロン（予約台帳、売上台帳、在庫を含む）と、顧客台帳（顧客の好み設定、カルテ、顧客のアレルギーを含む）、ポイント台帳、すべてのレビューの削除（`DELETE /api/v1/reviews/{id}`）とサロンからの返信の取り下げ（`POST /api/v1/reviews/{id}/respond`）、レビューの通報の一覧と却下（`/api/v1/review-reports`） |
| `salon` | `owner`、`manager`、`staff`。`users.staffId` が指すスタッフが有効（`isActive`、未削除）で、そのサロンが未削除であること | そのサロン（予約台帳、売上台帳、在庫を含む。在庫の管理は `owner`・`manager` だけ）と、顧客台帳（顧客の好み設定、カルテ、顧客のアレルギーを含む。アレルギーの削除は `owner`・`manager` だけ）、ポイント台帳（調整は `owner`・`manager` だけ）、自分のスタッフのプロフィール（`/api/v1/staff-profiles/me`）、サロンのレビューの通報と返信（`owner`・`manager` だけ。`POST /api/v1/reviews/{id}/report`、`/respond`）。範囲はロール・サロン ID・スタッフ ID を持つ |
| `customer` | `customer`。範囲は `users.customerId` を持ち、プロフィールを作るまでは null | 自分のプロフィール（`/api/v1/customers/me`）、自分の好み設定（`/api/v1/customers/me/preferences`）、自分の予約（`/api/v1/customers/me/bookings`）、自分の済んだ予約へのレビューの投稿（`POST /api/v1/reviews`）と、自分のレビューの修正と削除（`PATCH`、`DELETE /api/v1/reviews/{id}`）、ほかの顧客のレビューの参考になったと通報（`POST /api/v1/reviews/{id}/helpful`、`/report`）。null の間は、プロフィールの作成だけができる |
| `none` | `owner`、`manager`、`staff` で、`salon` の条件に当たらない（スタッフ情報が削除された `staff`、紐づけを解除された `staff` など） | 範囲を必要とするものには届かない。ログインはでき、スタッフへの招待に[参加](./staff.md#参加)できる |

- ロールは `users.role` の固定 5 種。誰が何をできるかは、ロールと、スタッフのアカウントならそのスタッフのサロンだけで決まり、ドメインごとの規則は下の節にある。ロールを作ったり、アカウントに操作ごとの権限を与えたりする仕組みはない（#234）
- 1 人のユーザーが属するサロンは 1 つ（`users.staffId` が 1 つのため）。1 人のスタッフに紐づくアカウントも 1 つ（削除されていないユーザーの間で、`users.staffId` は一意）
- `owner`、`manager`、`staff` のロールとスタッフへの紐づけは、[スタッフの招待](#スタッフの招待)の受け入れと参加が決める。そのあとは、管理者とサロンの `owner` が、ロールを変え、紐づけを解除できる（[紐づいたアカウントの管理](./staff.md#紐づいたアカウントの管理)）
- スタッフを指すアカウント（`users.staffId` が null でない）のロールは、`owner`、`manager`、`staff` のどれか（CHECK 制約 `users_staff_needs_salon_role`）。顧客と管理者のアカウントは、スタッフに紐づかない

### Salon API の権限

| オペレーション | 許可 |
|---|---|
| 一覧、1 件の取得 | 認証なし（予約前に閲覧できるようにする） |
| 作成 | `admin` |
| 更新 | `admin`、そのサロンの `owner` / `manager` |
| 削除 | `admin`、そのサロンの `owner` |

権限は、リクエストの本文を検証する前、対象を検索する前に判定します。ほかのサロンの `owner` が更新しようとすると、そのサロンが存在しなくても 403 です（サロンは公開情報なので、存在を隠す必要がない）。

### サロンの下にあるルートの権限

サロンに属するデータのルートは、`/api/v1/salons/{salonId}/...` のようにサロンの下に置きます。権限は、**パスの `salonId` だけ**で判定します（スタッフの勤務スケジュールを読むとき、スタッフを招待するとき、スタッフのアカウントのロールを変えるときだけ、そのあとにもう一度判定します。誰のスケジュールかと、どのロールを与えるかです。下の説明を参照）。

- 判定は、`salonId` の形式を確認した直後に行う。対象の ID、リクエストの本文、サロンと対象の存在は、権限があると分かってから確認する
- 権限のないユーザーには 403 を返す。応答はパスと操作者だけで決まり、対象が存在するかどうかで変わらないので、ほかのサロンのデータの存在は伝わらない
- サロンが存在しない、または削除済みなら 404
- 対象がパスのサロンに属さなければ 404（存在しない ID と区別しない）。リポジトリのクエリは、必ずサロンの ID を条件に含める

| オペレーション | 許可 |
|---|---|
| サービスカテゴリーの一覧、1 件の取得 | 認証なし（メニューはサロンと同じ公開情報） |
| サービスカテゴリーの作成、更新、削除 | `admin`、そのサロンの `owner` / `manager` |
| サービスの一覧、1 件の取得 | 認証なし |
| サービスの作成、更新、一括更新、削除 | `admin`、そのサロンの `owner` / `manager` |
| スタッフ台帳の一覧、登録、1 件の取得、更新、削除 | `admin`、そのサロンの `owner` |
| スタッフの勤務スケジュールの一覧 | `admin`、そのサロンの `owner` / `manager`。そのサロンの `staff` は自分のスケジュールだけ |
| スタッフの勤務スケジュールの更新 | `admin`、そのサロンの `owner` / `manager` |
| スタッフの招待の取得、作成、取り消し | `admin`、そのサロンの `owner`。`owner` のロールへの招待は `admin` だけ |
| スタッフに紐づいたアカウントの取得、ロールの変更、紐づけの解除 | `admin`、そのサロンの `owner`。`owner` のロールへの変更は `admin` だけ |
| 支払い方法の一覧、1 件の取得 | `admin`、そのサロンの `owner` / `manager` / `staff` |
| 支払い方法の作成、更新、削除 | `admin`、そのサロンの `owner` / `manager` |
| 商品の一覧、1 件の取得 | `admin`、そのサロンの `owner` / `manager` / `staff` |
| 商品の作成、更新、削除 | `admin`、そのサロンの `owner` / `manager` |

カテゴリーとサービスの規則は [サービスメニュー](./service-menu.md) にあります。

スタッフ台帳（`/api/v1/salons/{salonId}/staff`）は、読むのにも認証が要り、`manager` と `staff` には許可しません（`business-logic/staff/_shared/authorization.ts`）。台帳が給与と個人の連絡先を含むことと、台帳の操作がアカウントの権限を変えることが理由です。

- スタッフを無効化（`isActive` を false に）または削除すると、そのスタッフに紐づくアカウントは、次のリクエストから範囲が `none` になる。[認可](#認可) の表にある `salon` の条件（スタッフが有効で、削除されていない）を、リクエストのたびに確認しているため。`isActive` を true に戻すと、範囲も戻る
- 操作者は、自分のアカウントが紐づいているスタッフ（範囲の `staffId`）を、無効化も削除もできない（409）。自分をサロンから締め出す操作で、自分では戻せない。ほかの `owner` と `admin` はできる

規則は [スタッフ台帳](./staff.md) にあります。

スタッフの勤務スケジュール（`/api/v1/salons/{salonId}/staff/{id}/schedules`）は、台帳と違い、`manager` にも読み書きを認めます（`business-logic/staff-schedule/_shared/authorization.ts`）。シフトを組むのは店長の仕事で、スケジュールは給与も個人の連絡先も含まず、変えてもアカウントの権限は変わらないからです。

- 権限の判定は 2 段階ある。まず、ほかのルートと同じく、パスの `salonId` だけで判定する（読むのは `admin` と、そのサロンの `owner`・`manager`・`staff`。更新は `admin` と、そのサロンの `owner`・`manager`）。次に、スタッフの `id` の形式を確認してから、誰のスケジュールかを判定する。`staff` が読めるのは、範囲の `staffId` がパスの `id` と同じとき、つまり自分のスケジュールだけ
- どちらの判定も、クエリと本文の検証、サロンとスタッフの存在の確認より前に行う。`staff` がほかのスタッフの ID を指定すると、そのスタッフが存在しなくても 403 で、同僚の ID が実在するかどうかは伝わらない
- `staff` は自分のスケジュールを更新できない

規則は [勤務スケジュール](./staff.md#勤務スケジュール) にあります。

スタッフの招待（`/api/v1/salons/{salonId}/staff/{id}/invitation`）を扱えるのは、台帳と同じく、`admin` とそのサロンの `owner` です（`business-logic/staff-invitation/_shared/authorization.ts`）。招待は、サロンに届くアカウントを作るからです。

- 作成の権限の判定は 2 段階ある。まず、パスの `salonId` だけで判定する。次に、本文を検証してから、そのロールを与えられるかを判定する。`owner` のロールを与えられるのは `admin` だけで、`owner` が `owner` を招待すると 403。サロンを運営する人を決めるのは、プラットフォームの仕事とする
- 2 つ目の判定も、サロンとスタッフの存在の確認より前に行う

規則は [スタッフのログインアカウント](./staff.md#スタッフのログインアカウント) にあります。

スタッフに紐づいたアカウント（`/api/v1/salons/{salonId}/staff/{id}/account`）を扱えるのも、`admin` とそのサロンの `owner` です（`business-logic/staff-account/_shared/authorization.ts`）。ロールの変更と紐づけの解除は、サロンに届く人を変えるからです。

- ロールの変更の権限の判定は、招待の作成と同じ 2 段階。パスの `salonId` で判定し、本文を検証してから、そのロールを与えられるかを判定する。`owner` のロールを与えられるのは `admin` だけ。`owner` のロールを外すことは、そのサロンの `owner` にもできる
- 操作者は、自分のアカウントのロールの変更も、紐づけの解除もできない（409）。台帳で自分を無効化、削除できないのと同じで、自分では戻せない操作だから。判定は、本文を検証したあと、サロンとスタッフを検索する前に行う
- ロールの変更も、紐づけの解除も、そのアカウントの次のリクエストから効く。範囲をリクエストのたびに作り直しているため。セッションは消さない
- 紐づけを解除されたアカウントは、範囲が `none` になる。ロールは残る

規則は [紐づいたアカウントの管理](./staff.md#紐づいたアカウントの管理) にあります。

支払い方法（`/api/v1/salons/{salonId}/payment-methods`）は、読むのにも認証が要り、顧客のアカウントには見せません（`business-logic/payment-method/_shared/authorization.ts`）。レスポンスが、サロンが決済代行会社に払う手数料率を含むからです。

- 読む権限（`mayReadPaymentMethods`）は、`admin` と、そのサロンの `owner`・`manager`・`staff` にある。会計を入れるスタッフが、どの手段を受け付けるかを知る必要があるため
- 設定する権限（`mayKeepPaymentMethods`。作成、更新、削除）は、`admin` と、そのサロンの `owner`・`manager` にある。`staff` は、ID や本文を確かめる前に 403
- どちらも、パスの `salonId` だけで判定する。ほかのサロンのユーザーは、サロンや支払い方法が存在しなくても 403

規則は [支払い](./payments.md) にあります。

商品（`/api/v1/salons/{salonId}/products`）も、読むのに認証が要り、顧客のアカウントには見せません（`business-logic/product/_shared/authorization.ts`）。レスポンスが、仕入価格と仕入先を含むからです。

- 読む権限（`mayReadProducts`）は、`admin` と、そのサロンの `owner`・`manager`・`staff` にある。施術で商品を使い、店頭で売るスタッフが、商品を知る必要があるため
- 管理する権限（`mayKeepProducts`。作成、更新、削除）は、`admin` と、そのサロンの `owner`・`manager` にある。`staff` は、ID や本文を確かめる前に 403
- どちらも、パスの `salonId` だけで判定する。ほかのサロンのユーザーは、サロンや商品が存在しなくても 403

規則は [商品](./products.md) にあります。

顧客に見せるスタッフのプロフィール（`/api/v1/staff-profiles` の一覧と 1 件の取得）は、認証なしで読めます。サロンの下のルートではなく、権限の判定もありません。返すのは、台帳の項目のうち顧客に見せる 11 項目だけで、台帳を読めない `manager`、`staff`、顧客も読めます。見せるのは、有効で削除されていない、削除されていないサロンのスタッフです（[顧客に見せるプロフィール](./staff.md#顧客に見せるプロフィール)）。

スタッフ本人のプロフィール（`/api/v1/staff-profiles/me` の取得と更新）には、認証が要ります。許可するのは、範囲が `salon` のアカウントで、ロール（`owner`、`manager`、`staff`）は問いません（`business-logic/staff-profile/_shared/own-profile.ts` の `ownProfileOf`）。

- どのスタッフのプロフィールかは、範囲の `staffId` が決める。リクエストはスタッフを指定しないので、ほかのスタッフには届かない。`owner` も、ここで直せるのは自分のプロフィールだけ
- `admin`、顧客、範囲が `none` のアカウント（スタッフが無効化、削除された、紐づけを解除された、サロンが削除された）は 403。本文を検証する前に判定する
- 本人が書けるのは、自分を紹介する 5 項目（`specialties`、`bio`、`imageUrl`、`yearsOfExperience`、`certifications`）。顧客に見せる名前（`displayName`）、`level`、`position`、`canReceiveBookings` は、サロンが台帳で決める

規則は [スタッフ本人のプロフィール](./staff.md#スタッフ本人のプロフィール) にあります。

### 顧客台帳の権限

顧客（`customers`）はサロンに属さず、台帳はプラットフォーム全体で 1 つです。ルートは `/api/v1/customers` で、権限は**操作者だけ**で判定します（`business-logic/customer/_shared/authorization.ts`）。

| オペレーション | 許可 |
|---|---|
| 顧客の一覧、登録、1 件の取得、更新 | `admin`、サロンの `owner` / `manager` / `staff`（所属サロンは問わない） |
| 顧客の削除 | `admin`、サロンの `owner` / `manager` |
| 顧客の一括取得、一括登録、一括更新（`/api/v1/customers/batch/get`、`/api/v1/customers/bulk`） | `admin`、サロンの `owner` / `manager` / `staff`（所属サロンは問わない） |
| 顧客の一括削除（`DELETE /api/v1/customers/bulk`） | `admin`、サロンの `owner` / `manager` |
| 顧客の統計（`/api/v1/customers/{id}/statistics`） | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff`。ほかのサロンを指定したメンバーは 403（[統計](./customers.md#統計)） |
| 顧客の変更履歴と版（`/api/v1/customers/{id}/history`、`/api/v1/customers/{id}/versions/{version}`）、復元（`POST /api/v1/customers/{id}/restore`） | `admin`、サロンの `owner` / `manager`（[変更履歴と版](./customers.md#変更履歴と版)、[復元](./customers.md#復元)） |
| 顧客の統合（`POST /api/v1/customers/merge`） | `admin`、サロンの `owner` / `manager`（[統合](./customers.md#統合)） |
| 台帳の CSV 出力、顧客のデータの出力（`GET /api/v1/customers/export`、`GET /api/v1/customers/{id}/export`） | `admin`、サロンの `owner` / `manager`（[出力](./customers.md#出力)） |
| 顧客の削除の依頼の受け付け、確認、取り消し（`POST` / `GET` / `DELETE /api/v1/customers/{id}/deletion-request`） | `admin`、サロンの `owner` / `manager`（[削除の依頼](./customers.md#削除の依頼)） |
| 顧客のデータの消去の実行（`POST /api/v1/customers/deletion-requests/execute`） | `admin` だけ |
| 顧客の好み設定の取得、更新（`/api/v1/customers/{id}/preferences`） | `admin`、サロンの `owner` / `manager` / `staff`（所属サロンは問わない） |
| 本人のプロフィールの取得、作成、更新（`/api/v1/customers/me`） | `customer` |
| 本人の好み設定の取得、更新（`/api/v1/customers/me/preferences`） | プロフィールのある `customer` |

- 判定は最初に行う。権限のないユーザーには、ID、クエリ、本文が不正でも、顧客が存在しなくても 403 を返す
- ロール `customer` のユーザーは、台帳からは自分の顧客情報にも届かない。台帳のレスポンスがスタッフ専用の項目（`internalNotes` など）を含むため。本人には、それらを除いたプロフィールを返す
- プロフィールは、どの顧客かをアカウントが決める（`users.customerId`）。リクエストは顧客を指定しないので、ほかの顧客には届かない。`admin` とサロンのロールは 403（`business-logic/customer/_shared/profile.ts` の `profileAccessOf`）
- 好み設定のための権限はない。台帳のルートは台帳の規則（`mayHandleCustomers`）で、本人のルートはプロフィールの規則（`profileAccessOf`）で判定する。プロフィールをまだ作っていない顧客のアカウントは、本人のルートで 404 になる（[好み設定](./customers.md#好み設定)）

台帳とプロフィールの規則は [顧客台帳](./customers.md) にあります。

### 予約台帳の権限

予約（`bookings`）はサロンのものですが、ルートはサロンの下にありません（`/api/v1/bookings`）。どのサロンの予約かは、作成では本文の `salonId`、一覧ではクエリの `salonId`、ID を指定するオペレーション（取得、更新、削除、ステータスの操作、日時の変更、施術明細の追加・取得・削除）では予約そのものが決めます。権限は 2 段階で判定します（`business-logic/booking/_shared/authorization.ts`）。

| オペレーション | 許可 |
|---|---|
| 予約の一覧（`GET /api/v1/bookings`） | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの予約だけ） |
| 予約の作成（`POST /api/v1/bookings`） | `admin`、本文の `salonId` のサロンの `owner` / `manager` / `staff` |
| 予約の 1 件の取得（`GET /api/v1/bookings/{id}`） | `admin`、予約のサロンの `owner` / `manager` / `staff` |
| 予約の更新（`PATCH /api/v1/bookings/{id}`） | `admin`、予約のサロンの `owner` / `manager` / `staff` |
| 予約の削除（`DELETE /api/v1/bookings/{id}`） | `admin`、予約のサロンの `owner` / `manager` |
| 予約のステータスの操作（`POST /api/v1/bookings/{id}/confirm`、`/cancel`、`/start`、`/complete`、`/no-show`） | `admin`、予約のサロンの `owner` / `manager` / `staff` |
| 予約の日時の変更（`POST /api/v1/bookings/{id}/reschedule`） | `admin`、予約のサロンの `owner` / `manager` / `staff` |
| 予約の施術明細の追加、1 件の取得、削除（`POST /api/v1/bookings/{bookingId}/services`、`GET` と `DELETE /api/v1/bookings/{bookingId}/services/{id}`） | `admin`、予約のサロンの `owner` / `manager` / `staff` |
| 空き枠の一覧（`GET /api/v1/salons/{salonId}/available-slots`） | サインインしているすべてのユーザー |
| 空き枠の確認（`POST /api/v1/salons/{salonId}/available-slots/check`） | `admin`、パスのサロンの `owner` / `manager` / `staff` |
| 自分の予約の一覧、作成、1 件の取得、キャンセル、日時の変更（`GET` と `POST /api/v1/customers/me/bookings`、`GET /api/v1/customers/me/bookings/{id}`、`POST /api/v1/customers/me/bookings/{id}/cancel`、`POST /api/v1/customers/me/bookings/{id}/reschedule`） | プロフィールのある `customer` |

- 1 段階目は、操作者だけで決まる（`bookingReachOf`）。操作者に届く予約は、`admin` ならすべてのサロンのもの、サロンのユーザーなら所属サロンのもの。ロール `customer` のユーザーと範囲 `none` のユーザーには、届く予約がない。本文、クエリ、ID が不正でも 403 を返す。予約の削除は、別の関数（`bookingRemovalReachOf`）で決まり、サロンの `staff` にも、削除できる予約がない（403）
- 空き枠の確認は、重なっている予約の ID を返すので、台帳と同じ範囲で決まる（`business-logic/available-slot/_shared/authorization.ts` の `mayAskLedgerOf`。`bookingReachOf` と `isWithin` を使う）。サロンはパスにあるので、本文を読む前に 403 を返す。空き枠の一覧は、どの予約のことも返さないので、サインインしていれば誰でも読める
- 2 段階目は、リクエストがサロンを指定したあとに決まる（`isWithin`）。サロンのユーザーが、作成の本文や一覧のクエリでほかのサロンを指定すると 403。本文やクエリが不正なら、その前に 400 を返す
- 取得には、比べるサロンがない。リポジトリが、操作者に届く範囲を検索の条件にするので、ほかのサロンの予約は見つからない（404）。存在しない ID と区別しない。一覧も同じ条件で検索し、カーソルが指す予約にも同じ条件を付ける。更新、削除、ステータスの操作、日時の変更、施術明細の追加と削除も、同じ条件で予約をロックするので、ほかのサロンの予約は 404 で、何も変えない。施術明細の取得も、同じ条件で予約を探す
- サロンの 3 つのロールの違いは、予約の削除だけにある。削除できるのは `owner` と `manager` で、`staff` は 403。削除は、予約の履歴を消し、顧客の来店回数を変えるためである（顧客台帳の削除と同じ分け方）。施術明細の削除は、予約の内容の変更で、予約の削除ではないので、`staff` にもできる
- ロール `customer` のユーザーは、台帳からは、自分の予約にも届かない。レスポンスがサロン内のメモ（`internalNotes`）を含むため。自分の予約は、本人のルート（`/api/v1/customers/me/bookings`）で、見せてよい項目だけを読み、入れ、日時を変え、キャンセルする
- 本人のルートは、プロフィールの規則（`profileAccessOf`）で判定する（`business-logic/customer-booking/_shared/access.ts` の `ownBookingsOf`）。`admin` とサロンのロール、範囲 `none` のユーザーは 403、プロフィールをまだ作っていない顧客のアカウントは 404。判定は最初に行う。届く範囲は、その顧客の予約だけで（どのサロンの予約でも、サロンが台帳に入れた予約でも）、リポジトリが、顧客を検索とロックの条件にする。ほかの顧客の予約は、存在しない予約と区別しない（404）
- 本人のルートに、更新、削除、確定、日時の変更、施術明細のオペレーションはない。それらは、台帳のオペレーションである

規則は [予約台帳](./bookings.md) にあります。

### 売上台帳の権限

売上（`sales`）もサロンのもので、ルートはサロンの下にありません（`/api/v1/sales`）。どのサロンの売上かは、作成と金額の計算では本文の `salonId`、一覧ではクエリの `salonId`、取得、更新、取り消し、支払いの記録、レシートでは売上そのもの、返金では決済取引の売上が決めます。権限は、予約台帳と同じ 2 段階で判定します（`business-logic/sale/_shared/authorization.ts`）。

| オペレーション | 許可 |
|---|---|
| 売上の一覧（`GET /api/v1/sales`） | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの売上だけ） |
| 売上の作成（`POST /api/v1/sales`） | `admin`、本文の `salonId` のサロンの `owner` / `manager` / `staff` |
| 売上の 1 件の取得（`GET /api/v1/sales/{id}`） | `admin`、売上のサロンの `owner` / `manager` / `staff` |
| 売上の更新（`PATCH /api/v1/sales/{id}`） | `admin`、売上のサロンの `owner` / `manager` / `staff` |
| 売上の取り消し（`POST /api/v1/sales/{id}/void`） | `admin`、売上のサロンの `owner` / `manager` |
| 支払いの記録（`POST /api/v1/sales/{id}/process`） | `admin`、売上のサロンの `owner` / `manager` / `staff` |
| 返金（`POST /api/v1/payments/{id}/refund`） | `admin`、決済取引の売上のサロンの `owner` / `manager` |
| レシート（`GET /api/v1/sales/{id}/receipt`） | `admin`、売上のサロンの `owner` / `manager` / `staff` |
| 金額の計算（`POST /api/v1/sales/calculate`） | `admin`、本文の `salonId` のサロンの `owner` / `manager` / `staff` |

- 1 段階目は、操作者だけで決まる（`saleReachOf`）。操作者に届く売上は、`admin` ならすべてのサロンのもの、サロンのユーザーなら所属サロンのもの。ロール `customer` のユーザーと範囲 `none` のユーザーには、届く売上がない。本文、クエリ、ID が不正でも 403 を返す。売上の取り消しと返金は、別の関数（`saleVoidReachOf`）で決まり、サロンの `staff` にも、取り消せる売上と返金できる決済取引がない。届く範囲の型は、予約台帳と同じ `LedgerReach`
- 2 段階目は、リクエストがサロンを指定したあとに決まる（予約台帳と同じ `isWithin`）。サロンのユーザーが、作成と金額の計算の本文や一覧のクエリでほかのサロンを指定すると 403。本文やクエリが不正なら、その前に 400 を返す
- 取得、更新、取り消し、支払いの記録、返金、レシートには、比べるサロンがない。リポジトリが、操作者に届く範囲を検索の条件にするので、ほかのサロンの売上と、その決済取引は見つからない（404）。存在しない ID と区別しない。一覧も同じ条件で検索し、カーソルが指す売上にも同じ条件を付ける
- サロンの 3 つのロールの違いは、売上の取り消しと返金だけにある。どちらも、できるのは `owner` と `manager` で、`staff` は 403。取り消しは、売上をサロンの売上から外し、予約をもう一度会計できる状態に戻すためで（予約の削除と同じ分け方）、返金は、受け取ったお金を返すためである。作成、取得、一覧、更新、支払いの記録、レシート、金額の計算は、レジに立つスタッフの仕事なので、`staff` にもできる
- ロール `customer` のユーザーは、自分が支払った売上にも届かない。レスポンスが、スタッフの歩合とサロン内の備考を含むため。顧客が自分の支払いを読むルートは、ない

規則は [売上台帳](./sales.md) と [支払い](./payments.md#支払いは受け取った結果の記録) にあります。

### 売上レポートの権限

売上レポート（`/api/v1/sales-reports`）は、サロンの売上台帳から数えます。どのサロンのレポートかは、クエリの `salonId` が決めます。権限は、売上台帳と同じ 2 段階で判定しますが、届く範囲は別の関数で決まります（`business-logic/sales-report/_shared/authorization.ts` の `salesReportReachOf`）。

| オペレーション | 許可 |
|---|---|
| 期間のレポート、1 日の売上、スタッフ別、カテゴリー別、推移、CSV の出力（`GET /api/v1/sales-reports`、`/daily`、`/by-staff`、`/by-category`、`/trends`、`/export`） | `admin`（すべてのサロン）、クエリの `salonId` のサロンの `owner` / `manager` |

- 1 段階目は、操作者だけで決まる。`admin` はすべてのサロン、サロンの `owner` と `manager` は所属サロンのレポートを読める。サロンの `staff`、ロール `customer` のユーザー、範囲 `none` のユーザーは、クエリが不正でも 403
- 2 段階目は、クエリを確かめたあとに決まる（`isWithin`）。`owner` / `manager` が、ほかのサロンを指定すると、サロンが存在するかどうかにかかわらず 403。クエリが不正なら、その前に 400 を返す
- 存在しないサロンと削除済みのサロンは、2 段階目を通った操作者（実際には `admin`）に 400（`salonId` の `not_found`）
- 売上台帳と違い、サロンの `staff` は読めない。レポートは、サロン全体の売上と、スタッフ一人ひとりの売上を見せる、経営の情報だからである

規則は [売上レポート](./sales-reports.md) にあります。

### ポイント台帳の権限

ポイントは顧客のもので、顧客はサロンに属さないので、ポイント台帳（`/api/v1/points`）はプラットフォーム全体で 1 つです。誰が使えるかは、操作者だけで決まります（`business-logic/point/_shared/authorization.ts` の `pointReachOf`、`pointAdjustReachOf`、`mayExpirePoints`）。

| オペレーション | 許可 |
|---|---|
| 残高、履歴、有効期限が近いポイント（`GET /api/v1/points/customer/{customerId}/balance`、`/transactions`、`/expiring`）、付与、利用（`POST /api/v1/points/earn`、`/use`） | `admin`、どのサロンの `owner` / `manager` / `staff` も |
| 調整（`POST /api/v1/points/adjust`） | `admin`、どのサロンの `owner` / `manager` も |
| 失効（`POST /api/v1/points/expire`） | `admin` だけ |

- ロール `customer` のユーザーと、範囲 `none` のユーザーは、パスと本文が不正でも 403
- サロンの `staff` は、付与と利用はできるが、調整はできない（403）。付与と利用はレジの仕事で、調整はレジの記録によらずにポイントを動かすからである（売上の取り消しと同じ）
- 失効は `admin` だけができる。サロンの `owner` と `manager` も 403。どのサロンで貯めたポイントも、すべての顧客についてまとめて減らすからである
- 届く範囲（`LedgerReach`）が決めるのは、付与、利用、調整が参照できる売上と予約である。`admin` はすべてのサロンの、サロンのメンバーは所属サロンの売上と予約を参照できる。ほかのサロンの売上と予約は、存在しないものとして 400（`referenceId` の `not_found`）
- 顧客本人は、自分の残高をプロフィール（`/api/v1/customers/me` の `loyaltyPoints`）で見る。履歴を読むルートはない

規則は [ポイント台帳](./points.md) にあります。

### 在庫の権限

在庫（`inventory`）もサロンのもので、ルートはサロンの下にありません（`/api/v1/inventory`）。どのサロンの在庫かは、作成と棚卸しでは本文の `salonId`、一覧、在庫僅少の一覧、期限切れ間近の一覧、在庫評価額ではクエリの `salonId`、取得、更新、削除、在庫の移動の履歴では在庫の行そのもの、在庫の移動の記録では本文の `inventoryId` の在庫の行が決めます。権限は、売上台帳と同じ 2 段階で判定します（`business-logic/inventory/_shared/authorization.ts`）。

| オペレーション | 許可 |
|---|---|
| 一覧（`GET /api/v1/inventory`） | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの在庫だけ） |
| 1 件の取得（`GET /api/v1/inventory/{id}`） | `admin`、在庫の行のサロンの `owner` / `manager` / `staff` |
| 在庫僅少の一覧、期限切れ間近の一覧（`GET /api/v1/inventory/low-stock`、`/expiring`） | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff` |
| 作成（`POST /api/v1/inventory`） | `admin`、本文の `salonId` のサロンの `owner` / `manager` |
| 更新、削除（`PATCH`、`DELETE /api/v1/inventory/{id}`） | `admin`、在庫の行のサロンの `owner` / `manager` |
| 在庫の移動の記録（`POST /api/v1/inventory/movement`） | `admin`、在庫の行のサロンの `owner` / `manager`。`staff` は、`purchase`、`sale`、`use`、`return` だけ |
| 在庫の移動の履歴（`GET /api/v1/inventory/{id}/movements`） | `admin`、在庫の行のサロンの `owner` / `manager` / `staff` |
| 棚卸し（`POST /api/v1/inventory/stock-count`） | `admin`、本文の `salonId` のサロンの `owner` / `manager` |
| 在庫評価額（`GET /api/v1/inventory/value-report`） | `admin`、クエリの `salonId` のサロンの `owner` / `manager` |

- 1 段階目は、操作者だけで決まる。読むこと（`inventoryReachOf`）は、`admin` と、サロンの 3 つのロールができる。施術で商品を棚から出し、店頭で売るスタッフが、在庫を知る必要があるため。作成、更新、削除、棚卸し、在庫評価額（`inventoryKeeperReachOf`）は、商品と同じく、`owner` と `manager` だけができる。棚卸しは帳簿との差を `adjustment` で直し、在庫評価額は経営の数字であるため。サロンの `staff`、ロール `customer` のユーザー、範囲 `none` のユーザーは、本文、クエリ、ID が不正でも 403
- 在庫の移動の記録は、区分で決まる（`movementReachOf`）。在庫を読める人は、`purchase`、`sale`、`use`、`return` を記録できる。帳簿の在庫を直す `adjustment`、帳簿から外す `disposal`、ほかのサロンに移す `transfer` は、`owner` と `manager` だけができる。区分は本文にあるので、`staff` の 3 つの区分は、本文を確かめたあとに 403。`performedBy` は、サロンのユーザーのスタッフ ID で、`admin` では null
- 2 段階目は、本文かクエリを確かめたあとに決まる（`isWithin`）。サロンのユーザーが、ほかのサロンを指定すると、サロンが存在するかどうかにかかわらず 403。本文かクエリが不正なら、その前に 400 を返す
- 存在しないサロンと削除済みのサロンは、2 段階目を通った操作者（実際には `admin`）に 400（`salonId` の `not_found`）。一覧の `salonId` は絞り込みで、存在しないサロンは空の一覧になる
- 取得、更新、削除、在庫の移動の記録と履歴には、比べるサロンがない。リポジトリが、操作者に届く範囲を検索の条件にするので、ほかのサロンの在庫の行は見つからない（404。在庫の移動の記録では、本文の誤りとして 400 の `inventoryId` の `not_found`）。存在しない ID と区別しない。一覧のカーソルにも、同じ条件を付ける
- 棚卸しは、本文の `salonId` を比べたあとに、`items` の在庫の行が、そのサロンの行かを確かめる。ほかのサロンの行と存在しない行は区別せず、400（`items.<n>.inventoryId` の `not_found`）
- 顧客には、在庫を見せない

規則は [在庫](./inventory.md) にあります。

### 発注の権限

発注（`purchase_orders`）もサロンのもので、ルートはサロンの下にありません（`/api/v1/purchase-orders`）。どのサロンの発注かは、作成では本文の `salonId`、一覧と発注の提案ではクエリの `salonId`、取得、更新、承認、取り消し、入荷では発注そのものが決めます。権限は、在庫と同じ 2 段階で判定します（`business-logic/purchase-order/_shared/authorization.ts`）。

| オペレーション | 許可 |
|---|---|
| 一覧（`GET /api/v1/purchase-orders`） | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの発注だけ） |
| 作成（`POST /api/v1/purchase-orders`） | `admin`、本文の `salonId` のサロンの `owner` / `manager` / `staff` |
| 1 件の取得、更新（`GET`、`PATCH /api/v1/purchase-orders/{id}`） | `admin`、発注のサロンの `owner` / `manager` / `staff` |
| 承認、取り消し（`POST /api/v1/purchase-orders/{id}/approve`、`/cancel`） | `admin`、発注のサロンの `owner` / `manager` |
| 入荷（`POST /api/v1/purchase-orders/{id}/receive`） | `admin`、発注のサロンの `owner` / `manager` / `staff` |
| 発注の提案（`GET /api/v1/purchase-orders/reorder-suggestions`） | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff` |

- 1 段階目は、操作者だけで決まる。一覧、作成、取得、更新、入荷、発注の提案（`purchaseOrderReachOf`）は、在庫を読める人ができる。足りない商品を頼み、仕入先が発注をどうしたかを記録し、届いた商品を受け取るのは、日々在庫を扱うスタッフであるため。承認と取り消し（`purchaseOrderApproverReachOf`）は、在庫を管理する `owner` と `manager` だけができる。承認はお金を使うことを決めるため。サロンの `staff`（承認と取り消し）、ロール `customer` のユーザー、範囲 `none` のユーザーは、ID か本文が不正でも 403
- 2 段階目は、本文かクエリを確かめたあとに決まる（`isWithin`）。サロンのユーザーが、ほかのサロンを指定すると、サロンが存在するかどうかにかかわらず 403
- 取得、更新、承認、取り消し、入荷には、比べるサロンがない。リポジトリが、操作者に届く範囲を検索の条件にするので、ほかのサロンの発注は見つからない（404）。一覧のカーソルにも、同じ条件を付ける。作成の明細の在庫の行は、本文の `salonId` のサロンの行でなければ 400（`items.<n>.inventoryId` の `not_found`）
- 入荷の在庫の行は、発注の明細の行でなければ 400（`items.<n>.inventoryId` の `not_found`）。発注の提案の `cursor` は、クエリの `salonId` のサロンの商品でなければ 400（`cursor` の `not_found`）
- `createdBy` と `approvedBy`、入荷が記録する在庫の移動の `performedBy` は、操作者のスタッフ ID で、`admin` では null
- 顧客には、発注を見せない

規則は [発注](./purchase-orders.md) にあります。

### 在庫のアラートの権限

在庫のアラート（`/api/v1/inventory-alerts`）もサロンのもので、ルートはサロンの下にありません。どのサロンのアラートかは、一覧と件数ではクエリの `salonId`、確認では本文の `productId` の商品が決めます。権限は、在庫と同じ 2 段階で、在庫と同じ関数で判定します（`business-logic/inventory/_shared/authorization.ts` の `inventoryReachOf`）。

| オペレーション | 許可 |
|---|---|
| 一覧、件数（`GET /api/v1/inventory-alerts`、`/summary`） | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff` |
| 確認（`POST /api/v1/inventory-alerts/acknowledge`） | `admin`、本文の商品のサロンの `owner` / `manager` / `staff` |

- 1 段階目は、操作者だけで決まる。在庫を読める人（`admin` と、サロンの 3 つのロール）は、アラートを読み、確認できる。足りない商品や期限の近い在庫に気づいて手を打つのは、日々在庫を扱うスタッフであるため。ロール `customer` のユーザー、範囲 `none` のユーザーは、クエリや本文が不正でも 403
- 2 段階目は、クエリを確かめたあとに決まる（`isWithin`）。サロンのユーザーが、ほかのサロンを指定すると、サロンが存在するかどうかにかかわらず 403。存在しないサロンと削除済みのサロンは、2 段階目を通った操作者（実際には `admin`）に 400（`salonId` の `not_found`）
- 確認には、比べるサロンがない。リポジトリが、操作者に届く範囲を検索の条件にするので、ほかのサロンの商品のアラートは見つからない（404）。存在しない商品と区別しない。一覧の `cursor` に、ほかのサロンの商品か在庫の行を指定すると 400（`cursor` の `not_found`）
- `acknowledgedBy` は、操作者のスタッフ ID（`performerOf`）で、`admin` では null。本文には書けない
- 顧客には、アラートを見せない

規則は [在庫のアラート](./inventory-alerts.md) にあります。

### 施術記録の権限

施術記録（`/api/v1/treatments`）もサロンのもので、ルートはサロンの下にありません。`treatment_records` にサロンの列はなく、どのサロンの施術記録かは、その予約のサロンが決めます。権限は、予約台帳と同じ 2 段階で判定します（`business-logic/treatment-record/_shared/authorization.ts`）。

| オペレーション | 許可 |
|---|---|
| 一覧（`GET /api/v1/treatments`） | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの施術記録だけ） |
| 作成（`POST /api/v1/treatments`） | `admin`、本文の予約のサロンの `owner` / `manager` / `staff` |
| 1 件の取得、更新（`GET`、`PATCH /api/v1/treatments/{id}`） | `admin`、施術記録のサロンの `owner` / `manager` / `staff` |
| 削除（`DELETE /api/v1/treatments/{id}`） | `admin`、施術記録のサロンの `owner` / `manager` |
| 施術写真の追加、削除（`POST /api/v1/treatments/{id}/photos`、`DELETE /api/v1/treatments/{id}/photos/{photoId}`） | `admin`、施術記録のサロンの `owner` / `manager` / `staff` |
| 統計（`GET /api/v1/treatments/statistics`） | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンだけ） |

- 1 段階目は、操作者だけで決まる。一覧、作成、取得、更新、写真の追加と削除、統計（`treatmentRecordReachOf`）は、予約台帳を扱える人（`admin` と、サロンの 3 つのロール）のもの。施術をしたスタッフが記録を書き、直すため。削除（`treatmentRecordRemovalReachOf`）は、予約の削除と同じく `staff` を除く。ロール `customer` のユーザー、範囲 `none` のユーザーは、ID、本文、クエリが不正でも 403
- 顧客は、自分の施術の記録も読めない（403）。施術記録は、カウンセリングのメモ（`consultationNotes`）とスタッフの申し送り（`staffEvaluation`）を持つ、サロンの記録であるため
- 2 段階目は、一覧と統計のクエリを確かめたあとに決まる（`isWithin`）。サロンのユーザーが、ほかのサロンの `salonId` を指定すると 403
- 作成、取得、更新、削除には、比べるサロンがない。リポジトリが、操作者に届く範囲を検索の条件にするので（`shownTo`）、ほかのサロンの施術記録は見つからない（404）。存在しない施術記録と区別しない。作成でほかのサロンの予約を指定すると 400（`bookingId` の `not_found`）、一覧の `cursor` にほかのサロンの施術記録を指定すると 400（`cursor` の `not_found`）
- 削除されたサロンの施術記録は、`admin` にも見えない（404。一覧にも入らない）

規則は [施術記録](./treatments.md) にあります。

### カルテの権限

カルテと顧客のアレルギー（`/api/v1/medical-charts`）は顧客のもので、サロンに属しません。権限は、顧客台帳と同じく**操作者だけ**で判定します（`business-logic/customer/_shared/authorization.ts` の `mayHandleCustomers`）。

| オペレーション | 許可 |
|---|---|
| 一覧、作成、顧客のカルテの取得、更新 | `admin`、サロンの `owner` / `manager` / `staff`（所属サロンは問わない） |
| 顧客のアレルギーの一覧、追加、更新 | 同上 |
| 顧客のアレルギーの削除 | `admin`、サロンの `owner` / `manager`（所属サロンは問わない。顧客の削除と同じ `mayDeleteCustomers`） |

- 判定は最初に行う。権限のないユーザーには、ID、クエリ、本文が不正でも、顧客やカルテやアレルギーが存在しなくても 403 を返す
- 顧客は、自分のカルテとアレルギーも読めない（403）。持病や体調（`medicalConditions`）とアレルギーは、スタッフが施術のために書く情報であるため
- 削除された顧客のカルテとアレルギーは、`admin` にも見えない（404。カルテの一覧にも入らない）

規則は [カルテ](./medical-charts.md) にあります。

### 添付ファイルの権限

添付ファイル（`/api/v1/attachments`）はサロンのもので、ルートはサロンの下にありません。届く範囲は、予約台帳と同じです（`business-logic/attachment/_shared/authorization.ts` の `attachmentReachOf`）。

| オペレーション | 許可 |
|---|---|
| アップロード用 URL の発行（`POST /api/v1/attachments/upload-url`） | `admin`、本文のサロンの `owner` / `manager` / `staff` |
| アップロードの完了、1 件の取得、ダウンロード用 URL の発行（`POST /api/v1/attachments/{attachmentId}/complete`、`GET /api/v1/attachments/{attachmentId}`、`GET /api/v1/attachments/{attachmentId}/download-url`） | `admin`、添付ファイルのサロンの `owner` / `manager` / `staff` |
| 一覧（`GET /api/v1/attachments`） | `admin`（すべてのサロンと、サロンに属さないファイル）、サロンの `owner` / `manager` / `staff`（所属サロンのファイルだけ） |
| 削除（`DELETE /api/v1/attachments/{attachmentId}`） | `admin`、添付ファイルのサロンの `owner` / `manager`、アップロードした本人 |
| 掃除（`POST /api/v1/attachments/purge`） | `admin` だけ |

- 1 段階目は、操作者だけで決まる。ロール `customer` のユーザーと、範囲 `none` のユーザーは、ID、本文、クエリが不正でも 403
- サロンに属さないファイル（`salonId` が null）を扱えるのは `admin` だけ。サロンのメンバーが `salonId: null` で発行すると 403
- 2 段階目は、本文やクエリを確かめたあとに決まる（`reachesFilesOf`）。サロンのメンバーが、発行の本文や一覧のクエリで、ほかのサロンを指定すると 403
- 完了、取得、ダウンロード用 URL の発行、削除には、比べるサロンがない。リポジトリが、操作者に届く範囲を検索の条件にするので（`within`）、ほかのサロンの添付ファイルは見つからない（404）。存在しないものと区別しない
- 削除は、添付ファイルが見つかったあとに判定する（`mayRemoveAttachment`）。`staff` は、自分がアップロードしたものだけを削除できる。ほかの人のものは 403
- 署名付き URL そのものには、認証がない。URL を知っている人は、期限（アップロードは 15 分、ダウンロードは 5 分）まで使える

規則は [添付ファイル](./attachments.md) にあります。

### 共有リンクの権限

共有リンクは、アップロード済みの添付ファイルを、アカウントを持たない人に見せるためのものです。管理するオペレーションと、閲覧するオペレーションで、確かめるものが違います。

| オペレーション | 許可 |
|---|---|
| 発行、一覧（`POST`・`GET /api/v1/attachments/{attachmentId}/share-links`） | `admin`、添付ファイルのサロンの `owner` / `manager` |
| 1 件の取得、失効（`GET`・`DELETE /api/v1/attachments/share-links/{shareLinkId}`） | 同上 |
| ファイルの情報、ダウンロード用 URL の発行（`POST /api/v1/share/file`、`POST /api/v1/share/download-url`） | 認証なし。本文のトークン（と、保護されていればパスワード）を確かめる |

- 管理できるのは、予約を削除できる人と同じ（`business-logic/share-link/_shared/authorization.ts` の `shareLinkReachOf`）。ファイルをサロンの外に出すので、`staff` はできない（403）。ロール `customer` のユーザーと、範囲 `none` のユーザーも、ID、本文、クエリが不正でも 403
- サロンに属さない添付ファイルの共有リンクを扱えるのは `admin` だけ。ほかのサロンの添付ファイルと共有リンクは、見つからない（404）
- 閲覧の 2 つは、アクセストークンを見ない。確かめるのは、共有リンクのトークンとパスワードで、どちらも本文で受け取る（URL に入れた値は、ログや履歴に残るため）
- トークンで開けないとき（存在しない、期限切れ、ダウンロードの上限、失効、添付ファイルの削除）は、理由を区別せずに 404
- パスワードが受け付けられないとき（ない、違う、ロック中）は、401 ではなく 403（`password-required`、コード `1002`）。`WWW-Authenticate` のチャレンジを返せないため。違うパスワードが 5 回続くと、共有リンクを 15 分ロックする（アカウントの[試行回数の制限](#パスワードの確認と試行回数の制限)と同じ回数と時間で、数えるのは共有リンクごと）

規則は [共有リンク](./attachments.md#共有リンク) にあります。

### レビューの権限

レビューは、来店した顧客が書き、誰でも読みます。誰が投稿、修正、削除、参考になったの評価、通報、返信ができるかは、まず操作者で決まります（`business-logic/review/_shared/authorization.ts` の `reviewerOf`、`reviewRemoverOf`、`reviewReporterOf`、`reviewResponderOf`）。修正と削除では、そのあとで、レビューを書いた顧客かどうかを、参考になったでは、書いた顧客でないことを、通報では、顧客なら書いた顧客でないこと、サロンならそのサロンのレビューであることを、返信では、`admin` なら取り下げ（null）であること、サロンならそのサロンのレビューであることを確かめます。通報の一覧と却下は `admin` だけです（`business-logic/review-report/_shared/authorization.ts` の `mayHandleReviewReports`）。

| オペレーション | 許可 |
|---|---|
| 一覧、1 件の取得（`GET /api/v1/reviews`、`/api/v1/reviews/{id}`）、サロンとスタッフの集計（`GET /api/v1/salons/{salonId}/reviews/summary`、`/api/v1/staff/{staffId}/reviews/summary`） | 認証なし（トークンを付けても見ない） |
| 投稿（`POST /api/v1/reviews`） | ロール `customer` で、顧客のプロフィールがあるアカウントだけ |
| 修正（`PATCH /api/v1/reviews/{id}`） | レビューを書いた顧客のアカウントだけ |
| 削除（`DELETE /api/v1/reviews/{id}`） | `admin` と、レビューを書いた顧客のアカウント |
| 参考になった（`POST /api/v1/reviews/{id}/helpful`） | ロール `customer` で、顧客のプロフィールがあるアカウントだけ。自分のレビューは不可 |
| 通報（`POST /api/v1/reviews/{id}/report`） | ロール `customer` で、顧客のプロフィールがあるアカウント（自分のレビューは不可）と、レビューのサロンの `owner`・`manager` |
| サロンからの返信（`POST /api/v1/reviews/{id}/respond`） | レビューのサロンの `owner`・`manager`。`admin` は取り下げ（`ownerResponse` が null）だけ |
| 通報の一覧と却下（`GET /api/v1/review-reports`、`POST /api/v1/review-reports/{id}/dismiss`） | `admin` だけ |

- `admin` と、サロンの `owner` / `manager` / `staff` は、本文が不正でも 403。レビューは顧客の声なので、ほかの人が代わりに書かない
- プロフィールのない顧客のアカウントと、紐づいた顧客が削除されたアカウントも 403
- 本文の `customerId` が、操作者の顧客 ID でなければ 403。ほかの顧客として書けない
- ほかの顧客のレビューの修正と削除は 403。`admin` も修正はできない（403）。サロンのメンバーは、自分のサロンのレビューでも、修正も削除もできない（403）。サロンが、自分に不利なレビューを消せないようにする
- 参考になったも、`admin` とサロンのメンバーは 403。「参考になった順」を顧客の評価だけで決め、サロンが自分のレビューを押し上げられないようにする。自分のレビューも 403。1 人 1 回で、2 回目は数を変えずに 200
- 通報は、`admin` と `staff` は 403。`admin` は通報を扱う側で、レビューを自分で削除できる。サロンは、レビューを削除できない代わりに、自分のサロンのレビューを `admin` に通報できる（ほかのサロンのレビューは 403）。1 つのアカウントに 1 回で、2 回目は 409
- 返信は、`staff` と顧客（レビューを書いた顧客を含む）は 403。返信はサロンの公式の発言なので、サロンを代表する `owner`・`manager` が書き、ほかのサロンのレビューは 403。`admin` は、規約に反する返信を取り下げられるが、サロンの代わりに書くことはできない（文字列は 403）
- 通報の一覧と却下は、`admin` 以外は 403。読めないクエリでも、先に 403 を返す
- 投稿できる予約は、操作者の予約で、ステータスが `completed` のものだけ（400、409）

規則は [レビュー](./reviews.md) にあります。

## 管理者の操作

`/api/v1/admin/auth` は、ほかのユーザーのアカウントを参照し、利用者が自分では直せない状態を直すためのものです。使えるのは操作者の範囲が `platform`（ロール `admin`）のユーザーだけで、それ以外は 403 です（`business-logic/auth/_shared/authorization.ts` の `mayAdministerAccounts`）。

| オペレーション | 動作 | 状態が合わないとき |
|---|---|---|
| `GET /users/{userId}` | ユーザーを返す（`GET /api/v1/auth/me` と同じ `UserResponse`）。自分自身も指定できる | — |
| `POST /unlock/{userId}` | ロックを解除する。`failedLoginAttempts` を 0、`lockedUntil` を null にし、状態が `locked` なら `active` に戻す。ほかの状態（`suspended` など）は変えない | ロックされていなければ 409 |
| `POST /reset-two-factor/{userId}` | 2 要素認証を無効にする（状態を `disabled` にし、シークレットとバックアップコードを削除する）。利用者にメールで知らせる | 状態が `enabled` でなければ 409（設定中の `pending` には触れない） |

- 「ロックされている」とは、状態が `locked` であるか、`lockedUntil` が現在より後であること。期限が過ぎても状態が `locked` のままのアカウント（次に誤ると、すぐにまたロックされる）も解除できる
- 確認の順序は、権限（403）→ ID の形式（400）→ 自分自身でないこと（403）→ ユーザーの存在（404。削除済みも同じ）→ 状態（409）。権限のないユーザーには、ID が不正でも 403 を返す
- **管理者は、自分のアカウントのロック解除と 2 要素認証のリセットはできない**（403）。できると、管理者のセッションを奪った者が、試行回数の制限と 2 つ目の要素を自分で外せる（OWASP Multifactor Authentication Cheat Sheet: 要素の変更を、有効なセッションだけに頼らない）。管理者自身の復旧は、別の管理者が行う
- どちらの変更も、条件を WHERE に含めた 1 つの UPDATE で行う。同じアカウントに同時に 2 回要求しても、成功するのは 1 回で、もう 1 回は 409
- ロックの解除も 2 要素認証のリセットも、そのユーザーのセッションとパスワードは変えない。リセットのあと、利用者はパスワードだけでログインし、2 要素認証を設定し直す
- 2 要素認証のリセットは、認証アプリもバックアップコードも失った利用者のための手段。**依頼してきた人が本人であることの確認は、管理者（サポート）の手続きで行う**。システムは確認しない（OWASP: サポートが本人確認を厳格に行う手続きを持つこと）。メールでの通知（[メール送信](./email.md#送るメール)）は、本人の依頼でなかったときに気づけるようにするためのもの
- 誰が操作したかは、リクエストのログ行の `userId`（[リクエストの認証](#リクエストの認証)）と、パスに含まれる対象のユーザー ID から分かる

管理者の操作に、アカウントの作成、状態の変更、停止、削除はありません。スタッフのアカウントのロールは、サロンの下のルートで、管理者とサロンの `owner` が変えます（[ロールの変更](./staff.md#ロールの変更)）。顧客と管理者のアカウントのロールを変える API はありません。

## 新しいオペレーションを保護する

1. TypeSpec のエラーを、呼び出し方に合うエイリアスにする: 認証なしは `@useAuth(NoAuth)` と `PublicErrors`、ログインしていれば誰でも呼べるものは `SessionErrors`、権限の確認があるものは `CommonErrors`
2. ユースケースの `execute` の第 1 引数に `actor: Actor` を取り、最初に権限を判定して `DomainErrors.forbidden()` を返す。判定は `business-logic/<domain>/_shared/authorization.ts` に純粋な関数として置く（例: `business-logic/salon/_shared/authorization.ts`）
3. ハンドラーを `authenticated(...)` で包む（`backend/packages/api/src/shared/authentication.ts`）。包まれたハンドラーだけが `actor` を受け取るので、認証を付け忘れたハンドラーは権限を判定するユースケースを呼べない

```typescript
// backend/packages/api/src/routes/salon/update-salon.handler.ts（抜粋）
export const updateSalonHandler = (
  dependencies: SalonUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  { id: string },
  UpdateSalonResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateSalonUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)
    // match(result) ...
  })
}
```

サロンに属するデータ（スタッフなど）を、サロンの下のルートで実装するときは、[サロンの下にあるルートの権限](#サロンの下にあるルートの権限) に従います。ユースケースは、パスの ID を `parseSalonIdOfPath`（`backend/packages/domain/src/models/salon.ts`）で検証し、そのサロンで権限を判定してから、`requireSalon`（`business-logic/_shared/existing-salon.ts`）でサロンの存在を確認します。対象は、そのサロンのものだけを検索します。例は `business-logic/service-category/` と `business-logic/service/`（読むのは認証なし）、`business-logic/staff/`（どのオペレーションにも認証が要る）、`business-logic/payment-method/`（どのオペレーションにも認証が要り、読む権限と設定する権限が違う）、`business-logic/staff-schedule/`（サロンで判定したあと、対象の ID でもう一度判定する）、`business-logic/staff-invitation/`（サロンで判定したあと、本文の値でもう一度判定する）、`business-logic/staff-account/`（同じ 2 段階のあとに、操作者自身のアカウントでないことを確認する）です。パスが対象を指定せず、アカウントが対象を決めるルートの例は、`business-logic/customer/` の `*-customer-profile.usecase.ts`（`/api/v1/customers/me`）と、`business-logic/staff-profile/` の `*-own-staff-profile.usecase.ts`（`/api/v1/staff-profiles/me`）です。

サロンに属さないデータは、操作者だけで権限を判定し、最初に判定します。例は `business-logic/customer/`（[顧客台帳の権限](#顧客台帳の権限)）です。ログインしているアカウント自身のデータは、対象をパスの ID ではなく操作者の範囲から決めます。例は同じディレクトリの `*-customer-profile.usecase.ts` です。`business-logic/customer-preferences/` のユースケースは、この 2 つの判定をそのまま使います。

サロンに属するが、ルートがサロンを指定しないデータは、操作者に届く範囲を最初に決め、リクエストがサロンを指定したところで、そのサロンが範囲に入るかを判定します。保存されている行を読むクエリには、範囲を条件として渡します。例は `business-logic/booking/`（[予約台帳の権限](#予約台帳の権限)）と `business-logic/sale/`（[売上台帳の権限](#売上台帳の権限)）です。

## シードのアカウント

`pnpm db:seed` は、次のアカウントを同じパスワードで作ります。パスワードは `backend/packages/database/src/seeds/seed-data/users.ts` の `SEED_PASSWORD` です。公開されているパスワードなので、`pnpm db:seed` は本番環境（`NODE_ENV=production`）では実行を拒否します。

| メールアドレス | ロール | 範囲 |
|---|---|---|
| `admin@beautysalon.jp` | `admin` | すべてのサロン |
| `owner@beautysalon.jp` | `owner` | 1 つ目のサロンと、自分のスタッフのプロフィール（`/api/v1/staff-profiles/me`） |
| `manager@beautysalon.jp` | `manager` | 同上 |
| `stylist1@beautysalon.jp`、`stylist2@beautysalon.jp` | `staff` | 同上 |
| `therapist@beautysalon.jp` | `staff` | 2 つ目のサロンと、自分のスタッフのプロフィール |
| `customer1@example.com` 〜 `customer3@example.com`、`vip.customer@example.com` | `customer` | 自分のプロフィール（`/api/v1/customers/me`）、自分の好み設定（`/api/v1/customers/me/preferences`）、自分の予約（`/api/v1/customers/me/bookings`） |

```bash
curl -s http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@beautysalon.jp","password":"<SEED_PASSWORD>","rememberMe":false,"twoFactorCode":null}'
```

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/auth.tsp`、`specs/operations/auth-operations.tsp`、`specs/models/_shared/common-api-patterns.tsp`（`UnauthenticatedResponse`、`PermissionDeniedResponse`、エラーのエイリアス） |
| ドメイン | `backend/packages/domain/src/models/auth.ts`（`Actor`）、`schemas/auth.schema.ts`、`mappers/write/{user,session}.mapper.ts`（リクエストが示した値をそのまま返す。セッションの一覧の条件も作る）、`mappers/read/{user,session}.mapper.ts`（アカウントとセッションの答え、セッションの一覧のページ、ログインとトークン再発行の答え、2 要素認証の設定とバックアップコードの答え）、`business-logic/auth/`、`business-logic/auth/_shared/actor.ts`（操作者の範囲と、どのサロンにも届かないアカウントの条件）、`business-logic/staff-invitation/`（スタッフの招待。確認、受け入れ、参加を含む）、`business-logic/staff-account/`（スタッフに紐づいたアカウント）、`repositories/{user,session,staff-invitation,staff-account}.repository.ts`、`services/`（`IPasswordHasher`、`ITokenIssuer`、`ITwoFactorAuthenticator`、`IMailer`） |
| インフラ | `backend/packages/infrastructure/src/security/`（`Argon2PasswordHasher`、`RandomTokenIssuer`、`TotpAuthenticator`）、`mail/smtp-mailer.ts`、`repositories/{user,session,staff-invitation,staff-account}.repository.impl.ts` |
| API | `backend/packages/api/src/shared/authentication.ts`、`shared/signed-in-user.ts`（ログ行の `userId`）、`shared/never-stored.ts`（`Cache-Control: no-store`）、`routes/auth/`、`routes/admin-auth/`、`routes/staff-invitation/`（招待された側のルーターは `/api/v1/auth/staff-invitation` にマウントする。参加のハンドラーだけが `authenticated` で包まれる）、`routes/staff-account/` |
| フロントエンド | `frontend/packages/io/src/libs/session/`（保存）、`frontend/packages/api-client/src/fetcher/`（送ることと再発行）、`frontend/packages/session/src/`（`useSession`、`signIn`、`signOut`、サインインの画面 `screens/sign-in-screen.tsx` と、そのフォーム `components/sign-in-form/`、画面の出し分け `screens/require-session.tsx`、ヘッダーのアカウント欄 `screens/session-account.tsx`）、各アプリの `src/App.tsx`（使えるロール） |
