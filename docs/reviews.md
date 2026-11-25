# レビュー

顧客が来店のあとで書くレビューと、サロンとスタッフごとの集計の規則をまとめます。コントラクトは `specs/operations/review-operations.tsp` の `ReviewCrud`、`ReviewReportCrud`、`SalonReviewSummary`、`StaffReviewSummary` と `specs/models/review.tsp`、テーブルは `reviews`、`review_helpful_votes`（誰がレビューを参考になったと評価したか）、`review_reports`（誰がレビューを通報したか）と、`salons` の `rating` と `reviewCount` です。

レビューは、1 回の来店（1 件の予約）について、その予約の顧客が書きます。ポータルでサロンを選ぶ人は、ログインせずにレビューと集計を読みます。

予約の規則は [予約台帳](./bookings.md)、顧客の規則は [顧客台帳](./customers.md)、スタッフの規則は [スタッフ台帳](./staff.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 一覧（`ReviewCrud.list`）、投稿（`create`）、1 件の取得（`get`）、修正（`update`）、削除（`delete`）、参考になった（`markHelpful`）、通報（`report`）、サロンからの返信（`respond`）、サロンの集計（`SalonReviewSummary.getSummary`）、スタッフの集計（`StaffReviewSummary.getStaffSummary`） | 実装済み |
| 通報の一覧（`ReviewReportCrud.list`）、却下（`dismiss`） | 実装済み |

コントラクトにあるレビューのオペレーションは、すべて実装済みです。

- 次のものは、ありません
  - 返信の履歴と、返信をレビューを書いた顧客に知らせること。返信への返信（やり取り）
  - 投稿と修正の期限。来店から何日たっても、書いて、直せます
  - 修正の履歴。修正すると、前の内容は残りません
  - `admin` による修正と、削除したレビューの復元
  - 参考になったの取り消しと、自分が評価したかどうか、誰が評価したかを返すこと
  - 不適切な表現の検出と、通報によってレビューを隠すこと。通報されても、レビューは、`admin` が削除するまで読めます
  - 通報の取り下げと、通報したアカウントが自分の通報を読むこと。通報を、レビューを書いた顧客やサロンに知らせること
  - 通報を「対応済み」にすること。規則に反するレビューは `admin` が削除し、その通報も一緒に消えます
  - 画像のアップロード。`imageUrls` は、どこかに置いた画像の URL を受け取るだけです
  - スタッフの成績を集計して保存すること

## オペレーションと権限

| オペレーション | ルート | 使える人 |
|---|---|---|
| 一覧 | `GET /api/v1/reviews` | 誰でも（ログインは要らない） |
| 1 件の取得 | `GET /api/v1/reviews/{id}` | 同上 |
| サロンの集計 | `GET /api/v1/salons/{salonId}/reviews/summary` | 同上 |
| スタッフの集計 | `GET /api/v1/staff/{staffId}/reviews/summary` | 同上 |
| 投稿 | `POST /api/v1/reviews` | 予約の顧客本人だけ（ロール `customer` で、顧客のプロフィールがあるアカウント） |
| 修正 | `PATCH /api/v1/reviews/{id}` | レビューを書いた顧客本人だけ |
| 削除 | `DELETE /api/v1/reviews/{id}` | レビューを書いた顧客本人と `admin` |
| 参考になった | `POST /api/v1/reviews/{id}/helpful` | 顧客だけ（ロール `customer` で、顧客のプロフィールがあるアカウント）。自分のレビューは不可 |
| 通報 | `POST /api/v1/reviews/{id}/report` | 顧客（同上。自分のレビューは不可）と、レビューのサロンの `owner`・`manager` |
| サロンからの返信 | `POST /api/v1/reviews/{id}/respond` | レビューのサロンの `owner`・`manager`。`admin` は取り下げ（`ownerResponse` が null）だけ |
| 通報の一覧 | `GET /api/v1/review-reports` | `admin` だけ |
| 通報の却下 | `POST /api/v1/review-reports/{id}/dismiss` | `admin` だけ |

- 読む 4 つのオペレーションは、アクセストークンを見ません。期限の切れたトークンや、セッションのないトークンを付けても、200 です。サロン、サービス、スタッフのプロフィールと同じく、サロンを選ぶ人が読むものだからです
- **投稿できるのは顧客本人だけです**。`admin` と、サロンの `owner`・`manager`・`staff` は 403 です。レビューは顧客の声なので、ほかの人が代わりに書きません。誰が投稿できるかは、`business-logic/review/_shared/authorization.ts` の `reviewerOf` が決めます
- 顧客のプロフィールのないアカウントと、紐づいた顧客が削除されたアカウントも 403 です
- 本文の `customerId` が自分の顧客 ID でなければ 403 です。ほかの顧客として書けません
- **修正できるのは、書いた顧客本人だけです**。`admin` とサロンのメンバーも 403 です。投稿と同じく、ほかの人が顧客の声を書き換えません
- **削除できるのは、書いた顧客本人と `admin` です**。`admin` は、規約に反するレビューや、本人から求められたレビューを消します。どのサロンのレビューも、書いた顧客が削除されていても消せます。サロンの `owner`・`manager`・`staff` は 403 です。サロンが、自分に不利なレビューを消せないようにします。誰が削除できるかは、`_shared/authorization.ts` の `reviewRemoverOf` が決めます
- ほかの顧客のレビューの修正と削除は 403 です。レビューは誰でも読めるので、存在を隠す（404 にする）理由はありません。修正と削除でも、プロフィールのない顧客のアカウントと、紐づいた顧客が削除されたアカウントは 403 です
- **参考になったと評価できるのは、顧客だけです**。`admin` と、サロンの `owner`・`manager`・`staff` は 403 です。一覧の「参考になった順」を顧客の評価だけで決め、サロンが自分のレビューを押し上げられないようにします。プロフィールのない顧客のアカウントと、紐づいた顧客が削除されたアカウントも 403 です。**自分のレビューは 403 です**。誰が評価できるかは、投稿と同じ `reviewerOf` が決めます
- **通報できるのは、顧客と、レビューのサロンの `owner`・`manager` です**。顧客は、どのサロンのレビューも通報できますが、自分のレビューは 403 です（自分で修正、削除できるからです）。サロンは、レビューを削除できないので、事実と違うレビューなどを `admin` に知らせる手段として、自分のサロンのレビューを、誰が書いたものでも通報できます。ほかのサロンのレビューは 403 です。`admin` は通報を扱う側で、レビューを自分で削除できるので 403、サロンの `staff` は、サロンを代表する `owner`・`manager` に任せるので 403 です。プロフィールのない顧客のアカウント、紐づいた顧客が削除されたアカウント、サロンに届かないアカウント（スタッフ情報が削除されたアカウントなど）も 403 です。誰が通報できるかは、`_shared/authorization.ts` の `reviewReporterOf` が決めます
- **返信を書けるのは、レビューのサロンの `owner`・`manager` です**。返信はサロンの公式の発言なので、`staff` は、通報と同じく、サロンを代表する `owner`・`manager` に任せるので 403 です。ほかのサロンのレビューは 403 です。`admin` は、規約に反する返信を、レビューごと消さずに取り下げるため、`ownerResponse` に null を指定することだけができ、文字列を指定すると 403 です（運営は、サロンの代わりに返信を書きません）。顧客（レビューを書いた顧客を含む）、プロフィールのない顧客のアカウント、サロンに届かないアカウントも 403 です。誰が返信できるかは、`_shared/authorization.ts` の `reviewResponderOf` と、`_shared/response.ts` の `mayRespondWith` が決めます
- **通報の一覧と却下は、`admin` だけです**。ほかのアカウントは、クエリや ID が不正でも 403 です。誰が扱えるかは、`business-logic/review-report/_shared/authorization.ts` の `mayHandleReviewReports` が決めます
- レスポンスの `customerId` と `bookingId` は内部の ID で、これだけで人を特定することはできません。顧客台帳と予約台帳は、`admin` とサロンのメンバーしか読めません

### 投稿の確認の順序

1. アクセストークン（401）
2. 操作者が、顧客のプロフィールを持つ顧客であること（403）
3. リクエストの形式（400。`detail` は `Invalid review`）
4. 本文の `customerId` が、操作者の顧客 ID であること（403）
5. 操作者の顧客が削除されていないこと（403）
6. 予約が、その顧客のものであること（400。`bookingId` の `not_found`、`message` は `Must name a booking of the customer`）。存在しない予約も同じです
7. サロンが予約のサロンで、削除されていないこと（400。`salonId` の `not_found`、`message` は `Must name the salon of the booking`）と、スタッフが予約を担当した、削除されていないスタッフであること（400。`staffId` の `not_found`、`message` は `Must name a staff member who took the booking`）。両方に誤りがあれば、両方を返します
8. 予約のステータスが `completed` であること（409）
9. その予約に、まだレビューがないこと（409）

本文を JSON として読めなければ、トークンを見る前に 400（`code` は `2002`）を、JSON でない本文には 415 を返します。すべてのルートと同じです。

409 の `code` は `3003`（`operation-not-allowed`）で、`detail` は次のとおりです。

| 理由 | `detail` |
|---|---|
| 予約が `completed` でない | `The booking is not completed; a booking is reviewed once the visit took place` |
| 予約にレビューがある | `The booking has a review already; a booking is reviewed once` |

### 修正の確認の順序

1. アクセストークン（401）
2. 操作者が、顧客のプロフィールを持つ顧客であること（403）
3. パスの ID（400。`detail` は `Invalid review ID`、`id` の `invalid_format`）
4. リクエストの形式（400。`detail` は `Invalid review update`）
5. 操作者の顧客が削除されていないこと（403）
6. レビューの存在（404。`detail` は `Review <id> was not found`）。削除したサロンのレビューも 404 です
7. レビューが、操作者の書いたものであること（403）
8. レビューの `staffId` が null なら、`staffRating` が null か、指定されていないこと（400）

### 削除の確認の順序

1. アクセストークン（401）
2. 操作者が、`admin` か、顧客のプロフィールを持つ顧客であること（403）
3. パスの ID（400。`detail` は `Invalid review ID`、`id` の `invalid_format`）
4. 顧客なら、操作者の顧客が削除されていないこと（403）
5. レビューの存在（404。`detail` は `Review <id> was not found`）。削除したサロンのレビューと、削除したあとのレビューも 404 です
6. 顧客なら、レビューが、操作者の書いたものであること（403）

### 参考になったの確認の順序

1. アクセストークン（401）
2. 操作者が、顧客のプロフィールを持つ顧客であること（403）
3. パスの ID（400。`detail` は `Invalid review ID`、`id` の `invalid_format`）
4. 操作者の顧客が削除されていないこと（403）
5. レビューの存在（404。`detail` は `Review <id> was not found`）。削除したサロンのレビューと、削除したあとのレビューも 404 です
6. レビューが、操作者の書いたものでないこと（403）

本文を読めない修正の扱い（400、415）は、投稿と同じです。参考になったは本文の中身を読みませんが、JSON として読めない本文と JSON でない本文は、すべてのルートと同じく 400 と 415 です。

### 通報の確認の順序

1. アクセストークン（401）
2. 操作者が、顧客のプロフィールを持つ顧客か、サロンの `owner`・`manager` であること（403）
3. パスの ID（400。`detail` は `Invalid review ID`、`id` の `invalid_format`）
4. リクエストの形式（400。`detail` は `Invalid review report`）
5. 顧客なら、操作者の顧客が削除されていないこと（403）
6. レビューの存在（404。`detail` は `Review <id> was not found`）。削除したサロンのレビューと、削除したあとのレビューも 404 です
7. 顧客なら、レビューが操作者の書いたものでないこと、サロンなら、レビューが操作者のサロンのものであること（403）
8. 操作者のアカウントが、そのレビューをまだ通報していないこと（409）

### 返信の確認の順序

1. アクセストークン（401）
2. 操作者が、サロンの `owner`・`manager` か、`admin` であること（403）
3. パスの ID（400。`detail` は `Invalid review ID`、`id` の `invalid_format`）
4. リクエストの形式（400。`detail` は `Invalid review response`）
5. `admin` なら、`ownerResponse` が null であること（403）
6. レビューの存在（404。`detail` は `Review <id> was not found`）。削除したサロンのレビューと、削除したあとのレビューも 404 です
7. サロンなら、レビューが操作者のサロンのものであること（403）

本文を読めない返信の扱い（400、415）は、投稿と同じです。

### 通報の一覧の確認の順序

1. アクセストークン（401）
2. 操作者が `admin` であること（403）。読めないクエリでも、先に 403 です
3. クエリの形式（400。`detail` は `Invalid review report search`）
4. カーソル（400。`cursor` の `not_found`、`message` は `Must name a review report that is listed`）

### 却下の確認の順序

1. アクセストークン（401）
2. 操作者が `admin` であること（403）
3. パスの ID（400。`detail` は `Invalid review report ID`、`id` の `invalid_format`）
4. 通報の存在（404。`detail` は `ReviewReport <id> was not found`）。削除したレビューと、削除したサロンのレビューへの通報も 404 です
5. 通報が `pending` であること（409）

### 一覧の確認の順序

1. クエリの形式（400。`detail` は `Invalid review search`）
2. カーソル（400。`cursor` の `not_found`、`message` は `Must name a review that is listed`）

### 1 件の取得の確認の順序

1. パスの ID（400。`detail` は `Invalid review ID`、`id` の `invalid_format`）
2. レビューの存在（404。`detail` は `Review <id> was not found`）。削除したサロンのレビューも 404 です

### 集計の確認の順序

1. パスの ID（400。サロンは `Invalid salon ID` と `salonId` の `invalid_format`、スタッフは `Invalid staff ID` と `staffId` の `invalid_format`）
2. サロンかスタッフの存在（404。`Salon <id> was not found`、`Staff member <id> was not found`）。削除したサロン、削除したスタッフ、削除したサロンのスタッフも 404 です

## 投稿の規則

すべてのキーが必須です。null を指定できるのは、DB で NULL を許すカラムだけです。

| プロパティ | 規則 |
|---|---|
| `salonId` | UUID。予約のサロン |
| `customerId` | UUID。自分の顧客 ID |
| `bookingId` | UUID。自分の予約で、ステータスが `completed` のもの |
| `staffId` | UUID か null。予約を担当したスタッフ |
| `overallRating` | 1〜5 の整数 |
| `serviceRating`、`staffRating`、`atmosphereRating`、`cleanlinessRating`、`valueRating` | 1〜5 の整数か null |
| `title` | 255 文字までの文字列か null。空白だけの文字列は不可 |
| `comment` | 文字列か null。空白だけの文字列は不可。長さの上限はない（`text` のカラム） |
| `imageUrls` | `http` か `https` の、500 文字までの URL の配列。10 個まで。同じ URL を 2 回書くと 400（2 回目の位置の `custom`、`message` は `Must not repeat an earlier entry`）。画像がなければ空の配列で、null は不可 |

- **来店した予約だけをレビューできます**。予約のステータスが `completed` でなければ 409 です。そのため、API で投稿したレビューの `isVerified` は、いつも true です。`isVerified` は本文に書けません（`unrecognized_keys`）
- **1 つの予約へのレビューは 1 件です**。2 件目は 409 です
- `staffId` に書けるのは、予約の担当スタッフか、予約の施術明細のスタッフで、削除されていない人です。サロンのほかのスタッフは 400 です。来店で担当していないスタッフの評価が、スタッフの集計に入らないようにします
- `staffId` が null なら、`staffRating` も null です（400。`staffRating` の `custom`、`message` は `Must be null when staffId is null`）。評価するスタッフがいないからです
- `salonId` は、予約のサロンでなければ 400 です。サロンが削除されていたら、その予約のレビューは書けません（400）
- コントラクトにないキーは 400 です（`unrecognized_keys`）。`helpfulCount`、`reportCount`、`ownerResponse` などは書けません
- ID は大文字で書いても、小文字で保存します
- 成功は 201 で、書いたレビューを返します。`Location` と `links.self` はレビューのパス、`links.list` は一覧のパスです

## 修正の規則

書けるのは、次の 9 つのプロパティです。どれも省略でき、指定したものだけを変えます。値の規則は投稿と同じです。

| プロパティ | 規則 |
|---|---|
| `overallRating` | 1〜5 の整数。null は不可 |
| `serviceRating`、`staffRating`、`atmosphereRating`、`cleanlinessRating`、`valueRating` | 1〜5 の整数か null。null で消す |
| `title` | 255 文字までの文字列か null。空白だけの文字列は不可 |
| `comment` | 文字列か null。空白だけの文字列は不可 |
| `imageUrls` | 投稿と同じ配列。指定すれば全体を置き換え、空の配列で、画像をすべて外す。null は不可 |

- 空の本文 `{}` は 400 です（`custom`、`message` は `At least one property must be specified`）
- サロン、顧客、予約、スタッフ、`isVerified`、`helpfulCount`、`reportCount`、`ownerResponse` は書けません（400、`unrecognized_keys`）。どの来店のレビューかと、来店を確かめたかは、投稿したときに決まります
- **`staffId` が null のレビューには、null 以外の `staffRating` を書けません**（400。`staffRating` の `custom`、`message` は `Must be null when the review names no staff member`）。投稿と同じ規則を、保存されたレビューの `staffId` で確かめます。スタッフが削除されていても、`staffId` が残っていれば書けます
- サロンからの返信（`ownerResponse`）は、修正しても、そのまま残ります
- `updatedAt` は、書いた時点の時刻（`clock_timestamp()`）です。`createdAt` は変わりません
- 成功は 200 で、修正したあとのレビューを返します。`links` は取得と同じです

## 削除の規則

- **削除は物理削除です**（`reviews` に `deletedAt` はありません）。削除したレビューは、一覧、取得、集計から消え、もう一度の削除と修正は 404 です
- **削除したあと、その予約は削除できます**。レビューの参照がなくなるからです。顧客は、同じ予約に、もう一度レビューを投稿できます（予約へのレビューは 1 件の規則は変わりません）
- 成功は 204 で、本文はありません

## 参考になったの規則

- **1 人の顧客が 1 つのレビューを評価するのは、1 回です**。同じ顧客の 2 回目は、数を変えずに 200 で、今の数を返します。二重送信で数がずれず、画面は何度押しても同じ結果を受け取ります。取り消しはありません（コントラクトにありません）
- **`helpfulCount` は、そのレビューを参考になったと評価した顧客の数です**（`review_helpful_votes` の、そのレビューの行数）。評価したトランザクションが、同じトランザクションの中で数え直し、保存された値と違うときだけレビューを書きます
- レビューの `updatedAt` は変わりません。レビューの内容が変わったのではないからです。サロンも書きません
- 一覧の `sortBy=helpful` は、この数の降順です
- 誰が評価したかは、API では返しません
- レビューを削除すると、その評価も消えます（外部キーの `ON DELETE CASCADE`）
- 成功は 200 で、`data` は `{ "helpfulCount": <評価したあとの数> }`、`links` は null です。レビューは、取得で読みます

## 通報の規則

通報は、レビューが規則に反すると思った人が、`admin` に知らせるものです。`admin` は、通報を古い順に読み、規則に反するレビューは削除し（[削除の規則](#削除の規則)）、問題のないレビューへの通報は却下します。

| プロパティ | 規則 |
|---|---|
| `reason` | 次の表のどれか |
| `details` | 2000 文字までの文字列か null。空白だけの文字列は不可。`reason` が `other` なら必須（null は 400。`details` の `custom`、`message` は `Must be given when reason is other`） |

| `reason` | 意味 |
|---|---|
| `inappropriate` | 不適切な表現（暴言、差別的な表現、わいせつな内容） |
| `false_information` | 事実と違う内容（施術や来店の事実と違う記述） |
| `personal_information` | 個人情報（スタッフやほかの顧客の氏名、連絡先などの記述） |
| `spam` | 宣伝や、来店と関係のない内容 |
| `other` | ほかのどれにも当たらない理由。何が問題かを `details` に書く |

- **1 つのアカウントが 1 つのレビューを通報するのは、1 回です**。2 回目は 409 です（`code` は `3003`、`detail` は `The account has reported the review already; an account reports a review once`）。却下されたあとも同じです。却下は `admin` の判断なので、同じアカウントが通報を繰り返して覆すことはできません
- 通報したアカウントは、ユーザー ID（`reportedBy`）で記録します。顧客もサロンも、アカウントで通報するからです
- **通報しても、レビューは変わりません**。隠れず、誰でも読めます。消すかどうかは `admin` が決めます
- **`reportCount` は、そのレビューの `pending`（未処理）の通報の数です**。通報と却下のトランザクションが、同じトランザクションの中で数え直し、保存された値と違うときだけレビューを書きます。レビューの `updatedAt` は変わりません。誰が通報したかは、レビューの API では返しません
- コントラクトにないキーは 400 です（`unrecognized_keys`）。`status` などは書けません
- 成功は 200 で、書いた通報を返します（`status` は `pending`、`resolvedBy` と `resolvedAt` は null）。`links.review` はレビューのパスです

## 通報の一覧と却下

- 一覧は、削除していないサロンのレビューへの通報を、`createdAt` の昇順（古い順）に返します。同じ時刻なら `id` の昇順です。届いた順に処理するためです
- **却下は、`pending` の通報を `dismissed` にし、却下した `admin` のユーザー ID（`resolvedBy`）と時刻（`resolvedAt`）を書いて、レビューの `reportCount` を数え直します**。却下した通報を、もう一度却下すると 409 です（`code` は `3003`、`detail` は `The report is dismissed already; a report is dismissed once`）。却下を取り消すオペレーションはありません
- 却下は本文を読みません。成功は 200 で、却下した通報を返します。`links.review` はレビューのパスで、通報のルートと同じ接頭辞の下に作ります
- **レビューを削除すると、その通報も消えます**（外部キーの `ON DELETE CASCADE`）。規則に反するレビューの削除が、`pending` の通報の、もう 1 つの終わり方です
- `links` と `meta` は、レビューの一覧と同じです（`self`、`first`、`next`。`prevCursor`、`links.prev`、`links.last` は null）。`meta.total` は、絞り込みに一致する通報の件数です

| パラメーター | 形式 | 規則 |
|---|---|---|
| `limit` | 整数 | 1〜100。既定は 20 |
| `cursor` | UUID | 前のページの `meta.nextCursor`。一覧に出る通報（削除していないサロンのレビューへの通報）の ID でなければ 400。絞り込みに一致する必要はありません |
| `status` | `pending` か `dismissed` | 通報の状態 |
| `reviewId` | UUID | そのレビューへの通報 |
| `salonId` | UUID | そのサロンのレビューへの通報 |

- 数でない `limit` は 400（`invalid_format`）、範囲外は 400（`too_small`、`too_big`）、知らない `status` は 400（`invalid_value`）です。コントラクトにないパラメーターは 400 です（`unrecognized_keys`）

## サロンからの返信の規則

返信は、サロンがレビューに答えるものです。お礼や施術の説明を、ほかの顧客も読める形で伝えます。1 つのレビューへの返信は 1 つで、レビューの行のカラム（`ownerResponse`、`ownerRespondedAt`）にあります。

| プロパティ | 規則 |
|---|---|
| `ownerResponse` | 文字列か null（キーは必須）。空白だけの文字列は不可（400、`invalid_format`）。長さの上限は、コメントと同じく、ありません（カラムは `text`）。前後の空白や改行も、そのまま残します。null は返信の取り下げです |

- **文字列を指定すると、返信を書きます**。返信があれば置き換えます。`ownerRespondedAt` は、書いた時点の時刻になります
- **null を指定すると、返信を取り下げます**。`ownerResponse` と `ownerRespondedAt` は、どちらも null になります
- **いまと同じ返信を指定しても、何も書きません**。`ownerRespondedAt` は、その返信を書いた時刻のままです。返信のないレビューへの null も、何も書きません。どちらも 200 で、そのときのレビューを返します。二重送信で時刻が変わりません
- **レビューの `updatedAt` は変わりません**。`updatedAt` は、顧客がレビューを投稿、修正した時刻です。サロンの `rating` と `reviewCount` も変わりません
- 顧客がレビューを修正しても、返信は残ります（[修正の規則](#修正の規則)）。レビューを削除すると、返信も一緒に消えます
- コントラクトにないキーは 400 です（`unrecognized_keys`）。`ownerRespondedAt` は書けません
- 成功は 200 で、返信したあとのレビューを返します。`links` は、取得と同じ `self`（レビュー）と `list`（一覧）です

## 一覧と 1 件の取得

- 一覧と取得は、削除したサロンのレビューを返しません。スタッフや顧客を削除しても、そのレビューは残り、`staffId` と `customerId` もそのままです
- `links` は、取得では `self`（レビュー）と `list`（一覧）、一覧では `self`、`first`（どちらもリクエストのクエリのまま）と `next`（次のページがなければ null）です。前のページに戻るカーソルはなく、`prevCursor`、`links.prev`、`links.last` は null です
- `meta.total` は、絞り込みに一致するレビューの件数です（カーソルの位置によらない）

| パラメーター | 形式 | 規則 |
|---|---|---|
| `limit` | 整数 | 1〜100。既定は 20 |
| `cursor` | UUID | 前のページの `meta.nextCursor`。削除していないサロンのレビューの ID でなければ 400 |
| `salonId`、`staffId`、`customerId`、`bookingId` | UUID | その ID のレビュー。どこにもない ID なら、空の一覧 |
| `isVerified` | `true` か `false` | 来店を確かめたレビューかどうか |
| `minRating`、`maxRating` | 1〜5 の整数 | `overallRating` がこの値以上、この値以下（どちらも含む）。`minRating` が `maxRating` より大きければ 400（`minRating` の `custom`、`message` は `Must not be greater than maxRating`） |
| `sortBy` | `recent`、`rating`、`helpful` | 並び順。既定は `recent` |

| `sortBy` | 並び |
|---|---|
| `recent` | `createdAt` の降順 |
| `rating` | `overallRating` の降順 |
| `helpful` | `helpfulCount` の降順 |

- どの並びも、同じ値なら `createdAt` の降順、それも同じなら `id` の降順です
- カーソルのレビューが、絞り込みに一致する必要はありません。並びの中で、カーソルのレビューより後のものを返します
- 数でない `limit` と評価は 400（`invalid_format`）、範囲外は 400（`too_small`、`too_big`）、`true` でも `false` でもない `isVerified` と、知らない `sortBy` は 400（`invalid_value`）です。コントラクトにないパラメーターは 400 です（`unrecognized_keys`）

## 集計

サロンの集計は、そのサロンのすべてのレビューを、スタッフの集計は、`staffId` がそのスタッフのレビューを数えます。保存せず、読むたびに数えます。

| プロパティ | 内容 |
|---|---|
| `averageRating` | `overallRating` の平均を、小数第 2 位に丸めた値（四捨五入）。レビューがなければ null |
| `totalReviews` | レビューの件数 |
| `ratingDistribution` | `overallRating` ごとの件数。キー `"1"`〜`"5"` を、0 件でも必ず含む |

- 削除したスタッフや顧客のレビューも数えます
- `links` は、その集計のパス（`self`）だけです

## サロンの `rating` と `reviewCount`

- **サロンの `reviewCount` はサロンのレビューの件数、`rating` は `overallRating` の平均を小数第 2 位に丸めた値です**。レビューがなければ、`rating` は null、`reviewCount` は 0 です。サロンの集計の `averageRating` と `totalReviews` と一致します
- **レビューを投稿、修正、削除したトランザクションが、同じトランザクションの中で、サロンの 2 つの値を数え直します**
- **サロンを書くのは、数えた値が、保存された値と違うときだけです**。サロンの `updatedAt` も、そのときだけ、書いた時点の時刻になります。投稿と削除は件数が変わるので、いつも書きます。`overallRating` を変えない修正は、サロンを書きません
- サロンの作成と更新のリクエストでは、2 つの値を書けません（[DB 駆動のドメインモデル](./db-driven-domain-model.md)）。サロンの検索の `minRating` は、この `rating` で絞り込みます

## 予約の削除

**レビューがある予約は、削除できません**（409。`detail` は `The booking cannot be deleted: a review refers to it`）。オーナーやマネージャーが、予約と一緒にレビューを消せないようにします。売上と施術記録がある予約と同じです（[予約台帳](./bookings.md#削除)）。レビューを削除すれば（顧客本人か `admin`）、予約を削除できます。

## 同時に届いたリクエスト

- 投稿は、1 つのトランザクション（`READ COMMITTED`）で書きます。顧客が削除されていないことを確かめ、予約を `FOR SHARE` で、そのサロンを `FOR NO KEY UPDATE` で持ってから、予約のステータス、担当したスタッフ、既存のレビューを確かめ、レビューを書いて、サロンの `rating` と `reviewCount` を数え直します。行を持つ順は、ほかの処理と同じです（予約が先、サロンが後）
- **同じサロンへの投稿は、サロンの行で 1 件ずつ順に進みます**。後の投稿は、前の投稿のレビューを含めて数え直します。同時に届いた投稿で、件数がずれることはありません
- 同じ予約への投稿が同時に届いたら、1 件だけを書き、ほかは 409 です。一意制約（`reviews_booking_unique`）も同じことを確かめます。サロンを持たずにその予約のレビューを書くトランザクションがあっても、制約にぶつかった投稿は、何も書かずに 409 です（500 にはならない）
- 修正と削除も、1 つのトランザクション（`READ COMMITTED`）で書きます。顧客が削除されていないことを確かめ（`admin` の削除では確かめない）、レビューを `FOR UPDATE` で、そのサロンを `FOR NO KEY UPDATE` で持ってから、確かめて、書いて、サロンを数え直します。行を持つ順は、レビューが先、サロンが後です。投稿（予約が先、サロンが後）と、どちらもサロンが最後なので、互いに待っても行き詰まりません
- **同じサロンへの投稿、修正、削除は、サロンの行で 1 件ずつ順に進みます**。後の処理は、前の処理の結果を含めて数え直します。レビューを待っている修正と削除は、サロンを持たないので、その間も、同じサロンへの投稿は進みます
- **同じレビューへの修正と削除は、レビューの行で 1 件ずつ順に進みます**。後の処理は、前の処理が残したレビューを確かめます。削除のあとに届いた修正と削除は 404 です
- 参考になったも、1 つのトランザクション（`READ COMMITTED`）で書きます。顧客が削除されていないことを確かめ、レビューを `FOR NO KEY UPDATE` で持ち、サロンが削除されていないことを読んでから（サロンは持たない）、評価の行を書き（同じ顧客の行があれば何もしない）、`helpfulCount` を数え直します
- **同じレビューへの評価は、レビューの行で 1 件ずつ順に進みます**。数え直す文は、レビューを持ったあとに始まるので、待たせた評価の行が見えます。同時に届いた評価で、数がずれることはありません。同じ顧客の評価が同時に届いても、書くのは 1 行です。一意制約（`review_helpful_votes_review_customer_unique`）も同じことを確かめます
- 評価と、修正・削除（レビューを `FOR UPDATE`）は、互いに待ちます。削除を待った評価は 404 です。評価が持つ行はレビューだけなので、投稿、修正、削除と行き詰まらず、サロンを持っている投稿の途中でも進みます。`FOR NO KEY UPDATE` なので、レビューを参照する行を書く処理（外部キーの確認で、レビューを `FOR KEY SHARE` で持つ）も待ちません
- 通報も、1 つのトランザクション（`READ COMMITTED`）で書きます。顧客なら、顧客が削除されていないことを確かめ、レビューを `FOR NO KEY UPDATE` で持ち、サロンが削除されていないことを読んでから（サロンは持たない）、通報の行を書き（同じアカウントの行があれば何も書かずに 409）、`reportCount` を数え直します
- 却下も、1 つのトランザクション（`READ COMMITTED`）で、通報のレビューを `FOR NO KEY UPDATE` で持ってから、通報を読み、書いて、`reportCount` を数え直します。通報の行は持ちません。通報の行を書く処理は、どれもレビューを先に持つからです
- **同じレビューへの通報、却下、参考になったは、レビューの行で 1 件ずつ順に進みます**。数え直す文は、レビューを持ったあとに始まるので、待たせた処理の行が見えます。同時に届いた通報と却下で、数がずれることはありません。同じアカウントの通報が同時に届いても、書くのは 1 行で、ほかは 409 です。一意制約（`review_reports_review_reporter_unique`）も同じことを確かめ、同じアカウントの通報をまだコミットしていないトランザクションがあっても、制約にぶつかった通報は、それを待ってから、何も書かずに 409 です（500 にはならない）。同じ通報の却下が同時に届けば、1 つが 200、ほかは 409 です
- 通報と却下は、レビューの修正・削除と互いに待ちます。削除を待った通報と却下は 404 です。参考になったと同じく、サロンを持っている投稿の途中でも進み、レビューを `FOR KEY SHARE` で持つ処理も待ちません
- 返信も、1 つのトランザクション（`READ COMMITTED`）で書きます。レビューを `FOR NO KEY UPDATE` で持ち、サロンが削除されていないことを読んでから（サロンは持たない）確かめ、いまの返信と違うときだけ返信を書き、書いたあとのレビューを読みます。返信を比べる文は、レビューを持ったあとに始まるので、待たせた処理が書いた返信と比べます
- **同じレビューへの返信は、レビューの行で 1 件ずつ順に進み、後の返信が残ります**。それぞれが、自分の返信を書いたあとのレビューを受け取ります。参考になった、通報、却下とも、レビューの行で 1 件ずつ進みます。修正・削除とは互いに待ち、削除を待った返信は 404 です。参考になったと同じく、サロンを持っている投稿の途中でも進み、レビューを `FOR KEY SHARE` で持つ処理も待ちません
- 予約を `FOR SHARE` で持つ処理（予約を参照するポイントの付与と利用）と、サロンを参照する行を書く処理（外部キーの確認でサロンを `FOR KEY SHARE` で持つ）は、待ちません
- 予約のステータスの変更と削除（予約を `FOR UPDATE` で持つ）とは、互いに待ちます。削除している途中の予約への投稿は、削除を待ち、予約が見つからないので 400 です。投稿を書いている途中の予約の削除は、投稿を待ち、レビューがあるので 409 です
- レビューの `createdAt`、`updatedAt` と `ownerRespondedAt`、サロンの `updatedAt`、評価の `createdAt`、通報の `createdAt`、`updatedAt` と `resolvedAt` は、行を書いた時点の時刻（`clock_timestamp()`）です。サロンやレビューを待った処理は、待たせた処理より後の時刻になります。新しいレビューと通報の `createdAt` と `updatedAt` は、時計を 1 回読んだ、同じ時刻です
- 一覧は、1 つの読み取り専用のトランザクション（`REPEATABLE READ`）で読みます。カーソル、ページ、件数は、同じ時点の値です。ロックは取りません。通報の一覧も同じです

## DB の制約

| 制約 | 内容 |
|---|---|
| `reviews_ratings_in_range` | `overallRating` は 1〜5、ほかの評価は NULL か 1〜5 |
| `reviews_counts_not_negative` | `helpfulCount` と `reportCount` は 0 以上 |
| `reviews_owner_response_pair` | `ownerResponse` と `ownerRespondedAt` は、両方あるか、両方 NULL |
| `reviews_image_urls_array` | `imageUrls` は JSON の配列（カラムは NOT NULL、既定は空の配列） |
| `reviews_booking_unique` | 1 つの予約へのレビューは 1 件 |
| `review_helpful_votes_review_customer_unique` | 1 人の顧客が 1 つのレビューを評価するのは 1 回 |
| `review_reports_review_reporter_unique` | 1 つのアカウントが 1 つのレビューを通報するのは 1 回 |
| `review_reports_resolved_when_dismissed` | `dismissed` の通報は `resolvedBy` と `resolvedAt` を持ち、`pending` の通報はどちらも NULL |
| `review_reports_other_has_details` | `reason` が `other` の通報は `details` を持つ |
| `salons_review_count_not_negative` | サロンの `reviewCount` は 0 以上 |
| `salons_rating_in_range` | サロンの `rating` は NULL か 1〜5 |
| `salons_rating_of_reviews` | `reviewCount` が 0 のときだけ、`rating` は NULL |

- `reviews` の `bookingId`、`customerId`、`salonId` の外部キーは `ON DELETE CASCADE` ですが、予約は、レビューがあれば削除できず、顧客とサロンは、行を残して削除します（`deletedAt`）。レビューが外部キーで消えることはありません
- `staffId` の外部キーは `ON DELETE SET NULL` です。スタッフも、行を残して削除します
- `review_helpful_votes` の `reviewId` と `customerId` の外部キーは `ON DELETE CASCADE` です。レビューを削除すると、その評価も消えます。顧客は行を残して削除するので、顧客の削除で評価が消えることはありません
- `review_reports` の `reviewId` の外部キーは `ON DELETE CASCADE` です。レビューを削除すると、その通報も消えます。`reportedBy` と `resolvedBy` はユーザー ID で、外部キーはありません（予約を変更、取り消したユーザーと同じ）。`details` は 2000 文字まで（`varchar(2000)`）で、空白だけの文字列を拒むのは API です
- `ownerResponse` は `text` で、長さの制約はありません。空白だけの返信を拒むのは API です

## マイグレーション

`202611171000_review_rules.sql` が、上の制約を足し、すべてのサロンの `rating` と `reviewCount` を、レビューから数え直します。

- それまで、サロンの 2 つの値を数える処理はなく、シードは、レビューと関係のない値を書いていました
- `imageUrls` が NULL（または JSON の null）のレビューは、空の配列にします
- 2 回目の適用では、何もしません。値の違うサロンだけを書きます
- 規則に反するレビューが手で書かれていたら、マイグレーションは失敗し、何も変えません。正しい値は決められないので、直してから適用します

`202611171100_review_helpful_votes.sql` が、表 `review_helpful_votes` を作り、すべてのレビューの `helpfulCount` を、表の行数に数え直します。

- それまで、誰が評価したかの記録はなく、数を増やすオペレーションもありませんでした。保存されていた数は、シードか手で書いたものなので、適用すると、どのレビューも 0 になります
- 2 回目の適用では、何もしません。値の違うレビューだけを書きます
- 前の版のサーバーは、この表を読まず、`helpfulCount` も書かないので、サーバーを入れ替える前にも後にも適用できます

`202611171200_review_reports.sql` が、型 `review_report_reason` と `review_report_status`、表 `review_reports` を作り、すべてのレビューの `reportCount` を、`pending` の通報の数に数え直します。

- それまで、通報の記録はなく、数を増やすオペレーションもありませんでした。保存されていた数は、シードか手で書いたものなので、適用すると、どのレビューも 0 になります
- 2 回目の適用では、何もしません。型、表、インデックスは一度だけ作り、値の違うレビューだけを書きます
- 前の版のサーバーは、この表を読まず、`reportCount` も書かないので、サーバーを入れ替える前にも後にも適用できます

## シード

`pnpm db:seed` は、済んだ来店のうち最初の 5 件に、その予約の顧客、サロン、担当スタッフでレビューを書きます（1 件目には、サロンからの返信があります）。そのあとで、サロンの `rating` と `reviewCount` を、レビューから数えます。サロンのシードは、2 つの値を書きません。続けて、ほかのシードの顧客の「参考になった」を書き（レビューごとに 0〜3 人。書いた顧客は、自分のレビューを評価しません）、`helpfulCount` を、その数から数えます。最後に、VIP の顧客（`vip.customer@example.com`）が、1 件目のレビューを宣伝（`spam`）として通報して `admin` が却下した通報と、2 件目のレビューを事実と違う内容（`false_information`）として通報した、`pending` の通報を書き、`reportCount` を、`pending` の通報の数から数えます。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/review.tsp`、`specs/operations/review-operations.tsp`（`ReviewCrud`、`ReviewReportCrud`、`SalonReviewSummary`、`StaffReviewSummary`） |
| データベース | `backend/packages/database/sql/migrations/202611171000_review_rules.sql`、`202611171100_review_helpful_votes.sql`、`202611171200_review_reports.sql`、`src/seeds/seed-data/reviews.ts` |
| ドメイン | `backend/packages/domain/src/models/review.ts`、`schemas/review.schema.ts`、`repositories/review.repository.ts`、`mappers/write/review.mapper.ts`（行は作らない。リクエストを、投稿、修正、返信、一覧の条件にする）、`mappers/read/review.mapper.ts`（レビューと集計のほかに、一覧のページと、参考になったの数も作る）、`business-logic/review/`（誰が投稿できるかは `_shared/authorization.ts`、投稿の計画は `_shared/plan.ts`、修正と削除の計画は `_shared/change.ts`、参考になったの計画は `_shared/helpful.ts`、通報の計画は `_shared/report.ts`、返信の計画は `_shared/response.ts`、409 と 403・404 の内容は `_shared/refusals.ts`）。通報の一覧と却下は `models/review-report.ts`、`schemas/review-report.schema.ts`、`repositories/review-report.repository.ts`、`mappers/write/review-report.mapper.ts`（通報と、一覧の条件）、`mappers/read/review-report.mapper.ts`（通報と、一覧のページ）、`business-logic/review-report/`（誰が扱えるかは `_shared/authorization.ts`、却下の計画は `_shared/dismissal.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/review.repository.impl.ts`、`review-report.repository.impl.ts`、`backend/packages/infrastructure/src/repositories/_shared/review-report-count.ts`（通報と却下が `reportCount` を数え直す） |
| API | `backend/packages/api/src/routes/review/`（`/api/v1/reviews`、`/api/v1/salons/:salonId/reviews`、`/api/v1/staff/:staffId/reviews` に取り付ける）、`backend/packages/api/src/routes/review-report/`（`/api/v1/review-reports` に取り付ける） |
| テスト | `backend/packages/domain/src/schemas/__tests__/review.schema.test.ts`、`backend/packages/domain/src/business-logic/review/__tests__/review.plan.test.ts`、`review.change.test.ts`、`review.helpful.test.ts`、`review.report.test.ts`、`backend/packages/domain/src/business-logic/review-report/__tests__/review-report.usecase.test.ts`、`backend/packages/domain/src/business-logic/review/__tests__/review.response.test.ts`、`review-response.usecase.test.ts`、`backend/packages/domain/src/mappers/__tests__/review.mapper.test.ts`、`review-report.mapper.test.ts`、`backend/packages/domain/src/business-logic/review/__tests__/review.usecase.test.ts`、`backend/packages/api/src/routes/review/_shared/__tests__/`、`backend/packages/api/src/routes/review/__tests__/review.integration.test.ts`（一覧、投稿、取得、集計）、`review-changes.integration.test.ts`（修正と削除）、`review-helpful.integration.test.ts`（参考になった）、`backend/packages/api/src/routes/review-report/__tests__/review-report.integration.test.ts`（通報、一覧、却下）、`backend/packages/api/src/routes/review/__tests__/review-response.integration.test.ts`（返信）、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
