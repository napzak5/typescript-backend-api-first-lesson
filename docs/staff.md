# スタッフ台帳

サロンのスタッフ（`staff`）の規則をまとめます。コントラクトは `specs/operations/staff-operations.tsp` と `specs/models/staff.tsp`、テーブルは `staff` です。

スタッフ台帳は、サロンが雇用主として持つスタッフの記録です。1 人のスタッフが 1 行で、氏名と連絡先、雇用の情報（基本給、歩合率、雇用形態、入社日）、予約の受け方（同時に担当できる数、前後に確保する時間）を持ちます。

スタッフの情報には入口が 2 つあります。管理者とサロンの `owner` は台帳（`/api/v1/salons/{salonId}/staff`）でスタッフのすべての項目を扱い、顧客を含む誰もが[プロフィール](#顧客に見せるプロフィール)（`/api/v1/staff-profiles`）で、顧客に見せる項目だけを読みます。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 台帳（`StaffCrud`）の一覧、登録、1 件の取得、更新、削除 | 実装済み |
| 顧客に見せるプロフィール（`StaffProfile`）の一覧、1 件の取得 | 実装済み。サロンをまたぐ検索は、一覧の絞り込みで行う |
| 勤務スケジュール（`StaffCrud` の `getAvailability`、`updateAvailability`） | 未実装 |
| スタッフのログインアカウント（アカウントとスタッフの紐づけ、サロンのロールの付与） | 未実装。コントラクトにオペレーションがない |

未実装のオペレーションは、コントラクトに定義があっても、サーバーは 404 を返します。`staff_skills`（担当できるサービス）と `staff_performances`（実績）は、テーブルだけがあり、コントラクトにオペレーションがありません。

## オペレーションと権限

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/salons/{salonId}/staff` | `admin`、そのサロンの `owner` |
| 登録 | `POST /api/v1/salons/{salonId}/staff` | 同上 |
| 1 件の取得 | `GET /api/v1/salons/{salonId}/staff/{id}` | 同上 |
| 更新 | `PATCH /api/v1/salons/{salonId}/staff/{id}` | 同上 |
| 削除 | `DELETE /api/v1/salons/{salonId}/staff/{id}` | 同上 |

- 台帳のすべてのオペレーションに認証が要ります。台帳は公開情報ではありません
- **`manager` と `staff` には許可しません**（403）。理由は 2 つです。台帳が、雇用主だけが扱う情報（給与、歩合、個人の連絡先）を含むこと。無効化（`isActive` を false にする）と削除が、そのスタッフのアカウントからサロンへの権限を外すこと（[ログインアカウントへの影響](#ログインアカウントへの影響)）。`manager` に許すと、`manager` が `owner` をサロンから締め出せます
- スタッフ本人も、自分のスタッフ情報を台帳から読むことはできません。読めるのは、誰にでも見せる[プロフィール](#顧客に見せるプロフィール)の項目だけです。本人が自分のプロフィールを直すオペレーションはなく、直すのは `owner` と `admin` です。本人に許すかどうかは、スタッフのログインアカウントの実装で決めます
- 権限は、[サロンの下にあるルートの規則](./authentication.md#サロンの下にあるルートの権限)どおり、パスの `salonId` だけで判定します（`business-logic/staff/_shared/authorization.ts` の `mayKeepStaffLedger`）。ほかのサロンの `owner` は 403 です
- サロンが存在しない、または削除済みなら 404。パスのサロンに属さないスタッフと、削除済みのスタッフは 404 で、存在しない ID と区別しません
- ID（パスの `salonId` と `id`、クエリの `cursor`）は、英字を大文字で書いても同じ ID です。レスポンスの `data` と `meta` の ID は小文字です

### 確認の順序

1. アクセストークン（401）
2. `salonId` の形式（400）
3. 権限（403）
4. スタッフの `id` の形式（400。取得、更新、削除）
5. クエリ（400。一覧）、リクエストの本文（400。登録、更新）
6. 自分自身のスタッフ情報への操作（409。更新、削除）
7. サロンの存在（404）
8. 保存されている行で決まること: スタッフの存在（404）、メールアドレスとスタッフコードの一意性（409）

権限のないユーザーには、スタッフの ID、クエリ、本文が不正でも、サロンやスタッフが存在しなくても 403 を返します。一覧のクエリは HTTP 層が型に直しますが、直せなかったクエリのエラーも、権限を確認したあとで返します（`ListStaffUseCase` は、直した結果を `Result` で受け取る）。

読めない本文は、この順序の前に答えます。JSON として読めない本文（400、コード `2002`）、JSON でない本文（415）、100 kB を超える本文（413）は、どのルートでも、ルートに届く前にアプリケーションのミドルウェアが返すからです（[アーキテクチャ概要](./architecture-overview.md#request-flow) の Request Flow）。

### 自分自身のスタッフ情報

操作者のアカウントが紐づいているスタッフ（操作者の範囲の `staffId`）は、その操作者には無効化も削除もできません。

| 操作 | 結果 |
|---|---|
| 自分のスタッフ情報の `isActive` を false にする更新（ほかの項目と一緒でも） | 409（コード `3003`、`You cannot deactivate your own staff record`） |
| 自分のスタッフ情報の削除 | 409（コード `3003`、`You cannot delete your own staff record`） |
| 自分のスタッフ情報の、ほかの項目の更新。`isActive` を true と書く更新 | 200 |

- どちらも、自分をサロンから締め出す操作で、締め出されたあとは自分では戻せません。ほかの `owner` と `admin` は、`owner` のスタッフ情報も無効化、削除できます
- 判定は、本文を検証したあと、サロンとスタッフを検索する前に行います（`business-logic/staff/_shared/authorization.ts` の `isOwnStaffRecord`）。本文が不正なら、409 ではなく 400 です
- **サロンに有効な `owner` が 1 人もいなくなることは、防いでいません**。管理者は最後の `owner` も無効化、削除できます。2 人の `owner` が同じ瞬間に互いを無効化すると、どちらも成功することがあります（[同時に届いたリクエスト](#同時に届いたリクエスト)）。戻せるのは管理者です

### ログインアカウントへの影響

認証は、リクエストのたびに操作者の範囲を作り直します。`owner`、`manager`、`staff` のアカウントがサロンの範囲を持つのは、`users.staffId` が指すスタッフが有効（`isActive`）で、削除されていないときだけです（[認可](./authentication.md#認可)）。

- スタッフを無効化または削除すると、そのスタッフに紐づくアカウントは、**次のリクエストから**サロンへの権限を失います（範囲 `none`）。発行済みのアクセストークンでも同じです。そのスタッフは、顧客に見せる[プロフィール](#見せるスタッフ)からも外れます
- アカウントは残り、ログインもできます。サロンの権限が要る操作と顧客台帳には届きません（認証なしで読める情報は、誰でも読めます）
- `isActive` を true に戻すと、権限も戻ります。削除は戻せません（復元のオペレーションはない）
- アカウントに紐づいていないスタッフ（`userId` が null）には、この影響はありません

アカウントとスタッフを紐づける API は、まだありません。紐づいているのは、シードのアカウントと、DB に直接登録したアカウントだけです。レスポンスの `userId` は、紐づいているアカウントの ID か null で、リクエストでは指定できません（紐づけは `users.staffId` と `staff.userId` の両方を書き、ロールも変えるので、専用のオペレーションにします）。

## 一覧

- 並びは登録日時（`createdAt`）の古い順、同じ値の中では `id` の昇順。登録した順に並び、新しいスタッフは末尾に加わる
- 無効なスタッフ（`isActive` が false）は含む。削除済みのスタッフは含まない
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後のスタッフの ID
- **削除済みのスタッフを指す `cursor` は、その位置から続ける**。スタッフは論理削除で行が残るので、どこから続けるかが分かる。そのサロンのスタッフを指していない `cursor`（存在しない ID、ほかのサロンのスタッフ）は 400（`cursor` の `not_found`）
- 絞り込みのパラメーターはない。`limit` と `cursor` 以外のパラメーターは 400（`unrecognized_keys`）

## 項目の規則

登録（`StaffCreateRequest`）は全項目が必須で、null にできるのは下の表で「null、または」と書いた項目だけです。更新（`StaffUpdateRequest`）は全項目が任意で、指定した項目だけを変えます。空の本文 `{}` は 400 です。

| 項目 | 規則 |
|---|---|
| `firstName` / `lastName` | 空白だけでない、100 文字以内 |
| `firstNameKana` / `lastNameKana` | null、または空白だけでない 100 文字以内 |
| `displayName` | 空白だけでない、255 文字以内 |
| `email` | メールアドレス、255 文字以内。小文字にそろえて保存する。同じサロンの削除されていないスタッフの間で一意（409） |
| `phoneNumber` / `alternativePhone` | 数字、空白、`-`、`+`、`(`、`)` だけ。数字が 10 桁以上、20 文字以内（サロン、顧客と同じ規則。`schemas/rules.ts` の `phoneNumber`）。`alternativePhone` は null でもよい |
| `staffCode` | null、または空白だけでない 50 文字以内。同じサロンの、削除済みを含むスタッフの間で一意（409）。大文字と小文字は区別する |
| `level` | `junior` / `stylist` / `senior` / `expert` / `director` |
| `position` / `employmentType` | null、または空白だけでない文字列（100 / 50 文字以内） |
| `specialties` / `certifications` | 空白だけでない文字列の配列。重複なし。なければ空配列（null は不可）。更新は、指定した配列で全体を置き換える |
| `bio` | null、または空白だけでない文字列 |
| `imageUrl` | null、または `http` か `https` の URL、500 文字以内 |
| `yearsOfExperience` | null、または 0〜100 の整数 |
| `hireDate` | null、または実在する日付（`YYYY-MM-DD`）。未来の日付も指定できる（入社が決まったスタッフを先に登録できる） |
| `baseSalary` | null、または 0 以上の整数（`integer` カラムの上限まで） |
| `commissionRate` | null、または 0〜100 の数値（%）。小数第 2 位まで（カラムが `numeric(5,2)` のため） |
| `maxConcurrentBookings` | 1〜10 の整数 |
| `bufferTimeBefore` / `bufferTimeAfter` | 0〜120 の整数（分）。0 は「確保しない」 |
| `canReceiveBookings` / `isActive` | 真偽値 |

- **リクエストで変えられない項目**: `userId`（ログインアカウントとの紐づけ）と、所属サロン（登録はパスの `salonId` が決め、あとから変えられない）。本文に `userId` や `salonId` を書くと 400（`unrecognized_keys`）です
- **レスポンスに出さない項目**: `awards`（構造の決まっていない jsonb）と `deletedAt`。レスポンス（`StaffResponse`）は勤務スケジュールも含みません
- `isActive` と `canReceiveBookings` は、互いに独立した属性として保存します。`isActive` は、アカウントの権限（[ログインアカウントへの影響](#ログインアカウントへの影響)）と、顧客に見せるかどうか（[見せるスタッフ](#見せるスタッフ)）に効きます。どのスタッフが予約を受けられるかは、予約の実装で決めます

### 一意性の範囲

| 項目 | 範囲 |
|---|---|
| `email` | 同じサロンの、削除されていないスタッフの間 |
| `staffCode` | 同じサロンの、削除済みを含むスタッフの間（null は対象外） |

- **メールアドレスは、サロンの中だけで比べます**。ほかのサロンにいるスタッフのメールアドレスが、409 で分かってしまわないようにするためです。サロンのデータは、ほかのサロンのデータに左右されません。同じ人が 2 つのサロンで働くときは、サロンごとにスタッフを登録します
- 削除したスタッフのメールアドレスは、別のスタッフの登録や更新に使えます（Salon、顧客台帳のメールアドレスと同じ判断）
- スタッフコード（社員番号）は、削除したスタッフのものも使い回しません。過去の記録と取り違えないためです（顧客の紹介コードと同じ判断）
- 1 人のアカウントが属するサロンは 1 つ、という規則（`users.staffId` が 1 つ）は、アカウントについてのもので、スタッフの行についてのものではありません

## 削除

- 論理削除です（`deletedAt` を設定し、行は残す）。削除したスタッフは、台帳とプロフィールの、一覧と取得の対象外になります
- 削除したスタッフのメールアドレスは、別のスタッフに使えるようになります。スタッフコードは使えないままです
- 勤務スケジュール（`staff_schedules`）、スキル（`staff_skills`）、予約などの行は残ります
- そのスタッフに紐づくアカウントは、サロンへの権限を失います（[ログインアカウントへの影響](#ログインアカウントへの影響)）。`users.staffId` は、削除したスタッフを指したまま残ります
- 削除したスタッフを更新しても、戻りません（404）
- 予約が残っているスタッフを削除できるかは、予約の実装で決めます

## 顧客に見せるプロフィール

顧客がスタッフを選ぶときに見る情報です。台帳と同じ `staff` の行を、見せる項目だけのモデル（`StaffProfileResponse`）で返します。プロフィールのためのテーブルやカラムはありません。

| オペレーション（`StaffProfile`） | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/staff-profiles` | 誰でも（認証なし） |
| 1 件の取得 | `GET /api/v1/staff-profiles/{id}` | 同上 |

- どちらも公開です。アクセストークンは要らず、送っても確認しません。存在しないセッションのトークンや、期限の切れたトークンを付けたリクエストにも、同じ応答を返します
- 台帳を読めない `manager` と `staff` も、同僚と自分のプロフィールは読めます
- 読むだけです。登録、更新、削除は台帳で行い、台帳の変更は、次のリクエストからプロフィールに出ます
- ルートはサロンの下に置いていません。顧客は、サロンをまたいでスタッフを探すからです（専門分野、市区町村）。1 つのサロンのスタッフは、一覧を `salonId` で絞り込んで読みます。同じ結果を返すサロンの下のルート（`/api/v1/salons/{salonId}/staff-profiles`）はありません

### 見せる項目

| | 項目 |
|---|---|
| 見せる（`StaffProfileResponse` の 11 項目） | `id`、`salonId`、`displayName`、`level`、`position`、`specialties`、`bio`、`imageUrl`、`yearsOfExperience`、`certifications`、`canReceiveBookings` |
| 見せない | 氏名とその読み（`firstName`、`lastName`、`firstNameKana`、`lastNameKana`）、連絡先（`email`、`phoneNumber`、`alternativePhone`）、雇用の情報（`staffCode`、`hireDate`、`employmentType`、`baseSalary`、`commissionRate`）、予約の受け方の設定（`maxConcurrentBookings`、`bufferTimeBefore`、`bufferTimeAfter`）、`userId`、`isActive`、`createdAt`、`updatedAt`。台帳のレスポンスにも出ない `awards` と `deletedAt` |

- 名前は `displayName`（顧客に見せる名前）だけです。本名を見せるかどうかは、サロンが `displayName` に何を書くかで決まります
- 項目名、型、null の扱いは台帳と同じです。`position`、`bio`、`imageUrl`、`yearsOfExperience` は null があり、`specialties` と `certifications` は、なければ空配列です
- `canReceiveBookings` が false のスタッフ（アシスタントなど）も見せます。値はそのまま返すので、予約を受けるスタッフだけを並べるかどうかは、画面が決めます
- 見せる項目は、リポジトリが SELECT するカラム（`staff-profile.repository.impl.ts` の `profileColumns`）と、読み出しのマッパー（`StaffProfileReadMapper`）が 1 つずつ名指しします。台帳に項目を足しても、名指ししなければプロフィールには出ません。`pnpm check:api-db` は、モデルの項目と、見せないと決めたカラムの一覧（`api-consistency-rules.ts`）を、テーブルと突き合わせます

### 見せるスタッフ

次のすべてを満たすスタッフを見せます。

| 条件 | 理由 |
|---|---|
| 有効（`isActive` が true） | 無効化は「いまサロンで働いていない」を表す。休職中や退職の手続き中のスタッフは、顧客に見せない |
| 削除されていない | 台帳と同じ |
| サロンが削除されていない | 削除したサロンは Salon の一覧と取得に出ない。そのスタッフも出さない |

- サロンの `isActive`（予約受付中かどうか）は条件にしません。受付を止めているサロンも Salon の取得に出るので、そのスタッフも出します
- 見せないスタッフの取得は 404（`Staff member <id> was not found`）で、存在しない ID と区別しません。無効化されたのか、削除されたのか、はじめからいないのかは、応答から分かりません
- 無効化したスタッフを有効に戻すと、同じ ID のまま、一覧の元の位置に戻ります

### プロフィールの一覧

- 並びは台帳と同じで、登録日時（`createdAt`）の古い順、同じ値の中では `id` の昇順。サロンをまたいで、この順に並ぶ
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後のスタッフの ID
- 絞り込みは次の 3 つ。指定したすべてを満たすスタッフを返し、`meta.total` はその人数

| パラメーター | 規則 |
|---|---|
| `salonId` | そのサロンのスタッフ。UUID の形式でなければ 400。存在しないサロン、削除済みのサロンは、エラーではなく空の一覧 |
| `specialty` | `specialties` のどれかの要素と完全に一致するスタッフ。空白だけでない文字列。大文字と小文字、前後の空白を区別する。指定できるのは 1 つ（2 つ書くと 400） |
| `city` | サロンの市区町村（`salons.city`）と完全に一致するサロンのスタッフ。空白だけでない 100 文字以内 |

- **見せなくなったスタッフを指す `cursor` は、その位置から続ける**。ページを読んでいる間にスタッフが無効化、削除されても、続きを読める。絞り込みに合わないスタッフ（ほかのサロンのスタッフなど）を指す `cursor` も同じ。`cursor` は位置だけを決め、誰を返すかは絞り込みが決める
- どのスタッフも指していない `cursor` は 400（`cursor` の `not_found`、`Must name a staff member`）
- 定義のないパラメーターは 400（`unrecognized_keys`）。`isActive` での絞り込みはない（無効なスタッフは見せない）
- ID（パスの `id`、クエリの `cursor` と `salonId`）は、英字を大文字で書いても同じ ID

### 確認の順序（プロフィール）

1. `id` の形式（400。取得）、クエリ（400。一覧）
2. スタッフの存在（404。取得）、`cursor` が指すスタッフの存在（400。一覧）

権限の確認はありません。

## 同時に届いたリクエスト

| 状況 | 結果 |
|---|---|
| 同じサロンに、同じメールアドレス（または同じスタッフコード）での登録が同時に届く | 1 件だけが成功し、ほかは 409 |
| 別々のサロンに、同じメールアドレスでの登録が同時に届く | すべて成功する |
| 同じサロンの 2 人のスタッフを、同じメールアドレスに同時に更新する | 片方だけが成功し、もう片方は 409 |
| 同じスタッフの削除が同時に届く | 1 件だけが 204 で、ほかは 404 |
| 同じスタッフの更新と削除が同時に届く | 削除は成功する。更新は、先に処理されれば 200、あとなら 404 |
| スタッフの削除と、そのメールアドレスでの登録が同時に届く | 登録は、削除が先に済んでいれば成功し、そうでなければ 409。同じサロンの削除されていないスタッフが、同じメールアドレスを 2 人持つことはない |
| 同じスタッフの別々の項目を同時に更新する | どちらの変更も残る |
| 2 人の `owner` が、同時に互いを無効化する | どちらも成功することがある（権限は、リクエストを受け付けた時点で判定する）。サロンに有効な `owner` がいなくなるので、管理者が `isActive` を戻す |

一意性は DB の一意インデックスと一意制約が決めます。更新と削除は、「削除されていないこと」を WHERE に含めた 1 つの文で行います。

## DB の制約

マイグレーション `202611151800_staff_columns.sql` で、次のようにしました。

- `specialties` と `certifications` は `text[] NOT NULL`（既定値なし）。以前は NULL 可の jsonb で、NULL、空配列、配列でない値のどれもがあり得た
- `bufferTimeBefore` と `bufferTimeAfter` は NOT NULL（既定値 0）。以前は NULL と 0 が同じ意味だった
- `email` は小文字（CHECK 制約 `staff_email_lower_case`）。一意性は、サロンごとの、削除されていない行だけの一意インデックス `staff_email_salon_unique`。以前は、削除済みを含むすべてのサロンのスタッフの間で一意だった（一意制約 `staff_email_unique`）
- CHECK 制約: 準備時間と片付け時間は 0 以上（`staff_buffer_times_not_negative`）、同時に担当できる予約は 1 以上（`staff_max_concurrent_bookings_positive`）、経験年数は 0 以上（`staff_years_of_experience_not_negative`）、基本給は 0 以上（`staff_base_salary_not_negative`）、歩合率は 0 以上 100 以下（`staff_commission_rate_is_a_percentage`）
- スタッフコードの一意制約（`staff_code_salon_unique`。サロンとスタッフコードの組）は、以前からある

以前の行は、マイグレーションが直します（NULL や配列でない一覧は空配列に、文字列でない要素は除く、NULL の時間は 0 に、メールアドレスは小文字に）。次の場合は、マイグレーションが失敗します。行を直してから、やり直します。

- メールアドレスを小文字にした結果、同じサロンの削除されていないスタッフの間で重なる。どちらを残すかは、人が決める
- CHECK 制約に反する行がある（負の基本給など）。値を推測できないので、直さない

`staff.userId` には外部キーを付けていません。`users.staffId` に外部キーがあり、2 つのテーブルが互いを外部キーで参照すると、DB から生成する `schema.ts` に型が付かなくなるためです（[DB 駆動ドメインモデル](./db-driven-domain-model.md)）。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/staff.tsp`、`specs/operations/staff-operations.tsp` |
| ドメイン | `backend/packages/domain/src/models/staff.ts`、`schemas/staff.schema.ts`、`mappers/write/staff.mapper.ts`、`mappers/read/staff.mapper.ts`、`repositories/staff.repository.ts`、`business-logic/staff/`（権限と「自分自身のスタッフ情報」の判定は `_shared/authorization.ts`、409 の文言は `_shared/refusals.ts`） |
| ドメイン（プロフィール） | `backend/packages/domain/src/models/staff-profile.ts`、`schemas/staff-profile.schema.ts`、`mappers/read/staff-profile.mapper.ts`、`repositories/staff-profile.repository.ts`、`business-logic/staff-profile/` |
| ドメイン（共通） | `backend/packages/domain/src/schemas/rules.ts`（`lowerCaseEmail`、`phoneNumber`、`noRepeatedEntries` など）、`business-logic/_shared/existing-salon.ts`（サロンの存在の確認） |
| インフラ | `backend/packages/infrastructure/src/repositories/staff.repository.impl.ts`、`repositories/account.ts`（操作者の範囲。スタッフが有効で削除されていないことを確認する） |
| インフラ（プロフィール） | `backend/packages/infrastructure/src/repositories/staff-profile.repository.impl.ts`（見せるカラムと、見せるスタッフの条件） |
| API | `backend/packages/api/src/routes/staff/`、`backend/packages/api/src/routes/staff-profile/` |
| DB | `backend/packages/database/sql/migrations/202611151800_staff_columns.sql`、`backend/packages/database/src/scripts/api-consistency-rules.ts`（`Models.StaffProfileResponse` が出さないカラムの一覧） |
