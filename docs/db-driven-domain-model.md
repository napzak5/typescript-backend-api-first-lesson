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

以下の例はすべて、参照実装である Salon のコードである。認証も同じ方法で型を導出している（`backend/packages/domain/src/models/auth.ts` の `DbUser`、`DbSession`、`DbNewSession`）。サロンのサービスカテゴリーとサービスも同じである（`backend/packages/domain/src/models/service-category.ts` の `DbServiceCategory`、`DbNewServiceCategory`、`backend/packages/domain/src/models/service.ts` の `DbService`、`DbNewService`、`DbServiceOption`、`DbNewServiceOption`）。顧客台帳も同じである（`backend/packages/domain/src/models/customer.ts` の `DbCustomer`、`DbNewCustomer`、`DbCustomerChanges`）。スタッフ台帳も同じである（`backend/packages/domain/src/models/staff.ts` の `DbStaff`、`DbNewStaff`、`DbStaffChanges`）。顧客に見せるスタッフのプロフィールは、同じテーブルの一部を読むので、`DbStaff` から見せるカラムを `Pick` した `DbStaffProfile` を使う（`backend/packages/domain/src/models/staff-profile.ts`）。スタッフ本人が書く変更の型（`StaffProfileChanges`）も、`DbStaffProfile` から本人が書けるカラムを `Pick` したものである（`backend/packages/domain/src/repositories/staff-profile.repository.ts`）。スタッフの勤務スケジュールも同じ方法で導出している（`backend/packages/domain/src/models/staff-schedule.ts` の `DbStaffSchedule`、`DbNewStaffSchedule`）。スタッフの招待も同じである（`backend/packages/domain/src/models/staff-invitation.ts` の `DbStaffInvitation`。招待が与えるロールの型 `SalonRole` も、手で書かずに、行の `role` カラムから取っている）。それ以外のドメインは DB スキーマと TypeSpec にあるだけで、モデルもマッパーもない（TypeSpec は DB と一致させてある）。

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
- すでにその変更を含むスキーマに対して実行しても、何も変えないように書く（`IF EXISTS` / `IF NOT EXISTS` や `information_schema` で確認してから変更する）。適用履歴のない DB を最新にできるようにするためで、統合テスト（`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts`）が、`sql/setup.sql` から作った DB に全マイグレーションを再実行しても、スキーマ全体（カラム、enum、インデックス、制約）が変わらないことを確認している
- カラム名は camelCase なので、SQL では二重引用符で囲む
- CHECK 制約は、`CASE` を使わずに 1 つの論理式（`AND`・`OR`・`NOT`）で書く。`pnpm db:introspect` は `CASE` を含む CHECK 制約を `schema.ts` に再現しないので、`schema.ts` と、そこから生成する `sql/setup.sql` が、マイグレーションを適用した DB と一致しなくなる。場合分けは `OR` でつなぐ（`202611150300_services_columns.sql` の `services_package_members`）
- `varchar` 列を値の一覧と比べる CHECK 制約は、列を `text` にしてから比べる（`gender::text IN ('male', …)`）。`gender IN (…)` と書くと、PostgreSQL が保存する式（`… = ANY ((ARRAY['male'::character varying, …])::text[])`）は、その式から作り直したときに別の表記（`ARRAY[('male'::character varying)::text, …]`）になる。マイグレーションを適用した DB と `sql/setup.sql` から作った DB で `schema.ts` が食い違い、`pnpm check:db-schema` が失敗する（`202611150900_customers_columns.sql` の `customers_gender_known`）
- 2 つのテーブルが互いを外部キーで参照する形にしない。`pnpm db:introspect` が生成する `schema.ts` は、外部キーの参照先のテーブルを `foreignKey({ foreignColumns: [users.id] })` のように名指しするので、`customers` と `users` が互いを参照すると、TypeScript がどちらの型も決められない（TS7022。`'customers' implicitly has type 'any' because … it is referenced directly or indirectly in its own initializer`）。`users.customerId` には外部キーがあるので、`customers.userId` には付けていない。逆向きのカラムは、書き込むコードが 1 つのトランザクションでそろえる（`202611151500_customers_user_unique.sql`）。自分自身への参照（`customers.referredBy`）は問題ない

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
- `db:fresh` は `setup.sql` から DB を作るので、マイグレーションを追加しただけで手順 3・4 を実行していない状態は、この検査では検出できない。こちらは統合テスト（`pnpm test:integration`）が検出する。`setup.sql` から作った DB にマイグレーションを適用するとスキーマが変わるからである

## 生成されるファイル

| ファイル | 生成元 | コマンド |
|---|---|---|
| `backend/packages/database/src/schema.ts` | DB | `pnpm db:introspect` |
| `backend/packages/database/src/relations.ts` | DB | `pnpm db:introspect` |
| `backend/packages/database/sql/setup.sql` | `schema.ts` | `pnpm db:generate-sql` |

