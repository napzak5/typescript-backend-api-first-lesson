# サービスメニュー

サロンごとのメニュー（サービスと、それを分類するカテゴリー）の規則をまとめます。コントラクトは `specs/operations/service-operations.tsp` と `specs/models/service.tsp`、テーブルは `service_categories`、`services`、`service_options` です。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| カテゴリーの一覧、作成、1 件の取得、更新、削除（`ServiceCategoryCrud`） | 実装済み |
| サービスの一覧、作成、1 件の取得、更新、一括更新、削除（`ServiceCrud`） | 実装済み |

カテゴリーもサービスも 1 つのサロンに属するので、サロン、権限、ID についての規則は共通です。[カテゴリー](#カテゴリー) の節に書き、[サービス](#サービス) の節では違う点だけを書きます。

## カテゴリー

カテゴリーは必ず 1 つのサロンに属し、ほかのサロンへは移せません。そのため、ルートはサロンの下にあります。

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/salons/{salonId}/service-categories` | 認証なし |
| 作成 | `POST /api/v1/salons/{salonId}/service-categories` | `admin`、そのサロンの `owner` / `manager` |
| 1 件の取得 | `GET /api/v1/salons/{salonId}/service-categories/{id}` | 認証なし |
| 更新 | `PATCH /api/v1/salons/{salonId}/service-categories/{id}` | `admin`、そのサロンの `owner` / `manager` |
| 削除 | `DELETE /api/v1/salons/{salonId}/service-categories/{id}` | `admin`、そのサロンの `owner` / `manager` |

- メニューはサロンと同じ公開情報なので、読み取りに認証は要りません（予約の前に閲覧できるようにする）
- 作成するカテゴリーのサロンは、パスの `salonId` です。リクエストの本文に `salonId` はありません
- 変更の権限は、パスの `salonId` だけで判定します。規則は [認証と認可](./authentication.md#サロンの下にあるルートの権限) にあります
- サロンが存在しない、または削除済みのときは、どのオペレーションも 404 です
- パスのサロンに属さないカテゴリーは 404 です。存在しない ID と区別しません
- ID（パスの `salonId` と `id`、本文の `parentId`、クエリの `cursor`）は、英字を大文字で書いても同じ ID です。レスポンスの `data` と `meta` の ID は小文字です（ID のスキーマは `backend/packages/domain/src/shared/identifier.ts` の `uuidSchema` から作る）。`links` は、コレクションまでの部分（`/api/v1/salons/{salonId}/service-categories`）をリクエストのパスに書かれたとおりに返します

### 確認の順序

変更するオペレーション（作成、更新、削除）は、次の順に確認します。

1. アクセストークン（401）
2. `salonId` の形式（400）
3. 権限（403）
4. カテゴリーの `id` の形式（400。更新と削除）
5. リクエストの本文（400。作成と更新）
6. サロンの存在（404）
7. カテゴリーの存在（404）と、親の規則（400）

権限のないユーザーには、カテゴリーの ID や本文が不正でも、サロンが存在しなくても 403 を返します。

### 一覧

- 並びは `displayOrder` の昇順、同じ値の中では `id` の昇順（メニューに表示する順）
- 絞り込みは `isActive`。指定しなければ、無効なカテゴリーも返す
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後のカテゴリーの ID
- **そのサロンのカテゴリーを指していない `cursor` は 400**（`cursor` の `not_found`）。カテゴリーは行ごと削除されるので、指していたカテゴリーが消えると、どこから続けるかが分からない。空のページを返すと、一覧の終わりと区別できない。クライアントは最初のページから読み直す

### 項目の規則

| 項目 | 規則 |
|---|---|
| `name` | 空白だけでない文字列、100 文字以内。同じ名前のカテゴリーがあってもよい |
| `description` | null、または空白だけでない文字列 |
| `parentId` | null（最上位）、または同じサロンのカテゴリーの ID |
| `category` | `ServiceCategoryType` の値。親と同じである必要はない |
| `displayOrder` | 0 以上の整数 |
| `iconUrl` | null、または `http` / `https` の URL、500 文字以内。ホストはドメイン名（`localhost` や IP アドレスは受け付けない） |
| `color` | null、または `#RRGGBB`（16 進 6 桁） |
| `isActive` | 真偽値 |

- 作成ではすべての項目が必須です（null を許す項目は null を指定できる）。更新では指定した項目だけが変わり、1 つも指定しないリクエストは 400 です
- 名前の一意性は確認しません。DB に一意制約がなく、カテゴリーは ID で区別できます
- 階層の深さに上限はありません

### 親子関係

- **親は同じサロンのカテゴリーでなければならない**。存在しない ID も、ほかのサロンのカテゴリーも、400（`parentId` の `not_found`）
- **更新では、自分自身と自分の子孫を親にできない**。400（`parentId` の `circular`）。親をたどって自分に戻る循環を作らないため
- 親の規則に反したリクエストは、ほかの項目も含めて何も変えない
- どちらの規則も DB の制約では保証されないので、リポジトリが確認と書き込みを 1 つのトランザクションで行う
  - 作成は、親の行をロックしてから挿入する。確認から挿入までの間に、親が削除されることはない
  - 親を変える更新は、そのサロンのカテゴリーの行を ID の順にすべてロックしてから、循環を確認する。2 つの更新が同時に「A を B の下へ」「B を A の下へ」と要求しても、成功するのは片方だけで、もう片方は 400 になる
  - 削除も、同じ順に同じロックを取る（子の親が変わるため）

### 削除

- 行を削除します（サロンと違い、論理削除ではない）
- 子のカテゴリーは残り、最上位になります（`parentId` が null）
- そのカテゴリーのサービスは残り、未分類になります（`categoryId` が null）
- どちらも外部キーの `ON DELETE SET NULL` によります

## サービス

サービスは必ず 1 つのサロンに属し、ほかのサロンへは移せません。サービスには 0 個以上のオプション（`service_options` の行）が付きます。

| オペレーション | ルート | 許可 |
|---|---|---|
| 一覧 | `GET /api/v1/salons/{salonId}/services` | 認証なし |
| 作成 | `POST /api/v1/salons/{salonId}/services` | `admin`、そのサロンの `owner` / `manager` |
| 1 件の取得 | `GET /api/v1/salons/{salonId}/services/{id}` | 認証なし |
| 更新 | `PATCH /api/v1/salons/{salonId}/services/{id}` | `admin`、そのサロンの `owner` / `manager` |
| 一括更新 | `PATCH /api/v1/salons/{salonId}/services/bulk` | `admin`、そのサロンの `owner` / `manager` |
| 削除 | `DELETE /api/v1/salons/{salonId}/services/{id}` | `admin`、そのサロンの `owner` / `manager` |

- サロン（パスの `salonId`、存在しないサロンの 404）、権限、ID の大文字と小文字の扱いは、カテゴリーと同じです
- パスのサロンに属さないサービスは 404 です。削除済みのサービスも 404 で、存在しない ID と区別しません
- `/bulk` は `/{id}` より先に登録しています（`backend/packages/api/src/routes/service/index.ts`）。逆だと、`bulk` がサービスの ID として扱われます。`GET /api/v1/salons/{salonId}/services/bulk` は「ID が `bulk` のサービスの取得」なので 400 です

### サービスの確認の順序

変更するオペレーション（作成、更新、一括更新、削除）は、次の順に確認します。

1. アクセストークン（401）
2. `salonId` の形式（400）
3. 権限（403）
4. サービスの `id` の形式（400。更新と削除）
5. リクエストの本文（400。作成、更新、一括更新）
6. リクエストだけで決まる規則（400）。作成では [項目にまたがる規則](#項目にまたがる規則)、更新と一括更新では、パッケージが自分自身を含まないこと
7. サロンの存在（404）
8. 保存されている行で決まること: サービスの存在（404）、カテゴリーとパッケージの規則（400）、更新後の値での項目にまたがる規則（400）、削除できない状態（409）

権限のないユーザーには、サービスの ID や本文が不正でも、サロンやサービスが存在しなくても 403 を返します。

### サービスの一覧

- 並びは `sortOrder` の昇順、同じ値の中では `id` の昇順（メニューに表示する順）。削除済みのサービスは含まない
- 絞り込みは `categoryId` と `isActive`。指定しなければ、無効なサービスも、どの `serviceStatus` のサービスも返す。存在しないカテゴリーやほかのサロンのカテゴリーを指定すると、エラーではなく空の一覧になる
- `limit` は 1〜100（既定は 20）。`cursor` は、前のページの最後のサービスの ID
- **削除済みのサービスを指す `cursor` は、その位置から続ける**。サービスは論理削除で行が残るので、どこから続けるかが分かる（行ごと削除するカテゴリーとの違い）。そのサロンのサービスを指していない `cursor`（存在しない ID、ほかのサロンのサービス）は 400（`cursor` の `not_found`）
- それぞれのサービスに、そのオプションを付けて返す

### サービスの項目の規則

| 項目 | 規則 |
|---|---|
| `categoryId` | null（未分類）、または同じサロンのカテゴリーの ID |
| `name` | 空白だけでない文字列、255 文字以内。同じ名前のサービスがあってもよい |
| `description` | null、または空白だけでない文字列 |
| `shortDescription` | null、または空白だけでない文字列、500 文字以内 |
| `duration` | 1〜1440 の整数（分） |
| `price` | 0 以上の整数 |
| `discountPrice` | null、または 0 以上の整数で、`price` 以下 |
| `taxIncluded`、`requiresConsultation`、`allowOnlineBooking`、`isActive` | 真偽値 |
| `pricingStrategy` | `PricingStrategyType` の値 |
| `serviceStatus` | `ServiceStatusType` の値 |
| `availability` | `ServiceAvailabilityType` の値 |
| `imageUrl` | null、または `http` / `https` の URL、500 文字以内 |
| `imageUrls` | `http` / `https` の URL の配列 |
| `requiredStaffLevel` | null、または `StaffLevelType` の値 |
| `maxBookingsPerDay` | null（上限なし）、または 1 以上の整数 |
| `bookingRequirements` | `BookingRequirementType` の値の配列。同じ値は 1 回だけ |
| `isPackage`、`packageServiceIds` | [パッケージ](#パッケージ) を参照 |
| `tags` | 空白だけでない文字列の配列 |
| `sortOrder` | 0 以上の整数 |
| `options` | [オプション](#オプション) の配列 |

- 作成ではすべての項目が必須です（null を許す項目は null を、配列は空の配列を指定できる）。更新では指定した項目だけが変わり、1 つも指定しないリクエストは 400 です
- 配列（`imageUrls`、`tags`、`packageServiceIds`、`bookingRequirements`、`options`）は null になりません。何もないときは空の配列です
- 整数の上限は、`integer` のカラムの最大値（2147483647）です
- 配列の要素の違反は、`imageUrls.1` のように、要素の番号を付けた項目名で報告します
- `salonId` と `requiredProducts` は、リクエストの項目ではありません（指定すると `unrecognized_keys`）。`services.requiredProducts` は構造が決まっていないカラムで、API からは読み書きしません
- `isActive` と `serviceStatus` は、互いに独立した属性として保存します。どの組み合わせも保存できます。これらの値と、`availability`、`allowOnlineBooking`、`bookingRequirements`、`maxBookingsPerDay`、`requiredStaffLevel` を読むのは、空き枠の一覧だけです。顧客が予約できる枠があるのは、`isActive` が true、`serviceStatus` が `active`、`allowOnlineBooking` が true のサービスです（[予約台帳](./bookings.md#受け付けの設定)）。`requiresConsultation` を読む処理はありません。サロンが予約台帳に入れる予約には、削除されていないサービスなら、どれでも指定できます（[予約台帳](./bookings.md#サロンが台帳に入れる予約はサロンの判断)）。顧客が自分で入れる予約（未実装）も、空き枠の一覧と同じ条件を使います
- 予約の施術明細は、明細を入れた時点（予約の作成、明細の追加）のサービスの料金、割引後料金、所要時間、税込かどうか（`taxIncluded`）を写します。あとでサービスを変えても、削除しても、すでにある予約は変わりません

### オプション

| 項目 | 規則 |
|---|---|
| `name` | 空白だけでない文字列、255 文字以内 |
| `description` | null、または空白だけでない文字列 |
| `optionType` | `ServiceOptionType` の値 |
| `additionalTime` | 0 以上の整数（分） |
| `additionalPrice` | 0 以上の整数 |
| `maxQuantity` | 1 以上の整数 |
| `isRequired`、`isActive` | 真偽値 |
| `sortOrder` | 0 以上の整数 |

- オプションは、サービスのリクエストとレスポンスの `options` に含まれます（`ServiceOption`。サロンの `openingHours` と同じ形）。オプションだけを操作するルートはありません
- 作成は、`options` に書いたオプションをサービスと一緒に保存します
- 更新は、`options` を指定すると、そのサービスのオプションをすべて置き換えます（空の配列なら、すべて削除する）。指定しなければ、オプションは変わりません
- レスポンスの並びは `sortOrder` の昇順、同じ値の中では行の ID の昇順です
- オプションの ID は API に出しません。オプションを ID で指すオペレーションがないためです

### 項目にまたがる規則

2 つの項目の組み合わせで決まる規則は 3 つです（`backend/packages/domain/src/business-logic/service/_shared/rules.ts` の `serviceRuleIssues`）。

| 規則 | 違反 |
|---|---|
| `discountPrice` は `price` 以下 | `discountPrice` の `too_big` |
| `isPackage` が true なら、`packageServiceIds` は 2 件以上 | `packageServiceIds` の `too_small` |
| `isPackage` が false なら、`packageServiceIds` は空 | `packageServiceIds` の `not_allowed` |

- 作成は、リクエストに対して確認します
- **更新は、更新後に保存される値（保存されている値に、リクエストの項目を上書きしたもの）に対して確認します**。リクエストは一部の項目しか持たないので、確認できるのは保存されている行を持つリポジトリで、行をロックしたトランザクションの中で確認します
  - `price` だけを、保存されている `discountPrice` より低くする更新は 400（`discountPrice` の `too_big`）。`price` と `discountPrice` を同時に指定すれば、その組み合わせで判定する
  - パッケージでないサービスに `isPackage: true` だけを指定すると 400（`too_small`）
  - **パッケージをやめる更新は、`isPackage: false` と `packageServiceIds: []` の両方を指定する**。`isPackage: false` だけでは 400（`not_allowed`）。指定していない項目を、サーバーが書き換えることはしない
- 規則に反したリクエストは、ほかの項目もオプションも含めて何も変えません

### パッケージ

パッケージは、同じサロンのサービスを 2〜20 件まとめたサービスです（`isPackage` が true で、`packageServiceIds` が構成サービスの ID）。

| 規則 | 違反 |
|---|---|
| 構成サービスは 2〜20 件 | `packageServiceIds` の `too_small` / `too_big` |
| 同じサービスは 1 回だけ（ID の大文字と小文字は区別しない） | `packageServiceIds.<番号>` の `custom` |
| 構成サービスは、同じサロンの、削除されていないサービス | `packageServiceIds` の `not_found` |
| 構成サービスは、パッケージではない | `packageServiceIds` の `nested_package` |
| パッケージは、自分自身を含まない（更新） | `packageServiceIds` の `circular` |
| パッケージに含まれているサービスは、パッケージにできない | `isPackage` の `contained_in_package` |

- パッケージの入れ子を許さないので、循環は起きません
- 構成サービスは、リクエストの順に保存し、その順に返します
- `packageServiceIds` を指定しない更新（パッケージの価格だけを変える、など）は、構成サービスを変えず、確認もし直しません
- パッケージに含まれているサービスは、削除できません（[サービスの削除](#サービスの削除)）。そのため、パッケージが削除済みのサービスを指すことはありません
- 削除済みのパッケージは、構成サービスを縛りません。パッケージを削除すれば、その構成サービスは削除でき、パッケージにもできます
- 同じサロンのサービスであること、パッケージでないことは DB の制約では保証されないので、リポジトリが確認と書き込みを 1 つのトランザクションで行います（[同時に届いたリクエスト](#同時に届いたリクエスト)）

### 一括更新

`PATCH /bulk` は、`serviceIds` のすべてのサービスに、同じ `updates`（更新と同じ内容）を適用します。

- `serviceIds` は 1〜100 件で、同じ ID は 1 回だけ
- **すべてに適用するか、どれにも適用しないか**のどちらかです
  - 1 件でもそのサロンのサービスでなければ（存在しない、ほかのサロンのもの、削除済み）404。`detail` は、`serviceIds` の順で最初に見つからなかった ID を示す
  - 項目にまたがる規則は、サービスごとに、更新後の値で確認する。1 件でも反すれば 400
- `updates` の中の違反は、`updates.price` のように `updates.` を付けた項目名で報告します
- `updates.packageServiceIds` は、`serviceIds` のサービスを含められません（`updates.packageServiceIds` の `circular`）
- `updates.options` を指定すると、それぞれのサービスのオプションを、同じ内容で置き換えます
- レスポンスの `data.updated` は、更新したサービスの ID で、リクエストの順です。`links` は一覧（`list`）だけです

### サービスの削除

- 論理削除です。行は残り、`deletedAt` が入ります。オプションの行も残ります
- 削除済みのサービスは、取得、更新、削除で 404 になり、一覧にも件数にも含まれず、パッケージの構成サービスにも一括更新の対象にもできません
- **パッケージに含まれているサービスは削除できません**（409）。先に、パッケージの構成サービスから外すか、パッケージを削除します
- **終わっていない予約の施術明細にあるサービスは削除できません**（409）。ステータスが `draft`、`pending`、`confirmed`、`in_progress` の予約です。先に、予約を完了、キャンセル、または削除するか、その明細を予約から削除します（[予約台帳](./bookings.md#予約が参照するものの削除)。予約の最後の明細は削除できません）。パッケージに含まれていることを、先に確かめます。終わった予約（`completed`、`cancelled`、`no_show`）の明細は、削除を妨げません。予約の作成と明細の追加は、サービスの行を共有ロックして書くので、同時に届いた作成（または追加）と削除は、作成が 201 で削除が 409 か、削除が 204 で作成が 400 になります
- パッケージは、構成サービスがあっても削除できます。構成サービスは残ります

### 同時に届いたリクエスト

DB の制約では保証されない規則は、確認と書き込みの間にほかのリクエストが割り込むと破れます。リポジトリ（`backend/packages/infrastructure/src/repositories/service.repository.impl.ts`）は、確認する行をロックしてから確認します。

- カテゴリーを指定する書き込みは、カテゴリーの行をロックする（`FOR KEY SHARE`）。確認から書き込みまでの間に、カテゴリーが削除されることはない
- 複数のサービスの状態で決まる書き込み（更新、一括更新、パッケージの作成、削除）は、対象のサービスと構成サービスの行を、削除済みも含めて、ID の順にロックする（`FOR UPDATE`）
- ロックの順序は、カテゴリー、次にサービス。カテゴリーの削除が「カテゴリーの行、次にそのサービス」の順にロックを取るので、同じ順にしてデッドロックを避ける

その結果、次のことが成り立ちます。

| 同時に届くリクエスト | 結果 |
|---|---|
| 「A を、B を含むパッケージにする」と「B をパッケージにする」 | 成功するのは片方だけ。もう片方は 400（`nested_package` か `contained_in_package`） |
| 「M を含むパッケージを作る」と「M を削除する」 | パッケージができて削除が 409 になるか、削除されてパッケージが 400（`not_found`）になる |
| 「カテゴリー C にサービスを作る（移す）」と「C を削除する」 | サービスができてから未分類になるか、400（`categoryId` の `not_found`）になる |
| 同じサービスを逆の順に指定した 2 つの一括更新 | どちらも成功し、すべてのサービスが同じ一括更新の内容になる |

### DB の制約

行の中だけで確認できる規則は、CHECK 制約にもしています（`backend/packages/database/sql/migrations/202611150300_services_columns.sql`）。API を通らない書き込みも、この範囲では規則を破れません。

| テーブル | 制約 |
|---|---|
| `services` | `duration` は 1 以上。`price` は 0 以上。`discountPrice` は NULL か、0 以上で `price` 以下。`maxBookingsPerDay` は NULL か 1 以上。`isPackage` が真なら `packageServiceIds` は 2〜20 件、偽なら 0 件 |
| `service_options` | `additionalTime` と `additionalPrice` は 0 以上。`maxQuantity` は 1 以上 |

- `imageUrls` と `tags` は `text[]`、`packageServiceIds` は `uuid[]`、`bookingRequirements` は Enum の配列で、どれも NOT NULL です。既定値はなく、書き込む側が必ず配列を指定します
- `pricingStrategy`、`serviceStatus`、`availability`、`service_options.optionType` は NOT NULL です

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/service.tsp`、`specs/operations/service-operations.tsp` |
| ドメイン（カテゴリー） | `backend/packages/domain/src/models/service-category.ts`、`schemas/service-category.schema.ts`、`mappers/read/service-category.mapper.ts`、`repositories/service-category.repository.ts`、`business-logic/service-category/`（権限は `_shared/authorization.ts`、循環の判定は `_shared/hierarchy.ts`） |
| ドメイン（サービス） | `backend/packages/domain/src/models/service.ts`、`schemas/service.schema.ts`、`mappers/write/service.mapper.ts`（リクエストを、サービスの行とオプションの行に分ける）、`mappers/read/service.mapper.ts`、`repositories/service.repository.ts`、`business-logic/service/`（権限は `_shared/authorization.ts`、項目にまたがる規則は `_shared/rules.ts`、リポジトリが返した拒否の理由からエラーへの変換は `_shared/refusals.ts`） |
| ドメイン（共通） | `backend/packages/domain/src/business-logic/_shared/existing-salon.ts`（サロンの存在の確認）、`schemas/rules.ts`（複数のドメインのスキーマが使う規則） |
| インフラ | `backend/packages/infrastructure/src/repositories/service-category.repository.impl.ts`、`service.repository.impl.ts` |
| API | `backend/packages/api/src/routes/service-category/`、`backend/packages/api/src/routes/service/` |
| DB | `backend/packages/database/sql/migrations/202611150300_services_columns.sql`（サービスのカラムと制約） |
