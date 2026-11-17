# 施術記録

予約の施術記録と、施術で使った商材、施術写真、施術の統計の規則をまとめます。コントラクトは `specs/operations/treatment-operations.tsp`（`TreatmentOperations` の `TreatmentRecordCrud`）と `specs/models/treatment.tsp`、テーブルは `treatment_records`、`treatment_materials`、`treatment_photos` です。

施術記録は、サロンが予約の施術について書き残すものです。提供したサービス、使った技法、頭皮と毛髪の状態、カラー剤の配合、使った商材、次回の来店に勧めること、顧客の満足度、スタッフの申し送りを持ちます。管理者とサロンのスタッフが `/api/v1/treatments` で扱います。顧客のアカウントは、自分の施術の記録も含めて、このルートを使えません。予約は [予約台帳](./bookings.md)、商品は [商品](./products.md)、在庫の移動は [在庫](./inventory.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 施術記録の一覧（`list`） | 実装済み |
| 施術記録の作成（`create`） | 実装済み |
| 施術記録の取得（`get`） | 実装済み |
| 施術記録の更新（`update`） | 実装済み |
| 施術記録の削除（`delete`） | 実装済み |
| 施術写真の追加（`addPhotos`） | 実装済み |
| 施術写真の削除（`removePhoto`） | 実装済み |
| 施術の統計（`getStatistics`） | 実装済み |
| カルテ（`MedicalChartCrud`） | 規則は [カルテ](./medical-charts.md) にあります |

- 施術記録のレスポンスは、写真（`photos`。`treatment_photos` の行）も返します。写真は、施術写真の追加で足し、施術写真の削除で外します（[施術写真](#施術写真)）。写真のない施術記録は空配列です
- **使用商材を記録しても、在庫は動きません**。施術で商品を使った在庫は、在庫の移動（`use`）で記録します（[在庫の移動](./inventory.md#在庫の移動)）。施術記録の作成と更新は、在庫の行を読まず、書きません

## 施術記録と使用商材

| プロパティ | 意味 |
|---|---|
| `id` | 施術記録の ID |
| `bookingId` | 予約。予約 1 件に施術記録は 1 件まで |
| `customerId` | 施術を受けた顧客。予約の顧客 |
| `staffId` | 施術を担当したスタッフ。予約の担当でなくてもよい |
| `services` | 提供したサービスの ID の一覧（1 件以上）。予約の明細になくてもよい（来店中に足した施術） |
| `techniques` | 使った技法の名称の一覧 |
| `consultationNotes` | カウンセリングのメモ |
| `scalpCondition`、`hairCondition` | 施術のときの頭皮と毛髪の状態 |
| `colorFormula` | カラー剤の配合 |
| `processingTime` | 施術にかかった時間（分） |
| `resultNotes` | 施術の結果のメモ |
| `nextRecommendedDate` | 次の来店に勧める日 |
| `nextRecommendedServices` | 次の来店に勧めるサービスの ID の一覧 |
| `homeCareSuggestions` | ホームケアの提案 |
| `customerSatisfaction` | 顧客の満足度（1〜5） |
| `staffEvaluation` | スタッフの自己評価と申し送り |
| `materials` | 使った商材の一覧（[使用商材](#使用商材)）。リクエストに書いた順 |
| `photos` | 施術写真の一覧（[施術写真](#施術写真)）。`sortOrder` の順（同じ `sortOrder` では先に足した写真が先） |
| `createdAt`、`updatedAt` | 作成と最後の更新の日時 |

- 書かない項目は、文字列と数は null、一覧は空配列です。null を空文字にしたり、空配列を null にしたりはしません
- `scalpCondition` と `hairCondition` は、施術のときにスタッフが見た状態を、その言葉で書く文字列です。顧客の台帳の、ふだんの頭皮の状態（`customers.scalpCondition`）は選択肢の 1 つですが、施術のときの状態は選択肢に限りません
- 日時は UTC で、ミリ秒までの ISO 8601 形式です（`2026-11-20T03:40:00.000Z`）。`nextRecommendedDate` は `YYYY-MM-DD` です

### 使用商材

| プロパティ | 意味 |
|---|---|
| `productId` | 使った商品 |
| `quantity` | 使った量（0 より大きく、0.01 単位） |
| `unit` | 量の単位 |
| `lotNumber` | 使った商品のロット番号 |
| `notes` | メモ |

- 使用商材は、リクエストに書いた順に保存し（`sortOrder`）、その順に返します。`sortOrder` は、レスポンスには出ません
- 同じ商品を、何度書いてもかまいません。ロットの違う同じ商品を使うことがあるからです
- 使用商材には、それぞれの ID がありません。更新で使用商材を書くと、一覧全体を置き換えます（[更新](#更新)）

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/treatments` | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンの施術記録だけ） |
| 作成 | `POST /api/v1/treatments` | `admin`、本文の予約のサロンの `owner` / `manager` / `staff` |
| 1 件の取得 | `GET /api/v1/treatments/{id}` | `admin`、施術記録のサロンの `owner` / `manager` / `staff` |
| 更新 | `PATCH /api/v1/treatments/{id}` | `admin`、施術記録のサロンの `owner` / `manager` / `staff` |
| 削除 | `DELETE /api/v1/treatments/{id}` | `admin`、施術記録のサロンの `owner` / `manager` |
| 施術写真の追加 | `POST /api/v1/treatments/{id}/photos` | `admin`、施術記録のサロンの `owner` / `manager` / `staff` |
| 施術写真の削除 | `DELETE /api/v1/treatments/{id}/photos/{photoId}` | `admin`、施術記録のサロンの `owner` / `manager` / `staff` |
| 統計 | `GET /api/v1/treatments/statistics` | `admin`（すべてのサロン）、サロンの `owner` / `manager` / `staff`（所属サロンだけ） |

- すべてのオペレーションに認証が要ります
- **施術記録のサロンは、予約のサロンです**。`treatment_records` にサロンの列はありません。予約は、ほかのサロンに移りません
- 権限は、予約台帳と同じ 2 段階で判定します（`business-logic/treatment-record/_shared/authorization.ts`）。1 段階目は、操作者だけで決まります。一覧、作成、取得、更新、写真の追加と削除、統計（`treatmentRecordReachOf`）は、予約台帳を扱える人（`admin` と、サロンの 3 つのロール）のものです。施術をしたスタッフが、その記録を書き、直し、写真を撮るからです
- **削除（`treatmentRecordRemovalReachOf`）は、`admin` と、サロンの `owner` と `manager` のものです**。予約の削除と同じです。削除は、使用商材と写真も消します。`staff` は、ID が不正でも 403 です
- **顧客は、自分の施術の記録も読めません**（403）。施術記録は、カウンセリングのメモ（`consultationNotes`）とスタッフの申し送り（`staffEvaluation`）を持つ、サロンの記録だからです。ロール `customer` のユーザー、範囲 `none` のユーザー、スタッフの行を削除されたサロンのアカウントは、ID、本文、クエリが不正でも 403 です
- 2 段階目は、クエリを確かめたあとに決まります（`isWithin`）。サロンのユーザーが、一覧か統計のクエリでほかのサロンの `salonId` を指定すると、403 です。一覧で省くと、自分のサロンの施術記録です。統計の `salonId` は省けません
- **ほかのサロンの施術記録は、存在しない施術記録と区別しません**。取得、更新、削除、写真の追加と削除は 404（`detail` は `TreatmentRecord <id> was not found`）です。一覧の `cursor` に指定すると 400 です。作成で、ほかのサロンの予約を指定すると、本文の誤りとして 400 です（`bookingId` の `not_found`）
- **削除されたサロンの施術記録は、読めません**。取得、更新、削除、写真の追加と削除は 404 で、一覧にも件数にも入りません。削除されたサロンの統計は 400 です（[統計](#統計)）。削除されたサロンの予約には、施術記録を作成できません（`bookingId` の `not_found`）
- ID（パスの `id`、本文とクエリの ID）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です

### 確認の順序

一覧:

1. アクセストークン（401）
2. 操作者が施術記録を読めること（403）
3. クエリ（400。`detail` は `Invalid treatment record search`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. `cursor` が、操作者に届く施術記録を指すこと（400。`cursor` の `not_found`。`Must name a treatment record of the list`）

作成:

1. アクセストークン（401）
2. 操作者が施術記録を書けること（403）
3. リクエストの本文（400。`detail` は `Invalid treatment record`。[作成リクエストの規則](#作成リクエストの規則)）
4. 予約が、操作者に届く、削除されていないサロンの予約であること（400。`bookingId` の `not_found`。`Must name a booking of a salon`）
5. 本文が予約に合うこと（400。[予約との関係](#予約との関係)。合わないものを、本文の順にまとめて返す）
6. 予約が施術中（`in_progress`）か完了（`completed`）であること（409。`The booking is <status>; a treatment is recorded once it has begun`）
7. 予約に施術記録がまだないこと（409。`The booking has a treatment record already; a booking has one`）

1 件の取得:

1. アクセストークン（401）
2. 操作者が施術記録を読めること（403）
3. パスの `id` の形式（400。`detail` は `Invalid treatment record ID`）
4. 施術記録の存在（404）

更新:

1. アクセストークン（401）
2. 操作者が施術記録を書けること（403）
3. パスの `id` の形式（400）
4. リクエストの本文（400。`detail` は `Invalid treatment record`）
5. 施術記録の存在（404）
6. 本文が予約に合うこと（400。[予約との関係](#予約との関係)）

削除:

1. アクセストークン（401）
2. 操作者が施術記録を削除できること（403）
3. パスの `id` の形式（400）
4. 施術記録の存在（404）

施術写真の追加:

1. アクセストークン（401）
2. 操作者が施術記録を書けること（403）
3. パスの `id` の形式（400。`detail` は `Invalid treatment record ID`）
4. リクエストの本文（400。`detail` は `Invalid treatment photos`。[施術写真の追加](#施術写真の追加)）
5. 施術記録の存在（404）
6. 施術記録に、同じ `photoUrl` の写真がないこと（409）
7. 施術記録の写真が、足しても 20 枚を超えないこと（409）

施術写真の削除:

1. アクセストークン（401）
2. 操作者が施術記録を書けること（403）
3. パスの `id` と `photoId` の形式（400。`detail` は `Invalid treatment photo ID`。不正なものを、どちらも返す）
4. 施術記録の存在（404。`TreatmentRecord <id> was not found`）
5. 写真が、その施術記録のものであること（404。`TreatmentPhoto <photoId> was not found`）

統計:

1. アクセストークン（401）
2. 操作者が施術記録を読めること（403）
3. クエリ（400。`detail` は `Invalid treatment statistics`）
4. クエリの `salonId` が、操作者に届くサロンであること（403）
5. サロンが存在し、削除されていないこと（400。`salonId` の `not_found`。`Must name a salon`）

## 作成リクエストの規則

| プロパティ | 規則 |
|---|---|
| `bookingId` | 必須。予約の ID |
| `customerId` | 必須。顧客の ID |
| `staffId` | 必須。スタッフの ID |
| `services` | 必須。サービスの ID の 1〜20 件。同じ ID は 1 度だけ |
| `techniques` | 必須。空白だけでない 100 文字以下の名称の 0〜20 件。同じ名称は 1 度だけ |
| `consultationNotes`、`scalpCondition`、`hairCondition`、`colorFormula`、`resultNotes`、`homeCareSuggestions`、`staffEvaluation` | 必須。空白だけでない文字列か null |
| `processingTime` | 必須。0〜1440 の整数（分）か null。1 日を超える施術はありません |
| `nextRecommendedDate` | 必須。`YYYY-MM-DD` の日付か null。1900-01-01 から 2999-12-31 まで |
| `nextRecommendedServices` | 必須。サービスの ID の 0〜20 件。同じ ID は 1 度だけ |
| `customerSatisfaction` | 必須。1〜5 の整数か null |
| `materials` | 必須。使用商材の 0〜50 件 |
| `materials.<n>.productId` | 必須。商品の ID |
| `materials.<n>.quantity` | 必須。0 より大きく 99,999,999.99 以下の、0.01 単位の数 |
| `materials.<n>.unit` | 必須。空白だけでない 20 文字以下 |
| `materials.<n>.lotNumber` | 必須。空白だけでない 100 文字以下か null |
| `materials.<n>.notes` | 必須。空白だけでない文字列か null |

- 作成リクエストのプロパティは、すべて必須です。書かない項目は、null か空配列を書きます。書かないプロパティは 400 です（`invalid_type`）
- 知らないプロパティは 400 です（`unrecognized_keys`）。以前のコントラクトにあった `beforePhotos` と `afterPhotos` も、知らないプロパティです。写真は `treatment_photos` の行です
- 同じ ID を大文字と小文字で書いても、同じ ID の繰り返しです（`custom`）

## 予約との関係

本文の規則を満たしたあと、予約と、予約のサロンについて、次を確かめます。合わないものは、すべて、本文の順（`customerId`、`staffId`、`services`、`nextRecommendedDate`、`nextRecommendedServices`、`materials`）に 400 で返します（`business-logic/treatment-record/_shared/rules.ts` の `creationIssues` と `treatmentIssues`）。

| プロパティ | 規則 | 合わないとき |
|---|---|---|
| `customerId` | 予約の顧客で、削除されていない | `customerId` の `not_found`（`Must name the customer of the booking`） |
| `staffId` | 予約のサロンのスタッフで、削除されていない | `staffId` の `not_found`（`Must name a staff member of the salon of the booking`） |
| `services`、`nextRecommendedServices` | 予約のサロンのサービスで、削除されていない | `services.<n>` か `nextRecommendedServices.<n>` の `not_found`（`Must name a service of the salon of the booking`） |
| `nextRecommendedDate` | 予約の日（`bookingDate`）より前でない。予約の日は勧められる | `nextRecommendedDate` の `too_small`（`Must not be before the date of the booking, <bookingDate>`） |
| `materials.<n>.productId` | 予約のサロンの商品で、削除されていない | `materials.<n>.productId` の `not_found`（`Must name a product of the salon of the booking`） |
| `materials.<n>.lotNumber` | ロットで管理する商品（`requiresLotTracking`）ならロット番号がある。ほかの商品なら null | `materials.<n>.lotNumber` の `custom`（`Must name the lot: the product is kept by lots`、`Must be null: the product is not kept by lots`） |

- サロンにない商品のロット番号は、確かめません（`productId` の `not_found` だけです）
- ロット番号の規則は、在庫の行と同じです（[ロット番号](./inventory.md#ロット番号)）。ロット番号が、サロンの在庫の行にあるかは確かめません
- 取り扱いをやめたサービスと商品（`isActive` が false）も、削除されていなければ書けます。施術のあとで取り扱いをやめることがあるからです
- **予約の状態が施術中（`in_progress`）か完了（`completed`）でないと、409 です**。始まっていない予約には施術がなく、取り消した予約と来店しなかった予約にも施術はありません。状態の 409 は、本文が予約に合うかを確かめたあとです
- **予約 1 件に、施術記録は 1 件です**。施術記録のある予約にもう 1 件書くと、409 です。書き直すときは、更新するか、削除してから作成します

## 更新

- 本文に書いた項目だけを変えます。少なくとも 1 つの項目を書きます（何もなければ `custom`）。値を消すには、null か空配列を書きます
- **予約、顧客、担当スタッフは変えられません**（`bookingId`、`customerId`、`staffId` は知らないプロパティとして 400）。違う予約に書いた施術記録は、削除してから書き直します
- `materials` を書くと、使用商材の一覧全体を、書いた順に置き換えます。空配列なら、使用商材をなくします。書かなければ、使用商材は変わりません
- 本文の規則は、作成と同じです。本文に書いた `services`、`nextRecommendedDate`、`nextRecommendedServices`、`materials` だけを、予約と、予約のサロンに照らします（[予約との関係](#予約との関係)）。書かない項目は確かめません。たとえば、施術記録の `services` に、あとで削除されたサービスがあっても、ほかの項目の更新は 200 です
- 予約の状態は確かめません。施術記録のある予約は、施術中か完了で、完了のあとは状態が変わりません
- `updatedAt` は、書いた時刻です（データベースの `clock_timestamp()`）。ロックを待った更新は、待ったあとの時刻です

## 削除

- 施術記録を物理削除します。使用商材と写真も消えます（外部キーの `ON DELETE CASCADE`）
- **施術記録がある予約は削除できません**（409。[予約台帳](./bookings.md#削除)）。施術記録を削除すれば、ほかに予約を参照するもの（売上、レビュー）がなければ、予約を削除できます

## 1 件の取得と一覧

一覧のクエリ:

| パラメーター | 規則 |
|---|---|
| `limit` | 1〜100。省略すると 20 |
| `cursor` | 前のページの `meta.nextCursor`。操作者に届く施術記録の ID |
| `salonId` | サロンの ID。サロンのユーザーは、自分のサロンだけ |
| `customerId` | 顧客の ID |
| `staffId` | 担当スタッフの ID |
| `startDate`、`endDate` | 作成日時の範囲。どちらも含みます。`endDate` は `startDate` より前にできません（`endDate` の `custom`。`Must not be earlier than startDate`） |

- 並びは、作成日時の新しい順、同じ作成日時では ID の降順です。`cursor` は、そのあとの施術記録からのページを返します（キーセット）。ページは、前にだけ進みます（`prevCursor` は、いつも null）
- 日時は、`Z` で終わる UTC の ISO 8601 です（`2026-11-20T03:40:00.000Z`。ミリ秒は省けます）。時差を付けた日時と、秒のない日時は 400 です（`invalid_format`）。日付は 1900-01-01 から 2999-12-31 までです（[リクエストの日付と日時の範囲](./api-db-type-constraints-mapping.md#リクエストの日付と日時の範囲)）
- **`createdAt` は、レスポンスと同じミリ秒までの時刻で比べます**。データベースはマイクロ秒まで記録しますが、レスポンスで見た `createdAt` を `startDate` と `endDate` に書くと、その施術記録に一致します
- 表にないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回書くと 400 です
- `meta.total` は、絞り込みに合う施術記録の数です。カーソル、ページ、件数、使用商材、写真は、1 つのスナップショット（`REPEATABLE READ` の読み取り専用のトランザクション）で読みます。1 件の取得も同じです
- 一覧の施術記録にも、使用商材と写真があります

## 施術写真

施術写真は、施術の前、途中、後の髪を撮った写真です。**この API は写真のファイルを受け取りません**。保存先に置いた写真の URL を、施術記録に記録します。

| プロパティ | 意味 |
|---|---|
| `id` | 写真の ID。レスポンスだけにある |
| `photoType` | 写真の区分。`before`（施術前）、`during`（施術中）、`after`（施術後）、`other`（そのほか） |
| `photoUrl` | 写真の URL |
| `thumbnailUrl` | 縮小した写真の URL |
| `angle` | 撮った向き（正面、側面など） |
| `description` | 写真の説明 |
| `isPublic` | サロンの外（サロンのページなど）に見せてよい写真か |
| `customerConsent` | 顧客が写真の利用に同意したか |
| `sortOrder` | 表示の順序 |

- 施術記録の `photos` は、`sortOrder` の順です。同じ `sortOrder` の写真は、先に足した写真が先です（作成日時、ID の順）
- 写真の行の、施術記録の ID と作成日時は、レスポンスにありません。写真は施術記録の中に返し、ID で外すからです
- 写真の更新はありません。直すときは、外してから足し直します

### 施術写真の追加

`POST /api/v1/treatments/{id}/photos` の本文は `{ "photos": [ ... ] }` です。

| プロパティ | 規則 |
|---|---|
| `photos` | 必須。写真の 1〜20 件 |
| `photos.<n>.photoType` | 必須。`before`、`during`、`after`、`other` のどれか |
| `photos.<n>.photoUrl` | 必須。`http` か `https` の、500 文字以下の URL |
| `photos.<n>.thumbnailUrl` | 必須。`photoUrl` と同じ規則の URL か null |
| `photos.<n>.angle` | 必須。空白だけでない 50 文字以下か null |
| `photos.<n>.description` | 必須。空白だけでない文字列か null |
| `photos.<n>.isPublic` | 必須。真偽値。true なら `customerConsent` も true |
| `photos.<n>.customerConsent` | 必須。真偽値 |
| `photos.<n>.sortOrder` | 必須。0〜2,147,483,647 の整数 |

- **写真は、すべて足すか、何も足しません**。1 枚でも規則に合わなければ、何も書きません
- 写真のプロパティは、すべて必須です。書かない項目は null を書きます。知らないプロパティは 400 です（`unrecognized_keys`）
- **顧客の同意のない写真は、公開できません**。`isPublic` が true で `customerConsent` が false の写真は 400 です（`photos.<n>.isPublic` の `custom`。`Must have the consent of the customer`）
- 1 回の追加で、前の写真と同じ `photoUrl` は 400（`photos.<n>.photoUrl` の `custom`。`Must not repeat the address of an earlier photo`）、前の写真と同じ `sortOrder` も 400 です（`photos.<n>.sortOrder` の `custom`。`Must not repeat the sortOrder of an earlier photo`）。1 回の追加の写真は、同じ時刻に足すので、`sortOrder` だけで並びが決まるようにします。規則に合わないものは、まとめて返します
- **施術記録 1 件の写真は、20 枚までです**。追加済みの写真と合わせて 20 枚を超えると 409 です（`The record holds <n> photos; a record holds at most 20`）
- **施術記録 1 件に、同じ URL の写真は 1 枚です**。追加済みの写真と同じ `photoUrl` の写真があると 409 です（`The record holds a photo at <photoUrl> already; a record holds one photo of an address`）。同じリクエストを 2 回送っても、写真は 2 回足されません。ほかの施術記録の写真と同じ URL は、かまいません
- 2 つの 409 に当たるときは、URL の 409 を返します。URL は、リクエストの順で最初の、追加済みの URL です
- 足すと 201 で、`data.created` に、足した写真を、リクエストの順に ID を付けて返します。写真 1 枚ずつのルートはないので、`Location` ヘッダーはありません。`links.record` は、施術記録の取得のパスです
- 写真を足すと、施術記録の `updatedAt` が、足した時刻になります。1 回の追加の写真の作成日時は、その時刻です

### 施術写真の削除

- `DELETE /api/v1/treatments/{id}/photos/{photoId}` は、写真を 1 枚、物理削除して、204 を返します。誤って足した写真を、施術記録を残したまま外すためのものです
- 写真がその施術記録のものでなければ、404 です（`TreatmentPhoto <photoId> was not found`）。ほかの施術記録の写真も、存在しない写真と区別しません
- 外すと、施術記録の `updatedAt` が、外した時刻になります。残った写真の `sortOrder` は変わりません

## 統計

`GET /api/v1/treatments/statistics` は、サロンの施術記録を集計します。統計のテーブルはなく、読むたびに施術記録を数えます。

クエリ:

| パラメーター | 規則 |
|---|---|
| `salonId` | 必須。サロンの ID。サロンのユーザーは、自分のサロンだけ（ほかのサロンは 403） |
| `startDate`、`endDate` | 作成日時の範囲。どちらも含みます。省くと、その側は限りません。`endDate` は `startDate` より前にできません（`endDate` の `custom`。`Must not be earlier than startDate`） |

- 日時の書き方と比べ方は、一覧と同じです（[1 件の取得と一覧](#1-件の取得と一覧)）。`createdAt` は、ミリ秒までの時刻で比べます
- `salonId` のサロンが存在しないか、削除されていると、400 です（`salonId` の `not_found`。`Must name a salon`）
- 表にないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回書くと 400 です

レスポンス:

| プロパティ | 意味 |
|---|---|
| `totalTreatments` | 期間の、サロンの予約の施術記録の数 |
| `treatmentsByCategory` | サービスのカテゴリーの区分（`category`）ごとの、その区分のサービスを含む施術記録の数（`count`） |
| `averageProcessingTime` | 施術時間（`processingTime`）のある施術記録の、施術時間の平均（分）。小数第 1 位に四捨五入します。施術時間のある施術記録がなければ null |
| `topServices` | サービス（`serviceId`）ごとの、そのサービスを含む施術記録の数（`count`）。上位 10 件 |

- 区分は、施術記録の `services` のサービスの、カテゴリーのいまの区分（`service_categories.category`）です。カテゴリーのないサービスは `other` で、区分が `other` のカテゴリーのサービスと合わせます
- 1 件の施術記録が同じ区分のサービスを 2 つ含んでも、その区分の 1 件です。違う区分のサービスを含めば、区分ごとに 1 件です。なので、区分の件数を合わせると、`totalTreatments` より多いことがあります
- 削除したサービスと、取り扱いをやめたサービスも数えます。施術記録の `services` に残るからです
- `treatmentsByCategory` は件数の多い順、同じ件数は区分の名前の順です。施術記録のない区分は載りません
- `topServices` は件数の多い順、同じ件数はサービス ID の順に、10 件までです
- 施術時間が 0 の施術記録も、平均に入ります
- 期間に施術記録がなければ、`totalTreatments` は 0、2 つの一覧は空、平均は null です
- 集計は、1 つのスナップショット（`REPEATABLE READ` の読み取り専用のトランザクション）で読みます。集計の途中に書かれた施術記録は、どの数にも入りません
- `links.self` は、リクエストのパスとクエリを、書いたままで返します

## 同時に届いたリクエスト

- **作成は、予約の行を `FOR SHARE` でロックしてから、予約を確かめます**（`READ COMMITTED` のトランザクション）。予約の状態の変更と予約の削除は、予約を `FOR UPDATE` でロックするので、作成は、その途中の予約を待ち、変更のあとの状態で決まります（たとえば、取り消された予約は 409）
- 作成は、続けて、サロン、顧客、サービス（ID の順）、スタッフ、商品（ID の順）を `FOR KEY SHARE` で読みます。どれも、その削除がとるロック（`FOR UPDATE`）と互いに待つロックです。削除の途中のものへの作成は、それを待ち、削除されれば 400 です（そのプロパティの `not_found`）。ロックの順は、ほかの書き込みと同じ順（予約、サロン、顧客、サービス、スタッフ）に、商品を最後に足したものです
- **施術記録は、予約の一意制約（`treatment_records_booking_unique`）に当たれば何もしない挿入（`ON CONFLICT DO NOTHING`）で書きます**。同じ予約の作成が同時に 2 件届くと、1 件が 201 で、もう 1 件は 409 です
- **更新は、施術記録の行を `FOR UPDATE` でロックしてから、本文を予約に照らします**。同じ施術記録の更新は 1 件ずつです。使用商材を書く更新が同時に 2 件届くと、施術記録の使用商材は、どちらか一方の一覧そのものです。削除の途中の施術記録の更新は、それを待ち、削除されれば 404 です
- 更新は、本文のサービスと商品を、作成と同じロックで読みます。削除の途中の商品を書く更新は、それを待ち、削除されれば 400 です
- 作成と更新の時刻（`createdAt`、`updatedAt`）は、書いた時刻です（データベースの `clock_timestamp()`）。ロックを待った書き込みは、待ったあとの時刻です
- **写真の追加と削除は、施術記録の行を `FOR NO KEY UPDATE`（`updatedAt` を書く更新のロック）でロックしてから、写真を読みます**（`READ COMMITTED` のトランザクション）。同じ施術記録の写真の追加と削除は 1 件ずつで、あとのものは、前のものが足した写真を数えます。追加が同時に届いても、施術記録の写真は 20 枚を超えず、同じ URL の写真は 1 枚です
- 施術記録の更新と削除の途中の施術記録への、写真の追加と削除は、それを待ちます。施術記録が削除されれば 404 です。施術記録を外部キーで指す行の書き込み（`FOR KEY SHARE`）は待ちません
- 写真の作成日時と、写真を足した施術記録の `updatedAt` は、ロックを待ったあとの時刻です（データベースの `clock_timestamp()`）
- 取得、一覧、統計は、ロックを待ちません

## DB の制約

マイグレーション `202611171800_treatment_record_rules.sql` で、`treatment_records` の構造が決まっていなかった 7 つの jsonb 列に構造を与え、施術記録が 1 行だけで確かめられることを、データベースの制約にしました。

- `techniques` と `nextRecommendedServices` は一覧です。NULL を空配列にし、既定値を空配列にして、NOT NULL にしました
- `scalpCondition`、`hairCondition`、`colorFormula` は text にしました。保存されていた JSON の文字列は、その文字列に、ほかの JSON の値は、その JSON のテキストにしました
- `beforePhotos` と `afterPhotos` は、なくしました。写真は `treatment_photos` の行です。2 か所に持つと食い違います
- CHECK 制約 `treatment_records_lists`: `services` は 1 件以上の配列、`techniques` と `nextRecommendedServices` は配列
- CHECK 制約 `treatment_records_ranges`: `processingTime` は null か 0〜1440、`customerSatisfaction` は null か 1〜5
- 一意制約 `treatment_records_booking_unique`（`bookingId`）。予約 1 件に施術記録は 1 件です（以前からある制約です）
- インデックス `idx_treatment_records_created_at`（`createdAt`、`id`）。一覧の並びのためのものです
- `treatment_materials` に `sortOrder` を足しました。すでにある行は、施術記録ごとに作成日時と ID の順に 0 から番号を付けました。一意制約 `treatment_materials_record_sort_unique`（`treatmentRecordId`、`sortOrder`）
- CHECK 制約 `treatment_materials_amounts`: `quantity` は 0 より大きい、`sortOrder` は 0 以上

施術記録は、外部キーで、予約（`treatment_records_booking_id_fk`）、顧客（`treatment_records_customer_id_fk`）、スタッフ（`treatment_records_staff_id_fk`）を指します。どれも `ON DELETE RESTRICT` です。顧客、スタッフ、商品は論理削除なので、行は残ります。使用商材は、施術記録（`ON DELETE CASCADE`）と商品（`treatment_materials_product_id_fk`。`ON DELETE RESTRICT`）を指します。サービスの ID（`services`、`nextRecommendedServices`）は jsonb の一覧なので、外部キーがありません。予約のサロンのサービスであることは、リポジトリが確かめます。

CHECK 制約に合わない行は、直しません。何であるべきだったかが分からないからです。そのような行があると、マイグレーションは何も変えずに失敗するので、先に行を直します。マイグレーションは、何度適用しても同じ結果です。以前のバージョンは、施術記録の ID だけを読む（予約の削除が施術記録を探す）ので、マイグレーションを適用したあとも動きます。

マイグレーション `202611171900_treatment_photo_rules.sql` で、写真の行の規則を、データベースの制約にしました。

- `photoType` を、20 文字以下の文字列から、列挙型 `treatment_photo_type`（`before`、`during`、`after`、`other`）にしました。施術の前と後の写真を並べるためです。自由な文字列では並べられません
- CHECK 制約 `treatment_photos_consent`: `isPublic` が true なら、`customerConsent` も true
- CHECK 制約 `treatment_photos_sort_order`: `sortOrder` は 0 以上
- 一意制約 `treatment_photos_record_url_unique`（`treatmentRecordId`、`photoUrl`）。施術記録 1 件に、同じ URL の写真は 1 枚です
- インデックス `idx_treatment_photos_photo_type` をなくしました。写真を、施術記録をまたいで区分で探すことはないからです。`idx_treatment_photos_treatment_record_id` もなくしました。一意制約のインデックスが、施術記録から始まるからです

規則に合わない写真の行は、直しません。何であるべきだったかが分からないからです。そのような行があると、マイグレーションは何も変えずに失敗するので、先に行を直します。マイグレーションは、何度適用しても同じ結果です。以前のバージョンは写真を書かず、写真の区分を文字列として読むので、マイグレーションを適用したあとも動きます。

`pnpm check:api-db` は、施術記録のすべての列を、レスポンス、作成、更新のモデルと照らします。更新のモデルには、`bookingId`、`customerId`、`staffId` がありません。使用商材の `sortOrder` は、一覧の中の位置なので、モデルにありません。写真の列は、`TreatmentPhotoResponse`（施術記録の ID と作成日時を除く）と `TreatmentPhotoCreateRequest`（ID、施術記録の ID、作成日時を除く）と照らします（[API-DB型制約マッピング](./api-db-type-constraints-mapping.md)）。統計にはテーブルがないので、照らしません。

## シード

`pnpm db:seed` は、1 つ目のサロンの完了した予約のうち、最初の 3 件に、施術記録を入れます。

| 予約 | 技法 | 使用商材 | 写真 |
|---|---|---|---|
| 1 件目 | レイヤーカット、ディープコンディショニング | `TREAT001` を 15 | 施術後の正面（非公開） |
| 2 件目 | なし | なし | なし |
| 3 件目 | ワンメイクカラー、レイヤーカット | `COLOR001` を 1、`DEVELOPER001` を 0.5 | 施術前の側面（非公開）、施術後の側面（公開） |

- `services` は予約の明細のサービス、`staffId` は予約の担当スタッフ、`nextRecommendedDate` は予約の日の 28 日後、`nextRecommendedServices` は予約の最初のサービスです
- 使用商材の単位は商品の単位、ロット番号はそのサロンの在庫の行のロット番号です。在庫は動かしません
- 写真の URL は `https://images.example.com/treatments/<施術記録の ID>/<ファイル名>` で、縮小した写真はありません。どの写真も、顧客の同意があります
- シードの施術記録がある予約は、削除できません（409）

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/treatment.tsp`（`TreatmentRecordResponse`、`TreatmentMaterial`、`TreatmentPhotoResponse`、`TreatmentPhotoType`、`TreatmentRecordCreateRequest`、`TreatmentRecordUpdateRequest`、`TreatmentRecordSearchRequest`、`TreatmentPhotoCreateRequest`、`TreatmentPhotoBulkCreateRequest`、`TreatmentPhotoBulkCreateResponse`、`TreatmentStatisticsGetRequest`、`TreatmentStatisticsResponse`、`TreatmentsByCategoryResponse`、`TreatmentsByServiceResponse`）、`specs/operations/treatment-operations.tsp`（`TreatmentRecordCrud`） |
| ドメイン | `backend/packages/domain/src/models/treatment-record.ts`、`schemas/treatment-record.schema.ts`、`schemas/treatment-photo.schema.ts`、`mappers/read/treatment-record.mapper.ts`、`mappers/write/treatment-record.mapper.ts`、`repositories/treatment-record.repository.ts`、`business-logic/treatment-record/`（誰が読み、誰が削除するかは `_shared/authorization.ts`、予約との関係は `_shared/rules.ts`、写真の 409 は `_shared/photos.ts`、統計の平均は `_shared/statistics.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/treatment-record.repository.impl.ts` |
| API | `backend/packages/api/src/routes/treatment-record/`（`/api/v1/treatments`） |
| DB | `backend/packages/database/sql/migrations/202611171800_treatment_record_rules.sql`、`202611171900_treatment_photo_rules.sql`、`src/seeds/seed-data/treatment-records.ts` |
| テスト | `backend/packages/domain/src/__tests__/treatment-record.*.test.ts`、`treatment-photo.test.ts`、`treatment-statistics.test.ts`、`backend/packages/api/src/__tests__/treatment-record.integration.test.ts`、`treatment-photo.integration.test.ts`、`treatment-statistics.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
