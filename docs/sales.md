# 売上台帳

売上（`sales`）と、その明細（`sales_details`）の規則をまとめます。コントラクトは `specs/operations/payment-operations.tsp` と `specs/models/payment.tsp`、テーブルは `sales`、`sales_details`、`payment_transactions` です。

売上台帳は、サロンが会計を記録して読むためのものです。管理者とサロンのスタッフが `/api/v1/sales` で扱います。顧客のアカウントは、このルートを使えません。

1 件の売上は、1 回の会計です。誰に（顧客）、誰が（担当スタッフ）、何を（明細）、いくらで売ったかを持ちます。予約の会計であれば、その予約を指します。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 売上（`SaleCrud`）の一覧、作成、1 件の取得、更新、取り消し（`list`、`create`、`get`、`update`、`voidSale`） | 実装済み |
| 支払いの記録と返金（`SaleCrud` の `process`、`PaymentCrud` の `refund`） | 実装済み（規則は [支払い](./payments.md)） |
| レシートと金額の計算（`SaleCrud` の `getReceipt`、`calculate`） | 実装済み（[レシート](#レシート)、[金額の計算](#金額の計算)） |
| 売上レポート（`SalesReportCrud`） | 実装済み（期間の売上の CSV の出力を含む。規則は [売上レポート](./sales-reports.md)） |
| ポイント（`PointCrud`） | 実装済み（規則は [ポイント台帳](./points.md)） |

- 未実装のオペレーションへのリクエストは 404 です
- 売上の `paymentStatus` と `payments` は、支払いの記録と返金が書きます（[支払い](./payments.md#売上の支払い状態)）。作成した売上は `pending` で、`payments` は空です
- 売上は、削除できません（コントラクトに、削除のオペレーションがない）。誤って入れた売上は、更新で直すか（[更新](#更新)）、取り消します（[取り消し](#取り消し)）。取り消した売上は、記録として台帳に残ります
- 売上を誰が、いつ、どう変えたかの履歴は、残しません（テーブルがない）。残るのは、最後に変えた時刻（`updatedAt`）と、取り消しの時刻と理由だけです

## 売上は、レジが決めた会計の記録

売上は、行われた会計の記録です。金額は、会計の時点でレジ（クライアント）が決めたものを、そのまま保存します。システムが確かめるのは、データの整合だけです。

- 明細が、それ自身と合っていること（割引は数量 × 単価まで、合計は数量 × 単価 − 割引 + 消費税）
- 参照するもの（サロン、顧客、スタッフ、予約、サービス、商品）が存在し、スタッフ、予約、サービス、商品が売上のサロンのものであること
- 1 つの予約の会計は 1 回であること（[予約の会計は 1 回](#予約の会計は-1-回)）

次のものは確かめません。どれも、会計の時点でサロンが決めたことだからです。

- 明細の単価が、サービスの料金（`services.price`）や商品の価格（`products.retailPrice`）と同じかどうか。明細の名前（`itemName`）も、サービスや商品の名前と比べません。売上は、売った時点の名前と金額を持ちます
- 明細の消費税が、サロンの税率（`salons.taxRate`）のとおりかどうか（[消費税](#消費税)）
- 歩合の金額（`commissionAmount`）が、歩合率（`commissionRate`）から出した金額かどうか
- スタッフの `isActive`、`canReceiveBookings`。サービスの `isActive`、`serviceStatus`、`allowOnlineBooking`。商品の `isActive`、`isForSale`。顧客の `isActive`、`customerStatus`。退職したスタッフの売上も、扱いをやめた商品の売上も、あとから記録できます
- 予約のステータス。キャンセルした予約にも、無断キャンセルの予約にも、会計を入れられます（キャンセル料）
- 会計日時（`saleTime`）が、過去か未来か。閉店後にまとめて入れることも、前受けを先に入れることもできます
- 利用したポイント（`pointsUsed`）が、顧客の残高（`customers.loyaltyPoints`）以内かどうか。ポイントの利用は、売上とは別に、ポイント台帳に記録します（[ポイント台帳](./points.md#売上と支払いとの関係)）

会計の前に金額を見積もるオペレーション（[金額の計算](#金額の計算)）は、サロンの料金と税率から金額を出しますが、売上の作成は、その結果と比べません。レジは、計算の結果を明細の金額にして、売上を作成します。

売上の作成は、ほかの行を変えません。予約のステータスも金額も、顧客のポイント（`loyaltyPoints`）も、商品の在庫も、そのままです。顧客が使った金額は、[顧客の統計](./customers.md#統計)が売上から数えます。更新と取り消しも同じで、変えるのは、その売上と明細だけです。売上の `pointsUsed` と `pointsEarned` も、顧客の残高を動かしません。残高を動かすのは、ポイント台帳の付与、利用、調整、失効だけです（[ポイント台帳](./points.md)）。

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/sales` | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの売上だけ） |
| 作成 | `POST /api/v1/sales` | `admin`、本文の `salonId` のサロンの `owner` / `manager` / `staff` |
| 1 件の取得 | `GET /api/v1/sales/{id}` | `admin`、売上のサロンの `owner` / `manager` / `staff` |
| 更新 | `PATCH /api/v1/sales/{id}` | `admin`、売上のサロンの `owner` / `manager` / `staff` |
| 取り消し | `POST /api/v1/sales/{id}/void` | `admin`、売上のサロンの `owner` / `manager`（`staff` は 403） |
| レシート | `GET /api/v1/sales/{id}/receipt` | `admin`、売上のサロンの `owner` / `manager` / `staff` |
| 金額の計算 | `POST /api/v1/sales/calculate` | `admin`、本文の `salonId` のサロンの `owner` / `manager` / `staff` |

- すべてのオペレーションに認証が要ります
- 売上はサロンのものですが、ルートはサロンの下に置きません（コントラクトのとおり `/api/v1/sales`。予約台帳と同じ）。サロンは、作成と金額の計算では本文の `salonId`、一覧ではクエリの `salonId`、取得、更新、取り消し、レシートでは売上そのものが決めます
- 誰がどの売上に届くかは、操作者の範囲で決まります（`business-logic/sale/_shared/authorization.ts` の `saleReachOf`）。`admin` はすべてのサロン、サロンのユーザーは所属サロンです。届く範囲の型は、予約台帳と同じ `LedgerReach` です
- サロンの 3 つのロールの違いは、取り消しだけです。会計は、レジに立つスタッフの仕事なので、作成も、読むことも、打ち間違いを直すこと（更新）も、レシートを出すことも、会計の前に金額を計算することも、3 つのロールができます。取り消しは、売上をサロンの売上から外し、予約をもう一度会計できる状態に戻す操作なので、`owner` と `manager` のものです（予約の削除と同じ分け方。`saleVoidReachOf`）。`staff` は、ID や本文を確かめる前に 403 です
- **顧客のアカウントは、このルートを使えません**（403）。`SaleResponse` は、スタッフの歩合（`commissionRate`、`commissionAmount`）とサロン内の備考（`notes`）を含みます。自分が支払った売上にも届きません。顧客が自分の支払いを読むルートは、ありません。ロールに必要なレコードを持たないユーザー（範囲 `none`）も 403 です
- **ほかのサロンの売上は、存在しない売上と区別しません**。取得、更新、取り消し、レシートは 404、一覧には出ず、カーソルに指定すると 400 です
- ID（パスの `id`、本文とクエリの ID）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です
- レスポンスの `links` は `self` と `list` です。作成は 201 で、`Location` ヘッダーに売上の URL を返します。更新と取り消しは 200 で、変えたあとの売上を返します
- レシートの `links` は、`self`（レシート）と `sale`（売上）です。金額の計算には自分の URL がないので、`links` は、`self`（`/api/v1/sales/calculate`）と `list` です

### 確認の順序

作成:

1. アクセストークン（401）
2. 操作者の種類（403。顧客、範囲のないアカウント）
3. リクエストの本文（400）
4. 本文の `salonId` が操作者のサロンであること（403。`admin` はどのサロンでもよい）
5. 参照するものの存在（400。[参照するもの](#参照するもの)）
6. 金額の上限（400）
7. サロンのタイムゾーン（409。[会計日とサロンのタイムゾーン](#会計日とサロンのタイムゾーン)）
8. 予約が、まだ会計されていないこと（409。[予約の会計は 1 回](#予約の会計は-1-回)）

一覧:

1. アクセストークン（401）
2. 操作者の種類（403）
3. クエリ（400）
4. クエリの `salonId` が操作者のサロンであること（403）
5. カーソル（400。操作者に見える売上を指していること）

取得:

1. アクセストークン（401）
2. 操作者の種類（403）
3. ID の形式（400）
4. 売上の存在（404。ほかのサロンの売上も同じ）

更新:

1. アクセストークン（401）
2. 操作者の種類（403。顧客、範囲のないアカウント）
3. ID の形式（400）
4. リクエストの本文（400）
5. 売上の存在（404。ほかのサロンの売上も同じ）
6. 売上が取り消されていないこと（409）
7. `details` を指定したなら、支払い状態が `pending` であること（409）
8. 参照するものの存在と、更新後の売上の規則（400。[更新](#更新)）
9. 金額の上限（400）
10. サロンのタイムゾーン（409。`saleTime` を指定したときだけ）
11. 予約が、ほかの売上で会計されていないこと（409）

取り消し:

1. アクセストークン（401）
2. 操作者の種類（403。顧客、範囲のないアカウント、サロンの `staff`）
3. ID の形式（400）
4. リクエストの本文（400）
5. 売上の存在（404。ほかのサロンの売上も同じ）
6. 売上が取り消されていないこと（409）
7. 返金していない支払いがないこと（409）

レシート:

1. アクセストークン（401）
2. 操作者の種類（403）
3. ID の形式（400）
4. 売上の存在（404。ほかのサロンの売上も同じ）
5. 売上が取り消されていないこと（409）
6. 受け取った金額が、合計金額に達していること（409）

金額の計算:

1. アクセストークン（401）
2. 操作者の種類（403。顧客、範囲のないアカウント）
3. リクエストの本文（400）
4. 本文の `salonId` が操作者のサロンであること（403。`admin` はどのサロンでもよい。存在しないサロンも、操作者のサロンではない）
5. サロンの存在（400。`salonId` の `not_found`。サロンがなければ、ほかの項目は確かめない）
6. 予約とサービスが、サロンのものであること（400。誤りは、まとめて返す）
7. 計算する明細があること（400）
8. 金額の上限（400）

JSON として読めない本文は、ほかのルートと同じく、アクセストークンより前に 400（`code` は `2002`）です。JSON でない `Content-Type` は 415 です。

## 作成リクエストの規則

`SaleCreateRequest` は全項目が必須で、null にできるのは、型に `null` がある項目だけです。表にない項目を書くと 400（`unrecognized_keys`）です。売上番号、会計日、売上の金額、支払い状態、取り消しの項目は、リクエストに書けません（[システムが決める値](#システムが決める値)）。

| 項目 | 型 | 規則 |
|---|---|---|
| `salonId` | `SalonId` | 削除されていないサロン |
| `customerId` | `CustomerId \| null` | 削除されていない顧客。null は、顧客を記録しない売上（顧客登録のない来店、店頭での物販） |
| `staffId` | `StaffId \| null` | 会計の担当スタッフ。`salonId` のサロンの、削除されていないスタッフ。null は「担当を記録しない」 |
| `bookingId` | `BookingId \| null` | `salonId` のサロンの、`customerId` の顧客の予約。null は、予約のない来店 |
| `saleTime` | `utcDateTime` | UTC（`Z`）で、秒まで書く。ミリ秒まで保存する。UTC の日付で 1900-01-01 から 2999-12-31 まで |
| `pointsUsed` | `int32 \| null` | 0 以上、2,147,483,647 以下。`customerId` が null なら null |
| `pointsEarned` | `int32 \| null` | 同上 |
| `notes` | `string \| null` | 空白だけでない |
| `details` | 明細の一覧 | 1 件以上 100 件以下 |
| `details[].itemType` | `string` | 空白だけでない、50 文字以内。`service` と `product` は、`itemId` が指すものを決める。ほかの値（指名料の `fee` など）は、サロンが決める |
| `details[].itemId` | `uuid \| null` | `itemType` が `service` なら `salonId` のサロンの、削除されていないサービス、`product` なら同じく商品。null でもよい。ほかの `itemType` では null |
| `details[].itemName` | `string` | 空白だけでない、255 文字以内 |
| `details[].quantity` | `int32` | 1 以上、2,147,483,647 以下 |
| `details[].unitPrice` | `int32` | 0 以上、2,147,483,647 以下 |
| `details[].discountAmount` | `int32` | 0 以上で、`quantity` × `unitPrice` 以下 |
| `details[].taxAmount` | `int32` | 0 以上、2,147,483,647 以下 |
| `details[].totalAmount` | `int32` | `quantity` × `unitPrice` − `discountAmount` + `taxAmount` |
| `details[].staffId` | `StaffId \| null` | その明細を担当したスタッフ。`salonId` のサロンの、削除されていないスタッフ |
| `details[].commissionRate` | `decimal \| null` | 0 以上 100 以下のパーセントで、小数第 2 位まで |
| `details[].commissionAmount` | `int32 \| null` | 0 以上、2,147,483,647 以下 |
| `details[].notes` | `string \| null` | 空白だけでない |
| `details[].sortOrder` | `int32` | 0 以上で、1 つの売上の中で重ならない |

- 割引（`discountAmount`）は、数量 × 単価から引く金額です。数量 × 単価と同じ金額まで引けます（全額の割引）
- 明細の合計（`totalAmount`）は、クライアントが計算して送り、サーバーが式と合うかを確かめます。合わなければ 400 です（`details.<番号>.totalAmount` の `custom`）。サーバーが黙って直すと、レジが表示した金額と違う売上が残るからです
- 金額のどれかが範囲（0 以上 2,147,483,647 以下）の外にある明細は、範囲のエラーだけを返し、割引と合計の式は確かめません
- `itemType` が `service` でも `product` でもない明細は、`itemId` を持てません（400。`details.<番号>.itemId` の `custom`）。どのテーブルの ID かを決めるものがないからです
- 明細は、`sortOrder` の順に並びます（レシートに載る順）。リクエストに書く順は問いません。値は、連続していなくてもかまいません。同じ値の 2 件目は 400 です（`details.<番号>.sortOrder` の `custom`）
- 売上の担当スタッフ（`staffId`）と明細のスタッフ（`details[].staffId`）は別の項目です。担当スタッフが、どの明細も担当しなくてもかまいません
- ポイントは顧客のものなので、顧客を記録しない売上には書けません（400。`pointsUsed`、`pointsEarned` の `custom`）
- 本文だけで分かる誤りは、1 回の応答ですべて挙げます

### 参照するもの

- 存在しない、削除されている、`salonId` のサロンのものでない、のどれも 400 で、区別しません（`rule` は `not_found`）。`field` は `salonId`、`customerId`、`staffId`、`bookingId`、`details.<番号>.staffId`、`details.<番号>.itemId` です
- 1 回の応答で、見つからなかったものをすべて挙げます。売上の項目が先、明細の項目があとです。サロンが見つからないときは、サロンと顧客だけを挙げます。属するサロンがなければ、スタッフも、予約も、サービスも、商品も探せないからです
- `bookingId` は、`salonId` のサロンの予約で、その顧客が `customerId` と同じでなければなりません。予約がない、ほかのサロンの予約である、ほかの顧客の予約である、売上に顧客がない、のどれも同じ 400 です（`Must name a booking of the salon that is of the customer of the sale`）
- 予約と売上で一致しなければならないのは、サロンと顧客だけです。売上のスタッフや明細が、予約の担当スタッフや施術明細と同じである必要はありません（予約にないものを当日に足す、予約したものを取りやめる）
- サービスの ID を `product` の明細に書くと（その逆も）、見つかりません。`itemType` が、探すテーブルを決めます

## システムが決める値

| カラム | 値 |
|---|---|
| `saleNumber` | [売上番号](#売上番号) |
| `saleDate` | `saleTime` を、サロンのタイムゾーンで表した日付 |
| `subtotal` | 明細の `quantity` × `unitPrice` の合計 |
| `discountAmount` | 明細の `discountAmount` の合計 |
| `taxAmount` | 明細の `taxAmount` の合計 |
| `totalAmount` | `subtotal` − `discountAmount` + `taxAmount`。明細の `totalAmount` の合計と同じ値 |
| `paymentStatus` | `pending` |
| `isVoid`、`voidedAt`、`voidReason` | false、null、null |
| `createdAt`、`updatedAt` | 書いた時点のデータベースの時計 |

- リクエストから行を決めるのは、`business-logic/sale/_shared/plan.ts` の `planSale` です
- `subtotal` か `totalAmount` が `integer` の上限（2,147,483,647）を超える売上は 400 です（`details` の `too_big`）
- 明細の値は、リクエストの値のままです。売上は、明細を入れた時点の名前と金額を持ち、あとでサービスや商品を変えても、売上は変わりません

### 消費税

- 明細の `taxAmount` は、`unitPrice` に加える消費税で、レジが決めた金額です。サーバーは、税率を掛けません。標準税率と軽減税率のどちらか、端数をどう処理するかは、会計の時点でレジが決めます
- 税込の単価で記録するときは、`taxAmount` を 0 にします。`totalAmount` の式は 1 つなので、税込の単価に `taxAmount` を足すと、合計が二重になります。このとき、単価に含まれている消費税の金額は、売上に残りません
- 売上の `taxAmount` は、明細の `taxAmount` の合計です。予約の `taxAmount`（[予約台帳](./bookings.md#消費税)）と同じく、「料金に加える消費税」です
- 売上は、予約の金額を写しません。予約の金額は、予約の時点のサービスの料金から算出した見込みで、売上の金額は、会計した金額です

### 売上番号

- `SL-XXXX-XXXX` の形式です。文字の選び方は、予約番号（[予約台帳](./bookings.md#予約番号)）と同じです。連番にもしません
- すでにある番号と重なったら、別の番号で作り直します（一意制約 `sales_sale_number_unique`）。3 回続けて重なると 500 です
- 番号を作るのは `business-logic/sale/_shared/sale-number.ts` の `saleNumberFrom`、乱数を渡すのは `infrastructure` の `RandomSaleNumberIssuer` です。形式（`business-logic/_shared/record-number.ts` の `recordNumberFrom`）と、番号を採り直す手順（`business-logic/_shared/numbered.ts` の `underFreeNumber`）は、予約番号と共通です

### 会計日とサロンのタイムゾーン

- `saleDate` は、`saleTime` をサロンのタイムゾーン（`salons.timezone`）で表した日付です。日本時間の 0:30 の会計は、UTC では前日でも、会計日はその日です。一覧の `startDate` と `endDate` は、この日付で絞り込みます
- サロンのタイムゾーンが、名前として読めない値だと、会計日を決められません。そのサロンの売上の作成と、`saleTime` を指定した更新は 409 です（`detail` が、サロンのタイムゾーンを直すよう伝える）。規則は、予約の来店日と同じです（[予約台帳](./bookings.md#来店日とサロンのタイムゾーン)）
- 会計日は、売上を入れた時点のタイムゾーンで決まります。あとでサロンのタイムゾーンを変えても、変わりません。更新で `saleTime` を指定したときだけ、その時点のタイムゾーンで決め直します

## 予約の会計は 1 回

- 1 つの予約を指す、取り消していない売上は、1 件までです。2 件目の作成は 409 です（`The booking has a sale that is not void; a booking is billed once`）
- 取り消した売上（`isVoid`）は数えません。売上を取り消すと、その予約の会計を入れ直せます。取り消した売上が何件あっても同じです
- 更新で `bookingId` を変えるときも、同じ規則です。ほかの売上がすでに会計した予約には変えられません（409）。更新する売上そのものは、数えません
- 予約のない売上（`bookingId` が null）は、同じ顧客に何件でも入れられます
- 予約に、来店のあとで追加の会計があるときは、予約のない売上として入れます
- 売上が指している予約は、削除できません（[予約台帳](./bookings.md#削除)。取り消した売上も数える）
- 予約のステータスは問いません。売上の作成は、予約を完了にしません。予約の完了と会計は、別の操作です

## 更新

`PATCH /api/v1/sales/{id}` は、本文（`SaleUpdateRequest`）が指定した項目だけを変えます。項目は、どれも省略できます。1 つも指定しない本文は 400 です（`field` が空の `custom`）。

| 項目 | 型 | 規則 |
|---|---|---|
| `customerId` | `CustomerId \| null` | 削除されていない顧客。null は、顧客を記録しない売上にする |
| `staffId` | `StaffId \| null` | 売上のサロンの、削除されていないスタッフ |
| `bookingId` | `BookingId \| null` | 売上のサロンの予約で、その顧客が、更新後の売上の顧客と同じ。null は、予約から外す |
| `saleTime` | `utcDateTime` | 作成と同じ。指定すると、`saleDate` を、サロンのいまのタイムゾーンで決め直す |
| `pointsUsed`、`pointsEarned` | `int32 \| null` | 0 以上、2,147,483,647 以下 |
| `notes` | `string \| null` | 空白だけでない |
| `details` | 明細の一覧 | 1 件以上 100 件以下。**明細の全体を置き換える**。1 件ずつの規則は、作成と同じ（[作成リクエストの規則](#作成リクエストの規則)） |

- **変えられないもの**: サロン（売上は、ほかのサロンに移らない）、売上番号、会計日（会計日時から決まる）、売上の金額（明細から決まる）、支払い状態、取り消しの項目。本文に書くと 400（`unrecognized_keys`）です
- **取り消した売上は、変えられません**（409）。取り消しの記録だからです
- **明細を変えられるのは、支払い状態が `pending` の売上だけ**です（409）。支払いが始まった売上の金額は、返金と取り消しで扱います。明細でない項目は、支払い状態にかかわらず変えられます
- `details` を指定すると、いまの明細をすべて消して、指定した明細を書き、売上の `subtotal`、`discountAmount`、`taxAmount`、`totalAmount` を、新しい明細から計算し直します。1 件だけを直すときも、残す明細を含めて、全体を送ります。`details` を指定しなければ、明細も金額も変わりません
- `updatedAt` は、書く時点のデータベースの時計（`clock_timestamp()`）です。値が変わらないリクエストでも、書きます（予約台帳の更新と同じ）。`createdAt` は変わりません

### 更新後の売上に確かめること

本文の項目は、1 つずつ作成と同じ規則で確かめます。項目をまたぐ規則は、**更新後の売上**で確かめます。指定しなかった項目は、いまの値で確かめます。

- 顧客を記録しない売上は、ポイントを持ちません。`customerId` を null にして、`pointsUsed` か `pointsEarned` が残るなら 400 です（残る項目の `custom`）。同じリクエストで、ポイントも null にします
- 予約の会計は、予約した顧客への会計です。更新後の売上が予約を指すなら、その予約の顧客は、更新後の売上の顧客でなければなりません
  - `bookingId` を指定したとき、合わなければ 400 です（`bookingId` の `not_found`。予約がない、ほかのサロンの予約である、ほかの顧客の予約である、売上に顧客がない、のどれも同じ）
  - 予約を持つ売上の `customerId` だけを変えると 400 です（`customerId` の `not_found`、`Must name the customer of the booking of the sale`）。顧客を変えるなら、同じリクエストで、`bookingId` を、その顧客の予約にするか、null にします
- 1 つの予約に、取り消していない売上は 1 件です（[予約の会計は 1 回](#予約の会計は-1-回)）

### 更新が参照するもの

- 存在を確かめるのは、**リクエストが指定した ID だけ**です。売上の担当スタッフが、あとで削除されていても、備考や会計日時は直せます。削除されたサロンの売上も、直せます
- 指定した ID は、値がいまと同じでも、確かめます。削除されたスタッフを、もう一度指定すると 400 です。変えない項目は、指定しません
- `details` を指定すると、明細のスタッフ、サービス、商品を、すべて確かめます（明細は、全体が新しい行になる）。あとで削除されたサービスを指す明細を残すには、その明細の `itemId` を null にします
- 見つからないものは、作成と同じく、1 回の応答ですべて挙げます（`customerId`、`staffId`、`bookingId`、`details.<番号>.staffId`、`details.<番号>.itemId` の順）

## 取り消し

`POST /api/v1/sales/{id}/void` は、売上を取り消します。本文（`SaleVoidRequest`）は、`voidReason` だけです（必須。null か、空白だけでない文字列。長さの上限はない）。

- `isVoid` を true に、`voidedAt` と `updatedAt` を、書く時点のデータベースの時計に、`voidReason` を、本文の値にします。明細、金額、支払い状態、予約の参照は、変えません
- 取り消した売上は、取得と一覧に、これまでどおり出ます（`isVoid` が true）。取り消しを絞り込むパラメーターは、ありません
- **取り消した売上は、もう一度取り消せません**（409。最初の取り消しの時刻と理由は変わらない）。取り消しを元に戻すオペレーションは、ありません。会計を入れ直します
- **返金していない支払いがある売上は、取り消せません**（409）。その売上の決済取引（`payment_transactions`）に、ステータスが `completed` か `partial_refund` のものがあるときです。先に返金します。`pending`、`processing`、`failed`、`refunded` の決済取引は、妨げません。確かめるのは、決済取引そのもので、売上の `paymentStatus` ではありません
- 支払いを受け取った売上は、決済取引をすべて全額返金すると、取り消せます（[支払い](./payments.md#返金)）。一部を返金した決済取引（`partial_refund`）は、残りを返金できないので（1 件の決済取引の返金は 1 回）、その売上は取り消せません
- API が書く決済取引は、`completed`、`refunded`、`partial_refund` だけです。`pending`、`processing`、`failed` の決済取引は、データベースに直接書いた行にしかありません
- **取り消すと、その予約は、もう一度会計できます**（[予約の会計は 1 回](#予約の会計は-1-回)）。取り消した売上は、予約を指したままです。その予約は、削除できないままです（[予約台帳](./bookings.md#削除)）

## レシート

`GET /api/v1/sales/{id}/receipt` は、支払いを受け取った売上のレシートを作って返します（`SaleReceiptResponse`）。

- **レシートは、保存しません**。リクエストのたびに、その時点の売上から作ります。レシートのテーブルはなく、何も書きません。再発行も、同じリクエストです
- `receiptNumber` は、売上番号（`saleNumber`）です。レシートごとの番号は振りません。同じ売上のレシートは、何度作っても同じ番号です
- `sale` は、1 件の取得と同じ売上です（明細と支払いを含む。[1 件の取得と一覧](#1-件の取得と一覧)）
- `issuedAt` は、レシートを作った時刻です（アプリケーションの時計。ミリ秒までの UTC）。リクエストのたびに変わります
- **レシートを作るのは、取り消していない売上で、受け取った金額が合計金額（`totalAmount`）に達しているものだけです**。それ以外は 409 で、`detail` が理由を伝えます。取り消した売上は、支払いがあってもなくても、取り消しを理由にします
- 受け取った金額は、ステータスが `completed`、`partial_refund`、`refunded` の決済取引の `amount` の合計です（[支払い](./payments.md#売上の支払い状態)）。`pending`、`processing`、`failed` の決済取引は数えません。返金は差し引かないので、全額を受け取ったあとに返金した売上も、レシートを作れます。返金の金額と時刻は、`sale.payments` にあります
- 確かめるのは決済取引そのもので、売上の `paymentStatus` ではありません
- 合計金額が 0 の売上は、支払いがなくても、レシートを作れます
- インボイス（適格請求書）の記載事項のうち、サロンの登録番号と、税率ごとの対価の額と消費税額は、レシートにありません。サロンに登録番号のカラムがなく、明細の消費税は、レジが決めた金額で、税率を持たないからです（[消費税](#消費税)）
- レシートは、1 件の取得と同じく、読み取り専用のトランザクションで読み、ロックを待ちません

## 金額の計算

`POST /api/v1/sales/calculate` は、売上を入れる前に、会計の金額を計算して返します（`SaleCalculateResponse`）。何も書きません。

| 項目 | 規則 |
|---|---|
| `salonId` | サロンの ID。税率と支払い方法は、このサロンのもの |
| `bookingId` | null か、サロンの予約の ID。予約のない来店は null |
| `services` | 予約の施術明細に加えるサービスの ID の配列（0〜100 件）。同じ ID を何度書いても、書いた数だけ数える |

- 3 つの項目は、すべて必須です（キーを省くと 400）。表にない項目は 400 です（`unrecognized_keys`）
- 計算する明細は、予約の施術明細（`booking_services`）と、`services` のサービスです
  - 予約の施術明細は、予約のときに写した金額（`price`、`discountAmount`、`finalPrice`、`taxIncluded`）で数えます。あとでサービスの料金を変えても、予約の金額は変わりません
  - 加えるサービスは、いまのメニューの金額で数えます。`discountPrice` があれば、`price` − `discountPrice` が割引です。税込かどうか（`taxIncluded`）も、サービスのものです
- 金額は、予約の金額と同じ規則で出します（[予約台帳](./bookings.md#消費税)。同じ関数）。`subtotal` は明細の `price` の合計、`discountAmount` は割引の合計、`taxAmount` は、税込でない明細の割引後の金額の合計に、サロンのいまの税率（`salons.taxRate`）を掛けて、1 円未満を切り捨てた金額です。**消費税は、明細ごとではなく、合計に 1 回だけ掛けます**（適格請求書の端数処理が、税率ごとに 1 回であるのと同じ）。`totalAmount` は `subtotal` − `discountAmount` + `taxAmount` です
- `breakdown` の項目名は、売上（`sales`）のカラム名と同じです
- `recommendedMethods` は、1 回の支払いで合計金額を受け取れる支払い方法の種類です。サロンの支払い方法のうち、使っていて（`isActive`）、合計金額が下限（`minimumAmount`）以上、上限（`maximumAmount`）以下のものの `method` を、`sortOrder` と ID の順に、同じ種類は 1 回だけ並べます。合計金額が 0 なら空です（受け取る支払いがない）。`isOnlineEnabled` と `isOfflineEnabled` は見ません（[支払い](./payments.md#支払い方法はサロンの設定)）
- 次のものは、確かめません: 予約のステータス（キャンセルした予約も計算できる）、サービスの `isActive`、予約の顧客。予約がまだ会計されていないかどうかも、確かめません。それは、売上の作成が確かめます
- 400 になるのは、次のときです
  - サロンが存在しないか、削除されている（`salonId` の `not_found`）。サロンがなければ、予約とサービスは確かめません
  - 予約が、サロンのものでない（`bookingId` の `not_found`）
  - サービスが、サロンのものでないか、削除されている（`services.0` のように、何番目かを含む `not_found`）。予約とサービスの誤りは、まとめて返します
  - 予約に施術明細がなく、`services` も空（`services` の `too_small`）。予約がなく、`services` が空のときも同じです
  - 小計か合計金額が `integer` の上限（2,147,483,647）を超える（`services` の `too_big`）
- コントラクトにあった割引コード（`discountCode`）、利用するポイント（`pointsToUse`）、顧客（`customerId`）、備考（`notes`）と、ポイントの値引き（`pointsDiscount`）は、なくしました。割引コードを持つテーブルはなく、ポイント 1 点が何円かも決まっていません。顧客と備考は、金額を変えません。ポイントで支払うときは、種類が `point` の支払い方法で記録します（[支払い](./payments.md)）
- 計算は、1 つの読み取り専用のトランザクション（`REPEATABLE READ`）で、サロン、予約の施術明細、サービス、支払い方法を読みます。ロックは取らず、ほかの書き込みを待ちません。書いている途中の変更は数えず、コミットされた値で計算します

## 1 件の取得と一覧

- `details` は、明細を `sortOrder` の順に並べたものです
- `payments` は、その売上の支払いを、作成された順（`createdAt`。同じなら `id`）に並べたものです。決済代行会社の応答（`processorResponse`）とメタデータ（`metadata`）は、返しません
- 日時は UTC で、ミリ秒までの ISO 8601 形式です（`2026-11-20T03:40:00.000Z`）。`commissionRate` は数値です（`12.5`）
- 一覧の並びは、会計日時（`saleTime`）の新しい順、同じ値の中では `id` の降順です
- 一覧は、取り消した売上も返します。台帳は、取り消しも記録として持つからです
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後の売上の ID です。操作者に見えない売上や、売上でない ID を指す `cursor` は 400 です（`cursor` の `not_found`）
- `meta.total` は、絞り込みに一致する売上の件数です
- サロンのユーザーが `salonId` を指定しなければ、所属サロンの売上だけを返します。ほかのサロンの `salonId` を指定すると 403 です
- 絞り込みは、すべて AND で結合します

| パラメーター | 一致する売上 |
|---|---|
| `salonId` | そのサロンの売上 |
| `customerId` | その顧客への売上（顧客の支払い履歴）。顧客を記録していない売上は、どの顧客にも一致しない |
| `bookingId` | その予約を指す売上。取り消した売上も含む |
| `paymentStatus` | 支払い状態が一致する |
| `startDate` / `endDate` | 会計日（`saleDate`）がその日以降 / 以前（両端を含む）。`startDate` が `endDate` より後なら 400（`endDate` の `custom`）。どちらも 1900-01-01 から 2999-12-31 まで |

- `customerId` や `bookingId` に、存在しない ID を指定しても、エラーにはしません。一致する売上がないだけです
- スタッフでの絞り込みは、ありません（表にないパラメーターは 400）
- 保存されている行が API のモデルに合わないときは 500（データベースのエラー）です。読み出すときに検証します（`mappers/read/sale.mapper.ts`）
- 売上、明細、支払いは、同じ時点のものを返します。取得も一覧も、1 つの読み取り専用のトランザクション（`REPEATABLE READ`）で読みます。支払いの記録と返金は、決済取引と売上の支払い状態を 1 つのトランザクションで書くので、「支払い状態は完了で、支払いがない」という組み合わせは返りません

## 同時に届いたリクエスト

| 状況 | 結果 |
|---|---|
| 同じ予約の会計が、同時に何件も届く | 1 件が 201 で、ほかは 409。売上は 1 件 |
| 同じ顧客の別々の予約の会計が、同時に届く | すべて 201。売上番号は重ならない |
| 同じ顧客、同じスタッフの、予約のない売上が、同時に何件も届く | すべて 201。互いを待たない |
| 予約の会計を書いている途中に、同じ予約の会計が届く | 先の売上が書き終わるのを待ち、409 |
| 予約の削除が進んでいる途中に、その予約の会計が届く | 削除が終わるのを待ち、400（`bookingId` の `not_found`）。何も保存しない |
| 予約の会計を書いている途中に、その予約の削除が届く | 削除は、売上が書き終わるのを待ち、409（[予約台帳](./bookings.md#同時に届いたリクエスト)） |
| サロン、顧客、スタッフの削除が進んでいる途中に、それを指す売上が届く | 削除が終わるのを待ち、400（`not_found`）。何も保存しない |
| 売上と予約の作成が、同じ 2 人のスタッフを指して、同時に届く | どちらも成功する。互いを待ち続けることはない |
| 同じ売上の取り消しが、同時に何件も届く | 1 件が 200 で、ほかは 409 |
| 同じ売上の更新が、同時に何件も届く | 1 件ずつ処理して、すべて 200。指定した項目が別々なら、すべての変更が残る。明細の置き換えが重なると、最後の 1 件の明細と、その金額が残る |
| 同じ売上の更新と取り消しが、同時に届く | 取り消しは 200。更新は、先に処理されれば 200、あとなら 409 |
| 別々の売上を、同じ予約に変える更新が、同時に届く | 1 件が 200 で、ほかは 409 |
| 売上を予約に変える更新と、その予約の会計の作成が、同時に届く | どちらか 1 件が成功し、もう 1 件は 409 |
| 決済取引を書いている途中に、その売上の取り消しが届く | 決済取引が書き終わるのを待ち、それを数えて判定する |
| 支払いの記録と、その売上の取り消しが、同時に届く | 支払いが 200 で取り消しが 409 か、取り消しが 200 で支払いが 409 |
| 同じ売上の支払いの記録が、同時に何件も届く | 1 件ずつ処理する。受け取った合計は、合計金額を超えない（[支払い](./payments.md#支払いの記録と返金)） |
| 予約の削除が進んでいる途中に、売上をその予約に変える更新が届く | 削除が終わるのを待ち、400（`bookingId` の `not_found`） |
| 売上、決済取引、予約、サービス、支払い方法、サロンを書いている途中に、レシートや金額の計算が届く | 待たない。コミットされた値で作る |
| 売上を予約に変える更新と、その予約の削除が、同時に届く | 更新が 200 で削除が 409 か、削除が 204 で更新が 400。互いを待ち続けることはない |

売上の作成は、1 つのトランザクションです（`SaleRepository.create`。分離レベルは `READ COMMITTED`）。

1. `bookingId` があれば、予約の行を排他ロック（`FOR UPDATE`）して読みます。同じ予約の会計は、ここで 1 件ずつになります。次の文で、その予約を指す、取り消していない売上を探します。ロックと同じ文で探すと、ロックを待つ前のスナップショットで探すことになり、待っている間に書かれた売上が見えません
2. サロン、顧客、スタッフ（売上の担当スタッフと、明細のスタッフ。1 つの問い合わせで、ID の順）の行を `FOR KEY SHARE` でロックして読みます。売上と明細の行を書くときに、外部キーの確認が取るのと同じロックです。先に、決まった順で取っておきます
3. サービスと商品の行を読みます。ロックはしません。明細は、サービスや商品を外部キーで指さず、名前と金額をリクエストから持つので、待つ理由がありません
4. `planSale` が、参照するものを確かめて、書く行を決めます。断るときは、何も書かずに終わります
5. 売上と明細を書きます。売上番号が、すでにある番号と重なったときは、何も書かずに終わり、ユースケースが別の番号でやり直します

ロックの順は、予約、サロン、顧客、スタッフです。予約台帳の書き込みが行をロックする順（予約、サロン、顧客、サービス、スタッフ。[予約台帳](./bookings.md#同時に届いたリクエスト)）と同じ向きなので、売上と予約のどの書き込みを組み合わせても、同じ行を逆の順にロックすることはなく、デッドロックになりません。外部キーの確認に任せると、行を書く順（売上の担当スタッフ、次に明細のスタッフ）でロックすることになり、スタッフを ID の順に排他ロックする予約の作成と、逆の順になることがあります。

サロン、顧客、スタッフの削除は、削除する行を排他ロックします（`FOR UPDATE`）。`FOR KEY SHARE` とは両立しないので、売上を書いている途中の削除は、売上を待ちます。売上は、削除を妨げません（妨げるのは、終わっていない予約だけ）。削除されたものを指す売上は、そのまま残り、取得は、保存されている ID を返します。

### 更新と取り消し

更新（`SaleRepository.update`）と取り消し（`SaleRepository.voidSale`）も、1 つのトランザクションです（`READ COMMITTED`）。

1. **売上の行を排他ロック（`FOR UPDATE`）して読みます**。同じ売上の更新と取り消しは、ここで 1 件ずつになります。待っていたリクエストは、先のリクエストが書いたあとの売上を読みます。サロンのタイムゾーンは、同じ文で読みます（サロンの行はロックしない）
2. 取り消しは、次の文で、その売上の決済取引を読み、取り消せるかを決めて（`refusalOfVoid`）、売上を書きます
3. 更新は、取り消した売上と、支払いが始まった売上の明細を断り（`refusalOfChange`）、リクエストが指定したものだけを、作成と同じ順でロックして読みます
   - 予約: リクエストが `bookingId` か `customerId` を指定して、更新後の売上が予約を指すとき、その予約の行を排他ロックし、次の文で、その予約を指す、取り消していない、**ほかの**売上を探します（`bookingToHold`）。どちらも指定しない更新は、予約をロックしません
   - 顧客と、スタッフ（ID の順）: `FOR KEY SHARE`
   - サービスと商品: ロックしない
4. `planSaleChange` が、更新後の売上を確かめて、書く値を決めます。断るときは、何も書かずに終わります
5. 売上を書きます。`details` を指定していれば、明細をすべて消して、新しい明細を書きます
6. 変えたあとの売上を、明細、支払いと一緒に読んで返します

売上の行のロックを `FOR UPDATE` にしているのは、決済取引の外部キーの確認（`FOR KEY SHARE`）と両立しないロックだからです。決済取引を書いている途中のトランザクションがあれば、取り消しは、それを待ってから決済取引を読みます。売上をロックしている間は、その売上の決済取引は増えません。支払いの記録と返金も、最初に同じロックを取ります（[支払い](./payments.md#支払いの記録と返金)）。売上の行をロックして読む処理は、`backend/packages/infrastructure/src/repositories/held-sale.ts` の `heldSaleOf` です。

**ロックの順は、売上、予約、サロン、顧客、サービス、スタッフ、支払い方法です**。売上の行を先にロックするのは、更新、取り消し、支払いの記録、返金だけです。支払いの記録は、売上のあとに、支払い方法の行だけをロックします。支払い方法の更新と削除は、支払い方法の行のほかを、ロックしません。予約、顧客、スタッフの行を先にロックする操作（売上の作成、予約台帳の書き込み、顧客やスタッフの削除）は、すでにある売上の行をロックしません。予約の削除は、予約を指す売上があれば、削除を試みる前に 409 で終わるので、外部キーの確認が売上の行を待つこともありません。同じ行を逆の順にロックする組み合わせは、ありません。

取得、一覧、レシート、金額の計算は、ロックを待ちません。

## DB の制約

マイグレーション `202611160700_sales_rules.sql` で、次のようにしました。

- 既定値をなくした（NULL 可のまま）: `sales.pointsUsed`、`pointsEarned`（以前は 0）。記録していないポイントは NULL です
- `sales` の CHECK 制約: 金額とポイントは 0 以上（`sales_amounts_not_negative`）、`discountAmount` は `subtotal` 以下（`sales_discount_within_subtotal`）、`totalAmount` = `subtotal` − `discountAmount` + `taxAmount`（`sales_total_is_the_sum`）、`isVoid` と、`voidedAt` が NULL でないことが一致する（`sales_void_has_time`）、`voidReason` は取り消した売上にだけある（`sales_void_reason_of_void`）、顧客のない売上にポイントはない（`sales_points_need_customer`）
- `sales_details` の CHECK 制約: `quantity` は 1 以上（`sales_details_quantity_positive`）、金額は 0 以上（`sales_details_amounts_not_negative`）、`discountAmount` は `quantity` × `unitPrice` 以下（`sales_details_discount_within_price`）、`totalAmount` = `quantity` × `unitPrice` − `discountAmount` + `taxAmount`（`sales_details_total_is_the_sum`）、`commissionRate` は 0 以上 100 以下（`sales_details_commission_rate_is_a_percentage`）、`itemId` があるのは `itemType` が `service` か `product` の明細だけ（`sales_details_item_of_a_known_type`）、`sortOrder` は 0 以上（`sales_details_sort_order_not_negative`）。数量 × 単価は `bigint` で計算します（2 つの `integer` の積は、`integer` に収まるとは限らない）
- 一意制約: 1 つの売上の中で `sortOrder` は重ならない（`sales_details_order_unique`）
- 部分一意インデックス: 1 つの予約を指す、取り消していない売上は 1 件（`sales_booking_live_unique`。`bookingId` に、`NOT "isVoid"` の条件付き）。作成のトランザクションが予約の行のロックで保証している規則を、テーブルでも保証します
- インデックス: `sales` の `(salonId, saleTime, id)`（`idx_sales_salon_time`。サロンの売上を一覧の順に読む）。`salonId` だけのインデックス（`idx_sales_salon_id`）を置き換えた

以前の行は、直しません。これまで、この 2 つのテーブルに書くオペレーションはなく、手で書かれた行が規則に違反していても、どの金額が正しいかを決められないからです。違反する行があると、マイグレーションは失敗します。行を直してから、やり直します。

更新と取り消しのために、スキーマは変えていません。取り消しの項目の制約（`sales_void_has_time`、`sales_void_reason_of_void`）と、予約の一意インデックス（`sales_booking_live_unique`）は、作成のときからあります。

売上の金額が明細の合計と合っていることは、制約では保証しません（2 つのテーブルにまたがる）。売上と明細を 1 つのトランザクションで書く `planSale` と `planSaleChange` が保証します。明細の `itemId` と、サービスや商品の間に外部キーはありません（`itemType` によって、指すテーブルが変わる）。

## シード

`pnpm db:seed` は、売上を入れません。売上が指せるもの（サロン、顧客、スタッフ、サービス、商品、予約）は入れるので、シードのデータで、売上を作成できます。予約には施術明細があるので、金額を計算することもできます。支払い方法（`payment_methods`）もシードにあるので、作成した売上に、支払いを記録できます（[支払い](./payments.md)）。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/payment.tsp`、`specs/operations/payment-operations.tsp`（`SaleCrud`） |
| ドメイン | `backend/packages/domain/src/models/sale.ts`、`schemas/sale.schema.ts`、`mappers/read/sale.mapper.ts`（決済取引は `mappers/read/payment.mapper.ts`）、`repositories/sale.repository.ts`、`services/sale-number-issuer.ts`、`business-logic/sale/`（誰がどの売上に届くかは `_shared/authorization.ts`、リクエストから書く行を決めるのは `_shared/plan.ts`、更新が書く値と、更新と取り消しを断る理由を決めるのは `_shared/change.ts`、レシートを断る理由は `_shared/receipt.ts`、金額の計算は `_shared/calculation.ts`、売上番号は `_shared/sale-number.ts`、リポジトリが断った理由をエラーに直すのは `_shared/refusals.ts`）。Write マッパーはない（書く行は `planSale` が決める） |
| ドメイン（共通） | `backend/packages/domain/src/business-logic/_shared/amounts.ts`（明細から小計、割引、消費税、合計を出す。予約と共有する）、`business-logic/_shared/record-number.ts`（番号の形式）、`business-logic/_shared/numbered.ts`（番号を採り直す手順）、`schemas/rules.ts`（`inTimeZone`、`momentInUtc`）、`models/booking.ts` の `LedgerReach` と `business-logic/booking/_shared/authorization.ts` の `isWithin`（台帳に届く範囲） |
| インフラ | `backend/packages/infrastructure/src/repositories/sale.repository.impl.ts`、`repositories/held-sale.ts`（売上の行のロック。支払いの記録、返金と共有する）、`security/random-sale-number-issuer.ts` |
| API | `backend/packages/api/src/routes/sale/`（`/api/v1/sales` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611160700_sales_rules.sql` |
| テスト | `backend/packages/domain/src/__tests__/sale.schema.test.ts`、`sale.plan.test.ts`、`sale.change.test.ts`、`sale.receipt.test.ts`、`sale.calculation.test.ts`、`sale.mapper.test.ts`、`sale.usecase.test.ts`、`sale.receipt-calculation.usecase.test.ts`、`backend/packages/api/src/__tests__/sale.integration.test.ts`（作成、取得、一覧）、`sale-changes.integration.test.ts`（更新、取り消し）、`sale-receipt-calculation.integration.test.ts`（レシート、金額の計算）、`backend/packages/api/src/routes/sale/_shared/__tests__/` |
