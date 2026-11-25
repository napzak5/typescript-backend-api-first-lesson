# 発注

サロンが仕入先に出す発注（purchase orders）の規則をまとめます。コントラクトは `specs/operations/inventory-operations.tsp`（`InventoryOperations` の `PurchaseOrderCrud`）と `specs/models/inventory.tsp`、テーブルは `purchase_orders` と、明細の `purchase_order_items` です。

発注は、サロンの在庫の行（[在庫](./inventory.md)）を明細にして、仕入先に何をいくつ、いくらで頼むかを記録します。管理者とサロンのスタッフが `/api/v1/purchase-orders` で扱います。顧客のアカウントは、このルートを使えません。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 発注の一覧、作成、1 件の取得、更新（`list`、`create`、`get`、`update`） | 実装済み |
| 承認（`approve`）、取り消し（`cancel`） | 実装済み |
| 入荷（`receive`） | 実装済み（[入荷](#入荷)） |
| 発注の提案（`listReorderSuggestions`） | 実装済み（[発注の提案](#発注の提案)） |

- 次のものは、ありません
  - 分けて入荷すること。入荷は発注ごとに 1 回で、発注を `delivered` にします。あとから届いた分と、明細の数量より多く届いた分は、在庫の移動（`purchase`）で記録します（[在庫の移動](./inventory.md#在庫の移動)）
  - 発注を消すオペレーション。誤った発注は、取り消して作り直します
  - 明細、仕入先、金額を変えるオペレーション。更新が書くのは、ステータス、納品予定日、納品のメモ、メモだけです（[更新](#更新)）
  - 顧客に、発注を見せるルート
  - 商品のリードタイム（`leadTimeDays`）を使う計算。発注の提案は、いまの在庫と発注中の数だけで決め（[発注の提案](#発注の提案)）、納品予定日（`expectedDelivery`）は、リクエストが決めます。`leadTimeDays` は、商品の台帳に記録する値です（[商品](./products.md)）

## 発注と明細

| プロパティ | 意味 |
|---|---|
| `salonId` | 発注するサロン |
| `orderNumber` | 発注番号。`PO-` と、4 文字、`-`、4 文字（[発注番号](#発注番号)） |
| `supplier` | 仕入先の名前 |
| `status` | ステータス（[ステータス](#ステータス)） |
| `items` | 明細。作成のリクエストの順 |
| `subtotal` | 小計（円）。明細の `totalPrice` の合計 |
| `taxAmount` | 税額（円）。リクエストのとおり |
| `shippingCost` | 送料（円）。なければ null |
| `totalAmount` | 合計（円）。`subtotal` + `taxAmount` + `shippingCost`（null は 0） |
| `orderDate` | 発注日時。作成した時刻 |
| `expectedDelivery` | 納品予定日時。なければ null |
| `actualDelivery` | 納品日時。入荷した時刻。入荷するまでは null |
| `deliveryNotes` | 納品のメモ。なければ null |
| `paymentTerms` | 支払条件。なければ null |
| `notes` | メモ。なければ null |
| `approvedBy` | 承認したスタッフの ID。管理者が承認したか、承認していなければ null |
| `approvedAt` | 承認した時刻。承認していなければ null |
| `cancelledAt` | 取り消した時刻。取り消していなければ null |
| `cancellationReason` | 取り消した理由。取り消していなければ null |
| `createdBy` | 作成したスタッフの ID。管理者が作成したときは null |
| `createdAt`、`updatedAt` | 作成した時刻と、最後に変えた時刻 |

明細（`items` の要素）:

| プロパティ | 意味 |
|---|---|
| `inventoryId` | 発注する在庫の行。その行を削除したあとは null |
| `productCode`、`productName`、`unit` | 在庫の行の商品の商品コード、名前、単位。発注を作成したときの写し |
| `quantity` | 数量。0 より大きく、小数第 2 位まで |
| `unitPrice` | 単価（円） |
| `totalPrice` | 明細の金額（円）。`quantity` × `unitPrice` を、円未満で四捨五入（0.5 は切り上げ） |
| `notes` | メモ。なければ null |

- **明細の商品は、作成したときの写しです**。あとで商品の名前、商品コード、単位を変えても、発注の明細は変わりません。発注は、何を頼んだかの記録だからです
- 明細は、在庫の行を指します。商品ではなく在庫の行なのは、どのロットを、どこに置くために頼むかを、明細が示すからです。在庫の行を削除すると、明細は残り、`inventoryId` が null になります
- 明細は、レスポンスで、作成のリクエストの順に並びます。明細の ID と順番の番号（`sortOrder`）は、レスポンスにありません

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/purchase-orders` | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの発注だけ） |
| 作成 | `POST /api/v1/purchase-orders` | `admin`、本文の `salonId` のサロンの `owner` / `manager` / `staff` |
| 1 件の取得 | `GET /api/v1/purchase-orders/{id}` | `admin`、発注のサロンの `owner` / `manager` / `staff` |
| 更新 | `PATCH /api/v1/purchase-orders/{id}` | `admin`、発注のサロンの `owner` / `manager` / `staff` |
| 承認 | `POST /api/v1/purchase-orders/{id}/approve` | `admin`、発注のサロンの `owner` / `manager` |
| 取り消し | `POST /api/v1/purchase-orders/{id}/cancel` | `admin`、発注のサロンの `owner` / `manager` |
| 入荷 | `POST /api/v1/purchase-orders/{id}/receive` | `admin`、発注のサロンの `owner` / `manager` / `staff` |
| 発注の提案 | `GET /api/v1/purchase-orders/reorder-suggestions` | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff` |

- すべてのオペレーションに認証が要ります
- 権限は、在庫と同じ 2 段階で判定します（`business-logic/purchase-order/_shared/authorization.ts`）。1 段階目は、操作者だけで決まります。一覧、作成、取得、更新、入荷、発注の提案（`purchaseOrderReachOf`）は、在庫を読める人（`admin` と、サロンの 3 つのロール）のものです。足りなくなった商品を頼み、仕入先が発注をどうしたかを記録し、届いた商品を受け取るのは、日々在庫を扱うスタッフだからです。`staff` は、仕入れの在庫の移動も記録できます
- **承認と取り消し（`purchaseOrderApproverReachOf`）は、在庫を管理する人（`admin`、`owner`、`manager`）のものです**。承認は、お金を使うことを決めます。発注をやめることも、同じ人が決めます。`staff`、ロール `customer` のユーザー、範囲 `none` のユーザーは、ID か本文が不正でも 403 です
- 2 段階目は、本文かクエリを確かめたあとに決まります（`isWithin`）。サロンのユーザーが、作成の本文か、一覧か発注の提案のクエリで、ほかのサロンを指定すると、サロンが存在するかどうかにかかわらず 403 です
- **ほかのサロンの発注は、存在しない発注と区別しません**。取得、更新、承認、取り消し、入荷は 404（`detail` は `PurchaseOrder <id> was not found`）です。一覧の `cursor` に指定すると 400 です。作成で、本文の `salonId` のサロンの在庫の行でない行を指定すると、本文の誤りとして 400 です（`items.<n>.inventoryId` の `not_found`）
- `createdBy` と `approvedBy`、入荷が記録する在庫の移動の `performedBy` は、操作者のスタッフの ID です。管理者は、サロンのスタッフではないので null です。本文に書いても読みません（作成と入荷では、知らないプロパティとして 400。承認は本文を読みません）
- ID（パスの `id`、本文とクエリの ID）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です

### 確認の順序

一覧:

1. アクセストークン（401）
2. 操作者が発注を読めること（403）
3. クエリ（400。`detail` は `Invalid purchase order search`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. `cursor` が、操作者に届く発注を指すこと（400。`cursor` の `not_found`。`Must name a purchase order of the list`）

作成:

1. アクセストークン（401）
2. 操作者が発注を読めること（403）
3. リクエストの本文（400。`detail` は `Invalid purchase order`）
4. 本文の `salonId` が、操作者に届くサロンであること（403）
5. サロンの存在（400。`salonId` の `not_found`）
6. 明細の在庫の行が、そのサロンの行であること（400。行ごとに `items.<n>.inventoryId` の `not_found`。`Must name a stock row of the salon`）

1 件の取得:

1. アクセストークン（401）
2. 操作者が発注を読めること（403）
3. パスの `id` の形式（400。`detail` は `Invalid purchase order ID`）
4. 発注の存在（404）

更新:

1. アクセストークン（401）
2. 操作者が発注を読めること（403）
3. パスの `id` の形式（400）
4. リクエストの本文（400。`detail` は `Invalid purchase order`）
5. 発注の存在（404）
6. 発注のステータスが、更新を受けること（409。[ステータス](#ステータス)）

承認:

1. アクセストークン（401）
2. 操作者が発注を承認できること（403）
3. パスの `id` の形式（400）
4. 発注の存在（404）
5. 発注が `pending` であること（409）

取り消し:

1. アクセストークン（401）
2. 操作者が発注を取り消せること（403）
3. パスの `id` の形式（400）
4. リクエストの本文（400。`detail` は `Invalid purchase order cancellation`）
5. 発注の存在（404）
6. 発注が `delivered` でも `cancelled` でもないこと（409）

入荷:

1. アクセストークン（401）
2. 操作者が発注を読めること（403）
3. パスの `id` の形式（400）
4. リクエストの本文（400。`detail` は `Invalid purchase order receipt`）
5. 発注の存在（404）
6. 発注が `ordered` か `shipped` であること（409）
7. 本文の在庫の行が、発注の明細の行であること、数量が明細の数量以下であること（400。[入荷](#入荷)）
8. 入荷したあとの在庫数が、99,999,999.99 以下であること（409）

発注の提案:

1. アクセストークン（401）
2. 操作者が発注を読めること（403）
3. クエリ（400。`detail` は `Invalid reorder suggestion search`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. サロンの存在（400。`salonId` の `not_found`）
6. `cursor` が、そのサロンの商品を指すこと（400。`cursor` の `not_found`。`Must name a product of the salon`）

## 作成リクエストの規則

| プロパティ | 規則 |
|---|---|
| `salonId` | 必須。存在するサロン |
| `supplier` | 必須。空白だけでない 255 文字以下 |
| `items` | 必須。1〜100 件 |
| `items[].inventoryId` | 必須。そのサロンの在庫の行。1 つの発注に、同じ行は 1 回だけ |
| `items[].quantity` | 必須。0 より大きく 99,999,999.99 以下、小数第 2 位まで |
| `items[].unitPrice` | 必須。0 以上 2,147,483,647 以下の整数 |
| `items[].notes` | 必須。空白だけでない文字列か null |
| `taxAmount` | 必須。0 以上 2,147,483,647 以下の整数 |
| `shippingCost` | 必須。0 以上 2,147,483,647 以下の整数か null |
| `expectedDelivery` | 必須。`Z` で終わる UTC の ISO 8601 の日時か null。時差を付けた日時と、秒のない日時は 400 です（`invalid_format`） |
| `paymentTerms`、`notes` | 必須。空白だけでない文字列か null |

- 知らないプロパティは 400 です（`unrecognized_keys`）。サーバーが決めるもの（`status`、`orderNumber`、金額、明細の商品の写し、`createdBy` など）も、本文に書くと 400 です
- **金額は、サーバーが計算します**。明細の `totalPrice` は `quantity` × `unitPrice` を円未満で四捨五入した額、`subtotal` はその合計、`totalAmount` は `subtotal` + `taxAmount` + `shippingCost` です。税額は、税率がサロンや商品で違うので、リクエストのとおりです
- 金額は、データベースの `integer` に入る 2,147,483,647 円までです
  - 明細の `totalPrice` が超えると、その明細の `unitPrice` の `too_big` です。`message` は、その数量で書ける最大の単価を示します（`Must be at most 715827882: ...`）。数量か単価がそれだけで誤りなら、明細の金額は確かめません
  - `totalAmount` が超えると、`items` の `custom` です。ほかに誤りのあるリクエストでは、合計を確かめません。`subtotal` は、`totalAmount` を超えないので、`totalAmount` が入れば入ります
- 同じ在庫の行を 2 回書くと、2 回目の明細の `inventoryId` の `custom` です（`Must not repeat a stock row ordered earlier in the order`）。英字の大文字と小文字だけが違う ID も、同じ行です
- すべての誤りを、まとめて返します。たとえば、同じ行の 2 回目と、金額が超える明細があれば、両方を返します
- 作成した発注は `draft` です

## 発注番号

発注番号は、`PO-` と、4 文字、`-`、4 文字です（例: `PO-7K3M-Q9TX`）。文字は、0〜9 と、I、L、O、U を除く英大文字（Crockford の Base32）で、サーバーが暗号論的乱数から選びます。予約番号、売上番号、支払番号と同じ作り方です。

- 発注番号は、すべてのサロンで一意です（一意制約 `purchase_orders_order_number_unique`）
- 選んだ番号がほかの発注にあれば、ほかの番号で作り直します。3 回続けてあれば、500 です
- 発注番号で、発注を探すルートはありません

## ステータス

| ステータス | 意味 | 何で変わるか |
|---|---|---|
| `draft` | 下書き | 作成 |
| `pending` | 承認待ち | 更新（`draft` から） |
| `approved` | 承認済み | 承認（`pending` から） |
| `ordered` | 仕入先に発注した | 更新（`approved` から） |
| `shipped` | 仕入先が出荷した | 更新（`ordered` から） |
| `delivered` | 納品された | 入荷（`ordered` と `shipped` から） |
| `cancelled` | 取り消した | 取り消し（`delivered` と `cancelled` 以外から） |

- **更新は、ステータスを 1 つだけ進めます**。`draft` → `pending`、`approved` → `ordered`、`ordered` → `shipped` です。今と同じステータスを書くか、`status` を書かない更新は、ほかのプロパティだけを書きます。ほかのステータスへの更新は 409 です（`detail` は `Purchase order <id> is <status>: an update moves a draft to pending, an approved order to ordered and an ordered one to shipped`）。戻すこと、飛ばすこと、`approved`、`delivered`、`cancelled` にすることは、更新ではできません
- **承認は、`pending` の発注だけです**。ほかは 409 です（`... is <status>: only a pending order is approved`）。承認は、`approvedBy` と `approvedAt` を書きます。承認したあとの更新も、`approvedBy` と `approvedAt` を変えません
- **取り消しは、`delivered` になるまでの発注です**。出荷したあと（`shipped`）も取り消せます。仕入先との話し合いで、返送することがあるからです。取り消しは、`cancelledAt` と `cancellationReason` を書きます
- **入荷は、`ordered` と `shipped` の発注だけです**。`draft`、`pending`、`approved` は 409 です（`... is <status>: the goods of an ordered or shipped order are received`）。承認する前の発注は、まだ仕入先に頼んでいないからです
- **`delivered` と `cancelled` の発注は、何も変わりません**。更新、承認、取り消し、入荷は、409 です（`... is <status>: a delivered or cancelled order does not change`）。メモだけの更新も、409 です
- 409 は、問題の `type` が `operation-not-allowed`、`code` が `3003` です

## 更新

| プロパティ | 規則 |
|---|---|
| `status` | 任意。ステータスの 1 つ（[ステータス](#ステータス)） |
| `expectedDelivery` | 任意。日時か null |
| `deliveryNotes` | 任意。空白だけでない文字列か null |
| `notes` | 任意。空白だけでない文字列か null |

- 1 つ以上のプロパティが要ります。空の本文は 400 です（パスなしの `custom`）
- 書かなかったプロパティは、変わりません
- `actualDelivery`、明細、仕入先、金額などは、書けません（`unrecognized_keys` の 400）。納品は入荷が書くもの、明細と金額は、発注を作り直して直すものです

## 入荷

`POST /api/v1/purchase-orders/{id}/receive` は、仕入先から届いた商品を、発注の明細の在庫の行に入れ、発注を `delivered` にします。レスポンスは、200 と、入荷したあとの発注です。

| プロパティ | 規則 |
|---|---|
| `items` | 必須。1〜100 件 |
| `items[].inventoryId` | 必須。発注の明細の在庫の行。1 回の入荷で、同じ行は 1 回だけ |
| `items[].quantity` | 必須。届いた数量。0 より大きく、その明細の `quantity` 以下、小数第 2 位まで |
| `deliveryNotes` | 必須。空白だけでない文字列か null。null なら、発注の納品のメモを変えません |

- 入荷は、本文の明細ごとに、在庫の行の `currentStock` と `availableStock` を数量だけ増やし、在庫の移動を 1 件ずつ記録します（[在庫の移動](./inventory.md#在庫の移動)）
  - `transactionType` は `purchase`、`quantity` は届いた数量です
  - `unitCost` は明細の `unitPrice`、`totalCost` は数量 × 単価を円未満で四捨五入した額です（0.5 は切り上げ）
  - `referenceType` は `purchase_order`、`referenceId` は発注の ID、`reason` は null です
  - `performedBy` は操作者のスタッフ（`admin` は null）、`lotNumber` と `expiryDate` は在庫の行のもの、`balanceBefore` と `balanceAfter` は入荷の前とあとの在庫数です
- 発注は `delivered` になり、`actualDelivery` は入荷した時刻です。`deliveryNotes` を書くと、発注の納品のメモを置き換えます
- **本文に書かなかった明細は、受け取りません**。届かなかった明細も、入荷のあとに届くことはないものとして、発注を閉じます。あとから届いた分と、明細の数量より多く届いた分は、在庫の移動（`purchase`）で記録します
- 次のものは、本文の誤りとして 400 です。すべての誤りを、まとめて返します
  - 発注の明細にない在庫の行（`items.<n>.inventoryId` の `not_found`。`Must name a stock row of an item of the order`）。在庫の行を削除した明細（`inventoryId` が null）は、受け取れません
  - 明細の `quantity` を超える数量（`items.<n>.quantity` の `too_big`。`Must be at most <明細の数量>, the quantity the item orders`）。数量は、小数第 2 位までで比べます
  - 同じ行の 2 回目（`items.<n>.inventoryId` の `custom`。`Must not repeat a stock row received earlier in the receipt`）。英字の大文字と小文字だけが違う ID も、同じ行です
- 入荷したあとの在庫数が 99,999,999.99 を超える行があれば、409 です（`detail` は `The stock of row <id> would go above 99999999.99`）
- 400 と 409 のときは、何も書きません
- 入荷した時刻（`actualDelivery`）、発注と在庫の行の `updatedAt`、在庫の移動の `createdAt` は、同じ値です（発注を書いた文の `statement_timestamp()`）

## 発注の提案

`GET /api/v1/purchase-orders/reorder-suggestions` は、サロンが次に頼むとよい商品と、その数量を、商品ごとに返します。

| パラメータ | 規則 |
|---|---|
| `salonId` | 必須。サロンの ID。サロンのユーザーは、自分のサロンだけ |
| `limit` | 1〜100。省略すると 20 |
| `cursor` | 前のページの `meta.nextCursor`。そのサロンの商品の ID |

| プロパティ | 意味 |
|---|---|
| `productId`、`productCode`、`productName`、`unit`、`supplier` | 商品の ID、商品コード、名前、単位、仕入先（なければ null） |
| `currentStock` | 在庫数。そのサロンにある、その商品のすべての在庫の行の `currentStock` の和 |
| `onOrderQuantity` | 発注中の数量。そのサロンの `draft`、`pending`、`approved`、`ordered`、`shipped` の発注の、その商品の在庫の行の明細の `quantity` の和 |
| `reorderPoint` | 使った発注点。商品の `reorderPoint`、なければ `minimumStock` |
| `maximumStock` | 商品の最大在庫数。なければ null |
| `suggestedQuantity` | 推奨する発注数量。`maximumStock`（なければ発注点）−（`currentStock` + `onOrderQuantity`） |
| `lastOrderDate` | そのサロンの、取り消していない発注のうち、その商品の在庫の行の明細を含むものの、最新の `orderDate`。なければ null |

- **提案に載るのは、取り扱い中（`isActive` が true）で、削除していない、そのサロンの商品のうち、そのサロンに在庫の行があり、`currentStock` + `onOrderQuantity` が発注点以下で、`suggestedQuantity` が 0 より大きいもの**です。発注点と同じ数も載ります
- 発注中の数量には、下書きと承認待ちの発注も入ります。頼むつもりの数量を、二重に頼まないためです。`delivered` と `cancelled` の発注は入りません
- 明細の商品は、明細の在庫の行の商品です。在庫の行を削除した明細は、どの商品にも数えません
- 数量は、数値で返します。`lastOrderDate` は、ほかの日時と同じ ISO 8601 です
- 並びは、商品コードの順、同じ商品コードでは商品の ID の順です。`cursor` は、その商品のあとからのページを返します（キーセット）。提案に載っていない商品でも、そのサロンの商品なら、その商品コードのあとから返します。ページは、前にだけ進みます（`prevCursor` は、いつも null）
- `meta.total` は、提案に載る商品の数です。ページと件数は、1 つのスナップショット（`REPEATABLE READ` の読み取り専用のトランザクション）で読みます
- 知らないパラメータは 400 です（`unrecognized_keys`）
- 発注の提案は、何も書きません。提案から発注を作るときは、商品の在庫の行を選んで、作成のリクエストに書きます

## 取り消し

本文は `{"cancellationReason": "<理由>"}` です。理由は必須で、空白だけでない文字列です。コントラクトのこのプロパティの名前は、以前は `reason` でしたが、カラムの名前に合わせて `cancellationReason` にしました。`reason` は、知らないプロパティとして 400 です。

## 1 件の取得と一覧

一覧のクエリ:

| パラメータ | 規則 |
|---|---|
| `limit` | 1〜100。省略すると 20 |
| `cursor` | 前のページの `meta.nextCursor`。操作者に届く発注の ID |
| `salonId` | サロンの ID。サロンのユーザーは、自分のサロンだけ |
| `status` | ステータス |
| `supplier` | 仕入先の名前（完全一致）。空白だけでない 255 文字以下 |
| `startDate`、`endDate` | 発注日時の範囲。どちらも含みます。`Z` で終わる UTC の ISO 8601 の日時。`endDate` は `startDate` より前にできません（`endDate` の `custom`） |

- 並びは、発注日時の新しい順、同じ発注日時では ID の降順です。`cursor` は、そのあとの発注からのページを返します（キーセット）。ページは、前にだけ進みます（`prevCursor` は、いつも null）
- 発注日時の範囲は、ミリ秒で比べます。データベースの発注日時はマイクロ秒まであるので、ミリ秒未満を切り捨ててから比べます。レスポンスの `orderDate` と同じ値を `startDate` と `endDate` に書くと、その発注が入ります
- 知らないパラメータは 400 です（`unrecognized_keys`）
- `meta.total` は、絞り込みに合う発注の数です。カーソル、ページ、件数、明細は、1 つのスナップショット（`REPEATABLE READ` の読み取り専用のトランザクション）で読みます
- 一覧の発注にも、明細があります

## 同時に届いたリクエスト

- **更新、承認、取り消しは、発注の行を `FOR UPDATE` でロックしてから、ステータスを確かめます**。同じ発注の変更は 1 件ずつ、前の変更が残したステータスで決めます。同じ発注の承認が同時に 2 件届くと、1 件が 200 で、もう 1 件は 409 です。承認と取り消しが同時に届くと、取り消しは、どちらが先でも 200 です。承認は、取り消しより先なら 200、あとなら 409 です
- 承認と取り消しの時刻（`approvedAt`、`cancelledAt`）と、変更の `updatedAt` は、書いた文の時刻（データベースの `statement_timestamp()`）で、同じ値です。ロックを待った変更は、待ったあとの時刻です
- **作成は、明細の在庫の行と、その商品の行を、`FOR KEY SHARE` でロックしてから、行を確かめて商品を写します**（`READ COMMITTED` のトランザクション。在庫の行は ID の順）。これは、在庫の行の削除と、商品の更新がとるロック（`FOR UPDATE`）と互いに待つロックです。削除の途中の在庫の行への作成は、それを待ち、削除されれば 400（`items.<n>.inventoryId` の `not_found`）で、何も書きません。更新の途中の商品は、更新されたあとの名前、商品コード、単位を写します
- **入荷は、発注の行を `FOR UPDATE` でロックしてから、ステータスと明細を確かめ、本文の在庫の行を、ID の順に `FOR UPDATE` でロックしてから、在庫数を増やします**（`READ COMMITTED` のトランザクション）。同じ発注の入荷が同時に 2 件届くと、1 件が 200 で、もう 1 件は 409 です（在庫は 1 回だけ増えます）。取り消しの途中の発注への入荷は、それを待ち、取り消されれば 409 です
- 在庫の移動、棚卸し、在庫の行の削除の途中の行への入荷は、それを待ちます。在庫の移動と棚卸しのあとは、それが残した在庫数から増やします。削除されれば、明細にない行として 400 で、何も書きません。ロックを待った入荷の時刻は、待ったあとの時刻です
- 取得、一覧、発注の提案は、ロックを待ちません

## DB の制約

マイグレーション `202611171600_purchase_orders.sql` で、型 `order_status` と、テーブル `purchase_orders`、`purchase_order_items` を作りました。

- CHECK 制約 `purchase_orders_amounts`: 金額は 0 以上、`totalAmount` = `subtotal` + `taxAmount` + `shippingCost`（null は 0）
- CHECK 制約 `purchase_orders_approval`: `approvedBy` があれば `approvedAt` もある。`draft` と `pending` は `approvedAt` がなく、`approved`、`ordered`、`shipped`、`delivered` はある。`cancelled` は、承認の前でもあとでもよい
- CHECK 制約 `purchase_orders_cancellation`: `cancelled` だけが `cancelledAt` を持ち、`cancelledAt` と `cancellationReason` は、両方あるか、両方ない
- CHECK 制約 `purchase_orders_delivery`: `delivered` だけが `actualDelivery` を持つ。入荷は、`status` と `actualDelivery` を同じ文で書きます
- 一意制約 `purchase_orders_order_number_unique`（`orderNumber`）
- インデックス `idx_purchase_orders_salon_order_date`（`salonId`、`orderDate`、`id`）。サロンの一覧の並びのためのものです
- CHECK 制約 `purchase_order_items_amounts`: `quantity` は 0 より大きい、`unitPrice` と `sortOrder` は 0 以上、`totalPrice` = round(`unitPrice` × `quantity`)
- 一意制約 `purchase_order_items_order_inventory_unique`（`purchaseOrderId`、`inventoryId`）と `purchase_order_items_order_sort_unique`（`purchaseOrderId`、`sortOrder`）
- インデックス `idx_purchase_order_items_inventory_id`（`inventoryId`）。在庫の行の削除が、明細を探すためのものです

発注は、外部キー（`purchase_orders_salon_id_fk`。`ON DELETE CASCADE`）でサロンを指します。明細は、外部キーで、発注（`purchase_order_items_purchase_order_id_fk`。`ON DELETE CASCADE`）と在庫の行（`purchase_order_items_inventory_id_fk`。`ON DELETE SET NULL`）を指します。`createdBy` と `approvedBy` は、在庫の移動の `performedBy` と同じく、外部キーのない UUID です。

マイグレーションは、何度適用しても同じ結果です。以前のバージョンは、このテーブルを読まないので、マイグレーションを適用したあとも動きます。

`pnpm check:api-db` は、新しい明細の `inventoryId`（`PurchaseOrderItemCreateRequest`）を、null を取らないプロパティとして確かめます（ルールの `nonNullable`）。カラムが null を取るのは、在庫の行を削除したあとだけだからです（[API-DB型制約マッピング](./api-db-type-constraints-mapping.md)）。

## シード

`pnpm db:seed` は、1 つ目のサロンに、2 件の発注を入れます。仕入先は、どちらも `Beauty Supply Tokyo` です。

| 発注番号 | ステータス | 明細 | 金額 |
|---|---|---|---|
| `PO-SEED-0001` | `pending` | `SHMP001` の在庫の行を 10、`COND001` の在庫の行を 5。単価は商品の仕入価格 | 税額は小計の 10%、送料なし |
| `PO-SEED-0002` | `ordered`（承認した時刻はシードの時刻、承認したスタッフはなし） | `TREAT001` の在庫の行を 12 | 税額は小計の 10%、送料 800 円、納品予定はシードの 7 日後 |

- `PO-SEED-0001` は、承認できます。`PO-SEED-0002` は、更新で `shipped` にでき、`ordered` のままでも入荷できます

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/inventory.tsp`（`PurchaseOrderResponse`、`PurchaseOrderItem`、`PurchaseOrderItemCreateRequest`、`PurchaseOrderCreateRequest`、`PurchaseOrderUpdateRequest`、`PurchaseOrderCancelRequest`、`PurchaseOrderReceiveRequest`、`PurchaseOrderReceivedItem`、`PurchaseOrderSearchRequest`、`ReorderSuggestionSearchRequest`、`ReorderSuggestionResponse`）、`specs/operations/inventory-operations.tsp`（`PurchaseOrderCrud`） |
| ドメイン | `backend/packages/domain/src/models/purchase-order.ts`、`schemas/purchase-order.schema.ts`、`mappers/read/purchase-order.mapper.ts`（発注と発注の提案のほかに、2 つの一覧のページも作る）、`mappers/write/purchase-order.mapper.ts`（作成と更新の行のほかに、キャンセルの理由、入荷した明細、2 つの一覧の条件も作る）、`repositories/purchase-order.repository.ts`、`services/purchase-order-number-issuer.ts`、`business-logic/purchase-order/`（誰が読み、誰が承認するかは `_shared/authorization.ts`、ステータスの規則は `_shared/status.ts`、金額は `_shared/amounts.ts`、入荷が記録する在庫の移動は `_shared/goods-receipt.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/purchase-order.repository.impl.ts`、`security/random-purchase-order-number-issuer.ts` |
| API | `backend/packages/api/src/routes/purchase-order/`（`/api/v1/purchase-orders` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611171600_purchase_orders.sql`、シードは `backend/packages/database/src/seeds/seed-data/products.ts` |
| テスト | `backend/packages/domain/src/schemas/__tests__/purchase-order.schema.test.ts`、`backend/packages/domain/src/business-logic/purchase-order/__tests__/purchase-order.rules.test.ts`、`backend/packages/domain/src/mappers/__tests__/purchase-order.mapper.test.ts`、`backend/packages/domain/src/business-logic/purchase-order/__tests__/purchase-order.usecase.test.ts`、`purchase-order.receipt.test.ts`（入荷と発注の提案）、`backend/packages/infrastructure/src/security/__tests__/random-purchase-order-number-issuer.test.ts`、`backend/packages/api/src/routes/purchase-order/__tests__/purchase-order.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
