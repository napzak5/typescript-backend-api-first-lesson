# 認証と認可

API の利用者をどう特定し、何を許可するかをまとめます。コントラクトは `specs/operations/auth-operations.tsp`、実装は各層の `auth` 以下にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| `POST /api/v1/auth/login`、`/refresh`、`/logout`、`/logout-all`、`GET /api/v1/auth/me` | 実装済み |
| ユーザー登録（`/register`）、メールアドレスの確認（`/verify-email/send`、`/verify-email/confirm`）、パスワードの再設定（`/forgot-password`、`/reset-password/verify`、`/reset-password`）・変更（`/change-password`） | 実装済み |
| 2 要素認証（`/2fa/enable`、`/2fa/verify`、`/2fa/disable`、`/2fa/backup-codes`）と、ログインでのコードの確認 | 実装済み |
| セッションの一覧（`GET /api/v1/auth/sessions`）と無効化（`DELETE /api/v1/auth/sessions/{sessionId}`） | 実装済み |
| 管理者の操作（`/api/v1/admin/auth` のユーザーの参照、ロックの解除、2 要素認証のリセット） | 実装済み |

コントラクトの認証のオペレーション（`AuthCrud`、`SessionCrud`、`AdminAuthCrud`）は、すべて実装されています。

登録で作れるのは顧客（ロール `customer`）のアカウントだけです。`admin`、`owner`、`manager`、`staff` のアカウントを作る API はまだないので、シード（`pnpm db:seed`）か SQL で作ります。

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

登録・再設定・変更で設定するパスワードに適用します。根拠は NIST SP 800-63B-4 3.1.1.2 です。

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

## ユーザー登録

`POST /api/v1/auth/register` は、メールアドレスが登録済みかどうかにかかわらず 204 を返します（OWASP Authentication Cheat Sheet: 登録の応答からアカウントの有無が分からないようにする）。入力の検証エラー（400）は、アカウントの有無に関係なく返ります。

| メールアドレスの状態 | 動作 |
|---|---|
| 未登録 | ロール `customer`、状態 `unverified` のユーザーを作り、確認メールを送る |
| 登録済みで、状態が `unverified` | 前回の確認メールから 60 秒以上たっていれば、パスワードを今回のものに置き換え、確認メールを送り直す（前のリンクは無効になる）。60 秒以内なら何もしない |
| それ以外（確認済み、停止中など） | 何も変えず、何も送らない |

- どの場合もパスワードのハッシュを 1 回計算し、メールの送信を待たずに応答するので、応答時間でも区別できない
- `unverified` のアカウントはログインできない。確認が済むと `active` になる
- 登録したユーザーは顧客情報（`customers` の行）を持たない（`customerId` は null、操作者の範囲は `none`）。顧客情報の作成は Customer ドメインで扱う
- 他人のメールアドレスで先に登録されていても、本人があとから登録すればパスワードは本人のものに置き換わる。確認メールのリンクが有効にするのは、最後に登録されたパスワード

## メールで送るトークン

メールアドレスの確認とパスワードの再設定は、メールで送ったトークンで本人を確かめます。

| 項目 | 決まり |
|---|---|
| 形式 | セッションのトークンと同じ（CSPRNG の 256 ビット、base64url）。DB には SHA-256 のハッシュだけを保存する（`emailVerificationTokenHash`、`passwordResetTokenHash`） |
| 有効期間 | メールアドレスの確認は 24 時間、パスワードの再設定は 30 分 |
| 使える回数 | 1 回。新しいトークンを発行すると、前のトークンは使えなくなる（ユーザーごと・種類ごとに 1 つ） |
| 送信の間隔 | 同じアカウントへは、種類ごとに 60 秒に 1 通まで。それより短い間隔の要求は、何も送らずに 204 を返す |
| 無効なトークン | 400（`errors[].field` は `token`、`rule` は `invalid_token`）。存在しない、使用済み、期限切れを区別しない |

リンクは `PUBLIC_APP_URL`（設定値）から組み立てます。リクエストの `Host` ヘッダーは使いません（OWASP Forgot Password Cheat Sheet）。トークンは URL のフラグメントに置くので、サーバーのアクセスログにも `Referer` にも残りません。

| メール | リンク |
|---|---|
| メールアドレスの確認 | `<PUBLIC_APP_URL>/verify-email#token=<トークン>` |
| パスワードの再設定 | `<PUBLIC_APP_URL>/reset-password#token=<トークン>` |

