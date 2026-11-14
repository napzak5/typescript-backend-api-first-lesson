# 顧客台帳

顧客（`customers`）の規則をまとめます。コントラクトは `specs/operations/customer-operations.tsp` と `specs/models/customer.tsp`、テーブルは `customers` です。

## 実装範囲

| オペレーション（`CustomerCrud`） | 状態 |
|---|---|
| 一覧、登録、1 件の取得、更新、削除 | 実装済み |
| 好み設定の更新（`PATCH /{id}/preferences`） | 未実装。スタッフの存在確認が要るので、Staff のあとに実装する |
| 一括取得、一括登録、一括更新、一括削除、復元、統合 | 未実装 |
| 監査履歴、版、エクスポート、データ削除要請 | 未実装。保存するテーブルがない |
| 統計 | 未実装。予約と会計の実装が前提 |

未実装のオペレーションは、コントラクトには定義がありますが、サーバーは 404 を返します。

顧客本人が自分の顧客情報を作り、読み、直すためのルートは、まだありません。登録したユーザー（ロール `customer`）は顧客情報を持たず、ここにあるルートも使えません。

## 台帳はプラットフォームで 1 つ

`customers` には `salonId` がありません。メールアドレスは台帳全体で一意で、ログインアカウントとの紐づけ（`users.customerId`）も 1 対 1 です。顧客は特定のサロンに属さず、台帳はプラットフォーム全体で 1 つです。

