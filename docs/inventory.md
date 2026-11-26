# 在庫

サロンの在庫（`inventory`）の規則をまとめます。コントラクトは `specs/operations/inventory-operations.tsp`（`InventoryOperations` の `InventoryCrud`）と `specs/models/inventory.tsp`、テーブルは `inventory` と、在庫の移動の `inventory_transactions` です。

在庫の 1 行（在庫の行）は、サロンにある 1 つの商品の 1 つのロットです。どれだけあるか、どこにあるか、いつ使用期限が来るかを記録します。管理者とサロンのスタッフが `/api/v1/inventory` で扱います。顧客のアカウントは、このルートを使えません。商品そのものは [商品](./products.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 在庫の行の一覧、作成、1 件の取得、更新、削除（`list`、`create`、`get`、`update`、`delete`） | 実装済み |
| 在庫僅少の一覧（`listLowStock`）、期限切れ間近の一覧（`listExpiring`） | 実装済み |
| 在庫の移動の記録と履歴（`recordMovement`、`listMovements`） | 実装済み（[在庫の移動](#在庫の移動)） |
| 棚卸し（`performStockCount`） | 実装済み（[棚卸し](#棚卸し)） |
| 在庫評価額（`getValueReport`） | 実装済み（[在庫評価額](#在庫評価額)） |
| 発注（`PurchaseOrderCrud` の一覧、作成、1 件の取得、更新、承認、取り消し、入荷、発注の提案） | 実装済み（[発注](./purchase-orders.md)） |
| 在庫のアラート（`InventoryAlertCrud` の一覧、確認、件数） | 実装済み（[在庫のアラート](./inventory-alerts.md)） |

- 在庫数（`currentStock`）と使える数（`availableStock`）を書くのは、在庫の移動、棚卸し、発注の入荷です（[在庫の移動](#在庫の移動)、[棚卸し](#棚卸し)、[入荷](./purchase-orders.md#入荷)）。棚卸しも、帳簿との差を在庫の移動（`adjustment`）として記録し、入荷も、届いた数を在庫の移動（`purchase`）として記録します。棚卸しの記録（`lastCountedAt`、`lastCountedBy`）を書くのは、棚卸しだけです
- 次のものは、ありません
  - 在庫を引き当てるオペレーション。`reservedStock` は、API で作成した行では 0 です
  - 顧客に、在庫を見せるルート
  - 削除した在庫の行を戻すオペレーション。削除は行を消します（[削除](#削除)）
  - 記録した在庫の移動を、直すか消すオペレーション。誤りは、逆向きの在庫の移動で直します（[在庫の移動](#在庫の移動)）

## 在庫の行は、1 つの商品の 1 つのロット

| プロパティ | 意味 |
|---|---|
| `salonId` | 在庫を持つサロン |
| `productId` | 商品。そのサロンの商品 |
| `currentStock` | 在庫数。棚にある数 |
| `availableStock` | 使える数。いつも `currentStock` − `reservedStock` |
| `reservedStock` | 引き当てた数。0 以上 `currentStock` 以下 |
| `lotNumber` | ロット番号。ロットで分けない商品では null（[ロット番号](#ロット番号)） |
| `expiryDate` | 使用期限（`YYYY-MM-DD`）。期限のないものは null |
| `location` | サロンの中の保管場所。なければ null |
| `shelf` | 保管場所の中の棚。なければ null |
| `lastCountedAt` | 最後に棚卸しした時刻。棚卸ししていなければ null |
| `lastCountedBy` | 最後に棚卸ししたスタッフの ID。棚卸ししていなければ null |
| `notes` | メモ。なければ null |

- **在庫の行は、在庫数 0 で作成します**。入庫は、在庫の移動（`purchase`）で記録します。作成と更新のリクエストに、在庫の数と棚卸しの記録を書くと 400 です（`unrecognized_keys`）
- 在庫の行は、サロンと商品を変えません。更新のリクエストに `salonId` と `productId` を書くと 400 です（`unrecognized_keys`）。ほかのサロンに移すのは、在庫の移動（`transfer`）です。サロンの中で保管場所を変えるのは、在庫の行の更新（`location`、`shelf`）です
- 3 つの数の関係は、CHECK 制約（`inventory_stock`）が守ります（[DB の制約](#db-の制約)）
- 取り扱いをやめた商品（`isActive` が false）の在庫の行も、作成できます。残っている在庫を記録するためです

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/inventory` | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの在庫だけ） |
| 作成 | `POST /api/v1/inventory` | `admin`、本文の `salonId` のサロンの `owner` / `manager` |
| 1 件の取得 | `GET /api/v1/inventory/{id}` | `admin`、在庫の行のサロンの `owner` / `manager` / `staff` |
| 更新 | `PATCH /api/v1/inventory/{id}` | `admin`、在庫の行のサロンの `owner` / `manager` |
| 削除 | `DELETE /api/v1/inventory/{id}` | `admin`、在庫の行のサロンの `owner` / `manager` |
| 在庫僅少の一覧 | `GET /api/v1/inventory/low-stock` | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff` |
| 期限切れ間近の一覧 | `GET /api/v1/inventory/expiring` | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff` |
| 在庫の移動の記録 | `POST /api/v1/inventory/movement` | `admin`、本文の `inventoryId` の在庫の行のサロンの `owner` / `manager`。`staff` は、`purchase`、`sale`、`use`、`return` だけ |
| 在庫の移動の履歴 | `GET /api/v1/inventory/{id}/movements` | `admin`、在庫の行のサロンの `owner` / `manager` / `staff` |
| 棚卸し | `POST /api/v1/inventory/stock-count` | `admin`、本文の `salonId` のサロンの `owner` / `manager` |
| 在庫評価額 | `GET /api/v1/inventory/value-report` | `admin`、クエリの `salonId` のサロンの `owner` / `manager` |

- すべてのオペレーションに認証が要ります
- ルートは、サロンの下にありません。どのサロンの在庫かは、作成と棚卸しでは本文の `salonId`、一覧、在庫僅少の一覧、期限切れ間近の一覧、在庫評価額ではクエリの `salonId`、取得、更新、削除、在庫の移動の履歴では在庫の行そのもの、在庫の移動の記録では本文の `inventoryId` の在庫の行が決めます。権限は、売上台帳と同じ 2 段階で判定します（`business-logic/inventory/_shared/authorization.ts`）
- 1 段階目は、操作者だけで決まります。読むこと（`inventoryReachOf`）は、`admin` と、サロンの 3 つのロールができます。施術で商品を棚から出し、店頭で売るスタッフが、在庫を知る必要があるからです。作成、更新、削除、棚卸し、在庫評価額（`inventoryKeeperReachOf`）は、商品と同じく、`owner` と `manager` のものです。`staff`、ロール `customer` のユーザー、範囲 `none` のユーザーは、本文、クエリ、ID が不正でも 403 です
- **在庫の移動は、在庫を読める人が記録します。ただし、`adjustment`、`disposal`、`transfer` は、管理する人だけです**（`movementReachOf`）。スタッフが日々記録するのは、仕入れ、販売、施術での使用、返品です。帳簿の在庫を直すこと、在庫を帳簿から外すこと、ほかのサロンに移すことは、`owner` と `manager` が決めます。区分は本文にあるので、`staff` がこの 3 つを記録すると、本文を確かめたあとに 403 です（本文が不正なら、その前に 400）。ロール `customer` のユーザーと範囲 `none` のユーザーは、本文が不正でも 403 です
- **棚卸しと在庫評価額は、管理する人のものです**。棚卸しは、帳簿との差を `adjustment` の在庫の移動で直すので、`adjustment` を記録できる人のものです。在庫評価額は、売上レポートと同じく、経営の数字として扱います
- 2 段階目は、本文かクエリを確かめたあとに決まります（`isWithin`）。サロンのユーザーが、ほかのサロンを指定すると、サロンが存在するかどうかにかかわらず 403 です。本文かクエリが不正なら、その前に 400 です。不正なリクエストへの 400 は、指定したサロンについて何も伝えません
- **ほかのサロンの在庫の行は、存在しない行と区別しません**。取得、更新、削除、在庫の移動の履歴は 404（`detail` は `Inventory <id> was not found`）です。一覧の `cursor` に指定すると 400 です。在庫の移動の記録では、本文の誤りとして 400 です（`inventoryId` の `not_found`）。棚卸しでは、本文の `salonId` のサロンの行でない行を、本文の誤りとして 400 にします（`items.<n>.inventoryId` の `not_found`）
- ID（パスの `id`、本文とクエリの ID）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です

### 確認の順序

一覧:

1. アクセストークン（401）
2. 操作者が在庫を読めること（403）
3. クエリ（400。`detail` は `Invalid inventory search`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. `cursor` が、操作者に届く在庫の行を指すこと（400。`cursor` の `not_found`）

作成:

1. アクセストークン（401）
2. 操作者が在庫を管理できること（403）
3. リクエストの本文（400。`detail` は `Invalid stock row`）
4. 本文の `salonId` が、操作者に届くサロンであること（403）
5. サロンの存在（400。`salonId` の `not_found`）
6. 商品が、そのサロンの削除されていない商品であること（400。`productId` の `not_found`）
7. ロット番号が商品に合うこと（400。`lotNumber` の `custom`。[ロット番号](#ロット番号)）
8. 同じ商品の、ほかの在庫の行とロットが重ならないこと（409）

1 件の取得:

1. アクセストークン（401）
2. 操作者が在庫を読めること（403）
3. パスの `id` の形式（400。`detail` は `Invalid inventory ID`）
4. 在庫の行の存在（404）

更新:

1. アクセストークン（401）
2. 操作者が在庫を管理できること（403）
3. パスの `id` の形式（400）
4. リクエストの本文（400。`detail` は `Invalid stock row`）
5. 在庫の行の存在（404）
6. リクエストが `lotNumber` を書くとき、ロット番号が商品に合うこと（400）
7. 同じ商品の、ほかの在庫の行とロットが重ならないこと（409）

削除:

1. アクセストークン（401）
2. 操作者が在庫を管理できること（403）
3. パスの `id` の形式（400）
4. 在庫の行の存在（404）
5. 在庫数が 0 であること（409。[削除](#削除)）

在庫僅少の一覧と、期限切れ間近の一覧:

1. アクセストークン（401）
2. 操作者が在庫を読めること（403）
3. クエリ（400。`detail` は `Invalid low-stock search` と `Invalid expiring search`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. サロンの存在（400。`salonId` の `not_found`）
6. `cursor` が、そのサロンの在庫の行を指すこと（400。`cursor` の `not_found`）

在庫の移動の記録:

1. アクセストークン（401）
2. 操作者が在庫を読めること（403）
3. リクエストの本文（400。`detail` は `Invalid stock movement`）
4. 操作者が、その区分の在庫の移動を記録できること（403。`staff` の `adjustment`、`disposal`、`transfer`）
5. 在庫の行が、操作者に届く行であること（400。`inventoryId` の `not_found`）
6. 移動後の在庫数が、引き当てた数（`reservedStock`）を下回らないこと（409）
7. 移動後の在庫数が、99,999,999.99 を超えないこと（409）

在庫の移動の履歴:

1. アクセストークン（401）
2. 操作者が在庫を読めること（403）
3. パスの `id` の形式（400。`detail` は `Invalid inventory ID`）
4. クエリ（400。`detail` は `Invalid stock movement search`）
5. 在庫の行の存在（404）
6. `cursor` が、その在庫の行の在庫の移動を指すこと（400。`cursor` の `not_found`）

棚卸し:

1. アクセストークン（401）
2. 操作者が在庫を管理できること（403）
3. リクエストの本文（400。`detail` は `Invalid stock count`）
4. 本文の `salonId` が、操作者に届くサロンであること（403）
5. サロンの存在（400。`salonId` の `not_found`）
6. `items` のすべての在庫の行が、そのサロンの在庫の行であること（400。`items.<n>.inventoryId` の `not_found`）
7. 数えた数が、どの行でも引き当てた数（`reservedStock`）を下回らないこと（409）

在庫評価額:

1. アクセストークン（401）
2. 操作者が在庫を管理できること（403）
3. クエリ（400。`detail` は `Invalid inventory value report`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. サロンの存在（400。`salonId` の `not_found`）

JSON として読めない本文は、ほかのルートと同じく、アクセストークンより前に 400（`code` は `2002`）です。JSON でない `Content-Type` は 415 です。

## 作成リクエストの規則

作成リクエスト（`InventoryCreateRequest`）は、すべてのキーが必須です。値がないものは、null を書きます。

| プロパティ | 規則 |
|---|---|
| `salonId` | サロンの ID |
| `productId` | そのサロンの、削除されていない商品の ID |
| `lotNumber` | null か、空白だけでない文字列。100 文字まで（[ロット番号](#ロット番号)） |
| `expiryDate` | null か、`YYYY-MM-DD` の日付。1900-01-01 から 2999-12-31 まで |
| `location` | null か、空白だけでない文字列。100 文字まで |
| `shelf` | null か、空白だけでない文字列。50 文字まで |
| `notes` | null か、空白だけでない文字列 |

- 文字列は、前後の空白を含めて、そのまま保存します。空白だけの文字列（全角の空白を含む）は 400 です（`invalid_format`）
- 文字数は、文字（コードポイント）で数えます。カラムの `varchar` の長さも、文字の数です
- 存在しない日付（`2027-02-29`）、時刻の付いた日付、`/` で区切った日付は 400 です（`invalid_format`）。1900-01-01 より前の日付は 400（`too_small`）、2999-12-31 より後の日付は 400（`too_big`）です（[リクエストの日付と日時の範囲](./api-db-type-constraints-mapping.md#リクエストの日付と日時の範囲)）
- **過ぎた使用期限も書けます**。期限の切れた在庫も、在庫として記録します（[期限切れ間近の一覧](#期限切れ間近の一覧)）
- 存在しないサロンと削除済みのサロンは 400 です（`salonId` の `not_found`）。サロンはパスではなく本文にあるので、ルートの 404 ではなく、本文の誤りです
- 成功すると 201 で、`Location` ヘッダーと `links.self` が、作成した在庫の行の場所を指します。在庫の 3 つの数は 0、`lastCountedAt` と `lastCountedBy` は null、`createdAt` と `updatedAt` は同じ時刻です

## ロット番号

在庫の行を、ロットで分けるかどうかは、商品の `requiresLotTracking` が決めます。

- **ロットで分ける商品（`requiresLotTracking` が true）の在庫の行は、ロット番号を書きます**。null は 400 です（`lotNumber` の `custom`。`Must name the lot: the product is kept by lots`）。カラー剤のように、ロットごとに使用期限が違い、問題のあったロットを探せる必要があるものです
- **ロットで分けない商品の在庫の行は、ロット番号を書きません**。文字列は 400 です（`Must be null: the product is not kept by lots`）
- **同じ商品の在庫の行は、サロンの中で、ロット番号が重なりません**。ロット番号のない行は、1 つの商品に 1 つです。重なると 409 で、`code` は `3002`、`detail` は `Inventory with lotNumber <ロット番号> already exists`（ロット番号のない行では `null`）です
- ロット番号は、書かれたとおりに比べます。大文字と小文字、前後の空白が違えば、別のロットです
- ほかの商品の在庫の行と同じロット番号は、使えます。削除した在庫の行のロット番号も、使えます
- この規則は、ロット番号を書くとき（作成と、`lotNumber` を書く更新）に、その時点の商品で確かめます。**商品の `requiresLotTracking` を変えても、在庫の行のロット番号は、そのままです**。ほかのプロパティだけを変える更新は、受け付けます。`lotNumber` を書く更新は、変えたあとの商品で確かめます

## 更新

更新リクエスト（`InventoryUpdateRequest`）は、変えるプロパティだけを書きます。書かなかったプロパティは、そのままです。

- 書けるプロパティは、作成リクエストの `salonId` と `productId` を除いたものです。規則も、作成と同じです
- プロパティを 1 つも書かないリクエストは 400 です（`custom`）。null を書くと、値を消します
- `lotNumber` を書く更新は、[ロット番号](#ロット番号) の規則を確かめます。その行がいま持っているロット番号を書いても、409 になりません
- `updatedAt` は、更新のたびに書きます（データベースの `clock_timestamp()`）。`createdAt` と在庫の数は、変わりません

## 削除

削除は、行を消します（204。本文はない）。在庫の行には、削除の印（`deletedAt`）がありません。

- **在庫数（`currentStock`）が 0 でない行は、削除できません**（409。`code` は `3003`）。`detail` は `The stock row cannot be deleted: it counts stock; bring it to zero with a stock movement first` です。引き当てた数も、在庫数に含まれます
- 在庫を 0 にするのは、在庫の移動です。使い切る（`use`、`sale`）、捨てる（`disposal`）、ほかのサロンに移す（`transfer`）、帳簿を直す（`adjustment`）のどれかか、棚卸しで 0 と数えることです
- **在庫の移動の記録（`inventory_transactions`）は、残ります**。記録が指す在庫の行（`inventoryId`）は null になり（`ON DELETE SET NULL`）、サロン、商品、ロット番号、使用期限は、記録に残ります。削除した行の履歴は、`GET /api/v1/inventory/{id}/movements` では読めません（404）
- 削除した行のロット番号は、同じ商品のほかの行が使えます
- **発注の明細も、残ります**。明細が指す在庫の行（`inventoryId`）は null になり、商品の商品コード、名前、単位は、明細に写してあります（[発注](./purchase-orders.md#発注と明細)）。発注の途中の行も、削除できます

## 1 件の取得と一覧

- 日時は UTC で、ミリ秒までの ISO 8601 形式です（`2026-11-20T03:40:00.000Z`）。使用期限は `YYYY-MM-DD` です。在庫の数は数値です（`12.5`）
- 一覧の並びは、商品の `productCode` の昇順、同じ商品の中ではロット番号の昇順（ロット番号のない行が先）、同じ値の中では `id` の昇順です（文字列の比較は、データベースの照合順序に従います）
- `admin` には、すべてのサロンの在庫の行を返します。サロンのユーザーには、`salonId` を書かなくても、所属サロンの在庫の行だけを返します
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後の在庫の行の ID です。操作者に届かない在庫の行を指す `cursor` は 400 です（`cursor` の `not_found`）
- `meta.total` は、絞り込みに一致する在庫の行の数です
- 絞り込みは、AND で結合します

| パラメーター | 一致する在庫の行 |
|---|---|
| `salonId` | そのサロンのもの。`admin` が、存在しないサロンを指定すると、空の一覧です |
| `productId` | その商品のもの |
| `lotNumber` | ロット番号が一致する（大文字と小文字を区別する）。空白だけでない文字列、100 文字まで |

- 表にないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回書くと 400 です（`invalid_type`）
- 保存されている行が API のモデルに合わないときは 500（データベースのエラー）です。読み出すときに検証します（`mappers/read/inventory.mapper.ts`）

## 在庫僅少の一覧

`GET /api/v1/inventory/low-stock` は、発注を考える商品の在庫の行を返します。発注点、最大在庫数、発注中の数量から、商品ごとに頼む数量を求めるのは、発注の提案です（[発注の提案](./purchase-orders.md#発注の提案)）。

- `salonId` は必須です
- **取り扱い中の商品（`isActive` が true）のうち、そのサロンの在庫数の合計（すべてのロットの `currentStock` の和）が、最低在庫数（`minimumStock`）以下のもの**の、すべての在庫の行を返します。最低在庫数と同じ数も、在庫僅少です
- `threshold` を書くと、商品ごとの最低在庫数の代わりに、その数と比べます。0 以上 99,999,999.99 以下の数値です
- 合計は、引き当てた数を含む在庫数で数えます
- **在庫の行が 1 つもない商品は、出ません**。一覧は、在庫の行の一覧だからです。商品を扱い始めるときは、在庫の行を作成します
- 並び、`limit`、`cursor` は、在庫の一覧と同じです。`cursor` は、そのサロンの在庫の行を指します
- 表にないパラメーター（`productId` など）は 400 です

## 期限切れ間近の一覧

`GET /api/v1/inventory/expiring` は、早く使うか、捨てる在庫の行を返します。

- `salonId` は必須です
- **在庫がある（`currentStock` が 0 より大きい）行のうち、使用期限が、サロンの今日から `days` 日後までのもの**を返します。今日も、`days` 日後の日も含みます。期限がもう過ぎた行も返します
- `days` は 0〜365 の整数で、既定は 30 です（`EXPIRING_SOON_DAYS`。在庫のアラートの期限切れ間近も、同じ 30 日です）。0 は、今日までに期限の来るものです
- 今日は、サロンのタイムゾーン（`salons.timezone`）で数えます。ランタイムが知らないタイムゾーンのサロンは 500 です（データベースのエラー）
- 使用期限のない行と、在庫が 0 の行は、出ません。取り扱いをやめた商品の行も、在庫があれば出ます
- 並びは、使用期限の昇順、同じ日の中では `id` の昇順です。`cursor` は、そのサロンの、使用期限のある在庫の行を指します。在庫が 0 になって一覧から外れた行も、カーソルにできます
- `limit` は、在庫の一覧と同じです。表にないパラメーター（`threshold` など）は 400 です

## 在庫の移動

`POST /api/v1/inventory/movement` は、1 つの在庫の行の在庫数を増減し、その 1 回の操作を記録します（在庫の移動）。`GET /api/v1/inventory/{id}/movements` は、在庫の行の在庫の移動の履歴を返します。

### 在庫操作区分

| `transactionType` | 意味 | `quantity` | `reason` | `staff` |
|---|---|---|---|---|
| `purchase` | 仕入れ | 正 | 任意 | 記録できる |
| `sale` | 店頭での販売 | 負 | 任意 | 記録できる |
| `use` | 施術での使用 | 負 | 任意 | 記録できる |
| `return` | 返品。仕入先に返すと負、顧客から戻ると正 | 正か負 | 任意 | 記録できる |
| `adjustment` | 帳簿の在庫数を、実際の数に合わせる | 正か負 | 必須 | 403 |
| `disposal` | 廃棄。期限切れ、破損など | 負 | 必須 | 403 |
| `transfer` | ほかのサロンとの間の移動 | 正か負 | 任意 | 403 |

- `quantity` は、在庫数の増減量です。0 は 400 です（`quantity` の `custom`。`Must not be 0`）。符号が区分に合わないと 400 です（`Must be above 0 for a purchase`、`Must be below 0 for a sale` など）
- `quantity` は小数第 2 位まで、−99,999,999.99 から 99,999,999.99 までの数値です
- **`adjustment` と `disposal` は、`reason` を書きます**。null は 400 です（`reason` の `custom`。`Must not be null: an adjustment and a disposal state why`）。どちらも、物が動いたのを見ずに在庫数を変えるか、在庫を帳簿から外すので、次に数える人が、理由を知る必要があるからです。ほかの区分では、null を書けます
- **在庫の行は、在庫の状態（破損、期限切れなど）を持ちません**。使えなくなった在庫は、`disposal` で在庫から外し、`reason` に理由を書きます
- **ほかのサロンへの移動は、2 件の在庫の移動です**。移動元のサロンの在庫の行に負の `transfer` を、移動先のサロンの在庫の行に正の `transfer` を、別々のリクエストで記録します。それぞれ、そのサロンの `owner` か `manager`、または `admin` が記録します。運んでいる途中の在庫は、どちらの行にも数えません
  - 2 件を結ぶときは、2 件目の `referenceType` に `inventory_transaction`、`referenceId` に 1 件目の在庫の移動の ID を書きます。サーバーは、2 件が対になっているかを確かめません
- サロンの中で保管場所を変えるのは、在庫の移動ではなく、在庫の行の更新（`location`、`shelf`）です。1 つの商品の 1 つのロットは、サロンの中で 1 つの行だからです

### 記録リクエストの規則

記録リクエスト（`InventoryMovementRequest`）は、すべてのキーが必須です。値がないものは、null を書きます。

| プロパティ | 規則 |
|---|---|
| `inventoryId` | 在庫の行の ID |
| `transactionType` | 在庫操作区分 |
| `quantity` | 在庫数の増減量（[在庫操作区分](#在庫操作区分)） |
| `unitCost` | null か、0 以上の整数。1 単位の価格（円） |
| `referenceType` | null か、空白だけでない文字列。50 文字まで |
| `referenceId` | null か、UUID |
| `reason` | null か、空白だけでない文字列 |

- 表にないキー（`salonId`、`balanceAfter`、`totalCost`、`performedBy` など）は 400 です（`unrecognized_keys`）。`salonId`、`productId`、`lotNumber`、`expiryDate` は在庫の行から、`balanceBefore`、`balanceAfter`、`totalCost` はサーバーが計算して、`performedBy` は操作者から書きます
- **`totalCost` は、`unitCost` × |`quantity`| を四捨五入した円です**。0.5 は 0 から遠いほうに丸めます（PostgreSQL の `numeric` の `round` と同じ）。`unitCost` が null なら、`totalCost` も null です
- `totalCost` が 2,147,483,647（`integer` の最大値）を超える `unitCost` は 400 です（`unitCost` の `too_big`）。`maximum` は、その `quantity` で書ける最大の `unitCost` です。`quantity` か `unitCost` が、それだけで規則に合わないときは、この規則を確かめません
- `referenceType` と `referenceId` は、関連する記録（発注、施術の記録など）の種別と ID です。両方を書くか、両方を null にします。一方だけは 400 です（null のほうの `custom`。`Must not be null when referenceId is given` など）。**サーバーは、指した記録があるかを確かめません**。発注の入荷が記録する在庫の移動は、`referenceType` が `purchase_order`、`referenceId` が発注の ID です（[入荷](./purchase-orders.md#入荷)）
- `performedBy` は、サロンのユーザーのスタッフ ID です。`admin` が記録した在庫の移動では null です

### 在庫数の範囲

- 在庫の移動は、在庫の行の `currentStock` と `availableStock` を、`quantity` だけ増減します。`reservedStock` は変えません。在庫の行の `updatedAt` も書きます
- **移動後の在庫数が、引き当てた数（`reservedStock`）を下回る在庫の移動は 409 です**（`code` は `3003`、`detail` は `The stock of the row would fall below its reserved stock`）。引き当てた数が 0 なら、在庫数が負になる在庫の移動です
- **移動後の在庫数が 99,999,999.99 を超える在庫の移動も 409 です**（`detail` は `The stock of the row would go above 99999999.99`）。在庫数のカラムは `numeric(10, 2)` です
- 409 のときは、何も書きません
- 成功すると 200 です。`data` は記録した在庫の移動で、`balanceBefore` は移動前の在庫数、`balanceAfter` は移動後の在庫数です。`salonId`、`productId`、`lotNumber`、`expiryDate` は、記録した時点の在庫の行の値です。`links` は、在庫の行（`inventory`）と、その履歴（`movements`）を指します。在庫の移動には、それだけを読むルートがありません
- **記録した在庫の移動は、変えも消しもしません**。誤りは、逆向きの在庫の移動（`adjustment` など）で直します

### 履歴

- 並びは、`createdAt` の降順、同じ時刻の中では `id` の降順です（新しい順）
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後の在庫の移動の ID です（`meta.nextCursor`）。その在庫の行の在庫の移動でない `cursor` は 400 です（`cursor` の `not_found`）
- `meta.total` は、絞り込みに一致する在庫の移動の数です
- 絞り込みは、AND で結合します

| パラメーター | 一致する在庫の移動 |
|---|---|
| `transactionType` | その区分のもの |
| `startDate` | `createdAt` が、その日時と同じか、あとのもの |
| `endDate` | `createdAt` が、その日時と同じか、前のもの。`startDate` より前の日時は 400 です（`endDate` の `custom`。`Must not be earlier than startDate`） |

- 日時は、`Z` で終わる UTC の ISO 8601 です（`2026-11-20T03:40:00.000Z`。ミリ秒は省けます）。時差を付けた日時と、秒のない日時は 400 です（`invalid_format`）。日付は 1900-01-01 から 2999-12-31 までです（[リクエストの日付と日時の範囲](./api-db-type-constraints-mapping.md#リクエストの日付と日時の範囲)）
- **`createdAt` は、レスポンスと同じミリ秒までの時刻で比べます**。データベースはマイクロ秒まで記録しますが、レスポンスで見た `createdAt` を `startDate` と `endDate` に書くと、その在庫の移動に一致します
- 表にないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回書くと 400 です

### 開始の在庫移動

在庫の行の在庫数は、その行の最後の在庫の移動の `balanceAfter` と同じです。在庫の移動は、1 件ずつ、前の在庫の移動が残した在庫数から記録するので、同じであり続けます。

- 在庫の移動を記録し始める前に、在庫数を書いたのはシードだけでした。マイグレーション `202611171500_inventory_transaction_rules.sql` は、在庫数が、最後の在庫の移動の `balanceAfter`（在庫の移動がなければ 0）と違う在庫の行に、差の分の `adjustment` を 1 件記録します。`reason` は `在庫移動の記録を始めた時点の在庫数`、`unitCost` と `performedBy` は null です
- シードも、在庫の行ごとに、同じ開始の在庫移動を入れます（[シード](#シード)）
- API で作成した在庫の行は、在庫数 0 で、在庫の移動がないので、開始の在庫移動はありません

## 棚卸し

`POST /api/v1/inventory/stock-count` は、サロンの在庫の行を実際に数えた数を記録し、帳簿の在庫数を数えた数に合わせます。

### 棚卸しリクエストの規則

棚卸しリクエスト（`InventoryStockCountRequest`）は、すべてのキーが必須です。

| プロパティ | 規則 |
|---|---|
| `salonId` | 棚卸しするサロンの ID |
| `items` | 1 件以上 500 件以下。同じ在庫の行を 2 回書かない |
| `items[].inventoryId` | `salonId` のサロンの在庫の行の ID |
| `items[].countedQuantity` | 数えた数。0 以上 99,999,999.99 以下、小数第 2 位まで |
| `reason` | null か、空白だけでない文字列 |

- 表にないキーは 400 です（`unrecognized_keys`）
- 同じ在庫の行を 2 回書くと、2 回目の位置で 400 です（`items.<n>.inventoryId` の `custom`。`Must not repeat a stock row counted earlier`）。英字を大文字で書いた ID も、同じ行です
- **数えるのは、`items` に書いた行だけです**。サロンのすべての行を書く必要はありません。書かなかった行は、何も変わりません

### 棚卸しが書くもの

- **数えた数と在庫数（`currentStock`）が違う行には、差（数えた数 − 在庫数）の `adjustment` を 1 件記録し**、在庫数を数えた数に、使える数を数えた数 − 引き当てた数にします。差がない行には、在庫の移動を記録しません
- 調整の `reason` は、リクエストの `reason` です。null なら `棚卸しの差異` と書きます（`adjustment` には理由が要るためです）。`unitCost`、`totalCost`、`referenceType`、`referenceId` は null、`performedBy` は操作したスタッフ（`admin` は null）、`balanceBefore` は棚卸し前の在庫数、`balanceAfter` は数えた数です
- **書いたすべての行の `lastCountedAt` を棚卸しの時刻に、`lastCountedBy` を操作したスタッフ（`admin` は null）にします**。差がない行も書きます。`updatedAt` も書きます
- **1 回の棚卸しは、1 つの時刻です**。行の `lastCountedAt` と `updatedAt`、調整の `createdAt` は、すべての行をロックしたあとの同じ時刻です（[同時に届いたリクエスト](#同時に届いたリクエスト)）。履歴では、同じ棚卸しの調整は同じ時刻に並びます
- **全部の行を処理するか、どの行も処理しません**。`salonId` のサロンの在庫の行でない行（ほかのサロンの行、削除した行、存在しない ID）が 1 つでもあると 400 で（`items.<n>.inventoryId` の `not_found`。`Must name a stock row of the salon`）、そういう行をすべて報告します
- **数えた数が引き当てた数（`reservedStock`）を下回る行があると 409 です**（`code` は `3003`、`detail` は `What was counted of stock row <id> is below its reserved stock`。リクエストの順で最初の行）。何も書きません。いまは引き当てを書くオペレーションがないので、API で作成した行では起きません
- 成功すると 200 です。`data.adjustments` は記録した調整の在庫の移動、`data.discrepancies` は差のあった行の `inventoryId`、`expected`（棚卸し前の在庫数）、`counted`（数えた数）、`difference`（`counted` − `expected`）で、どちらもリクエストの `items` の順です。差がなければ、どちらも空の配列です。`links` は null です

## 在庫評価額

`GET /api/v1/inventory/value-report` は、サロンの在庫が、仕入価格でいくらになるかを、商品のカテゴリごとに返します。

- `salonId` は必須です。`category` を書くと、そのカテゴリだけを返します（完全一致。大文字と小文字、前後の空白も区別します。空白だけでない文字列、100 文字まで）
- **評価額は、在庫の行の在庫数（`currentStock`）× 商品の仕入価格（`purchasePrice`）の和です**。仕入価格が null の商品は 0 として数えます。引き当てた数も、在庫数に含まれます
- **カテゴリの `value` は、そのカテゴリの和を円に四捨五入した値です**。行ごとには丸めません。`totalValue` は、カテゴリの `value` の和です（合計とカテゴリの和は一致します）
- `itemCount` は、そのカテゴリの、在庫のある商品の数です。ロットが分かれていても 1 品目です。`totalItems` は、`itemCount` の和です
- 在庫が 0 の行は数えません。在庫のある商品がないカテゴリは出ません。取り扱いをやめた商品（`isActive` が false）も、在庫があれば数えます
- カテゴリが null の商品は、`category` が null の 1 つにまとめます
- 並びは、`value` の降順、同じ値の中では `category` の昇順（null は最後。文字列の比較は、データベースの照合順序に従います）です
- 一致するものがなければ、`categories` は空の配列で、合計は 0 です
- 評価額は、JavaScript の数値で正確に表せる整数（9,007,199,254,740,991 円）までです。超えるときは 500（データベースのエラー）です
- 表にないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回書くと 400 です（`invalid_type`）
- 成功すると 200 で、`links.self` はリクエストの URL です

## 同時に届いたリクエスト

- **ロットの重なりは、一意制約と一意インデックスが決めます**。同じロットの作成が同時に何件も届くと、1 件が 201 で、ほかは 409 です。ロット番号のない行の作成も同じです。2 つの行を同じロットに変える更新が同時に届くと、1 件が 200 で、もう 1 件は 409 です
- **作成は、商品の行を `FOR KEY SHARE` でロックしてから、商品を確かめます**（`READ COMMITTED` のトランザクション）。これは、商品の更新と削除がとるロック（`FOR UPDATE`）と互いに待つロックです。更新か削除の途中の商品への作成は、それを待ち、削除された商品なら 400、`requiresLotTracking` が変わった商品なら、変わったあとの規則で確かめます。商品の削除も、書いている途中の在庫の行を待ちます（[商品の同時に届いたリクエスト](./products.md#同時に届いたリクエスト)）
- `lotNumber` を書く更新は、在庫の行とその商品を 1 つの文で読み、商品を `FOR KEY SHARE` でロックしてから確かめます。ほかのプロパティだけの更新は、商品を待ちません。更新の文は、読む人の範囲の行だけを書き、行を返さなければ 404 です
- **削除は、在庫の行を `FOR UPDATE` でロックしてから、在庫数を確かめます**。在庫の移動が同じ行を書いている途中なら、それを待ち、在庫が残れば 409 です
- **在庫の移動は、在庫の行を `FOR UPDATE` でロックしてから、移動後の在庫数を確かめます**（`READ COMMITTED` のトランザクション）。同じ行の在庫の移動は 1 件ずつ、前の在庫の移動が残した在庫数から書きます。在庫が 5 の行に、1 つずつの販売が同時に 8 件届くと、5 件が 200 で、3 件は 409 です。ほかの行の在庫の移動は、待ちません
- 在庫の移動は、更新か削除の途中の行を待ちます。削除されれば 400（`inventoryId` の `not_found`）で、何も書きません
- 在庫の移動の `createdAt` と、在庫の行の `updatedAt` は、書いた時刻（データベースの `clock_timestamp()`）です。ロックを待った在庫の移動は、待ったあとの時刻です
- ロックした在庫の行への書き込み（在庫の移動と棚卸し）と、在庫の移動と調整の記録が行を返さないのは、書き込みを飛ばすトリガーがあるときだけです。そのときはデータベースのエラー（500）です。何行かを書く棚卸しは、書いた行と記録を、数えた行ごとに組みにして確かめます
- **棚卸しは、書いた行を、ID の順に `FOR UPDATE` でロックしてから、数えた数と比べます**（`READ COMMITTED` のトランザクション）。同じ行の在庫の移動、更新、削除、ほかの棚卸しと、互いに待ちます。在庫の移動か更新を待った棚卸しは、待ったあとの行と比べます。削除を待った棚卸しは、その行を、存在しない行として 400 にします
- ID の順にロックするので、行の重なる 2 つの棚卸しは、行を書いた順が違っても、互いを待ち続けません
- 棚卸しの時刻は、すべての行をロックしたあとに、行を書き始めた時刻（データベースの `statement_timestamp()`）です。ロックを待った棚卸しは、待ったあとの時刻です
- 更新は、削除の途中の行を待ちます。削除されれば 404 で、何も書きません。同じ行の削除が同時に何件も届くと、1 件が 204 で、ほかは 404 です
- 在庫の移動、棚卸し、更新、削除は、その行か、その行の商品のアラートの確認の途中なら、それを待ちます。確認は、行を `FOR SHARE` でロックします（[在庫のアラート](./inventory-alerts.md#同時に届いたリクエスト)）
- 取得、一覧、在庫評価額は、ロックを待ちません。在庫評価額は、1 つの SQL 文で読みます。在庫の移動の履歴は、1 つのスナップショット（`REPEATABLE READ` の読み取り専用のトランザクション）で、在庫の行、カーソル、ページ、件数を読みます

## DB の制約

マイグレーション `202611171400_inventory_rules.sql` で、次のものを加えました。

- CHECK 制約 `inventory_stock`: `currentStock` と `reservedStock` は 0 以上、`reservedStock` ≦ `currentStock`、`availableStock` = `currentStock` − `reservedStock`
- 部分一意インデックス `inventory_unique_without_lot`（`salonId`、`productId`。`lotNumber` が NULL の行だけ）。ロット番号のある行の一意性は、もとからある一意制約 `inventory_unique`（`salonId`、`productId`、`lotNumber`）が守ります。この制約は、NULL どうしを別の値として比べるので、ロット番号のない行は、インデックスで 1 つにします
  - 制約に `NULLS NOT DISTINCT` を付けても同じ規則になりますが、drizzle-kit 0.31.11 は、イントロスペクションで、どの一意制約も `NULLS DISTINCT` として読みます。`schema.ts` と `setup.sql` は、その読んだ結果から作るので、部分一意インデックスにしました

違反する行があると、マイグレーションは失敗し、何も変えません。行を直してから、やり直します。マイグレーションは、何度適用しても同じ結果です。以前のバージョンは、在庫の行を書かないので、マイグレーションを適用したあとも動きます。新しいバージョンは、[リリースの手順](./release-workflow.md) のとおり、起動する前にマイグレーションを適用します。

マイグレーション `202611171500_inventory_transaction_rules.sql` で、在庫の移動（`inventory_transactions`）に、次のものを加えました。

- CHECK 制約 `inventory_transactions_quantity_of_type`: `quantity` は 0 でない。`purchase` は正、`sale`、`use`、`disposal` は負
- CHECK 制約 `inventory_transactions_balance`: `balanceBefore` と `balanceAfter` は 0 以上、`balanceAfter` = `balanceBefore` + `quantity`
- CHECK 制約 `inventory_transactions_cost`: `unitCost` と `totalCost` は、両方 null か、両方あって `unitCost` ≧ 0、`totalCost` = round(`unitCost` × |`quantity`|)
- CHECK 制約 `inventory_transactions_reference_pair`: `referenceType` と `referenceId` は、両方 null か、両方ある
- CHECK 制約 `inventory_transactions_reason_of_type`: `adjustment` と `disposal` は `reason` がある
- インデックス `idx_inventory_transactions_inventory_time`（`inventoryId`、`createdAt`、`id`）。履歴の並びのためのもので、在庫の行だけのインデックス `idx_inventory_transactions_inventory_id` を置き換えました
- 開始の在庫移動（[開始の在庫移動](#開始の在庫移動)）

違反する在庫の移動があると、マイグレーションは失敗し、何も変えません。どのカラムが誤りかは決められないので、記録を直してから、やり直します。マイグレーションは、何度適用しても同じ結果です（開始の在庫移動は、在庫数が違う行にだけ記録します）。以前のバージョンは、在庫の移動を書かず、在庫数も変えないので、マイグレーションを適用したあとも動きます。

マイグレーション `202611171700_inventory_alert_acknowledgements.sql` は、在庫の移動の商品だけのインデックス `idx_inventory_transactions_product_id` を、`idx_inventory_transactions_product_time`（`productId`、`createdAt`）に置き換えました。在庫のアラートが、確認してからの商品の在庫の移動を読むためのものです（[在庫のアラート](./inventory-alerts.md)）。

在庫の行は、外部キーで、サロン（`inventory_salon_id_fk`）と商品（`inventory_product_id_fk`）を指します。どちらも `ON DELETE CASCADE` です。API のサロンと商品の削除は、行を残す論理削除です。在庫の移動の記録は、外部キー（`inventory_transactions_inventory_id_fk`。`ON DELETE SET NULL`）で在庫の行を指します。`lastCountedBy` は、外部キーのない UUID です。

## シード

`pnpm db:seed` は、1 つ目のサロンの、ロットで分ける 6 件の商品に、在庫の行を 1 つずつ入れます。どれも、在庫数 20、引き当て 0、ロット番号は `LOT-2024-` と 3 桁の乱数、使用期限は 2025-12-31、保管場所は `Storage Room A` です。

- 使用期限が過ぎているので、6 行とも、期限切れ間近の一覧に出ます
- 6 件の商品の最低在庫数は 3〜10 なので、在庫僅少の一覧には出ません。`threshold=20` を書くと、6 行とも出ます
- 在庫の行ごとに、開始の在庫移動（`adjustment`、`quantity` 20、`balanceBefore` 0、`balanceAfter` 20）を 1 件入れます（[開始の在庫移動](#開始の在庫移動)）。履歴は、その 1 件から始まります
- 在庫があるので、削除できません（409）。在庫の移動か棚卸しで在庫数を 0 にすると、削除できます。その 6 件の商品は、在庫の行があるので、削除できません（[商品](./products.md)）

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/inventory.tsp`（`InventoryResponse`、`InventoryCreateRequest`、`InventoryUpdateRequest`、`InventorySearchRequest`、`InventoryLowStockSearchRequest`、`InventoryExpiringSearchRequest`、`InventoryMovementRequest`、`InventoryTransactionResponse`、`InventoryTransactionSearchRequest`、`InventoryStockCountItem`、`InventoryStockCountRequest`、`InventoryStockCountDiscrepancy`、`InventoryStockCountResponse`、`InventoryValueReportRequest`、`InventoryValueReportCategory`、`InventoryValueReportResponse`）、`specs/operations/inventory-operations.tsp`（`InventoryCrud`） |
| ドメイン | `backend/packages/domain/src/models/inventory.ts`、`schemas/inventory.schema.ts`、`mappers/read/inventory.mapper.ts`（在庫の行のほかに、3 つの一覧のページも作る）、`mappers/write/inventory.mapper.ts`（作成と更新の行のほかに、3 つの一覧の条件も作る。期限切れ間近の日数の既定値も、ここで決める）、`mappers/read/inventory-transaction.mapper.ts`（在庫の移動と、履歴のページ）、`mappers/write/inventory-transaction.mapper.ts`（リクエストを、動かす在庫の行と、記録する移動に分ける。履歴の条件も作る）、`mappers/read/inventory-report.mapper.ts`（棚卸しの結果と在庫評価額）、`mappers/write/inventory-report.mapper.ts`（棚卸しで数えた数と、在庫評価額の条件。棚卸しの理由 `STOCK_COUNT_REASON` も）、`repositories/inventory.repository.ts`、`business-logic/inventory/`（誰が読み、誰が管理し、誰がどの在庫の移動を記録するかは `_shared/authorization.ts`、ロット番号の規則は `_shared/lots.ts`、期限切れ間近の最後の日は `_shared/expiry.ts`、在庫操作区分の規則と金額は `_shared/movements.ts`、サロンがないときと、カーソルの行が一覧にないときの答えは `_shared/refusals.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/inventory.repository.impl.ts` |
| API | `backend/packages/api/src/routes/inventory/`（`/api/v1/inventory` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611171400_inventory_rules.sql`、`202611171500_inventory_transaction_rules.sql`、シードは `backend/packages/database/src/seeds/seed-data/products.ts` |
| テスト | `backend/packages/domain/src/schemas/__tests__/inventory.schema.test.ts`、`backend/packages/domain/src/business-logic/inventory/__tests__/inventory.rules.test.ts`、`backend/packages/domain/src/mappers/__tests__/inventory.mapper.test.ts`、`backend/packages/domain/src/business-logic/inventory/__tests__/inventory.usecase.test.ts`、`inventory-movement.rules.test.ts`、`backend/packages/domain/src/schemas/__tests__/inventory-movement.schema.test.ts`、`backend/packages/domain/src/mappers/__tests__/inventory-movement.mapper.test.ts`、`backend/packages/domain/src/business-logic/inventory/__tests__/inventory-movement.usecase.test.ts`、`backend/packages/domain/src/schemas/__tests__/inventory-report.schema.test.ts`、`backend/packages/domain/src/mappers/__tests__/inventory-report.mapper.test.ts`、`backend/packages/domain/src/business-logic/inventory/__tests__/inventory-report.usecase.test.ts`、`backend/packages/api/src/routes/inventory/__tests__/inventory.integration.test.ts`、`inventory-movement.integration.test.ts`、`inventory-count.integration.test.ts`、`backend/packages/infrastructure/src/repositories/__tests__/inventory.repository.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
