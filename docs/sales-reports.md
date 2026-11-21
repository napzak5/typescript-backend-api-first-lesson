# 売上レポート

サロンの売上を、期間、日、スタッフ、サービスのカテゴリー、支払い方法の種類ごとに数えるレポートと、期間の売上を日ごとに並べた CSV ファイルの規則をまとめます。コントラクトは `specs/operations/payment-operations.tsp`（`SalesReportCrud`）と `specs/models/payment.tsp` です。

レポートは、サロンを運営する人のためのものです。管理者と、サロンの `owner` / `manager` が `/api/v1/sales-reports` で読みます。

レポートは、リクエストのたびに、売上台帳の行（`sales`、`sales_details`、`payment_transactions`）から数えます。何も書かず、どこにも保存しません。売上と支払いの規則は、[売上台帳](./sales.md) と [支払い](./payments.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 期間のレポート、1 日の売上、スタッフ別、カテゴリー別、推移、出力（`SalesReportCrud` の `get`、`getDaily`、`getByStaff`、`getByCategory`、`getTrends`、`export`） | 実装済み |

- 出力は、期間の売上を日ごとに並べた CSV ファイルだけです（[出力](#出力)）
- 画面は、dashboard-app の売上レポートの画面です（期間のレポートと、その出力、推移、1 日の売上。[売上レポートの画面](./frontend-api-integration.md#売上レポートの画面)）。スタッフ別、カテゴリー別の画面は、まだありません
- 次のものは、ありません
  - Excel と PDF のファイル。出力したファイルの保存と、ダウンロード URL
  - スタッフ別、カテゴリー別、支払い方法別の CSV
  - 前の期間や前年との比較
  - 顧客別、時間帯別、予約の経路別、商品別の集計
  - スタッフの歩合（`commissionAmount`）の集計
  - 顧客満足度。以前のコントラクトのスタッフ別の行にありましたが、売上に、満足度を記録する列がないので、削除しました
  - 集計を保存すること。[集計を保存しない理由](#集計を保存しない理由) を見てください

## オペレーションと権限

| オペレーション | ルート | クエリ |
|---|---|---|
| 期間のレポート | `GET /api/v1/sales-reports` | `salonId`、`startDate`、`endDate` |
| 1 日の売上 | `GET /api/v1/sales-reports/daily` | `salonId`、`date` |
| スタッフ別 | `GET /api/v1/sales-reports/by-staff` | `salonId`、`startDate`、`endDate` |
| カテゴリー別 | `GET /api/v1/sales-reports/by-category` | `salonId`、`startDate`、`endDate` |
| 推移 | `GET /api/v1/sales-reports/trends` | `salonId`、`startDate`、`endDate`、`period` |
| 出力（CSV） | `GET /api/v1/sales-reports/export` | `salonId`、`startDate`、`endDate` |

- すべてのオペレーションに認証が要ります。許可は、6 つとも同じです: `admin` はすべてのサロン、サロンの `owner` と `manager` は所属サロン（`business-logic/sales-report/_shared/authorization.ts` の `salesReportReachOf`）
- **サロンの `staff` は 403 です**。売上台帳は、レジに立つスタッフも扱いますが（[売上台帳](./sales.md#オペレーションと権限)）、レポートは、サロン全体の売上と、スタッフ一人ひとりの売上を見せる、経営の情報だからです
- 顧客のアカウントと、ロールに必要なレコードを持たないユーザー（範囲 `none`）も 403 です。この 403 は、クエリを確かめる前に返します
- **ほかのサロンを指定した `owner` / `manager` は、サロンが存在するかどうかにかかわらず 403 です**。サロンを探す前に、権限を確かめます
- 存在しないサロンと、削除済みのサロンは 400 です（`salonId` の `not_found`、`message` は `Must name a salon`）。サロンは、パスではなくクエリで指定するので、クエリの誤りとして返します（売上の金額の計算の `salonId` と同じ。[売上台帳](./sales.md#金額の計算)）
- `salonId` は、英字を大文字で書いても同じ ID です。レスポンスの `salonId` は小文字です

### 確認の順序

1. アクセストークン（401）
2. 操作者が、レポートを読めること（403）
3. クエリ（400）
4. 操作者が、クエリのサロンのレポートを読めること（403）
5. サロンの存在（400。`salonId` の `not_found`）

400 の `detail` は、期間のレポート、スタッフ別、カテゴリー別、出力では `Invalid sales report`、1 日の売上では `Invalid daily sales`、推移では `Invalid sales trends` です。

## クエリの規則

| パラメーター | 形式 | 規則 |
|---|---|---|
| `salonId` | UUID | 必須 |
| `startDate`、`endDate` | `YYYY-MM-DD` | 必須。会計日（`saleDate`）が `startDate` 以降、`endDate` 以前（両端を含む）の売上を数える |
| `date` | `YYYY-MM-DD` | 1 日の売上だけ。必須 |
| `period` | `daily`、`weekly`、`monthly` | 推移だけ。必須 |

- **既定値はありません**。期間を省くと 400 です（`invalid_type`。`period` は `invalid_value`）。「今月」や「今日」は、サロンのタイムゾーンで、クライアントが日付にして渡します
- `endDate` が `startDate` より前なら 400 です（`endDate` の `custom`、`message` は `Must not be earlier than startDate`）
- 期間は、両端を含めて 366 日までです。それより長いと 400 です（`endDate` の `custom`、`message` は `Must be within 366 days of startDate, both included`）。うるう年の 1 年は、ちょうど 366 日です。日数は暦の日で数えるので、サマータイムの切り替わりにも影響されません
- 存在しない日付（`2026-02-29` など）と、時刻を含む値は 400 です（`invalid_format`）。1900-01-01 より前の日付と 2999-12-31 より後の日付も 400 です（`too_small`、`too_big`。[リクエストの日付と日時の範囲](./api-db-type-constraints-mapping.md#リクエストの日付と日時の範囲)）。このどれかに当たる日付があるときは、期間の前後と長さを確かめません
- コントラクトにないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回指定しても 400 です（`invalid_type`）
- 期間は、売上の会計日で決まります。会計日は、売上を入れた時点のサロンのタイムゾーンの日付です（[売上台帳](./sales.md#会計日とサロンのタイムゾーン)）

## 数える売上

- レポートが数えるのは、クエリのサロンの、会計日が期間内の、**取り消していない売上**です。取り消した売上は、その明細と支払いも含めて、どの値にも入りません
- **支払いがまだの売上も、数えます**。売上は、売った記録だからです。支払い方法ごとの値（`salesByMethod`）だけは、受け取った支払いを数えます
- レポートは、そのときの台帳から数えます。売上をあとで直すと、直した後の値で数え、あとで取り消すと、その売上は数えなくなります。同じ期間のレポートでも、読む時点によって変わります
- 明細の名前と金額は、売上を入れた時点の値です（[売上台帳](./sales.md#システムが決める値)）。サービスのカテゴリーとスタッフの名前だけは、いまの値で数えます（[カテゴリー別](#カテゴリー別)、[スタッフ別](#スタッフ別)）

## 期間のレポート

`GET /api/v1/sales-reports` は、期間の売上を 1 つのレポートにします。

| プロパティ | 値 |
|---|---|
| `salonId`、`startDate`、`endDate` | クエリの値 |
| `totalSales` | 売上の `totalAmount`（消費税を含み、値引きを引いた額）の合計 |
| `totalTax` | 売上の `taxAmount` の合計 |
| `totalDiscounts` | 売上の `discountAmount` の合計 |
| `totalRefunds` | 売上の決済取引の `refundAmount` の合計 |
| `netSales` | `totalSales` − `totalRefunds` |
| `transactionCount` | 売上の件数 |
| `averageTransactionValue` | `totalSales` ÷ `transactionCount`（1 円未満を切り捨て）。売上がなければ 0 |
| `salesByMethod` | [支払い方法別](#支払い方法別) |
| `salesByCategory` | [カテゴリー別](#カテゴリー別) |
| `topStaff` | [スタッフ別](#スタッフ別) の、先頭の 5 人 |

- **返金は、売上の会計日で数えます**。返金した日ではありません。11 月の売上を 12 月に返金すると、11 月のレポートの `totalRefunds` に入ります
- 売上がない期間は、すべての値が 0、行の配列が空のレポートです
- `totalSales` と、支払い方法別の金額の合計は、一致しないことがあります。まだ受け取っていない額（支払いがまだの売上と、一部だけを受け取った売上の残り）は、支払い方法別に入らず、返金は、支払い方法別では金額から引くからです

### 支払い方法別

`salesByMethod` は、売上の決済取引のうち、受け取ったもの（`completed`、`partial_refund`、`refunded`）を、支払い方法の種類（`payment_methods.method`）ごとにまとめます。

| プロパティ | 値 |
|---|---|
| `method` | 支払い方法の種類 |
| `amount` | 決済取引の `amount` − `refundAmount` の合計。サロンの手元に残った額 |
| `count` | 決済取引の件数。全額を返金した決済取引も数える |
| `percentage` | すべての種類の `amount` の合計に対する割合（%） |

- 受け取っていない決済取引（`pending`、`processing`、`failed`）は、数えません
- 同じ種類の支払い方法が、サロンに 2 件以上あれば、合わせて 1 行です
- 並びは、`amount` の大きい順、同じなら種類の名前の順です

## 1 日の売上

`GET /api/v1/sales-reports/daily` は、1 日（`date`）の売上を返します。期間が 1 日のレポートと同じ売上を数えます。

| プロパティ | 値 |
|---|---|
| `date` | クエリの値 |
| `sales` | 売上の `totalAmount` の合計 |
| `transactions` | 売上の件数 |
| `refunds` | 売上の決済取引の `refundAmount` の合計 |
| `net` | `sales` − `refunds` |

売上がない日は、すべて 0 です。

## スタッフ別

`GET /api/v1/sales-reports/by-staff` は、期間の売上の明細を、スタッフごとにまとめます。期間のレポートの `topStaff` は、この先頭の 5 人です。

| プロパティ | 値 |
|---|---|
| `staffId` | スタッフ |
| `displayName` | スタッフのいまの表示名 |
| `totalSales` | そのスタッフの明細の `totalAmount` の合計（サービスと商品） |
| `serviceCount` | そのスタッフのサービスの明細（`itemType` が `service`）の `quantity` の合計 |
| `averageServiceValue` | サービスの明細の `totalAmount` の合計 ÷ `serviceCount`（1 円未満を切り捨て）。サービスの明細がなければ 0 |

- 明細は、明細の担当スタッフ（`sales_details.staffId`）のものです。明細に担当スタッフがなければ、売上の担当スタッフ（`sales.staffId`）のものです。どちらもない明細は、どのスタッフにも入りません
- 削除したスタッフと、無効にしたスタッフも入ります。売上は、その人が売った記録だからです
- 明細の `totalAmount` は消費税を含み、明細の値引きを引いた額です。売上の `totalAmount` は明細の `totalAmount` の合計なので（[売上台帳](./sales.md#システムが決める値)）、スタッフ別の合計は、担当スタッフのない明細を除いた、期間の `totalSales` と同じです
- すべてのスタッフを返します（ページングはない）。並びは、`totalSales` の大きい順、同じならスタッフの ID の順です

## カテゴリー別

`GET /api/v1/sales-reports/by-category` は、期間の売上のサービスの明細（`itemType` が `service`）を、サービスのカテゴリーの種類（`service_categories.category`）ごとにまとめます。期間のレポートの `salesByCategory` と同じです。

| プロパティ | 値 |
|---|---|
| `category` | カテゴリーの種類 |
| `amount` | 明細の `totalAmount` の合計 |
| `count` | 明細の `quantity` の合計 |
| `percentage` | すべての種類の `amount` の合計に対する割合（%） |

- カテゴリーは、**サービスがいま属しているもの**です。サービスを別のカテゴリーに移すと、過去の売上も、移した先で数えます。明細は、売った時点のカテゴリーを持たないからです
- カテゴリーのないサービスの明細と、サービスを指さない明細（`itemId` が null）は、`other` です
- 同じ種類のカテゴリーが、サロンに 2 つ以上あれば、合わせて 1 行です。カテゴリーの名前ごとの集計は、ありません
- 商品の明細は、入りません
- 並びは、`amount` の大きい順、同じなら種類の名前の順です

## 推移

`GET /api/v1/sales-reports/trends` は、期間の売上を、`period` の単位で区切った配列で返します。

| `period` | 区切り | ラベル |
|---|---|---|
| `daily` | 日 | その日（`YYYY-MM-DD`） |
| `weekly` | 月曜日から日曜日までの週 | その週の月曜日（`YYYY-MM-DD`） |
| `monthly` | 月 | その月（`YYYY-MM`） |

| プロパティ | 値 |
|---|---|
| `labels` | 区切りのラベル。古い順 |
| `sales` | 区切りごとの、売上の `totalAmount` の合計 |
| `transactions` | 区切りごとの、売上の件数 |
| `average` | 区切りごとの `sales` ÷ `transactions`（1 円未満を切り捨て）。売上がなければ 0 |

- 4 つの配列は、同じ長さで、同じ位置が同じ区切りです
- 期間にかかるすべての区切りを返します。売上のない区切りは 0 です
- **最初と最後の区切りは、期間内の日だけを数えます**。水曜日から始まる期間の最初の週は、その週の月曜日のラベルで、水曜日からの売上の合計です。月曜日のラベルが、`startDate` より前の日付になることがあります
- 週は、ISO 8601 の週（月曜日始まり）です。年をまたぐ週は、月曜日の年のラベルです

## 出力

`GET /api/v1/sales-reports/export` は、期間の売上を、1 日を 1 行にした CSV ファイルで返します。会計ソフトや表計算ソフトに取り込むためのものです。クエリ、権限、確認の順序、数える売上は、期間のレポートと同じです。

```csv
date,sales,tax,discounts,transactions,refunds,net
2026-11-19,0,0,0,0,0,0
2026-11-20,19800,1800,0,2,3000,16800
2026-11-21,7700,700,1000,2,2200,5500
```

| 列 | 値 |
|---|---|
| `date` | 会計日（`YYYY-MM-DD`） |
| `sales` | その日の売上の `totalAmount` の合計 |
| `tax` | その日の売上の `taxAmount` の合計 |
| `discounts` | その日の売上の `discountAmount` の合計 |
| `transactions` | その日の売上の件数 |
| `refunds` | その日の売上の決済取引の `refundAmount` の合計 |
| `net` | `sales` − `refunds` |

- 期間の**すべての日**を、古い順に 1 行ずつ載せます。売上のない日も、0 の行です。期間は 366 日までなので、行も 366 行までです
- 1 日の行は、[1 日の売上](#1-日の売上) の値に、`tax` と `discounts` を加えたものです。**列ごとの合計は、同じ期間のレポートの `totalSales`、`totalTax`、`totalDiscounts`、`transactionCount`、`totalRefunds`、`netSales` と一致します**。返金は、ほかのレポートと同じく、売上の会計日の行に入ります
- 合計の行は、ありません。表計算ソフトで合計すると二重になり、取り込むときに日付でない行が混じるからです
- 1 行目は列名です。列名は、レポートのプロパティ名に合わせた英語です。値は日付と整数だけなので、引用符で囲む値はなく、ファイルは ASCII の文字だけです。Shift_JIS で開く表計算ソフトでも、文字化けしません
- 文字コードは UTF-8（BOM なし）、改行は CRLF です（RFC 4180）。最後の行も CRLF で終わります
- レスポンスの本文が、ファイルそのものです。`Content-Type` は `text/csv; charset=utf-8`、`Content-Disposition` は `attachment; filename=sales-report-<startDate>-<endDate>.csv` です。名前はトークンの文字だけなので、引用符は付きません（RFC 6266）。`data`、`meta`、`links` の包みは、ありません
- エラーは、ほかのオペレーションと同じ問題の詳細（`application/problem+json`）です
- **ファイルは保存しません**。同じクエリには、そのときの台帳から作ったファイルを返します。以前のコントラクトは、ファイルを作ってダウンロード URL を返す `POST` で、Excel と PDF も選べました。ファイルを置く場所も、作ったファイルの記録も、期限が来たファイルを消す仕組みもないので、ファイルを本文で返す `GET` に変え、形式を CSV だけにしました。Excel は CSV を開けます

## 丸め

- 平均（`averageTransactionValue`、`averageServiceValue`、推移の `average`）は、1 円未満を切り捨てます
- 割合（`percentage`）は、小数第 1 位に四捨五入します。四捨五入するので、行の合計が 100 にならないことがあります。合計が 0 なら、どの行も 0 です

## 同時に届いたリクエスト

- 1 つのレポートの値は、1 つの読み取り専用のトランザクション（`REPEATABLE READ`）で読みます。日ごとの合計、支払い方法別、カテゴリー別、スタッフ別は、同じ時点の台帳から数えるので、互いに食い違いません
- ロックは取りません。書いている途中の売上や支払いを待たず、レポートを読み始めた時点でコミットされた値で答えます

## 集計を保存しない理由

日ごとの集計とスタッフの実績を保存するテーブルは、ありません。以前あった `daily_summaries` と `staff_performances` は、どのコードも読み書きしていなかったので、#233 で削除しました。

集計を保存して読むには、売上の作成、更新、取り消し、支払いの記録、返金のたびに、保存した集計も直す必要があります。直し漏れがあれば、レポートが台帳と食い違います。期間を 366 日までにして、台帳から数えるほうが、正しさを保ちやすいからです。

## シード

`pnpm db:seed` は、売上を入れません。シードのデータでレポートを読むと、すべて 0 です。売上を作成し（[売上台帳](./sales.md)）、支払いを記録すると（[支払い](./payments.md)）、レポートに入ります。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/payment.tsp`（`SalesReportGetRequest`、`DailySalesGetRequest`、`SalesTrendsGetRequest`、`SalesTrendPeriodType`、`SalesReportResponse`、`SalesByMethodResponse`、`SalesByCategoryResponse`、`SalesByStaffResponse`、`DailySalesResponse`、`SalesTrendsResponse`）、`specs/operations/payment-operations.tsp`（`SalesReportCrud`） |
| ドメイン | `backend/packages/domain/src/models/sales-report.ts`、`schemas/sales-report.schema.ts`、`repositories/sales-report.repository.ts`、`business-logic/sales-report/`（誰が読むかは `_shared/authorization.ts`、リポジトリが読んだ値からレポートを作るのは `_shared/report.ts`、日付の計算は `_shared/calendar.ts`、CSV を作るのは `_shared/export.ts`、権限とサロンの確かめ方は `_shared/figures.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/sales-report.repository.impl.ts` |
| API | `backend/packages/api/src/routes/sales-report/`（`/api/v1/sales-reports` に取り付ける） |
| テスト | `backend/packages/domain/src/__tests__/sales-report.schema.test.ts`、`sales-report.report.test.ts`、`sales-report.export.test.ts`、`sales-report.usecase.test.ts`、`backend/packages/api/src/__tests__/sales-report.integration.test.ts` |
