# カルテ

顧客のカルテの規則をまとめます。コントラクトは `specs/operations/treatment-operations.tsp`（`TreatmentOperations` の `MedicalChartCrud`）と `specs/models/treatment.tsp`、テーブルは `medical_charts` です。

カルテは、施術の前にスタッフが確かめる、顧客の情報です。ほかのサロンで受けた施術、注意が必要な持病や体調、好みの商材と避ける商材、メモを持ちます。顧客 1 人に 1 件で、管理者とサロンのスタッフが `/api/v1/medical-charts` で扱います。顧客のアカウントは、自分のカルテも読めません。

カルテに持たないものは、ほかの場所にあります。

| 情報 | 場所 |
|---|---|
| 顧客のアレルギー | `customer_allergies` の行。種類、重篤度、症状、確認日を持つ。カルテの一覧の `hasAllergies` は、この行で絞り込む |
| ふだんの頭皮と髪 | 顧客台帳の `scalpCondition`、`hairType`、`hairThickness`（[顧客台帳](./customers.md)） |
| 施術のときの頭皮と毛髪の状態、カラー剤の配合 | 施術記録（[施術記録](./treatments.md)） |
| 誰がいつ書き換えたか | 持たない。変更の履歴は、顧客の監査履歴（未実装）で扱う |

## 実装範囲

| オペレーション | 状態 |
|---|---|
| カルテの一覧（`list`） | 実装済み |
| カルテの作成（`create`） | 実装済み |
| 顧客のカルテの取得（`getByCustomer`） | 実装済み |
| カルテの更新（`update`） | 実装済み |
| 顧客のアレルギーの一覧（`listAllergies`） | 未実装（ルートがなく 404） |

