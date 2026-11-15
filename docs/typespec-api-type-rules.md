# TypeSpec API型定義ルール

TypeSpec で API のモデルとオペレーションを定義するときのルールと、その書き方をまとめる。

ルールそのもの（モデル命名、Optional / Nullable、API と DB の一致）の正は [CLAUDE.md](../CLAUDE.md) にある。このドキュメントは、それを TypeSpec でどう書くかを、リファレンス実装である Salon の定義（`specs/models/salon.tsp`、`specs/operations/salon-operations.tsp`）からの抜粋で示す。

| 知りたいこと | 参照先 |
|---|---|
| `specs/` のファイル構成、生成コマンド | [TypeSpecディレクトリ構成ガイド](./typespec-directory-structure.md) |
| PostgreSQL / Drizzle / TypeSpec / Zod の型の対応、`pnpm check:api-db` | [API-DB型制約マッピング](./api-db-type-constraints-mapping.md) |
| DB を正とする考え方、スキーマ変更の手順 | [DB駆動ドメインモデル](./db-driven-domain-model.md) |

## 適用状況

すべてのドメインの TypeSpec が、このルールに従っている。テーブルに対応するモデルは、プロパティ名・null 許可・Enum の値が DB と一致しており、`pnpm check:api-db` が検査する（[API-DB型制約マッピング](./api-db-type-constraints-mapping.md)）。

