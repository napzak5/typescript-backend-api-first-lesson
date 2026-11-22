# 在庫のアラート

サロンの在庫のアラートと、アラートの確認の規則をまとめます。コントラクトは `specs/operations/inventory-operations.tsp`（`InventoryAlertOperations` の `InventoryAlertCrud`）と `specs/models/inventory.tsp`、テーブルは確認の記録の `inventory_alert_acknowledgements` です。

アラートは、在庫について、スタッフが手を打つことを知らせます。商品の在庫が足りないか多すぎること、在庫の行の使用期限が近いか過ぎたことです。管理者とサロンのスタッフが `/api/v1/inventory-alerts` で扱います。顧客のアカウントは、このルートを使えません。商品は [商品](./products.md)、在庫の行と在庫の移動は [在庫](./inventory.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| アラートの一覧（`list`） | 実装済み |
| アラートの確認（`acknowledge`） | 実装済み |
| アラートの件数（`getSummary`） | 実装済み |

- **アラートは、保存しません**。一覧と件数は、読むたびに、商品、在庫の行、在庫の移動から、今のアラートを求めます。保存するのは、誰がいつアラートを確認したかだけです（[確認](#確認)）
- 次のものは、ありません
  - アラートを知らせるもの（メール、プッシュ通知）。アラートは、一覧と件数を読んで知ります
  - 確認を取り消すか、直すオペレーション。確認は、確認したときの状態が続くあいだだけ効きます（[確認が効くあいだ](#確認が効くあいだ)）
  - 確認の履歴を読むオペレーション。一覧は、今効いている確認だけを示します
  - 期限切れ間近の日数を、サロンごとに変える設定。30 日です

## アラートの種類と重要度

| 種類（`alert`） | 何についてか | 出るとき | 重要度（`severity`） | `threshold` |
|---|---|---|---|---|
| `low_stock` | 商品 | サロンの在庫数の合計が、最低在庫数（`minimumStock`）以下 | 合計が 0 なら `critical`、ほかは `warning` | 最低在庫数 |
| `overstock` | 商品 | 最大在庫数（`maximumStock`）があり、合計がそれより多い | `info` | 最大在庫数 |
| `expired` | 在庫の行 | 在庫がある行の使用期限が、サロンの今日より前 | `critical` | null |
| `expiring` | 在庫の行 | 在庫がある行の使用期限が、サロンの今日から 30 日後まで（どちらの日も含む） | `warning` | null |

- **商品のアラートは、取り扱い中の商品（`isActive` が true）のうち、そのサロンに在庫の行があるものだけに出ます**。在庫の行が 1 つもない商品には、出ません。在庫僅少の一覧と同じ規則です（[在庫僅少の一覧](./inventory.md#在庫僅少の一覧)）
- 合計は、そのサロンのすべての在庫の行の `currentStock` の和です。引き当てた数も含みます
- 最低在庫数は最大在庫数以下なので（[商品](./products.md)）、商品に出るのは、`low_stock` と `overstock` のどちらか 1 つまでです。最低在庫数が 0 の商品は、在庫が 0 になると `low_stock`（`critical`）です
- **在庫の行のアラートは、取り扱いをやめた商品の行にも出ます**。在庫があれば、使うか捨てるからです。使用期限のない行と、在庫が 0 の行には、出ません
- 今日は、サロンのタイムゾーン（`salons.timezone`）で数えます。30 日は、期限切れ間近の一覧の既定の日数と同じです（`EXPIRING_SOON_DAYS`。[期限切れ間近の一覧](./inventory.md#期限切れ間近の一覧)）
- ランタイムが知らないタイムゾーンのサロンは、500 です（データベースのエラー）

## アラート

| プロパティ | 意味 |
|---|---|
| `alert` | 種類 |
| `severity` | 重要度 |
| `salonId` | サロン |
| `productId`、`productCode`、`productName`、`unit` | 商品と、その商品コード、名前、単位。在庫の行のアラートでは、その行の商品 |
| `inventoryId`、`lotNumber`、`expiryDate` | 在庫の行と、そのロット番号、使用期限。商品のアラートでは null |
| `currentStock` | 商品のアラートでは、サロンの在庫数の合計。在庫の行のアラートでは、その行の在庫数 |
| `threshold` | 商品のアラートで比べた数（最低在庫数か最大在庫数）。在庫の行のアラートでは null |
| `acknowledgement` | 今効いている確認（[確認](#確認)）。なければ null |

- アラートには、ID がありません。種類と、何についてか（商品か在庫の行）で決まります
- コントラクトのアラートは、以前は、保存したアラートの ID（`itemId`）、メッセージ、発生した時刻、確認済みかどうか（`acknowledged`）を持っていましたが、保存しないアラートには、どれもありません。確認は、確認の記録をそのまま示すようにしました（`acknowledgement`）

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/inventory-alerts` | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff` |
| 確認 | `POST /api/v1/inventory-alerts/acknowledge` | `admin`、本文の商品のサロンの `owner` / `manager` / `staff` |
| 件数 | `GET /api/v1/inventory-alerts/summary` | `admin`、クエリの `salonId` のサロンの `owner` / `manager` / `staff` |

- すべてのオペレーションに認証が要ります
- 権限は、在庫と同じ 2 段階で判定します（`business-logic/inventory/_shared/authorization.ts` の `inventoryReachOf`）。1 段階目は、操作者だけで決まります。アラートを読み、確認するのは、在庫を読める人（`admin` と、サロンの 3 つのロール）です。アラートに手を打つのは、日々在庫を扱うスタッフだからです。ロール `customer` のユーザーと、範囲 `none` のユーザー（スタッフの記録が削除されたアカウントも）は、クエリか本文が不正でも 403 です
- 2 段階目は、クエリを確かめたあとに決まります（`isWithin`）。サロンのユーザーが、一覧か件数のクエリで、ほかのサロンを指定すると、サロンが存在するかどうかにかかわらず 403 です
- **ほかのサロンの商品と在庫の行は、存在しないものと区別しません**。確認で指定すると 404 です。一覧の `cursor` に指定すると 400 です
- 確認の `acknowledgedBy` は、操作者のスタッフの ID です。管理者は、サロンのスタッフではないので null です。本文に書くと、知らないプロパティとして 400 です。コントラクトの確認のリクエストは、以前は `acknowledgedBy` を本文で受けましたが、確認した人は、サインインしている人です
- ID（本文とクエリの ID）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です

### 確認の順序

一覧:

1. アクセストークン（401）
2. 操作者が在庫を読めること（403）
3. クエリ（400。`detail` は `Invalid inventory alert search`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. サロンの存在（400。`salonId` の `not_found`。`Must name a salon`）
6. サロンのタイムゾーンを、ランタイムが知っていること（500）
7. `cursor` が、そのサロンの商品か在庫の行を指すこと（400。`cursor` の `not_found`。`Must name a product or a stock row of the salon`）

件数:

1. アクセストークン（401）
2. 操作者が在庫を読めること（403）
3. クエリ（400。`detail` は `Invalid inventory alert summary request`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. サロンの存在（400。`salonId` の `not_found`）
6. サロンのタイムゾーンを、ランタイムが知っていること（500）

確認:

1. アクセストークン（401）
2. 操作者が在庫を読めること（403）
3. リクエストの本文（400。`detail` は `Invalid inventory alert acknowledgement`）
4. 商品が、操作者に届くサロンの商品であること（404）
5. サロンのタイムゾーンを、ランタイムが知っていること（500）
6. 在庫の行のアラートでは、在庫の行が、その商品の行であること（404）
7. そのアラートが、今出ていること（404）
8. そのアラートに、効いている確認がないこと（409）

404 の `detail` は `InventoryAlert <alert>:<ID> was not found` です。ID は、在庫の行のアラートでは在庫の行の ID、商品のアラートでは商品の ID です。

## 一覧

クエリ:

| パラメータ | 規則 |
|---|---|
| `salonId` | 必須。サロンの ID。サロンのユーザーは、自分のサロンだけ |
| `limit` | 1〜100。省略すると 20 |
| `cursor` | 前のページの `meta.nextCursor`。そのサロンの商品か在庫の行の ID |
| `alert` | 種類 |
| `severity` | 重要度 |
| `acknowledged` | `true` は効いている確認があるアラート、`false` はないアラート |

- **並びは、商品の商品コードの順、同じ商品コードでは商品の ID の順です。商品のアラートが、その商品の在庫の行のアラートより先で、在庫の行のアラートは、使用期限の順、同じ日では在庫の行の ID の順です**。商品コードは、データベースの照合順序で並べます。商品の一覧と同じです
- `meta.nextCursor` は、ページの最後のアラートが何についてかの ID（在庫の行の ID か、商品の ID）です。`cursor` は、そのアラートがあった場所のあとからのページを返します。そのアラートが、在庫の移動などで消えたあとも、同じ場所のあとから続けます。ページは、前にだけ進みます（`prevCursor` は、いつも null）
- `meta.total` は、絞り込みに合うアラートの数です。アラート、確認、カーソルの場所は、1 つのスナップショット（`REPEATABLE READ` の読み取り専用のトランザクション）で読みます
- `limit` と `acknowledged` は、クエリの文字列から数と真偽値にします。数でない `limit` は `invalid_format`、`true` でも `false` でもない `acknowledged` は `invalid_value` です
- 知らないパラメータは 400 です（`unrecognized_keys`）。コントラクトの種類のパラメータは、以前は `type` でしたが、カラムの名前に合わせて `alert` にしました。`type` は、知らないパラメータとして 400 です

## 件数

`GET /api/v1/inventory-alerts/summary` は、サロンの今のアラートを数えます。

| プロパティ | 意味 |
|---|---|
| `totalAlerts` | アラートの数 |
| `criticalAlerts`、`warningAlerts`、`infoAlerts` | 重要度ごとの数 |
| `unacknowledged` | 効いている確認がないアラートの数 |

- 数えるのは、絞り込まない一覧と同じアラートです。1 つのスナップショットで読みます
- クエリは `salonId` だけです。一覧の絞り込み（`alert` など）は、知らないパラメータとして 400 です

## 確認

本文は `{"alert": <種類>, "productId": <商品の ID>, "inventoryId": <在庫の行の ID か null>, "notes": <メモか null>}` です。どれも必須です。

| プロパティ | 規則 |
|---|---|
| `alert` | 種類 |
| `productId` | 商品の ID。在庫の行のアラートでは、その行の商品 |
| `inventoryId` | 在庫の行のアラート（`expiring`、`expired`）では、在庫の行の ID。商品のアラート（`low_stock`、`overstock`）では null |
| `notes` | メモ。空白だけでない文字列か null |

- 種類と `inventoryId` が合わないと 400 です（`inventoryId` の `custom`。`Must be null for an alert of a product (<alert>)` か、`Must name a stock row for an alert of a stock row (<alert>)`）
- **確認は、今出ているアラートを、今の状態で記録します**。重要度、`threshold`（商品のアラート）、使用期限（在庫の行のアラート）は、そのときのアラートのものです。本文に書くと、知らないプロパティとして 400 です
- 200 のレスポンスは、確認したアラートで、`acknowledgement` が、書いた確認の記録です。`links` は、そのサロンの一覧（`list`）と件数（`summary`）です
- 今出ていないアラートは 404 です。種類が違うアラート（在庫が少ない商品の `overstock`、期限切れ間近の行の `expired` など）も、今出ていないアラートです
- 効いている確認があるアラートは 409 です（`detail` は `Inventory alert <alert>:<ID> is acknowledged already: an acknowledgement holds while what it was given for lasts`）

### 確認の記録

| プロパティ | 意味 |
|---|---|
| `id` | 確認の記録の ID |
| `salonId`、`productId`、`inventoryId` | 確認したアラートのサロン、商品、在庫の行（商品のアラートでは null） |
| `alert`、`severity` | 確認したときの種類と重要度 |
| `threshold` | 確認したときの最低在庫数か最大在庫数。在庫の行のアラートでは null |
| `expiryDate` | 確認したときの在庫の行の使用期限。商品のアラートでは null |
| `notes` | メモ。なければ null |
| `acknowledgedBy` | 確認したスタッフの ID。管理者が確認したときは null |
| `acknowledgedAt` | 確認した時刻 |

- 確認の記録は、変えません。同じアラートを確認し直すと、新しい記録を書きます。一覧が示すのは、そのアラートの最新の記録が効いているときの、その記録です

### 確認が効くあいだ

**確認は、確認したときの状態が続くあいだだけ効きます**。状態が変わると、同じアラートでも、まだ誰も見ていないアラートとして、もう一度確認します。

| 種類 | 効くあいだ |
|---|---|
| `low_stock` | 最低在庫数が、確認したときの `threshold` と同じで、確認してから、在庫数の合計が最低在庫数を超えたことがない。`warning` として確認したものは、合計が 0 になったことがない |
| `overstock` | 最大在庫数が、確認したときの `threshold` と同じで、確認してから、合計が最大在庫数以下になったことがない |
| `expired`、`expiring` | 在庫の行の使用期限が、確認したときと同じで、確認してから、在庫の移動が行の在庫を 0 にしたことがない |

- 在庫を補充して最低在庫数を超え、また減って在庫僅少になったら、新しく足りなくなったので、確認し直します。在庫切れ（`critical`）は、`warning` の確認では済みません。`critical` として確認したものは、在庫が戻って `warning` になっても効きます
- 最低在庫数か最大在庫数を変えると、商品のアラートの確認は効かなくなります。比べる数が変わったからです
- 商品の取り扱いをやめると（`isActive` が false）、その商品のアラートは出なくなります。取り扱いを再開すると、アラートは、効いていた確認とともに戻ります。取り扱いの停止と再開は、在庫数も比べる数も変えないからです
- 期限切れ間近（`expiring`）として確認した行が期限切れになると、`expired` という別のアラートです。確認は、アラートの種類ごとです
- 確認してからの在庫数の合計は、在庫の移動（`inventory_transactions`）から求めます。今の合計から、そのあとの在庫の移動の数量を引くと、その時点の合計です。同じ時刻に記録した在庫の移動（棚卸しが行のあいだで数を動かすときなど）は、まとめて 1 回の変化として数えます。計算は、データベースの `numeric` で行うので、誤差はありません
- 在庫の数を変えるのは、在庫の移動、棚卸し、発注の入荷で、どれも在庫の移動を記録します。在庫の行は、在庫 0 で作られ、在庫 0 でなければ削除できません（[在庫](./inventory.md)）。それで、在庫の移動から、いつの合計も求められます

## 同時に届いたリクエスト

- **確認は、商品の行を `FOR NO KEY UPDATE` でロックしてから、在庫の行を、ID の順に `FOR SHARE` でロックし、アラートを確かめます**（`READ COMMITTED` のトランザクション）。商品のアラートでは、その商品のそのサロンのすべての在庫の行を、在庫の行のアラートでは、その行をロックします
- 同じ商品のアラートの確認は 1 件ずつ、前の確認が書いたあとの状態で決めます。同じアラートの確認が同時に何件も届くと、1 件が 200 で、ほかは 409 です
- 商品の更新と削除（`FOR UPDATE`）の途中の商品への確認は、それを待ち、更新されたあとの最低在庫数と最大在庫数で決めます
- 在庫の移動、棚卸し、入荷、在庫の行の更新と削除の途中の行への確認は、それを待ち、それが残した在庫数と使用期限で決めます。削除されれば、在庫の行のアラートは 404 です。確認の途中の行への在庫の移動は、確認を待ちます。それで、確認より前に記録した在庫の移動は、確認の時刻より前の時刻で、あとに記録した在庫の移動は、あとの時刻です
- どちらのロックも、在庫の行の作成（商品の `FOR KEY SHARE`）を待たせません
- 確認の時刻（`acknowledgedAt`）は、書いた時刻（データベースの `clock_timestamp()`）です。ロックを待った確認は、待ったあとの時刻です
- 一覧と件数は、ロックを待ちません

## DB の制約

マイグレーション `202611171700_inventory_alert_acknowledgements.sql` で、型 `inventory_alert_type`、`inventory_alert_severity` と、テーブル `inventory_alert_acknowledgements` を作りました。

- CHECK 制約 `inventory_alert_acknowledgements_subject`: `low_stock` と `overstock` は、`inventoryId` と `expiryDate` がなく、`threshold` が 0 以上。`expiring` と `expired` は、`inventoryId` と `expiryDate` があり、`threshold` がない
- CHECK 制約 `inventory_alert_acknowledgements_severity`: `low_stock` は `warning` か `critical`、`overstock` は `info`、`expiring` は `warning`、`expired` は `critical`
- インデックス `idx_inventory_alert_acknowledgements_product_time`（`productId`、`acknowledgedAt`）。アラートの最新の確認を読むためのものです。ほかに、`idx_inventory_alert_acknowledgements_inventory_id`（`inventoryId`）と `idx_inventory_alert_acknowledgements_salon_id`（`salonId`）
- 在庫の移動のインデックス `idx_inventory_transactions_product_time`（`productId`、`createdAt`）。確認してからの商品の在庫の移動を読むためのもので、商品だけのインデックス `idx_inventory_transactions_product_id` を置き換えました

確認の記録は、外部キーで、サロン（`inventory_alert_acknowledgements_salon_id_fk`）、商品（`inventory_alert_acknowledgements_product_id_fk`）、在庫の行（`inventory_alert_acknowledgements_inventory_id_fk`）を指します。どれも `ON DELETE CASCADE` です。在庫の行を削除すると、その行の確認も消えます。API のサロンと商品の削除は、行を残す論理削除です。`acknowledgedBy` は、在庫の移動の `performedBy` と同じく、外部キーのない UUID です。

マイグレーションは、何度適用しても同じ結果です。以前のバージョンは、このテーブルを読まないので、マイグレーションを適用したあとも動きます。

`pnpm check:api-db` は、確認の記録（`InventoryAlertAcknowledgementResponse`）がテーブルのすべてのカラムを持つこと、確認のリクエスト（`InventoryAlertAcknowledgeRequest`）が、サーバーが決めるカラム（ID、サロン、重要度、`threshold`、使用期限、確認した人と時刻）を持たないことを確かめます（[API-DB型制約マッピング](./api-db-type-constraints-mapping.md)）。アラートそのもの（`InventoryAlertResponse`）は、テーブルの行ではないので、対象にしません。

## シード

`pnpm db:seed` は、確認の記録を入れません。シードの 1 つ目のサロンの 6 行は、使用期限（2025-12-31）が過ぎているので、6 件の `expired`（`critical`）のアラートが出ます（[在庫のシード](./inventory.md#シード)）。商品のアラートは出ません。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/inventory.tsp`（`InventoryAlertType`、`InventoryAlertSeverityType`、`InventoryAlertResponse`、`InventoryAlertAcknowledgementResponse`、`InventoryAlertSearchRequest`、`InventoryAlertAcknowledgeRequest`、`InventoryAlertSummaryRequest`、`InventoryAlertSummaryResponse`）、`specs/models/_shared/common.tsp`（`InventoryAlertAcknowledgementId`）、`specs/operations/inventory-operations.tsp`（`InventoryAlertCrud`） |
| ドメイン | `backend/packages/domain/src/models/inventory-alert.ts`、`schemas/inventory-alert.schema.ts`、`mappers/write/inventory-alert.mapper.ts`（行は作らない。リクエストを、一覧の条件、集計するサロン、確認するアラートにする）、`mappers/read/inventory-alert.mapper.ts`（アラートのほかに、一覧のページと、集計も作る）、`repositories/inventory-alert.repository.ts`、`business-logic/inventory-alert/`（アラートと確認の規則は `_shared/alerts.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/inventory-alert.repository.impl.ts` |
| API | `backend/packages/api/src/routes/inventory-alert/`（`/api/v1/inventory-alerts` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611171700_inventory_alert_acknowledgements.sql` |
| テスト | `backend/packages/domain/src/business-logic/inventory-alert/__tests__/inventory-alert.rules.test.ts`、`backend/packages/domain/src/schemas/__tests__/inventory-alert.schema.test.ts`、`backend/packages/domain/src/mappers/__tests__/inventory-alert.mapper.test.ts`、`backend/packages/domain/src/business-logic/inventory-alert/__tests__/inventory-alert.usecase.test.ts`、`backend/packages/api/src/routes/inventory-alert/__tests__/inventory-alert.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
