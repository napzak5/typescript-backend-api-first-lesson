# 添付ファイル

サロンが扱うファイル（施術の前後の写真、同意書などの書類）と、そのファイルをアカウントを持たない人に見せる[共有リンク](#共有リンク)の規則をまとめます。コントラクトは `specs/operations/attachment-operations.tsp`（`AttachmentOperations` の `AttachmentCrud`・`ShareLinkCrud` と、`ShareOperations` の `SharedFileCrud`）と `specs/models/attachment.tsp`、テーブルは `attachments` と `share_links` です。

ファイルの中身は、S3 互換のオブジェクトストレージに置きます。**API サーバーは、ファイルの中身を受け取らず、返しません**。アップロードもダウンロードも、短時間だけ有効な署名付き URL で、クライアントがストレージと直接やりとりします。API が扱うのは、ファイルについて分かっていること（名前、種類、サイズ、状態）と、その URL の発行です。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| アップロード用 URL の発行（`getUploadUrl`） | 実装済み |
| アップロードの完了（`complete`） | 実装済み |
| 一覧（`list`） | 実装済み |
| 1 件の取得（`get`） | 実装済み |
| ダウンロード用 URL の発行（`getDownloadUrl`） | 実装済み |
| 削除（`delete`） | 実装済み |
| 掃除（`purge`） | 実装済み |
| 共有リンクの発行・一覧・1 件の取得・失効（`ShareLinkCrud` の `create`・`list`・`get`・`delete`） | 実装済み |
| 共有リンクでの閲覧（`SharedFileCrud` の `get`・`getDownloadUrl`） | 実装済み |

- `multipart/form-data` で API サーバーにファイルを送るオペレーションはありません。アップロードは、署名付き URL の 1 通りです
- 添付ファイルの画面は、admin-app のサロンのファイルの画面です（一覧とアップロード、開く、保存する、削除する。[サロンのファイルの画面](./frontend-api-integration.md#サロンのファイルの画面)）。サロンに属さないファイルと掃除の画面はありません
- 共有リンクの画面は、admin-app の発行と管理の画面（ファイルの画面の下の一覧、発行、取り消し。[共有リンクの発行と管理の画面](./frontend-api-integration.md#共有リンクの発行と管理の画面)）と、portal-app の共有リンクを開く画面（[共有リンクの画面](./frontend-api-integration.md#共有リンクの画面)）です。閲覧者のメールアドレスの確認と、アクセスの通知はありません（[共有リンクにないもの](#共有リンクにないもの)）
- 添付ファイルを、予約・顧客・施術記録に紐づけるコントラクトはありません。施術記録の写真（`treatment_photos`）は URL を持つ別のもので、添付ファイルとはつながっていません（[施術写真](./treatments.md#施術写真)）
- 画像の変換（サムネイルの生成、再エンコード）と、ウイルスの検査はしません
- 本番のバケット、認証情報、バケットの CORS の設定、[掃除](#掃除)を定期的に呼ぶ仕組みは、本番環境の準備の範囲です

## アップロードの流れ

```
クライアント                       API サーバー                 ストレージ
    │ POST /attachments/upload-url     │                          │
    │ {filename, contentType, size,    │                          │
    │  salonId}                        │                          │
    │─────────────────────────────────▶│ pending の行を作る        │
    │ 201 {attachment, uploadUrl,      │ URL に署名する            │
    │      uploadHeaders}              │（ストレージには接続しない）│
    │◀─────────────────────────────────│                          │
    │ PUT uploadUrl（uploadHeaders と、申告したサイズの本文）       │
    │─────────────────────────────────────────────────────────────▶│
    │ 200                                                          │
    │◀─────────────────────────────────────────────────────────────│
    │ POST /attachments/{id}/complete  │                          │
    │─────────────────────────────────▶│ サイズと先頭のバイトを読む │
    │                                  │─────────────────────────▶│
    │ 200 {status: "uploaded", …}      │ uploaded にする           │
    │◀─────────────────────────────────│                          │
```

1. **発行**: クライアントが、ファイルの名前・種類・サイズを申告します。サーバーは、状態 `pending` の添付ファイルを作り、アップロード用の URL を返します
2. **アップロード**: クライアントが、`uploadUrl` に、`uploadHeaders` のヘッダーを付けて、ファイルの中身を `PUT` で送ります。送り先はストレージで、API サーバーではありません
3. **完了**: クライアントが `complete` を呼びます。サーバーは、ストレージのファイルが申告のとおりであることを確かめて、状態を `uploaded` にします。一覧に出て、ダウンロードできるのは、ここからです

## 添付ファイル

| プロパティ | 意味 |
|---|---|
| `id` | 添付ファイルの ID |
| `salonId` | ファイルが属するサロン。サロンに属さないファイル（`admin` だけが扱える）は null |
| `filename` | アップロードした元のファイル名。ダウンロードするときの名前になります |
| `contentType` | ファイルの種類。`image/jpeg`、`image/png`、`image/webp`、`application/pdf` のどれか |
| `size` | ファイルのサイズ（バイト）。1〜10,485,760 |
| `status` | `pending`（アップロード待ち）か `uploaded`（アップロード済み） |
| `uploadedBy` | アップロード用の URL を発行したユーザー |
| `uploadExpiresAt` | アップロード用の URL の有効期限。発行の 15 分後 |
| `uploadedAt` | アップロードを確かめた日時。`pending` のあいだは null |
| `createdAt`、`updatedAt` | URL を発行した日時、最後に更新した日時 |

- プロパティの名前は、`attachments` の列と同じです。値のないものは null で、キーは省きません
- **保存先のキーは、レスポンスに出しません**。キーは `attachments/<添付ファイルの ID>` で、サーバーが決めます（`storageKeyOf`）。利用者が決めた文字列（ファイル名など）を含まないので、列もありません
- 削除した日時（`deletedAt`）は、列にだけあります。削除した添付ファイルは、どのオペレーションからも見えません（[削除](#削除)）

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| アップロード用 URL の発行 | `POST /api/v1/attachments/upload-url` | `admin`、本文のサロンの `owner` / `manager` / `staff` |
| アップロードの完了 | `POST /api/v1/attachments/{attachmentId}/complete` | `admin`、添付ファイルのサロンの `owner` / `manager` / `staff` |
| 一覧 | `GET /api/v1/attachments` | `admin`（すべてのサロンと、サロンに属さないファイル）、サロンの `owner` / `manager` / `staff`（所属サロンのファイルだけ） |
| 1 件の取得 | `GET /api/v1/attachments/{attachmentId}` | `admin`、添付ファイルのサロンの `owner` / `manager` / `staff` |
| ダウンロード用 URL の発行 | `GET /api/v1/attachments/{attachmentId}/download-url` | 同上 |
| 削除 | `DELETE /api/v1/attachments/{attachmentId}` | `admin`、添付ファイルのサロンの `owner` / `manager`、アップロードした本人 |
| 掃除 | `POST /api/v1/attachments/purge` | `admin` |

- 添付ファイルの 7 つのオペレーションには、すべて認証が要ります（共有リンクのオペレーションは、[共有リンク](#共有リンクのオペレーションと権限)にまとめます）
- 届く範囲は、予約台帳と同じです（`business-logic/attachment/_shared/authorization.ts` の `attachmentReachOf`）。`admin` はすべてのサロン、サロンのメンバーは所属サロンだけです
- **サロンに属さないファイル（`salonId` が null）を扱えるのは `admin` だけ**です。サロンのメンバーが `salonId: null` で発行すると 403 です
- ロール `customer` のユーザーと、ロールに必要なレコードを持たないユーザー（範囲 `none`）は、どのオペレーションも 403 です。ID、本文、クエリが不正でも 403 です
- ほかのサロンの添付ファイルは、存在しないものと区別しません（404）。リポジトリが、届く範囲を検索の条件にします（`within`）
- 削除は、予約を削除できる人（`admin`、サロンの `owner` / `manager`）と、アップロードした本人（`uploadedBy`）です（`mayRemoveAttachment`）。`staff` は、自分がアップロードしたものだけを削除できます。ほかの人のものは 403 です
- 掃除は、ポイントの失効や顧客のデータの消去の実行と同じく、プラットフォーム全体に対する操作なので、`admin` だけです（`mayPurgeAttachments`）

### 確認の順序

| 順 | 発行 | 完了、取得、削除 | ダウンロード用 URL | 一覧 | 掃除 |
|---|---|---|---|---|---|
| 1 | アクセストークン（401） | 同左 | 同左 | 同左 | 同左 |
| 2 | 添付ファイルを扱えるか（403） | 同左 | 同左 | 同左 | `admin` か（403） |
| 3 | 本文（400） | ID（400） | ID（400） | クエリ（400） | |
| 4 | 本文のサロンに届くか（403） | 添付ファイルの存在（404） | クエリ（400） | クエリのサロンに届くか（403） | |
| 5 | サロンの存在（400。`salonId` の `not_found`） | 削除: 削除できるか（403） | 添付ファイルの存在（404） | カーソルが一覧のものか（400。`cursor` の `not_found`） | |
| 6 | | 完了: ファイルの有無、サイズ、形式（409） | 状態（409） | | |

- 本文が JSON でないときは 415、JSON として読めないときは 400 です（ほかのルートと同じ）
- 本文の余分なキーは 400 です（`unrecognized_keys`）。`key`、`status`、`uploadedBy` のような、サーバーが決める値は送れません

## 受け付けるファイル

| 項目 | 規則 |
|---|---|
| 種類（`contentType`） | `image/jpeg`、`image/png`、`image/webp`、`application/pdf` の 4 つだけ |
| ファイル名（`filename`） | 1〜255 文字。制御文字（C0、DEL、C1）と `/`・`\` を含められません |
| 拡張子 | 種類に対応するもの（下の表）で終わること。大文字と小文字は区別しません。拡張子の前に 1 文字以上が要ります（`.png` だけの名前は不可） |
| サイズ（`size`） | 1〜10,485,760 バイト（10 MiB）の整数 |
| サロン（`salonId`） | サロンの ID か null。キーは必須です |

| 種類 | 拡張子 | ファイルの先頭（[完了](#アップロードの完了)で確かめる） |
|---|---|---|
| `image/jpeg` | `.jpg`、`.jpeg` | `FF D8 FF` |
| `image/png` | `.png` | `89 50 4E 47 0D 0A 1A 0A` |
| `image/webp` | `.webp` | `RIFF`、4 バイトの長さ、`WEBP` |
| `application/pdf` | `.pdf` | `%PDF-` |

- HTML や SVG のように、ブラウザーが実行しうる種類は受け付けません
- 拡張子は、名前の最後だけを見ます。`a.png.html` は、種類が `image/png` なら 400 です
- ファイル名は、保存先のキーには使いません。ダウンロードのときの名前（`Content-Disposition`）にだけ使います
- 規則は `business-logic/attachment/_shared/file-rules.ts` と `schemas/attachment.schema.ts` にあります。サイズ、ファイル名の長さ、種類は、テーブルの制約でも守ります（[DB の制約](#db-の制約)）

## アップロード用 URL の発行

`POST /api/v1/attachments/upload-url` は、状態 `pending` の添付ファイルを作り、201 と `Location`（添付ファイルの URL）を返します。

```json
{
  "data": {
    "attachment": { "id": "…", "status": "pending", "uploadExpiresAt": "…", "…": "…" },
    "uploadUrl": "https://<ストレージ>/<バケット>/attachments/<id>?X-Amz-…",
    "uploadHeaders": { "Content-Type": "image/png", "If-None-Match": "*" }
  },
  "meta": { "…": "…" },
  "links": {
    "self": "/api/v1/attachments/<id>",
    "list": "/api/v1/attachments",
    "complete": "/api/v1/attachments/<id>/complete"
  }
}
```

- **URL は、`attachment.uploadExpiresAt` まで有効**です（発行の 15 分後。`UPLOAD_URL_MINUTES`）。署名は秒の単位なので、URL が切れるのは、その時刻より早くはならず、遅くても 1 秒以内です
- **URL は、申告した種類とサイズを署名に含みます**。`Content-Type` が違う本文、`Content-Length` が申告と違う本文は、ストレージが拒否します（403）
- **URL が受け付けるのは 1 回だけ**です。署名に `If-None-Match: *` を含めるので、キーにファイルがあるあいだ、ストレージは 2 回目の `PUT` を拒否します（412）。完了のあとに、同じ URL でファイルを差し替えることはできません
- クライアントは、`uploadHeaders` のヘッダーをすべて、そのままの値で `PUT` に付けます。`Content-Length` は、本文を送れば決まるので、`uploadHeaders` にはありません（ブラウザーは、スクリプトに `Content-Length` を設定させません）
- 発行は、ストレージに接続しません。署名は、サーバーが持つ秘密鍵での計算です。ストレージが止まっていても、URL は発行できます（アップロードは失敗します）
- URL は、ブラウザーから見たストレージ（`STORAGE_PUBLIC_ENDPOINT`）を指します
- 存在しないサロンと、削除したサロンは 400 です（`salonId` の `not_found`）

## アップロードの完了

`POST /api/v1/attachments/{attachmentId}/complete` は、ストレージのファイルを確かめて、状態を `uploaded` にします（200）。本文はありません。

| ストレージの状態 | 応答 | 添付ファイル |
|---|---|---|
| ファイルがない | 409 | `pending` のまま。アップロードしてから、もう一度呼べます |
| サイズが申告と違う | 409 | **削除します**。ストレージのファイルも消します |
| 先頭のバイトが、申告した種類の形式でない | 409 | 同上 |
| 申告のとおり | 200 | `uploaded`。`uploadedAt` が入ります |

- **`Content-Type` は、クライアントが決める値なので、それだけでは信用しません**（OWASP File Upload Cheat Sheet）。ストレージが持つ種類も、クライアントが送った値です。サーバーは、ファイルの先頭の 12 バイトを読み、申告した種類の形式であることを確かめます（`beginsAs`）
- **申告と違うファイルは、その添付ファイルを終わらせます**。先に添付ファイルを削除済みにし、そのあとでストレージのファイルを消します。クライアントは、アップロード用 URL の発行からやり直します。削除済みにするのが先なので、同時に届いた別の完了が、消す前のファイルを見て `uploaded` にすることはありません
- 削除済みにしたあとで、ストレージのファイルを消せなかったときは 500 です。残ったファイルは、[掃除](#掃除)が行と一緒に消します
- **すでに `uploaded` の添付ファイルは、そのまま 200 で返します**。ストレージは見ません。応答を受け取れなかったクライアントが、もう一度呼べるようにするためです
- URL の有効期限が過ぎていても、ファイルがストレージにあれば完了できます。期限の前に送り終えたアップロードを、期限のあとに完了させることがあるためです。完了しないまま、期限から 24 時間たつと、掃除の対象になります
- ストレージを読めなかったときは 500 で、何も変えません（もう一度呼べます）

## 一覧と 1 件の取得

`GET /api/v1/attachments` は、アップロード済みで、削除していない添付ファイルを返します。

- 順序は、アップロードを確かめた日時（`uploadedAt`）の新しい順で、同じ日時なら ID の大きい順です
- `pending` の添付ファイルは、一覧に出ません
- クエリは、`limit`（1〜100。既定は 20）、`cursor`（前のページの `meta.nextCursor`）、`salonId`（サロンで絞る）です。ほかのキーは 400 です
- `cursor` は、そのページの最後の添付ファイルの ID です。同じ絞り込みの一覧に出る添付ファイルの ID でなければ 400 です（`cursor` の `not_found`）。削除した添付ファイル、`pending` のもの、ほかのサロンのものがこれにあたります
- `meta.total` は、絞り込みに合う件数です。`links` は、ページのリンクです（`self`、`first`、`next`。ページは前へ進むだけなので、`prev` と `last` は null）
- サロンのメンバーが、`salonId` にほかのサロンを指定すると 403 です。指定しなければ、所属サロンのファイルだけが返ります
- `admin` が `salonId` を指定しなければ、すべてのサロンのファイルと、サロンに属さないファイルが返ります。サロンに属さないファイルだけに絞るクエリはありません

`GET /api/v1/attachments/{attachmentId}` は、`pending` の添付ファイルも返します。アップロードの途中のクライアントが、状態と期限を確かめられるようにするためです。

## ダウンロード用 URL の発行

`GET /api/v1/attachments/{attachmentId}/download-url` は、ファイルを取得する URL を返します。

```json
{
  "data": { "downloadUrl": "https://<ストレージ>/…", "expiresAt": "…" },
  "meta": { "…": "…" },
  "links": {
    "self": "/api/v1/attachments/<id>/download-url",
    "attachment": "/api/v1/attachments/<id>"
  }
}
```

- **URL は 5 分だけ有効**です（`DOWNLOAD_URL_MINUTES`）。`expiresAt` は、発行した時刻の 5 分後です
- クエリ `inline=true` なら、ブラウザーの中で表示する URL（`Content-Disposition: inline`）、そうでなければ、元のファイル名で保存する URL（`attachment`）です。既定は保存です。`true`・`false` 以外の値と、ほかのキーは 400 です
- **ストレージは、添付ファイルの種類（`contentType`）を `Content-Type` として返します**。アップロードのときにストレージが受け取った値ではなく、行の値を、署名に含めて指定します
- ファイル名は、`Content-Disposition` に 2 通りで入れます（RFC 6266）。ASCII の名前（`filename=`。ASCII でない文字と `"`・`\`・`%` は `_`）と、UTF-8 の名前（`filename*=`。RFC 8187）です
- `pending` の添付ファイルは 409 です
- 発行は、ストレージに接続しません。ファイルがあるかどうかは見ません
- URL を知っている人は、期限まで、認証なしでファイルを取得できます。URL をログに出したり、ほかの人に渡したりしないでください。アカウントを持たない人に見せるときは、[共有リンク](#共有リンク)を使います

## 削除

`DELETE /api/v1/attachments/{attachmentId}` は、ストレージのファイルを消してから、添付ファイルを削除済みにします（204）。

- **ファイルが先、行があと**です。ストレージのファイルを消せなかったときは、何も変えずに 500 を返します。ストレージの削除は冪等なので、もう一度呼べば消せます
- 行は消さず、削除した日時（`deletedAt`）を入れます。**アップロード用の URL が、まだ有効かもしれないため**です。削除のあとに、その URL でアップロードされたファイルは、行と一緒に[掃除](#掃除)が消します。行をすぐに消すと、そのファイルを指すものがなくなり、ストレージに残り続けます
- 削除済みの添付ファイルは、取得、完了、ダウンロード用 URL の発行、もう一度の削除のどれも 404 で、一覧にも出ません。`admin` にも見えません
- `pending` の添付ファイルも削除できます
- 削除した添付ファイルの共有リンクは、すぐに使えなくなります（[添付ファイルの削除と共有リンク](#添付ファイルの削除と共有リンク)）

## 掃除

`POST /api/v1/attachments/purge` は、要らなくなった行と、そのファイルを消し、消した行の数を返します（200）。本文はありません。

```json
{ "data": { "purgedCount": 3 }, "meta": { "…": "…" }, "links": null }
```

| 対象 | 条件 |
|---|---|
| 削除した添付ファイル | アップロード用の URL の有効期限を過ぎている |
| 完了しなかったアップロード | `pending` のまま、URL の有効期限から 24 時間（`PENDING_KEPT_HOURS`）を過ぎている |

- どちらも、URL の有効期限を過ぎてから消します。期限の前は、その URL でファイルが置かれるかもしれないためです
- 1 件ごとに、1 つのトランザクションです。行をロックし（`FOR UPDATE`）、条件をもう一度確かめ、ストレージのファイルを消し、行を消します。ロックを待つあいだに完了したアップロードは、消しません
- **ファイルを消せなかったら、そこで止めて 500 を返します**。それまでの分は消してあり、止まった行は残っています。もう一度呼ぶと、残りを消します
- 何もなければ `purgedCount` は 0 です
- 行を消すと、その添付ファイルの共有リンクの行も一緒に消えます（外部キーの `ON DELETE CASCADE`）
- 定期的に呼ぶ仕組み（スケジューラー）は、本番環境の準備の範囲です。呼ぶ間隔は、ストレージに残るファイルを、どれだけの時間まで許すかで決めます。管理者が、admin-app の[運用の画面](./frontend-api-integration.md#運用の画面)から実行します

## 共有リンク

サロンが、アップロード済みの添付ファイルを、アカウントを持たない人（顧客、取引先）に見せるためのリンクです。リンクのトークンを知っている人は、期限まで、ファイルの名前・種類・サイズを見て、ダウンロードできます。テーブルは `share_links` です。

```
サロン（owner / manager）            API サーバー                    閲覧者（アカウントなし）
    │ POST /attachments/{id}/share-links │                              │
    │ {expiresAt, maxDownloads, password}│                              │
    │───────────────────────────────────▶│ トークンを作り、              │
    │ 201 {shareLink, token}             │ ハッシュだけを保存する        │
    │◀───────────────────────────────────│                              │
    │ トークンを渡す（API の外。パスワードは別の経路で）                 │
    │─────────────────────────────────────────────────────────────────▶│
    │                                    │ POST /share/file             │
    │                                    │ {token, password}            │
    │                                    │◀─────────────────────────────│
    │                                    │ 200 {filename, contentType,  │
    │                                    │      size}                   │
    │                                    │─────────────────────────────▶│
    │                                    │ POST /share/download-url     │
    │                                    │ {token, password, inline}    │
    │                                    │◀─────────────────────────────│
    │                                    │ 200 {downloadUrl, expiresAt} │
    │                                    │─────────────────────────────▶│
    │                                    │        GET downloadUrl（送り先はストレージ）
```

### 共有リンクのオペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 発行 | `POST /api/v1/attachments/{attachmentId}/share-links` | `admin`、添付ファイルのサロンの `owner` / `manager` |
| 一覧 | `GET /api/v1/attachments/{attachmentId}/share-links` | 同上 |
| 1 件の取得 | `GET /api/v1/attachments/share-links/{shareLinkId}` | 同上 |
| 失効 | `DELETE /api/v1/attachments/share-links/{shareLinkId}` | 同上 |
| ファイルの情報 | `POST /api/v1/share/file` | だれでも（認証なし） |
| ダウンロード用 URL の発行 | `POST /api/v1/share/download-url` | だれでも（認証なし） |

- **サロンの外にファイルを出すので、`staff` は発行も一覧もできません**（403）。添付ファイルの削除と同じく、予約を削除できる人（`admin`、サロンの `owner` / `manager`）が決めます（`business-logic/share-link/_shared/authorization.ts` の `shareLinkReachOf`）
- `staff`、ロール `customer` のユーザー、ロールに必要なレコードを持たないユーザーは、管理の 4 つのオペレーションのどれも 403 です。ID、本文、クエリが不正でも 403 です
- サロンに属さない添付ファイルの共有リンクを扱えるのは `admin` だけです
- ほかのサロンの添付ファイルと共有リンクは、存在しないものと区別しません（404）
- 閲覧の 2 つのオペレーションは、`Authorization` ヘッダーを見ません。サインインしていても、していなくても、同じ応答です

### 共有リンクのプロパティ

| プロパティ | 意味 |
|---|---|
| `id` | 共有リンクの ID。トークンではありません |
| `attachmentId` | 見せる添付ファイル |
| `expiresAt` | 有効期限。この時刻から、トークンは使えません |
| `maxDownloads` | ダウンロード用 URL を発行する回数の上限。null は制限なし |
| `downloadCount` | ダウンロード用 URL を発行した回数 |
| `hasPassword` | パスワードで保護しているか |
| `createdBy` | 発行したユーザー |
| `createdAt`、`updatedAt` | 発行した日時、最後に更新した日時（ダウンロードの回数や、違うパスワードの回数が変わると進みます） |

- `hasPassword` 以外のプロパティの名前は、`share_links` の列と同じです。`hasPassword` は列ではなく、`passwordHash` があるかどうかです（`pnpm check:api-db` の規則では `computed`）
- **トークンのハッシュ（`tokenHash`）、パスワードのハッシュ（`passwordHash`）、違うパスワードの回数（`failedAttempts`）、ロックの期限（`lockedUntil`）は、レスポンスに出しません**

### 共有リンクの発行

`POST /api/v1/attachments/{attachmentId}/share-links` は、共有リンクを作り、201 と `Location`（共有リンクの URL）を返します。

```json
{
  "data": {
    "shareLink": {
      "id": "…",
      "attachmentId": "…",
      "expiresAt": "2026-11-25T09:00:00.000Z",
      "maxDownloads": 3,
      "downloadCount": 0,
      "hasPassword": true,
      "createdBy": "…",
      "createdAt": "…",
      "updatedAt": "…"
    },
    "token": "<43 文字>"
  },
  "meta": { "…": "…" },
  "links": {
    "self": "/api/v1/attachments/share-links/<id>",
    "list": "/api/v1/attachments/<attachmentId>/share-links",
    "attachment": "/api/v1/attachments/<attachmentId>"
  }
}
```

| 本文 | 規則 |
|---|---|
| `expiresAt` | 必須。UTC の日時（`Z` で終わる形）。発行の時刻よりあとで、30 日後（720 時間後）まで |
| `maxDownloads` | null（制限なし）か、1〜2,147,483,647 の整数。キーは必須です |
| `password` | null（保護なし）か、8〜128 文字。キーは必須です |

- **トークンは、このレスポンスにだけ出ます**。サーバーが作る 256 ビットの乱数（base64url で 43 文字。セッションのトークンと同じ `tokenIssuer`）で、データベースには SHA-256 のハッシュだけを保存します。データベースを読めても、使えるリンクは得られません。トークンをなくしたら、失効して、発行し直します
- レスポンスは `Cache-Control: no-store` です
- **有効期限は必須**です。顧客の写真や書類を、期限のないリンクで外に置かないためです。長く見せたいときは、発行し直します。30 日は 720 時間として数えます（1 日の長さは、タイムゾーンによって変わるため）
- 有効期限を確かめる時刻と、`createdAt` に入る時刻は、同じ（アプリケーションの時計）です。テーブルの CHECK 制約（作成の 720 時間後まで）と、判定がずれません
- **パスワードは、Argon2id のハッシュだけを保存します**（アカウントのパスワードと同じ `passwordHasher`）。NFC に正規化してから、文字数（コードポイント）を数え、ハッシュにします
- **推測しやすいパスワードは 400 です**（`password` の `blocklisted`）。数字やアルファベットの連番、キーボードの並び、同じ文字や同じ並びの繰り返し、`password` とその変形（`Passw0rd!`、`password123`）、よく知られたパスワードです（`business-logic/auth/_shared/password-blocklist.ts` の `commonChoiceIssue`。アカウントのパスワードと同じ一覧です）
- 下限が 8 文字で、アカウントのパスワード（15 文字）より短いのは、推測できないトークンの上に重ねるもので、試せる回数を共有リンクごとに制限しているためです（[パスワードとロック](#パスワードとロック)）
- 共有できるのは、アップロード済み（`uploaded`）の添付ファイルだけです。`pending` は 409 です
- 1 つの添付ファイルに、共有リンクをいくつでも発行できます。相手ごとに発行すると、相手ごとに失効できます
- 本文の余分なキーは 400 です。トークンを指定することはできません。閲覧者のメールアドレスで絞る `allowedEmails` は、コントラクトから除きました（[共有リンクにないもの](#共有リンクにないもの)）

**トークンを閲覧者に渡すのは、API の外**です。admin-app の発行の画面は、発行の応答のトークンを portal のアドレスにして一度だけ出し、コピーさせます（[共有リンクの発行と管理の画面](./frontend-api-integration.md#共有リンクの発行と管理の画面)）。共有リンクを開く画面は、portal の `/share#token=<トークン>` です（[共有リンクの画面](./frontend-api-integration.md#共有リンクの画面)）。トークンは、アドレスのフラグメント（`#` のあと）に入れます。フラグメントは、サーバーへのリクエストにも、`Referer` にも含まれません（RFC 9110 の 7.1、10.1.3）。パスやクエリに入れたトークンは、サーバーやプロキシーのログ、ブラウザーの履歴、`Referer` に残ります。

### 共有リンクの一覧、1 件の取得、失効

`GET /api/v1/attachments/{attachmentId}/share-links` は、その添付ファイルの共有リンクを返します。

- 順序は、発行の新しい順（`createdAt`）で、同じ日時なら ID の大きい順です
- **有効期限を過ぎたものと、ダウンロードの上限に達したものも返します**。何を、いつまで共有したかを、サロンが確かめられるようにするためです。失効したものは、行がないので返りません
- クエリは、`limit`（1〜100。既定は 20）と `cursor`（前のページの `meta.nextCursor`）です。ほかのキーは 400 です
- `cursor` は、そのページの最後の共有リンクの ID です。その添付ファイルの共有リンクの ID でなければ 400 です（`cursor` の `not_found`）
- `pending` の添付ファイルは、空の一覧です（発行できないため）。削除した添付ファイルは 404 です

`GET /api/v1/attachments/share-links/{shareLinkId}` は、1 件を返します。`links` は、発行と同じ 3 つです。

`DELETE /api/v1/attachments/share-links/{shareLinkId}` は、共有リンクを失効します（204）。

- **行を消します**。そのトークンは、次のリクエストから 404 です
- もう一度の失効と、失効した共有リンクの取得は 404 です
- 失効の前に発行したダウンロード用 URL は、その期限（最長 5 分）まで使えます。URL は、ストレージが署名だけで受け付けるためです

### 共有リンクでの閲覧

閲覧者は、トークン（と、保護されていればパスワード）を本文で送ります。

```
POST /api/v1/share/file
{ "token": "<トークン>", "password": null }

200
{ "data": { "filename": "施術前.png", "contentType": "image/png", "size": 204800 },
  "meta": { "…": "…" }, "links": null }
```

```
POST /api/v1/share/download-url
{ "token": "<トークン>", "password": null, "inline": false }

200
{ "data": { "downloadUrl": "https://<ストレージ>/…", "expiresAt": "…" },
  "meta": { "…": "…" }, "links": null }
```

- **トークンもパスワードも、URL に入れません**。URL に入れた値は、`Referer`、サーバーやプロキシーのログ、ブラウザーの履歴に残り、HTTPS でも防げません（OWASP）。このサーバーのリクエストログも、パスを書きます。そのため、2 つのオペレーションは `GET` ではなく、本文で受け取る `POST` です。メールで送るトークン（パスワードの再設定、スタッフの招待）と同じ形です
- 本文のキーは、どれも必須です（`password` は、保護されていなければ null。`inline` は true か false）。余分なキーは 400 です
- 応答は、成功もエラーも `Cache-Control: no-store` です
- ファイルの情報は、名前・種類・サイズだけです。添付ファイルの ID、サロン、アップロードした人は出しません
- **ダウンロード用 URL は、5 分か、共有リンクの有効期限の、早いほうまで有効**です。`inline` が true なら、ブラウザーの中で表示する URL、false なら、元のファイル名で保存する URL です（[ダウンロード用 URL の発行](#ダウンロード用-url-の発行)と同じ）
- **`downloadCount` は、ダウンロード用 URL を発行するたびに 1 増えます**。ストレージから実際に取得したかは、サーバーからは見えません。ファイルの情報を見るだけでは増えません
- 上限の確認と加算は、1 つの UPDATE です（`countDownload`）。同時に届いたリクエストでも、上限を超えて URL を発行しません。数えられなかったリクエストは 404 で、URL を返しません
- URL に署名してから、数えます。署名できなかった（ストレージのエラー）ときは、回数を使いません

#### 開けないトークン

次のどれも、**同じ 404**（`not-found`。`detail` は `Share link of the token was not found`）で、区別しません。

| 理由 |
|---|
| そのトークンの共有リンクがない（失効したものを含む） |
| 有効期限を過ぎた |
| ダウンロードの上限に達した |
| 添付ファイルが削除された |

- トークンは、応答にもログにも出しません
- 開けないトークンは、パスワードを見る前に 404 です。パスワードが違っていても、回数に数えません

#### パスワードとロック

パスワードで保護した共有リンクに、パスワードがない（null）か、違うパスワードを送ると、403 です。

```json
{
  "type": "urn:beauty-salon:problem:password-required",
  "title": "Password required",
  "status": 403,
  "detail": "Send the password of the share link; one that was sent was not accepted",
  "code": "1002",
  "errors": null,
  "instance": "/api/v1/share/file",
  "correlationId": "…",
  "timestamp": "…"
}
```

- **401 ではなく 403 です**。401 の応答は、そのリソースに使えるチャレンジを `WWW-Authenticate` で返さなければなりません（RFC 9110 の 15.5.2）。パスワードは本文で送るので、返せるチャレンジがありません。403 は、クライアントが別の認証情報でやり直してよい応答です（15.5.4）。`DomainError` の種類は `passwordRequired` です
- **違うパスワードが 5 回続くと、共有リンクを 15 分ロックします**（アカウントのサインインと同じ回数と時間。`LOCK_THRESHOLD`、`lockEnd`）。ロックのあいだは、正しいパスワードでも同じ 403 で、回数も数えません。ロックされていることは、応答からは分かりません
- パスワードを確かめる計算（Argon2id）は、ロックを見る前に行います。ロックされた共有リンクが、ほかより速く応答することはありません
- パスワードのないリクエスト（null）は、推測ではないので、回数に数えません
- 正しいパスワードで、回数は 0 に戻ります
- ロックが切れたあと、回数は 5 のままです。次の違うパスワードで、またロックします。正しいパスワードを送るまで、1 回ごとに 15 分です
- パスワードのない共有リンクは、パスワードが送られてきても見ません
- 回数は、共有リンクごとです。IP アドレスごとの制限は、API 全体のレート制限が別に掛かります

### 共有リンクの確認の順序

| 順 | 発行 | 一覧 | 1 件の取得、失効 | 閲覧（ファイルの情報、ダウンロード用 URL） |
|---|---|---|---|---|
| 1 | アクセストークン（401） | 同左 | 同左 | 本文（400） |
| 2 | 共有リンクを扱えるか（403） | 同左 | 同左 | トークンで開けるか（404） |
| 3 | 添付ファイルの ID（400） | 同左 | 共有リンクの ID（400） | パスワード（403） |
| 4 | 本文（400） | クエリ（400） | 共有リンクの存在（404） | ダウンロード用 URL: 回数を数えられるか（404） |
| 5 | 添付ファイルの存在（404） | 添付ファイルの存在（404） | | |
| 6 | 状態（409。`pending`） | カーソルがその添付ファイルのものか（400） | | |

### 添付ファイルの削除と共有リンク

- **添付ファイルを削除すると、その共有リンクは、すぐに使えなくなります**。閲覧のたびに、添付ファイルが削除されていないことを確かめます。管理のオペレーションからも見えません（404）
- 共有リンクの行は、添付ファイルの行が[掃除](#掃除)で消えるときに、一緒に消えます
- 有効期限を過ぎた共有リンクの行は、失効するか、添付ファイルが掃除されるまで残ります。期限切れの行だけを消す仕組みはありません

### 共有リンクにないもの

- **閲覧者のメールアドレスでの制限（`allowedEmails`）**: アカウントを持たない人のメールアドレスを確かめるには、そのアドレスにコードを送って入力させる流れが要ります。確かめられない制限を置くと、守られていると誤解させるので、コントラクトから除きました。見せる相手を絞るときは、パスワードを使い、トークンとは別の経路で伝えます
- 共有リンクが使われたことの通知
- 共有リンクの変更（期限の延長、パスワードの変更）。失効して、発行し直します

## ストレージ

ドメインは、保存先をインターフェース（`IFileStorage`。`backend/packages/domain/src/services/file-storage.ts`）としてだけ知っています。実装は `S3FileStorage`（`backend/packages/infrastructure/src/storage/s3-file-storage.ts`）で、AWS の公式 SDK（`@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`）を使います。

| メソッド | すること | ストレージへの接続 |
|---|---|---|
| `issueUpload` | 1 つのキーへの `PUT` に署名する（種類、サイズ、`If-None-Match: *`） | しない |
| `inspect` | ファイルのサイズと、先頭の数バイトを読む（範囲を指定した `GET`）。なければ null | する |
| `issueDownload` | 1 つのキーの `GET` に署名する（返す種類と `Content-Disposition`） | しない |
| `remove` | ファイルを消す。なくても成功 | する |

- どの S3 互換のストレージを使うかは、設定の接続先で決まります。コードは、特定の製品に依存しません
- バケットは、パスに入れます（`forcePathStyle`）。1 つのホスト名で届くストレージに使えるようにするためです
- **SDK の既定のチェックサムは、使いません**（`requestChecksumCalculation: 'WHEN_REQUIRED'`）。AWS SDK for JavaScript v3 は、3.729.0 から、アップロードに CRC32 のチェックサムを付けます。URL に署名する時点では本文がないので、空の本文のチェックサムが URL に入り、ストレージがアップロードを拒否します
- 接続は 5 秒、リクエストは 15 秒で打ち切り、1 回だけやり直します。ストレージが遅くても、リクエストを何分も待たせません
- **サーバーは、起動のときにストレージへ接続しません**。ストレージが止まっていても、API は起動し、添付ファイル以外のルートは動きます。添付ファイルのルートのうち、ストレージに接続するもの（アップロード待ちの添付ファイルの完了、削除、消すファイルのある掃除）が 500 になります

### ストレージのエラー

ストレージの呼び出しが失敗すると、`DomainError` の `storage` になり、応答は 500 です。

```json
{
  "type": "urn:beauty-salon:problem:storage",
  "title": "Internal server error",
  "status": 500,
  "detail": null,
  "code": "4004",
  "errors": null,
  "instance": "/api/v1/attachments/<id>/complete",
  "correlationId": "…",
  "timestamp": "…"
}
```

- 原因は、応答に出さず、ログに出します（`msg` は `Failed to read the stored file` など。`cause` は、エラーの名前、メッセージ、HTTP のステータスです）
- **URL は、ログに出しません**。URL は署名を含み、それを知っている人は、期限までファイルを読み書きできます
- バケットがないときは、「ファイルがない」ではなく、ストレージのエラーです。設定の誤りを、アップロード待ちと取り違えないためです

### 設定

サーバーは、6 つの環境変数でストレージに接続します（[環境変数ガイド](./env-configuration.md#サーバーが読む-28-個の変数)）。

| 変数 | 意味 |
|---|---|
| `STORAGE_ENDPOINT` | サーバーから見たストレージのオリジン |
| `STORAGE_PUBLIC_ENDPOINT` | ブラウザーから見たストレージのオリジン。署名付き URL は、これを指します |
| `STORAGE_REGION` | リージョン。署名に使います |
| `STORAGE_BUCKET` | バケットの名前 |
| `STORAGE_ACCESS_KEY_ID`、`STORAGE_SECRET_ACCESS_KEY` | 認証情報 |

- 2 つのエンドポイントは、ふつう同じ値です。違うのは、サーバーが、内部のネットワークの名前でストレージに届くときです（Docker Compose の `backend` サービスは `http://storage:8333`、ブラウザーは `http://localhost:8333`）
- `staging` と `production` では、どちらのエンドポイントも `https://` でなければ、サーバーは起動しません。ファイルは顧客のもので、URL は署名を含むためです
- バケットは、サーバーが作りません。先に作っておきます
- ブラウザーからアップロードするには、バケットの CORS が、フロントエンドのオリジンからの `PUT` と、ヘッダー `Content-Type`・`If-None-Match` を許可している必要があります。portal の共有リンクの画面は、ファイルをストレージから `GET` で読むので、portal のオリジンからの `GET` も許可します。本番のバケットでの設定は、本番環境の準備の範囲です

### ローカル開発（SeaweedFS）

`make infra-up` が、PostgreSQL、Mailpit と一緒に、SeaweedFS（`chrislusf/seaweedfs:4.54`。Apache-2.0）を起動します。Docker Compose の `storage` サービスです。

- S3 の API は <http://localhost:8333> です。`127.0.0.1` にだけ公開します
- バケット（既定は `beauty-salon-dev`）は、起動のときに作られます。ファイルは、ボリューム `storage_data` に残ります
- `.env.localhost`、`.env.development`、`.env.test`、`.env.example` の `STORAGE_*` は、この SeaweedFS を指しています
- ブラウザーのプリフライト（`OPTIONS`）と `GET` には、既定の設定で、どのオリジンにも許可を返します

MinIO は使いません。MinIO は、2026 年 4 月にリポジトリがアーカイブされ、Docker イメージの配布も終わっています。

## 同時に届いたリクエスト

| 組み合わせ | 結果 |
|---|---|
| 同じ添付ファイルの完了が 2 つ | どちらも 200。`uploaded` にするのは一方で、もう一方は、その結果を返します |
| 申告と違うファイルの完了と、正しいファイルを見た完了 | 一方が添付ファイルを削除済みにすると、もう一方は `uploaded` にできず、404 です |
| 完了と削除 | 削除が先なら、完了は 404。完了が先なら、削除は 204 で、添付ファイルは削除済みになります |
| 同じ添付ファイルの削除が 2 つ | 一方が 204、もう一方は 404 です |
| 掃除と完了 | 掃除が行をロックしているあいだ、完了は待ち、行が消えたあとに 404 を返します。完了が先なら、掃除はその行を消しません |
| 掃除が 2 つ | 同じ行を消すのは一方だけです。件数は、それぞれが消した数です |
| 上限まであと 1 回の共有リンクに、ダウンロード用 URL の発行が 2 つ | 一方が 200、もう一方は 404 です。`downloadCount` は上限を超えません |
| 同じ共有リンクに、違うパスワードが同時に 5 つ | 5 つとも数え、共有リンクをロックします |
| 共有リンクの失効と、そのトークンでの閲覧 | 失効が先なら、閲覧は 404 です |

- 完了と削除は、行をロックしたまま、ストレージを呼びません。`uploaded` にする更新と、削除済みにする更新は、どちらも「`pending` で、削除していない」「削除していない」を条件にした 1 つの文なので、あとから届いたほうは、行が変わっていることに気づきます（`markUploaded`、`markDeleted`）
- 掃除だけは、行をロックしたまま、ストレージのファイルを消します。消すと決めた行が、そのあいだに完了されないようにするためです
- 完了と削除の時刻（`uploadedAt`、`deletedAt`、`updatedAt`）は、文が行に届いた時点のデータベースの時計（`clock_timestamp()`）で入れます。ロックを待ったあとの時刻です。掃除の条件も、同じ時計で確かめます
- 共有リンクの回数（`downloadCount`、`failedAttempts`）は、読んだ値に足すのではなく、行の値に足す 1 つの文で更新します（`countDownload`、`recordWrongPassword`）。同時のリクエストが、互いの加算を消しません
- 共有リンクが使えるか（有効期限、ロック）は、アプリケーションの時計で確かめます。有効期限を決めた時計と同じです

## DB の制約

`attachments`（マイグレーション `202611182100_attachments.sql`）:

| 制約 | 内容 |
|---|---|
| `attachment_content_type`（列挙型） | `image/jpeg`、`image/png`、`image/webp`、`application/pdf` |
| `attachment_status`（列挙型） | `pending`、`uploaded` |
| `attachments_salon_id_fk` | `salonId` は `salons` の行。null はサロンに属さないファイル |
| `attachments_uploaded_by_fk` | `uploadedBy` は `users` の行 |
| `attachments_filename_not_empty` | ファイル名は 1 文字以上（上限は `varchar(255)`） |
| `attachments_size_within_limit` | サイズは 1〜10,485,760 |
| `attachments_uploaded_when_uploaded` | `uploadedAt` があるのは、`uploaded` のときだけ |
| `attachments_upload_expires_after_created` | URL の有効期限は、作成の日時よりあと |

| インデックス | 用途 |
|---|---|
| `idx_attachments_salon_uploaded`（`salonId`, `uploadedAt`, `id`。`uploaded` で削除していない行） | サロンの一覧 |
| `idx_attachments_uploaded`（`uploadedAt`, `id`。同上） | すべてのサロンの一覧 |
| `idx_attachments_purge`（`uploadExpiresAt`。`pending` か、削除した行） | 掃除の対象 |

- 外部キーに `ON DELETE` はありません。添付ファイルのあるサロンと、添付ファイルをアップロードしたユーザーの行は、消せません（サロンとユーザーの削除は、どちらも行を残す削除です）
- シードに、添付ファイルはありません。ファイルの中身がストレージにないと、ダウンロードできない行になるためです

`share_links`（マイグレーション `202611182200_share_links.sql`）:

| 制約 | 内容 |
|---|---|
| `share_links_attachment_id_fk` | `attachmentId` は `attachments` の行。**`ON DELETE CASCADE`**: 添付ファイルの行を消すと、共有リンクの行も消えます |
| `share_links_created_by_fk` | `createdBy` は `users` の行 |
| `share_links_token_hash_unique` | `tokenHash` は一意。トークンから共有リンクを引くインデックスでもあります |
| `share_links_expires_within_limit` | `expiresAt` は、`createdAt` よりあとで、その 720 時間後まで |
| `share_links_max_downloads_positive` | `maxDownloads` は null か 1 以上 |
| `share_links_download_count_within_limit` | `downloadCount` は 0 以上で、`maxDownloads` があればそれ以下 |
| `share_links_failed_attempts_not_negative` | `failedAttempts` は 0 以上 |

| インデックス | 用途 |
|---|---|
| `idx_share_links_attachment_created`（`attachmentId`, `createdAt`, `id`） | 添付ファイルの共有リンクの一覧 |

- トークンとパスワードは、どの列にもありません。あるのはハッシュ（`tokenHash`、`passwordHash`）だけです
- シードに、共有リンクはありません（添付ファイルがないため）

## 顧客のデータの消去との関係

添付ファイルは、顧客に紐づきません。そのため、[顧客のデータの消去](./customers.md#削除の依頼)の対象ではありません。顧客の写真や書類を添付ファイルとして置いたときは、サロンが削除します。

## テスト

| テスト | 確かめること |
|---|---|
| `backend/packages/domain/src/business-logic/attachment/__tests__/attachment.rules.test.ts` | ファイルの規則、形式の判定、`Content-Disposition`、権限 |
| `backend/packages/domain/src/schemas/__tests__/attachment.schema.test.ts` | 3 つのリクエスト（アップロードの URL、一覧、ダウンロードの URL）のスキーマ |
| `backend/packages/domain/src/mappers/__tests__/attachment.mapper.test.ts` | Write マッパー（保留の行、一覧の条件、ブラウザーで表示するか）と、Read マッパーの添付の答え、一覧のページ、アップロードとダウンロードの URL の答え、掃除の件数 |
| `backend/packages/domain/src/business-logic/attachment/__tests__/attachment.usecase.test.ts` | 7 つのユースケース（確認の順序、呼び出しの順序、失敗の伝え方） |
| `backend/packages/api/src/__tests__/attachment.integration.test.ts` | ルートとデータベース。ストレージは、メモリーの中の代役（`InMemoryFileStorage`）です |
| `backend/packages/infrastructure/src/storage/__tests__/s3-file-storage.integration.test.ts` | `S3FileStorage` と、本物の S3 互換のストレージ。署名付き URL で実際に送り、取得します |
| `backend/apps/server/src/__tests__/server.integration.test.ts` | 設定からストレージまでの配線。URL が設定のエンドポイントとバケットを指すこと、ストレージに届かないときの 500 とログ |
| `backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` | マイグレーションと制約（`attachments`、`share_links`） |
| `backend/packages/domain/src/business-logic/share-link/__tests__/share-link.usecase.test.ts` | 共有リンクの 6 つのユースケース（確認の順序、有効期限の境界、パスワードの規則、ロック、署名してから数えること） |
| `backend/packages/domain/src/mappers/__tests__/share-link.mapper.test.ts` | 共有リンクの Write マッパー（作成の内容、一覧の条件、閲覧者が示すもの）と、Read マッパーの一覧のページ、作成の答え |
| `backend/packages/domain/src/business-logic/auth/__tests__/password-blocklist.test.ts` | 推測しやすいパスワードの判定 |
| `backend/packages/api/src/__tests__/share-link.integration.test.ts` | 共有リンクのルートとデータベース。同時のダウンロードと違うパスワード、開けないトークンの応答が同じであること、ログにトークンとパスワードが出ないこと、添付ファイルの削除と掃除 |

フロントエンドのテスト（admin-app の `src/attachments/` の画面のテストと、ブラウザーのテスト）は、バックエンドのテストサーバーが testcontainers で起動する SeaweedFS に、ブラウザーと同じ署名付き URL でファイルを送り、取得します（[The Test Server](./api-testing-guide.md#the-test-server)）。

ストレージのテストは、testcontainers で SeaweedFS を起動します。**ほかの S3 互換のストレージで確かめるとき**は、5 つの環境変数で接続先を指定します。テストは、ランダムな接頭辞の下にだけファイルを置き、終わったら消します。

```bash
cd backend/packages/infrastructure
TEST_STORAGE_ENDPOINT=https://<ストレージ> \
TEST_STORAGE_REGION=<リージョン> \
TEST_STORAGE_BUCKET=<バケット> \
TEST_STORAGE_ACCESS_KEY_ID=<キー ID> \
TEST_STORAGE_SECRET_ACCESS_KEY=<シークレット> \
pnpm exec vitest run --config vitest.integration.config.ts src/storage
```

本番のストレージを決めたら、このテストをそのストレージに対して実行し、署名付き URL の動き（種類とサイズの違いを拒否すること、`If-None-Match` で 2 回目を拒否すること）が同じであることを確かめてください。ストレージによって違いうるところです。

## 実装の場所

| 層 | 場所 |
|---|---|
| コントラクト | `specs/models/attachment.tsp`、`specs/operations/attachment-operations.tsp` |
| DB | `backend/packages/database/sql/migrations/202611182100_attachments.sql`、`202611182200_share_links.sql`、`src/schema.ts` の `attachments`・`shareLinks` |
| API と DB の整合 | `backend/packages/database/src/scripts/api-consistency-rules.ts` の `attachmentRules`、`shareLinkRules` |
| モデル、スキーマ、マッパー | `backend/packages/domain/src/models/attachment.ts`、`schemas/attachment.schema.ts`、`mappers/write/attachment.mapper.ts`、`mappers/read/attachment.mapper.ts`。共有リンクは `models/share-link.ts`、`schemas/share-link.schema.ts`、`mappers/write/share-link.mapper.ts`、`mappers/read/share-link.mapper.ts` |
| 規則と権限 | `backend/packages/domain/src/business-logic/attachment/_shared/`（`file-rules.ts`、`authorization.ts`）。共有リンクは `business-logic/share-link/_shared/`（`authorization.ts`、`link-rules.ts`、`password-check.ts`、`open-shared-file.ts`） |
| ユースケース | `backend/packages/domain/src/business-logic/attachment/`、`business-logic/share-link/` |
| ストレージのインターフェース | `backend/packages/domain/src/services/file-storage.ts` |
| リポジトリ | `backend/packages/domain/src/repositories/attachment.repository.ts`、`backend/packages/infrastructure/src/repositories/attachment.repository.impl.ts`。共有リンクは `share-link.repository.ts`、`share-link.repository.impl.ts` |
| ストレージの実装 | `backend/packages/infrastructure/src/storage/s3-file-storage.ts` |
| ルート | `backend/packages/api/src/routes/attachment/`、`routes/share-link/`（管理。`/attachments` に、添付ファイルのルートより先にマウント）、`routes/shared-file/`（閲覧。`/share`） |
| 配線 | `backend/apps/server/src/server.ts`（`S3FileStorage` を作り、`createApp` に渡す） |

## 根拠

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): 拡張子の許可リスト、`Content-Type` を信用しない、ファイルの署名の確認、サーバーが決めるファイル名、サイズの上限、別のホストへの保存
- [Data Integrity Protections for Amazon S3（AWS SDKs and Tools）](https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html): SDK の既定のチェックサムと `WHEN_REQUIRED`
- [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266)、[RFC 8187](https://www.rfc-editor.org/rfc/rfc8187): `Content-Disposition` のファイル名
- [SeaweedFS](https://github.com/seaweedfs/seaweedfs)（Apache-2.0）
- [OWASP: Information exposure through query strings in URL](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url): URL のクエリに入れた値は、`Referer`、Web のログ、ブラウザーの履歴に残り、HTTPS では防げない
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): 識別子は CSPRNG で作り、64 ビット以上のエントロピーを持たせる
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): URL で渡すトークンは、暗号論的に安全な乱数で作り、期限を持たせ、安全な方法で保存する
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): Argon2id
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): 失敗の応答は、何が違ったか、ロックされているかを区別しない
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110): 7.1（リクエストの対象の URI は、フラグメントを含まない）、10.1.3（`Referer` に、フラグメントを含めてはならない）、15.5.2（401 は、`WWW-Authenticate` でチャレンジを返さなければならない）、15.5.4（403 のあと、クライアントは別の認証情報でやり直してよい）
