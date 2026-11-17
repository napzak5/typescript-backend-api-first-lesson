# 在庫

サロンの在庫（`inventory`）の規則をまとめます。コントラクトは `specs/operations/inventory-operations.tsp`（`InventoryOperations` の `InventoryCrud`）と `specs/models/inventory.tsp`、テーブルは `inventory` です。

在庫の 1 行（在庫の行）は、サロンにある 1 つの商品の 1 つのロットです。どれだけあるか、どこにあるか、いつ使用期限が来るかを記録します。管理者とサロンのスタッフが `/api/v1/inventory` で扱います。顧客のアカウントは、このルートを使えません。商品そのものは [商品](./products.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 在庫の行の一覧、作成、1 件の取得、更新、削除（`list`、`create`、`get`、`update`、`delete`） | 実装済み |
| 在庫僅少の一覧（`listLowStock`）、期限切れ間近の一覧（`listExpiring`） | 実装済み |
| 在庫の移動の記録と一覧（`recordMovement`、`listMovements`）、棚卸し（`performStockCount`） | 未実装（ルートがなく、404） |
| 在庫評価額（`getValueReport`） | 未実装。`GET /api/v1/inventory/value-report` は 1 件の取得のルートが受け取り、`value-report` を在庫の ID として確かめるので、読める人には 400（`id` の `invalid_format`）です |
| 発注（`PurchaseOrderCrud`）と在庫のアラート（`InventoryAlertCrud`） | 未実装（ルートがなく、404。テーブルもない） |

- 在庫の数（`currentStock`、`availableStock`、`reservedStock`）と、棚卸しの記録（`lastCountedAt`、`lastCountedBy`）を書くのは、在庫の移動と棚卸しです。どちらもまだないので、API で作成した在庫の行の数は 0 のままです
- 次のものは、ありません
  - 在庫を引き当てるオペレーション。`reservedStock` は、API で作成した行では 0 です
  - 顧客に、在庫を見せるルート
  - 削除した在庫の行を戻すオペレーション。削除は行を消します（[削除](#削除)）

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

- **在庫の行は、在庫数 0 で作成します**。入庫は、在庫の移動（未実装）で記録します。作成と更新のリクエストに、在庫の数と棚卸しの記録を書くと 400 です（`unrecognized_keys`）
- 在庫の行は、サロンと商品を変えません。更新のリクエストに `salonId` と `productId` を書くと 400 です（`unrecognized_keys`）。ほかのサロンに移すのは、在庫の移動です
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

- すべてのオペレーションに認証が要ります
- ルートは、サロンの下にありません。どのサロンの在庫かは、作成では本文の `salonId`、一覧ではクエリの `salonId`、取得、更新、削除では在庫の行そのものが決めます。権限は、売上台帳と同じ 2 段階で判定します（`business-logic/inventory/_shared/authorization.ts`）
- 1 段階目は、操作者だけで決まります。読むこと（`inventoryReachOf`）は、`admin` と、サロンの 3 つのロールができます。施術で商品を棚から出し、店頭で売るスタッフが、在庫を知る必要があるからです。作成、更新、削除（`inventoryKeeperReachOf`）は、商品と同じく、`owner` と `manager` のものです。`staff`、ロール `customer` のユーザー、範囲 `none` のユーザーは、本文、クエリ、ID が不正でも 403 です
- 2 段階目は、本文かクエリを確かめたあとに決まります（`isWithin`）。サロンのユーザーが、ほかのサロンを指定すると、サロンが存在するかどうかにかかわらず 403 です。本文かクエリが不正なら、その前に 400 です。不正なリクエストへの 400 は、指定したサロンについて何も伝えません
- **ほかのサロンの在庫の行は、存在しない行と区別しません**。取得、更新、削除は 404（`detail` は `Inventory <id> was not found`）です。一覧の `cursor` に指定すると 400 です
- 在庫のための権限（`users.permissions`）はありません
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
- 在庫を 0 にするのは、在庫の移動（未実装）です。それまでは、API で作成した行（在庫数 0）だけを削除できます
- **在庫の移動の記録（`inventory_transactions`）は、残ります**。記録が指す在庫の行（`inventoryId`）は null になり（`ON DELETE SET NULL`）、商品とロット番号は、記録に残ります
- 削除した行のロット番号は、同じ商品のほかの行が使えます

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

`GET /api/v1/inventory/low-stock` は、発注を考える商品の在庫の行を返します。

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
- `days` は 0〜365 の整数で、既定は 30 です。0 は、今日までに期限の来るものです
- 今日は、サロンのタイムゾーン（`salons.timezone`）で数えます。ランタイムが知らないタイムゾーンのサロンは 500 です（データベースのエラー）
- 使用期限のない行と、在庫が 0 の行は、出ません。取り扱いをやめた商品の行も、在庫があれば出ます
- 並びは、使用期限の昇順、同じ日の中では `id` の昇順です。`cursor` は、そのサロンの、使用期限のある在庫の行を指します。在庫が 0 になって一覧から外れた行も、カーソルにできます
- `limit` は、在庫の一覧と同じです。表にないパラメーター（`threshold` など）は 400 です

## 同時に届いたリクエスト

- **ロットの重なりは、一意制約と一意インデックスが決めます**。同じロットの作成が同時に何件も届くと、1 件が 201 で、ほかは 409 です。ロット番号のない行の作成も同じです。2 つの行を同じロットに変える更新が同時に届くと、1 件が 200 で、もう 1 件は 409 です
- **作成は、商品の行を `FOR KEY SHARE` でロックしてから、商品を確かめます**（`READ COMMITTED` のトランザクション）。これは、商品の更新と削除がとるロック（`FOR UPDATE`）と互いに待つロックです。更新か削除の途中の商品への作成は、それを待ち、削除された商品なら 400、`requiresLotTracking` が変わった商品なら、変わったあとの規則で確かめます。商品の削除も、書いている途中の在庫の行を待ちます（[商品の同時に届いたリクエスト](./products.md#同時に届いたリクエスト)）
- `lotNumber` を書く更新も、同じように商品をロックしてから確かめます。ほかのプロパティだけの更新は、商品を待ちません
- **削除は、在庫の行を `FOR UPDATE` でロックしてから、在庫数を確かめます**。在庫の移動（未実装）が同じ行を書いている途中なら、それを待ち、在庫が残れば 409 です
- 更新は、削除の途中の行を待ちます。削除されれば 404 で、何も書きません。同じ行の削除が同時に何件も届くと、1 件が 204 で、ほかは 404 です
- 取得と一覧は、ロックを待ちません

## DB の制約

マイグレーション `202611171400_inventory_rules.sql` で、次のものを加えました。

- CHECK 制約 `inventory_stock`: `currentStock` と `reservedStock` は 0 以上、`reservedStock` ≦ `currentStock`、`availableStock` = `currentStock` − `reservedStock`
- 部分一意インデックス `inventory_unique_without_lot`（`salonId`、`productId`。`lotNumber` が NULL の行だけ）。ロット番号のある行の一意性は、もとからある一意制約 `inventory_unique`（`salonId`、`productId`、`lotNumber`）が守ります。この制約は、NULL どうしを別の値として比べるので、ロット番号のない行は、インデックスで 1 つにします
  - 制約に `NULLS NOT DISTINCT` を付けても同じ規則になりますが、drizzle-kit 0.31.11 は、イントロスペクションで、どの一意制約も `NULLS DISTINCT` として読みます。`schema.ts` と `setup.sql` は、その読んだ結果から作るので、部分一意インデックスにしました

違反する行があると、マイグレーションは失敗し、何も変えません。行を直してから、やり直します。マイグレーションは、何度適用しても同じ結果です。以前のバージョンは、在庫の行を書かないので、マイグレーションを適用したあとも動きます。新しいバージョンは、[リリースの手順](./release-workflow.md) のとおり、起動する前にマイグレーションを適用します。

在庫の行は、外部キーで、サロン（`inventory_salon_id_fk`）と商品（`inventory_product_id_fk`）を指します。どちらも `ON DELETE CASCADE` です。API のサロンと商品の削除は、行を残す論理削除です。在庫の移動の記録は、外部キー（`inventory_transactions_inventory_id_fk`。`ON DELETE SET NULL`）で在庫の行を指します。`lastCountedBy` は、外部キーのない UUID です。

## シード

`pnpm db:seed` は、1 つ目のサロンの、ロットで分ける 6 件の商品に、在庫の行を 1 つずつ入れます。どれも、在庫数 20、引き当て 0、ロット番号は `LOT-2024-` と 3 桁の乱数、使用期限は 2025-12-31、保管場所は `Storage Room A` です。

- 使用期限が過ぎているので、6 行とも、期限切れ間近の一覧に出ます
- 6 件の商品の最低在庫数は 3〜10 なので、在庫僅少の一覧には出ません。`threshold=20` を書くと、6 行とも出ます
- 在庫があるので、削除できません（409）。その 6 件の商品も、削除できません（[商品](./products.md#シード)）

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/inventory.tsp`（`InventoryResponse`、`InventoryCreateRequest`、`InventoryUpdateRequest`、`InventorySearchRequest`、`InventoryLowStockSearchRequest`、`InventoryExpiringSearchRequest`）、`specs/operations/inventory-operations.tsp`（`InventoryCrud`） |
| ドメイン | `backend/packages/domain/src/models/inventory.ts`、`schemas/inventory.schema.ts`、`mappers/read/inventory.mapper.ts`、`mappers/write/inventory.mapper.ts`、`repositories/inventory.repository.ts`、`business-logic/inventory/`（誰が読み、誰が管理するかは `_shared/authorization.ts`、ロット番号の規則は `_shared/lots.ts`、期限切れ間近の最後の日は `_shared/expiry.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/inventory.repository.impl.ts` |
| API | `backend/packages/api/src/routes/inventory/`（`/api/v1/inventory` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611171400_inventory_rules.sql` |
| テスト | `backend/packages/domain/src/__tests__/inventory.schema.test.ts`、`inventory.rules.test.ts`、`inventory.mapper.test.ts`、`inventory.usecase.test.ts`、`backend/packages/api/src/__tests__/inventory.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
