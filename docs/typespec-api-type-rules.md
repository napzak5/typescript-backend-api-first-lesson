# TypeSpec API型定義ルール

TypeSpec で API のモデルとオペレーションを定義するときのルールと、その書き方をまとめる。

ルールそのもの（モデル命名、Optional / Nullable、API と DB の一致）の正は [CLAUDE.md](../CLAUDE.md) にある。このドキュメントは、それを TypeSpec でどう書くかを、リファレンス実装である Salon の定義（`specs/models/salon.tsp`、`specs/operations/salon-operations.tsp`）からの抜粋で示す。

| 知りたいこと | 参照先 |
|---|---|
| `specs/` のファイル構成、生成コマンド | [TypeSpecディレクトリ構成ガイド](./typespec-directory-structure.md) |
| PostgreSQL / Drizzle / TypeSpec / Zod の型の対応、`pnpm check:api-db` | [API-DB型制約マッピング](./api-db-type-constraints-mapping.md) |
| DB を正とする考え方、スキーマ変更の手順 | [DB駆動ドメインモデル](./db-driven-domain-model.md) |

## 適用状況

このルールをすべて満たしているのは Salon と、Salon が使う共通モデルだけである。ほかのドメイン（customer、staff、booking、payment など）は TypeSpec と DB スキーマにだけ存在し、バックエンドの実装はない（GitHub issue #91）。それらの TypeSpec には旧い形が残っている。

- `CreateStaffRequest`、`UpdateServiceRequest` のような旧い語順のモデル名
- `Customer`、`Booking` のように、エンティティ名そのままのレスポンスモデル
- DB にカラムのないプロパティ（`pnpm check:api-db` のベースラインに記録されている）

ドメインを実装するときは、最初にその TypeSpec を Salon と同じ形に直す。

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

子テーブルの行を埋め込むプロパティは、指定すると全件を置き換える（`SalonUpdateRequest.openingHours`）。この区別を実装しているのは `backend/packages/domain/src/mappers/write/salon.mapper.ts` の `fromUpdateRequest` と `backend/packages/domain/src/schemas/salon.schema.ts` の `salonUpdateRequestSchema` で、プロパティをひとつも含まないリクエストは検証エラーになる。

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

## オペレーション

```typespec
// specs/operations/salon-operations.tsp（抜粋）
@route("/api/v1/salons")
@tag("Salons")
namespace SalonOperations {
  interface SalonCrud {
    @doc("絞り込み条件とページネーションを指定してサロンを一覧取得します。削除済みのサロンは含みません。")
    @summary("List salons")
    @get
    list(...SalonSearchRequest):
      | {
          @statusCode statusCode: 200;
          @body response: CursorPaginationResponse<SalonResponse>;
        }
      | {
          @statusCode statusCode: 400;
          @body error: ProblemDetails;
        };

    @doc("サロンを新規登録します。メールアドレスが既存のサロンと重複する場合は409を返します。")
    @summary("Create a salon")
    @post
    create(@body request: SalonCreateRequest):
      | {
          @statusCode statusCode: 201;
          @header("Location") location: string;
          @body response: ApiResponse<SalonResponse>;
        }
      | {
          @statusCode statusCode: 400;
          @body error: ProblemDetails;
        }
      | {
          @statusCode statusCode: 409;
          @body error: ProblemDetails;
        };
  }
}
```

- モデルは `specs/models/` に定義し、オペレーションのファイルではモデルを定義しない
- 1 件を返すレスポンスは `ApiResponse<XXXResponse>`、一覧は `CursorPaginationResponse<XXXResponse>` で包む
- 作成は 201 と `Location` ヘッダー、削除は本文なしの 204 を返す
- 更新は `@patch` にする（部分更新）
- エラーのレスポンスはすべて `ProblemDetails` にする。そのオペレーションのユースケースが返すもの（検証エラー 400、未検出 404、重複 409）をステータスごとに列挙する
- パスの ID は ID スカラーで型付けする（`@path id: SalonId`）
- Salon では、定義したオペレーションがすべて実装されている。実装しないオペレーションを先に定義しない（YAGNI）

共通モデルは `specs/models/_shared/common-api-patterns.tsp` にある。

| モデル | 内容 |
|---|---|
| `ApiResponse<T>` | `data`、`meta`（`correlationId` / `timestamp` / `version`）、`links` |
| `CursorPaginationResponse<T>` | `data: T[]`、`meta: PaginationMeta`、`links: PaginationLinks` |
| `PaginationMeta` | `total`、`limit`、`hasMore`、`cursor`、`nextCursor`、`prevCursor` |
| `ProblemDetails` | RFC 9457（旧 RFC 7807）の problem details に `code`、`errors`、`correlationId`、`timestamp` を加えたもの |
| `HealthStatus`、`SystemReadyResponse` | `/api/system/health`、`/api/system/ready` のレスポンス |

### 検索リクエスト

一覧の条件は `XXXSearchRequest` に `@query` として定義し、オペレーションの引数に spread する。ページネーションはキーセット方式で、`limit` と `cursor` を持つ。`cursor` には前のページの `meta.nextCursor` を渡す。

```typespec
// specs/models/salon.tsp（抜粋）
model SalonSearchRequest {
  #suppress "@typespec/http/metadata-ignored" "Treated as queryParams"
  @query
  @doc("1ページあたりの取得件数上限 (1〜100)")
  @minValue(1)
  @maxValue(100)
  limit?: int32 = 20;

  #suppress "@typespec/http/metadata-ignored" "Treated as queryParams"
  @query
  @doc("取得開始位置を示すカーソル。前回レスポンスの `meta.nextCursor` を指定する")
  cursor?: string;

  #suppress "@typespec/http/metadata-ignored" "Treated as queryParams"
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
- [型生成システム](./type-generation-system.md)
