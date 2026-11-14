# DB駆動ドメインモデル

## 概要

このシステムでは、データベースのスキーマを唯一の正とする。テーブルの行を表す型は手で書かず、DB から生成した Drizzle スキーマから推論する。API の型は TypeSpec から生成し、2 つをマッパーでつなぐ。

```
SQL マイグレーション                              TypeSpec（specs/）
   │ pnpm db:migrate                                 │ pnpm generate
   ▼                                                 ▼
PostgreSQL ── pnpm db:introspect ──▶ schema.ts     api-types.ts
                                        │ $inferSelect / $inferInsert と DeepRequired
                                        ▼
                                  DbSalon、DbNewSalon ◀── マッパー ──▶ ApiSalonResponse、ApiSalonCreateRequest
```

実装されているのは Salon ドメインだけで、以下の例はすべて Salon のコードである。ほかのドメインは DB スキーマと TypeSpec にあるだけで、モデルもマッパーもない（GitHub issue #91）。

- 型と制約の層ごとの対応、`pnpm check:api-db`: [API-DB型制約マッピング](./api-db-type-constraints-mapping.md)
- TypeSpec の書き方: [TypeSpec API型定義ルール](./typespec-api-type-rules.md)
- レイヤー全体の構成: [バックエンドアーキテクチャガイドライン](./backend-architecture-guidelines.md)

## 原則

1. **テーブルを変えるのは SQL マイグレーションだけ**。`schema.ts` を書き換えて DB に反映する、という方向の操作はない
2. **`schema.ts`、`relations.ts`、`sql/setup.sql` は生成物**。手で編集しない
3. **行の型は推論する**。`DeepRequired<typeof table.$inferSelect>` の形で定義し、テーブルの形を手で書き写さない
4. **カラム名がそのままプロパティ名になる**。カラム名は DB の中でも camelCase で、DB、Drizzle、ドメイン、API のどこでも同じ名前を使う
5. **API を DB に合わせる**。API のプロパティ名と NULL 許可はカラムに従う（[CLAUDE.md](../CLAUDE.md) の API-DB Consistency Rules）

## スキーマ変更のワークフロー

1. `backend/packages/database/sql/migrations/` に、`YYYYMMDDHHMM_description.sql` という名前で SQL マイグレーションを書く
2. `pnpm db:migrate` で適用する
3. `pnpm db:introspect` で `schema.ts` と `relations.ts` を DB から再生成する
4. `pnpm db:generate-sql` で `sql/setup.sql` を `schema.ts` から再生成する
5. マイグレーションと 3 つの生成物を同じコミットに含める

変更が API に現れる場合は、続けて TypeSpec を直し、`pnpm generate` と `pnpm check:api-db` を実行する。

### マイグレーションのルール

- ファイル名は `YYYYMMDDHHMM_description.sql`。ファイル名の順に適用される
- 一度でもどこかの DB に適用したマイグレーションは編集しない。直したいときは新しいマイグレーションを書く
- すでにその変更を含むスキーマに対して実行しても、何も変えないように書く（`IF EXISTS` / `IF NOT EXISTS` や `information_schema` で確認してから変更する）。適用履歴のない DB を最新にできるようにするためで、統合テスト（`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts`）が、全マイグレーションを最新のスキーマに再実行しても `salons` のカラムが変わらないことを確認している
- カラム名は camelCase なので、SQL では二重引用符で囲む

```sql
-- backend/packages/database/sql/migrations/202611140900_salon_list_columns_not_null.sql
-- （DO $$ ... END $$ ブロックの中の抜粋）
IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'salons'
      AND column_name = 'reviewCount'
      AND is_nullable = 'YES'
) THEN
    UPDATE salons SET "reviewCount" = 0 WHERE "reviewCount" IS NULL;
    ALTER TABLE salons ALTER COLUMN "reviewCount" SET NOT NULL;
END IF;
```

### `pnpm db:migrate` の動作

実装は `backend/packages/database/src/scripts/migrations.ts` にある。

