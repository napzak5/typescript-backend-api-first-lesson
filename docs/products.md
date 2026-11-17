# 商品

サロンの商品（`products`）の規則をまとめます。コントラクトは `specs/operations/inventory-operations.tsp`（`ProductOperations` の `ProductCrud`）と `specs/models/inventory.tsp`、テーブルは `products` です。

商品は、サロンが店頭で売るもの（シャンプー、スタイリング剤など）と、施術で使うもの（カラー剤、ブリーチ剤など）の一覧です。サロンごとに持ち、管理者とサロンのスタッフが `/api/v1/salons/{salonId}/products` で扱います。顧客のアカウントは、このルートを使えません。

商品の在庫（`inventory`）は [在庫](./inventory.md) にあります。在庫の移動（`inventory_transactions`）、棚卸し、在庫評価額も、[在庫](./inventory.md) にあります。発注と在庫のアラートは、まだ実装していません（[実装範囲](#実装範囲)）。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 商品（`ProductCrud`）の一覧、作成、1 件の取得、更新、削除（`list`、`create`、`get`、`update`、`delete`） | 実装済み |
| 在庫の行（`InventoryCrud` の一覧、作成、1 件の取得、更新、削除、在庫僅少、期限切れ間近）、在庫の移動（`recordMovement`、`listMovements`）、棚卸し（`performStockCount`）、在庫評価額（`getValueReport`） | 実装済み（[在庫](./inventory.md)） |
| 発注（`PurchaseOrderCrud`）と在庫のアラート（`InventoryAlertCrud`） | 未実装（ルートがなく、404。テーブルもない） |

- 次のものは、ありません
  - 顧客に、商品を見せるルート
  - 商品の在庫数を、商品のレスポンスに含めること。在庫は、在庫のオペレーションで扱います
  - カテゴリー、ブランド、仕入先の台帳。`category`、`brand`、`supplier` は、サロンが書く文字列です
  - 価格を変えた履歴（テーブルがない）
  - 画像と安全データシートのファイルを受け取ること。`imageUrl` と `safetyDataSheet` は、ほかの場所にあるファイルの URL です
  - 削除した商品を戻すオペレーション
  - サロンを作成したときに、商品を自動で用意すること。新しいサロンの商品は、空です

## 商品は、サロンのカタログ

1 件の商品は、サロンが扱う品物の 1 つです。

| プロパティ | 意味 |
|---|---|
| `productCode` | 商品コード。サロンが付ける（[商品コード](#商品コード)） |
| `name` | 商品名 |
| `description` | 説明。なければ null |
| `category` | 商品カテゴリー。在庫評価額をカテゴリー別に集計する単位。なければ null |
| `brand` | ブランド。なければ null |
| `purchasePrice` | 仕入価格（円）。なければ null |
| `retailPrice` | 希望小売価格（定価、円）。なければ null |
| `salonPrice` | サロンの店頭での販売価格（円）。なければ null |
| `unit` | 数量の単位（本、ml など） |
| `minimumStock` | 最低在庫数。在庫数がこれを下回らないように発注する |
| `reorderPoint` | 発注点。在庫数がこれ以下になったら発注する。なければ null |
| `maximumStock` | 最大在庫数。なければ null |
| `supplier` | 仕入先の名前。なければ null |
| `supplierProductCode` | 仕入先の商品コード。なければ null |
| `leadTimeDays` | 発注から納品までの日数。なければ null |
| `imageUrl` | 商品画像の URL。なければ null |
| `barcode` | バーコード。なければ null |
| `isForSale` | 店頭で販売する商品か |
| `isForTreatment` | 施術で使う商品か |
| `requiresLotTracking` | 在庫をロット番号で分けて管理するか |
| `expiryMonths` | 使用期限までの月数の目安。なければ null |
| `storageConditions` | 保管条件。なければ null |
| `safetyDataSheet` | 安全データシート（SDS）の URL。なければ null |
| `isActive` | 取り扱い中か。取り扱いをやめた商品は false |

- **価格の null と 0 は、別の値です**。null は「記録していない」、0 は「0 円」です。3 つの価格の大小は、問いません（仕入価格より安く売ることも、定価より高く売ることもある）
- **`minimumStock` は、必ずあります**（既定は 0）。`reorderPoint` と `maximumStock` は、なくてもかまいません（[在庫の水準](#在庫の水準)）
- **`isForSale` と `isForTreatment` は、両方が false でもかまいません**（備品など）
- **売上は、商品の価格と名前を使いません**。売上の明細は、売った時点の名前と金額を持ちます（[売上台帳](./sales.md)）。明細が指せるのは、削除されていない、そのサロンの商品です。`isActive`、`isForSale` は問いません
- `supplierId`（どのテーブルも指していなかった）は、マイグレーションで `supplier`（仕入先の名前）に置き換えました（[DB の制約](#db-の制約)）

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/salons/{salonId}/products` | `admin`、そのサロンの `owner` / `manager` / `staff` |
| 作成 | `POST /api/v1/salons/{salonId}/products` | `admin`、そのサロンの `owner` / `manager` |
| 1 件の取得 | `GET /api/v1/salons/{salonId}/products/{id}` | `admin`、そのサロンの `owner` / `manager` / `staff` |
| 更新 | `PATCH /api/v1/salons/{salonId}/products/{id}` | `admin`、そのサロンの `owner` / `manager` |
| 削除 | `DELETE /api/v1/salons/{salonId}/products/{id}` | `admin`、そのサロンの `owner` / `manager` |

- すべてのオペレーションに認証が要ります
- 誰が使えるかは、パスのサロンだけで決まります（`business-logic/product/_shared/authorization.ts` の `mayReadProducts` と `mayKeepProducts`）。`admin` はすべてのサロン、サロンのユーザーは所属サロンです。商品のための権限（`users.permissions`）はありません
- 読むことは、サロンの 3 つのロールができます。施術で商品を使い、店頭で売るスタッフが、商品を知る必要があるからです。作成、更新、削除は、メニューや支払い方法と同じく、`owner` と `manager` のものです。`staff` は、ID や本文を確かめる前に 403 です
- **顧客のアカウントは、このルートを使えません**（403）。レスポンスは、仕入価格と仕入先を含みます。ロールに必要なレコードを持たないユーザー（範囲 `none`）も 403 です
- **ほかのサロンのユーザーは、サロンが存在するかどうかにかかわらず 403 です**。サロンを探す前に、権限を確かめます
- 存在しないサロンと、削除済みのサロンは 404 です（権限のある操作者に）
- **ほかのサロンの商品と、削除した商品は、存在しない商品と区別しません**。取得、更新、削除は 404（`detail` は `Product <id> was not found`）、カーソルに指定すると 400 です
- ID（パスの `salonId` と `id`、クエリの `cursor`）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です

### 確認の順序

一覧:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの商品を読めること（403）
4. クエリ（400。`detail` は `Invalid product search`）
5. サロンの存在（404）
6. `cursor` が、そのサロンの削除されていない商品を指すこと（400。`cursor` の `not_found`）

作成:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの商品を管理できること（403）
4. リクエストの本文（400。`detail` は `Invalid product`）
5. サロンの存在（404）
6. 商品コードが、そのサロンの削除されていない商品と重ならないこと（409。[商品コード](#商品コード)）

1 件の取得:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの商品を読めること（403）
4. パスの `id` の形式（400。`detail` は `Invalid product ID`）
5. サロンの存在（404）
6. 商品の存在（404）

更新:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの商品を管理できること（403）
4. パスの `id` の形式（400）
5. リクエストの本文（400。`detail` は `Invalid product update`）
6. サロンの存在（404）
7. 商品の存在（404）
8. 更新後の在庫の水準（400。[在庫の水準](#在庫の水準)）
9. 商品コードが、ほかの商品と重ならないこと（409）

削除:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの商品を管理できること（403）
4. パスの `id` の形式（400）
5. サロンの存在（404）
6. 商品の存在（404）
7. その商品の在庫のレコードがないこと（409。[削除](#削除)）

JSON として読めない本文は、ほかのルートと同じく、アクセストークンより前に 400（`code` は `2002`）です。JSON でない `Content-Type` は 415 です。

## 作成リクエストの規則

作成リクエスト（`ProductCreateRequest`）は、すべてのキーが必須です。値がないものは、null を書きます。

| プロパティ | 規則 |
|---|---|
| `productCode` | 空白だけでない文字列。100 文字まで |
| `name` | 空白だけでない文字列。255 文字まで |
| `description` | null か、空白だけでない文字列 |
| `category` | null か、空白だけでない文字列。100 文字まで |
| `brand` | null か、空白だけでない文字列。100 文字まで |
| `purchasePrice`、`retailPrice`、`salonPrice` | null か、0 以上の整数 |
| `unit` | 空白だけでない文字列。20 文字まで |
| `minimumStock` | 0 以上 99,999,999.99 以下の数値。小数は 2 桁まで。null は不可 |
| `maximumStock`、`reorderPoint` | null か、`minimumStock` と同じ範囲の数値（[在庫の水準](#在庫の水準)） |
| `supplier` | null か、空白だけでない文字列。255 文字まで |
| `supplierProductCode` | null か、空白だけでない文字列。100 文字まで |
| `leadTimeDays` | null か、0 以上の整数 |
| `imageUrl`、`safetyDataSheet` | null か、`http` か `https` の URL（ホスト名はドメイン名）。500 文字まで |
| `barcode` | null か、空白だけでない文字列。100 文字まで |
| `isForSale`、`isForTreatment`、`requiresLotTracking`、`isActive` | 真偽値 |
| `expiryMonths` | null か、1 以上の整数 |
| `storageConditions` | null か、空白だけでない文字列 |

- サロンは、パスが決めます。本文に `salonId` を書くと 400 です。`id`、`deletedAt`、`createdAt`、`updatedAt`、以前のカラムの `supplierId` も同じです（`unrecognized_keys`）
- 文字列は、前後の空白を含めて、そのまま保存します。空白だけの文字列（全角の空白を含む）は 400 です（`invalid_format`）
- 文字数は、文字（コードポイント）で数えます。カラムの `varchar` の長さも、文字の数です
- 整数の上限は、カラム（`integer`）に入る 2,147,483,647 です。在庫の数の上限は、カラム（`numeric(10, 2)`）に入る 99,999,999.99 です
- URL は、`javascript:` などのほかのスキームと、パスだけの URL（`/images/a.jpg`）を受け付けません。画面がそのままリンクにしても安全な URL だけを保存します
- 成功すると 201 で、`Location` ヘッダーと `links.self` が、作成した商品の場所を指します。`createdAt` と `updatedAt` は、同じ時刻です

## 商品コード

`productCode` は、サロンが付ける商品の番号です。

- **サロンの、削除されていない商品の中で一意です**（部分一意インデックス `products_code_salon_unique`）。重なると 409 で、`code` は `3002`、`detail` は `Product with productCode <コード> already exists` です
- 取り扱いをやめた商品（`isActive` が false）のコードも、使えません。取り扱いを再開するときは、その商品の `isActive` を true に戻します
- ほかのサロンの商品と同じコードは、使えます
- **削除した商品のコードは、使えます**。削除した商品の行は残り、コードもそのままです
- コードは、書かれたとおりに比べます。大文字と小文字、前後の空白が違えば、別のコードです
- 更新で、その商品がいま持っているコードを書いても、409 になりません

## 更新

更新リクエスト（`ProductUpdateRequest`）は、変えるプロパティだけを書きます。書かなかったプロパティは、そのままです。

- 書けるプロパティは、作成リクエストと同じです。規則も、作成と同じです
- プロパティを 1 つも書かないリクエストは 400 です（`custom`）
- null を書けるプロパティは、null を書くと、値を消します。`productCode`、`name`、`unit`、`minimumStock`、真偽値は、null を書けません（`invalid_type`）
- `updatedAt` は、リクエストが値を変えなくても、更新のたびに書きます（データベースの `clock_timestamp()`）。`createdAt` は、変わりません
- 取り扱いをやめた商品も、在庫のある商品も、更新できます
- `requiresLotTracking` は、在庫のレコードがあっても変えられます。在庫のレコードのロット番号は、そのままです（[在庫のロット番号](./inventory.md#ロット番号)）

## 在庫の水準

`minimumStock`（最低在庫数）、`reorderPoint`（発注点）、`maximumStock`（最大在庫数）は、null でないものの間で、この順に並びます（同じ値でもよい）。

- `minimumStock` ≦ `reorderPoint`: 在庫が最低在庫数を下回ってから発注したのでは、最低在庫数を保てません
- `reorderPoint` ≦ `maximumStock`: 最大在庫数を超えてから発注すると、納品のたびに最大在庫数を超えます
- `minimumStock` ≦ `maximumStock`

確かめ方:

- 作成では、リクエストの値を比べます。順が違うと 400 で、違反する組ごとに、**上の水準**（`reorderPoint` か `maximumStock`）の `custom` です。`detail` は `Invalid product` です
- 更新では、**更新後の行**の値を比べます。リクエストが書かなかった水準は、保存されている値です
  - 組の両方を書いていれば、上の水準の `custom`（`Must not be less than <下の水準>`）
  - 組の片方だけを書いていれば、書いたほうの `custom`。上の水準なら `Must not be less than <下の水準>`、下の水準なら `Must not be more than <上の水準>`
  - 違反する組がいくつあっても、すべてを報告します（`minimumStock` と `reorderPoint`、`minimumStock` と `maximumStock`、`reorderPoint` と `maximumStock` の順）
- `reorderPoint` か `maximumStock` を null にすれば、その水準は比べません。保存されている値を上回る新しい最低在庫数を書くときは、同じリクエストで、ほかの水準も書くか、null にします
- どれかの水準が、それ自体の規則（範囲、小数の桁、型）に違反しているときは、その違反だけを報告し、水準どうしは比べません
- リクエストの形が違うとき（型の違う値、ないキー）も、水準どうしは比べません。値の規則の違反（空白だけの名前、負の価格など）だけなら、水準の違反も一緒に報告します

## 削除

削除は、行を消さず、削除した時刻（`deletedAt`）を書きます（204。本文はない）。`updatedAt` も、削除した時刻を書きます（どちらも、データベースの `clock_timestamp()` で、マイクロ秒の単位では違うことがあります）。削除した商品は、取得、更新、削除のどれも 404 で、一覧に出ません。

- **在庫のレコード（`inventory`）がある商品は、削除できません**（409。`code` は `3003`）。在庫の数は問いません。数が 0 のレコードも、ロットや保管場所の記録だからです
- 409 の `detail` は、在庫を先に削除するか、`isActive` を false にするよう伝えます。取り扱いをやめるときは、削除ではなく、`isActive` を false にします。在庫のレコードは、在庫の移動で在庫数を 0 にすると、削除できます（[在庫の削除](./inventory.md#削除)）
- 行を残すのは、在庫の移動の記録（`inventory_transactions`）と、施術で使った材料の記録（`treatment_materials`）が、外部キー（`ON DELETE RESTRICT`）で商品を指し、それらの記録は、商品を削除したあとも残すからです。売上の明細は、商品を外部キーで指さず、名前と金額を持ちます
- 削除した商品のコードは、ほかの商品が使えます（[商品コード](#商品コード)）
- 取り扱いをやめた商品（`isActive` が false）も、削除できます

## 1 件の取得と一覧

- 日時は UTC で、ミリ秒までの ISO 8601 形式です（`2026-11-20T03:40:00.000Z`）。在庫の水準は数値です（`10.5`）
- 一覧の並びは、`productCode` の昇順、同じ値の中では `id` の昇順です（文字列の比較は、データベースの照合順序に従います）
- 一覧は、取り扱いをやめた商品（`isActive` が false）も返します。削除した商品は返しません
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後の商品の ID です。そのサロンの削除されていない商品でない ID を指す `cursor` は 400 です（`cursor` の `not_found`）。ページを読む途中で、カーソルの商品の `productCode` が変わると、次のページは、新しいコードの次から始まります
- `meta.total` は、絞り込みに一致する商品の件数です
- 絞り込みは、AND で結合します

| パラメーター | 一致する商品 |
|---|---|
| `keyword` | 商品名、商品コード、ブランドのどれかが、その文字列を含む（大文字と小文字を区別しない）。`%` と `_` も、その文字として探す。空白だけでない文字列、100 文字まで |
| `category` | カテゴリーが一致する（大文字と小文字を区別する）。空白だけでない文字列、100 文字まで |
| `barcode` | バーコードが一致する。空白だけでない文字列、100 文字まで |
| `isActive` | `true` なら取り扱い中のもの、`false` なら取り扱いをやめたもの |
| `isForSale` | `true` なら店頭で販売するもの、`false` ならしないもの |
| `isForTreatment` | `true` なら施術で使うもの、`false` なら使わないもの |

- 真偽値のパラメーターは、`true` か `false` だけです（ほかは `invalid_value`）
- 表にないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回書くと 400 です（`invalid_type`）
- 保存されている行が API のモデルに合わないときは 500（データベースのエラー）です。読み出すときに検証します（`mappers/read/product.mapper.ts`）

## 同時に届いたリクエスト

- **更新は、商品の行をロックしてから、在庫の水準を確かめて書きます**（`SELECT … FOR UPDATE`。`READ COMMITTED` のトランザクション）。最低在庫数だけを変える更新と、最大在庫数だけを変える更新が同時に届いても、後から行を得たほうは、先の更新が書いた値と比べます。水準の順が違う行は、残りません
- **商品コードの重なりは、一意インデックスが決めます**。同じコードの作成が同時に何件も届くと、1 件が 201 で、ほかは 409 です。2 つの商品を同じコードに変える更新が同時に届くと、1 件が 200 で、もう 1 件は 409 です。書いている途中の商品と同じコードの作成は、その商品を待ち、コミットされれば 409、取り消されれば書きます
- **削除は、商品の行をロックしてから、次の文で、その商品の在庫のレコードを探します**。このロックは、在庫のレコードの外部キーの確認が待つロックです。書いている途中の在庫のレコードがあれば、削除はそれを待ち、コミットされれば 409、取り消されれば削除します
- 更新と削除は、同じ商品の行で、互いに待ちます。削除を待った更新は、404 で、何も書きません
- 待ったリクエストが書く時刻（`updatedAt`、`deletedAt`）は、待ったあとの時刻です
- 更新と削除がロックするのは、その商品の行だけです。サロンの行も、ほかの商品の行も、ロックしません
- 取得と一覧は、ロックを待ちません

## DB の制約

マイグレーション `202611171300_product_rules.sql` で、次のようにしました。

- `minimumStock` を NOT NULL にした（既定値 0 はそのまま）。NULL の行は、0 にします
- `supplierId` を削除し、`supplier`（`varchar(255)`、NULL 可）を加えた。`supplierId` は、どのテーブルも指さない UUID で、どのコードも読み書きしていませんでした。仕入先の台帳を作るときに、外部キーとして加え直します
- 商品コードの一意制約 `products_code_salon_unique`（サロンと商品コード）を、削除されていない行だけの部分一意インデックス（同じ名前）に置き換えた
- CHECK 制約
  - 3 つの価格は、それぞれ NULL か 0 以上（`products_prices_not_negative`）
  - `minimumStock` は 0 以上で、`reorderPoint` と `maximumStock` は、それぞれ NULL か、`minimumStock` ≦ `reorderPoint` ≦ `maximumStock` の順（`products_stock_levels`）
  - `leadTimeDays` は NULL か 0 以上（`products_lead_time_not_negative`）
  - `expiryMonths` は NULL か 1 以上（`products_expiry_months_positive`）

これまで、このテーブルに書くオペレーションはなく、手で書かれた行が規則に違反していても、どちらの値が正しいかを決められません。違反する行があると、マイグレーションは失敗し、何も変えません。行を直してから、やり直します。マイグレーションは、何度適用しても同じ結果です。

以前のバージョンは、商品の ID だけを読みます（売上の明細の確認）。マイグレーションを適用したあとも、以前のバージョンは動きます。新しいバージョンは `supplier` を読むので、[リリースの手順](./release-workflow.md) のとおり、起動する前にマイグレーションを適用します。

在庫のレコードは、外部キー（`inventory_product_id_fk`）で商品を指します。商品の行を消すと、その在庫のレコードも消えます（`ON DELETE CASCADE`）。ただし、API の削除は、行を残します。

## シード

`pnpm db:seed` は、1 つ目のサロンに 7 件（カテゴリーは `Hair Care`、`Hair Treatment`、`Hair Color`、`Styling`）、2 つ目のサロンに 2 件（`Spa`）の商品を入れます。1 つ目のサロンの 6 件には、在庫のレコードがあります。それらは削除できず（409）、在庫のないワックス（`WAX001`）とスパの商品は、削除できます。在庫のレコードは [在庫](./inventory.md#シード) にあります。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/inventory.tsp`（`ProductResponse`、`ProductCreateRequest`、`ProductUpdateRequest`、`ProductSearchRequest`）、`specs/operations/inventory-operations.tsp`（`ProductCrud`） |
| ドメイン | `backend/packages/domain/src/models/product.ts`、`schemas/product.schema.ts`、`mappers/read/product.mapper.ts`、`mappers/write/product.mapper.ts`、`repositories/product.repository.ts`、`business-logic/product/`（誰が読み、誰が管理するかは `_shared/authorization.ts`、在庫の水準の比較は `_shared/stock-levels.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/product.repository.impl.ts` |
| API | `backend/packages/api/src/routes/product/`（`/api/v1/salons/:salonId/products` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611171300_product_rules.sql` |
| テスト | `backend/packages/domain/src/__tests__/product.schema.test.ts`、`product.stock-levels.test.ts`、`product.mapper.test.ts`、`product.usecase.test.ts`、`backend/packages/api/src/__tests__/product.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
