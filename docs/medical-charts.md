# カルテ

顧客のカルテの規則をまとめます。コントラクトは `specs/operations/treatment-operations.tsp`（`TreatmentOperations` の `MedicalChartCrud`）と `specs/models/treatment.tsp`、テーブルは `medical_charts` と、顧客のアレルギーの `customer_allergies` です。

カルテは、施術の前にスタッフが確かめる、顧客の情報です。ほかのサロンで受けた施術、注意が必要な持病や体調、好みの商材と避ける商材、メモを持ちます。顧客 1 人に 1 件で、管理者とサロンのスタッフが `/api/v1/medical-charts` で扱います。顧客のアカウントは、自分のカルテも読めません。

カルテに持たないものは、ほかの場所にあります。

| 情報 | 場所 |
|---|---|
| 顧客のアレルギー | `customer_allergies` の行。種類、アレルゲン、重篤度、症状、確認日を持ち、`/api/v1/medical-charts/customer/{customerId}/allergies` で扱う（[顧客のアレルギー](#顧客のアレルギー)）。カルテの一覧の `hasAllergies` は、この行で絞り込む |
| ふだんの頭皮と髪 | 顧客台帳の `scalpCondition`、`hairType`、`hairThickness`（[顧客台帳](./customers.md)） |
| 施術のときの頭皮と毛髪の状態、カラー剤の配合 | 施術記録（[施術記録](./treatments.md)） |
| 誰がいつ書き換えたか | 持たない。残るのは、最後に書いた時刻（`updatedAt`）だけ。顧客台帳の変更履歴（[変更履歴と版](./customers.md#変更履歴と版)）は、顧客の行の版で、カルテを含まない |

## 実装範囲

| オペレーション | 状態 |
|---|---|
| カルテの一覧（`list`） | 実装済み |
| カルテの作成（`create`） | 実装済み |
| 顧客のカルテの取得（`getByCustomer`） | 実装済み |
| カルテの更新（`update`） | 実装済み |
| 顧客のアレルギーの一覧（`listAllergies`） | 実装済み |
| 顧客のアレルギーの追加（`addAllergy`） | 実装済み |
| 顧客のアレルギーの更新（`updateAllergy`） | 実装済み |
| 顧客のアレルギーの削除（`removeAllergy`） | 実装済み |

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
| 顧客のアレルギーの一覧 | `GET /api/v1/medical-charts/customer/{customerId}/allergies` | 同上 |
| 顧客のアレルギーの追加 | `POST /api/v1/medical-charts/customer/{customerId}/allergies` | 同上 |
| 顧客のアレルギーの更新 | `PATCH /api/v1/medical-charts/customer/{customerId}/allergies/{allergyId}` | 同上 |
| 顧客のアレルギーの削除 | `DELETE /api/v1/medical-charts/customer/{customerId}/allergies/{allergyId}` | `admin`、どのサロンの `owner` / `manager` も |

- すべてのオペレーションに認証が要ります
- **権限は、顧客台帳と同じです**（`mayHandleCustomers`）。顧客台帳はプラットフォームで 1 つなので（[顧客台帳](./customers.md#台帳はプラットフォームで-1-つ)）、どのサロンのスタッフも、どの顧客のカルテとアレルギーも読み書きできます
- **アレルギーの削除は、顧客の削除と同じ権限です**（`mayDeleteCustomers`）。施術の安全のための記録なので、`staff` は追加と更新はできても、削除はできません（403）
- **顧客は、自分のカルテとアレルギーも読めません**（403）。持病や体調、アレルギーは、スタッフが施術のために書く情報だからです。ロール `customer` のユーザー、範囲 `none` のユーザー、スタッフの行を削除されたサロンのアカウントは、ID、本文、クエリが不正でも 403 です
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

## 顧客のアレルギー

アレルギーは、施術の前に確かめる、顧客のアレルギーの記録です。顧客 1 人に、アレルゲンごとに 1 件で、カルテがあってもなくても書けます。`/api/v1/medical-charts/customer/{customerId}/allergies` で扱います。

| プロパティ | 意味 |
|---|---|
| `id` | アレルギーの ID |
| `allergyType` | 種類（`AllergyType`。`chemical` 化学物質、`fragrance` 香料、`metal` 金属、`latex` ラテックス、`plant` 植物、`other` その他） |
| `allergenName` | アレルゲンの名前。顧客 1 人に、同じ名前は 1 件だけ |
| `severityType` | 重篤度（`AllergySeverityType`。軽い順に `mild`、`moderate`、`severe`、`life_threatening`） |
| `symptoms` | 症状。記録しなければ null |
| `notes` | 施術のときの注意などのメモ。なければ null |
| `confirmedDate` | アレルギーを確かめた日（`YYYY-MM-DD`）。分からなければ null |
| `createdAt`、`updatedAt` | 作成と最後の更新の日時 |

- 顧客は、レスポンスに持ちません。パスの `customerId` が顧客です
- 1 件を読むルートはありません。追加（201）と更新（200）のレスポンスは `Location` を持たず、`links.list` に、その顧客のアレルギーの一覧のパスを返します。このパスは、リクエストのパスのまま（マウントパスと `customerId` の書き方のまま）です
- 削除のレスポンスは 204 で、本文はありません
- 以前のテーブルにあった数の重篤度（`severity`）は、なくしました（[DB の制約](#db-の制約)）

### アレルギーの確認の順序

一覧:

1. アクセストークン（401）
2. 操作者がアレルギーを読めること（403）
3. パスの `customerId` の形式（400。`detail` は `Invalid customer ID`。`customerId` の `invalid_format`）
4. クエリ（400。`detail` は `Invalid customer allergy search`）
5. 顧客が存在し、削除されていないこと（404。`Customer <customerId> was not found`）
6. `cursor` が、その顧客のアレルギーを指すこと（400。`cursor` の `not_found`。`Must name an allergy of the customer`）

追加:

1. アクセストークン（401）
2. 操作者がアレルギーを書けること（403）
3. パスの `customerId` の形式（400。`detail` は `Invalid customer ID`）
4. リクエストの本文（400。`detail` は `Invalid customer allergy`。[アレルギーの追加リクエストの規則](#アレルギーの追加リクエストの規則)）
5. 確認日が未来でないこと（400。`confirmedDate` の `too_big`。`Must not be in the future`）
6. 顧客が存在し、削除されていないこと（404。`Customer <customerId> was not found`）
7. 顧客に、同じアレルゲンのアレルギーがまだないこと（409。`The customer has an allergy of that allergen already; an allergen is recorded once`）

更新:

1. アクセストークン（401）
2. 操作者がアレルギーを書けること（403）
3. パスの `customerId` と `allergyId` の形式（400。`detail` は `Invalid customer allergy ID`。合わないものを、それぞれの名前の `invalid_format` で返す）
4. リクエストの本文（400。`detail` は `Invalid customer allergy`）
5. 本文に書いた確認日が未来でないこと（400）
6. 顧客が存在し、削除されていないこと（404。`Customer <customerId> was not found`）
7. その顧客のアレルギーがあること（404。`CustomerAllergy <allergyId> was not found`。ほかの顧客のアレルギーの ID も 404）
8. 新しいアレルゲンが、顧客のほかのアレルギーにないこと（409。`Another allergy of the customer has that allergen; an allergen is recorded once`）

削除:

1. アクセストークン（401）
2. 操作者がアレルギーを削除できること（403。`staff` は、ID が不正でも 403）
3. パスの `customerId` と `allergyId` の形式（400。`detail` は `Invalid customer allergy ID`）
4. 顧客が存在し、削除されていないこと（404。`Customer <customerId> was not found`）
5. その顧客のアレルギーがあること（404。`CustomerAllergy <allergyId> was not found`）

### アレルギーの追加リクエストの規則

| プロパティ | 規則 |
|---|---|
| `allergyType` | 必須。`AllergyType` のどれか |
| `allergenName` | 必須。空白だけでない 255 文字以下の文字列 |
| `severityType` | 必須。`AllergySeverityType` のどれか |
| `symptoms`、`notes` | 必須。空白だけでない文字列か null |
| `confirmedDate` | 必須。`YYYY-MM-DD` の日付か null。1900-01-01 から、今日まで |

- プロパティは、すべて必須です。書かない項目は null を書きます。書かないプロパティは 400 です（`invalid_type`。種類と重篤度は `invalid_value`）
- 知らないプロパティは 400 です（`unrecognized_keys`）。顧客（`customerId`）と、以前の `severity` も、知らないプロパティです
- **アレルゲンは、顧客 1 人に 1 件です**。顧客がすでに持つアレルゲンを追加すると 409 で、何も書きません。種類や重篤度が違っても同じです。大文字と小文字が違えば、違う名前です（`PPD` と `ppd`）。ほかの顧客と同じ名前は、かまいません
- **確認日は、今日より後にできません**。今日は、カルテの施術日と同じく、UTC の日付の翌日までです。この確認は、本文の形を確かめたあと、顧客を探す前です
- 日付でない値（`2026-02-30` など）は `invalid_format`、1900-01-01 より前は `too_small` です

### アレルギーの更新と削除

- 更新は、本文に書いた項目だけを変えます。少なくとも 1 つの項目を書きます（何もなければ `custom`）。`symptoms`、`notes`、`confirmedDate` は null で消せます。`allergyType`、`allergenName`、`severityType` に null は書けません
- **顧客は変えられません**（`customerId` は知らないプロパティとして 400）
- アレルゲンを、今と同じ名前に書くのは、かまいません。顧客のほかのアレルギーと同じ名前は 409 で、何も変えません
- `updatedAt` は、書いた時刻です（データベースの `clock_timestamp()`）。ロックを待った更新は、待ったあとの時刻です
- 削除は、間違えて記録したアレルギーのためのもので、行を消します。顧客の最後のアレルギーを削除すると、そのカルテは、カルテの一覧の `hasAllergies=false` に載ります

### アレルギーの一覧

| パラメーター | 規則 |
|---|---|
| `limit` | 1〜100 の整数。省略すると 20 |
| `cursor` | 前のページの `meta.nextCursor`。その顧客のアレルギーの ID |

- **並びは、重篤度の重い順です**（`life_threatening`、`severe`、`moderate`、`mild`）。施術の前に、重いものから確かめるためです。同じ重篤度は、記録した順（作成日時の古い順、同じ作成日時は ID の昇順）です。`cursor` は、そのあとのアレルギーからのページを返します（キーセット）。ページは、前にだけ進みます（`prevCursor` は、いつも null）
- アレルゲンの名前では並べません。名前の順は、データベースの照合順序で変わるからです
- 表にないパラメーターは 400 です（`unrecognized_keys`）。同じパラメーターを 2 回書くと 400 です。`limit` が数でなければ `invalid_format` です
- 顧客にアレルギーがなければ、空のページです（200）
- `meta.total` は、その顧客のアレルギーの数です。顧客、カーソル、ページ、件数は、1 つのスナップショット（`REPEATABLE READ` の読み取り専用のトランザクション）で読みます。一覧の途中に書かれたアレルギーは、ページにも件数にも入りません

### 同時に届いたアレルギーの書き込み

- **追加は、顧客の行を `FOR SHARE` でロックしてから、アレルギーを書きます**（`READ COMMITTED` のトランザクション）。顧客の更新と削除の途中なら、それを待ちます。待った顧客が削除されていれば、404 です
- **アレルギーは、顧客とアレルゲンの一意制約（`customer_allergies_customer_allergen_unique`）に当たれば何もしない挿入（`ON CONFLICT DO NOTHING`）で書きます**。同じアレルゲンの追加が同時に 2 件届くと、1 件が 201 で、もう 1 件は 409 です。ほかの書き込みが、まだ確定していない同じアレルゲンのアレルギーを書いていれば、追加はそれを待ち、確定すれば 409、取り消されれば 201 です。違うアレルゲンなら待ちません
- **更新と削除は、それぞれ 1 つの文です**（`UPDATE`、`DELETE`）。同じアレルギーの更新は 1 件ずつで、あとの更新は、前の更新が書いたものの上に、本文の項目だけを書きます。違う項目の更新が同時に 2 件届くと、どちらの項目も残ります
- アレルゲンを書き換える更新は、ほかの書き込みがまだ確定していない同じアレルゲンのアレルギーを書いていれば、それを待ち、確定すれば 409 です
- 追加と更新の時刻（`createdAt`、`updatedAt`）は、書いた時刻です（データベースの `clock_timestamp()`）。ロックを待った書き込みは、待ったあとの時刻です。追加したアレルギーの `createdAt` と `updatedAt` は、時計を 1 回読んだ、同じ時刻です
- 一覧は、行のロックを待ちません

## 削除された顧客

顧客は論理削除で、行が残ります（[顧客台帳](./customers.md#削除)）。カルテの行も残しますが、顧客と同じく見えなくなります。

- 取得は 404（`Customer <customerId> was not found`）、更新は 404（`MedicalChart <id> was not found`）です
- 一覧にも件数にも入りません。`cursor` に指定すると 400 です（`cursor` の `not_found`）
- 削除された顧客には、カルテを作成できません（`customerId` の `not_found`）
- アレルギーの行も残しますが、見えなくなります。一覧、追加、更新、削除は 404 です（`Customer <customerId> was not found`）
- 外部キーは `ON DELETE CASCADE` なので、顧客の行を物理削除すれば、カルテとアレルギーの行も消えます。顧客を物理削除するオペレーションはありません

## 同時に届いたリクエスト

- **作成は、顧客の行を `FOR SHARE` でロックしてから、カルテを書きます**（`READ COMMITTED` のトランザクション）。顧客の更新と削除は顧客の行をロックするので、作成は、その途中の顧客を待ちます。待った顧客が削除されていれば、400 です（`customerId` の `not_found`）
- **カルテは、顧客の一意制約（`medical_charts_customer_id_unique`）に当たれば何もしない挿入（`ON CONFLICT DO NOTHING`）で書きます**。同じ顧客の作成が同時に 2 件届くと、1 件が 201 で、もう 1 件は 409 です。ほかの書き込みが、まだ確定していないその顧客のカルテを書いていれば、作成はそれを待ち、確定すれば 409、取り消されれば 201 です
- **更新は 1 つの `UPDATE` 文です**。同じカルテの更新は 1 件ずつで、あとの更新は、前の更新が書いたものの上に、本文の項目だけを書きます。違う項目の更新が同時に 2 件届くと、どちらの項目も残ります
- 作成と更新の時刻（`createdAt`、`updatedAt`）は、書いた時刻です（データベースの `clock_timestamp()`）。ロックを待った書き込みは、待ったあとの時刻です。作成したカルテの `createdAt` と `updatedAt` は、時計を 1 回読んだ、同じ時刻です
- 取得と一覧は、行のロックを待ちません
- アレルギーの書き込みも、同じ作りです（[同時に届いたアレルギーの書き込み](#同時に届いたアレルギーの書き込み)）

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

マイグレーション `202611181100_customer_allergy_rules.sql` で、`customer_allergies` に、アレルギーの規則を足しました。

- **重篤度を `severityType`（`allergy_severity`）の 1 つにして、NOT NULL にしました**。以前は、数の `severity`（既定値 3）と、それから求めた `severityType`（NULL 可）の 2 つがありました。`severityType` が NULL の行を `severity` から埋めてから（2 以下は `mild`、3 は `moderate`、4 は `severe`、それより上は `life_threatening`。`202509202132_align_enums_with_typespec.sql` と同じ対応）、`severity` を削除しました
- **一意制約 `customer_allergies_customer_allergen_unique`（`customerId`、`allergenName`）**。顧客 1 人に、アレルゲンは 1 件です。この制約に合わない行があれば、マイグレーションは失敗し、何も変えません。どの行を残すかは決められないので、先に直します
- この制約の索引は `customerId` から始まるので、顧客のアレルギーも探せます。`customerId` だけのインデックス `idx_customer_allergies_customer_id` は削除しました
- 外部キー `customer_allergies_customer_id_fk`（`customerId` → `customers`。`ON DELETE CASCADE`）は、以前からあります
- マイグレーションは、何度適用しても同じ結果です

`pnpm check:api-db` は、アレルギーのすべての列を、レスポンス、追加、更新のモデルと照らします。レスポンスのモデルには `customerId` が、追加と更新のモデルには、それに加えて `id`、`createdAt`、`updatedAt` がありません。

## シード

`pnpm db:seed` は、1 人目と 3 人目の顧客に、カルテを入れます。2 人目と 4 人目の顧客には、カルテがありません。

| 顧客 | 過去の施術 | 持病・体調 | 好みの商材 | 避ける商材 | メモ |
|---|---|---|---|---|---|
| 1 人目（Yuki Tanaka） | カラー（2026-03-14、Hair Studio Aoyama）、パーマ（2025-11-02、サロン不明） | 頭皮の乾燥とかゆみ | Aveda、オーガニックシャンプー | 強い香料の整髪料 | あり |
| 3 人目（Sakura Sato） | なし | 腰痛。施術の途中で休憩をはさむ | なし | なし | なし |

1 人目の顧客には、アレルギーを 2 件入れます。3 人目の顧客には、カルテがあってアレルギーがないので、カルテの一覧の `hasAllergies` は、`true` でも `false` でも 1 件になります。

| アレルゲン | 種類 | 重篤度 | 症状 | メモ | 確認日 |
|---|---|---|---|---|---|
| パラフェニレンジアミン（PPD） | `chemical` | `severe` | カラー剤で頭皮に赤みとかゆみが出た | ジアミンを含まないカラー剤を使う | 2025-06-10 |
| 強い香料 | `fragrance` | `mild` | なし | 無香料のスタイリング剤を使う | なし |

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/treatment.tsp`（`PreviousTreatment`、`MedicalChartResponse`、`MedicalChartCreateRequest`、`MedicalChartUpdateRequest`、`MedicalChartSearchRequest`、`CustomerAllergyResponse`、`CustomerAllergyCreateRequest`、`CustomerAllergyUpdateRequest`、`CustomerAllergySearchRequest`）、`specs/operations/treatment-operations.tsp`（`MedicalChartCrud`） |
| ドメイン | `backend/packages/domain/src/models/medical-chart.ts`、`schemas/medical-chart.schema.ts`、`mappers/read/medical-chart.mapper.ts`、`mappers/write/medical-chart.mapper.ts`、`repositories/medical-chart.repository.ts`、`business-logic/medical-chart/`（施術日の規則は `_shared/rules.ts`）。アレルギーは `models/customer-allergy.ts`、`schemas/customer-allergy.schema.ts`、`mappers/read/customer-allergy.mapper.ts`、`mappers/write/customer-allergy.mapper.ts`、`repositories/customer-allergy.repository.ts`、`business-logic/customer-allergy/`（確認日の規則は `_shared/rules.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/medical-chart.repository.impl.ts`、`customer-allergy.repository.impl.ts` |
| API | `backend/packages/api/src/routes/medical-chart/`（`/api/v1/medical-charts`。アレルギーは `*-customer-allerg*.handler.ts`） |
| DB | `backend/packages/database/sql/migrations/202611181000_medical_charts.sql`、`202611181100_customer_allergy_rules.sql`、`src/seeds/seed-data/medical-charts.ts`、`customer-allergies.ts` |
| テスト | `backend/packages/domain/src/schemas/__tests__/medical-chart.schema.test.ts`、`backend/packages/domain/src/mappers/__tests__/medical-chart.mapper.test.ts`、`backend/packages/domain/src/business-logic/medical-chart/__tests__/medical-chart.usecase.test.ts`、`backend/packages/domain/src/schemas/__tests__/customer-allergy.schema.test.ts`、`backend/packages/domain/src/mappers/__tests__/customer-allergy.mapper.test.ts`、`backend/packages/domain/src/business-logic/customer-allergy/__tests__/customer-allergy.usecase.test.ts`、`backend/packages/api/src/routes/medical-chart/__tests__/medical-chart.integration.test.ts`、`customer-allergy.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts`（マイグレーション） |
