# サービスメニュー

サロンごとのメニュー（サービスと、それを分類するカテゴリー）の規則をまとめます。コントラクトは `specs/operations/service-operations.tsp` と `specs/models/service.tsp`、テーブルは `service_categories` と `services` です。

## 実装範囲

| オペレーション | 状態 |
|---|---|
| カテゴリーの一覧、作成、1 件の取得、更新、削除（`ServiceCategoryCrud`） | 実装済み |
| サービスの一覧、作成、1 件の取得、更新、一括更新、削除（`ServiceCrud`） | 未実装。コントラクトとテーブルだけがある |

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

## 実装の場所

| 層 | ファイル |
|---|---|
| コントラクト | `specs/models/service.tsp`、`specs/operations/service-operations.tsp` |
| ドメイン | `backend/packages/domain/src/models/service-category.ts`、`schemas/service-category.schema.ts`、`mappers/read/service-category.mapper.ts`、`repositories/service-category.repository.ts`、`business-logic/service-category/`（権限は `_shared/authorization.ts`、循環の判定は `_shared/hierarchy.ts`）、`business-logic/_shared/existing-salon.ts`（サロンの存在の確認） |
| インフラ | `backend/packages/infrastructure/src/repositories/service-category.repository.impl.ts` |
| API | `backend/packages/api/src/routes/service-category/` |