リンク先のページは、フラグメントからトークンを取り出して API（`/verify-email/confirm`、`/reset-password`）に送ります。このページはフロントエンドにまだありません。

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
| `platform` | `admin` | すべてのサロン |
| `salon` | `owner`、`manager`、`staff`。`users.staffId` が指すスタッフが有効（`isActive`、未削除）で、そのサロンが未削除であること | そのサロン。範囲はロール・サロン ID・スタッフ ID を持つ |
| `customer` | `customer`。`users.customerId` があること | 自分の顧客情報 |
| `none` | 上のどれにも当たらない（スタッフ情報が削除された `staff` など） | 範囲を必要とするものには届かない。ログインはできる |

- ロールは `users.role` の固定 5 種。`users.permissions` は保存しているだけで、判定には使わない
- 1 人のユーザーが属するサロンは 1 つ（`users.staffId` が 1 つのため）

### Salon API の権限

| オペレーション | 許可 |
|---|---|
| 一覧、1 件の取得 | 認証なし（予約前に閲覧できるようにする） |
| 作成 | `admin` |
| 更新 | `admin`、そのサロンの `owner` / `manager` |
| 削除 | `admin`、そのサロンの `owner` |

権限は、リクエストの本文を検証する前、対象を検索する前に判定します。ほかのサロンの `owner` が更新しようとすると、そのサロンが存在しなくても 403 です（サロンは公開情報なので、存在を隠す必要がない）。

### サロンの下にあるルートの権限

サロンに属するデータのルートは、`/api/v1/salons/{salonId}/...` のようにサロンの下に置きます。権限は、**パスの `salonId` だけ**で判定します。

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

カテゴリーとサービスの規則は [サービスメニュー](./service-menu.md) にあります。

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

アカウントの作成、ロールや状態の変更、停止、削除を行う API はありません。

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

サロンに属するデータ（顧客、予約、スタッフなど）を実装するときは、[サロンの下にあるルートの権限](#サロンの下にあるルートの権限) に従います。ユースケースは、パスの ID を `parseSalonIdOfPath`（`backend/packages/domain/src/models/salon.ts`）で検証し、そのサロンで権限を判定してから、`requireSalon`（`business-logic/_shared/existing-salon.ts`）でサロンの存在を確認します。対象は、そのサロンのものだけを検索します。例は `business-logic/service-category/` と `business-logic/service/` です。

## シードのアカウント

`pnpm db:seed` は、次のアカウントを同じパスワードで作ります。パスワードは `backend/packages/database/src/seeds/seed-data/users.ts` の `SEED_PASSWORD` です。公開されているパスワードなので、`pnpm db:seed` は本番環境（`NODE_ENV=production`）では実行を拒否します。

| メールアドレス | ロール | 範囲 |
|---|---|---|
| `admin@beautysalon.jp` | `admin` | すべてのサロン |
| `owner@beautysalon.jp` | `owner` | 1 つ目のサロン |
| `manager@beautysalon.jp` | `manager` | 1 つ目のサロン |
| `stylist1@beautysalon.jp`、`stylist2@beautysalon.jp` | `staff` | 1 つ目のサロン |
| `therapist@beautysalon.jp` | `staff` | 2 つ目のサロン |
| `customer1@example.com` 〜 `customer3@example.com`、`vip.customer@example.com` | `customer` | 自分の顧客情報 |

```bash
curl -s http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@beautysalon.jp","password":"<SEED_PASSWORD>","rememberMe":false,"twoFactorCode":null}'
```

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/auth.tsp`、`specs/operations/auth-operations.tsp`、`specs/models/_shared/common-api-patterns.tsp`（`UnauthenticatedResponse`、`PermissionDeniedResponse`、エラーのエイリアス） |
| ドメイン | `backend/packages/domain/src/models/auth.ts`（`Actor`）、`business-logic/auth/`、`repositories/{user,session}.repository.ts`、`services/`（`IPasswordHasher`、`ITokenIssuer`、`ITwoFactorAuthenticator`、`IMailer`） |
| インフラ | `backend/packages/infrastructure/src/security/`（`Argon2PasswordHasher`、`RandomTokenIssuer`、`TotpAuthenticator`）、`mail/smtp-mailer.ts`、`repositories/{user,session}.repository.impl.ts` |
| API | `backend/packages/api/src/shared/authentication.ts`、`shared/signed-in-user.ts`（ログ行の `userId`）、`routes/auth/`、`routes/admin-auth/` |