バックエンドに実装があるのは、Salon とシステムのオペレーション、サロンのサービスカテゴリーとサービスのオペレーション（`ServiceCategoryCrud`、`ServiceCrud`）、サロンのスタッフ台帳の 5 つのオペレーション（`StaffCrud` の `list`、`create`、`get`、`update`、`delete`）、スタッフの勤務スケジュールの 2 つのオペレーション（`StaffSchedules` の `list`、`update`）、スタッフの招待の 3 つのオペレーション（`StaffInvitations` の `get`、`create`、`delete`）、スタッフに紐づいたアカウントの 3 つのオペレーション（`StaffAccounts` の `get`、`update`、`delete`）、顧客に見せるスタッフのプロフィールの 2 つのオペレーション（`StaffProfile` の `list`、`get`）、顧客台帳の 5 つのオペレーション（`CustomerCrud` の `list`、`create`、`get`、`update`、`delete`）、顧客本人のプロフィールの 3 つのオペレーション（`CustomerProfile` の `get`、`create`、`update`）、および認証のすべてのオペレーション（`AuthCrud`、`SessionCrud`、`AdminAuthCrud`。`/api/v1/auth` のログイン、トークンの更新、ログアウト、現在のユーザーの取得、ユーザー登録、メールアドレスの確認、パスワードの再設定と変更、スタッフの招待の確認、受け入れ、参加、2 要素認証、セッションの一覧と無効化、および `/api/v1/admin/auth` の管理者の操作）である。`CustomerCrud` の残りのオペレーション（[顧客台帳](./customers.md#実装範囲)）と、ほかのドメインは TypeSpec と DB スキーマにだけ存在する。スタッフのコントラクトのオペレーションは、すべて実装済みである（[スタッフ台帳](./staff.md#実装範囲)）。ロール・権限、添付ファイル、発注、カルテなど、テーブルがまだない機能の TypeSpec もある（一覧は [API-DB型制約マッピング](./api-db-type-constraints-mapping.md#ルールに載せるモデル載せないモデル)）。

規約から外れている箇所は次のとおりで、いずれも意図したものである。

| 箇所 | 外れている点 | 理由 |
|---|---|---|
| `PUT /api/v1/salons/{salonId}/staff/{id}/schedules` | 更新が `PATCH` ではない | 本文がスケジュールの全行で、スタッフのスケジュールを丸ごと置き換える。送らなかった行は残らない（[勤務スケジュール](./staff.md#スケジュールの更新)） |
| `StaffScheduleUpdateRequest` | `XXXUpdateRequest` なのに、プロパティが Optional のオブジェクトではなく、行（`StaffSchedule`）の配列である | 同じ理由。部分更新ではないので、行のプロパティはすべて必須にする。`@body` のパラメーターに付けた `@maxItems` は OpenAPI に出力されないので、上限は名前付きの配列モデル（`model StaffScheduleUpdateRequest is StaffSchedule[]`）に付ける |
| `StaffSchedule` | レスポンスに使うのに `XXXResponse` という名前ではなく、`id`、`staffId`、タイムスタンプを持たない | リクエストとレスポンスの両方に使う、行のモデルである（Salon の `OpeningHours`、サービスの `ServiceOption` と同じ）。置き換えのたびに行を作り直すので、行の ID は続かない |
| `POST /api/v1/customers/bulk`、`POST /api/v1/treatments/{id}/photos` | 201 に `Location` がない | 複数の行を作成するので、指す先が 1 つに決まらない |
| `DELETE /api/v1/customers/bulk` | 204 ではなく 200 | 削除した ID の一覧を返す |
| `POST /api/v1/auth/register` | 作成なのに 201 と `Location` ではなく、本文なしの 204 | メールアドレスが登録済みかどうかを、応答から判別できないようにする |
| `AttachmentCreateRequest` の `salonId`、`tags` | Create なのに Optional | `multipart/form-data` のパートであり、null を値として送れない |
| `/api/v1/auth/login`、`/api/v1/auth/refresh`、`/api/v1/share/...` | `@useAuth(NoAuth)` なのに 401 を個別に定義している（ログインと再発行は `UnauthenticatedResponse`、共有リンクは `ProblemResponse<401>`） | 認証の失敗そのものがオペレーションの結果である |

## モデル命名

| 用途 | 名前 | Salon での定義 |
|---|---|---|
| 作成 | `{Domain}CreateRequest` | `SalonCreateRequest` |
| 更新 | `{Domain}UpdateRequest` | `SalonUpdateRequest` |
| 一覧・検索 | `{Domain}SearchRequest` | `SalonSearchRequest` |
| レスポンス | `{Domain}Response` | `SalonResponse` |

削除・取得・一括操作の名前（`XXXDeleteRequest`、`XXXGetRequest`、`XXXBulkCreateRequest` など）は CLAUDE.md の一覧に従う。Salon の取得と削除はパスの `id` だけを受け取るので、リクエストモデルを持たない。

ID は `specs/models/_shared/common.tsp` のスカラーを使う。素の `string` で ID を表さない。

```typespec
// specs/models/_shared/common.tsp
@doc("サロン店舗・拠点を識別するためのブランド付きUUID。")
@format("uuid")
scalar SalonId extends string;
```

## Optional と Nullable

| モデル | キー | 値 |
|---|---|---|
| `XXXResponse` | すべて必須 | DB で NULL 許可のカラムだけ `Type \| null` |
| `XXXCreateRequest` | すべて必須 | 同上 |
| `XXXUpdateRequest` | すべて Optional（`?`） | 同上。`null` はクリアを意味する |
| `XXXSearchRequest` | 絞り込み条件は Optional の `@query` | `null` は使わない |

`?` を使えるのは Update と Search だけである。Response と Create、およびそれらに埋め込むサブモデル（`OpeningHours`、`BusinessHours` など）では、未設定を `?` ではなく `Type | null` で表す。カラムに対応するプロパティを `Type | null` にできるのは、そのカラムが NULL を許可している場合に限る。

同じカラムが 3 つのモデルでどう書かれるか（`//` のコメントは説明のために足したもの）:

```typespec
// specs/models/salon.tsp（抜粋）
model SalonResponse {
  @doc("公式名称またはブランド名称")
  name: string;                           // name は NOT NULL

  @doc("名称のカナ表記。未設定の場合はnull")
  nameKana: string | null;                // nameKana は NULL 許可

  @doc("店舗写真や内装画像のURL一覧")
  imageUrls: string[];                    // text[] NOT NULL。空は [] で表す

  @doc("曜日別の通常営業時間。未設定の場合はnull")
  businessHours: BusinessHours[] | null;  // jsonb、NULL 許可
}

model SalonCreateRequest {
  @doc("公式名称またはブランド名称")
  @minLength(1)
  @maxLength(255)
  name: string;

  @doc("名称のカナ表記。未設定の場合はnull")
  @maxLength(255)
  nameKana: string | null;                // キーは必須。値に null を指定できる
}

model SalonUpdateRequest {
  @doc("公式名称またはブランド名称")
  @minLength(1)
  @maxLength(255)
  name?: string;                          // 省略できるが、null にはできない

  @doc("名称のカナ表記。nullでクリア")
  @maxLength(255)
  nameKana?: string | null;
}
```

配列やオブジェクトも同じで、NULL 許可かどうかは DB のカラムで決まる。NOT NULL の配列を `Type[] | null` にしたり、`null` を空文字や既定値に読み替えたりしない。

### 更新（PATCH）での 3 つの状態

更新は `PATCH` で、リクエストに含まれるプロパティだけを変更する。

| リクエスト | 意味 |
|---|---|
| キーなし | そのカラムを変更しない |
| `{ "nameKana": null }` | NULL 許可のカラムをクリアする（NOT NULL のカラムでは検証エラー） |
| `{ "nameKana": "..." }` | その値に更新する |

子テーブルの行を埋め込むプロパティは、指定すると全件を置き換える（`SalonUpdateRequest.openingHours`、`ServiceUpdateRequest.options`）。この区別を実装しているのは `backend/packages/domain/src/mappers/write/salon.mapper.ts` の `fromUpdateRequest` と `backend/packages/domain/src/schemas/salon.schema.ts` の `salonUpdateRequestSchema` で、プロパティをひとつも含まないリクエストは検証エラーになる。

## DB との一致

API モデルは DB のテーブルに合わせて書く。

- プロパティ名はカラム名と同じにする（`websiteUrl`、`alternativePhone`）。画面の都合で改名しない
- NULL 許可は上の表のとおりカラムに合わせる
- 文字列長はカラムの長さと同じ値を `@maxLength` で書く。数値の範囲（`@minValue` / `@maxValue`）は、カラムに収まる範囲で業務上の下限・上限を書く
- DB やほかの機能が値を決めるカラム（`id`、`createdAt`、`rating` など）は Create / Update に含めない
- API に新しいプロパティを足すときは、先にマイグレーションでカラムを足す

```typespec
// specs/models/salon.tsp（SalonCreateRequest の抜粋）
@doc("公式サイトのURL。未設定の場合はnull")
@maxLength(500)                 // websiteUrl は varchar(500)
websiteUrl: string | null;

@doc("消費税率(%)")
@minValue(0)
@maxValue(100)                  // numeric(5, 2) に収まる業務上の範囲
taxRate: float64;
```

名前・NULL 許可・必須 / Optional は `pnpm check:api-db` が検査する。型の対応と検査の詳細は [API-DB型制約マッピング](./api-db-type-constraints-mapping.md) を参照。

## `@doc`

- モデル、プロパティ、Enum、オペレーションのすべてに日本語の `@doc` を付ける
- nullable なプロパティ（`Type | null`）には、null になる条件を必ず書く
- Update モデルでは、null を指定したときの効果を書く（「nullでクリア」）

`@doc` の有無や内容を検査するツールはない。レビューで確認する。

```typespec
// ✅ null になる条件がわかる（specs/models/salon.tsp、specs/models/_shared/common.tsp）
@doc("顧客レビューから算出した平均評価。レビュー未登録の場合はnull")
rating: float32 | null;

@doc("開店時刻。HH:mm:ss形式で返す（指定時はHH:mmも可）。終日休業の場合はnull")
openTime: string | null;

// ❌ nullable なのに条件がない
@doc("平均評価")
rating: float32 | null;
```

モデル自体の `@doc` には、そのモデルが何を表し、キーと null をどう扱うかを書く。

```typespec
// specs/models/salon.tsp
@doc("""
  サロン新規登録リクエスト - 全項目のキーが必須。DB で NULL 許可のカラムのみ null を指定できる
  """)
model SalonCreateRequest {
```

spread（`...Model`）には `@doc` を付けられない（`invalid-decorator-location: Cannot decorate spread property.`）。説明は spread 元のモデルのプロパティに書く。

## Enum

- 名前は `Type` で終える（`DayOfWeekType`、`ServiceCategoryType`）。`specs/` の Enum はすべてこの形になっている
- `@doc` は「1 行目に全体の説明、空行、`値: 日本語名`（必要なら続けて ` - 説明`）を 1 行ずつ」の形で書く

```typespec
// specs/models/_shared/common.tsp
@doc("""
  曜日区分 - 営業日やスケジュール管理で使用される曜日の定義

  monday: 月曜日
  tuesday: 火曜日
  wednesday: 水曜日
  thursday: 木曜日
  friday: 金曜日
  saturday: 土曜日
  sunday: 日曜日
  """)
enum DayOfWeekType {
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday,
}
```

この形にそろえるのは、`backend/packages/generated/scripts/generate-types.ts` が `値:` で始まる行を目印にして、生成する型と Zod スキーマ（`DayOfWeekTypeSchema` など）の JSDoc を整形するからである。

Enum の値は、対応する DB の enum 型（`DayOfWeekType` なら `day_of_week`）と同じにする。実装済みのドメインではマッパーが値をそのまま受け渡すので、値がずれると型検査で失敗する。

DB のカラムが enum 型ではなく、`varchar` と CHECK 制約で値を限っている場合（`customers.gender` と `CustomerGenderType`）は、Enum の値を CHECK 制約の値と同じにする。この組み合わせのずれは、型検査も `pnpm check:api-db` も検出しない。保存されている値は、Read マッパーが Enum のスキーマで検査する（`backend/packages/domain/src/mappers/read/customer.mapper.ts`）。

## オペレーション

```typespec
// specs/operations/salon-operations.tsp（抜粋）
@route("/api/v1/salons")
@tag("Salons")
namespace SalonOperations {
  interface SalonCrud {
    @doc("絞り込み条件とページネーションを指定してサロンを一覧取得します。削除済みのサロンは含みません。")
    @summary("List salons")
    @useAuth(NoAuth)
    @get
    list(...SalonSearchRequest):
      | {
          @statusCode statusCode: 200;
          @body response: CursorPaginationResponse<SalonResponse>;
        }
      | ProblemResponse<400>
      | PublicErrors;

    @doc("サロンを新規登録します。admin だけが実行できます。メールアドレスが既存のサロンと重複する場合は409を返します。")
    @summary("Create a salon")
    @post
    create(@body request: SalonCreateRequest):
      | {
          @statusCode statusCode: 201;
          @header("Location") location: string;
          @body response: ApiResponse<SalonResponse>;
        }
      | ProblemResponse<400>
      | ProblemResponse<409>
      | RequestBodyErrors
      | CommonErrors;
  }
}
```

- モデルは `specs/models/` に定義し、オペレーションのファイルではモデルを定義しない
- 1 件を返すレスポンスは `ApiResponse<XXXResponse>`、一覧は `CursorPaginationResponse<XXXResponse>` で包む
- 作成は 201 と `Location` ヘッダー、削除は本文なしの 204 を返す
- 更新は `@patch` にする（部分更新）
- エラーのレスポンスはすべて `ProblemResponse<ステータス>` にする。本文は `ProblemDetails`、メディアタイプは `application/problem+json` になる。そのオペレーションのユースケースが返すもの（検証エラー 400、未検出 404、重複 409）をステータスごとに列挙する
- どのルートでもサーバーが返すエラーも定義に含める。すべてのオペレーションに、呼び出し方に合うエイリアスを 1 つ加える（下の表）。本文を受け取るオペレーションには `RequestBodyErrors`（413、415）も加える。生成されるクライアントの戻り値はステータスコードのユニオンなので、定義にないステータスはクライアントが扱えない
- 権限の確認があるオペレーションの `@doc` には、実行できるロールを書く（「admin だけが実行できます。」）
- パスの ID は ID スカラーで型付けする（`@path id: SalonId`）
- オペレーションのファイルは `namespace <Domain>Operations { interface <Resource>Crud { ... } }` の形にし、`@route` と `@tag` は namespace に付ける
- 新しいオペレーションは、実装する単位で定義する。使う予定のないオペレーションを先に定義しない（YAGNI）

認証と権限に関するエラーは、オペレーションの呼び出し方で決まる 3 つのエイリアスのどれかで定義する。エイリアスは包含関係にあり、広いものが狭いものを含む。

| オペレーション | 書き方 | 含まれるステータス |
|---|---|---|
| 認証なしで呼べる | `@useAuth(NoAuth)` を付け、`PublicErrors` を加える | 429、500 |
| ログインしていれば誰でも呼べる（ログアウト、自分の情報の取得など） | `SessionErrors` | 401、429、500 |
| ロールやサロンによる権限の確認がある | `CommonErrors` | 401、403、429、500 |

`@useAuth(NoAuth)` を付けていないオペレーションは、API 全体のセキュリティスキーム（`specs/main.tsp` の `@useAuth(BearerAuth)`）によりアクセストークンが必要になる。実装済みのオペレーションでは、サーバーがこのトークンを検証し、権限はユースケースが判定する（[認証と認可](./authentication.md)）。

ステータスコードと、オペレーションの切り方は次のように統一している。

| 場面 | 決まり |
|---|---|
| パスの ID が存在しない | 404 |
| 本文の ID が存在しない、または別のサロン・顧客のもの | 400 |
| 一意制約に違反する | 409 |
| 現在の状態では実行できない操作（完了した予約のキャンセルなど） | 409 |
| 権限のあるユーザーでも、自分自身には実行できない操作（自分のアカウントが属するスタッフ情報の無効化と削除、自分のアカウントのロールの変更と紐づけの解除） | 403 ではなく 409。権限がないのではなく、その操作が成り立たない（[スタッフ台帳](./staff.md#自分自身のスタッフ情報)） |
| 未認証・権限不足 | 401（`UnauthenticatedResponse`、`WWW-Authenticate` ヘッダー付き）と 403（`PermissionDeniedResponse`）。`ProblemResponse<401>` や `ProblemResponse<403>` を個別に並べず、上の表のエイリアス（`SessionErrors`、`CommonErrors`）で定義する。認証なしのオペレーションで 401 を個別に定義するのは、認証の失敗がそのオペレーションの結果である場合（ログイン、トークンの再発行）だけである |
| ほかのサロンに属するリソース | 存在を知らせないよう 404。403 にするのは、権限をパスのサロンだけで判定できる操作である。公開情報であるサロンそのものへの操作と、サロンの下にあるルート（`/api/v1/salons/{salonId}/…`）への操作がこれにあたる。サロンの下にあるルートでは、パスのサロンに属さないリソースを 404 にする（[認証と認可](./authentication.md#サロンの下にあるルートの権限)） |
| サロンに属さず、公開もしないリソース（顧客台帳。`/api/v1/customers`） | ルートをサロンの下に置かない。一覧と 1 件の取得を含めて、どのオペレーションにも `@useAuth(NoAuth)` を付けず、`CommonErrors` を加える。権限は操作者だけで決まり、最初に確認するので、権限のないユーザーには、ID や本文が不正でも、対象が存在しなくても 403 になる。`specs/operations/customer-operations.tsp` では、これを namespace の `@doc` に書いている（[認証と認可](./authentication.md#顧客台帳の権限)） |
| サロンに属し、公開しないリソース（スタッフ台帳。`/api/v1/salons/{salonId}/staff`） | ルートはサロンの下に置く。一覧と 1 件の取得を含めて、どのオペレーションにも `@useAuth(NoAuth)` を付けず、`CommonErrors` を加える。権限はパスのサロンだけで決まり、最初に確認するので、権限のないユーザーには、ID や本文が不正でも、サロンや対象が存在しなくても 403 になる。`specs/operations/staff-operations.tsp` では、これを namespace の `@doc` に書いている（[認証と認可](./authentication.md#サロンの下にあるルートの権限)） |
| 1 つのリソースに属し、全体をまとめて読み書きする行（スタッフの勤務スケジュール。`/api/v1/salons/{salonId}/staff/{id}/schedules`） | ルートは、そのリソースの下に置く。行ごとのルート（`…/schedules/{scheduleId}`）は作らず、`GET` で全体を読み、`PUT` で全体を置き換える。行のモデルは 1 つで、リクエストとレスポンスの両方に使う。行の数には上限を付け（`@maxItems`）、一覧にページネーションを付けない（`ApiResponse<T[]>`）。行ごとの規則と、行どうしの規則（重複）は `@doc` に書き、DB では CHECK 制約と一意インデックスにする（[勤務スケジュール](./staff.md#勤務スケジュール)） |
| 1 つのリソースが 1 つまで持つレコードで、メールで送ったトークンを持つ人にも見せるもの（スタッフの招待。`/api/v1/salons/{salonId}/staff/{id}/invitation`） | ルートは、そのリソースの下に単数形で置き、レコードの ID をパスに入れない。`GET` で読み、`POST` で作り（すでにあれば置き換える。201 と `Location`）、`DELETE` で取り消す。更新のオペレーションは定義しない。作成リクエストは、利用者が決める項目（ロール）だけを持ち、宛先のようにサーバーが決める項目は持たない。トークンを持つ人のオペレーション（確認、受け入れ）は、アカウントがなくても呼べるように、`AuthCrud` に `@useAuth(NoAuth)` で定義し、`PublicErrors` を加える。すでにあるアカウントに何かをするオペレーション（参加）は、トークンに加えてセッションを求める（`@useAuth(NoAuth)` を付けず、`CommonErrors` を加える）。メールで送ったトークンを、アカウントのパスワードの代わりにしない。トークンはパスやクエリではなく本文で受け取る（URL はログに残る）。レスポンスモデルは両方の側で同じものを使い、トークンとそのハッシュは入れない。確認のレスポンスは、次に呼ぶオペレーションを `links` のキー（`accept` か `join`）で示す。`pnpm check:api-db` のルールでは、ハッシュのカラムを `omittedColumns` に挙げる（[スタッフのログインアカウント](./staff.md#スタッフのログインアカウント)） |
| 1 つのリソースに紐づく、ほかのテーブルの行（スタッフに紐づいたアカウント。`/api/v1/salons/{salonId}/staff/{id}/account`） | ルートは、そのリソースの下に単数形で置き、行の ID をパスに入れない。`GET` で読み、`PATCH` で変え、`DELETE` で紐づけを外す（行は消さない）。作るオペレーションは定義しない（作るのは招待の受け入れ）。レスポンスモデルは、そのリソースの持ち主に見せるプロパティだけを持つ（`StaffAccountResponse`。認証に使う値は入れない）。更新リクエストは、持ち主が変えてよいプロパティだけを持つ（`StaffAccountUpdateRequest` の `role`）。プロパティが、カラムの Enum の値の一部だけを取るときは、その値だけの Enum を定義し（`SalonRoleType`）、DB の CHECK 制約で同じ範囲に限り、`pnpm check:api-db` のルールの `narrowed` に挙げる（[紐づいたアカウントの管理](./staff.md#紐づいたアカウントの管理)） |
| 公開しないリソースのうち、誰にでも見せる部分（顧客に見せるスタッフのプロフィール。`/api/v1/staff-profiles`） | 見せるプロパティだけのレスポンスモデル（`StaffProfileResponse`）と、別のインターフェース（`StaffProfile`）を定義する。台帳のレスポンスモデルのプロパティを任意にしたり、操作者によって出し分けたりしない。どのオペレーションにも `@useAuth(NoAuth)` を付け、`PublicErrors` を加える。サロンをまたいで探すので、ルートはサロンの下に置かず、サロンは検索リクエストの任意のフィルターにする（下の「親で絞り込む一覧」）。`pnpm check:api-db` のルールには、出さないカラムを `omittedColumns` に列挙する（[スタッフ台帳](./staff.md#見せる項目)） |
| 状態の遷移（確定、キャンセル、完了、返金など） | ステータスのカラムを更新リクエストで書き換えず、`POST .../{id}/<action>` のアクションにする。リクエストとレスポンスは `XXX<Action>Request` / `XXX<Action>Response` |
| 一括操作 | 1 つのトランザクションで全件を処理する。1 件でも失敗すれば全体を失敗させ、成功のレスポンスに件ごとのエラーを入れない。実装済みの例は、サービスの一括更新（`ServiceCrud` の `bulkUpdate`、`PATCH /api/v1/salons/{salonId}/services/bulk`） |
| 親で絞り込む一覧 | 一覧の検索リクエストに親の ID のフィルターを持たせる。同じ結果を返すネストしたルート（`/customers/{id}/bookings` など）は作らない |
| 親がパスにないリソース | 親の ID は、作成リクエストでは本文のプロパティ、検索リクエストでは任意のフィルターにする。更新リクエストには含めない（行は親を変えない） |
| 親がパスにあるリソース（`/api/v1/salons/{salonId}/service-categories` など） | 親の ID はパスだけで受け取る（`@path salonId: SalonId`）。作成・更新・検索のリクエストには含めず、レスポンスには含める。どのオペレーションにも、親が存在しない場合の 404 を定義する |
| 作成できるリソース | 1 件取得のオペレーションを必ず持つ（`Location` の指す先） |
| 構造の決まっていない jsonb カラム | 公開しない（`omittedColumns` に入れる）。文字列・ID・Enum の配列は `T[]`、オブジェクトは名前付きモデルにする |
| 範囲や形式 | カラムで決まるもの（文字数、数値の桁）は TypeSpec に書く。正規表現 1 つで決まる形式（通貨コード、時刻、色、認証アプリのコード）には `@pattern` を付け、Zod スキーマと同じ規則にする。正規表現だけでは決まらない形式（電話番号の数字の個数など）は `@doc` に書く。どちらの場合も、検証するのは Zod スキーマである |

共通モデルは `specs/models/_shared/common-api-patterns.tsp` にある。

| モデル | 内容 |
|---|---|
| `ApiResponse<T>` | `data`、`meta`（`correlationId` / `timestamp` / `version`）、`links` |
| `CursorPaginationResponse<T>` | `data: T[]`、`meta: PaginationMeta`、`links: PaginationLinks` |
| `PaginationMeta` | `total`、`limit`、`hasMore`、`cursor`、`nextCursor`、`prevCursor` |
| `ProblemDetails` | RFC 9457（旧 RFC 7807）の problem details に `code`、`errors`、`correlationId`、`timestamp` を加えたもの |
| `ProblemResponse<TStatus>` | ステータス `TStatus` で `ProblemDetails` を `application/problem+json` として返すエラーレスポンス |
| `UnauthenticatedResponse` | 401 の `ProblemResponse` に `WWW-Authenticate` ヘッダーを加えたもの |
| `PermissionDeniedResponse` | 403 の `ProblemResponse` |
| `PublicErrors` | `RateLimitedResponse`（429、`Retry-After` ヘッダー付き）と `InternalServerErrorResponse`（500） |
| `SessionErrors` | `UnauthenticatedResponse` と `PublicErrors` |
| `CommonErrors` | `PermissionDeniedResponse` と `SessionErrors` |
| `RequestBodyErrors` | `PayloadTooLargeResponse`（413）と `UnsupportedMediaTypeResponse`（415） |
| `HealthStatus`、`SystemReadyResponse` | `/api/system/health`、`/api/system/ready` のレスポンス |

### 検索リクエスト

一覧の条件は `XXXSearchRequest` に `@query` として定義し、オペレーションの引数に spread する。ページネーションはキーセット方式で、`limit` と `cursor` を持つ。`cursor` には前のページの `meta.nextCursor` を渡す。

```typespec
// specs/models/salon.tsp（抜粋）
model SalonSearchRequest {
  @query
  @doc("1ページあたりの取得件数上限 (1〜100)")
  @minValue(1)
  @maxValue(100)
  limit?: int32 = 20;

  @query
  @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
  cursor?: string;

  @query(#{ explode: true })
  @doc("特徴タグによる絞り込み。指定したタグをすべて持つサロンに一致する")
  features?: string[];
}
```

絞り込み条件の `@doc` には、一致の仕方（完全一致、部分一致、複数指定時の扱い）を書く。

## 変更したあとの確認

```bash
pnpm generate        # OpenAPI、フロントエンドの API クライアント、バックエンドの型を再生成
pnpm format:check    # TypeSpec のフォーマットを含む
pnpm check:api-db    # API モデルと DB スキーマの一致
```

生成物は TypeSpec の変更と同じコミットに含める。CI では `pnpm check:generated` が、生成物がコミット済みの内容と一致することを確認する。

## 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) - 命名規則と API-DB 整合性ルールの正
- [TypeSpecディレクトリ構成ガイド](./typespec-directory-structure.md)
- [API-DB型制約マッピング](./api-db-type-constraints-mapping.md)
- [認証と認可](./authentication.md)
- [型生成システム](./type-generation-system.md)