`db:introspect` は drizzle-kit の出力をそのまま使わず、宣言や制約の順序を正規化する（`backend/packages/database/src/scripts/canonicalize-introspection.ts`）。そのため、スキーマが変わっていなければ再生成しても差分は出ない。

drizzle-kit の出力が DB と食い違う 2 点は、DB のカタログを読んで直す（`backend/packages/database/src/scripts/introspect.ts` の `readCatalogFacts`）。

- **一意制約のカラムの順序**: drizzle-kit はカラムを名前の順に並べる。`pg_constraint` の順序に戻す
- **複数カラムのインデックスの演算子クラス**: drizzle-kit は、1 つ目のカラムの演算子クラスを、すべてのカラムに書く。`staff ("salonId", email)` のインデックスは `"email" uuid_ops` になり、PostgreSQL はこれを拒否するので（`operator class "uuid_ops" does not accept data type character varying`）、`sql/setup.sql` から DB を作れなくなる。`pg_index` の `indclass` から、カラムごとの演算子クラスに戻す。`schema.ts` のインデックスがカタログにない、または演算子クラスの数が合わないときは、`db:introspect` が失敗する

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
    uniqueIndex('salons_email_unique')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`("deletedAt" IS NULL)`),
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
export const salonIdSchema = uuidSchema.brand<'SalonId'>()
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
- `SalonManagedColumn` は、リクエストから書かないカラムである。DB が値を決めるもの（`id`、タイムスタンプ）、ほかの機能が管理するもの（`rating`、`reviewCount`）、API がまだ公開していないもの（`cancellationPolicy`、`bookingPolicy`）が入る。サロンに属するデータでは、行が属するサロンのカラムもリクエストから書かない。サロンはパスで決まるからである（`backend/packages/domain/src/models/service-category.ts` の `ServiceCategoryManagedColumn` に `salonId` がある）
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
- Write マッパーがリクエストを作り替えるのは、リクエストで書けるカラムに表現を変えるものがあるときと、リクエストが複数のテーブルの行を含むときだけである。サービスカテゴリーにはどちらもなく、Write マッパーがない。ユースケースは検証済みのリクエストをそのままリポジトリに渡す。Read マッパー（`backend/packages/domain/src/mappers/read/service-category.mapper.ts`）はあり、タイムスタンプを変換する
- サービスにも表現を変えるカラムはないが、リクエストが `services` の行と、オプション（`service_options`）の行を含む。`ServiceWriteMapper`（`backend/packages/domain/src/mappers/write/service.mapper.ts`）は値を変換せず、この 2 つを分ける
- 顧客にも表現を変えるカラムはなく、リクエストは `customers` の 1 行である。`CustomerWriteMapper`（`backend/packages/domain/src/mappers/write/customer.mapper.ts`）は何も変換せず、リクエストをそのまま行として返す。プロパティ名と表現が行と一致していることを、型検査がここで確認する。Read マッパー（`backend/packages/domain/src/mappers/read/customer.mapper.ts`）は、タイムスタンプのほかに、`jsonb` の `preferences` と、DB では文字列で API では Enum の `gender` を検査する
- 顧客の好み設定（`customer_preferences`）には Write マッパーがない。更新リクエストの 6 つのプロパティは、名前も型もカラムと同じなので、検証した値が、そのまま変更になる。行の型（`backend/packages/domain/src/models/customer-preferences.ts` の `DbCustomerPreferences`）は、行から ID、顧客、日時を除いたもので、行のない顧客には、リポジトリが空の値（`noCustomerPreferences()`）を返す。Read マッパー（`backend/packages/domain/src/mappers/read/customer-preferences.mapper.ts`）は、`jsonb` の `preferredTimeSlots` と `stylePreferences` を検査する
- 予約（`bookings` と `booking_services`）にも Write マッパーがない。作成リクエストが持つのは、誰の予約かと、施術明細のサービス、スタッフ、開始日時だけで、行のほかのカラムは、参照するサービスとサロンの行から決まるからである。書く行の型は、既定値に任せるカラムを残さない（`backend/packages/domain/src/models/booking.ts` の `DbNewBooking`、`DbNewBookingService`、`DbNewBookingStatusChange`。3 つをまとめたものが `BookingWrite`）。リクエストと参照する行から `BookingWrite` を作るのは、純粋な関数 `planBooking`（`backend/packages/domain/src/business-logic/booking/_shared/plan.ts`）で、リポジトリがトランザクションの中で呼ぶ。更新リクエストの 4 つのプロパティは、カラムと同じ名前で、そのまま書く（`DbBookingNotes`）。日時の変更が書く行（`BookingRescheduleWrite`）は、同じく純粋な関数 `planReschedule`（`backend/packages/domain/src/business-logic/booking/_shared/reschedule.ts`）が決める。施術明細の追加が書く明細の行（`DbNewBookingService`）と、追加・削除のたびに書き直す予約のカラム（`DbBookingSummary`。来店日、日時、金額）は、純粋な関数 `planServiceAddition`、`planServiceRemoval`（`backend/packages/domain/src/business-logic/booking/_shared/service-lines.ts`）が決める。明細は、料金が税込かどうか（`taxIncluded`）もサービスから写して持つので、予約の金額は、明細の行だけから算出できる（`_shared/summary.ts` の `summarize`）。Read マッパー（`backend/packages/domain/src/mappers/read/booking.mapper.ts`）は、予約と明細のタイムスタンプを変換し、プロパティを 1 つずつ書き出すので、監査用の `ipAddress` と `userAgent` はレスポンスに出ない
- スタッフには表現を変えるカラムが 1 つある。歩合率（`commissionRate`）は、API では数値、`numeric(5,2)` のカラムでは文字列である。`StaffWriteMapper`（`backend/packages/domain/src/mappers/write/staff.mapper.ts`）はこれだけを変換し、更新では、リクエストにあるときだけ変更に含める。Read マッパー（`backend/packages/domain/src/mappers/read/staff.mapper.ts`）は、歩合率とタイムスタンプを変換し、レスポンスに出さない `awards` と `deletedAt` を落とす。顧客に見せるプロフィールの Read マッパー（`backend/packages/domain/src/mappers/read/staff-profile.mapper.ts`）は、変換するカラムがないので、`Result` ではなく値を返す。スタッフ本人によるプロフィールの更新には、Write マッパーがない。リクエストの 5 つのプロパティは、名前も型もカラムと同じなので、検証した値が、そのまま変更になる。勤務スケジュールのマッパー（`backend/packages/domain/src/mappers/write/staff-schedule.mapper.ts`、`backend/packages/domain/src/mappers/read/staff-schedule.mapper.ts`）も、変換するカラムがない。`date` と `time` のカラムは、API と同じ文字列（`YYYY-MM-DD`、`HH:mm:ss`）で読み書きされるからである。Write マッパーが作る行（`DbNewStaffSchedule`）は `staffId` を持たず、どのスタッフの行かは、リポジトリがパスの ID から決める
- スタッフの招待には Write マッパーがない。リクエストが持つのはロールだけで、行のほかのカラム（スタッフ、宛先、トークンのハッシュ、有効期限）はサーバーが決めるからである。Read マッパー（`backend/packages/domain/src/mappers/read/staff-invitation.mapper.ts`）はタイムスタンプを変換し、プロパティを 1 つずつ書き出すので、トークンのハッシュ（`tokenHash`）はレスポンスに出ない
- スタッフのアカウントには、テーブルも Write マッパーもない。行の型は、`DbUser` から、サロンに見せるカラムを `Pick` したものである（`backend/packages/domain/src/models/staff-account.ts` の `DbStaffAccount`）。リポジトリがそのカラムだけを SELECT するので、パスワードのハッシュなど、認証に使う値は、ドメインの型にも現れない。更新リクエストが持つのはロールだけで、リポジトリにそのまま渡す。Read マッパー（`backend/packages/domain/src/mappers/read/staff-account.mapper.ts`）は、タイムスタンプを変換し、`role` を、カラムの Enum（`user_role`）より狭い API の Enum（`SalonRoleType`）として検証する

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

