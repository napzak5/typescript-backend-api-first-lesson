# API-DB型制約マッピング

DB のカラムの型と制約が、Drizzle スキーマ、TypeSpec、生成された型、Zod スキーマのそれぞれでどう表されるかの対応表と、その一致を機械的に検査する `pnpm check:api-db` の説明。

対応表は、実装済みの Salon ドメイン（`salons` と `opening_hours`）が実際に行っていることを書いている。認証（`users` と `sessions`）も同じ対応に従っており、Read マッパー（`backend/packages/domain/src/mappers/read/user.mapper.ts`、`session.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/auth.schema.ts`）を持つ。Write マッパー（`backend/packages/domain/src/mappers/write/user.mapper.ts`、`session.mapper.ts`）は、行を作らず、リクエストが示した値をそのまま返す（理由は[表現の変換](#表現の変換)）。サロンのサービスカテゴリー（`service_categories`）も同じで、Read マッパー（`backend/packages/domain/src/mappers/read/service-category.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/service-category.schema.ts`）を持つ。Write マッパー（`backend/packages/domain/src/mappers/write/service-category.mapper.ts`）は、リクエストをそのまま行として返す（理由は[表現の変換](#表現の変換)）。サロンのサービス（`services` と `service_options`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/service.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/service.schema.ts`）を持つ。Write マッパー（`backend/packages/domain/src/mappers/write/service.mapper.ts`）もあるが、値は変換しない（これも[表現の変換](#表現の変換)）。顧客台帳（`customers`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/customer.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/customer.schema.ts`）を持つ。Write マッパー（`backend/packages/domain/src/mappers/write/customer.mapper.ts`）は、リクエストをそのまま行として返す（これも[表現の変換](#表現の変換)）。顧客の好み設定（`customer_preferences`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/customer-preferences.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/customer-preferences.schema.ts`）を持つ。Write マッパー（`backend/packages/domain/src/mappers/write/customer-preferences.mapper.ts`）は、リクエストをそのまま変更として返す（これも[表現の変換](#表現の変換)）。レスポンスは、行の ID、顧客、日時を返さないので、`pnpm check:api-db` のルールは、それらを `omittedColumns` に挙げている。スタッフ台帳（`staff`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/staff.mapper.ts`）、リクエストの Zod スキーマ（`backend/packages/domain/src/schemas/staff.schema.ts`）、歩合率（`numeric` の `commissionRate`）を文字列にする Write マッパー（`backend/packages/domain/src/mappers/write/staff.mapper.ts`）を持つ。顧客に見せるスタッフのプロフィール（`StaffProfileResponse`）は、同じ `staff` の行の一部を、同じプロパティ名と null の扱いで返す。変換するカラムがないので、Read マッパー（`backend/packages/domain/src/mappers/read/staff-profile.mapper.ts`）は値をそのまま返す。スタッフ本人が書くリクエスト（`StaffProfileUpdateRequest`）は、同じ行のうち 5 つのカラムを、同じプロパティ名と型で書く。Zod スキーマ（`backend/packages/domain/src/schemas/staff-profile.schema.ts`）は、台帳のスキーマからその 5 つを選んだもので、Write マッパー（`backend/packages/domain/src/mappers/write/staff-profile.mapper.ts`）は、リクエストをそのまま変更として返す。スタッフの勤務スケジュール（`staff_schedules`）も同じ対応に従う。行のモデル（`StaffSchedule`）は、リクエストとレスポンスの両方に使うので、`pnpm check:api-db` はレスポンスのルール（すべて必須で、NULL 可のカラムだけ `Type | null`）で照合する。Zod スキーマ（`backend/packages/domain/src/schemas/staff-schedule.schema.ts`）は、テーブルの CHECK 制約と部分一意インデックスが守る規則を、リクエストの段階でも確かめる。スタッフの招待（`staff_invitations`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/staff-invitation.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/staff-invitation.schema.ts`）を持つ。レスポンスはトークンのハッシュ（`tokenHash`）を返さず、作成リクエストが持つのはロール（enum 型 `salon_role` と `SalonRoleType`）だけなので、`pnpm check:api-db` のルールは、それ以外のカラムを `omittedColumns` に挙げている。スタッフに紐づいたアカウント（`StaffAccountResponse`、`StaffAccountUpdateRequest`）は、`users` の行の一部を、同じプロパティ名と null の扱いで返す。Read マッパー（`backend/packages/domain/src/mappers/read/staff-account.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/staff-account.schema.ts`）を持ち、ルールは、認証に使うカラムを `omittedColumns` に、Enum の値の一部だけを取る `role` を `narrowed` に挙げている。予約（`bookings` と `booking_services`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/booking.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/booking.schema.ts`）を持つ。作成リクエストが持つのは、誰の予約かと、施術明細のサービス、スタッフ、開始日時だけで、ほかのカラムはシステムが決める。`pnpm check:api-db` のルールは、それらのカラムを `omittedColumns` に挙げている。明細の追加のリクエストも、作成の明細と同じモデル（`BookingServiceCreateRequest`）で、サービスから写すカラム（`price`、`duration`、`taxIncluded` など）は、同じく `omittedColumns` にある。Write マッパー（`backend/packages/domain/src/mappers/write/booking.mapper.ts`）は、行を作らない（理由は[表現の変換](#表現の変換)）。売上（`sales` と `sales_details`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/sale.mapper.ts`）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/sale.schema.ts`）を持つ。作成リクエストが書かないカラム（売上番号、会計日、売上の金額、支払い状態、取り消しの項目）は、`omittedColumns` にある。Write マッパー（`backend/packages/domain/src/mappers/write/sale.mapper.ts`）は、行を作らない（理由は[表現の変換](#表現の変換)）。サロンの支払い方法（`payment_methods`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/payment-method.mapper.ts`）、Write マッパー（`backend/packages/domain/src/mappers/write/payment-method.mapper.ts`）、リクエストの Zod スキーマ（`backend/packages/domain/src/schemas/payment-method.schema.ts`）を持つ。API が読みも書きもしないカラム（`processorConfig`）は、どのモデルのルールでも `omittedColumns` にあり、作成のあとで変えられない `method` は、更新リクエストのルールの `omittedColumns` にある。売上の決済取引（`payment_transactions`）も同じ対応に従い、Read マッパー（`backend/packages/domain/src/mappers/read/payment.mapper.ts`。売上の Read マッパーも使う）とリクエストの Zod スキーマ（`backend/packages/domain/src/schemas/payment.schema.ts`）を持つ。支払いのリクエスト（`SaleProcessRequest`）が書かないカラム（取引番号、ステータス、決済代行会社とエラーの項目、日時、返金の項目、`metadata`）は、`omittedColumns` にある。返金のリクエスト（`PaymentRefundRequest`）は、既存の行の一部を書き換えるアクションなので、ルールに載せない（[ルールに載せるモデル、載せないモデル](#ルールに載せるモデル載せないモデル)）。Write マッパー（`backend/packages/domain/src/mappers/write/payment.mapper.ts`）は、行を作らず、`planPayment` と `planRefund` が書く値を決める。ここに挙げていないドメインも、同じ対応に従っている。Read マッパーは `backend/packages/domain/src/mappers/read/`、リクエストの Zod スキーマは `backend/packages/domain/src/schemas/` に、ドメインごとのファイルがあり、`pnpm check:api-db` のルールは `backend/packages/database/src/scripts/api-consistency-rules.ts` にある。

- ルールそのもの（プロパティ名 = カラム名、NULL 許可の一致、Optional の制約）: [CLAUDE.md](../CLAUDE.md)
- TypeSpec での書き方: [TypeSpec API型定義ルール](./typespec-api-type-rules.md)
- DB を正とする考え方とスキーマ変更の手順: [DB駆動ドメインモデル](./db-driven-domain-model.md)

## 層と定義の場所

| 層 | 場所 | 作り方 |
|---|---|---|
| PostgreSQL | `backend/packages/database/sql/migrations/`、`backend/packages/database/sql/setup.sql` | SQL マイグレーションを書く |
| Drizzle スキーマ | `backend/packages/database/src/schema.ts` | `pnpm db:introspect` が DB から生成する |
| DB の行の型 | `backend/packages/domain/src/models/salon.ts` | `DeepRequired<typeof salons.$inferSelect>` で推論する |
| API 定義 | `specs/models/salon.tsp` | TypeSpec を書く |
| API の型 | `backend/packages/generated/src/api-types.ts` | `pnpm generate` が OpenAPI から生成する |
| リクエストの検証 | `backend/packages/domain/src/schemas/salon.schema.ts` | Zod スキーマを書き、API の型と `satisfies` で突き合わせる |
| 表現の変換 | `backend/packages/domain/src/mappers/write/salon.mapper.ts`、`backend/packages/domain/src/mappers/read/salon.mapper.ts` | マッパーを書く |

## 型の対応

| PostgreSQL | `schema.ts` | DB の行の型 | TypeSpec | API の型（OpenAPI） | 例 |
|---|---|---|---|---|---|
| `uuid` | `uuid()` | `string` | ID スカラー（`SalonId`） | `string`（`format: uuid`） | `salons.id` |
| `varchar(n)` | `varchar({ length: n })` | `string` | `string` と `@maxLength(n)` | `string` | `name` |
| `text` | `text()` | `string` | `string` | `string` | `description` |
| `text[]` | `text().array()` | `string[]` | `string[]` | `string[]` | `imageUrls` |
| `uuid[]` | `uuid().array()` | `string[]` | ID スカラーの配列（`ServiceId[]`） | `string[]`（要素は `format: uuid`） | `services.packageServiceIds`、`customer_preferences.avoidStaffIds` |
| `integer` | `integer()` | `number` | `int32` | `number`（`format: int32`） | `reviewCount` |
| `boolean` | `boolean()` | `boolean` | `boolean` | `boolean` | `isActive` |
| `numeric(p, s)` | `numeric({ precision: p, scale: s })` | `string` | `float64` / `float32` | `number`（`format: double` / `float`） | `latitude`、`taxRate`、`rating` |
| `jsonb` | `jsonb()` | `unknown` | モデル（`BusinessHours[]`） | そのモデルの型 | `businessHours` |
| `timestamp with time zone` | `timestamp({ withTimezone: true, mode: 'string' })` | `string`（PostgreSQL のテキスト形式） | `utcDateTime` | `string`（`format: date-time`） | `createdAt` |
| `date` | `date()` | `string`（`YYYY-MM-DD`） | `plainDate` | `string`（`format: date`） | `opening_hours.date` |
| `time` | `time()` | `string`（`HH:mm:ss`） | `string` | `string` | `opening_hours.openTime` |
| enum 型（`day_of_week`） | `pgEnum('day_of_week', [...])` | 値のユニオン | `enum DayOfWeekType` | 値のユニオン | `opening_hours.dayOfWeek` |
| enum 型の配列（`booking_requirement[]`） | `bookingRequirement().array()` | 値のユニオンの配列 | `BookingRequirementType[]` | 値のユニオンの配列 | `services.bookingRequirements` |

NULL 許可のカラムは、どの層でも null を許す形になる: `schema.ts` では `.notNull()` なし、行の型と API の型では `| null`、TypeSpec では `Type | null`、OpenAPI では `nullable: true`、Zod では `.nullable()`。

カラム名は DB の中でも camelCase（`"nameKana"`、`"websiteUrl"`）なので、DB から API までプロパティ名は 1 種類しかない。

### リクエストを検証する Zod スキーマ

リクエストの値は、ユースケースが `backend/packages/domain/src/schemas/salon.schema.ts` の Zod スキーマで検証する。カラムの型ごとに、次のスキーマを使っている。

| PostgreSQL | Zod | 例 |
|---|---|---|
| `uuid`（ID） | `uuidSchema.brand<'SalonId'>()`（`models/salon.ts` の `salonIdSchema`。`uuidSchema` は `shared/identifier.ts` にあり、UUID を検証して小文字にそろえる） | パスの `id`、`cursor` |
| `varchar(n)` | `nonBlankText.max(n)`。内容に応じて `z.email().max(n)`、`z.httpUrl().max(n)`、`phoneNumber`（`schemas/rules.ts`） | `name`、`email`、`websiteUrl`、`phoneNumber` |
| `text` | `nonBlankText`（空白だけの文字列を拒否する `z.string()`） | `description` |
| `text[]` | `z.array(nonBlankText)`、`z.array(z.httpUrl())` | `features`、`imageUrls` |
| `boolean` | `z.boolean()` | `isActive` |
| `numeric(p, s)` | `z.number().min().max()` | `latitude`、`taxRate` |
| `jsonb` | モデルの形を表すスキーマ（`businessHoursListSchema`） | `businessHours` |
| `date` | `calendarDate`（`schemas/rules.ts`。`YYYY-MM-DD` で、[範囲](#リクエストの日付と日時の範囲) の中の日付） | `openingHours` の `date` |
| `time` | `timeOfDay`（`schemas/rules.ts`。`HH:mm` または `HH:mm:ss`） | `openingHours` の `openTime` |
| enum 型 | 生成された `DayOfWeekTypeSchema`（`@beauty-salon-backend/generated`） | `openingHours` の `dayOfWeek` |

#### リクエストの日付と日時の範囲

リクエストの日付（`YYYY-MM-DD`）と日時（UTC）は、すべてのドメインで 1900-01-01 から 2999-12-31 までに限る。日時は、UTC で書いた日付で比べる。範囲の前は 400（`too_small`、`Must not be earlier than 1900-01-01`）、後は 400（`too_big`、`Must not be later than 2999-12-31`）である。

- 理由: Zod の `z.iso.date()` と `z.iso.datetime()` は 0 年（`0000-01-01`）を受け付けるが、PostgreSQL の `date` と `timestamp with time zone` は 0 年を持てない。1 万年以降の日時も、`toISOString()` が書く形（`+010000-01-01T00:00:00.000Z`）では読めない。どちらも、DB に渡すと 500 になる。範囲の端の日付は、サロンのタイムゾーンの日付（1888 年より前の Asia/Tokyo は +09:18:59）や前後の日に直しても、PostgreSQL が持てる範囲に収まる
- 規則は `backend/packages/domain/src/schemas/rules.ts` の 3 つで、DB が読むリクエストの日付と日時は、すべてこれを使う: `calendarDate`（日付）、`momentOfRequest`（書かれたままの日時）、`momentInUtc`（`toISOString()` の形にそろえる日時）。予約の分単位の日時（`minuteInUtc`）は `momentOfRequest` から作る
- 形の誤った日付（`2026-02-30`）は、`invalid_format` だけを返す
- 対象外は、サロンの営業時間（`businessHours`、jsonb）の `effectivePeriod` である。DB は日付として読まず、コードが比べるだけなので 500 にならない。保存済みの値も読むたびに同じスキーマで確かめるので、範囲を足すと、範囲の外の値を持つサロンが読めなくなる
- 顧客の生年月日（`birthDate`）は、この範囲に加えて、未来の日付を拒む（[顧客](./customers.md)）

`integer` と `timestamp with time zone` のカラムは、Salon ではリクエストに含まれない（`reviewCount`、`createdAt` など）。Salon にないカラムの型は、サービスカテゴリーとサービスのスキーマ（`backend/packages/domain/src/schemas/service-category.schema.ts`、`backend/packages/domain/src/schemas/service.schema.ts`）が次のように検証する。

| PostgreSQL | Zod | 例 |
|---|---|---|
| `integer` | `z.number().int().min(下限).max(MAX_INTEGER)`。`MAX_INTEGER` は `integer` のカラムの最大値。業務上の上限があるカラムは、その値を上限にする（`duration` は 1440） | サービスカテゴリーの `displayOrder`、サービスの `duration`、`price`、`discountPrice`、`maxBookingsPerDay`、`sortOrder`、オプションの `additionalTime`、`additionalPrice`、`maxQuantity`、`sortOrder` |
| `uuid[]` | ID のスキーマの配列（`z.array(serviceIdSchema)`）。同じ値を重ねて指定できない配列には `.check(noRepeatedEntries)` を付ける | `packageServiceIds`、顧客の好み設定の `avoidStaffIds` |
| enum 型の配列 | 生成された enum のスキーマの配列（`z.array(BookingRequirementTypeSchema)`）と `.check(noRepeatedEntries)` | `bookingRequirements` |

顧客のスキーマ（`backend/packages/domain/src/schemas/customer.schema.ts`）には、`varchar(n)` のカラムのうち、DB が CHECK 制約で値を限っているものがある。

| PostgreSQL | Zod | 例 |
|---|---|---|
| `varchar(255)`。小文字で保存するメールアドレス（CHECK 制約 `customers_email_lower_case`） | `lowerCaseEmail`（メールアドレスとして検証し、小文字にそろえる） | 顧客の `email` |
| `varchar(20)`。決まった値のどれか（CHECK 制約 `customers_gender_known`）で、API では Enum | 生成された Enum のスキーマ（`CustomerGenderTypeSchema`） | 顧客の `gender` |

`nonBlankText` は Salon だけのものではない。複数のドメインのスキーマが共通で使うルール（`nonBlankText`、`lowerCaseEmail`、`phoneNumber`、`timeSlot`、`MAX_INTEGER`、`noRepeatedEntries`、`atLeastOneProperty`）は、`backend/packages/domain/src/schemas/rules.ts` に定義してある。

## 表現の変換

型が層によって違うのは `numeric`、`timestamp with time zone`、`jsonb` の 3 種類だけで、マッパーはこの 3 種類だけを変換する。それ以外のカラムは値をそのまま受け渡し、プロパティ名はどのカラムでも変えない。例外は、顧客の `gender`（DB では `varchar`、API では Enum）と、スタッフのアカウントの `role`（API の Enum が、カラムの Enum の値の一部だけを持つ）で、この節の最後に書く。

| カラムの型 | DB → API（`SalonReadMapper`） | API → DB（`SalonWriteMapper`） |
|---|---|---|
| `numeric` | 文字列を `number` にする | `String(value)` で文字列にする |
| `timestamp with time zone` | PostgreSQL のテキスト形式を ISO 8601（UTC）にする | 変換なし。リクエストに含まれず、DB が設定する（作成は列の既定値 `now()`、更新は `clock_timestamp()`） |
| `jsonb` | 保存されている値を API モデルの Zod スキーマで検査する | 検証済みのリクエストの値をそのまま保存する |

`jsonb` のカラムの形は DB が保証しないので、保存されている値は、読むたびに、いまの API モデルのスキーマと照合する（未知のキーも拒否する）。`jsonb` のモデルからプロパティを除くとき、名前を変えるときは、同じ変更で、保存されている値を直すマイグレーションを書く。以前の形のままの行は、読めなくなる（500）。カラムは変わらないので、`schema.ts` と `setup.sql` は変わらない。例は、曜日ごとの営業時間（`BusinessHours`）から `timezone` を除いた `202611160500_business_hours_without_time_zone.sql`。行に何をするかは、マイグレーションのテスト（`backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts`）で確かめる。

`numeric` と `timestamp with time zone` の変換は、どの Read マッパーも同じものを使う。

```typescript
// backend/packages/domain/src/mappers/read/columns.ts
export const numericSchema = z.string().transform(Number).pipe(z.number())

export const timestampSchema = z
  .string()
  .transform((value) => parseISO(value))
  .pipe(z.date())
  .transform((value) => value.toISOString())
```

```typescript
// backend/packages/domain/src/mappers/read/salon.mapper.ts（抜粋）
const businessHoursSchema = z.array(storedBusinessHoursSchema).nullable()

const convertedColumnsSchema = z.object({
  latitude: numericSchema.nullable(),
  longitude: numericSchema.nullable(),
  rating: numericSchema.nullable(),
  taxRate: numericSchema,
  businessHours: businessHoursSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiSalonResponse,
    | 'latitude'
    | 'longitude'
    | 'rating'
    | 'taxRate'
    | 'businessHours'
    | 'createdAt'
    | 'updatedAt'
  >
>
```

保存されている行がこのスキーマに合わない場合、`toApiSalon` は `validation` ではなく `database` エラーを返す（リクエストではなく保存データの問題なので、レスポンスは 500 になる）。

```typescript
// backend/packages/domain/src/mappers/write/salon.mapper.ts（抜粋）
const toNumeric = (value: number): string => String(value)

export const SalonWriteMapper = {
  fromCreateRequest(request: ApiSalonCreateRequest): {
    salon: DbNewSalon
    openingHours: DbNewOpeningHours[]
  } {
    const { openingHours, latitude, longitude, taxRate, ...columns } = request

    return {
      salon: {
        ...columns,
        latitude: latitude === null ? null : toNumeric(latitude),
        longitude: longitude === null ? null : toNumeric(longitude),
        taxRate: toNumeric(taxRate),
      },
      openingHours: toDbOpeningHours(openingHours),
    }
  },
  // ...
}
```

`...columns` でリクエストをそのまま行にできるのは、プロパティ名と NULL 許可が DB と一致しているからである。どちらかがずれると、`DbNewSalon` に代入できず型検査で失敗する。

リクエストで書けるカラムに上の 3 種類がないテーブルでは、Write マッパーは何も変換せず、リクエストをそのまま行として返す。`service_categories` がその例である（`backend/packages/domain/src/mappers/write/service-category.mapper.ts`。行の型は `backend/packages/domain/src/models/service-category.ts` の `DbNewServiceCategory`）。Read マッパーが変換するのは `createdAt` と `updatedAt` だけである。Write マッパーは、どのドメインにもある。Read マッパーのファイルと Write マッパーのファイルが、同じ名前で対になっていることを、`backend/packages/domain/src/__tests__/use-case-flow.test.ts` が確かめる。

`services` も、リクエストで書けるカラムに上の 3 種類がない。それでも Write マッパー（`backend/packages/domain/src/mappers/write/service.mapper.ts`）があるのは、リクエストが `services` の行と `service_options` の行を含むからで、マッパーは値を変換せず、2 つのテーブルの行に分ける。Read マッパーが変換するのは、ここでも `createdAt` と `updatedAt` だけである。

`customers` は、リクエストで書けるカラムに `jsonb`（`preferences`）があるが、`numeric` はなく、`jsonb` は書き込みでは変換しない。`CustomerWriteMapper`（`backend/packages/domain/src/mappers/write/customer.mapper.ts`）は何も変換せず、リクエストをそのまま `DbNewCustomer` として返す。プロパティ名と表現が行と一致していることを、型検査がここで確認する。Read マッパー（`backend/packages/domain/src/mappers/read/customer.mapper.ts`）は、`createdAt` と `updatedAt` を変換し、`preferences` を検査する。

`customer_preferences` は、リクエストで書けるカラムに `jsonb` が 2 つ（`preferredTimeSlots`、`stylePreferences`）あるが、`numeric` はなく、Write マッパー（`backend/packages/domain/src/mappers/write/customer-preferences.mapper.ts`）は何も変換しない。更新リクエストの 6 つのプロパティは、名前も表現もカラムと同じなので、検証した値を、そのまま変更として返す（`backend/packages/domain/src/models/customer-preferences.ts` の `DbCustomerPreferencesChanges`）。Read マッパー（`backend/packages/domain/src/mappers/read/customer-preferences.mapper.ts`）は、2 つの `jsonb` を検査する。レスポンスに日時はないので、タイムスタンプは変換しない。

`bookings` と `booking_services` の Write マッパー（`backend/packages/domain/src/mappers/write/booking.mapper.ts`）は、何も変換せず、行も作らない。検証したリクエストを、リポジトリが受け取る型（`backend/packages/domain/src/models/booking.ts` の `RequestedBooking` など）として返す。作成リクエストは行の一部しか持たず、残りのカラム（明細の終了日時、所要時間、金額、予約の日時、金額、来店日、予約番号、ステータス）は、参照するサービスとサロンの行から決まる。リクエストと参照する行から、書く行を決めるのは `planBooking`（`backend/packages/domain/src/business-logic/booking/_shared/plan.ts`）で、リポジトリが、参照する行をロックしたトランザクションの中で呼ぶ。更新リクエスト（`BookingUpdateRequest`）の 4 つのプロパティは、カラムと同じ名前、同じ null 許容で、そのまま書く。日時の変更リクエスト（`BookingRescheduleRequest`）の `startTime` と `staffId` から、予約と明細に書く値を決めるのは `planReschedule`（`backend/packages/domain/src/business-logic/booking/_shared/reschedule.ts`）である。リクエストの日時（`services[].startTime` と、日時の変更の `startTime`）は、スキーマが検証のときに 1 つの書き方（`toISOString` の形式）にそろえるので、同じ時刻は同じ文字列になる。Read マッパー（`backend/packages/domain/src/mappers/read/booking.mapper.ts`）は、2 つのテーブルの `timestamp with time zone` を変換する。`date` の `bookingDate` は、そのまま返す。

`sales` と `sales_details` の Write マッパー（`backend/packages/domain/src/mappers/write/sale.mapper.ts`）も、何も変換せず、行も作らない。検証したリクエストを、リポジトリが受け取る型（`backend/packages/domain/src/models/sale.ts` の `RequestedSale` など）として返す。作成リクエストは明細の金額まで持つが、売上の金額、会計日、売上番号は、明細とサロンの行から決まる。書く行を決めるのは `planSale`（`backend/packages/domain/src/business-logic/sale/_shared/plan.ts`）で、リポジトリが、参照する行をロックしたトランザクションの中で呼ぶ。表現が変わるカラムは 1 つある。明細の歩合率（`commissionRate`）は、API では数値、`numeric(5,2)` のカラムでは文字列である。`planSale` が小数第 2 位までの文字列にし、Read マッパー（`backend/packages/domain/src/mappers/read/sale.mapper.ts`）が数値に戻す。スキーマは、小数第 3 位以下を持つ値を受け付けないので、保存で値が変わることはない。リクエストの日時（`saleTime`）は、スキーマが `toISOString` の形式にそろえる。`date` の `saleDate` は、そのまま返す。

`payment_methods` には、表現が変わるカラムが 1 つある。手数料率（`fee`）は、API では数値、`numeric(5,2)` のカラムでは文字列である。`PaymentMethodWriteMapper`（`backend/packages/domain/src/mappers/write/payment-method.mapper.ts`）が `String(value)` で文字列にし、Read マッパー（`backend/packages/domain/src/mappers/read/payment-method.mapper.ts`）が数値に戻す。スキーマは、小数第 3 位以下を持つ値を受け付けないので、保存で値が変わることはない。`jsonb` の `processorConfig` は、どちらのマッパーも扱わない。Read マッパーは、プロパティを 1 つずつ書き出すので、このカラムはレスポンスに出ない。

`products` には、表現が変わるカラムが 3 つある。在庫の水準（`minimumStock`、`reorderPoint`、`maximumStock`）は、API では数値、`numeric(10,2)` のカラムでは文字列である。`ProductWriteMapper`（`backend/packages/domain/src/mappers/write/product.mapper.ts`）が `String(value)` で文字列にし、Read マッパー（`backend/packages/domain/src/mappers/read/product.mapper.ts`）が数値に戻す。スキーマは、小数第 3 位以下を持つ値を受け付けないので、保存で値が変わることはない。Read マッパーは、有限の数値として読めない値を、データベースのエラーにする。

`inventory` の在庫の 3 つの数（`currentStock`、`availableStock`、`reservedStock`）も、API では数値、`numeric(10,2)` のカラムでは文字列である。リクエストは書かず（作成した行は 0）、Read マッパー（`backend/packages/domain/src/mappers/read/inventory.mapper.ts`）が数値にする。Write マッパー（`backend/packages/domain/src/mappers/write/inventory.mapper.ts`）は何も変換せず、作成リクエストを行として（サロンは検証した ID のまま。`backend/packages/domain/src/models/inventory.ts` の `RequestedInventory`）、更新リクエストを変更として返す。在庫の移動（`inventory_transactions`）の `quantity`、`balanceBefore`、`balanceAfter` も `numeric(10,2)` で、Write マッパー（`mappers/write/inventory-transaction.mapper.ts`）が `quantity` を小数 2 桁の文字列にし、Read マッパー（`mappers/read/inventory-transaction.mapper.ts`）が 3 つを数値にする。棚卸しの `countedQuantity` も、Write マッパー（`mappers/write/inventory-report.mapper.ts`）が小数 2 桁の文字列にし、結果の `expected`、`counted`、`difference` は、Read マッパー（`mappers/read/inventory-report.mapper.ts`）が数値にする。在庫評価額の円は、データベースが整数の文字列で返し、同じ Read マッパーが、数値で正確に表せる範囲だけを数値にする。使用期限（`expiryDate`）は `date` のカラムで、DB も API も `YYYY-MM-DD` なので変換しない。リクエストの日付は、ほかの日付と同じく 1900-01-01 から 2999-12-31 までに限る（[範囲](#リクエストの日付と日時の範囲)）。

`users` と `sessions` の Write マッパー（`backend/packages/domain/src/mappers/write/user.mapper.ts`、`session.mapper.ts`）も、何も変換せず、行も作らない。認証のリクエストが示すのは、メールアドレス、パスワード、メールで届いたトークン、リフレッシュトークン、2 要素認証のコードである。マッパーは、それらをそのまま返す。パスワードとトークンは、ユースケースがハッシュにしてから、保存するか照合する。セッションの一覧では、`SessionWriteMapper.fromSearchRequest` が、検索のリクエストと、操作者と現在時刻から、一覧の条件を作る。Read マッパーは、行のほかに、行でない答えも作る。`SessionReadMapper` は、セッションの一覧のページ（`toApiSessionPage`）と、ログインとトークン再発行の答え（`toApiLogin`。発行したトークンとアカウント）を作り、`UserReadMapper` は、2 要素認証の設定の答え（`toApiTwoFactorSetup`。シークレット、認証アプリが読むアドレス、バックアップコード）と、バックアップコードの再発行の答え（`toApiTwoFactorBackupCodes`）を作る。

`time` のカラムは変換しない。DB は `HH:mm:ss` で返し、リクエストは `HH:mm` と `HH:mm:ss` のどちらも受け付ける。

顧客の `gender` は、DB では `varchar(20)`（行の型は `string`）、API では `CustomerGenderType` である。CHECK 制約 `customers_gender_known` が、値を Enum の 4 つのどれかに限っている。Read マッパーは、保存されている値を生成された `CustomerGenderTypeSchema` で検査する。書き込みでは変換しない（Enum の値は、そのまま文字列として保存できる）。

スタッフに紐づいたアカウントの `role` は、DB では Enum 型 `user_role`（5 つの値）、API では `SalonRoleType`（そのうちの `owner`、`manager`、`staff`）である。CHECK 制約 `users_staff_needs_salon_role` が、スタッフを指すユーザーのロールを、この 3 つに限っている。Read マッパー（`backend/packages/domain/src/mappers/read/staff-account.mapper.ts`）は、保存されている値を生成された `SalonRoleTypeSchema` で検査する。書き込みでは変換しない（API の値は、どれもカラムの Enum の値である）。

## 制約の対応

| DB | TypeSpec | Zod（`salon.schema.ts`） | 実行時の扱い |
|---|---|---|---|
| `NOT NULL` | `Type` | `.nullable()` を付けない | null は検証エラー（400） |
| NULL 許可 | `Type \| null` | `.nullable()` | null をそのまま保存し、そのまま返す |
| `varchar(n)` | `@maxLength(n)` | `.max(n)` | 超過は検証エラー（400） |
| `numeric(p, s)` | `@minValue` / `@maxValue` | `.min()` / `.max()`。`taxRate` は `.multipleOf(0.01)` | 範囲外は検証エラー（400） |
| `uuid` の主キー | ID スカラー | `uuidSchema.brand<'SalonId'>()`（`salonIdSchema`） | UUID でない ID は検証エラー（400）。大文字で書かれた ID は小文字にそろえる |
| 一意インデックス（`salons_email_unique`。削除されていない行が対象） | `@doc` に「削除されていないサロンの間で一意」と書き、オペレーションに 409 を列挙する | 検証しない | リポジトリが一意性の違反（SQLSTATE `23505`）を `alreadyExists` に変換する（409） |
| 範囲の違う 2 つの一意性（`customers_email_unique` は削除されていない行だけが対象の一意インデックス、`customers_referral_code_unique` は削除済みの行も対象の一意制約） | それぞれの `@doc` に範囲を書き（「削除されていない顧客の間で一意」、「削除済みを含むすべての顧客の間で一意」）、オペレーションに 409 を列挙する | 検証しない | リポジトリが、違反した制約の名前でどちらの値かを見分け、`alreadyExists` に変換する（409） |
| 外部キー（`opening_hours.salonId`、`ON DELETE CASCADE`） | 親モデルに `openingHours` として埋め込む | 配列として検証する | リポジトリが親と子を 1 つのトランザクションで書く |
| 外部キー（`service_categories.salonId`、`ON DELETE CASCADE`）。サロンの下のルートを持つリソース | パスの `salonId`。Create / Update のモデルには含めず、Response には含める | パスの値を `parseSalonIdOfPath`（`models/salon.ts`）で検証する | サロンがなければ 404。リポジトリはすべてのクエリにサロンの ID を付けるので、ほかのサロンの行は見つからない（404） |

リクエストで書けるカラムと書けないカラムの扱い:

- `DEFAULT` のあるカラムでも、リクエストで書けるもの（`timezone`、`currency`、`taxRate`、`isActive`）は Create で必須にする。`DbNewSalon` は `DeepRequired` で全キーが必須なので、API は DB の既定値に頼らない
- NULL 許可のカラムには、既定値を付けない。NULL が「値がない」を表すので、値を書かなかった行に、別の意味の値（0 年、空配列）が入らないようにする。`migrations.integration.test.ts` の `202611181200_unused_tables_and_columns.sql` のテストが、マイグレーションのあとに、NULL 許可で既定値のあるカラムが 1 つもないことを確かめる。テストのデータベースは `setup.sql` から作るので、そのようなカラムを `setup.sql` に加えると、このテストが失敗する
- DB やほかの機能が値を決めるカラム（`id`、`rating`、`reviewCount`、`createdAt`、`updatedAt` など）は Create / Update に含めない。リクエストのスキーマは `z.strictObject` なので、これらを送ると未知のプロパティとして検証エラーになる
- 行が属するサロンを指すカラム（`service_categories.salonId`）も Create / Update に含めない。値はパスの `salonId` で決まり、あとから変えられない。`api-consistency-rules.ts` では `omittedColumns` に入れる（`serviceCategoryManagedColumns`）
- `deletedAt`（論理削除）は API に出さない。リポジトリのメソッドが返す行と変更する行は、`deletedAt IS NULL` の行だけである。一覧のカーソルだけは、削除済みの行を指していてもよい（サロン、サービス、顧客の一覧。行が残っているので、ページの開始位置が分かる）

Zod スキーマは API の型と突き合わせてあるので、TypeSpec の形を変えてスキーマを直し忘れると型検査で失敗する。

```typescript
// backend/packages/domain/src/schemas/salon.schema.ts（抜粋）
export const salonCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(255),
  nameKana: nonBlankText.max(255).nullable(),
  // ...
  latitude: z.number().min(-90).max(90).nullable(),
  // ...
  // カラムは小数第 2 位までを保持する
  taxRate: z.number().min(0).max(100).multipleOf(0.01),
  isActive: z.boolean(),
  openingHours: openingHoursListSchema,
}) satisfies z.ZodType<ApiSalonCreateRequest>
```

DB にも TypeSpec にも表せない規則（空白だけの文字列を拒否する、電話番号や URL の形式、営業時間の前後関係、日付と曜日の一致など）は、Zod スキーマだけにある。

### CHECK 制約

`services` と `service_options` には、1 行だけで判定できる規則を CHECK 制約として持たせてある（`backend/packages/database/sql/migrations/202611150300_services_columns.sql`）。リクエストは、DB に届く前に同じ規則で検証する。

| CHECK 制約 | TypeSpec | 同じ規則を検証する場所 |
|---|---|---|
| `services_duration_positive`（`duration > 0`） | `@minValue(1)` | スキーマの `duration`（1 以上） |
| `services_price_not_negative`（`price >= 0`） | `@minValue(0)` | スキーマの `price`（0 以上） |
| `services_discount_price_within_price`（`discountPrice` は NULL か、0 以上 `price` 以下） | `@minValue(0)`。`price` 以下であることは `@doc` に書く | スキーマの `discountPrice`（0 以上）と、`serviceRuleIssues`（`price` 以下） |
| `services_max_bookings_per_day_positive`（`maxBookingsPerDay` は NULL か、1 以上） | `@minValue(1)` | スキーマの `maxBookingsPerDay`（1 以上） |
| `services_package_members`（`isPackage` が true なら `packageServiceIds` は 2〜20 件、false なら 0 件） | `@maxItems(20)`。`isPackage` との組み合わせは `@doc` に書く | スキーマの `packageServiceIds`（20 件以下）と、`serviceRuleIssues`（パッケージは 2 件以上、パッケージでなければ 0 件） |
| `service_options_additional_time_not_negative`、`service_options_additional_price_not_negative` | `@minValue(0)` | オプションのスキーマの `additionalTime`、`additionalPrice`（0 以上） |
| `service_options_max_quantity_positive`（`maxQuantity > 0`） | `@minValue(1)` | オプションのスキーマの `maxQuantity`（1 以上） |

1 つのカラムの範囲は `backend/packages/domain/src/schemas/service.schema.ts` のスキーマにあり、2 つのカラムを結ぶ規則は `backend/packages/domain/src/business-logic/service/_shared/rules.ts` の `serviceRuleIssues` にある。部分更新は片方のカラムだけを指定できるので、後者はリクエストではなく、更新後に保存される行に対して判定する。作成ではユースケースが、更新ではリポジトリがトランザクションの中で呼ぶ。どちらの違反も検証エラー（400）になる。

`customers` にも CHECK 制約が 4 つある（`backend/packages/database/sql/migrations/202611150900_customers_columns.sql`）。

| CHECK 制約 | TypeSpec | 同じ規則を検証する場所 |
|---|---|---|
| `customers_email_lower_case`（`email` は小文字） | `@doc` に「小文字にそろえて保存する」と書く | スキーマの `email`（`lowerCaseEmail` が小文字にそろえる。大文字を含むリクエストは拒否せず、小文字にして保存する） |
| `customers_gender_known`（`gender` は NULL か、`male`、`female`、`other`、`prefer_not_to_say` のどれか） | `CustomerGenderType \| null` | スキーマの `gender`（生成された `CustomerGenderTypeSchema`） |
| `customers_not_referred_by_itself`（`referredBy` は NULL か、その行の `id` 以外） | 更新リクエストの `@doc` に「この顧客以外の顧客を指定する」と書く | `referredByItself`（`backend/packages/domain/src/business-logic/customer/_shared/rules.ts`）。更新のユースケースが呼ぶ。登録では `id` を DB が決めるので、自分自身は指定できない |
| `customers_preferences_is_an_object`（`preferences` は NULL かオブジェクト） | `CustomerBasicPreferences \| null` | スキーマの `preferences`。オブジェクトの中の形（`preferredServices` と `notes`）は DB では保証できないので、リクエストはスキーマが検証し、保存されている値は Read マッパーが読み出すときに検査する |

`customer_preferences` には CHECK 制約が 3 つある（`backend/packages/database/sql/migrations/202611160100_customer_preferences_columns.sql`）。

| CHECK 制約 | TypeSpec | 同じ規則を検証する場所 |
|---|---|---|
| `customer_preferences_time_slots_is_an_array`（`preferredTimeSlots` は配列） | `TimeSlot[]`（null を許さない） | スキーマの `preferredTimeSlots`。配列の中の形は DB では保証できないので、リクエストはスキーマが検証し、保存されている値は Read マッパーが読み出すときに検査する（`storedTimeSlotsSchema`） |
| `customer_preferences_style_is_an_object`（`stylePreferences` は NULL かオブジェクト） | `StylePreference \| null` | スキーマの `stylePreferences`。オブジェクトの中の形は、同じく、リクエストではスキーマが、読み出すときは Read マッパーが確かめる（`storedStylePreferenceSchema`） |
| `customer_preferences_preferred_staff_not_avoided`（`preferredStaffId` は NULL か、`avoidStaffIds` にない ID） | 更新リクエストの `@doc` に「避けたいスタッフは指定できない」と書く | `customerPreferencesRuleIssues`（`backend/packages/domain/src/business-logic/customer-preferences/_shared/rules.ts`）。部分更新は片方だけを指定できるので、更新後に保存される値に対して、リポジトリがトランザクションの中で判定する。両方を指定したリクエストは、ユースケースが先に判定する |

`bookings` と `booking_services` の CHECK 制約は、ほかのカラムから決まる値が、その定義のとおりであることを保証する（`backend/packages/database/sql/migrations/202611160200_bookings_rules.sql`）。対象のカラムは、どれもリクエストから書けない。値を決めるのは `planBooking` で、制約は、その結果と、シードや将来の書き込みが同じ規則に従うことを確かめる。

| CHECK 制約 | TypeSpec | 値を決める場所 |
|---|---|---|
| `bookings_end_after_start`、`booking_services_end_after_start`（`startTime < endTime`） | `@doc` に、終了日時の決まり方を書く | 明細の `endTime` は `startTime` にサービスの `duration` を足す。サービスの `duration` は 1 以上（`services_duration_positive`） |
| `bookings_duration_is_the_span`、`booking_services_duration_is_the_span`（`duration` は開始から終了までの分数） | 予約の `@doc` に「`startTime` から `endTime` までの分数」、明細の `@doc` に「サービスの施術時間」と書く | 明細はサービスの `duration`、予約は最も早い開始から最も遅い終了まで。リクエストの `startTime` は分単位（スキーマの `minuteInUtc`）なので、分数は整数になる |
| `bookings_amounts_not_negative`（金額とポイントは 0 以上。NULL 可のカラムは NULL でもよい） | 作成リクエストの `depositAmount` に `@minValue(0)` | リクエストから書けるのは `depositAmount` だけで、スキーマが 0 以上を確かめる。ほかは、サービスの料金（0 以上）の合計 |
| `bookings_discount_within_subtotal`（`discountAmount <= subtotal`） | `@doc` に、明細の合計であることを書く | 明細ごとに `discountAmount` は `price` 以下なので、合計も同じ |
| `bookings_total_is_the_sum`（`totalAmount = subtotal - discountAmount + taxAmount`） | `@doc` に同じ式を書く | `planBooking` |
| `booking_services_discount_within_price`（`discountAmount` は 0 以上 `price` 以下） | `@doc` に「サービスの割引後料金から算出する」と書く | `price` からサービスの `discountPrice` を引く。`discountPrice` は 0 以上 `price` 以下（`services_discount_price_within_price`） |
| `booking_services_final_price_is_the_difference`（`finalPrice = price - discountAmount`） | `@doc` に同じ式を書く | `planBooking` |
| `booking_services_completed_has_time`（`isCompleted` と、`completedAt` が NULL でないことが一致する） | `completedAt` の `@doc` に「完了していない場合は null」と書く | 作成では false と NULL。予約の完了が、まだ完了していない明細を true と完了の日時にする |
| `booking_services_sort_order_not_negative`（`sortOrder >= 0`）と、一意制約 `booking_services_order_unique`（予約の中で `sortOrder` が重ならない） | `@doc` に「予約作成時は `services` の指定順」と書く | リクエストの配列の位置（0 から） |

予約のステータスと、ステータスに伴う値の関係も CHECK 制約にしてある（`backend/packages/database/sql/migrations/202611160300_booking_status_rules.sql`）。対象のカラムは、どれもリクエストの更新では書けない。値を決めるのは `planStatusChange`（`backend/packages/domain/src/business-logic/booking/_shared/status.ts`）と、顧客の予約を数えるリポジトリである。

| CHECK 制約 | TypeSpec | 値を決める場所 |
|---|---|---|
| `bookings_cancelled_has_time`（`status` が `cancelled` であることと、`cancelledAt` が NULL でないことが一致する） | `cancelledAt` の `@doc` に「キャンセルされていない場合は null」と書く | キャンセルの操作が、データベースの時計の日時を書く |
| `bookings_cancellation_only_when_cancelled`（`cancelledBy`、`cancellationReason`、`cancellationFee` は、`cancelled` の予約にだけある） | それぞれの `@doc` に同じことを書く。`cancellationFee` は「常に 0」と書く | キャンセルの操作。`cancelledBy` は操作者、`cancellationReason` は本文の値（null でもよい）、`cancellationFee` は 0 |
| `bookings_completed_has_time`（`status` が `completed` であることと、`completedAt` が NULL でないことが一致する） | `completedAt` の `@doc` に「完了していない場合は null」と書く | 完了の操作が、データベースの時計の日時を書く |
| `bookings_in_progress_has_start`（`in_progress` の予約には `actualStartTime` がある） | `actualStartTime` の `@doc` に、施術の開始で記録することを書く | 施術の開始の操作 |
| `bookings_actual_end_after_start`（両方があれば `actualStartTime < actualEndTime`） | 完了リクエストの `@doc` に書く | 本文の 2 つの値はスキーマが確かめ（400）、本文の値と記録済みの値は `planStatusChange` が確かめる（409） |
| `customers_visit_days_go_with_visits`（`visitCount` が 0 であることと、`firstVisitDate`・`lastVisitDate` が NULL であることが一致し、初回は最終より後でない）、`customers_counts_not_negative`（3 つの回数は 0 以上） | レスポンスだけの項目（リクエストにはない） | 予約の完了、キャンセル、無断キャンセルの記録が、顧客の予約から数え直す（`countBookingsOf`） |

予約の間の規則（スタッフが、同時に受けられる数を超えて重ならない）は、CHECK 制約では書けない。作成のトランザクションが、スタッフの行をロックして確かめる（[予約台帳](./bookings.md#スタッフの占有)）。

`sales` と `sales_details` の CHECK 制約は、リクエストが書く値と、そこから決まる値の両方にかかる（`backend/packages/database/sql/migrations/202611160700_sales_rules.sql`）。明細の金額はリクエストの値なので、同じ規則をスキーマが先に確かめ、違反は 400 になる。制約に届くのは、スキーマを通らない書き込み（シード、手で書いた行）だけである。

| CHECK 制約 | TypeSpec | 規則を確かめる場所 |
|---|---|---|
| `sales_details_quantity_positive`（`quantity >= 1`） | `@minValue(1)` | スキーマの `quantity` |
| `sales_details_amounts_not_negative`（金額は 0 以上。NULL 可の `commissionAmount` は NULL でもよい） | `@minValue(0)` | スキーマの `amount` |
| `sales_details_discount_within_price`（`discountAmount` は `quantity` × `unitPrice` 以下） | `@doc` に書く | `salesDetailSchema` の `.check()`。積は `BigInt` で計算する（制約は `bigint`） |
| `sales_details_total_is_the_sum`（`totalAmount` = `quantity` × `unitPrice` − `discountAmount` + `taxAmount`） | `@doc` に同じ式を書く | 同上 |
| `sales_details_commission_rate_is_a_percentage`（`commissionRate` は NULL か、0 以上 100 以下） | `@minValue(0)`、`@maxValue(100)` | スキーマの `commissionRate`。小数第 2 位までであることも確かめる |
| `sales_details_item_of_a_known_type`（`itemId` があるのは、`itemType` が `service` か `product` の行だけ） | `@doc` に書く | `salesDetailSchema` の `.check()`。ID がサロンのサービスか商品を指すことは、`planSale` が確かめる |
| `sales_details_sort_order_not_negative`（`sortOrder >= 0`）と、一意制約 `sales_details_order_unique`（売上の中で `sortOrder` が重ならない） | `@minValue(0)`、`@doc` に書く | スキーマの `sortOrder` と、明細の一覧の `.check()` |
| `sales_amounts_not_negative`、`sales_discount_within_subtotal`、`sales_total_is_the_sum`（売上の金額） | レスポンスの `@doc` に、明細の合計であることを書く | リクエストからは書けない。`planSale` が明細から合計する。明細ごとに規則が成り立つので、合計でも成り立つ |
| `sales_points_need_customer`（顧客のない売上にポイントはない） | 作成リクエストの `@doc` に書く | `saleCreateRequestSchema` の `.check()` |
| `sales_void_has_time`、`sales_void_reason_of_void`（取り消しの項目） | レスポンスの `@doc` に書く | 作成では false と NULL。取り消しが、`isVoid`、`voidedAt`、`voidReason` を 1 つの文で書く |

1 つの予約に、取り消していない売上は 1 件、という規則は、行の間の規則なので、CHECK 制約では書けない。部分一意インデックス（`sales_booking_live_unique`）が保証し、作成と更新のトランザクションが、予約の行をロックして先に確かめる（[売上台帳](./sales.md#予約の会計は-1-回)）。

`payment_methods` の CHECK 制約は、どれも、リクエストが書く値にかかる（`backend/packages/database/sql/migrations/202611160800_payment_method_rules.sql`）。同じ規則をスキーマが先に確かめ、違反は 400 になる。

| CHECK 制約 | TypeSpec | 規則を確かめる場所 |
|---|---|---|
| `payment_methods_fee_is_a_percentage`（`fee` は NULL か、0 以上 100 以下） | `@minValue(0)`、`@maxValue(100)` | スキーマの `fee`。小数第 2 位までであることも確かめる |
| `payment_methods_amount_limits`（`minimumAmount` と `maximumAmount` は、それぞれ NULL か 1 以上。両方があれば、下限は上限以下） | `@minValue(1)`。下限と上限の関係は `@doc` に書く | スキーマの `amountLimit` と、両方を書いたリクエストの `.check()`（`limitsInOrder`）。片方だけを書いた更新は、リクエストだけでは確かめられない。リポジトリが、行をロックしたトランザクションの中で、更新後の値を確かめる（`limitsAfter`、`limitsAreInOrder`。[支払い](./payments.md#金額の範囲)） |
| `payment_methods_sort_order_not_negative`（`sortOrder >= 0`） | `@minValue(0)` | スキーマの `sortOrder` |

`payment_transactions` の CHECK 制約は、1 行で確かめられる規則で、多くは、ステータスと、それに伴うカラムを結ぶ（`backend/packages/database/sql/migrations/202611160900_payment_transaction_rules.sql`）。リクエストが書く値にかかるものは、スキーマが先に確かめ、違反は 400 になる。

| CHECK 制約 | TypeSpec | 規則を確かめる場所 |
|---|---|---|
| `payment_transactions_amount_positive`（`amount >= 1`） | `@minValue(1)` | スキーマの `amount` |
| `payment_transactions_received_has_time`（受け取った決済取引だけが `processedAt` を持つ） | レスポンスの `@doc` に書く | リクエストからは書けない。支払いの記録が、`completed` と `processedAt` を 1 つの文で書く |
| `payment_transactions_failure_of_failed`（`failedAt`、`errorCode`、`errorMessage` は `failed` の決済取引だけ） | レスポンスの `@doc` に書く | リクエストからは書けない。API は `failed` の決済取引を書かない |
| `payment_transactions_refund_of_refunded`（返金の項目は、返金した決済取引だけ） | レスポンスの `@doc` に書く | 返金が、ステータス、`refundedAt`、`refundAmount`、`refundReason` を 1 つの文で書く |
| `payment_transactions_refund_amount`（全額返金は `refundAmount` = `amount`、一部返金は 1 以上 `amount` 未満） | 返金リクエストの `@doc` に書く | スキーマの `refundAmount`（1 以上）と、`planRefund`（`amount` 以下。等しければ `refunded`、少なければ `partial_refund`） |
| `payment_transactions_card_last_four_digits`（`cardLastFour` は NULL か数字 4 桁） | `@pattern("^[0-9]{4}$")` | スキーマの `cardLastFour` |

1 つの売上の決済取引を合わせた規則（受け取った合計は合計金額以下。売上の `paymentStatus` は決済取引から決まる）は、行とテーブルをまたぐので、CHECK 制約では書けない。支払いの記録と返金のトランザクションが、売上の行をロックして保証する（[支払い](./payments.md#支払いの記録と返金)）。

`customer_points` と、`customers.loyaltyPoints` の CHECK 制約は、ポイント取引の 1 行で確かめられる規則である（`backend/packages/database/sql/migrations/202611161000_customer_points_rules.sql`）。リクエストが書く値にかかるものは、スキーマが先に確かめ、違反は 400 になる。

| CHECK 制約 | TypeSpec | 規則を確かめる場所 |
|---|---|---|
| `customers_loyalty_points_not_negative`（`loyaltyPoints >= 0`） | 残高のレスポンスの `@doc` に書く | リクエストからは書けない。`planPoints` が、0 未満になる取引を書かない（409） |
| `customer_points_points_of_type`（`earned` は 1 以上、`used` と `expired` は −1 以下、`adjusted` と `transferred` は 0 以外） | 付与と利用の `points` に `@minValue(1)`。調整の 0 以外は `@doc` に書く | スキーマの `points`（付与と利用は 1 以上、調整は 0 以外の `refine`）。利用は、`planPoints` が負の数にして書く。失効は、`planExpiry` が、失効させるポイントがあるときだけ負の数にして書く |
| `customer_points_balance_not_negative`（`balance >= 0`） | レスポンスの `@doc` に書く | リクエストからは書けない。`planPoints` が、0 未満になる取引を書かない（409） |
| `customer_points_expiry_of_earned`（有効期限は `earned` だけ） | 利用と調整のリクエストに `expiryDate` がない | スキーマ（利用と調整では `unrecognized_keys`）と、`planPoints`（付与だけが `expiryDate` を書く）と `planExpiry`（失効の `expiryDate` は null） |
| `customer_points_reference_pair`（`referenceType` と `referenceId` は、両方あるか、両方 NULL） | 両方の `@doc` に書く | 3 つのリクエストの `.check()`（`referenceInPairs`） |
| `customer_points_reference_type_known`（`referenceType` は `sale` か `booking`） | `PointReferenceType` | スキーマの `referenceType`（`PointReferenceTypeSchema`）と、読み出しマッパー |

部分一意インデックス `customer_points_reference_unique`（1 つの記録への `earned` は 1 件、`used` も 1 件）は、`planPoints` が、顧客をロックしたあとに確かめる規則（409）の裏付けである。顧客の残高が最新の取引の `balance` と等しいことは、行とテーブルをまたぐので、CHECK 制約では書けない。ポイント取引を書くトランザクションが、顧客の行をロックして、取引と残高を一緒に書いて保証する（[ポイント台帳](./points.md#同時に届いたリクエスト)）。

`reviews` の CHECK 制約は、レビューの 1 行で確かめられる規則である（`backend/packages/database/sql/migrations/202611171000_review_rules.sql`）。投稿のリクエストが書く値にかかるものは、スキーマが先に確かめ、違反は 400 になる。

| CHECK 制約 | TypeSpec | 規則を確かめる場所 |
|---|---|---|
| `reviews_ratings_in_range`（`overallRating` は 1〜5、ほかの評価は NULL か 1〜5） | 6 つの評価に `@minValue(1)` と `@maxValue(5)` | スキーマの評価（`rating`: 1〜5 の整数） |
| `reviews_counts_not_negative`（`helpfulCount` と `reportCount` は 0 以上） | レスポンスの `@doc`（`helpfulCount` は評価した顧客の数、`reportCount` は `pending` の通報の数） | リクエストからは書けない（作成では既定の 0。`helpfulCount` は、参考になったが `review_helpful_votes` から、`reportCount` は、通報と却下が `review_reports` から数え直す） |
| `reviews_owner_response_pair`（`ownerResponse` と `ownerRespondedAt` は、両方あるか、両方 NULL） | 両方の `@doc`（返信がなければ両方 null） | 返信（`POST /api/v1/reviews/{id}/respond`）が、返信と一緒に時刻を書き、取り下げでは両方を null にする。時刻はリクエストからは書けない |
| `reviews_image_urls_array`（`imageUrls` は JSON の配列。カラムは NOT NULL） | `imageUrls: string[]`（null にならない） | スキーマの `imageUrls`（URL の配列、10 個まで、重複なし）と、読み出しマッパー |
| `salons_review_count_not_negative`（`reviewCount >= 0`） | サロンのレスポンスの `@doc`（レビューの件数） | リクエストからは書けない。レビューを書くトランザクションが、件数を数えて書く |
| `salons_rating_in_range`（`rating` は NULL か 1〜5） | サロンのレスポンスの `@doc`（`overallRating` の平均） | 同上。平均を小数第 2 位に丸めて書く |
| `salons_rating_of_reviews`（`reviewCount` が 0 のときだけ `rating` が NULL） | サロンのレスポンスの `@doc`（レビュー未登録なら null） | 同上。レビューがなければ、平均は NULL、件数は 0 |

一意制約 `reviews_booking_unique`（1 つの予約へのレビューは 1 件）は、`planReview` が、サロンをロックしたあとに確かめる規則（409）の裏付けである。サロンの `rating` と `reviewCount` がレビューから数えた値と等しいことは、テーブルをまたぐので、CHECK 制約では書けない。レビューを書くトランザクションが、サロンの行をロックして、レビューと一緒に書いて保証する（[レビュー](./reviews.md#同時に届いたリクエスト)）。

`review_reports` の CHECK 制約は、通報の 1 行で確かめられる規則である（`backend/packages/database/sql/migrations/202611171200_review_reports.sql`）。

| CHECK 制約 | TypeSpec | 規則を確かめる場所 |
|---|---|---|
| `review_reports_resolved_when_dismissed`（`dismissed` なら `resolvedBy` と `resolvedAt` があり、`pending` ならどちらも NULL） | `ReviewReportStatusType` と、`resolvedBy`・`resolvedAt` の `@doc`（未処理なら null） | リクエストからは書けない。却下が、状態と一緒に書く |
| `review_reports_other_has_details`（`reason` が `other` なら `details` は NULL でない） | `ReviewReportRequest` の `details` の `@doc` | スキーマの `.check()`（`details` の `custom`、400） |

一意制約 `review_reports_review_reporter_unique`（1 つのアカウントが 1 つのレビューを通報するのは 1 回）は、通報が `ON CONFLICT DO NOTHING` で行を書き、何も書かれなければ 409 を返す規則そのものである。レビューの `reportCount` が `pending` の通報の数と等しいことは、テーブルをまたぐので、CHECK 制約では書けない。通報と却下のトランザクションが、レビューの行をロックして数え直して保証する（[レビュー](./reviews.md#同時に届いたリクエスト)）。

`treatment_records`、`treatment_materials`、`treatment_photos` の CHECK 制約は、施術記録と、その使用商材と写真の 1 行で確かめられる規則である（`backend/packages/database/sql/migrations/202611171800_treatment_record_rules.sql`、`202611171900_treatment_photo_rules.sql`）。リクエストが書く値にかかるものは、スキーマが先に確かめ、違反は 400 になる。

| CHECK 制約 | TypeSpec | 規則を確かめる場所 |
|---|---|---|
| `treatment_records_lists`（`services` は 1 件以上の配列、`techniques` と `nextRecommendedServices` は配列） | `services` に `@minItems(1)`。3 つとも null にならない配列 | スキーマの 3 つの一覧（`services` は 1〜20 件） |
| `treatment_records_ranges`（`processingTime` は NULL か 0〜1440、`customerSatisfaction` は NULL か 1〜5） | `@minValue` と `@maxValue` | スキーマの `processingTime` と `customerSatisfaction` |
| `treatment_materials_amounts`（`quantity` は 0 より大きい、`sortOrder` は 0 以上） | `quantity` に `@minValueExclusive(0)`。`sortOrder` はモデルにない | スキーマの `quantity`。`sortOrder` は、リポジトリが、リクエストの順に 0 から付ける |
| `treatment_photos_consent`（`isPublic` が true なら `customerConsent` も true） | `isPublic` の `@doc` | 写真のスキーマの `.check()`（`isPublic` の `custom`、400） |
| `treatment_photos_sort_order`（`sortOrder` は 0 以上） | `sortOrder` に `@minValue(0)` | 写真のスキーマの `sortOrder` |

写真の区分 `photoType` は、列挙型 `treatment_photo_type` で、TypeSpec は `TreatmentPhotoType` である。一意制約 `treatment_records_booking_unique`（予約 1 件に施術記録は 1 件）は、作成が `ON CONFLICT DO NOTHING` で行を書き、何も書かれなければ 409 を返す規則そのものである。一意制約 `treatment_photos_record_url_unique`（施術記録 1 件に同じ URL の写真は 1 枚）は、写真の追加が、施術記録をロックしたあとに確かめる規則（409）の裏付けである。施術記録 1 件の写真が 20 枚までであることは、行をまたぐので、CHECK 制約では書けない。写真の追加が、施術記録の行をロックして数えて保証する（[施術記録](./treatments.md#同時に届いたリクエスト)）。

`medical_charts` の CHECK 制約は、カルテの 1 行で確かめられる規則である（`backend/packages/database/sql/migrations/202611181000_medical_charts.sql`）。

| CHECK 制約 | TypeSpec | 規則を確かめる場所 |
|---|---|---|
| `medical_charts_lists`（`previousTreatments` は jsonb の配列、`preferredProducts` と `avoidProducts` は NULL の要素を持たない） | 3 つとも null にならない配列で、要素は null でない | スキーマの 3 つの一覧（過去の施術は 0〜50 件、名前は空白だけでない 100 文字以下の 0〜50 件） |

過去の施術の要素の形（施術の種類、日付、サロン名、メモ）は、CHECK 制約では確かめない。書く前にリクエストのスキーマが、読むときに読み取りのマッパーが確かめ、合わない行は 500 になる。一意制約 `medical_charts_customer_id_unique`（顧客 1 人にカルテは 1 件）は、作成が `ON CONFLICT DO NOTHING` で行を書き、何も書かれなければ 409 を返す規則そのものである。

`customer_allergies` の一意制約 `customer_allergies_customer_allergen_unique`（顧客 1 人にアレルゲンは 1 件）も、同じく規則そのものである。追加は `ON CONFLICT DO NOTHING` で行を書き、何も書かれなければ 409 を返す。更新はアレルゲンを書き換える 1 つの `UPDATE` 文で、この制約の違反を 409 にする。重篤度は、列挙型 `allergy_severity` の NOT NULL の列 `severityType` だけで、TypeSpec は `AllergySeverityType` である（`backend/packages/database/sql/migrations/202611181100_customer_allergy_rules.sql`）。

## `pnpm check:api-db`

生成済みの OpenAPI ドキュメント（`specs/tsp-output/@typespec/openapi3/generated/openapi.yaml`）と Drizzle スキーマ（`schema.ts`）を比べ、API モデルがテーブルと食い違っていれば失敗する。DB は使わない。CI の `quality` ジョブと `make ci-check` で実行される。

| ファイル | 役割 |
|---|---|
| `backend/packages/database/src/scripts/api-consistency-rules.ts` | どの API モデルがどのテーブルに対応するか（`modelRules`）。ドメインごとのブロックに分かれている |
| `backend/packages/database/src/scripts/api-consistency.ts` | 比較の関数（副作用なし）。`checkModels` が、すべてのルールのモデルをテーブルと比べる。テストは `backend/packages/database/src/scripts/__tests__/api-consistency.test.ts` |
| `backend/packages/database/src/scripts/commands/check-api-consistency.ts` | ファイルを読み、`checkModels` で比べ、結果を出力するコマンド。テストは `backend/packages/database/src/scripts/commands/__tests__/check-api-consistency.test.ts` |

食い違いを許容する仕組み（ベースライン）はない。テーブルに対応するモデルはすべてルールに載っており、1 件でも食い違えば失敗する。

### 検査する内容

ルールは、モデルごとにテーブルと種類（`kind`）を指定する。

```typescript
// backend/packages/database/src/scripts/api-consistency-rules.ts（抜粋）
const salonRules: ModelRule[] = [
  {
    model: 'Models.SalonResponse',
    table: 'salons',
    kind: 'response',
    embedded: ['openingHours'],
    omittedColumns: ['deletedAt'],
  },
  {
    model: 'Models.SalonCreateRequest',
    table: 'salons',
    kind: 'create',
    embedded: ['openingHours'],
    omittedColumns: salonManagedColumns,
  },
  // ...
]
```

| 項目 | 意味 |
|---|---|
| `model` | OpenAPI のスキーマ名 |
| `table` | `schema.ts` でのテーブルの export 名（`salons`、`openingHours`） |
| `kind` | `response` / `create`（全プロパティ必須）、`update`（全プロパティ Optional） |
| `embedded` | カラムではないプロパティ（子テーブルの行を埋め込んだもの）。カラムとの照合を省く |
| `computed` | カラムではないプロパティ（サーバーがレスポンスのたびに求め、どこにも保存しない値）。カラムとの照合を省く。`SessionResponse` の `current` と、`CustomerHistoryEntryResponse` の `changes`（前の版との違い）に使っている |
| `omittedColumns` | モデルが意図して含めないカラム。それ以外のカラムがモデルにない場合は報告される。テーブルにない名前を挙げた場合も報告される。すべてのルールが指定する（テストで確認している） |
| `nonNullable` | カラムが NULL を許すのに、モデルでは null を取らないプロパティ。カラムが null になるのが、リクエストが書いたあとだけのときに使う。`PurchaseOrderItemCreateRequest` の `inventoryId` に使っている（新しい明細は在庫の行を必ず指し、カラムが null になるのは、行を削除したとき（`ON DELETE SET NULL`）だけ） |
| `narrowed` | カラムの Enum 型の値の一部だけを取るプロパティ。値が、カラムの Enum の値の一部であり、すべてではないことを確かめる。`StaffAccountResponse` と `StaffAccountUpdateRequest` の `role` に使っている（カラムは `user_role`、プロパティは `SalonRoleType`）。値の範囲を DB でも限る CHECK 制約と、組で使う |

報告される食い違い:

| 種類 | 内容 |
|---|---|
| `unknownProperty` | API のプロパティと同じ名前のカラムがない（`embedded` と `computed` に挙げたプロパティを除く） |
| `missingColumn` | モデルにも `omittedColumns` にもないカラムがある |
| `omittedUnknownColumn` | `omittedColumns` に挙げた名前のカラムが、テーブルにない。カラムを削除したあとに、ルールに名前が残っている |
| `shouldBeRequired` | `response` / `create` のプロパティが Optional になっている |
| `shouldBeOptional` | `update` のプロパティが必須になっている |
| `shouldBeNullable` | カラムが NULL 許可なのに、API が null を許していない |
| `shouldNotBeNullable` | カラムが `NOT NULL` なのに、API が null を許している |
| `nullNotNarrowed` | `nonNullable` に挙げたプロパティが null を許しているか、そのカラムが `NOT NULL` である。カラムが `NOT NULL` なら、絞り込んでいないので、`nonNullable` から外す |
| `enumMismatch` | カラムが PostgreSQL の Enum 型（またはその配列）なのに、API のプロパティが取りうる値がその Enum の値と一致しない（`narrowed` に挙げたプロパティを除く） |
| `enumNotNarrowed` | `narrowed` に挙げたプロパティが、Enum でない、値を持たない、カラムの Enum にない値を持つ、またはカラムの Enum のすべての値を持つ。すべての値を持つなら、絞り込んでいないので、`narrowed` から外す |

検査しないもの:

- 型の対応（`numeric` と `number` など）と文字列長。実装済みのドメインでは、マッパーと `satisfies` を通じて型検査が検出する
- `XXXSearchRequest`（クエリパラメーターはカラムと 1 対 1 ではない）
- ルールに載っていないモデルと、プロパティの内側にネストしたオブジェクト

ルールが存在しないテーブルやモデルを指している場合も失敗する。

検査は生成済みのファイルを読むので、TypeSpec を変えたあとは `pnpm generate`、テーブルを変えたあとは `pnpm db:introspect` を先に実行する。

### ルールに載せるモデル、載せないモデル

テーブルの行を読み書きするモデルは、必ずルールに載せる。

| モデル | ルール |
|---|---|
| `XXXResponse`、`XXXCreateRequest`、`XXXUpdateRequest` | 載せる（`response` / `create` / `update`） |
| 親に埋め込む子テーブルの行（`OpeningHours`、`ServiceOption`、`BookingServiceResponse` など） | 載せる。親のルールでは `embedded` にプロパティ名を書く |
| jsonb の列に、その形のまま保存するオブジェクト（カルテの `previousTreatments` の要素の `PreviousTreatment`） | 載せない（プロパティの内側にネストしたオブジェクト）。列が配列であることは CHECK 制約が、要素の形は、書くときにリクエストのスキーマが、読むときに読み取りのマッパーが確かめる |
| テーブルの行に、サーバーがレスポンスのたびに求める値を加えたモデル（`SessionResponse` の `current`、`CustomerHistoryEntryResponse` の `changes`、`ShareLinkResponse` の `hasPassword`） | 載せる。ルールの `computed` にそのプロパティ名を書く |
| テーブルの行の一部だけを見せ、書かせるモデル（`StaffProfileResponse`、`StaffProfileUpdateRequest`、`StaffAccountResponse`、`StaffAccountUpdateRequest`、`CustomerPreferencesResponse`、`CustomerPreferencesUpdateRequest`、`CustomerBookingResponse`、`CustomerBookingServiceResponse`、`ShareLinkResponse`、`SharedFileResponse`） | 載せる。見せないカラム、書かせないカラムを `omittedColumns` に挙げる。Enum の値の一部だけを取るプロパティは、`narrowed` にも挙げる |
| 行を追加するアクションのリクエスト（`PointEarnRequest`、`SaleProcessRequest` など） | カラムと 1 対 1 なら `create` として載せる |
| `XXXSearchRequest` と、その絞り込み条件だけを取るリクエスト（`CustomerExportRequest`） | 載せない |
| 行のカラムではなく、行を決めるものを指すリクエスト（`CustomerBookingCreateRequest`。空き枠を指し、行は `planCustomerBooking` が決める） | 載せない。プロパティ名と null 許可はカラムに合わせる |
| 既存の行の一部だけを書き換えるアクションのリクエスト（`BookingCancelRequest`、`PaymentRefundRequest` など） | 載せない。プロパティ名と null 許可はカラムに合わせる |
| まだ書いていない行のカラムの値だけを返すモデル（`SaleBreakdownResponse`。売上を作成すれば、その金額のカラムになる値） | 載せる。その表のルールで、ほかのカラムを `omittedColumns` に挙げる |
| 何も書かないリクエストと、行のモデルを包むレスポンス（`SaleCalculateRequest`、`SaleCalculateResponse`、`SaleReceiptResponse`、`CustomerDataExportResponse`） | 載せない。包んだ行のモデル（`SaleResponse`、`SaleBreakdownResponse`、`CustomerResponse` など）は、それぞれのルールで照合する |
| 複数の行を書き換えるアクションのリクエストと、その結果（`InventoryStockCountRequest`、`InventoryStockCountResponse`、`PurchaseOrderReceiveRequest`、`PurchaseOrderReceivedItem`） | 載せない。プロパティ名と null 許可はカラムに合わせる（入荷の `inventoryId`、`quantity` は在庫の移動の、`deliveryNotes` は発注のカラム）。結果に包む行のモデル（`InventoryTransactionResponse`、`PurchaseOrderResponse`）は、そのルールで照合する |
| 複数の行を一度に追加するリクエストと、その結果（`TreatmentPhotoBulkCreateRequest`、`TreatmentPhotoBulkCreateResponse`） | 載せない。包む行のモデル（`TreatmentPhotoCreateRequest`、`TreatmentPhotoResponse`）は、そのルールで照合する |
| 集計・計算結果（`ReviewSummaryResponse`、`SalesReportResponse`、`InventoryValueReportResponse`、`ReorderSuggestionResponse`、`InventoryAlertSummaryResponse`、`TreatmentStatisticsResponse` など） | 載せない |
| 保存せず、読むたびに複数の表から求めるモデル（`InventoryAlertResponse`。在庫のアラートは、商品、在庫の行、在庫の移動から求める） | 載せない。プロパティ名と null 許可は、もとのカラムに合わせる（`productId`、`inventoryId`、`lotNumber`、`expiryDate` など）。包む行のモデル（`InventoryAlertAcknowledgementResponse`）は、そのルールで照合する |
| 行を追加するアクションのリクエストで、サーバーが決めるカラムを書かないもの（`InventoryAlertAcknowledgeRequest`。サロン、重要度、`threshold`、使用期限は、今のアラートから、確認した人と時刻は、操作者とデータベースが決める。`AttachmentUploadUrlRequest`。状態、アップロードした人、URL の有効期限、日時は、操作者とデータベースが決める） | `create` として載せ、書かないカラムを `omittedColumns` に挙げる |
| 行のモデルに、保存しない値を添えるレスポンスと、保存しない値だけのレスポンス（`AttachmentUploadUrlResponse` の `uploadUrl` と `uploadHeaders`、`AttachmentDownloadUrlResponse`、`AttachmentPurgeResponse`、`ShareLinkCreateResponse` の `token`。署名付き URL は、発行のたびに求める。共有リンクのトークンは、発行の応答にだけあり、保存するのはハッシュである） | 載せない。包んだ行のモデル（`AttachmentResponse`、`ShareLinkResponse`）は、そのルールで照合する |
| カラムの値ではなく、そのもとになる値を受け取るリクエスト（`ShareLinkCreateRequest`。`password` は、ハッシュにして `passwordHash` に保存する。トークンのハッシュ、発行した人、日時は、サーバーが決める） | 載せない。カラムと同じ値のプロパティ（`expiresAt`、`maxDownloads`）は、名前と null 許可をカラムに合わせる |
| 行を指す秘密の値を送るリクエスト（`SharedFileGetRequest`、`SharedFileDownloadUrlRequest`。トークンとパスワードは、どのカラムにもない。カラムにあるのは、そのハッシュである） | 載せない |

テーブルのない機能は、コントラクトにない。すべてのオペレーションに実装があり、テーブルの行を読み書きするモデルは、すべてルールに載っている。

### ドメインを実装するとき

TypeSpec のモデルは、全ドメインで DB と一致している。ドメインを実装するときに API か DB を変える場合は、次の順に進める。

1. カラムを足す・変える必要があれば、マイグレーションを書き、`pnpm db:migrate` と `pnpm db:introspect` で `schema.ts` を更新する
2. TypeSpec のモデルを直し、`api-consistency-rules.ts` の該当ドメインのブロックを合わせる（新しいカラムを公開しない場合は `omittedColumns` に足す）
3. `pnpm generate` のあと `pnpm check:api-db` が成功することを確認する

## 関連ドキュメント

- [DB駆動ドメインモデル](./db-driven-domain-model.md)
- [TypeSpec API型定義ルール](./typespec-api-type-rules.md)
- [型生成システム](./type-generation-system.md)
- [バックエンドアーキテクチャガイドライン](./backend-architecture-guidelines.md)