- **空の DB**（`public` スキーマにテーブルがない）: `sql/setup.sql` からスキーマを作り、`sql/migrations/` のすべてのファイルを適用済みとして記録する。`setup.sql` はすべてのマイグレーションを反映した状態だからである
- **それ以外の DB**: まだ適用していないマイグレーションを、1 つずつ別のトランザクションで適用する。失敗したマイグレーションはロールバックされ、そこで止まる
- 適用済みのマイグレーションは `migration_history.applied_migrations` に記録される。`public` とは別のスキーマなので、`pnpm db:introspect` や `pnpm db:truncate` の対象にならない
- 同時に実行しても、アドバイザリーロックで順番に処理され、同じマイグレーションが 2 回適用されることはない
- `pnpm db:migrate <file>` は、指定した SQL ファイルを記録せずに実行する。マイグレーションを書いている途中で試すためのもの

`pnpm db:fresh` は、テーブル、enum 型、適用履歴をすべて削除してから `sql/setup.sql` でスキーマを作り直し、すべてのマイグレーションを適用済みとして記録する。

drizzle-kit は、マイグレーションの生成にも適用にも使わない。使うのは `pnpm db:introspect`（`drizzle-kit introspect`）と `pnpm db:generate-sql`（`drizzle-kit export`）だけである。

### `pnpm check:db-schema`

`pnpm db:fresh`、`pnpm db:introspect`、`pnpm db:generate-sql` を順に実行し、`schema.ts`、`relations.ts`、`sql/setup.sql` がコミット済みの内容と違えば失敗する。3 つの生成物が互いに一致していること、つまりどれかが手で編集されたり、一部だけ更新されたりしていないことを確認する検査である。

- CI では `test` ジョブが実行する。`make ci-check` は CI のほかの検査をすべて実行するが、この検査だけは含まない。ローカルでは `make db-check` で別に実行する
- 別になっているのは、接続先の DB を作り直すからである。その DB のデータはすべて消える
- `db:fresh` は `setup.sql` から DB を作るので、マイグレーションを追加しただけで手順 3・4 を実行していない状態は、この検査では検出できない。手順は最後まで実行する

## 生成されるファイル

| ファイル | 生成元 | コマンド |
|---|---|---|
| `backend/packages/database/src/schema.ts` | DB | `pnpm db:introspect` |
| `backend/packages/database/src/relations.ts` | DB | `pnpm db:introspect` |
| `backend/packages/database/sql/setup.sql` | `schema.ts` | `pnpm db:generate-sql` |

`db:introspect` は drizzle-kit の出力をそのまま使わず、宣言や制約の順序を正規化する（`backend/packages/database/src/scripts/canonicalize-introspection.ts`）。そのため、スキーマが変わっていなければ再生成しても差分は出ない。

```typescript
// backend/packages/database/src/schema.ts（抜粋）
export const salons = pgTable(
  'salons',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: varchar({ length: 255 }).notNull(),
    nameKana: varchar({ length: 255 }),
    // ...
    latitude: numeric({ precision: 10, scale: 8 }),
    // ...
    imageUrls: text().array().notNull(),
    // ...
    businessHours: jsonb(),
    // ...
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    // ...
  },
  (table) => [
    // ...
    unique('salons_email_unique').on(table.email),
  ],
)
```

名前の付け方:

- カラム名は DB でも camelCase（`"nameKana"`、`"phoneNumber"`）。`schema.ts` のキーとカラム名が同じなので、カラムの定義に名前の引数はない
- テーブル名、enum 型名、インデックス名は snake_case（`opening_hours`、`day_of_week`、`idx_salons_email`）。テーブルと enum 型は、`schema.ts` では camelCase の名前で export される（`openingHours`、`dayOfWeek`）

## ドメインモデルの型

ドメインのモデルファイルは、`schema.ts` と生成された API の型から型を導くだけで、テーブルの形を書き写さない。

```typescript
// backend/packages/domain/src/models/salon.ts（抜粋）
export const salonIdSchema = z.uuid().brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

// TypeSpec から生成された API の型
export type ApiSalonResponse = components['schemas']['Models.SalonResponse']
export type ApiSalonCreateRequest =
  components['schemas']['Models.SalonCreateRequest']

// Drizzle スキーマから推論した DB の型
export type DbSalon = DeepRequired<typeof salons.$inferSelect>
export type DbOpeningHours = DeepRequired<typeof openingHours.$inferSelect>

type SalonManagedColumn =
  | 'id'
  | 'rating'
  | 'reviewCount'
  | 'cancellationPolicy'
  | 'bookingPolicy'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewSalon = DeepRequired<
  Omit<typeof salons.$inferInsert, SalonManagedColumn>
>
export type DbSalonChanges = Partial<DbNewSalon>
```