- カルテを削除するオペレーションはありません（コントラクトにありません）。顧客を削除すると、カルテも見えなくなります（[削除された顧客](#削除された顧客)）
- 以前のコントラクトにあった `allergies`（文字列の配列）、`scalpCondition`、`hairCondition`、`lastUpdated`、`createdBy`、`updatedBy` はなくしました。アレルギーと頭皮と髪は、上の表の場所にあります。`lastUpdated` は `updatedAt` と同じものです。最後に書いた人だけでは、変更の記録にならないので、`createdBy` と `updatedBy`（`AuditInfo`）は持ちません

## カルテ

| プロパティ | 意味 |
|---|---|
| `id` | カルテの ID |
| `customerId` | 顧客。顧客 1 人にカルテは 1 件 |
| `previousTreatments` | 過去の施術の一覧（[過去の施術](#過去の施術)）。保存した順 |
| `medicalConditions` | 施術の前に注意が必要な持病や体調 |
| `preferredProducts` | 好みの商材やブランドの名前の一覧。保存した順 |
| `avoidProducts` | 避ける商材やブランドの名前の一覧。保存した順 |
| `notes` | メモ |
| `createdAt`、`updatedAt` | 作成と最後の更新の日時 |

- 書かない項目は、文字列は null、一覧は空配列です。null を空文字にしたり、空配列を null にしたりはしません
- 日時は UTC で、ミリ秒までの ISO 8601 形式です（`2026-11-18T01:00:00.123Z`）

### 過去の施術

ほかのサロンで受けた施術や、記録を始める前の施術です。このサロンの施術は、施術記録にあります。

| プロパティ | 意味 |
|---|---|
| `treatment` | 施術の種類（`TreatmentType`。`cut`、`color`、`perm`、`treatment`、`head_spa`、`styling`、`extension`、`nail`、`eyelash`、`other`） |
| `date` | 施術日（`YYYY-MM-DD`） |
| `salonName` | 施術を受けたサロンの名前。分からなければ null |
| `notes` | 施術のメモ |

- 過去の施術には、それぞれの ID がありません。更新で書くと、一覧全体を置き換えます（[更新](#更新)）

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/medical-charts` | `admin`、どのサロンの `owner` / `manager` / `staff` も |
| 作成 | `POST /api/v1/medical-charts` | 同上 |
| 顧客のカルテの取得 | `GET /api/v1/medical-charts/customer/{customerId}` | 同上 |
| 更新 | `PATCH /api/v1/medical-charts/{id}` | 同上 |

- すべてのオペレーションに認証が要ります
- **権限は、顧客台帳と同じです**（`mayHandleCustomers`）。顧客台帳はプラットフォームで 1 つなので（[顧客台帳](./customers.md#台帳はプラットフォームで-1-つ)）、どのサロンのスタッフも、どの顧客のカルテも読み書きできます
- **顧客は、自分のカルテも読めません**（403）。持病や体調は、スタッフが施術のために書く情報だからです。ロール `customer` のユーザー、範囲 `none` のユーザー、スタッフの行を削除されたサロンのアカウントは、ID、本文、クエリが不正でも 403 です
- カルテは、顧客の ID で読み、カルテの ID で更新します。作成のレスポンスの `Location` と `links.self` は、顧客の ID による取得のパス（`/api/v1/medical-charts/customer/{customerId}`）です
- ID（パスの `id` と `customerId`、本文とクエリの ID）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です

### 確認の順序

一覧:

1. アクセストークン（401）
2. 操作者がカルテを読めること（403）
3. クエリ（400。`detail` は `Invalid medical chart search`）
4. `cursor` が、一覧に載るカルテを指すこと（400。`cursor` の `not_found`。`Must name a medical chart of the list`）

作成:

1. アクセストークン（401）
2. 操作者がカルテを書けること（403）
3. リクエストの本文（400。`detail` は `Invalid medical chart`。[作成リクエストの規則](#作成リクエストの規則)）
4. 過去の施術の施術日が未来でないこと（400。`previousTreatments.<n>.date` の `too_big`。`Must not be in the future`）
5. 顧客が存在し、削除されていないこと（400。`customerId` の `not_found`。`Must name a customer`）
6. 顧客にカルテがまだないこと（409。`The customer has a medical chart already; a customer has one`）

顧客のカルテの取得:

1. アクセストークン（401）
2. 操作者がカルテを読めること（403）
3. パスの `customerId` の形式（400。`detail` は `Invalid customer ID`。`customerId` の `invalid_format`）
4. 顧客が存在し、削除されていないこと（404。`Customer <customerId> was not found`）
5. 顧客のカルテがあること（404。`MedicalChart <customerId> was not found`。ID は、パスの顧客の ID です）

更新:

1. アクセストークン（401）
2. 操作者がカルテを書けること（403）
3. パスの `id` の形式（400。`detail` は `Invalid medical chart ID`）
4. リクエストの本文（400。`detail` は `Invalid medical chart`）
5. 本文に書いた過去の施術の施術日が未来でないこと（400）
6. カルテが存在し、その顧客が削除されていないこと（404。`MedicalChart <id> was not found`）

## 作成リクエストの規則

| プロパティ | 規則 |
|---|---|
| `customerId` | 必須。顧客の ID |
| `previousTreatments` | 必須。過去の施術の 0〜50 件 |
| `previousTreatments.<n>.treatment` | 必須。`TreatmentType` のどれか |
| `previousTreatments.<n>.date` | 必須。`YYYY-MM-DD` の日付。1900-01-01 から、今日まで |
| `previousTreatments.<n>.salonName` | 必須。空白だけでない 255 文字以下か null |
| `previousTreatments.<n>.notes` | 必須。空白だけでない文字列か null |
| `medicalConditions`、`notes` | 必須。空白だけでない文字列か null |
| `preferredProducts`、`avoidProducts` | 必須。空白だけでない 100 文字以下の名前の 0〜50 件。1 つの一覧に、同じ名前は 1 度だけ |

- 作成リクエストのプロパティは、すべて必須です。書かない項目は、null か空配列を書きます。書かないプロパティは 400 です（`invalid_type`）。一覧に null は書けません（`invalid_type`）
- 知らないプロパティは 400 です（`unrecognized_keys`）。以前のコントラクトにあった `allergies` と `scalpCondition` も、知らないプロパティです。過去の施術の知らないプロパティも 400 です
- 同じ名前の 2 度目は、その位置の `custom` です（`preferredProducts.<n>` か `avoidProducts.<n>`）。好みの一覧と避ける一覧に、同じ名前があってもかまいません。大文字と小文字が違えば、違う名前です
- **施術日は、今日より後にできません**。今日は、生年月日と同じく、UTC の日付の翌日までです（日本で日付が変わってから、UTC で日付が変わるまでの 9 時間も、日本の今日を書けるように）。合わない施術を、すべて、一覧の位置（`previousTreatments.<n>.date`）で返します。この確認は、本文の形を確かめたあと、顧客を探す前です
- 日付でない値（`2026-02-30` や、時刻のある値）は `invalid_format`、1900-01-01 より前は `too_small` です

## 更新

- 本文に書いた項目だけを変えます。少なくとも 1 つの項目を書きます（何もなければ `custom`）。値を消すには、null か空配列を書きます
- **顧客は変えられません**（`customerId` は知らないプロパティとして 400）
- 一覧（`previousTreatments`、`preferredProducts`、`avoidProducts`）を書くと、その一覧全体を、書いた順に置き換えます。書かなければ、その一覧は変わりません
- 本文の規則は、作成と同じです。本文に書いた過去の施術だけ、施術日を確かめます
- `updatedAt` は、書いた時刻です（データベースの `clock_timestamp()`）。ロックを待った更新は、待ったあとの時刻です

## 1 件の取得と一覧

一覧のクエリ:

| パラメーター | 規則 |
|---|---|
| `limit` | 1〜100 の整数。省略すると 20 |
| `cursor` | 前のページの `meta.nextCursor`。一覧に載るカルテの ID |
| `search` | 空白だけでない 100 文字以下のキーワード |
| `hasAllergies` | `true` か `false` |

- 並びは、作成日時の新しい順、同じ作成日時では ID の降順です。`cursor` は、そのあとのカルテからのページを返します（キーセット）。ページは、前にだけ進みます（`prevCursor` は、いつも null）
- `search` は、`medicalConditions`、`notes`、`preferredProducts` と `avoidProducts` の名前のどれかに、キーワードを含むカルテです。大文字と小文字は区別しません。`%` と `_` は、ただの文字です。過去の施術（サロン名、メモ）は探しません
- `hasAllergies` が `true` なら、顧客に `customer_allergies` の行があるカルテ、`false` なら行がないカルテです。省くと、絞り込みません
- 条件は、すべて AND で組み合わせます
- 表にないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回書くと 400 です。`limit` が数でなければ `invalid_format`、`hasAllergies` が `true` か `false` でなければ `invalid_value` です
- `meta.total` は、絞り込みに合うカルテの数です。カーソル、ページ、件数は、1 つのスナップショット（`REPEATABLE READ` の読み取り専用のトランザクション）で読みます。一覧の途中に書かれたカルテは、ページにも件数にも入りません
- 1 件の取得は、顧客とカルテを 1 つの文で読みます。顧客がいない（404 の `Customer`）か、カルテがない（404 の `MedicalChart`）かを区別します

## 削除された顧客

顧客は論理削除で、行が残ります（[顧客台帳](./customers.md#削除)）。カルテの行も残しますが、顧客と同じく見えなくなります。

- 取得は 404（`Customer <customerId> was not found`）、更新は 404（`MedicalChart <id> was not found`）です
- 一覧にも件数にも入りません。`cursor` に指定すると 400 です（`cursor` の `not_found`）
- 削除された顧客には、カルテを作成できません（`customerId` の `not_found`）
- 外部キーは `ON DELETE CASCADE` なので、顧客の行を物理削除すれば、カルテの行も消えます。顧客を物理削除するオペレーションはありません

## 同時に届いたリクエスト

- **作成は、顧客の行を `FOR SHARE` でロックしてから、カルテを書きます**（`READ COMMITTED` のトランザクション）。顧客の更新と削除は顧客の行をロックするので、作成は、その途中の顧客を待ちます。待った顧客が削除されていれば、400 です（`customerId` の `not_found`）
- **カルテは、顧客の一意制約（`medical_charts_customer_id_unique`）に当たれば何もしない挿入（`ON CONFLICT DO NOTHING`）で書きます**。同じ顧客の作成が同時に 2 件届くと、1 件が 201 で、もう 1 件は 409 です。ほかの書き込みが、まだ確定していないその顧客のカルテを書いていれば、作成はそれを待ち、確定すれば 409、取り消されれば 201 です
- **更新は 1 つの `UPDATE` 文です**。同じカルテの更新は 1 件ずつで、あとの更新は、前の更新が書いたものの上に、本文の項目だけを書きます。違う項目の更新が同時に 2 件届くと、どちらの項目も残ります
- 作成と更新の時刻（`createdAt`、`updatedAt`）は、書いた時刻です（データベースの `clock_timestamp()`）。ロックを待った書き込みは、待ったあとの時刻です
- 取得と一覧は、行のロックを待ちません

## DB の制約

マイグレーション `202611181000_medical_charts.sql` で、`medical_charts` を作りました。

- 外部キー `medical_charts_customer_id_fk`（`customerId` → `customers`。`ON DELETE CASCADE`）
- 一意制約 `medical_charts_customer_id_unique`（`customerId`）。顧客 1 人にカルテは 1 件です
- CHECK 制約 `medical_charts_lists`: `previousTreatments` は jsonb の配列、`preferredProducts` と `avoidProducts` は NULL の要素を持たない
- インデックス `idx_medical_charts_created_at`（`createdAt`、`id`）。一覧の並びのためのものです
- 一覧の 3 列は NOT NULL で、既定値はありません。カルテは、すべての列を書いて作るからです（`customers.tags` と同じ）
- マイグレーションは、何度適用しても同じ結果です

過去の施術の形（施術の種類、日付、サロン名、メモ）は、データベースでは確かめません。API が書くものだけが入り、読むときに、レスポンスのモデルと照らします。合わない行は 500 です（`Stored medical chart <id> does not match the API model`）。

`pnpm check:api-db` は、カルテのすべての列を、レスポンス、作成、更新のモデルと照らします。作成のモデルには `id`、`createdAt`、`updatedAt` が、更新のモデルには、それに加えて `customerId` がありません（[API-DB型制約マッピング](./api-db-type-constraints-mapping.md)）。

## シード

`pnpm db:seed` は、1 人目と 3 人目の顧客に、カルテを入れます。2 人目と 4 人目の顧客には、カルテがありません。

| 顧客 | 過去の施術 | 持病・体調 | 好みの商材 | 避ける商材 | メモ |
|---|---|---|---|---|---|
| 1 人目（Yuki Tanaka） | カラー（2026-03-14、Hair Studio Aoyama）、パーマ（2025-11-02、サロン不明） | 頭皮の乾燥とかゆみ | Aveda、オーガニックシャンプー | 強い香料の整髪料 | あり |
| 3 人目（Sakura Sato） | なし | 腰痛。施術の途中で休憩をはさむ | なし | なし | なし |

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/treatment.tsp`（`PreviousTreatment`、`MedicalChartResponse`、`MedicalChartCreateRequest`、`MedicalChartUpdateRequest`、`MedicalChartSearchRequest`）、`specs/operations/treatment-operations.tsp`（`MedicalChartCrud`） |
| ドメイン | `backend/packages/domain/src/models/medical-chart.ts`、`schemas/medical-chart.schema.ts`、`mappers/read/medical-chart.mapper.ts`、`mappers/write/medical-chart.mapper.ts`、`repositories/medical-chart.repository.ts`、`business-logic/medical-chart/`（施術日の規則は `_shared/rules.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/medical-chart.repository.impl.ts` |
| API | `backend/packages/api/src/routes/medical-chart/`（`/api/v1/medical-charts`） |
| DB | `backend/packages/database/sql/migrations/202611181000_medical_charts.sql`、`src/seeds/seed-data/medical-charts.ts` |
| テスト | `backend/packages/domain/src/__tests__/medical-chart.schema.test.ts`、`medical-chart.usecase.test.ts`、`backend/packages/api/src/__tests__/medical-chart.integration.test.ts` |
