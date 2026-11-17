# ポイント台帳

顧客のポイントの残高と、その増減の記録（ポイント取引）の規則をまとめます。コントラクトは `specs/operations/payment-operations.tsp` の `PointCrud` と `specs/models/payment.tsp`、テーブルは `customer_points` と、`customers` の `loyaltyPoints` です。

ポイントは顧客のもので、サロンのものではありません。顧客台帳と同じく、ポイント台帳はプラットフォーム全体で 1 つです。顧客は、どのサロンで貯めたポイントも、どのサロンでも使えます。管理者とサロンのスタッフが、レジで `/api/v1/points` を使って記録します。

売上と支払いの規則は、[売上台帳](./sales.md) と [支払い](./payments.md) にあります。顧客の規則は、[顧客台帳](./customers.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 残高（`getBalance`）、履歴（`listTransactions`）、有効期限が近いポイント（`getExpiring`）、付与（`earn`）、利用（`use`）、調整（`adjust`）、失効（`expire`） | 実装済み |

- 有効期限を過ぎたポイントは、管理者が失効（`expire`）を実行するまで残高に残り、使えます（[有効期限と失効](#有効期限と失効)）
- 次のものは、ありません
  - 失効を決まった時刻に実行する仕組み（スケジューラー）。管理者が API を呼びます
  - 顧客の間でポイントを移すこと（種別 `transferred`）
  - 会員ランク（`membershipTier`）をポイントや利用額で変えること。会員ランクは、サロンが顧客台帳で決める値です（#233）
  - 1 ポイントが何円かと、売上の金額に対する付与率。付与するポイント数は、レジが決めて送ります
  - 売上や支払いと連動して、ポイントを自動で付与・利用すること（[売上と支払いとの関係](#売上と支払いとの関係)）
  - ポイント取引を直すことと、消すこと。誤りは、調整で打ち消します
  - 顧客本人が、自分の履歴を読むルート。顧客は、自分の残高をプロフィール（`/api/v1/customers/me` の `loyaltyPoints`）で見ます

## 残高と履歴

- 顧客の残高は `customers.loyaltyPoints` です。**ポイント台帳のルートだけが、残高を書きます**。顧客の作成と更新のリクエストでは書けません（[顧客台帳](./customers.md)）
- 残高を動かすたびに、ポイント取引を 1 件書きます。取引の `points` は増減（付与は正、利用と失効は負、調整はどちらか）、`balance` は、その取引の後の残高です
- **顧客の残高は、最新の取引の `balance` と等しくなります**。最新とは、`createdAt` が最も新しく、同じ時刻なら `id` が最も大きいものです。取引のない顧客の残高は 0 です
- 残高は 0 以上、2,147,483,647（`int32` の最大値）以下です。範囲を外れる取引は書きません（409）
- ポイントは整数です。1 未満の単位はありません

| 種別（`transactionType`） | ルート | `points` | `expiryDate` |
|---|---|---|---|
| `earned`（付与） | `POST /api/v1/points/earn` | 1 以上 | 指定できる。null なら期限なし |
| `used`（利用） | `POST /api/v1/points/use` | −1 以下。リクエストには正の数で書き、負の数で記録する | null |
| `adjusted`（調整） | `POST /api/v1/points/adjust` | 0 以外 | null |
| `expired`（失効） | `POST /api/v1/points/expire` | −1 以下 | null |
| `transferred`（移行） | なし | | null |

## オペレーションと権限

| オペレーション | ルート | 読む・書く人 |
|---|---|---|
| 残高 | `GET /api/v1/points/customer/{customerId}/balance` | `admin`、どのサロンの `owner`・`manager`・`staff` も |
| 履歴 | `GET /api/v1/points/customer/{customerId}/transactions` | 同上 |
| 有効期限が近いポイント | `GET /api/v1/points/customer/{customerId}/expiring` | 同上 |
| 付与 | `POST /api/v1/points/earn` | 同上 |
| 利用 | `POST /api/v1/points/use` | 同上 |
| 調整 | `POST /api/v1/points/adjust` | `admin`、どのサロンの `owner`・`manager` も |
| 失効 | `POST /api/v1/points/expire` | `admin` だけ |

- すべてのオペレーションに認証が要ります。誰が使えるかは、`business-logic/point/_shared/authorization.ts` の `pointReachOf`（残高、履歴、有効期限が近いポイント、付与、利用）、`pointAdjustReachOf`（調整）、`mayExpirePoints`（失効）が決めます。ポイントのための権限（`users.permissions`）はありません
- **サロンの `staff` は、付与と利用ができ、調整はできません（403）**。付与と利用はレジの仕事で、調整はレジの記録によらずにポイントを動かすからです（売上の取り消しを `staff` ができないのと同じです。[売上台帳](./sales.md#オペレーションと権限)）
- **失効は `admin` だけができます**。サロンの `owner` と `manager` も 403 です。失効は、どのサロンで貯めたポイントも、すべての顧客についてまとめて減らすので、1 つのサロンのメンバーには任せません
- サロンのメンバーは、どの顧客のポイントも扱えます。顧客はサロンに属さないからです（[顧客台帳](./customers.md)）
- 顧客のアカウントと、ロールに必要なレコードを持たないユーザー（削除されたスタッフに紐づいたアカウントなど）は、すべてのオペレーションで 403 です。この 403 は、パス、クエリ、本文を確かめる前に返します
- 付与、利用、調整が参照できる売上と予約は、操作者が扱えるものだけです。`admin` はすべてのサロンの、サロンのメンバーは所属サロンの売上と予約です。ほかのサロンの売上と予約は、その操作者には存在しないものとして扱います（400。[参照する記録](#参照する記録)）

### 残高の確認の順序

1. アクセストークン（401）
2. 操作者が、ポイントを読めること（403）
3. パスの顧客 ID（400。`detail` は `Invalid customer ID`、`id` の `invalid_format`）
4. 顧客の存在（404）。削除した顧客も 404 です

### 履歴の確認の順序

1. アクセストークン（401）
2. 操作者が、ポイントを読めること（403）
3. パスの顧客 ID（400。`Invalid customer ID`）
4. クエリ（400。`detail` は `Invalid point transaction search`）
5. 顧客の存在（404）。削除した顧客も 404 です
6. カーソル（400。`cursor` の `not_found`、`message` は `Must name a point transaction of the customer`）

### 有効期限が近いポイントの確認の順序

1. アクセストークン（401）
2. 操作者が、ポイントを読めること（403）
3. パスの顧客 ID（400。`Invalid customer ID`）
4. クエリ（400。`detail` は `Invalid expiring points search`）
5. 顧客の存在（404）。削除した顧客も 404 です

### 付与、利用、調整の確認の順序

1. アクセストークン（401）
2. 操作者が、そのオペレーションをできること（403）
3. リクエストの形式（400）
4. 付与だけ: 有効期限（400。`expiryDate` の `too_small`）
5. 顧客の存在（400。`customerId` の `not_found`、`message` は `Must name a customer`）。削除した顧客も同じです
6. 参照する記録の存在（400。`referenceId` の `not_found`）
7. 付与と利用だけ: 参照する記録の状態（409）
8. 付与と利用だけ: 同じ記録への付与、または利用が済んでいないこと（409）
9. 取引の後の残高が 0 以上、2,147,483,647 以下であること（409）

400 の `detail` は、付与では `Invalid point earning`、利用では `Invalid point use`、調整では `Invalid point adjustment` です。顧客は、パスではなく本文で指定するので、存在しない顧客は 404 ではなく、本文の誤り（400）として返します（売上の `customerId` と同じです。[売上台帳](./sales.md)）。

409 の `code` は `3003`（`operation-not-allowed`）で、`detail` は次のとおりです。

| 理由 | `detail` |
|---|---|
| 取り消した売上 | `The sale is void; points are not earned on or used for a void sale` |
| ステータスが `draft`、`cancelled`、`no_show` の予約 | `The booking is a draft, cancelled or a no-show; points are not earned on or used for it` |
| 同じ記録への付与、または利用が済んでいる | `The record has a point transaction of this kind already; a record is earned on once and used for once` |
| 残高が 0 未満になる | `The balance of the customer would fall below 0` |
| 残高が 2,147,483,647 を超える | `The balance of the customer would go above 2147483647` |

### 失効の確認の順序

1. アクセストークン（401）
2. 操作者が `admin` であること（403）
3. リクエストの形式（400。`detail` は `Invalid point expiry`）
4. `processBefore` が昨日（UTC）以前であること（400。`processBefore` の `too_big`、`message` は `Must not be later than <昨日の日付>`）
5. `customerId` を指定したときだけ: 顧客の存在（400。`customerId` の `not_found`、`message` は `Must name a customer`）。削除した顧客も同じです

失効は 409 を返しません。失効させるポイントがない顧客には何も書かず、数にも入れません（200）。

## リクエストの規則

3 つのリクエストは、すべてのキーが必須です。null を指定できるのは、DB で NULL を許すカラムだけです。

| プロパティ | 付与 | 利用 | 調整 |
|---|---|---|---|
| `customerId` | UUID | UUID | UUID |
| `points` | 1 以上、2,147,483,647 以下の整数 | 同左 | −2,147,483,648 以上、2,147,483,647 以下の、0 以外の整数 |
| `description` | 文字列か null。空白だけの文字列は不可 | 同左 | 同左 |
| `referenceType` | `sale`、`booking`、null | 同左 | 同左 |
| `referenceId` | UUID か null | 同左 | 同左 |
| `expiryDate` | `YYYY-MM-DD`（2999-12-31 まで）か null | キーがない | キーがない |

- `referenceType` と `referenceId` は、両方を指定するか、両方を null にします。片方だけなら 400 です（null にしたほうの `custom`、`message` は `Must not be null when referenceId is given` など）
- コントラクトにないキーは 400 です（`unrecognized_keys`）。利用と調整に `expiryDate` を書いても同じです
- 有効期限は、その日まで使える日付です。**昨日（UTC）より前の日付は 400 です**（`expiryDate` の `too_small`、`message` は `Must not be earlier than <昨日の日付>`）。サーバーは、サロンのタイムゾーンを知らずに受け付けます。UTC の昨日を許すと、どのタイムゾーンの「今日」も受け付けられます
- 調整の `points` が 0 なら 400 です（`points` の `custom`、`message` は `Must not be 0`）
- `description` に長さの上限はありません（`text` のカラムです）

### 参照する記録

ポイント取引は、そのもとになった売上（`sale`）か予約（`booking`）を参照できます。参照しなくてもかまいません。

- 参照する記録は、**本文の顧客の、操作者が扱えるサロンの記録**でなければなりません。存在しない記録、ほかの顧客の記録、顧客を記録していない売上、ほかのサロンの記録、種類の違う記録（`referenceType` が `sale` で、ID が予約のもの）は、どれも 400 です（`referenceId` の `not_found`、`message` は `Must name a sale of the customer` か `Must name a booking of the customer`）
- **付与と利用は、取り消した売上と、ステータスが `draft`、`cancelled`、`no_show` の予約を参照できません**（409）。付与も利用も、成立した会計や来店に対するものだからです。`pending`、`confirmed`、`in_progress`、`completed` の予約は参照できます
- **1 つの記録への付与は 1 回、利用も 1 回です**。2 回目は 409 です。同じリクエストを 2 回送ってしまっても、二重に付与しません。同じ記録に、付与と利用を 1 回ずつ記録することはできます（会計でポイントを使い、同じ会計でポイントを貯める場合）
- 調整は、どの記録も、何回でも参照できます。取り消した売上の付与を打ち消す調整は、その売上を参照して記録できます
- 記録を参照しない付与と利用には、回数の制限がありません

## 1 件の取得と履歴

- 付与、利用、調整は、200 で、書いたポイント取引を返します。`links` は、その顧客の残高と履歴です。ポイント取引には、1 件を読むルートがありません。履歴で読みます
- 残高は、`{ customerId, balance }` を返します
- 履歴は、新しい順（`createdAt` の降順、同じ時刻なら `id` の降順）です。カーソルで次のページに進みます。前のページに戻るカーソルはありません（`prevCursor` は null）
- `meta.total` は、日時の条件に一致する取引の件数です（カーソルの位置によらない）

| パラメーター | 形式 | 規則 |
|---|---|---|
| `limit` | 整数 | 1〜100。既定は 20 |
| `cursor` | UUID | 前のページの `meta.nextCursor`。その顧客の取引の ID でなければ 400 |
| `startDate` | UTC の日時（`2026-11-01T00:00:00Z` など）。UTC の日付で 1900-01-01 から 2999-12-31 まで | この日時以降の取引（含む） |
| `endDate` | 同上 | この日時以前の取引（含む）。`startDate` より前なら 400（`endDate` の `custom`、`message` は `Must not be earlier than startDate`） |

- **取引の日時は、レスポンスに出る精度（ミリ秒）で比べます**。データベースはマイクロ秒まで記録するので、そのまま比べると、レスポンスの `createdAt` を `endDate` に書いても、その取引自身が入りません
- 日付だけの値（`2026-11-01`）と、タイムゾーンのない日時は 400 です（`invalid_format`）
- `limit` が数でなければ 400（`invalid_format`）、範囲外なら 400（`too_small`、`too_big`）です
- コントラクトにないパラメーターは 400 です（`unrecognized_keys`）

## 有効期限と失効

有効期限（`expiryDate`）は、付与だけが持つ、そのポイントを使える最後の日です（`YYYY-MM-DD`）。有効期限が null の付与と、調整で増えたポイント（マイグレーションとシードの開始残高を含む）には、期限がありません。

### 残っているポイントの数え方

付与したポイントのうち、どれだけが使われずに残っているかは、取引に書きません。顧客のすべての取引を書いた順（`createdAt` の昇順、同じ時刻なら `id` の昇順）にたどって、そのつど数えます（`business-logic/point/_shared/lots.ts` の `lotsOf`）。

- 残高を増やす取引（付与、正の調整）ごとに、そのポイントのまとまりができます。付与のまとまりは、付与の有効期限を持ちます
- 残高を減らす取引（利用、失効、負の調整）は、**その時点にあるまとまりから、有効期限の近い順に取ったもの**とします。期限のないまとまりは最後で、期限が同じなら書いた順です。期限の近いポイントから使うほうが、顧客に有利だからです
- 後から付与したポイントが、それより前の利用で取られることはありません
- 残ったまとまりの合計は、最新の取引の残高と等しくなります

### 有効期限が近いポイント

`GET /api/v1/points/customer/{customerId}/expiring` は、有効期限が今日（UTC）から `days` 日後まで（その日を含む）の付与のうち、残っているポイントを返します。**有効期限を過ぎて、まだ失効させていないポイントも含みます**。失効させるまでは使えるからです。

| パラメーター | 形式 | 規則 |
|---|---|---|
| `days` | 整数 | 1〜365。既定は 30 |

- `days` が数でなければ 400（`invalid_format`）、整数でなければ 400（`invalid_type`）、範囲外なら 400（`too_small`、`too_big`）です。コントラクトにないパラメーターは 400 です（`unrecognized_keys`）
- `expiringPoints` は、残っているポイントの合計で、残高を超えません。`expirationDate` は、その中で最も早い有効期限で、なければ null です
- `transactions` は、ポイントが残っている付与の取引です。有効期限の昇順で、同じ日付なら書いた順です。`points` は付与したポイント数で、残っている数ではありません
- `links` は、このリクエストと、その顧客の残高と履歴です

### 失効

`POST /api/v1/points/expire` は、有効期限が `processBefore` より前の付与のうち、残っているポイントを失効させます。

| プロパティ | 形式 | 規則 |
|---|---|---|
| `customerId` | UUID か null | null なら、削除されていないすべての顧客 |
| `processBefore` | `YYYY-MM-DD` か null | 1900-01-01 以降で、昨日（UTC）以前。null なら昨日（UTC） |

- 2 つのキーは必須です。コントラクトにないキーは 400 です（`unrecognized_keys`）
- 失効させるポイントのある顧客ごとに、種別 `expired` のポイント取引を 1 件書き、顧客の残高を同じ数だけ減らします。取引の `points` は失効させた数の負の数で、`description`、`referenceType`、`referenceId`、`expiryDate` は null です
- レスポンスは `{ processedCount, totalPoints }` です。書いた失効の取引の件数（失効させた顧客の数）と、失効させたポイントの合計です。`links` は null です
- **何度実行しても、同じポイントを二度は失効させません**。失効の取引も、まとまりからポイントを取るからです。2 回目は何も書かず、`processedCount` は 0 です
- `processBefore` の既定と上限を昨日（UTC）にするのは、どのタイムゾーンでも、有効期限の日が終わる前に失効させないためです。失効させるのは、有効期限が一昨日（UTC）以前のポイントになります。付与の有効期限に昨日（UTC）以降を受け付けるのと同じ考え方です（[リクエストの規則](#リクエストの規則)）
- `customerId` が null なら、削除されていない顧客のうち、残高が 1 以上で、有効期限が `processBefore` より前の付与がある顧客を、1 人ずつ処理します。残っているポイントがなければ、その顧客には何も書きません
- 失効を決まった時刻に実行する仕組みはありません。管理者が、たとえば毎日 1 回、2 つのキーを null にして呼びます

## 売上と支払いとの関係

- **売上の `pointsUsed` と `pointsEarned` は、残高を動かしません**。売上の記録として残るだけです（[売上台帳](./sales.md)）
- **種類が `point` の支払い方法での支払いも、残高を動かしません**（[支払い](./payments.md)）
- 会計でポイントを使ったら、レジは、売上を記録したあとで、その売上を参照して利用を記録します。会計でポイントを貯めたら、同じ売上を参照して付与を記録します。売上と同じ数を記録するかは、レジが決めます
- 売上を取り消しても、その売上の付与と利用は、そのまま残ります。打ち消すには、その売上を参照して調整します

## 同時に届いたリクエスト

- 付与、利用、調整は、それぞれ 1 つのトランザクション（`READ COMMITTED`）で書きます。参照する売上か予約を `FOR SHARE` で持ち、次に顧客を `FOR NO KEY UPDATE` で持って、残高を計算し、ポイント取引と `loyaltyPoints` を書きます。行を持つ順は、売上と予約を書く処理と同じです（売上・予約が先、顧客が後）
- **同じ顧客の付与、利用、調整は、1 件ずつ順に書きます**。後の取引は、前の取引が残した残高から計算します。同時に届いた利用で、残高が 0 未満になることはありません
- 顧客の行をロックする処理とは、互いに待ちます。顧客の更新と削除、予約の作成（顧客を `FOR SHARE` で持つ）、予約のステータスの変更と削除（顧客の来店回数を数え直す。[予約台帳](./bookings.md)）などです。売上の作成と更新は、顧客を `FOR KEY SHARE` で確かめるだけなので、待たず、待たせません
- 参照する売上を取り消している途中や、予約のステータスを変えている途中なら、それを待ち、その結果で判断します（取り消した売上なら 409）。ポイント取引を書き終わるまで、参照している売上の取り消しと予約のステータスの変更は待ちます
- 同じ記録への付与が同時に届いたら、1 件だけを書き、ほかは 409 です。部分一意インデックス（`customer_points_reference_unique`）も、同じことを確かめます
- 取引の `createdAt` と、顧客の `updatedAt` は、行を書いた時点の時刻（`clock_timestamp()`）です。顧客を待った取引は、待たせた取引より後の時刻になります
- 失効は、顧客ごとに 1 つのトランザクション（`READ COMMITTED`）で書きます。顧客を `FOR NO KEY UPDATE` で持ち、**持ったあとで**その顧客の取引を読んで、失効させる数を数えます。付与、利用、調整と同じ行を持つので、同じ顧客の取引とは 1 件ずつ順に書きます。利用を待った失効は利用の後の取引から数え、失効を待った利用は失効の後の残高から計算します
- 同時に実行された失効も、顧客ごとに 1 件ずつ順に書きます。後の失効は、前の失効が取ったポイントを数えないので、同じポイントの失効を 2 件書くことはありません
- すべての顧客の失効は、顧客ごとのトランザクションで、1 人ずつ書きます。途中で失敗したら（500）、それまでの顧客は失効したままです。もう一度実行すると、残りの顧客を失効させます
- 履歴は、1 つの読み取り専用のトランザクション（`REPEATABLE READ`）で読みます。顧客、カーソル、ページ、件数は、同じ時点の値です。ロックは取りません。有効期限が近いポイントも、顧客と取引を同じように読みます

## DB の制約

| 制約 | 内容 |
|---|---|
| `customers_loyalty_points_not_negative` | 残高（`loyaltyPoints`）は 0 以上 |
| `customer_points_points_of_type` | `earned` は 1 以上、`used` と `expired` は −1 以下、`adjusted` と `transferred` は 0 以外 |
| `customer_points_balance_not_negative` | 取引の後の残高は 0 以上 |
| `customer_points_expiry_of_earned` | 有効期限を持つのは `earned` だけ |
| `customer_points_reference_pair` | `referenceType` と `referenceId` は、両方あるか、両方 NULL |
| `customer_points_reference_type_known` | `referenceType` は `sale` か `booking` |
| `customer_points_reference_unique`（部分一意インデックス） | 1 つの記録への `earned` は 1 件、`used` も 1 件 |

- 履歴の順序のために、`idx_customer_points_customer_time`（`customerId`、`createdAt`、`id`）があります。顧客だけのインデックス（`idx_customer_points_customer_id`）は、これに置き換えました
- 残高の上限（2,147,483,647）は、`integer` のカラムの上限です
- `referenceId` に外部キーはありません。参照先が売上か予約かで、テーブルが違うからです。参照先は、書くときにリポジトリが確かめます

## マイグレーション

`202611161000_customer_points_rules.sql` が、上の制約とインデックスを足し、すべての顧客の残高を、最新の取引の残高と揃えます。

- それまでポイント取引を書く処理はなく、`loyaltyPoints` は手で、またはシードで書かれていました。残高が最新の取引の `balance`（取引がなければ 0）と違う顧客に、差の分の調整（`adjusted`、`description` は `ポイント台帳の開始残高`）を 1 件書きます
- 2 回目の適用では、何もしません
- 規則に反する行が手で書かれていたら、マイグレーションは失敗し、何も変えません。どちらのカラムが正しいかは決められないので、直してから適用します

## シード

`pnpm db:seed` は、ポイントを持つ顧客（4 人。300、800、2,500、10,000 ポイント）に、残高と同じ調整を 1 件ずつ書きます（`description` は `ポイント台帳の開始残高`）。残高と最新の取引の残高は、シードの直後から一致します。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/payment.tsp`（`PointTransactionType`、`PointReferenceType`、`PointTransactionResponse`、`PointTransactionSearchRequest`、`PointBalanceResponse`、`PointEarnRequest`、`PointUseRequest`、`PointAdjustRequest`、`PointExpiringResponse`、`PointExpireRequest`、`PointExpireResponse`）、`specs/operations/payment-operations.tsp`（`PointCrud`） |
| データベース | `backend/packages/database/sql/migrations/202611161000_customer_points_rules.sql`、`src/seeds/seed-data/customers.ts` |
| ドメイン | `backend/packages/domain/src/models/point.ts`、`schemas/point.schema.ts`、`repositories/point.repository.ts`、`mappers/read/point.mapper.ts`、`business-logic/point/`（誰が使えるかは `_shared/authorization.ts`、取引の計画は `_shared/plan.ts`、残っているポイントの数え方と失効の計画は `_shared/lots.ts`、409 の内容は `_shared/refusals.ts`、付与・利用・調整に共通の流れは `_shared/record.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/point.repository.impl.ts` |
| API | `backend/packages/api/src/routes/point/`（`/api/v1/points` に取り付ける） |
| テスト | `backend/packages/domain/src/__tests__/point.schema.test.ts`、`point.plan.test.ts`、`point.lots.test.ts`、`point.mapper.test.ts`、`point.usecase.test.ts`、`backend/packages/api/src/routes/point/_shared/__tests__/`、`backend/packages/api/src/__tests__/point.integration.test.ts`、`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