- `DeepRequired`（`backend/packages/utility/src/type/typeTools.ts`）は、すべてのキーを必須にする。null を許すかどうかは変えない。`$inferInsert` では NULL 許可のカラムと `DEFAULT` のあるカラムが省略可能なキーになるが、`DeepRequired` によって、新しい行はすべてのカラムの値を明示することになる
- `SalonManagedColumn` は、リクエストから書かないカラムである。DB が値を決めるもの（`id`、タイムスタンプ）、ほかの機能が管理するもの（`rating`、`reviewCount`）、API がまだ公開していないもの（`cancellationPolicy`、`bookingPolicy`）が入る
- `Omit` は `@beauty-salon-backend/utility` のもので、型に存在するキーしか受け付けない。カラムが改名されると、ここで型検査が失敗する
- `DbSalonChanges` は部分更新（PATCH）で変更するカラムを表す
- ID は検証済みの UUID だけが持てるブランド型にする（`SalonId`）
- モデルファイルにビジネスロジックや計算プロパティは置かない

スキーマが変わると、これらの型が変わり、型の合わなくなったマッパー、リポジトリ、テストが型検査で失敗する。

## マッパー

DB の型と API の型は、2 つのマッパーでつなぐ。

| マッパー | 方向 | 場所 |
|---|---|---|
| `SalonWriteMapper` | API のリクエスト → DB の行 | `backend/packages/domain/src/mappers/write/salon.mapper.ts` |
| `SalonReadMapper` | DB の行 → API のレスポンス | `backend/packages/domain/src/mappers/read/salon.mapper.ts` |

- プロパティ名は変えない。変換するのは表現だけである（`numeric` と `number`、`timestamp with time zone` と ISO 8601、`jsonb` の検査）。詳細は [API-DB型制約マッピング](./api-db-type-constraints-mapping.md) を参照
- 入力の検証はマッパーの仕事ではない。ユースケースが Zod スキーマで検証したあとの値を、Write マッパーが受け取る
- Read マッパーは `Result` を返す。保存されている値が API のモデルに合わなければ `database` エラーになる
- null を空文字や既定値に読み替えない

データの流れ:

```
書き込み: リクエストの本文（unknown）
  → ユースケースが Zod スキーマで検証（ApiSalonCreateRequest）
  → SalonWriteMapper（DbNewSalon）
  → ISalonRepository → PostgreSQL

読み出し: PostgreSQL → ISalonRepository（DbSalon と DbOpeningHours[]）
  → ユースケースが SalonReadMapper を呼ぶ（Result<ApiSalonResponse, DomainError>）
  → ハンドラーがレスポンスにする
```

## ほかのドメインに適用するとき

テーブルがすでに `schema.ts` にあるドメイン（`customers`、`staff`、`bookings` など）は、同じ形でモデルを定義する。次は実在するコードではなく、Salon のパターンを当てはめた例である。

```typescript
// 例: backend/packages/domain/src/models/<domain>.ts
export type DbCustomer = DeepRequired<typeof customers.$inferSelect>
export type DbNewCustomer = DeepRequired<
  Omit<typeof customers.$inferInsert, CustomerManagedColumn>
>
```

テーブルやカラムが足りない場合は、先に上のワークフローで追加する。API モデルとテーブルの整合を確認する手順は [API-DB型制約マッピング](./api-db-type-constraints-mapping.md) にある。

## 互換レイヤーを持たない

スキーマを変えるときに、旧い形を残すためのコードは書かない。

- カラムを改名・削除したら、同じ変更の中で TypeSpec、Zod スキーマ、マッパー、テスト、フロントエンドの利用箇所を直す
- 旧いプロパティ名を残すために、マッパーで別名を付けたり値を合成したりしない
- DB の変更は、既存のマイグレーションを書き換えるのではなく、新しいマイグレーションとして追加する

## 関連ドキュメント

- [API-DB型制約マッピング](./api-db-type-constraints-mapping.md)
- [TypeSpec API型定義ルール](./typespec-api-type-rules.md)
- [バックエンドアーキテクチャガイドライン](./backend-architecture-guidelines.md)
- [型生成システム](./type-generation-system.md)
