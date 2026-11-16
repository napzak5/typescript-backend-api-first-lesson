# 支払い

サロンの支払い方法（`payment_methods`）と、売上に対する支払い（決済取引。`payment_transactions`）の規則をまとめます。コントラクトは `specs/operations/payment-operations.tsp` と `specs/models/payment.tsp`、テーブルは `payment_methods` と `payment_transactions` です。

支払い方法は、サロンが受け付ける支払いの手段（現金、クレジットカード、QR コード決済など）の一覧です。サロンごとに持ち、管理者とサロンのスタッフが `/api/v1/salons/{salonId}/payment-methods` で扱います。顧客のアカウントは、このルートを使えません。

支払いは、売上に対して受け取ったお金の記録です。管理者とサロンのスタッフが、売上ごとに記録し（`POST /api/v1/sales/{id}/process`）、返金します（`POST /api/v1/payments/{id}/refund`）。システムは、決済代行会社と接続していません（[支払いは、受け取った結果の記録](#支払いは受け取った結果の記録)）。

売上と、その明細の規則は、[売上台帳](./sales.md) にあります。売上と支払いを、期間、スタッフ、支払い方法の種類ごとに数えるレポートは、[売上レポート](./sales-reports.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 支払い方法（`PaymentMethodCrud`）の一覧、作成、1 件の取得、更新、削除（`list`、`create`、`get`、`update`、`delete`） | 実装済み |
| 支払いの記録と返金（`SaleCrud` の `process`、`PaymentCrud` の `refund`） | 実装済み |

- 決済取引を 1 件だけ読むオペレーションと、一覧するオペレーションは、コントラクトにありません。決済取引は、売上のレスポンスの `payments` で読みます（[売上台帳](./sales.md#1-件の取得と一覧)）。返金に使う ID も、そこにあります
- 次のものは、ありません
  - 顧客に、サロンが受け付ける支払い方法を見せるルート
  - 決済代行会社との接続と、その設定（`processorConfig`）を読み書きするオペレーション
  - 通らなかった決済の記録（`failed` の決済取引）
  - 1 件の決済取引を、2 回以上に分けて返金すること
  - 支払いの二重送信を防ぐ仕組み。同じリクエストを 2 回送ると、未払い残額があれば、2 件の決済取引になります
  - 支払いと返金で、顧客のポイントの残高（`loyaltyPoints`）と累計利用金額（`lifetimeValue`）を動かすこと
  - お釣りの記録
  - サロンを作成したときに、支払い方法を自動で用意すること。新しいサロンの支払い方法は、空です
  - 手数料率を変えた履歴（テーブルがない）

## 支払い方法は、サロンの設定

1 件の支払い方法は、サロンが受け付ける手段の 1 つです。種類（`method`）と、レジや画面に出す名前（`displayName`）を持ちます。

| プロパティ | 意味 |
|---|---|
| `method` | 種類。`cash`、`credit_card`、`debit_card`、`e_money`、`qr_payment`、`bank_transfer`、`point` のどれか |
| `displayName` | 表示名 |
| `description` | 説明。なければ null |
| `processorName` | 決済代行会社の名前。なければ null |
| `fee` | 手数料率（%）。記録していなければ null |
| `minimumAmount` / `maximumAmount` | 1 回の支払いの金額の下限と上限（円）。なければ null |
| `isOnlineEnabled` / `isOfflineEnabled` | オンラインで受け付けるか、店頭で受け付けるか |
| `sortOrder` | 一覧の並び順 |
| `isActive` | 使っているかどうか |

- **種類、名前、並び順は、重なってもかまいません**。同じサロンに `credit_card` が 2 件あってもよく（端末が 2 台ある、決済代行会社が 2 社ある）、名前が同じでも、`sortOrder` が同じでも受け付けます
- **`fee` の null と 0 は、別の値です**。null は「記録していない」、0 は「手数料がない」です
- **支払いの記録が確かめるのは、`isActive` と金額の範囲です**。使っていない支払い方法（`isActive` が false）での支払いと、金額が `minimumAmount` 未満か `maximumAmount` 超の支払いは、400 です（[支払いの記録](#支払いの記録)）。カードの下 4 桁とブランドを記録できるのは、`method` が `credit_card` か `debit_card` の支払い方法での支払いだけです
- **売上の金額の計算も、`isActive` と金額の範囲を使います**。合計金額を 1 回で受け取れる支払い方法の種類を返します（[売上台帳](./sales.md#金額の計算)）
- **`fee`、`isOnlineEnabled`、`isOfflineEnabled` は、保存するだけです**。支払いのリクエストにも、決済取引のテーブルにも、どこで受け取ったかの項目と、手数料の項目がありません。オンラインと店頭の区別は、画面が選択肢を絞るための設定として扱います
- **`processorConfig`（決済代行会社の設定）は、API が読みも書きもしません**。レスポンスに出ず、リクエストに書くと 400 です（`unrecognized_keys`）。API が作った行では、NULL です。決済代行会社の資格情報を置く場所は、決済代行会社との接続を実装するときに決めます

## オペレーションと権限

支払い方法のオペレーションです。支払いの記録と返金のオペレーションは、[支払いは、受け取った結果の記録](#支払いは受け取った結果の記録) にあります。

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/salons/{salonId}/payment-methods` | `admin`、そのサロンの `owner` / `manager` / `staff` |
| 作成 | `POST /api/v1/salons/{salonId}/payment-methods` | `admin`、そのサロンの `owner` / `manager` |
| 1 件の取得 | `GET /api/v1/salons/{salonId}/payment-methods/{id}` | `admin`、そのサロンの `owner` / `manager` / `staff` |
| 更新 | `PATCH /api/v1/salons/{salonId}/payment-methods/{id}` | `admin`、そのサロンの `owner` / `manager` |
| 削除 | `DELETE /api/v1/salons/{salonId}/payment-methods/{id}` | `admin`、そのサロンの `owner` / `manager` |

- すべてのオペレーションに認証が要ります
- 誰が使えるかは、パスのサロンだけで決まります（`business-logic/payment-method/_shared/authorization.ts` の `mayReadPaymentMethods` と `mayKeepPaymentMethods`）。`admin` はすべてのサロン、サロンのユーザーは所属サロンです。支払い方法のための権限（`users.permissions`）はありません
- 読むことは、サロンの 3 つのロールができます。会計を入れるスタッフが、どの手段を受け付けるかを知る必要があるからです。設定（作成、更新、削除）は、`owner` と `manager` のものです。`staff` は、ID や本文を確かめる前に 403 です
- **顧客のアカウントは、このルートを使えません**（403）。レスポンスは、サロンが決済代行会社に払う手数料率を含みます。ロールに必要なレコードを持たないユーザー（範囲 `none`）も 403 です
- **ほかのサロンのユーザーは、サロンが存在するかどうかにかかわらず 403 です**。サロンを探す前に、権限を確かめます
- 存在しないサロンと、削除済みのサロンは 404 です（権限のある操作者に）。削除済みのサロンの支払い方法は、行は残りますが、どのオペレーションからも届きません
- **ほかのサロンの支払い方法は、存在しない支払い方法と区別しません**。取得、更新、削除は 404、カーソルに指定すると 400 です
- ID（パスの `salonId` と `id`、クエリの `cursor`）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です

### 確認の順序

一覧:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの支払い方法を読めること（403）
4. クエリ（400）
5. サロンの存在（404）
6. `cursor` が、そのサロンの支払い方法を指すこと（400。`cursor` の `not_found`）

作成:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの支払い方法を設定できること（403）
4. リクエストの本文（400）
5. サロンの存在（404）

1 件の取得:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの支払い方法を読めること（403）
4. パスの `id` の形式（400）
5. サロンの存在（404）
6. 支払い方法の存在（404）

更新:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの支払い方法を設定できること（403）
4. パスの `id` の形式（400）
5. リクエストの本文（400）
6. サロンの存在（404）
7. 支払い方法の存在（404）
8. 更新後の金額の範囲（400。[金額の範囲](#金額の範囲)）

削除:

1. アクセストークン（401）
2. パスの `salonId` の形式（400）
3. 操作者が、そのサロンの支払い方法を設定できること（403）
4. パスの `id` の形式（400）
5. サロンの存在（404）
6. 支払い方法の存在（404）
7. その支払い方法を指す支払いがないこと（409。[削除](#削除)）

JSON として読めない本文は、ほかのルートと同じく、アクセストークンより前に 400（`code` は `2002`）です。JSON でない `Content-Type` は 415 です。

## 作成リクエストの規則

作成リクエスト（`PaymentMethodCreateRequest`）は、すべてのキーが必須です。値がないものは、null を書きます。

| プロパティ | 規則 |
|---|---|
| `method` | 7 つの種類のどれか |
| `displayName` | 空白だけでない文字列。100 文字まで |
| `description` | null か、空白だけでない文字列 |
| `processorName` | null か、空白だけでない文字列。100 文字まで |
| `fee` | null か、0 以上 100 以下の数値。小数は 2 桁まで |
| `minimumAmount` | null か、1 以上の整数 |
| `maximumAmount` | null か、1 以上の整数。`minimumAmount` 以上（[金額の範囲](#金額の範囲)） |
| `isOnlineEnabled` | 真偽値 |
| `isOfflineEnabled` | 真偽値 |
| `sortOrder` | 0 以上の整数 |
| `isActive` | 真偽値 |

- サロンは、パスが決めます。本文に `salonId` を書くと 400 です。`id`、`createdAt`、`updatedAt`、`processorConfig` も同じです（`unrecognized_keys`）
- 文字列は、前後の空白を含めて、そのまま保存します。空白だけの文字列（全角の空白を含む）は 400 です（`invalid_format`）
- 文字数は、文字（コードポイント）で数えます
- 整数の上限は、カラム（`integer`）に入る 2,147,483,647 です
- `isOnlineEnabled` と `isOfflineEnabled` は、両方が false でもかまいません
- 成功すると 201 で、`Location` ヘッダーと `links.self` が、作成した支払い方法の場所を指します。`createdAt` と `updatedAt` は、同じ時刻です

## 更新

更新リクエスト（`PaymentMethodUpdateRequest`）は、変えるプロパティだけを書きます。書かなかったプロパティは、そのままです。

- 書けるプロパティは、作成リクエストから `method` を除いたものです。規則は、作成と同じです
- **`method` は、作成のあとで変えられません**（本文に書くと 400。`unrecognized_keys`）。支払いは、支払い方法を指して記録します。種類を変えると、以前の支払いの種類も変わってしまいます。種類を間違えた支払い方法は、支払いがなければ削除して作り直し、あれば `isActive` を false にして、新しい支払い方法を作ります
- プロパティを 1 つも書かないリクエストは 400 です（`custom`）
- `description`、`processorName`、`fee`、`minimumAmount`、`maximumAmount` は、null を書くと、値を消します
- `updatedAt` は、リクエストが値を変えなくても、更新のたびに書きます（データベースの `clock_timestamp()`）。`createdAt` は、変わりません
- 使っていない支払い方法（`isActive` が false）も、支払いが指している支払い方法も、更新できます

## 金額の範囲

`minimumAmount` と `maximumAmount` は、1 回の支払いの金額の下限と上限です。両方がある支払い方法では、下限は上限以下です（同じ値でもよい）。

- 作成では、リクエストの 2 つの値を比べます。下限が上限より大きければ 400 で、`maximumAmount` の `custom` です
- 更新では、**更新後の行**の 2 つの値を比べます。リクエストが片方だけを書いたときは、もう片方は、保存されている値です
  - 両方を書いて、下限が上限より大きい: `maximumAmount` の `custom`
  - `minimumAmount` だけを書いて、保存されている上限より大きい: `minimumAmount` の `custom`
  - `maximumAmount` だけを書いて、保存されている下限より小さい: `maximumAmount` の `custom`
- 片方を null にすれば、もう片方は、どの値でもかまいません
- どちらかの値が、それ自体の規則（1 以上の整数）に違反しているときは、その違反だけを報告し、2 つの値は比べません
- リクエストの形が違うとき（型の違う値、ないキー、知らないキー、7 つの種類にない `method`）も、2 つの値は比べません。値の規則の違反（空白だけの名前、範囲の外の `fee` など）だけなら、金額の範囲の違反も一緒に報告します

## 削除

削除は、行を消します（204。本文はない）。消した支払い方法は、取得、更新、削除のどれも 404 で、一覧に出ません。

- **支払い（`payment_transactions`）が指している支払い方法は、削除できません**（409）。支払いの状態（`pending`、`processing`、`completed`、`failed`、`refunded`、`partial_refund`）は問いません。失敗した支払いも、どの手段で試みたかの記録だからです
- 409 の `detail` は、`isActive` を false にするよう伝えます。支払いに使った手段をやめるときは、削除ではなく、`isActive` を false にします
- 使っていない支払い方法（`isActive` が false）も、削除できます

## 1 件の取得と一覧

- 日時は UTC で、ミリ秒までの ISO 8601 形式です（`2026-11-20T03:40:00.000Z`）。`fee` は数値です（`3.6`）
- 一覧の並びは、`sortOrder` の小さい順、同じ値の中では `id` の昇順です
- 一覧は、使っていない支払い方法（`isActive` が false）も返します。使っているものだけを読むには、`isActive=true` を指定します
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後の支払い方法の ID です。そのサロンの支払い方法でない ID を指す `cursor` は 400 です（`cursor` の `not_found`）
- `meta.total` は、絞り込みに一致する支払い方法の件数です
- 絞り込みは、AND で結合します

| パラメーター | 一致する支払い方法 |
|---|---|
| `method` | 種類が一致する |
| `isActive` | `true` なら使っているもの、`false` なら使っていないもの |

- 表にないパラメーターは 400 です（`unrecognized_keys`）
- 保存されている行が API のモデルに合わないときは 500（データベースのエラー）です。読み出すときに検証します（`mappers/read/payment-method.mapper.ts`）

## 支払いは、受け取った結果の記録

**システムは、決済代行会社と接続していません**。支払い（決済取引）は、レジが受け取った結果の記録です。スタッフが、現金を受け取るか、カード端末や QR コード決済のアプリで決済が通ったことを確かめてから、記録します。

- API が書く決済取引のステータスは、`completed`（受け取った）と、返金による `refunded`、`partial_refund` だけです。`pending`、`processing`、`failed` の決済取引は、API からは書かれません
- 通らなかった決済は、記録しません
- `processorTransactionId`、`errorCode`、`errorMessage`、`failedAt` は、レスポンスにありますが、API が記録した決済取引では、常に null です。`processorResponse` と `metadata` のカラムは、どのレスポンスにも出ず、API が記録した決済取引では NULL です
- お釣りは、記録しません。`amount` は、売上に充てた金額です
- 区分が `point` の支払い方法での支払いも、ほかの区分と同じ記録です。顧客のポイントの残高は、動かしません
- 支払いと返金は、顧客の累計利用金額（`lifetimeValue`）も動かしません

| オペレーション | ルート | 許可 | 成功 |
|---|---|---|---|
| 支払いの記録 | `POST /api/v1/sales/{id}/process` | `admin`、売上のサロンの `owner` / `manager` / `staff` | 200。記録した決済取引 |
| 返金 | `POST /api/v1/payments/{id}/refund` | `admin`、売上のサロンの `owner` / `manager` | 200。返金した決済取引 |

- 支払いを記録するのは、レジに立つスタッフの仕事です。売上台帳を使える人が、記録できます（`business-logic/sale/_shared/authorization.ts` の `saleReachOf`）
- **返金は、お金を返す操作なので、売上の取り消しと同じく、`owner` と `manager` のものです**（`saleVoidReachOf`）。`staff` は、ID や本文を確かめる前に 403 です
- 顧客のアカウントは、どちらも 403 です。自分が支払った売上でも同じです。ロールに必要なレコードを持たないユーザー（範囲 `none`）も 403 です
- **ほかのサロンの売上と決済取引は、存在しないものと区別しません**（404）
- レスポンスは `PaymentResponse` で、`links.sale` が、その売上の場所を指します。決済取引そのものの場所は、ありません
- ID（パスの `id`、本文の `paymentMethodId`）は、英字を大文字で書いても同じ ID です。レスポンスの ID は小文字です

## 支払いの記録

`POST /api/v1/sales/{id}/process` は、売上に対して受け取った 1 回の支払いを、1 件の決済取引として記録します。本文（`SaleProcessRequest`）は、すべてのキーが必須です。

| プロパティ | 規則 |
|---|---|
| `paymentMethodId` | 売上のサロンの、使っている（`isActive` が true）支払い方法の ID。そうでなければ 400（`not_found`） |
| `amount` | 1 以上の整数。未払い残額以下（400。`too_big`）。支払い方法に金額の範囲があれば、`minimumAmount` 以上（`too_small`）、`maximumAmount` 以下（`too_big`） |
| `cardLastFour` | null か、数字 4 桁。支払い方法の区分が `credit_card` でも `debit_card` でもなければ null（400。`custom`） |
| `cardBrand` | null か、空白だけでない文字列。50 文字まで。支払い方法の区分が `credit_card` でも `debit_card` でもなければ null（400。`custom`） |

- 表にない項目を書くと 400 です（`unrecognized_keys`）。取引番号、ステータス、日時は、リクエストに書けません
- **分けて支払えます**（現金と、カード）。1 回の記録が、1 件の決済取引です。受け取った合計が合計金額に達すると、売上の支払い状態は `completed` になります（[売上の支払い状態](#売上の支払い状態)）
- **未払い残額は、合計金額（`totalAmount`）から、これまでに受け取った金額を引いた額です**。受け取った金額は、ステータスが `completed`、`partial_refund`、`refunded` の決済取引の `amount` の合計です。返金しても、残額は増えません
- **取り消した売上は、支払いを受けません**（409）
- **返金のある売上は、支払いを受けません**（409）。誤った支払いを全額返金して、払い直すときは、売上を取り消して、入れ直します
- **未払い残額のない売上は、支払いを受けません**（409）。合計金額が 0 の売上も、同じです（支払い状態は `pending` のまま）
- 支払い方法が使えないとき（存在しない、ほかのサロンのもの、`isActive` が false）は、カードの項目と金額の範囲は、確かめません。未払い残額は、確かめます
- カードの項目は、カードの支払いでも、null にできます（記録しない）
- 支払い方法の金額の範囲は、1 回の支払いの金額に対するものです。売上の最後の支払い（残額の支払い）にも、下限を適用します
- `isOnlineEnabled` と `isOfflineEnabled` は、確かめません
- 決済取引の `status` は `completed`、`processedAt`、`createdAt`、`updatedAt` は、書いた時点のデータベースの時計です。売上の `paymentStatus` と `updatedAt` も、同じトランザクションで書きます
- **取引番号（`transactionNumber`）は、システムが採番します**。`PT-XXXX-XXXX` の形で、売上番号と同じ作り方です（[売上台帳](./sales.md#売上番号)）。すでにある番号と重なったら、別の番号で採り直します（3 回まで）

### 支払いの記録の確認の順序

1. 認証（401）
2. 操作者が、売上台帳を使えること（403）
3. `id` の形（400）
4. 本文の形と値（400）
5. 売上の存在（404。ほかのサロンの売上も 404）
6. 取り消されていないこと（409）
7. 返金がないこと、未払い残額があること（409。この順）
8. 支払い方法、カードの項目、金額（400。違反をまとめて報告する）

## 返金

`POST /api/v1/payments/{id}/refund` は、決済取引を返金します。本文（`PaymentRefundRequest`）は、`refundAmount`（1 以上の整数）と `refundReason`（null か、空白だけでない文字列。長さの上限はない）で、どちらのキーも必須です。

- **返金できるのは、ステータスが `completed` の決済取引だけです**（409）。**1 件の決済取引の返金は、1 回だけです**。一部を返金した決済取引（`partial_refund`）を、もう一度返金することはできません
- `refundAmount` が、決済取引の `amount` を超えると 400 です（`too_big`）。等しければ全額返金（`refunded`）、少なければ一部返金（`partial_refund`）です
- `refundedAt` と `updatedAt` を、書いた時点のデータベースの時計に、`refundAmount` と `refundReason` を、本文の値にします。`amount` と `processedAt` は、変えません。売上の `paymentStatus` と `updatedAt` も、同じトランザクションで書きます
- **取り消した売上の決済取引でも、`completed` なら返金できます**。お金を返す操作は、断りません。取り消しは、返金していない支払いがある売上を断るので、API で作ったデータでは、この組み合わせは起きません
- 使うのをやめた支払い方法（`isActive` が false）で受け取った決済取引も、返金できます
- 支払いをすべて全額返金した売上は、取り消せます（[売上台帳](./sales.md#取り消し)）。一部を返金した決済取引（`partial_refund`）がある売上は、残りを返金できないので、取り消せません

### 返金の確認の順序

1. 認証（401）
2. 操作者が、返金できること（403）
3. `id` の形（400）
4. 本文の形と値（400）
5. 決済取引の存在（404。ほかのサロンの売上の決済取引も 404）
6. ステータスが `completed` であること（409）
7. 返金額が `amount` 以下であること（400）

## 売上の支払い状態

売上の `paymentStatus` は、**その売上の決済取引から決まる値**です。支払いの記録と返金が、決済取引と同じトランザクションで書きます（`business-logic/payment/_shared/plan.ts` の `paymentStatusOf`）。

| 値 | 売上にとっての意味 |
|---|---|
| `pending` | 何も受け取っていない |
| `processing` | 合計金額の一部を受け取った（未払い残額がある） |
| `completed` | 合計金額を受け取った |
| `partial_refund` | 受け取った金額の一部を返金した |
| `refunded` | 受け取った全額を返金した |
| `failed` | API は書かない |

- 受け取った金額は、ステータスが `completed`、`partial_refund`、`refunded` の決済取引の `amount` の合計、返金した金額は、その `refundAmount` の合計です
- 返金した金額が 0 より大きければ、受け取った金額と等しいとき `refunded`、そうでなければ `partial_refund` です。合計金額の一部だけを受け取って、その全額を返金した売上も、`refunded` です
- 売上の更新が明細を置き換えられるのは、`pending` の売上だけです（[売上台帳](./sales.md#更新)）。一部でも受け取った売上の金額は、変えられません
- 支払いの記録と返金が確かめるのは、決済取引そのもので、売上の `paymentStatus` ではありません

## 同時に届いたリクエスト

- **更新は、支払い方法の行をロックしてから、金額の範囲を確かめて書きます**（`SELECT … FOR UPDATE`。`READ COMMITTED` のトランザクション）。下限だけを変える更新と、上限だけを変える更新が同時に届いても、後から行を得たほうは、先の更新が書いた値と比べます。下限が上限より大きい行は、残りません
- 同じ支払い方法への、別々のプロパティの更新が同時に届くと、すべてが書かれます
- **削除は、支払い方法の行をロックしてから、次の文で、それを指す支払いを探します**。このロックは、支払いの外部キーの確認が待つロックです。書いている途中の支払いがあれば、削除はその支払いを待ち、支払いがコミットされれば 409、取り消されれば削除します
- 同じ支払い方法への削除が同時に届くと、1 つが 204 で、残りは 404 です
- 更新と削除がロックするのは、その支払い方法の行だけです。サロンの行も、ほかの支払い方法の行も、ロックしません
- 作成は、ロックを取りません。サロンの存在は、書く前に確かめます
- 取得と一覧は、ロックを待ちません。売上の金額の計算も、支払い方法を読むだけで、更新と削除を待ちません

### 支払いの記録と返金

支払いの記録（`PaymentRepository.record`）と返金（`PaymentRepository.refund`）は、それぞれ 1 つのトランザクションです（`READ COMMITTED`）。

1. **売上の行を排他ロック（`FOR UPDATE`）して読みます**（`repositories/held-sale.ts` の `heldSaleOf`。売上の更新と取り消しと同じロック）。同じ売上の支払い、返金、更新、取り消しは、ここで 1 件ずつになります
2. 次の文で、その売上の決済取引を読みます。待っていたリクエストは、先のリクエストが書いたあとの決済取引を読みます
3. 支払いは、売上が支払いを受けるかを決め（`refusalOfPayment`）、**支払い方法の行を共有ロック（`FOR SHARE`）して読み**、書く行を決めて（`planPayment`）、決済取引と、売上の支払い状態を書きます
4. 返金は、書く値を決めて（`planRefund`）、決済取引と、売上の支払い状態を書きます

- 同時に届いた支払いの合計が、合計金額を超えることはありません。合計金額の支払いが同時に何件も届くと、1 件が 200 で、ほかは 409 です
- 同じ決済取引の返金が同時に何件も届いても、返金は 1 回です（1 件が 200 で、ほかは 409）
- 支払いと取り消しが同時に届くと、どちらか一方だけが通ります（支払いが先なら、取り消しは 409。取り消しが先なら、支払いは 409）
- **返金は、決済取引の ID から売上を知ります**。ロックなしで売上の ID を読み、売上をロックしてから、決済取引を読み直します。決済取引の売上は、変わりません
- 支払い方法の共有ロックは、支払い方法の更新と削除のロック（`FOR UPDATE`）と両立しません。更新や削除が進んでいる途中に届いた支払いは、それを待ち、コミットされたあとの支払い方法（使うのをやめた、金額の範囲を変えた、消えた）で確かめます。支払いを書いている途中に届いた更新と削除は、支払いを待ちます。支払いどうしは、同じ支払い方法でも、待ちません
- 取引番号が重なったときは、何も書かずに終わり、ユースケースが別の番号でやり直します
- 待ったリクエストが書く時刻（`processedAt`、`refundedAt`、`updatedAt`）は、待ったあとの時刻です
- **ロックの順は、売上、予約、サロン、顧客、サービス、スタッフ、支払い方法です**（[売上台帳](./sales.md#更新と取り消し)）。支払いは、売上のあとに、支払い方法をロックします。支払い方法の更新と削除は、支払い方法の行だけをロックし、ほかの行を待ちません。同じ行を逆の順にロックする組み合わせは、ありません

## DB の制約

マイグレーション `202611160800_payment_method_rules.sql` で、次のようにしました。

- 既定値をなくした（NULL 可のまま）: `payment_methods.fee`（以前は 0）。記録していない手数料率は NULL です
- CHECK 制約: `fee` は NULL か、0 以上 100 以下（`payment_methods_fee_is_a_percentage`）。`minimumAmount` と `maximumAmount` は、それぞれ NULL か 1 以上で、両方があれば、下限は上限以下（`payment_methods_amount_limits`）。`sortOrder` は 0 以上（`payment_methods_sort_order_not_negative`）

以前の行は、直しません。これまで、このテーブルに書くオペレーションはなく、手で書かれた行が規則に違反していても、どちらの値が正しいかを決められないからです。違反する行があると、マイグレーションは失敗します。行を直してから、やり直します。

以前のバージョンは、このテーブルを読みも書きもしません。マイグレーションは、新しいバージョンの前に適用しても、後に適用しても、かまいません。

支払いが指す支払い方法を削除できないことは、外部キー（`payment_transactions_payment_method_id_fk`）も保証します。サロンの行を消すと、その支払い方法も消えます（`payment_methods_salon_id_fk` の `ON DELETE CASCADE`）。ただし、サロンの削除は、行を残します（`deletedAt`）。

マイグレーション `202611160900_payment_transaction_rules.sql` で、決済取引（`payment_transactions`）の 1 行だけで確かめられる規則を、CHECK 制約にしました。

- `amount` は 1 以上（`payment_transactions_amount_positive`）
- 受け取った決済取引（`completed`、`refunded`、`partial_refund`）は `processedAt` を持ち、ほかは持たない（`payment_transactions_received_has_time`）
- `failedAt` は、`failed` の決済取引だけが持つ。`errorCode` と `errorMessage` は、`failed` の決済取引だけが持てる（`payment_transactions_failure_of_failed`）
- `refundedAt` と `refundAmount` は、`refunded` と `partial_refund` の決済取引だけが持つ。`refundReason` は、返金した決済取引だけが持てる（`payment_transactions_refund_of_refunded`）
- `refunded` の決済取引は `refundAmount` = `amount`、`partial_refund` の決済取引は 1 ≦ `refundAmount` < `amount`（`payment_transactions_refund_amount`）
- `cardLastFour` は、NULL か数字 4 桁（`payment_transactions_card_last_four_digits`）

これまで、このテーブルに書くオペレーションはありませんでした。手で書かれた行が規則に違反していると、マイグレーションは失敗します。行を直してから、やり直します。以前のバージョンは、このテーブルに書かないので、このマイグレーションも、新しいバージョンの前に適用しても、後に適用しても、かまいません。

1 つの売上の決済取引を合わせた規則（受け取った合計は合計金額以下。売上の支払い状態は、決済取引から決まる）は、制約では保証しません（複数の行と、2 つのテーブルにまたがる）。売上の行をロックして書くトランザクションが保証します。取引番号は、一意です（`payment_transactions_transaction_number_unique`）。

## シード

`pnpm db:seed` は、サロンごとに 7 件の支払い方法（7 つの種類を 1 件ずつ）を入れます。どれも、API が作れる行です（`processorConfig` は NULL）。支払いは入れません。シードのデータで売上を作成すれば、その売上に、支払いを記録できます。

## 実装の場所

支払い方法:

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/payment.tsp`（`PaymentMethodResponse`、`PaymentMethodCreateRequest`、`PaymentMethodUpdateRequest`、`PaymentMethodSearchRequest`）、`specs/operations/payment-operations.tsp`（`PaymentMethodCrud`） |
| ドメイン | `backend/packages/domain/src/models/payment-method.ts`、`schemas/payment-method.schema.ts`、`mappers/read/payment-method.mapper.ts`、`mappers/write/payment-method.mapper.ts`、`repositories/payment-method.repository.ts`、`business-logic/payment-method/`（誰が読み、誰が設定するかは `_shared/authorization.ts`、金額の範囲の比較は `_shared/limits.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/payment-method.repository.impl.ts` |
| API | `backend/packages/api/src/routes/payment-method/`（`/api/v1/salons/:salonId/payment-methods` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611160800_payment_method_rules.sql` |
| テスト | `backend/packages/domain/src/__tests__/payment-method.schema.test.ts`、`payment-method.limits.test.ts`、`payment-method.mapper.test.ts`、`payment-method.usecase.test.ts`、`backend/packages/api/src/__tests__/payment-method.integration.test.ts` |

支払いの記録と返金:

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/payment.tsp`（`SaleProcessRequest`、`PaymentRefundRequest`、`PaymentResponse`、`PaymentStatusType`）、`specs/operations/payment-operations.tsp`（`SaleCrud` の `process`、`PaymentCrud` の `refund`） |
| ドメイン | `backend/packages/domain/src/models/payment.ts`、`schemas/payment.schema.ts`、`mappers/read/payment.mapper.ts`、`repositories/payment.repository.ts`、`services/payment-number-issuer.ts`、`business-logic/payment/`（売上の支払い状態、支払いと返金が書く値、断る理由を決めるのは `_shared/plan.ts`、取引番号は `_shared/payment-number.ts`、リポジトリが断った理由をエラーに直すのは `_shared/refusals.ts`）。誰が記録し、誰が返金するかは、売上台帳の `business-logic/sale/_shared/authorization.ts` |
| インフラ | `backend/packages/infrastructure/src/repositories/payment.repository.impl.ts`、`repositories/held-sale.ts`（売上の行のロック。売上の更新、取り消しと共有する）、`security/random-payment-number-issuer.ts` |
| API | `backend/packages/api/src/routes/sale/process-sale.handler.ts`（支払いの記録）、`backend/packages/api/src/routes/payment/`（返金。`/api/v1/payments` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611160900_payment_transaction_rules.sql` |
| テスト | `backend/packages/domain/src/__tests__/payment.schema.test.ts`、`payment.plan.test.ts`、`payment.mapper.test.ts`、`payment.usecase.test.ts`、`backend/packages/api/src/__tests__/payment.integration.test.ts` |
