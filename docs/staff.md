# スタッフ台帳

サロンのスタッフ（`staff`）の規則をまとめます。コントラクトは `specs/operations/staff-operations.tsp` と `specs/models/staff.tsp`、テーブルは `staff`、`staff_schedules`、`staff_invitations` です。

スタッフ台帳は、サロンが雇用主として持つスタッフの記録です。1 人のスタッフが 1 行で、氏名と連絡先、雇用の情報（基本給、歩合率、雇用形態、入社日）、予約の受け方（同時に担当できる数、前後に確保する時間）を持ちます。

スタッフの情報には入口が 2 つあります。管理者とサロンの `owner` は台帳（`/api/v1/salons/{salonId}/staff`）でスタッフのすべての項目を扱い、顧客を含む誰もが[プロフィール](#顧客に見せるプロフィール)（`/api/v1/staff-profiles`）で、顧客に見せる項目だけを読みます。

スタッフがいつ勤務するかは、台帳の行ではなく、スタッフごとの[勤務スケジュール](#勤務スケジュール)（`/api/v1/salons/{salonId}/staff/{id}/schedules`、テーブルは `staff_schedules`）が持ちます。シフトを組むサロンの `owner` と `manager`、管理者が読み書きし、スタッフ本人は自分のスケジュールを読みます。

スタッフがログインするアカウントは、[招待](#スタッフのログインアカウント)で作ります（`/api/v1/salons/{salonId}/staff/{id}/invitation`、テーブルは `staff_invitations`）。管理者とサロンの `owner` が台帳のスタッフを招待し、招待された本人が、メールのリンクから自分でパスワードを決めます。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| 台帳（`StaffCrud`）の一覧、登録、1 件の取得、更新、削除 | 実装済み |
| 顧客に見せるプロフィール（`StaffProfile`）の一覧、1 件の取得 | 実装済み。サロンをまたぐ検索は、一覧の絞り込みで行う |
| 勤務スケジュール（`StaffSchedules`）の一覧、更新（全体の置き換え） | 実装済み |
| スタッフのログインアカウント（`StaffInvitations` の招待の取得、作成、取り消しと、`AuthCrud` の招待の確認、受け入れ） | 実装済み |
| すでにあるアカウントとスタッフの紐づけ、紐づいているアカウントのロールの変更、紐づけの解除、スタッフ本人によるプロフィールの編集 | 未実装。コントラクトにオペレーションがない |

スタッフのコントラクトに定義したオペレーションは、すべて実装済みです。`staff_skills`（担当できるサービス）と `staff_performances`（実績）は、テーブルだけがあり、コントラクトにオペレーションがありません。

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
- スタッフ本人も、自分のスタッフ情報を台帳から読むことはできません。読めるのは、誰にでも見せる[プロフィール](#顧客に見せるプロフィール)の項目だけです。本人が自分のプロフィールを直すオペレーションはなく、直すのは `owner` と `admin` です
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
- **サロンに有効な `owner` が 1 人もいなくなることは、防いでいません**。管理者は最後の `owner` も無効化、削除できます。2 人の `owner` が同じ瞬間に互いを無効化すると、どちらも成功することがあります（[同時に届いたリクエスト](#同時に届いたリクエスト)）。作ったばかりのサロンにも `owner` はいないので、`owner` のいないサロンは、ふつうにある状態です。戻せるのは管理者で、`isActive` を戻すか、別のスタッフを `owner` として[招待](#スタッフのログインアカウント)します

### ログインアカウントへの影響

認証は、リクエストのたびに操作者の範囲を作り直します。`owner`、`manager`、`staff` のアカウントがサロンの範囲を持つのは、`users.staffId` が指すスタッフが有効（`isActive`）で、削除されていないときだけです（[認可](./authentication.md#認可)）。

- スタッフを無効化または削除すると、そのスタッフに紐づくアカウントは、**次のリクエストから**サロンへの権限を失います（範囲 `none`）。発行済みのアクセストークンでも同じです。そのスタッフは、顧客に見せる[プロフィール](#見せるスタッフ)からも外れます
- アカウントは残り、ログインもできます。サロンの権限が要る操作と顧客台帳には届きません（認証なしで読める情報は、誰でも読めます）
- `isActive` を true に戻すと、権限も戻ります。削除は戻せません（復元のオペレーションはない）
- アカウントに紐づいていないスタッフ（`userId` が null）には、この影響はありません

アカウントとスタッフの紐づけを作るのは、[招待の受け入れ](#受け入れ)だけです（ほかに紐づいているのは、シードのアカウント）。レスポンスの `userId` は、紐づいているアカウントの ID か null で、台帳のリクエストでは指定できません（紐づけは `users.staffId` と `staff.userId` の両方を書き、ロールも決めるので、専用のオペレーションにしています）。紐づけを外すオペレーションはなく、サロンへの権限を外すのは、スタッフの無効化か削除です。

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
- **レスポンスに出さない項目**: `awards`（構造の決まっていない jsonb）と `deletedAt`。レスポンス（`StaffResponse`）は勤務スケジュールも含みません。スケジュールは[別のルート](#勤務スケジュール)で読みます
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
- 勤務スケジュール（`staff_schedules`）、スキル（`staff_skills`）、予約などの行は残ります。削除したスタッフのスケジュールは、読むことも置き換えることもできません（404）
- そのスタッフに紐づくアカウントは、サロンへの権限を失います（[ログインアカウントへの影響](#ログインアカウントへの影響)）。`users.staffId` は、削除したスタッフを指したまま残ります
- そのスタッフが持っている招待は、使えなくなります（[招待が使える間](#招待が使える間)）。`staff_invitations` の行は残ります
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

## 勤務スケジュール

スタッフがいつ勤務するかを表す行の一覧です（`staff_schedules`）。予約できる枠は、予約の実装が、サロンの営業時間、このスケジュール、すでにある予約から決めます。スケジュールそのものは顧客に見せません。

| オペレーション（`StaffSchedules`） | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/salons/{salonId}/staff/{id}/schedules` | `admin`、そのサロンの `owner` と `manager`。`staff` は自分のスケジュールだけ |
| 更新（全体の置き換え） | `PUT /api/v1/salons/{salonId}/staff/{id}/schedules` | `admin`、そのサロンの `owner` と `manager` |

- 行のモデルは `StaffSchedule` で、リクエストとレスポンスの両方に使います（Salon の `OpeningHours`、サービスの `ServiceOption` と同じ、行のモデル）。プロパティ名と null の扱いは、`staff_schedules` のカラムと同じです
- 行の `id` は出しません。更新のたびに行を作り直すので、ID は続きません。行を区別するのは、曜日（毎週の行）と日付（単日の行）です
- 以前のコントラクトは、このルートを `availability`（`getAvailability`、`updateAvailability`）と呼んでいました。返すのは空き状況ではなく勤務スケジュールの行で、空き状況（予約できる枠）は予約のコントラクトに `available-slots` として別にあるので、名前を `schedules` に変えました

### 行の種類

行には 2 つの区別があります。

| 区別 | カラム | 規則 |
|---|---|---|
| 毎週の行 | `isRecurring` が true | `dayOfWeek` が必須、`date` は null。毎週その曜日に適用する |
| 単日の行 | `isRecurring` が false | `date` が必須、`dayOfWeek` は null。その日付だけに適用する |
| 勤務する行 | `isAvailable` が true | `startTime` と `endTime` が必須 |
| 休みの行 | `isAvailable` が false | `startTime`、`endTime`、`breakStartTime`、`breakEndTime` はすべて null |

- **1 人のスタッフが持てるのは、毎週の行が曜日ごとに 1 つまで、単日の行が日付ごとに 1 つまで**です。ある日付に適用される行は、多くても 1 つになります（[ある日付に適用される行](#ある日付に適用される行)）
- 毎週の行がない曜日は、勤務しない日です。毎週の休みの行（`isRecurring` と `isAvailable: false`）も置けて、行がないのと同じ意味になります（備考を付けたいときなど）
- 休みの行は、その日に勤務しないことだけを表すので、時刻を持ちません。意味のない時刻を入れさせないために、`startTime` と `endTime` は null 可のカラムです（サロンの営業日カレンダーの、営業しない日と同じ）

### 行の規則

| 項目 | 規則 |
|---|---|
| `dayOfWeek` | 毎週の行では `monday`〜`sunday`。単日の行では null |
| `date` | 単日の行では実在する日付（`YYYY-MM-DD`）。毎週の行では null。過去の日付も指定できる |
| `startTime` / `endTime` | 勤務する行では時刻。`startTime` は `endTime` より前（日付をまたぐ勤務は表せない）。休みの行では null |
| `breakStartTime` / `breakEndTime` | 両方を指定するか、両方 null。指定する場合は、勤務時間の内側（`startTime` < `breakStartTime` < `breakEndTime` < `endTime`）。休みの行では null |
| `notes` | null、または空白だけでない文字列 |
| `isRecurring` / `isAvailable` | 真偽値 |

- 時刻の形式は、サロンの営業日カレンダーと同じです。リクエストは `HH:mm` か `HH:mm:ss`（`00:00`〜`23:59:59`）、レスポンスは `HH:mm:ss` です（`schemas/rules.ts` の `timeOfDay`）
- 休憩は、勤務時間の始まりや終わりに接することはできません。勤務の始まりや終わりに付く「休憩」は、勤務時間を短くして表します。1 日に持てる休憩は 1 つです
- 行の数は、合わせて 373 までです（毎週の 7 行と、1 年分の単日の 366 行）
- 過去の日付の単日の行も受け付けます。読んだ全体を、そのまま送り返せるようにするためです。古い行は、送らなければ消えます。サーバーが自動で消すことはありません
- サロンの営業時間との照合はしません。開店前の準備や閉店後の片付けで、営業時間の外に勤務することがあるからです
- 行ごとの規則は、リクエストの検証（`schemas/staff-schedule.schema.ts`）と、テーブルの CHECK 制約（[DB の制約](#db-の制約)）の両方が守ります

### ある日付に適用される行

`GET` に `date`（`YYYY-MM-DD`）を付けると、その日付に適用される行だけを返します。

1. その日付の単日の行があれば、その行
2. なければ、その日付の曜日の、毎週の行
3. どちらもなければ、空の配列（勤務しない日）

- `data` の要素は 0 個か 1 個です。適用される行が休みの行なら、その行を返します（`isAvailable` が false）。勤務するかどうかは、行の有無ではなく `isAvailable` で見ます
- 単日の行は、その日付について、毎週の行に置き換わります。毎週は月曜に勤務するスタッフの、ある月曜だけの休みや、勤務時間の変更は、単日の行で表します
- この決め方は、ドメインの 1 つの関数（`business-logic/staff-schedule/_shared/applicable-schedule.ts` の `scheduleOn`）に書いてあります。予約の実装は、この関数を使います
- `date` を付けなければ、全体を返します。`date` 以外のパラメーターは 400（`unrecognized_keys`）で、ページネーションはありません（行の数に上限があるため）

### スケジュールの一覧の並び

毎週の行を月曜から日曜の順に、続けて単日の行を日付の古い順に返します。更新のレスポンスも同じ並びで、リクエストに書いた順ではありません。

### スケジュールの更新

- 本文は行の配列（`StaffScheduleUpdateRequest`）で、そのスタッフのスケジュール**全体を置き換えます**。ほかの更新（`PATCH`）と違い、送らなかった行は残りません。メソッドが `PUT` なのは、このためです
- 空の配列を送ると、スケジュールは空になります
- 1 つでも規則に反する行があれば、何も変えずに 400 を返します。エラーの `field` は、行の位置とプロパティ名です（`2.endTime` は 3 行目の `endTime`）。同じ曜日の毎週の行、同じ日付の単日の行が 2 つあるときは、後のほうの行を指します
- 規則に反する行と、重複する行は、1 回の応答でまとめて報告します。行の形が違う場合（プロパティがない、型が違う）は、重複は調べません
- レスポンスは、保存した行を[一覧の並び](#スケジュールの一覧の並び)で返します。時刻は `HH:mm:ss` になります
- 読んだ `data` は、そのまま更新の本文にできます

### 対象のスタッフ

- パスのサロンに属し、削除されていないスタッフです。それ以外は 404（`Staff member <id> was not found`）で、存在しない ID と区別しません（台帳と同じ）
- 無効（`isActive` が false）のスタッフのスケジュールも、読めて、更新できます。復帰の前にシフトを組めるようにするためです
- スタッフを削除しても、スケジュールの行は残ります。削除したスタッフのスケジュールは 404 です

### スケジュールの権限

| ユーザー | 読む | 更新する |
|---|---|---|
| `admin` | できる | できる |
| そのサロンの `owner`、`manager` | できる（自分のものも、ほかのスタッフのものも） | できる（同上） |
| そのサロンの `staff` | 自分のスケジュールだけ | できない |
| ほかのサロンの `owner`・`manager`・`staff`、顧客、スタッフに紐づいていないスタッフ系のアカウント | できない | できない |

- **台帳と違い、`manager` に読み書きを認めます**。シフトを組むのは店長の仕事で、スケジュールは給与も個人の連絡先も含まず、変えてもアカウントの権限は変わりません（`business-logic/staff-schedule/_shared/authorization.ts` の `mayPlanSchedules`）
- **`staff` が読めるのは、自分のスケジュールだけ**です（操作者の範囲の `staffId` が、パスの `id` と同じとき。同じファイルの `mayReadScheduleOf`）。`notes` には、休みの理由など、本人とシフトを組む側だけが知ればよいことを書くからです。スタッフ全員に見せるシフト表は、それを使う画面を作るときに、見せる項目と合わせて決めます
- `staff` は更新できません。希望を出して承認を受ける流れは、コントラクトにありません
- どちらのオペレーションにも認証が要ります

### 確認の順序（スケジュール）

1. アクセストークン（401）
2. `salonId` の形式（400）
3. サロンに対する権限（403）。一覧は `admin` か、そのサロンの `owner`・`manager`・`staff`。更新は `admin` か、そのサロンの `owner`・`manager`
4. スタッフの `id` の形式（400）
5. 誰のスケジュールか（403。一覧で、操作者が `staff` のとき）
6. クエリ（400。一覧）、リクエストの本文（400。更新）
7. サロンの存在（404）
8. スタッフの存在（404）

サロンに対する権限のないユーザーには、スタッフの ID、クエリ、本文が不正でも、サロンやスタッフが存在しなくても 403 を返します。`staff` がほかのスタッフの ID を指定した場合は、そのスタッフが存在しなくても、クエリが不正でも 403 です。読めない本文は、台帳と同じく、この順序の前に答えます。

## スタッフのログインアカウント

スタッフのアカウント（ロール `owner`、`manager`、`staff`）は、**招待**で作ります。台帳を扱えるユーザーが、台帳のスタッフを、ロールを指定して招待し、招待された本人が、メールのリンクから自分でパスワードを決めます。招待する側がパスワードを決めることはありません（本人以外がパスワードを知ることになるため）。

1. 管理者か、そのサロンの `owner` が、スタッフを招待する
2. システムが、台帳のメールアドレス（`staff.email`）に、1 回だけ使えるリンクを送る
3. 本人がリンクを開いて、パスワードを設定する。そのメールアドレスのアカウントが、招待のロールで作られ、スタッフに紐づく

管理者がサロンを作ったあとは、管理者が台帳に最初のスタッフを登録して `owner` として招待し、その `owner` が、ほかのスタッフを登録して招待します。

| オペレーション | ルート | 許可 | 結果 |
|---|---|---|---|
| 招待の取得（`StaffInvitations`） | `GET /api/v1/salons/{salonId}/staff/{id}/invitation` | `admin`、そのサロンの `owner` | 200。招待がなければ 404 |
| 招待の作成 | `POST /api/v1/salons/{salonId}/staff/{id}/invitation` | 同上。`owner` のロールへの招待は `admin` だけ | 201 と `Location`。メールを送る。前の招待があれば、置き換える |
| 招待の取り消し | `DELETE /api/v1/salons/{salonId}/staff/{id}/invitation` | `admin`、そのサロンの `owner` | 204。招待がなければ 404 |
| 招待の確認（`AuthCrud`） | `POST /api/v1/auth/staff-invitation/verify` | 招待のトークンを持つ人（認証なし） | 200。招待の内容を返す。トークンは消費しない |
| 招待の受け入れ（`AuthCrud`） | `POST /api/v1/auth/staff-invitation/accept` | 同上 | 204。アカウントを作る |

- 招待は、スタッフ 1 人につき 1 つまでです。ルートは単数形（`invitation`）で、招待の ID はパスに現れません
- モデルは、`StaffInvitationCreateRequest`（`role`）、`StaffInvitationResponse`（`id`、`staffId`、`email`、`role`、`expiresAt`、`createdAt`）、`AuthStaffInvitationVerifyRequest`（`token`）、`AuthStaffInvitationAcceptRequest`（`token`、`password`）です。ロールの列挙は `SalonRoleType`（`owner`、`manager`、`staff`）で、`customer` と `admin` への招待はありません
- 招待を変更するオペレーション（`PUT`、`PATCH`）はありません。ロールを変えるときは、招待し直します
- 確認と受け入れは、トークンを本文で受け取ります（URL に書くと、ログに残る）。メールのリンクは、ほかのメールと同じく、トークンをフラグメントに置きます（`<PUBLIC_APP_URL>/accept-staff-invitation#token=…`。[メールで送るトークン](./authentication.md#メールで送るトークン)）。確認と受け入れのレスポンスには `Cache-Control: no-store` が付きます
- トークンとそのハッシュ（`tokenHash`）は、どのレスポンスにも出しません。トークンがあるのは、メールの中だけで、DB にあるのはハッシュだけです
- 取得、作成、確認のレスポンスの `links` は、取得と作成が `self`（招待）と `staff`（台帳のスタッフ）、確認が `accept`（受け入れのルート）です

### 招待の規則

- **宛先は、台帳のメールアドレスです。** リクエストでは指定できません（本文に `email` を書くと 400）。招待は、送った宛先を `email` に保存します
- **有効期間は 7 日です**（`business-logic/auth/_shared/mailed-token.ts` の `STAFF_INVITATION`）。スタッフが私用のメールを読むのは、休みの日だけのこともあります。トークンでできるのは、送った宛先のアカウントを 1 つ作ることだけで、招待した側はいつでも取り消せます
- **招待し直すと、前の招待は使えなくなります。** 新しいトークンを発行し、メールを送り直します。ロールを変えて招待し直すこともできます
- **招待できるのは、有効（`isActive`）で、アカウントに紐づいていないスタッフです。** 紐づいているスタッフは 409（`Staff member <id> already has an account`）、無効なスタッフも 409（`Staff member <id> is inactive`）。紐づいているかどうかは、`staff.userId` と、そのスタッフを指す削除されていないアカウント（`users.staffId`）の両方で見ます
- **スタッフが持っている招待を置き換えられるのは、60 秒に 1 回です。** それより短い間隔の招待は 409（`An invitation was mailed to staff member <id> moments ago`）で、前の招待はそのまま残ります。二重の送信と、招待し直しの繰り返しを止めるためのものです。期限の切れた招待は、すぐに置き換えられます
- 期限の切れた招待も、置き換えるか取り消すまで、取得できます（`expiresAt` が過去）。画面が「期限切れ」と表示して、招待し直せるようにするためです
- 招待を取り消すと、行は消えます。そのあとは、60 秒を待たずに招待し直せます（間隔は、スタッフが持っている招待についてのものです）。宛先ごとのメールの数に上限はありません（[メール送信](./email.md#していないこと)）。招待できるのは、ログインした管理者と `owner` だけで、リクエストは、ユーザーの ID と一緒にログに残り、API 全体のレート制限を受けます

### 招待の応答は、宛先にアカウントがあるかどうかで変わらない

招待の作成は、宛先のメールアドレスにすでにアカウントがあっても、同じ応答（201）を返し、同じメールを送ります。応答を変えると、`owner` が、任意のメールアドレスについて、アカウントがあるかどうかを調べられるからです（台帳にそのアドレスでスタッフを登録して、招待すればよい）。登録やパスワードの再設定が、アカウントの有無で応答を変えないのと同じです（[ユーザー登録](./authentication.md#ユーザー登録)）。

アカウントがあることは、確認と受け入れの応答（409）で、トークンを持つ人、つまりそのメールボックスを読める人にだけ伝えます。

### 招待が使える間

招待が使えるのは、発行できる状態が続いている間だけです。確認と受け入れは、次のどれかに当たると、理由を区別せずに 400（`errors[].field` は `token`、`rule` は `invalid_token`）を返します。

- トークンが存在しない、期限が切れた（`expiresAt` の時刻から）、取り消された、新しい招待に置き換えられた、すでに使われた
- スタッフが削除された、無効になった、すでにアカウントに紐づいている
- 台帳のメールアドレスが、招待の宛先と違う（宛先を間違えていて直した場合など）
- サロンが削除された

使えるかどうかは、その時点の状態で決まります。無効にしたスタッフを有効に戻す、メールアドレスを元に戻すなどして、招待したときの状態に戻れば、期限までは、同じトークンがまた使えます。

### 受け入れ

| 宛先のメールアドレスの状態 | 結果 |
|---|---|
| アカウントがない（削除済みだけがある場合を含む） | アカウントを作る |
| 登録しただけで、メールアドレスを確認していないアカウントがある（`unverified` で、顧客にもスタッフにも紐づいていない） | そのアカウントを、招待のアカウントにする。パスワードを置き換え、確認と再設定のトークンを消し、失敗回数とロックを解除し、そのアカウントのセッションを消す |
| それ以外のアカウントがある | 409（コード `3002`、`User with email <メールアドレス> already exists`）。何も書かず、招待は残る |

- 作るアカウントは、`email` が招待の宛先、`role` が招待のロール、`status` が `active`、`emailVerified` が true、`staffId` がそのスタッフです。リンクを受け取れたことが、メールアドレスの確認になります
- 同じトランザクションで、`staff.userId` にアカウントの ID を書き、招待を消します。トークンが使えるのは 1 回です
- **セッションは発行しません。** 受け入れのあと、利用者はログインします。ログインの規則（2 要素認証、試行回数の制限）を 1 か所に保つためです（パスワードの再設定と同じ）
- パスワードの規則は、登録と同じです（[設定するパスワードの規則](./authentication.md#設定するパスワードの規則)）。規則に合わないパスワードは 400 で、招待は残ります
- 未確認のアカウントは、登録した人がそのメールボックスを読めることを、まだ示していません。それを理由に受け入れを断ると、誰でも、他人のメールアドレスで登録しておくだけで、その人がスタッフのアカウントを作れないようにできます。登録が、未確認のアカウントを後の登録で置き換えるのと同じ扱いです
- **1 つのメールアドレスに、アカウントは 1 つ。1 つのアカウントに、ロールは 1 つ。** 顧客としてアカウントを持つ人が、同じメールアドレスでスタッフのアカウントを作ることはできません。別のメールアドレスを台帳に登録して、招待し直します。すでにあるアカウントをスタッフに紐づけるオペレーション（サロンを移ったスタッフなど）は、まだありません
- 受け入れのあと、そのスタッフは招待できません（409）。台帳の `userId` に、アカウントの ID が出ます

### 招待の権限

| ユーザー | 取得、取り消し | 作成 |
|---|---|---|
| `admin` | できる | できる（`owner`、`manager`、`staff`） |
| そのサロンの `owner` | できる（`admin` が作った `owner` への招待も） | `manager` と `staff` への招待だけ。`owner` への招待は 403 |
| そのサロンの `manager`・`staff`、ほかのサロンのユーザー、顧客、スタッフに紐づいていないスタッフ系のアカウント | できない | できない |

- 台帳を扱えるユーザーと同じです（`business-logic/staff-invitation/_shared/authorization.ts` の `mayInviteStaff`）。台帳の操作は、すでにアカウントの権限を変えます（[ログインアカウントへの影響](#ログインアカウントへの影響)）
- **`owner` のロールを与えられるのは、管理者だけです**（同じファイルの `mayGiveRole`）。サロンを運営する人を決めるのは、サロンを登録するプラットフォームの仕事とします（サロンの作成も管理者だけ）。`owner` のセッションを奪った者が、自分のための `owner` のアカウントを作って居座ることも防ぎます
- 確認と受け入れに認証は要りません。アクセストークンを送っても、見ません

### 確認の順序（招待）

サロンの側（取得、作成、取り消し）:

1. アクセストークン（401）
2. `salonId` の形式（400）
3. サロンに対する権限（403）
4. スタッフの `id` の形式（400）
5. リクエストの本文（400。作成）
6. そのロールを与える権限（403。作成）
7. サロンの存在（404）
8. スタッフの存在（404）
9. 招待があること（404。取得、取り消し）
10. スタッフがアカウントに紐づいていないこと、有効であること、前の招待から 60 秒が過ぎていること（409。作成。この順に確認する）

サロンに対する権限のないユーザーには、台帳と同じく、ID や本文が不正でも、サロン、スタッフ、招待が存在しなくても 403 を返します。読めない本文は、この順序の前に答えます。

招待された側（確認、受け入れ）:

1. リクエストの本文（400。トークンと、受け入れではパスワードの長さ）
2. トークンが使えること（400）
3. 宛先にアカウントがないこと（409）
4. パスワードがブロックリストにないこと（400。受け入れ）

どのパスワードを送っても受け入れられない招待には、パスワードを調べる前に、その理由を答えます。

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
| 同じスタッフのスケジュールの更新が同時に届く | どれも 200 で、それぞれのレスポンスは、そのリクエストが保存した行。残るのは、最後に処理された 1 件の内容の全体で、2 つのリクエストの行が混ざることはない |
| スケジュールの更新の最中に、同じスケジュールを読む | 更新の前か後の、どちらかの全体を返す |
| スケジュールの更新と、そのスタッフの削除が同時に届く | 削除は成功する。更新は、先に処理されれば 200、あとなら 404 で、何も書き込まない。削除の処理中に届いた更新は、スタッフの行のロックで削除の完了を待ってから、404 を返す |
| 同じスタッフへの招待が同時に届く | 1 件だけが 201 でメールを送り、ほかは 409（60 秒の間隔） |
| 同じトークンでの受け入れが同時に届く | 1 件だけが 204 で、ほかは 400。アカウントのパスワードは、成功したリクエストのもの |
| 受け入れと、その招待の取り消し、招待し直し、スタッフの無効化、削除、メールアドレスの変更が同時に届く | 先に処理されたほうで決まる。受け入れがあとなら 400 で、アカウントは作られない。受け入れが先なら、取り消しは 404、招待し直しは 409 |
| 受け入れと、同じメールアドレスでの登録が同時に届く | アカウントは 1 つで、招待のアカウントになる |
| 同じメールアドレスを持つ 2 つのサロンのスタッフが、同時に招待を受け入れる | 片方だけが 204 で、もう片方は 409。409 だったほうの招待は残る |
| 2 人の `owner` が、同時に互いを無効化する | どちらも成功することがある（権限は、リクエストを受け付けた時点で判定する）。サロンに有効な `owner` がいなくなるので、管理者が `isActive` を戻すか、別のスタッフを `owner` として招待する |

一意性は DB の一意インデックスと一意制約が決めます。更新と削除は、「削除されていないこと」を WHERE に含めた 1 つの文で行います。

スケジュールの更新は、1 つのトランザクションで、スタッフの行をロックしてから（`SELECT … FOR UPDATE`）、いまの行をすべて消して、新しい行を入れます。同時に届いた更新は、ロックの順に 1 件ずつ処理されます。楽観ロックはなく、あとから処理されたリクエストの内容が残ります（ほかの更新と同じ）。

招待を書く操作（作成、取り消し、受け入れ）も、1 つのトランザクションで、スタッフの行をロックしてから行います。台帳の更新と削除は同じ行を書くので、招待の操作と 1 件ずつ処理されます。受け入れは、ロックを取ったあとで、招待がまだ使えるかを読み直します。アカウントの行は、メールアドレスの一意インデックスに対する 1 つの文（`INSERT … ON CONFLICT … DO UPDATE … WHERE`）で作るので、同じメールアドレスの登録や、別のサロンでの受け入れと重なっても、アカウントは 1 つです。

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

### `staff_schedules`

マイグレーション `202611152100_staff_schedules_rules.sql` で、次のようにしました。

- `startTime` と `endTime` は NULL 可。以前は NOT NULL で、休みの行にも時刻が要った
- CHECK 制約: 毎週の行は曜日があって日付がなく、単日の行は日付があって曜日がない（`staff_schedules_weekly_or_single_day`）、勤務する行は開始と終了があり、休みの行は時刻も休憩もない（`staff_schedules_times_when_available`）、終了は開始より後（`staff_schedules_end_after_start`）、休憩は開始と終了の両方があるか、どちらもない（`staff_schedules_break_has_both_times`）、休憩は勤務時間の内側（`staff_schedules_break_inside_working_hours`）
- 部分一意インデックス: 毎週の行は、スタッフと曜日の組で一意（`staff_schedules_weekly_unique`）。単日の行は、スタッフと日付の組で一意（`staff_schedules_single_day_unique`）
- `notes` が空白だけでないことは、ほかのテーブルの文字列と同じく、リクエストの検証だけが守る

以前の行のうち、休みの行（`isAvailable` が false）は、マイグレーションが時刻と休憩を NULL にします。規則に合う形がそれしかないからです。ほかの制約に反する行（曜日と日付の両方がある行、同じ曜日の 2 つの行、終了が開始より前の行など）があると、マイグレーションは失敗します。どれが正しいかを決められないので、行を直してから、やり直します。

スタッフの行を DB から消すと、そのスケジュールの行も消えます（`staff_schedules_staff_id_fk` の `ON DELETE CASCADE`）。API の削除は論理削除なので、行は消えません。

### `staff_invitations` とアカウントの紐づけ

マイグレーション `202611152300_staff_invitations.sql` で、次のようにしました。

- 列挙型 `salon_role`（`owner`、`manager`、`staff`）。`user_role` には `customer` と `admin` もあり、招待はそれらを与えない
- テーブル `staff_invitations`: `id`、`staffId`、`email`、`role`（`salon_role`）、`tokenHash`、`expiresAt`、`createdAt`。スタッフごとに 1 行（一意制約 `staff_invitations_staff_unique`）、トークンのハッシュは一意（`staff_invitations_token_hash_unique`）、`email` は小文字（CHECK 制約 `staff_invitations_email_lower_case`）。あるのは、いま持っている招待だけで、受け入れと取り消しは行を消す
- **1 人のスタッフに、アカウントは 1 つ**。`users.staffId` は、削除されていないユーザーの間で一意（部分一意インデックス `users_staff_unique`）。`staff.userId` は、削除されていないスタッフの間で一意（`staff_user_unique`。同じカラムのインデックス `idx_staff_user_id` と置き換えた）。`idx_users_staff_id` は残している。`users.staffId` の外部キーが、スタッフの行を消すときに、削除済みを含むユーザーを探すため

削除されていない 2 人のユーザーが同じスタッフを指している、または削除されていない 2 人のスタッフが同じアカウントを指していると、マイグレーションは失敗します（`could not create unique index "users_staff_unique"` など）。どちらが正しいかを決められないので、行を直してから、やり直します。

スタッフの行を DB から消すと、その招待も消えます（`staff_invitations_staff_id_fk` の `ON DELETE CASCADE`）。API の削除は論理削除なので、行は残り、招待は使えなくなるだけです。

### 外部キー

`staff.userId` には外部キーを付けていません。`users.staffId` に外部キーがあり、2 つのテーブルが互いを外部キーで参照すると、DB から生成する `schema.ts` に型が付かなくなるためです（[DB 駆動ドメインモデル](./db-driven-domain-model.md)）。2 つのカラムは、招待の受け入れが、1 つのトランザクションで一緒に書きます。

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/staff.tsp`、`specs/operations/staff-operations.tsp` |
| ドメイン | `backend/packages/domain/src/models/staff.ts`、`schemas/staff.schema.ts`、`mappers/write/staff.mapper.ts`、`mappers/read/staff.mapper.ts`、`repositories/staff.repository.ts`、`business-logic/staff/`（権限と「自分自身のスタッフ情報」の判定は `_shared/authorization.ts`、409 の文言は `_shared/refusals.ts`） |
| ドメイン（プロフィール） | `backend/packages/domain/src/models/staff-profile.ts`、`schemas/staff-profile.schema.ts`、`mappers/read/staff-profile.mapper.ts`、`repositories/staff-profile.repository.ts`、`business-logic/staff-profile/` |
| ドメイン（スケジュール） | `backend/packages/domain/src/models/staff-schedule.ts`、`schemas/staff-schedule.schema.ts`、`mappers/write/staff-schedule.mapper.ts`、`mappers/read/staff-schedule.mapper.ts`、`repositories/staff-schedule.repository.ts`、`business-logic/staff-schedule/`（権限は `_shared/authorization.ts`、ある日付に適用される行は `_shared/applicable-schedule.ts`） |
| ドメイン（招待） | `backend/packages/domain/src/models/staff-invitation.ts`、`schemas/staff-invitation.schema.ts`、`schemas/auth.schema.ts`（確認と受け入れのリクエスト）、`mappers/read/staff-invitation.mapper.ts`、`repositories/staff-invitation.repository.ts`、`business-logic/staff-invitation/`（権限は `_shared/authorization.ts`、409 と 400 の文言は `_shared/refusals.ts`）、`business-logic/auth/_shared/mailed-token.ts`（有効期間と、招待し直せる間隔）、`business-logic/auth/_shared/mails.ts`（メールの文面） |
| ドメイン（共通） | `backend/packages/domain/src/schemas/rules.ts`（`lowerCaseEmail`、`phoneNumber`、`noRepeatedEntries`、`timeOfDay`、`dayOfWeekOf` など）、`business-logic/_shared/existing-salon.ts`（サロンの存在の確認） |
| インフラ | `backend/packages/infrastructure/src/repositories/staff.repository.impl.ts`、`repositories/account.ts`（操作者の範囲。スタッフが有効で削除されていないことを確認する） |
| インフラ（プロフィール） | `backend/packages/infrastructure/src/repositories/staff-profile.repository.impl.ts`（見せるカラムと、見せるスタッフの条件） |
| インフラ（スケジュール） | `backend/packages/infrastructure/src/repositories/staff-schedule.repository.impl.ts`（行の並びと、置き換えのトランザクション） |
| インフラ（招待） | `backend/packages/infrastructure/src/repositories/staff-invitation.repository.impl.ts`（使える招待の条件、スタッフの行のロック、アカウントを作る文） |
| API | `backend/packages/api/src/routes/staff/`、`backend/packages/api/src/routes/staff-profile/`、`backend/packages/api/src/routes/staff-schedule/`、`backend/packages/api/src/routes/staff-invitation/`（サロンの側のルーターと、招待された側のルーター） |
| DB | `backend/packages/database/sql/migrations/202611151800_staff_columns.sql`、`202611152100_staff_schedules_rules.sql`、`202611152300_staff_invitations.sql`、`backend/packages/database/src/scripts/api-consistency-rules.ts`（`Models.StaffProfileResponse`、`Models.StaffSchedule`、`Models.StaffInvitationResponse` が出さないカラムの一覧） |