テーブルがすでに `schema.ts` にあるドメイン（`bookings`、`reviews` など）は、同じ形でモデルを定義する。顧客台帳（`customers`）のモデルが、Salon のパターンをそのまま当てはめた例である。

```typescript
// backend/packages/domain/src/models/customer.ts（抜粋）
export type DbCustomer = DeepRequired<typeof customers.$inferSelect>

type CustomerManagedColumn =
  | 'id'
  | 'userId'
  | 'loyaltyPoints'
  | 'lifetimeValue'
  | 'firstVisitDate'
  | 'lastVisitDate'
  | 'visitCount'
  | 'noShowCount'
  | 'cancellationCount'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewCustomer = DeepRequired<
  Omit<typeof customers.$inferInsert, CustomerManagedColumn>
>
export type DbCustomerChanges = Partial<DbNewCustomer>
```

`CustomerManagedColumn` は、リクエストから書かないカラムである。DB が値を決めるもの（`id`、タイムスタンプ）と `deletedAt` のほかに、ログインアカウントとの紐づけ（`userId`。顧客本人がプロフィールを作るときに、リポジトリの `createProfile` が書く）と、予約や会計から決まる値（ポイント、累計利用金額、来店日、来店・無断キャンセル・キャンセルの回数）が入る。来店日と 3 つの回数は、予約のステータスの操作（完了、キャンセル、無断キャンセルの記録）と、数えていた予約の削除が、顧客の予約から数え直す（[顧客台帳](./customers.md#予約から数える値)）。ポイントと累計利用金額は会計が決める値で、会計は実装がないので、行を作ったときのままである。それ以外のカラムは、リクエストの値をそのまま保存する。

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
