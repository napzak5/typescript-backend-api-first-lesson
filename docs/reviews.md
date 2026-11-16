# レビュー

顧客が来店のあとで書くレビューと、サロンとスタッフごとの集計の規則をまとめます。コントラクトは `specs/operations/review-operations.tsp` の `ReviewCrud`、`SalonReviewSummary`、`StaffReviewSummary` と `specs/models/review.tsp`、テーブルは `reviews` と、`salons` の `rating` と `reviewCount` です。

レビューは、1 回の来店（1 件の予約）について、その予約の顧客が書きます。ポータルでサロンを選ぶ人は、ログインせずにレビューと集計を読みます。

予約の規則は [予約台帳](./bookings.md)、顧客の規則は [顧客台帳](./customers.md)、スタッフの規則は [スタッフ台帳](./staff.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 一覧（`ReviewCrud.list`）、投稿（`create`）、1 件の取得（`get`）、サロンの集計（`SalonReviewSummary.getSummary`）、スタッフの集計（`StaffReviewSummary.getStaffSummary`） | 実装済み |
| 修正（`update`）、削除（`delete`）、参考になった（`markHelpful`）、通報（`report`） | 未実装 |

- 次のものは、ありません
  - サロンからの返信（`ownerResponse`）を書くこと。返信を書くオペレーションは、コントラクトにありません。シードが書いた返信は、読めます
  - 投稿までの期限。来店から何日たっても書けます
  - 不適切な表現の検出と、通報による非表示
  - 画像のアップロード。`imageUrls` は、どこかに置いた画像の URL を受け取るだけです
  - スタッフの成績の集計表（`staff_performances` の `averageRating` など）を書くこと

## オペレーションと権限

| オペレーション | ルート | 使える人 |
|---|---|---|
| 一覧 | `GET /api/v1/reviews` | 誰でも（ログインは要らない） |
| 1 件の取得 | `GET /api/v1/reviews/{id}` | 同上 |
| サロンの集計 | `GET /api/v1/salons/{salonId}/reviews/summary` | 同上 |
| スタッフの集計 | `GET /api/v1/staff/{staffId}/reviews/summary` | 同上 |
| 投稿 | `POST /api/v1/reviews` | 予約の顧客本人だけ（ロール `customer` で、顧客のプロフィールがあるアカウント） |

- 読む 4 つのオペレーションは、アクセストークンを見ません。期限の切れたトークンや、セッションのないトークンを付けても、200 です。サロン、サービス、スタッフのプロフィールと同じく、サロンを選ぶ人が読むものだからです
- **投稿できるのは顧客本人だけです**。`admin` と、サロンの `owner`・`manager`・`staff` は 403 です。レビューは顧客の声なので、ほかの人が代わりに書きません。誰が投稿できるかは、`business-logic/review/_shared/authorization.ts` の `reviewerOf` が決めます
- 顧客のプロフィールのないアカウントと、紐づいた顧客が削除されたアカウントも 403 です
- 本文の `customerId` が自分の顧客 ID でなければ 403 です。ほかの顧客として書けません
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
- **レビューを書いたトランザクションが、同じトランザクションの中で、サロンの 2 つの値を数え直します**。サロンの `updatedAt` も、そのときの時刻になります
- サロンの作成と更新のリクエストでは、2 つの値を書けません（[DB 駆動のドメインモデル](./db-driven-domain-model.md)）。サロンの検索の `minRating` は、この `rating` で絞り込みます

## 予約の削除

**レビューがある予約は、削除できません**（409。`detail` は `The booking cannot be deleted: a review refers to it`）。オーナーやマネージャーが、予約と一緒にレビューを消せないようにします。売上と施術記録がある予約と同じです（[予約台帳](./bookings.md#削除)）。

## 同時に届いたリクエスト

- 投稿は、1 つのトランザクション（`READ COMMITTED`）で書きます。顧客が削除されていないことを確かめ、予約を `FOR SHARE` で、そのサロンを `FOR NO KEY UPDATE` で持ってから、予約のステータス、担当したスタッフ、既存のレビューを確かめ、レビューを書いて、サロンの `rating` と `reviewCount` を数え直します。行を持つ順は、ほかの処理と同じです（予約が先、サロンが後）
- **同じサロンへの投稿は、サロンの行で 1 件ずつ順に進みます**。後の投稿は、前の投稿のレビューを含めて数え直します。同時に届いた投稿で、件数がずれることはありません
- 同じ予約への投稿が同時に届いたら、1 件だけを書き、ほかは 409 です。一意制約（`reviews_booking_unique`）も同じことを確かめます
- 予約のステータスの変更と削除（予約を `FOR UPDATE` で持つ）とは、互いに待ちます。削除している途中の予約への投稿は、削除を待ち、予約が見つからないので 400 です。投稿を書いている途中の予約の削除は、投稿を待ち、レビューがあるので 409 です
- レビューの `createdAt` と `updatedAt`、サロンの `updatedAt` は、行を書いた時点の時刻（`clock_timestamp()`）です。サロンを待った投稿は、待たせた投稿より後の時刻になります
- 一覧は、1 つの読み取り専用のトランザクション（`REPEATABLE READ`）で読みます。カーソル、ページ、件数は、同じ時点の値です。ロックは取りません

## DB の制約

| 制約 | 内容 |
|---|---|
| `reviews_ratings_in_range` | `overallRating` は 1〜5、ほかの評価は NULL か 1〜5 |
| `reviews_counts_not_negative` | `helpfulCount` と `reportCount` は 0 以上 |
| `reviews_owner_response_pair` | `ownerResponse` と `ownerRespondedAt` は、両方あるか、両方 NULL |
| `reviews_image_urls_array` | `imageUrls` は JSON の配列（カラムは NOT NULL、既定は空の配列） |
| `reviews_booking_unique` | 1 つの予約へのレビューは 1 件 |
| `salons_review_count_not_negative` | サロンの `reviewCount` は 0 以上 |
| `salons_rating_in_range` | サロンの `rating` は NULL か 1〜5 |
| `salons_rating_of_reviews` | `reviewCount` が 0 のときだけ、`rating` は NULL |

- `reviews` の `bookingId`、`customerId`、`salonId` の外部キーは `ON DELETE CASCADE` ですが、予約は、レビューがあれば削除できず、顧客とサロンは、行を残して削除します（`deletedAt`）。レビューが外部キーで消えることはありません
- `staffId` の外部キーは `ON DELETE SET NULL` です。スタッフも、行を残して削除します

## マイグレーション

`202611171000_review_rules.sql` が、上の制約を足し、すべてのサロンの `rating` と `reviewCount` を、レビューから数え直します。

- それまで、サロンの 2 つの値を数える処理はなく、シードは、レビューと関係のない値を書いていました
- `imageUrls` が NULL（または JSON の null）のレビューは、空の配列にします
- 2 回目の適用では、何もしません。値の違うサロンだけを書きます
- 規則に反するレビューが手で書かれていたら、マイグレーションは失敗し、何も変えません。正しい値は決められないので、直してから適用します

## シード

`pnpm db:seed` は、済んだ来店のうち最初の 5 件に、その予約の顧客、サロン、担当スタッフでレビューを書きます（1 件目には、サロンからの返信があります）。そのあとで、サロンの `rating` と `reviewCount` を、レビューから数えます。サロンのシードは、2 つの値を書きません。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/review.tsp`、`specs/operations/review-operations.tsp`（`ReviewCrud`、`SalonReviewSummary`、`StaffReviewSummary`） |
| データベース | `backend/packages/database/sql/migrations/202611171000_review_rules.sql`、`src/seeds/seed-data/reviews.ts` |
| ドメイン | `backend/packages/domain/src/models/review.ts`、`schemas/review.schema.ts`、`repositories/review.repository.ts`、`mappers/read/review.mapper.ts`、`business-logic/review/`（誰が投稿できるかは `_shared/authorization.ts`、投稿の計画は `_shared/plan.ts`、409 の内容は `_shared/refusals.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/review.repository.impl.ts` |
| API | `backend/packages/api/src/routes/review/`（`/api/v1/reviews`、`/api/v1/salons/:salonId/reviews`、`/api/v1/staff/:staffId/reviews` に取り付ける） |
| テスト | `backend/packages/domain/src/__tests__/review.schema.test.ts`、`review.plan.test.ts`、`review.mapper.test.ts`、`review.usecase.test.ts`、`backend/packages/api/src/routes/review/_shared/__tests__/`、`backend/packages/api/src/__tests__/review.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
