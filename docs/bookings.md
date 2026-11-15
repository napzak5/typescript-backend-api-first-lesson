# 予約台帳

予約（`bookings`）と、その施術明細（`booking_services`）の規則をまとめます。コントラクトは `specs/operations/booking-operations.tsp` と `specs/models/booking.tsp`、テーブルは `bookings`、`booking_services`、`booking_status_histories` です。

予約台帳は、サロンが予約を入れて読むためのものです。管理者とサロンのスタッフが `/api/v1/bookings` で扱います。顧客のアカウントは、このルートを使えません。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 台帳（`BookingCrud`）の一覧、作成、1 件の取得 | 実装済み |
| 更新、削除、確定、キャンセル、完了、日時の変更（`BookingCrud` の残りの 6 つ） | 未実装 |
| 施術明細の追加、取得、削除（`BookingServiceCrud`） | 未実装 |
| 空き枠の一覧と確認（`AvailableSlotCrud`） | 未実装 |
| 顧客が自分で入れる予約、顧客が自分の予約を読むルート | 未実装。コントラクトにもない |

未実装のオペレーションは、コントラクトには定義がありますが、サーバーは 404 を返します。作成した予約は `pending` のままで、ステータスを変える手段はまだありません。

## サロンが台帳に入れる予約は、サロンの判断

台帳に入れる予約について、システムが確かめるのは、データの整合だけです。