- ルートは `/api/v1/customers` です。サロンの下（`/api/v1/salons/{salonId}/...`）には置きません
- サロンのスタッフは、所属サロンに関係なく、台帳のすべての顧客を扱えます（受付で顧客を探す、電話予約の顧客を登録する、連絡先を直す）
- 互いに独立した事業者のサロンが 1 つの環境を共有し、顧客を見せ合わない運用には対応していません。その運用にするには、台帳をサロンごとに分ける設計変更が要ります

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/customers` | `admin`、サロンの `owner` / `manager` / `staff` |
| 登録 | `POST /api/v1/customers` | 同上 |
| 1 件の取得 | `GET /api/v1/customers/{id}` | 同上 |
| 更新 | `PATCH /api/v1/customers/{id}` | 同上 |
| 削除 | `DELETE /api/v1/customers/{id}` | `admin`、サロンの `owner` / `manager` |

- すべてのオペレーションに認証が要ります。台帳は公開情報ではありません
- 権限は操作者だけで決まります（`business-logic/customer/_shared/authorization.ts` の `mayHandleCustomers` と `mayDeleteCustomers`）。サロンのロールは、どのサロンのものでも同じ扱いです
- ロール `customer` のユーザーと、ロールに必要なレコードを持たないユーザー（範囲 `none`）は、どのオペレーションも 403 です。レスポンスはスタッフ専用の項目（`internalNotes`）を含むので、顧客本人には自分の顧客情報も返しません
- 削除済みの顧客は、どのオペレーションからも見えません（404）。存在しない ID と区別しません
- ID（パスの `id`、本文の `referredBy`、クエリの `cursor`）は、英字を大文字で書いても同じ ID です。レスポンスの `data` と `meta` の ID は小文字です

### 確認の順序

1. アクセストークン（401）
2. 権限（403）
3. 顧客の `id` の形式（400。取得、更新、削除）
4. クエリ（400。一覧）、リクエストの本文（400。登録、更新）
5. リクエストだけで決まる規則（400）: 生年月日の範囲、紹介元が自分自身でないこと
6. 保存されている行で決まること: 顧客の存在（404）、紹介元の存在（400）、メールアドレスと紹介コードの一意性（409）

権限のないユーザーには、ID、クエリ、本文の内容が不正でも、顧客が存在しなくても 403 を返します。一覧のクエリは HTTP 層が型に直しますが、直せなかったクエリのエラーも、権限を確認したあとで返します（`ListCustomersUseCase` は、直した結果を `Result` で受け取る）。

読めない本文は、この順序の前に答えます。JSON として読めない本文（400、コード `2002`）、JSON でない本文（415）、100 kB を超える本文（413）は、どのルートでも、ルートに届く前にアプリケーションのミドルウェアが返すからです（[アーキテクチャ概要](./architecture-overview.md#request-flow) の Request Flow）。トークンのないリクエストでも、権限のないユーザーのリクエストでも同じです。

## 一覧

- 並びは登録日時（`createdAt`）の新しい順、同じ値の中では `id` の降順。削除済みの顧客は含まない
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後の顧客の ID
- **削除済みの顧客を指す `cursor` は、その位置から続ける**。顧客は論理削除で行が残るので、どこから続けるかが分かる。顧客を指していない `cursor` は 400（`cursor` の `not_found`）
- 絞り込みは、すべて AND で結合する

| パラメーター | 一致する顧客 |
|---|---|
| `search` | 姓、名、姓のカナ、名のカナ、メールアドレスのどれかがキーワードを含む（大文字と小文字を区別しない）。キーワードが電話番号の書き方のときは、電話番号も比べる（下記） |
| `tags` | 指定したタグをすべて持つ。複数指定するときは `tags=a&tags=b` |
| `registeredFrom` / `registeredTo` | 登録日時がその日時以降 / 以前（両端を含む）。`registeredFrom` が `registeredTo` より後なら 400（`registeredTo` の `custom`） |
| `customerStatus` / `membershipTier` | 値が一致する |

- **電話番号での検索**: キーワードが数字、空白、`-`、`+`、`(`、`)` だけでできていて数字を含むとき、キーワードから数字だけを取り出し、電話番号（`phoneNumber`）の数字の並びに含まれるかを比べます。`090-1234`、`090 1234 5678`、`09012345678` は、どれも `090-1234-5678` と保存された顧客に一致します。国際表記（`+81-90-…`）と国内表記（`090-…`）の違いは吸収しません。判定は `business-logic/customer/_shared/search.ts` の `phoneDigitsOf` です
- `search` の `%` と `_` は、ただの文字として比べます
- **登録日時は、レスポンスに出る精度（ミリ秒）で比べます**。カラムはマイクロ秒まで持つので、そのまま比べると、レスポンスの `createdAt` を `registeredTo` に指定しても、その顧客自身が一致しません
- `registeredFrom` と `registeredTo` の前後は、文字列ではなく日時として比べます（同じ秒を小数ありと小数なしで書くと、文字列の順序は逆になる）

## 項目の規則

登録（`CustomerCreateRequest`）は全項目が必須で、null にできるのは下の表で「null、または」と書いた項目だけです。更新（`CustomerUpdateRequest`）は全項目が任意で、指定した項目だけを変えます。空の本文 `{}` は 400 です。

| 項目 | 規則 |
|---|---|
| `firstName` / `lastName` | 空白だけでない、100 文字以内 |
| `firstNameKana` / `lastNameKana` | null、または空白だけでない 100 文字以内 |
| `email` | メールアドレス、255 文字以内。小文字にそろえて保存する。削除されていない顧客の間で一意（409） |
| `phoneNumber` / `alternativePhone` | 数字、空白、`-`、`+`、`(`、`)` だけ。数字が 10 桁以上、20 文字以内（サロンと同じ規則。`schemas/rules.ts` の `phoneNumber`）。`alternativePhone` は null でもよい |
| `postalCode` / `prefecture` / `city` / `address` / `building` / `occupation` | null、または空白だけでない文字列（10 / 50 / 100 / 255 / 255 / 100 文字以内） |
| `birthDate` | null、または実在する日付（`YYYY-MM-DD`）。1900-01-01 以降（`too_small`）で、未来の日付は不可（`too_big`） |
| `gender` | null、または `male` / `female` / `other` / `prefer_not_to_say` |
| `membershipTier` | `regular` / `silver` / `gold` / `platinum` / `vip` |
| `customerStatus` | `active` / `inactive` / `vip` / `blacklisted` |
| `preferences` | null、または `{ preferredServices, notes }`。`preferredServices` は `ServiceCategoryType` の配列（重複なし）、`notes` は null か空白だけでない文字列 |
| `notes` / `internalNotes` | null、または空白だけでない文字列 |
| `tags` | 空白だけでない文字列の配列。重複なし。タグがなければ空配列（null は不可） |
| `referredBy` | null、または削除されていない顧客の ID（400、`referredBy` の `not_found`）。更新では、その顧客自身は不可（400、`referredBy` の `circular`） |
| `referralCode` | null、または空白だけでない 50 文字以内。削除済みを含むすべての顧客の間で一意（409） |
| `allowMarketing` / `allowSms` / `allowEmail` / `isActive` | 真偽値 |
| `hairType` / `hairThickness` / `scalpCondition` | null、またはそれぞれの Enum の値 |

- **リクエストで変えられない項目**: `userId`（ログインアカウントとの紐づけ）、`loyaltyPoints`、`lifetimeValue`、`firstVisitDate`、`lastVisitDate`、`visitCount`、`noShowCount`、`cancellationCount`。本文に書くと 400（`unrecognized_keys`）です。予約、会計、本人の登録が更新します
- **生年月日の「未来」**: 日付にはタイムゾーンがありません。日本時間の今日は、UTC ではまだ前日のことがあるので、UTC の今日の翌日までを受け付けます（`business-logic/customer/_shared/rules.ts` の `customerRuleIssues`。現在時刻は依存の `clock` から受け取る）
- **メールアドレスと紹介コードの一意性は範囲が違います**。削除した顧客のメールアドレスは、別の顧客の登録に使えます（同じ人がもう一度登録できる）。紹介コードは、人に配ったあとも出回るので、顧客を削除しても別の顧客には使い回しません
- **紹介元**（`referredBy`）は、登録した時点の事実として保存します。紹介元の顧客があとで削除されても、値は残ります。2 人が互いを紹介元にするような循環は確認しません
- `isActive` と `customerStatus` は、互いに独立した属性として保存します。どの状態の顧客が予約できないかは、予約の実装で決めます
- `preferences` の中の形は DB では保証できないので、読み出すときに検証します（`schemas/customer.schema.ts` の `storedCustomerPreferencesSchema`）。合わない行は 500（データベースのエラー）です

## 削除

- 論理削除です（`deletedAt` を設定し、行は残す）
- 削除した顧客のメールアドレスは、別の顧客の登録や更新に使えるようになります。紹介コードは使えないままです
- 削除した顧客を紹介元にしている顧客の `referredBy` は変えません。削除した顧客を、新しく紹介元に指定することはできません
- ログインアカウントとの紐づけ（`users.customerId`、`customers.userId`）は変えません。削除された顧客情報を持つユーザーの扱いは、本人用のルートの実装で決めます
- 予約が残っている顧客を削除できるかは、予約の実装で決めます

## 同時に届いたリクエスト

| 状況 | 結果 |
|---|---|
| 同じメールアドレス（または同じ紹介コード）での登録が同時に届く | 1 件だけが成功し、ほかは 409 |
| 2 人の顧客を、同じメールアドレスに同時に更新する | 片方だけが成功し、もう片方は 409 |
| 同じ顧客の削除が同時に届く | 1 件だけが 204 で、ほかは 404 |
| 同じ顧客の更新と削除が同時に届く | 削除は成功する。更新は、先に処理されれば 200、あとなら 404 |
| 顧客の削除と、そのメールアドレスでの登録が同時に届く | 登録は、削除が先に済んでいれば成功し、そうでなければ 409。削除されていない顧客が同じメールアドレスを 2 人持つことはない |
| 同じ顧客の別々の項目を同時に更新する | どちらの変更も残る |

一意性は DB の一意インデックスが決めます。更新は、対象の行をロックしてから紹介元を確認し、書き込みます。

## DB の制約

マイグレーション `202611150900_customers_columns.sql` で、次のようにしました。

- `tags` は `text[] NOT NULL`（既定値なし）。`customerStatus` は NOT NULL
- `preferences` は既定値なし（未設定は NULL）。CHECK 制約 `customers_preferences_is_an_object` で、オブジェクトであることを保証する
- `email` は小文字（CHECK 制約 `customers_email_lower_case`）。一意性は、削除されていない行だけの一意インデックス `customers_email_unique`
- `gender` は 4 つの値のどれか（CHECK 制約 `customers_gender_known`）
- `referredBy` は自分自身を指さない（CHECK 制約 `customers_not_referred_by_itself`）

以前の行は、マイグレーションが直します（配列でない `tags` は空配列に、`{}` の `preferences` は NULL に、など。詳細はマイグレーションのコメント）。メールアドレスを小文字にした結果、削除されていない顧客の間で重なる場合は、マイグレーションが失敗します。どちらを残すかを決めてから、やり直します。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/customer.tsp`、`specs/operations/customer-operations.tsp` |
| ドメイン | `backend/packages/domain/src/models/customer.ts`、`schemas/customer.schema.ts`、`mappers/write/customer.mapper.ts`、`mappers/read/customer.mapper.ts`、`repositories/customer.repository.ts`、`business-logic/customer/`（権限は `_shared/authorization.ts`、生年月日と紹介元の規則は `_shared/rules.ts`、電話番号での検索の判定は `_shared/search.ts`） |
| ドメイン（共通） | `backend/packages/domain/src/schemas/rules.ts`（`lowerCaseEmail`、`phoneNumber` など、複数のドメインのスキーマが使う規則） |
| インフラ | `backend/packages/infrastructure/src/repositories/customer.repository.impl.ts`、`database/like.ts`（キーワードを文字どおりに探す LIKE のパターン） |
| API | `backend/packages/api/src/routes/customer/` |
| DB | `backend/packages/database/sql/migrations/202611150900_customers_columns.sql` |
