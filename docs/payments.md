# 支払い

サロンの支払い方法（`payment_methods`）の規則をまとめます。コントラクトは `specs/operations/payment-operations.tsp` と `specs/models/payment.tsp`、テーブルは `payment_methods` です。

支払い方法は、サロンが受け付ける支払いの手段（現金、クレジットカード、QR コード決済など）の一覧です。サロンごとに持ち、管理者とサロンのスタッフが `/api/v1/salons/{salonId}/payment-methods` で扱います。顧客のアカウントは、このルートを使えません。

売上と、その明細の規則は、[売上台帳](./sales.md) にあります。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 支払い方法（`PaymentMethodCrud`）の一覧、作成、1 件の取得、更新、削除（`list`、`create`、`get`、`update`、`delete`） | 実装済み |
| 支払いの処理と返金（`SaleCrud` の `process`、`PaymentCrud` の `refund`） | 未実装 |

- 支払い方法を使うオペレーション（支払いの処理）は、未実装です。いまの支払い方法は、サロンが設定して読むだけの記録です
- 次のものは、ありません
  - 顧客に、サロンが受け付ける支払い方法を見せるルート
  - 決済代行会社との接続と、その設定（`processorConfig`）を読み書きするオペレーション
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
- **`fee`、金額の範囲、`isOnlineEnabled`、`isOfflineEnabled`、`isActive` は、保存するだけです**。これらの値で何かを断るオペレーションは、まだありません。支払いの処理（未実装）のコントラクトは、使っていない支払い方法（`isActive` が false）での支払いを断ると定めています。金額の範囲と、オンライン、店頭の区別を確かめるかどうかは、支払いの処理を実装するときに決めます
- **`processorConfig`（決済代行会社の設定）は、API が読みも書きもしません**。レスポンスに出ず、リクエストに書くと 400 です（`unrecognized_keys`）。API が作った行では、NULL です。決済代行会社の資格情報を置く場所は、決済代行会社との接続を実装するときに決めます

## オペレーションと権限

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

## 同時に届いたリクエスト

- **更新は、支払い方法の行をロックしてから、金額の範囲を確かめて書きます**（`SELECT … FOR UPDATE`。`READ COMMITTED` のトランザクション）。下限だけを変える更新と、上限だけを変える更新が同時に届いても、後から行を得たほうは、先の更新が書いた値と比べます。下限が上限より大きい行は、残りません
- 同じ支払い方法への、別々のプロパティの更新が同時に届くと、すべてが書かれます
- **削除は、支払い方法の行をロックしてから、次の文で、それを指す支払いを探します**。このロックは、支払いの外部キーの確認が待つロックです。書いている途中の支払いがあれば、削除はその支払いを待ち、支払いがコミットされれば 409、取り消されれば削除します
- 同じ支払い方法への削除が同時に届くと、1 つが 204 で、残りは 404 です
- 更新と削除がロックするのは、その支払い方法の行だけです。サロンの行も、ほかの支払い方法の行も、ロックしません
- 作成は、ロックを取りません。サロンの存在は、書く前に確かめます
- 取得と一覧は、ロックを待ちません

## DB の制約

マイグレーション `202611160800_payment_method_rules.sql` で、次のようにしました。

- 既定値をなくした（NULL 可のまま）: `payment_methods.fee`（以前は 0）。記録していない手数料率は NULL です
- CHECK 制約: `fee` は NULL か、0 以上 100 以下（`payment_methods_fee_is_a_percentage`）。`minimumAmount` と `maximumAmount` は、それぞれ NULL か 1 以上で、両方があれば、下限は上限以下（`payment_methods_amount_limits`）。`sortOrder` は 0 以上（`payment_methods_sort_order_not_negative`）

以前の行は、直しません。これまで、このテーブルに書くオペレーションはなく、手で書かれた行が規則に違反していても、どちらの値が正しいかを決められないからです。違反する行があると、マイグレーションは失敗します。行を直してから、やり直します。

以前のバージョンは、このテーブルを読みも書きもしません。マイグレーションは、新しいバージョンの前に適用しても、後に適用しても、かまいません。

支払いが指す支払い方法を削除できないことは、外部キー（`payment_transactions_payment_method_id_fk`）も保証します。サロンの行を消すと、その支払い方法も消えます（`payment_methods_salon_id_fk` の `ON DELETE CASCADE`）。ただし、サロンの削除は、行を残します（`deletedAt`）。

## シード

`pnpm db:seed` は、サロンごとに 7 件の支払い方法（7 つの種類を 1 件ずつ）を入れます。どれも、API が作れる行です（`processorConfig` は NULL）。支払いは入れません。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/payment.tsp`（`PaymentMethodResponse`、`PaymentMethodCreateRequest`、`PaymentMethodUpdateRequest`、`PaymentMethodSearchRequest`）、`specs/operations/payment-operations.tsp`（`PaymentMethodCrud`） |
| ドメイン | `backend/packages/domain/src/models/payment-method.ts`、`schemas/payment-method.schema.ts`、`mappers/read/payment-method.mapper.ts`、`mappers/write/payment-method.mapper.ts`、`repositories/payment-method.repository.ts`、`business-logic/payment-method/`（誰が読み、誰が設定するかは `_shared/authorization.ts`、金額の範囲の比較は `_shared/limits.ts`） |
| インフラ | `backend/packages/infrastructure/src/repositories/payment-method.repository.impl.ts` |
| API | `backend/packages/api/src/routes/payment-method/`（`/api/v1/salons/:salonId/payment-methods` に取り付ける） |
| DB | `backend/packages/database/sql/migrations/202611160800_payment_method_rules.sql` |
| テスト | `backend/packages/domain/src/__tests__/payment-method.schema.test.ts`、`payment-method.limits.test.ts`、`payment-method.mapper.test.ts`、`payment-method.usecase.test.ts`、`backend/packages/api/src/__tests__/payment-method.integration.test.ts` |