- 参照するもの（サロン、顧客、スタッフ、サービス）が存在し、スタッフとサービスが予約のサロンのものであること
- スタッフが、同時に受けられる数を超えて重ならないこと（[スタッフの占有](#スタッフの占有)）

次の設定は、サロンが「何を受け付けるか」を決めたもので、電話や店頭で受けた予約をスタッフが台帳に入れることを妨げません。台帳の作成では確かめません。

- サロンの `isActive`、営業時間
- スタッフの `isActive`、`canReceiveBookings`、勤務スケジュール、ランク（サービスの `requiredStaffLevel`）
- サービスの `isActive`、`serviceStatus`、`allowOnlineBooking`、`maxBookingsPerDay`
- 顧客の `isActive`、`customerStatus`

これらは、顧客が自分で入れる予約と、空き枠の算出に適用する条件です。どちらも未実装で、条件はその実装で決めます。顧客の好み設定（[顧客台帳](./customers.md#好み設定)）は、サーバーの判定には使いません。画面が、希望するスタッフを初期選択に使い、避けるスタッフを候補から外します。

過去の日時の予約も作成できます（来店のあとで記録する）。

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/bookings` | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの予約だけ） |
| 作成 | `POST /api/v1/bookings` | `admin`、本文の `salonId` のサロンの `owner` / `manager` / `staff` |
| 1 件の取得 | `GET /api/v1/bookings/{id}` | `admin`、予約のサロンの `owner` / `manager` / `staff` |

- すべてのオペレーションに認証が要ります
- 予約はサロンのものですが、ルートはサロンの下に置きません（コントラクトのとおり `/api/v1/bookings`）。サロンは、作成では本文の `salonId`、一覧ではクエリの `salonId`、取得では予約そのものが決めます
- 誰がどの予約に届くかは、操作者の範囲で決まります（`business-logic/booking/_shared/authorization.ts` の `bookingReachOf`）。`admin` はすべてのサロン、サロンのユーザーは所属サロンです。サロンの 3 つのロールに違いはありません
- **顧客のアカウントは、このルートを使えません**（403）。`BookingResponse` はサロン内のメモ（`internalNotes`）を含みます。顧客台帳と同じく、顧客には、自分の予約だけを、見せてよい項目だけで返す別のルートを用意します（未実装）。ロールに必要なレコードを持たないユーザー（範囲 `none`）も 403 です
- **ほかのサロンの予約は、存在しない予約と区別しません**。取得は 404、一覧には出ず、カーソルに指定すると 400 です
- ID（パスの `id`、本文とクエリの ID）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です
- レスポンスの `links` は `self` と `list` です。作成は 201 で、`Location` ヘッダーに予約の URL を返します

### 確認の順序

作成:

1. アクセストークン（401）
2. 操作者の種類（403。顧客、範囲のないアカウント）
3. リクエストの本文（400）
4. 本文の `salonId` が操作者のサロンであること（403。`admin` はどのサロンでもよい）
5. 参照するものの存在（400。[参照するもの](#参照するもの)）
6. サロンのタイムゾーン（409。[来店日とサロンのタイムゾーン](#来店日とサロンのタイムゾーン)）
7. 金額の上限（400）
8. スタッフの占有（409）

一覧:

1. アクセストークン（401）
2. 操作者の種類（403）
3. クエリ（400）
4. クエリの `salonId` が操作者のサロンであること（403）
5. カーソル（400。操作者に見える予約を指していること）

取得:

1. アクセストークン（401）
2. 操作者の種類（403）
3. ID の形式（400）
4. 予約の存在（404。ほかのサロンの予約も同じ）

顧客のアカウントには、本文やクエリや ID が不正でも 403 を返します。サロンのユーザーがほかのサロンの `salonId` を指定したときは、本文（またはクエリ）が正しければ 403 で、不正なら 400 です。どのサロンかは、本文を読まないと分からないからです。

読めない本文（400 のコード `2002`、415、413）は、この順序の前に答えます（[顧客台帳の確認の順序](./customers.md#確認の順序) と同じ）。

## 作成リクエストの規則

`BookingCreateRequest` は全項目が必須で、null にできるのは、型に `null` がある項目だけです。表にない項目を書くと 400（`unrecognized_keys`）です。

| 項目 | 型 | 規則 |
|---|---|---|
| `salonId` | `SalonId` | 削除されていないサロン |
| `customerId` | `CustomerId` | 削除されていない顧客 |
| `staffId` | `StaffId` | 予約の担当スタッフ。`salonId` のサロンの、削除されていないスタッフ |
| `depositAmount` | `int32 \| null` | 0 以上、2,147,483,647 以下 |
| `customerRequest` | `string \| null` | 空白だけでない |
| `internalNotes` | `string \| null` | 空白だけでない |
| `source` | `string \| null` | 空白だけでない、50 文字以内 |
| `services` | 施術明細の一覧 | 1 件以上 20 件以下 |
| `services[].serviceId` | `ServiceId` | `salonId` のサロンの、削除されていないサービス |
| `services[].staffId` | `StaffId \| null` | `salonId` のサロンの、削除されていないスタッフ。null は「担当を決めない」 |
| `services[].startTime` | `utcDateTime` | UTC（`Z`）で、分単位（秒と小数は 0） |
| `services[].notes` | `string \| null` | 空白だけでない |

- すべての明細は、最も早い明細の開始から 24 時間以内に始まります（400。`services.<番号>.startTime`）。予約は 1 回の来店で、1 日後に始まる明細は日付の打ち間違いだからです
- 同じサービスを 2 つの明細に指定できます（2 人分、2 回分）。明細の時間が互いに重なってもかまいません（2 人のスタッフが同時に施術する）
- 明細は、リクエストに書いた順に並びます（`sortOrder` は 0 から）。開始日時の順である必要はありません
- 本文だけで分かる誤りは、1 回の応答ですべて挙げます

### 参照するもの

- 存在しない、削除されている、`salonId` のサロンのものでない、のどれも 400 で、区別しません（`rule` は `not_found`）。`field` は `salonId`、`customerId`、`staffId`、`services.<番号>.serviceId`、`services.<番号>.staffId` です
- 1 回の応答で、見つからなかったものをすべて挙げます。サロンが見つからないときは、スタッフとサービスは確かめません（サロンと顧客だけを挙げます）。属するサロンがなければ、スタッフもサービスも探せないからです
- 予約の担当スタッフ（`staffId`）と明細のスタッフ（`services[].staffId`）は別の項目です。担当スタッフが、どの明細も担当しなくてもかまいません

## システムが決める値

リクエストが書くのは、誰の予約か、どのサービスをいつ始めるか、だけです。ほかの値は、参照する行から、作成の時点で決まります（`business-logic/booking/_shared/plan.ts` の `planBooking`）。

明細（`booking_services`）:

| カラム | 値 |
|---|---|
| `duration` | サービスの `duration` |
| `endTime` | `startTime` + `duration` 分 |
| `price` | サービスの `price` |
| `discountAmount` | `price` − `discountPrice`（`discountPrice` が null なら 0） |
| `finalPrice` | `price` − `discountAmount` |
| `sortOrder` | リクエストの順（0 から） |
| `isCompleted`、`completedAt` | false、null |
| `selectedOptions` | null（サービスのオプションは、予約のコントラクトにない） |

予約（`bookings`）:

| カラム | 値 |
|---|---|
| `bookingNumber` | [予約番号](#予約番号) |
| `status` | `pending` |
| `startTime`、`endTime` | 明細の最も早い開始、最も遅い終了 |
| `duration` | `startTime` から `endTime` までの分数 |
| `bookingDate` | `startTime` を、サロンのタイムゾーンで表した日付 |
| `subtotal` | 明細の `price` の合計 |
| `discountAmount` | 明細の `discountAmount` の合計 |
| `taxAmount` | [消費税](#消費税) |
| `totalAmount` | `subtotal` − `discountAmount` + `taxAmount` |
| `pointsUsed`、`pointsEarned`、`cancellationFee` | null |
| `reminderSent`、`reminderSentAt` | false、null |
| `cancelledAt`、`cancelledBy`、`cancellationReason`、`completedAt`、`actualStartTime`、`actualEndTime` | null |
| `ipAddress`、`userAgent` | リクエストの送信元（監査用。レスポンスには出さない） |

- 金額と時間は、作成の時点のサービスの写しです。あとでサービスの料金や所要時間を変えても、予約は変わりません
- `subtotal` か `totalAmount` が `integer` の上限（2,147,483,647）を超える予約は 400 です（`services` の `too_big`）
- 明細の間に空き時間があっても、予約の `duration` は最初の開始から最後の終了までの分数です。明細の `duration` の合計とは限りません
- ステータスの履歴（`booking_status_histories`）に、作成を 1 行書きます（`fromStatus` が null、`toStatus` が `pending`、`changedBy` が操作者のユーザー ID）。履歴を読むオペレーションはありません

### 消費税

- 税込価格のサービス（`taxIncluded` が true。既定値）は、料金に消費税を含みます。`taxAmount` には加えません
- 税抜価格のサービス（`taxIncluded` が false）には、サロンの税率（`salons.taxRate`）で消費税を加えます。`taxAmount` は、税抜価格の明細の `finalPrice` の合計 × 税率で、1 円未満は切り捨てます
- 端数の処理は、予約ごとに 1 回です（明細ごとに丸めて合計しません）。適格請求書の消費税額の端数処理の単位（消費税法基本通達 1-8-15: 一の適格請求書につき、税率の異なるごとに 1 回）に合わせています。この API のサロンは税率を 1 つ持ちます
- つまり `taxAmount` は「料金に加える消費税」で、税込価格に含まれている分は入りません
- 計算は整数で行います（税率を 100 分の 1 パーセント単位の整数にして掛ける）。浮動小数点の誤差で 1 円ずれることはありません

### 予約番号

- `BK-XXXX-XXXX` の形式です。`X` は、数字と、読み間違えやすい文字（I、L、O、U）を除いた英大文字の 32 文字（Crockford の Base32 の文字集合）から、暗号論的な乱数で選びます（32^8 ≒ 1.1 × 10^12 通り）
- 連番にはしません。連番は、プラットフォーム全体の予約の件数を、番号を見た人に伝えます
- すでにある番号と重なったら、別の番号で作り直します（一意制約 `bookings_booking_number_unique`）。3 回続けて重なると 500 です
- 番号を作るのは `business-logic/booking/_shared/booking-number.ts` の `bookingNumberFrom`、乱数を渡すのは `infrastructure` の `RandomBookingNumberIssuer` です

### 来店日とサロンのタイムゾーン

- `bookingDate` は、`startTime` をサロンのタイムゾーン（`salons.timezone`）で表した日付です。日本時間の 0:30 に始まる予約は、UTC では前日でも、来店日はその日です
- サロンの `timezone` は、タイムゾーンの名前でなければなりません（サロンの作成と更新で 400）。実行環境が名前として知っているもの（`Asia/Tokyo`、`UTC` など）を受け付け、`+09:00` のようなオフセットは受け付けません。オフセットは、いまの時計のずれを表すだけで、夏時間のある地域では季節によって変わるからです（`schemas/rules.ts` の `timeZoneName`）
- この規則より前に保存されたサロンが、名前として読めないタイムゾーンを持っていると、来店日を決められません。そのサロンへの予約の作成は 409 です（`detail` が、サロンのタイムゾーンを直すよう伝える）。以前に保存されたオフセット（`+09:00`）は、日付を決められるので、そのまま使います

## スタッフの占有

- 予約は、明細を担当するスタッフ（`booking_services.staffId`）を、その明細の時間だけ占有します。前後に、スタッフの準備時間（`bufferTimeBefore`）と片付け時間（`bufferTimeAfter`）を加えます: `startTime − bufferTimeBefore` から `endTime + bufferTimeAfter` まで（終わりの時刻は含まない）
- **担当を決めていない明細（`staffId` が null）は、誰も占有しません**。予約の担当スタッフ（`bookings.staffId`）も、明細を担当していない時間は占有されません（カラーの放置時間に、ほかの顧客を担当できる）
- 占有するのは、ステータスが `cancelled` と `no_show` 以外の予約です（`draft`、`pending`、`confirmed`、`in_progress`、`completed`）
- どの時点でも、1 人のスタッフを占有する予約の数は、そのスタッフの `maxConcurrentBookings` を超えません。超える予約の作成は 409 です（`detail` に、空いていないスタッフの ID が入る）
- 1 つの予約の中の複数の明細が同じスタッフを同じ時間に占有しても、1 件と数えます
- 準備時間と片付け時間は、確認の時点のスタッフの設定を使います（予約には写しません）。両方の予約に同じ設定を当てはめます。設定を変えても、すでにある予約は見直しません
- 同じ顧客の予約どうしの重なりは確かめません

規則は `business-logic/booking/_shared/occupancy.ts` の `isOccupiedBeyondCapacity` です。

## 1 件の取得と一覧

- `services` は、明細を `sortOrder` の順に並べたものです
- 日時は UTC で、ミリ秒までの ISO 8601 形式です（`2026-11-20T01:00:00.000Z`）
- 一覧の並びは、開始日時（`startTime`）の早い順、同じ値の中では `id` の昇順です
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後の予約の ID です。操作者に見えない予約や、予約でない ID を指す `cursor` は 400 です（`cursor` の `not_found`）
- `meta.total` は、絞り込みに一致する予約の件数です
- サロンのユーザーが `salonId` を指定しなければ、所属サロンの予約だけを返します。ほかのサロンの `salonId` を指定すると 403 です
- 絞り込みは、すべて AND で結合します

| パラメーター | 一致する予約 |
|---|---|
| `salonId` | そのサロンの予約 |
| `customerId` | その顧客の予約 |
| `staffId` | そのスタッフが担当スタッフである予約と、どれかの明細を担当している予約 |
| `status` | ステータスが一致する |
| `bookingDateFrom` / `bookingDateTo` | 来店日がその日以降 / 以前（両端を含む）。`bookingDateFrom` が `bookingDateTo` より後なら 400（`bookingDateTo` の `custom`） |

- `customerId` や `staffId` に、存在しない ID やほかのサロンのスタッフの ID を指定しても、エラーにはしません。一致する予約がないだけです
- 保存されている行が API のモデルに合わないとき（マイグレーションより前の行など）は 500（データベースのエラー）です。読み出すときに検証します（`mappers/read/booking.mapper.ts`）

## 同時に届いたリクエスト

| 状況 | 結果 |
|---|---|
| 同じスタッフの同じ時間への予約が、同時に何件も届く | そのスタッフが同時に受けられる数（`maxConcurrentBookings`）だけが 201 で、ほかは 409 |
| 2 件の予約が、同じ 2 人のスタッフを逆の順に指定して同時に届く | 片方が 201 で、もう片方は 409。互いを待ち続けることはない |
| 同じ顧客と同じサービスで、スタッフが別々の予約が同時に届く | すべて 201。互いを待たない |
| あるスタッフへの予約を書いている途中に、同じスタッフの同じ時間への予約が届く | 先の予約が終わるのを待つ。先の予約が書かれれば 409、取りやめになれば 201 |
| 予約が参照するサロン、顧客、サービス、スタッフの削除が進んでいる途中に、作成が届く | 削除が終わるのを待ち、400（`not_found`）。何も保存しない |
| サービスの料金と所要時間の変更が進んでいる途中に、作成が届く | 変更が終わるのを待ち、新しい料金と所要時間で予約する |
| 予約を書いている途中に、参照するサロン、顧客、サービスの削除が届く | 削除は、予約が書き終わるのを待つ。予約は 201 |

作成は 1 つのトランザクションです（`infrastructure` の `BookingRepository.create`）。

1. サロン、顧客、サービスの行を、この順に共有ロック（`FOR SHARE`）します。確認した行が、書き終わるまで削除されず、料金も変わらないようにするためです。共有ロックどうしは待たせないので、同じ顧客や同じサービスの予約は並行して進みます
2. リクエストが挙げたスタッフ（担当スタッフと、明細のスタッフ）の行を、1 つの問い合わせで、ID の順に排他ロック（`FOR UPDATE`）します。同じスタッフへの予約は 1 件ずつ処理されるので、同時に届いた 2 件が、どちらも「空いている」と判断して両方書かれることはありません。どのリクエストも同じ順にロックするので、デッドロックになりません
3. 占有を確かめて、予約、明細、履歴を書きます

このトランザクションは、分離レベルを `READ COMMITTED` と明示しています。ロックを待ったあとの問い合わせが、待っている間に書かれた予約を見るためです。トランザクション全体で 1 つのスナップショットを使う分離レベル（`REPEATABLE READ`）では、待っていた相手の予約が見えず、両方が書かれます。

取得と一覧は、ロックを待ちません。

## DB の制約

マイグレーション `202611160200_bookings_rules.sql` で、次のようにしました。

- 既定値をなくした（NULL 可のまま）: `bookings.depositAmount`、`pointsUsed`、`pointsEarned`、`cancellationFee`（以前は 0）、`booking_services.selectedOptions`（以前は `[]`）。設定していない値は NULL です
- `bookings` の CHECK 制約: 終了が開始より後（`bookings_end_after_start`）、`duration` が開始から終了までの分数（`bookings_duration_is_the_span`）、金額は 0 以上（`bookings_amounts_not_negative`）、`discountAmount` は `subtotal` 以下（`bookings_discount_within_subtotal`）、`totalAmount` = `subtotal` − `discountAmount` + `taxAmount`（`bookings_total_is_the_sum`）
- `booking_services` の CHECK 制約: 終了が開始より後（`booking_services_end_after_start`）、`duration` が開始から終了までの分数（`booking_services_duration_is_the_span`）、`discountAmount` は 0 以上で `price` 以下（`booking_services_discount_within_price`。`price` が 0 以上であることも、これで決まる）、`finalPrice` = `price` − `discountAmount`（`booking_services_final_price_is_the_difference`）、`isCompleted` と `completedAt` が合っている（`booking_services_completed_has_time`）、`sortOrder` は 0 以上（`booking_services_sort_order_not_negative`）
- 一意制約: 1 つの予約の中で `sortOrder` は重ならない（`booking_services_order_unique`）
- インデックス: `booking_services` の `(staffId, startTime)`（`idx_booking_services_staff_start`。スタッフの占有を調べる）、`bookings` の `(salonId, startTime, id)`（`idx_bookings_salon_start`。サロンの予約を一覧の順に読む）。それぞれ、先頭のカラムだけのインデックスを置き換えた

以前の行は、ほかのカラムから決まる値をマイグレーションが直します（予約と明細の `duration`、予約の `totalAmount`、明細の `finalPrice`、明細の `sortOrder` は元の順のまま 0 から振り直す）。決められないもの（終了が開始より後でない、金額が負、完了しているのに完了日時がない、など）があると、マイグレーションは失敗します。行を直してから、やり直します。

スタッフの占有（重なり）は、DB の制約では保証しません。同時に受けられる数と前後の時間がスタッフごとに違い、制約では書けないからです。作成のトランザクションが、スタッフの行のロックで保証します。

## シード

`pnpm db:seed` は、2 つのサロンに 15 件の予約を入れます（`backend/packages/database/src/seeds/seed-data/bookings.ts`）。

- 内容は、実行した日を基準に決まります（30 日前から 7 日後まで）。乱数は使いません
- 済んだ来店が 6 件（`completed`）、前日にキャンセルした予約が 1 件（`cancelled`）、これからの予約が 8 件（`confirmed` が 2 件、`pending` が 6 件）
- スタッフとサービスは、予約のサロンのものです。明細の時間と金額はサービスの写しで、予約の時間と金額は明細から算出します。来店日は、サロンのタイムゾーンの日付です
- 予約番号は `BK-SEED-0001` から `BK-SEED-0015` です（API が採番する番号と同じ形式）
- どの予約にも、作成からのステータスの履歴があります
- スタッフの占有の規則を満たします。同時に 2 件を受けるスタッフ（`STF001`）に、同じ時間の予約が 2 件あります
- レビューのシードは、済んだ来店のうち最初の 5 件に、その予約の顧客、サロン、担当スタッフで書きます

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/booking.tsp`、`specs/operations/booking-operations.tsp` |
| ドメイン | `backend/packages/domain/src/models/booking.ts`、`schemas/booking.schema.ts`、`mappers/read/booking.mapper.ts`、`repositories/booking.repository.ts`、`services/booking-number-issuer.ts`、`business-logic/booking/`（誰がどの予約に届くかは `_shared/authorization.ts`、リクエストから書く行を決めるのは `_shared/plan.ts`、スタッフの占有の規則は `_shared/occupancy.ts`、予約番号は `_shared/booking-number.ts`、リポジトリが断った理由をエラーに直すのは `_shared/refusals.ts`）。Write マッパーはない（書く行は `planBooking` が決める） |
| ドメイン（共通） | `backend/packages/domain/src/schemas/rules.ts`（`inTimeZone`、`timeZoneName`） |
| インフラ | `backend/packages/infrastructure/src/repositories/booking.repository.impl.ts`、`security/random-booking-number-issuer.ts` |
| API | `backend/packages/api/src/routes/booking/` |
| DB | `backend/packages/database/sql/migrations/202611160200_bookings_rules.sql` |
