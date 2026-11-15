# 顧客台帳

顧客（`customers`）の規則をまとめます。コントラクトは `specs/operations/customer-operations.tsp` と `specs/models/customer.tsp`、テーブルは `customers` です。

顧客情報には入口が 2 つあります。管理者とサロンのスタッフは台帳（`/api/v1/customers`）で全員の顧客情報を扱い、顧客本人は[プロフィール](#顧客本人のプロフィール)（`/api/v1/customers/me`）で自分の顧客情報だけを扱います。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 台帳（`CustomerCrud`）の一覧、登録、1 件の取得、更新、削除 | 実装済み |
| 本人のプロフィール（`CustomerProfile`）の取得、作成、更新 | 実装済み |
| 好み設定の更新（`PATCH /{id}/preferences`） | 未実装。希望するスタッフと避けるスタッフ（`preferredStaffId`、`avoidStaffIds`）の存在確認が要る。確認先の [スタッフ台帳](./staff.md) は実装済み |
| 一括取得、一括登録、一括更新、一括削除、復元、統合 | 未実装 |
| 監査履歴、版、エクスポート、データ削除要請 | 未実装。保存するテーブルがない |
| 統計 | 未実装。予約と会計の実装が前提 |

未実装のオペレーションは `CustomerCrud` のもので、コントラクトには定義がありますが、サーバーは 404 を返します。

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
- ロール `customer` のユーザーと、ロールに必要なレコードを持たないユーザー（範囲 `none`）は、台帳のどのオペレーションも 403 です。台帳のレスポンスはスタッフ専用の項目（`internalNotes` など）を含むので、顧客本人には、自分の顧客情報も台帳からは返しません。本人には[プロフィール](#顧客本人のプロフィール)を返します
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

- **リクエストで変えられない項目**: `userId`（ログインアカウントとの紐づけ）、`loyaltyPoints`、`lifetimeValue`、`firstVisitDate`、`lastVisitDate`、`visitCount`、`noShowCount`、`cancellationCount`。本文に書くと 400（`unrecognized_keys`）です。`userId` は本人がプロフィールを作ったときに決まり、ほかは予約と会計が更新します
- **生年月日の「未来」**: 日付にはタイムゾーンがありません。日本時間の今日は、UTC ではまだ前日のことがあるので、UTC の今日の翌日までを受け付けます（`business-logic/customer/_shared/rules.ts` の `customerRuleIssues`。現在時刻は依存の `clock` から受け取る）
- **メールアドレスと紹介コードの一意性は範囲が違います**。削除した顧客のメールアドレスは、別の顧客の登録に使えます（同じ人がもう一度登録できる）。紹介コードは、人に配ったあとも出回るので、顧客を削除しても別の顧客には使い回しません
- **紹介元**（`referredBy`）は、登録した時点の事実として保存します。紹介元の顧客があとで削除されても、値は残ります。2 人が互いを紹介元にするような循環は確認しません
- `isActive` と `customerStatus` は、互いに独立した属性として保存します。どの状態の顧客が予約できないかは、予約の実装で決めます
- `preferences` の中の形は DB では保証できないので、読み出すときに検証します（`schemas/customer.schema.ts` の `storedCustomerPreferencesSchema`）。合わない行は 500（データベースのエラー）です

## 削除

- 論理削除です（`deletedAt` を設定し、行は残す）
- 削除した顧客のメールアドレスは、別の顧客の登録や更新に使えるようになります。紹介コードは使えないままです
- 削除した顧客を紹介元にしている顧客の `referredBy` は変えません。削除した顧客を、新しく紹介元に指定することはできません
- その顧客をプロフィールにしているアカウントがあれば、紐づけを外します（[顧客が削除されたとき](#顧客が削除されたとき)）
- 予約が残っている顧客を削除できるかは、予約の実装で決めます

## 顧客本人のプロフィール

ロール `customer` のアカウントは、台帳の中の自分の顧客情報を「プロフィール」として作り、読み、直せます。プロフィールは台帳の 1 行で、スタッフが台帳で見ているものと同じ顧客です。

| オペレーション（`CustomerProfile`） | ルート | 結果 |
|---|---|---|
| 取得 | `GET /api/v1/customers/me` | 200。プロフィールがなければ 404 |
| 作成 | `POST /api/v1/customers/me` | 201（`Location` は `/api/v1/customers/me`）。すでにあれば 409 |
| 更新 | `PATCH /api/v1/customers/me` | 200。プロフィールがなければ 404 |

- **どの顧客かは、アカウントだけで決まります**（`users.customerId`）。リクエストは顧客を指定しません。ほかの顧客を読むことも変えることもできません
- 許可するのは、ロール `customer` のアカウントだけです。`admin` とサロンのロールは 403 で、顧客情報は台帳で扱います（`business-logic/customer/_shared/profile.ts` の `profileAccessOf`）
- プロフィールを持たないアカウントの取得と更新は 404 です。顧客が台帳から削除されたアカウントも同じ応答です
- 本人がプロフィールを削除するオペレーションはありません。顧客の削除は台帳のオペレーションです
- ルーターは `/me` を `/:id` より先に登録しています。`DELETE /api/v1/customers/me` は台帳の削除のルートに届き、`me` は顧客の ID ではないので、削除の権限があるユーザーには 400、ないユーザーには 403 を返します

### 本人に見せる項目、本人が書ける項目

| 項目 | 取得（`CustomerProfileResponse`） | 作成、更新 |
|---|---|---|
| `firstName`、`lastName`、`firstNameKana`、`lastNameKana`、`phoneNumber`、`alternativePhone`、`postalCode`、`prefecture`、`city`、`address`、`building`、`birthDate`、`gender`、`occupation`、`preferences`、`allowMarketing`、`allowSms`、`allowEmail` | 出る | 書ける |
| `id`、`email`、`membershipTier`、`loyaltyPoints`、`referralCode`、`firstVisitDate`、`lastVisitDate`、`visitCount`、`hairType`、`hairThickness`、`scalpCondition`、`createdAt`、`updatedAt` | 出る | 書けない |
| `userId`、`notes`、`internalNotes`、`tags`、`referredBy`、`isActive`、`customerStatus`、`lifetimeValue`、`noShowCount`、`cancellationCount` | 出ない | 書けない |

- 書ける項目の規則は、台帳と同じです（[項目の規則](#項目の規則)）。作成（`CustomerProfileCreateRequest`）は 18 項目すべてが必須で、台帳で null にできる項目は null にできます。更新（`CustomerProfileUpdateRequest`）は指定した項目だけを変え、空の本文 `{}` は 400 です
- 書けない項目を本文に書くと 400（`unrecognized_keys`）です。会員ランク、ポイント、状態を本人が書き換えることはできません
- **メールアドレスは本人が書けません**。作成のとき、アカウントのメールアドレスが顧客のメールアドレスになります。そのあとは台帳の値で、スタッフが台帳で直せば、プロフィールにもその値が出ます（アカウントのメールアドレスは変わりません）
- 本人に見せる項目は、読み出しのマッパー（`CustomerProfileReadMapper`）が 1 つずつ名指しします。台帳に項目を足しても、名指ししなければ本人には出ません

### プロフィールの作成と、台帳の顧客の引き継ぎ

来店したことのある顧客は、アカウントを作る前から台帳にいます。作成は、アカウントのメールアドレスで台帳を探します。

| 台帳の、同じメールアドレスの顧客（削除済みを除く） | 作成の結果 |
|---|---|
| いない | 新しい顧客を登録して、プロフィールにする |
| いて、どのアカウントにも紐づいていない | その顧客をプロフィールにする（引き継ぎ） |
| いて、別のアカウントに紐づいている | 409 |

- **新しい顧客**は、本人が書いた 18 項目と、スタッフが何も指定せずに登録したときと同じ値でできます。`membershipTier` は `regular`、`customerStatus` は `active`、`isActive` は true、`tags` は空、ほかの項目は null、ポイントと来店回数は 0 です
- **引き継ぎ**では、顧客の ID、来店歴、ポイント、スタッフの記録がそのまま残ります。本人が値を書いた項目は顧客情報を置き換え、null にした項目は台帳の値を残します（姓名、電話番号、3 つの同意は null にできないので、必ず置き換わります）。台帳の値を消すには、作成のあとで更新を使います。スタッフ側の項目は変えません。`isActive` と `customerStatus` がどの値でも引き継ぎます
- **メールアドレスを確認していないアカウントは作成できません**（409）。引き継ぎの根拠は、そのメールアドレスの持ち主であることです。登録の流れでは、確認が済むまでログインできないので、通常の利用でこの 409 になることはありません
- 紐づけは `users.customerId` と `customers.userId` の両方に、1 つのトランザクションで書きます。`GET /api/v1/auth/me` の `customerId` に、顧客の ID が出るようになります

### 確認の順序（プロフィール）

1. アクセストークン（401）
2. アカウントの種類（403）
3. プロフィールの有無: 作成は、すでにあれば 409。取得と更新は、なければ 404
4. リクエストの本文（400）、生年月日の範囲（400）
5. 保存されている行で決まること（作成）: メールアドレスの確認（409）、同じメールアドレスの顧客の紐づけ先（409）

読めない本文は、台帳と同じく、この順序の前に答えます。

### 顧客が削除されたとき

- 台帳で顧客を削除すると、その顧客をプロフィールにしているアカウントの紐づけ（`users.customerId`）を、同じトランザクションで外します
- アカウントは残り、ログインできます。プロフィールの取得と更新は 404 になり、作成をもう一度送れます。できるのは新しい顧客で、削除した顧客の来店歴やポイントは引き継ぎません
- 削除した行の `customers.userId` は、どのアカウントの顧客だったかの記録として残します

アカウントを削除する機能は、まだありません。作るときは、そのアカウントの顧客との紐づけ（`customers.userId`）を外す必要があります。外さないと、同じメールアドレスで登録し直したアカウントが、台帳の顧客を引き継げません。

## 同時に届いたリクエスト

| 状況 | 結果 |
|---|---|
| 同じメールアドレス（または同じ紹介コード）での登録が同時に届く | 1 件だけが成功し、ほかは 409 |
| 2 人の顧客を、同じメールアドレスに同時に更新する | 片方だけが成功し、もう片方は 409 |
| 同じ顧客の削除が同時に届く | 1 件だけが 204 で、ほかは 404 |
| 同じ顧客の更新と削除が同時に届く | 削除は成功する。更新は、先に処理されれば 200、あとなら 404 |
| 顧客の削除と、そのメールアドレスでの登録が同時に届く | 登録は、削除が先に済んでいれば成功し、そうでなければ 409。削除されていない顧客が同じメールアドレスを 2 人持つことはない |
| 同じ顧客の別々の項目を同時に更新する | どちらの変更も残る。本人（プロフィール）とスタッフ（台帳）の更新でも同じ |
| 同じアカウントのプロフィールの作成が同時に届く | 1 件だけが 201 で、ほかは 409。顧客は 1 人だけできる |
| プロフィールの作成と、そのアカウントのメールアドレスでの顧客の登録（台帳）が同時に届く | そのメールアドレスの顧客は 1 人だけ。登録が先に済めば、作成はその顧客を引き継ぐ（どちらも 201）。作成が先に済めば、登録は 409。同じ瞬間に書き込むと、作成が 409（もう一度送れば、登録された顧客を引き継ぐ） |
| プロフィールの作成と、引き継ぐはずの顧客の削除が同時に届く | どちらも成功する。削除が先なら、新しい顧客がプロフィールになる。作成が先なら、引き継いだ顧客が削除され、アカウントはプロフィールのない状態に戻る |
| プロフィールの更新と、その顧客の削除が同時に届く | 削除は成功する。更新は、先に処理されれば 200、あとなら 404 |

一意性は DB の一意インデックスが決めます。更新は、対象の行をロックしてから紹介元を確認し、書き込みます。プロフィールの作成は、アカウントの行、引き継ぐ顧客の行の順にロックしてから書き込みます。

## DB の制約

マイグレーション `202611150900_customers_columns.sql` で、次のようにしました。

- `tags` は `text[] NOT NULL`（既定値なし）。`customerStatus` は NOT NULL
- `preferences` は既定値なし（未設定は NULL）。CHECK 制約 `customers_preferences_is_an_object` で、オブジェクトであることを保証する
- `email` は小文字（CHECK 制約 `customers_email_lower_case`）。一意性は、削除されていない行だけの一意インデックス `customers_email_unique`
- `gender` は 4 つの値のどれか（CHECK 制約 `customers_gender_known`）
- `referredBy` は自分自身を指さない（CHECK 制約 `customers_not_referred_by_itself`）

以前の行は、マイグレーションが直します（配列でない `tags` は空配列に、`{}` の `preferences` は NULL に、など。詳細はマイグレーションのコメント）。メールアドレスを小文字にした結果、削除されていない顧客の間で重なる場合は、マイグレーションが失敗します。どちらを残すかを決めてから、やり直します。

マイグレーション `202611151500_customers_user_unique.sql` で、アカウントとの紐づけを 1 対 1 にしました。

- `customers.userId` は、削除されていない顧客の間で一意（一意インデックス `customers_user_unique`）。削除されていない 2 人の顧客が同じアカウントを指していると、マイグレーションが失敗します。どちらがそのアカウントの顧客かを決めてから、やり直します
- 削除済みの顧客を指していた `users.customerId` は NULL にする
- `customers.userId` には外部キーを付けていません。`users.customerId` に外部キーがあり、2 つのテーブルが互いを外部キーで参照すると、DB から生成する `schema.ts` に型が付かなくなるためです（[DB 駆動ドメインモデル](./db-driven-domain-model.md)）。2 つのカラムは、紐づけるコードと外すコードが 1 つのトランザクションで一緒に書きます

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/customer.tsp`、`specs/operations/customer-operations.tsp` |
| ドメイン | `backend/packages/domain/src/models/customer.ts`、`schemas/customer.schema.ts`、`mappers/write/customer.mapper.ts`、`mappers/read/customer.mapper.ts`、`repositories/customer.repository.ts`、`business-logic/customer/`（権限は `_shared/authorization.ts`、生年月日と紹介元の規則は `_shared/rules.ts`、電話番号での検索の判定は `_shared/search.ts`） |
| ドメイン（プロフィール） | 同じ `models/customer.ts`、`schemas/customer.schema.ts`、`repositories/customer.repository.ts`（`createProfile`）と、`mappers/write/customer-profile.mapper.ts`、`mappers/read/customer-profile.mapper.ts`、`business-logic/customer/` の `*-customer-profile.usecase.ts`（誰のプロフィールかは `_shared/profile.ts`） |
| ドメイン（共通） | `backend/packages/domain/src/schemas/rules.ts`（`lowerCaseEmail`、`phoneNumber` など、複数のドメインのスキーマが使う規則） |
| インフラ | `backend/packages/infrastructure/src/repositories/customer.repository.impl.ts`、`database/like.ts`（キーワードを文字どおりに探す LIKE のパターン） |
| API | `backend/packages/api/src/routes/customer/`（プロフィールは `*-customer-profile.handler.ts`） |
| DB | `backend/packages/database/sql/migrations/202611150900_customers_columns.sql`、`202611151500_customers_user_unique.sql` |
