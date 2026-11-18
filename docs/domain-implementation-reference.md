# Domain Implementation Reference Guide

The Salon domain is the reference for every other domain of the backend. This document walks through it in the order in which a new domain is built, from the API contract to the tests, and explains the decisions the code makes on the way. Authentication is described in [Authentication and Authorization](./authentication.md) (Japanese); what a domain needs from it is in step 9 (the permission check) and step 10 (the `authenticated` wrapper). The service categories of a salon are built in the same steps; what they do differently because their data belongs to a salon is collected in [Data That Belongs to a Salon](#data-that-belongs-to-a-salon). So are the services of a salon; the same section names what they show that neither Salon nor the service categories do. The staff ledger of a salon is the third example there: data that belongs to a salon and none of which is public. The customer ledger is built in these steps too; what it shows because its data belongs to no salon and none of it is public is collected in [Data That Belongs to No Salon](#data-that-belongs-to-no-salon).

The excerpts are copied from the file named above each of them and shortened where marked `// ...`; the file is the authority. The rules behind the code (no `any`, no type assertions, no exceptions, API property names equal column names) are stated in [CLAUDE.md](../CLAUDE.md) and are not repeated here.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [1. API Contract](#1-api-contract)
- [2. Generated Types](#2-generated-types)
- [3. Database Schema](#3-database-schema)
- [4. Models](#4-models)
- [5. Validation Schemas](#5-validation-schemas)
- [6. Mappers](#6-mappers)
- [7. Repository Interface](#7-repository-interface)
- [8. Repository Implementation](#8-repository-implementation)
- [9. Use Cases](#9-use-cases)
- [10. Handlers and Router](#10-handlers-and-router)
- [11. Wiring](#11-wiring)
- [12. Tests](#12-tests)
- [Data That Belongs to a Salon](#data-that-belongs-to-a-salon)
- [Rows That Belong to a Record of a Salon](#rows-that-belong-to-a-record-of-a-salon-the-staff-schedules)
- [A Record a Mailed Token Gives Access To](#a-record-a-mailed-token-gives-access-to-the-staff-invitations)
- [Rows of Another Domain That a Salon Keeps](#rows-of-another-domain-that-a-salon-keeps-the-staff-accounts)
- [Data of a Salon Whose Routes Are Not Below It](#data-of-a-salon-whose-routes-are-not-below-it-the-booking-ledger)
- [A Request That States Its Amounts](#a-request-that-states-its-amounts-the-sales-ledger)
- [Rows Below a Record That Its Value Is Counted From](#rows-below-a-record-that-its-value-is-counted-from-the-payments-of-a-sale)
- [Figures Counted from the Rows of Other Domains](#figures-counted-from-the-rows-of-other-domains-the-sales-reports)
- [Data That Belongs to No Salon](#data-that-belongs-to-no-salon)
- [A Balance and the Ledger of Its Changes](#a-balance-and-the-ledger-of-its-changes-the-points)
- [Error Handling](#error-handling)
- [Implementation Checklist](#implementation-checklist)

## Architecture Overview

A request passes through three packages:

```
HTTP request
  → authenticated (api)            access token → actor, or 401 (not for public operations)
  → handler      (api)             passes the actor and the raw input on
  → use case     (domain)          authorizes, validates, maps, decides
  → repository   (infrastructure)  runs the queries, returns a Result
  ← use case                       maps the rows to the API model
  ← handler                        Result → response or problem details
```

The salon routes import the domain package and the generated types, never the repository: `createApp` constructs the repository and hands it in. The domain package uses the Drizzle tables as types only and runs no query.

What the Salon domain consists of:

| Step | Layer | Package | Files |
|------|-------|---------|-------|
| 1 | API contract | `specs` | `models/salon.tsp`, `operations/salon-operations.tsp` |
| 2 | Generated types | `backend/packages/generated` | `src/api-types.ts`, `src/schema.ts` |
| 3 | Database schema | `backend/packages/database` | `sql/migrations/*.sql`, `src/schema.ts`, `src/scripts/api-consistency-rules.ts` |
| 4 | Models | `backend/packages/domain` | `src/models/salon.ts` |
| 5 | Validation | `backend/packages/domain` | `src/schemas/salon.schema.ts` |
| 6 | Mappers | `backend/packages/domain` | `src/mappers/write/salon.mapper.ts`, `src/mappers/read/salon.mapper.ts` |
| 7 | Repository interface | `backend/packages/domain` | `src/repositories/salon.repository.ts` |
| 8 | Repository implementation | `backend/packages/infrastructure` | `src/repositories/salon.repository.impl.ts` |
| 9 | Use cases | `backend/packages/domain` | `src/business-logic/salon/` |
| 10 | Handlers and router | `backend/packages/api` | `src/routes/salon/` |
| 11 | Wiring | `backend/packages/api` | `src/index.ts` |
| 12 | Tests | domain and api | `src/__tests__/` |

Steps 1 to 3 belong together. The database is the source of truth for names and nullability, so the contract is written against the table, and `pnpm check:api-db` compares the two.

Shared by every domain and already in place: `Result` (`backend/packages/utility/src/result/result.ts`), `DomainError` and `parseWith` (`backend/packages/domain/src/shared/`), `Actor` (`backend/packages/domain/src/models/auth.ts`), the rules that request schemas share (`backend/packages/domain/src/schemas/rules.ts`), the column conversions of the read mappers (`backend/packages/domain/src/mappers/read/columns.ts`), `describeDatabaseError`, `attempt` and `containing`, the LIKE pattern that finds a keyword literally (`backend/packages/infrastructure/src/database/`), and the response helpers, the `authenticated` wrapper, the links of a page (`pageLinks`) and the converters of query parameters of the API package (`backend/packages/api/src/shared/`).

## 1. API Contract

Files: `specs/models/salon.tsp` and `specs/operations/salon-operations.tsp`, both imported in `specs/main.tsp`. The ID scalar `SalonId` is in `specs/models/_shared/common.tsp`; the response wrappers and `ProblemDetails` are in `specs/models/_shared/common-api-patterns.tsp`.

Salon has four models: `SalonResponse`, `SalonCreateRequest`, `SalonUpdateRequest` and `SalonSearchRequest`. The same nullable column appears in the first three like this (`specs/models/salon.tsp`):

```typespec
model SalonResponse {
  // ...
  @doc("名称のカナ表記。未設定の場合はnull")
  nameKana: string | null;
  // ...
}

model SalonCreateRequest {
  // ...
  @doc("名称のカナ表記。未設定の場合はnull")
  @maxLength(255)
  nameKana: string | null;
  // ...
}

model SalonUpdateRequest {
  // ...
  @doc("名称のカナ表記。nullでクリア")
  @maxLength(255)
  nameKana?: string | null;
  // ...
}
```

The property is named after the column and allows `null` because the column does. Create requires the key; update makes it optional, and `null` in an update clears the column.

The operations of the interface `SalonCrud`, under `@route("/api/v1/salons")`:

| Operation | Route | Request | Success | Declared errors | Access |
|-----------|-------|---------|---------|-----------------|--------|
| `list` | `GET /api/v1/salons` | `SalonSearchRequest` as query parameters | 200, `CursorPaginationResponse<SalonResponse>` | 400, `PublicErrors` | `@useAuth(NoAuth)` |
| `create` | `POST /api/v1/salons` | `SalonCreateRequest` | 201 with `Location`, `ApiResponse<SalonResponse>` | 400, 409, `RequestBodyErrors`, `CommonErrors` | `admin` |
| `get` | `GET /api/v1/salons/{id}` | none | 200, `ApiResponse<SalonResponse>` | 400, 404, `PublicErrors` | `@useAuth(NoAuth)` |
| `update` | `PATCH /api/v1/salons/{id}` | `SalonUpdateRequest` | 200, `ApiResponse<SalonResponse>` | 400, 404, 409, `RequestBodyErrors`, `CommonErrors` | `admin`, or the `owner` or a `manager` of the salon |
| `delete` | `DELETE /api/v1/salons/{id}` | none | 204 | 400, 404, 409, `CommonErrors` | `admin`, or the `owner` of the salon |

Three decisions to copy:

- **Only what is implemented is specified.** Every operation in the file has a handler. Each declares its success response, from which the handler takes its response type (step 10), and the 400, 404 and 409 responses its use case can produce.
- **Update is `PATCH`**, and filtering is part of `list`. There is no `PUT` and no separate search route.
- **Who may call an operation is in the contract.** A public operation carries `@useAuth(NoAuth)` and `PublicErrors` (429, 500). An operation with a permission check declares `CommonErrors`, which adds 401 and 403, and names the roles in its `@doc`. `SessionErrors` (401 without 403) is for an operation that any signed-in user may call; Salon has none.

The naming and typing rules for TypeSpec are in [TypeSpec API Type Rules](./typespec-api-type-rules.md).

## 2. Generated Types

```bash
pnpm generate
```

This compiles TypeSpec to `specs/tsp-output/@typespec/openapi3/generated/openapi.yaml`, then generates the frontend client (`frontend/packages/api-client/src/generated/`) and the backend types:

- `backend/packages/generated/src/api-types.ts` exports `components` (the models, for example `components['schemas']['Models.SalonResponse']`) and `operations` (keyed `<Interface>_<operation>`, for example `operations['SalonCrud_list']`).
- `backend/packages/generated/src/schema.ts` exports Zod schemas for the enums, for example `DayOfWeekTypeSchema`.

Generated files are never edited. They are committed together with the TypeSpec change, and `pnpm check:generated` fails in CI when they are not what `pnpm generate` produces. See [Type Generation System](./type-generation-system.md).

## 3. Database Schema

The Salon domain is stored in `salons` and `opening_hours` (`backend/packages/database/src/schema.ts`, excerpt):

```typescript
export const salons = pgTable(
  'salons',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: varchar({ length: 255 }).notNull(),
    nameKana: varchar({ length: 255 }),
    // ...
    latitude: numeric({ precision: 10, scale: 8 }),
    // ...
    email: varchar({ length: 255 }).notNull(),
    // ...
    imageUrls: text().array().notNull(),
    // ...
    businessHours: jsonb(),
    // ...
    deletedAt: timestamp({ withTimezone: true, mode: 'string' }),
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

`schema.ts` is generated from the database and never edited. A table changes through a migration:

1. Write `backend/packages/database/sql/migrations/<YYYYMMDDHHMM>_<description>.sql`. For an example, see `202611140900_salon_list_columns_not_null.sql` in that directory: it made the list columns of `salons` `text[] NOT NULL`, which is what allows the API model to declare them as `string[]` without `null`.
2. `pnpm db:migrate`, then `pnpm db:introspect` (regenerates `schema.ts` and `relations.ts`), then `pnpm db:generate-sql` (regenerates `sql/setup.sql`).
3. Commit the migration with the three regenerated files. `pnpm check:db-schema` guards them in CI.

The commands are described in [Database Commands](../backend/packages/database/docs/database-commands.md).

The table decides much of what the layers above look like:

| In the table | Consequence |
|--------------|-------------|
| Column names are camelCase | They are the API property names; no mapper renames anything |
| `id` has `defaultRandom()` | The database assigns the ID; a create request never contains one |
| `numeric` columns (`latitude`, `longitude`, `rating`, `taxRate`) | The driver reads and writes them as strings; the mappers convert (step 6) |
| `timestamp` with `mode: 'string'` | Timestamps arrive in PostgreSQL's text format; the read mapper converts them to ISO 8601 |
| `jsonb` (`businessHours`) | The value is `unknown` to TypeScript; the read mapper checks it |
| `uniqueIndex('salons_email_unique')` over the rows that are not deleted | The source of the `alreadyExists` error (step 8); the email of a deleted salon is free again |
| `deletedAt` | Delete is a soft delete; the repository hides deleted rows |
| `opening_hours.salonId` references `salons.id` | The calendar is a child table, embedded in the API model as `openingHours` |
| `uniqueIndex('opening_hours_salon_date_unique')` | The calendar has one row for a date of a salon; the available slots read that one row |

### `pnpm check:api-db`

The check compares API models with their tables: same names, same nullability, and the optionality that the kind of model calls for. Which model belongs to which table is listed in `backend/packages/database/src/scripts/api-consistency-rules.ts`:

```typescript
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

- `embedded` names properties that are rows of a child table, not columns. The model of one such row has a rule of its own (`Models.OpeningHours`). The rules of the service response and of the service create and update requests name `options` in the same way, with `Models.ServiceOption` as the model of a row.
- `computed` names properties that are not columns either: values the server works out for the response and stores nowhere. Salon has none; the rule of `Models.SessionResponse` names `current` this way.
- `omittedColumns` names the columns the model leaves out on purpose. Once it is given, every other column must be in the model, so leaving a column out is a decision and not an oversight.
- `narrowed` names properties whose enum has only some of the values of the enum of their column. Without it the two sets of values have to be the same. Salon has none; the rules of the staff accounts name `role` this way ([below](#rows-of-another-domain-that-a-salon-keeps-the-staff-accounts)).

The same file has one block of rules per domain. The table-backed models of every domain are listed there with `omittedColumns` and agree with their tables. Any difference fails the check; there is no list of tolerated differences. Models without a table (computed reports, action requests, and values that are not stored, such as a signed URL or the token of a share link) have no rule.

When a domain changes its TypeSpec models or its tables, its block of rules changes with them, and `pnpm check:api-db` must pass before the change is committed.

## 4. Models

`backend/packages/domain/src/models/salon.ts` holds the types of the domain and the schema of its ID. No shape is declared by hand: API types come from the generated package, database types from the Drizzle tables.

```typescript
export const salonIdSchema = uuidSchema.brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

// ...

// API types, generated from TypeSpec
export type ApiSalonResponse = components['schemas']['Models.SalonResponse']
export type ApiSalonCreateRequest =
  components['schemas']['Models.SalonCreateRequest']
// ...
export type ApiSalonSearchRequest = NonNullable<
  operations['SalonCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbSalon = DeepRequired<typeof salons.$inferSelect>

type SalonManagedColumn =
  | 'id'
  | 'rating'
  | 'reviewCount'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewSalon = DeepRequired<
  Omit<typeof salons.$inferInsert, SalonManagedColumn>
>
export type DbSalonChanges = Partial<DbNewSalon>

// ...

/** What an update does to the calendar of a salon. */
export type OpeningHoursChange =
  | { type: 'keep' }
  | { type: 'replace'; openingHours: DbNewOpeningHours[] }
```

- **`SalonId` is a branded UUID.** A plain string is not accepted where a `SalonId` is expected; the only way to get one is to parse a value with `salonIdSchema`. `parseSalonId`, in the same file, does that for a path parameter. It validates `{ id }` instead of the bare value so that a failure is reported under the field `id`.
- **`uuidSchema` spells every ID the way the database does.** It is `z.uuid().toLowerCase()`, in `backend/packages/domain/src/shared/identifier.ts`. The letters of a UUID may be written in either case, and PostgreSQL always returns them in lower case. An ID is compared as a string in several places (is this the salon of the actor, is this the administrator's own account), so an ID from a request is brought into the lower-case spelling when it is checked. Build the ID schema of a new domain from `uuidSchema`, not from `z.uuid()`.
- **`SalonManagedColumn`** lists the columns a request never writes: the database assigns them, other features maintain them, or the API does not expose them yet. The same list is the `omittedColumns` of the create and update rules in step 3.
- **`DeepRequired` on `$inferInsert`.** Drizzle makes a column optional for an insert when it is nullable or has a default. `DeepRequired` makes every column required again, with `null` still allowed where the column allows it. A write therefore states every value, and the defaults of `timezone`, `currency`, `taxRate` and `isActive` are never relied on. This is "Create: every property required" at the type level.
- **`DbNewOpeningHours` has no `salonId`.** The repository attaches it inside the transaction, once the salon has an ID.
- **`OpeningHoursChange` is a sum type** rather than an optional list: "leave the calendar alone" and "replace it with nothing" are different, and the repository matches on the two cases exhaustively.

`Omit` and `DeepRequired` come from `@beauty-salon-backend/utility`; this `Omit` only accepts keys the type has.

## 5. Validation Schemas

`backend/packages/domain/src/schemas/salon.schema.ts` has one Zod schema per request:

```typescript
export const salonCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(255),
  nameKana: nonBlankText.max(255).nullable(),
  // ...
  email: z.email().max(255),
  // ...
  // The column keeps two decimal places.
  taxRate: z.number().min(0).max(100).multipleOf(0.01),
  isActive: z.boolean(),
  openingHours: openingHoursListSchema,
}) satisfies z.ZodType<ApiSalonCreateRequest>

export const salonUpdateRequestSchema = salonCreateRequestSchema
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiSalonUpdateRequest>
```

`nonBlankText` and `atLeastOneProperty` are not Salon's own, and neither is `phoneNumber`, the rule of the two phone numbers of a salon. The rules that the request schemas of more than one domain share are in `backend/packages/domain/src/schemas/rules.ts`. The file also holds `lowerCaseEmail`, an address that is stored and compared in lower case, `MAX_INTEGER`, the largest value of an `integer` column, and `noRepeatedEntries`, for a list in which no entry may come twice; Salon needs none of the three. The shape of a time slot in a JSON column is there as well (`timeSlot`, and `orderedTimeSlot` for a request, in which a slot ends after it begins): the business hours of a salon and the preferences of a customer both hold time slots. Two rules are about time zones: `timeZoneName`, the name of a time zone that the runtime knows, is the rule of the `timezone` of a salon, and `inTimeZone` gives a moment in such a zone, which is how the day of a visit is told from the beginning of a booking.

```typescript
/** A nullable text is either null or says something: '' is not "unset". */
export const nonBlankText = z.string().regex(/\S/, 'Must not be blank')

// ...

/**
 * For the schema of an update, in which every property may be absent: a
 * request that names none changes nothing and is refused. An unknown
 * property is reported as such, not as an empty request.
 */
export const atLeastOneProperty = (
  context: z.core.ParsePayload<object>,
): void => {
  if (context.issues.length === 0 && Object.keys(context.value).length === 0) {
    context.issues.push({
      code: 'custom',
      path: [],
      message: 'At least one property must be specified',
      input: context.value,
    })
  }
}
```

- **`satisfies z.ZodType<...>`** ties the schema to the generated type: what the schema produces must be assignable to the API type. A property that the TypeSpec model adds or retypes is a compile error until the schema follows.
- **`z.strictObject`** rejects a property the model does not have. A client that sends `rating` gets a validation error naming `rating`; the property is not silently dropped.
- **Three sources of rules.** The shape comes from the API type, the length limits from the columns (`varchar(255)` → `.max(255)`), and the rest are business rules: text must not be blank, a calendar entry must fall on the day of the week it names, closing must be later than opening.
- **Cross-field rules use `.check()`** and push an issue with the `path` of the offending property, so the client learns which field to fix.
- **The update schema is derived** from the create schema with `exactPartial()`: every key may be absent, and a key that is present is checked by the same rule as on create. Its one rule of its own, `atLeastOneProperty`, rejects an empty request.
- **`salonSearchRequestSchema`** validates the list parameters, including `cursor: salonIdSchema.exactOptional()`.
- **`storedBusinessHoursSchema`** is the shape of the `businessHours` JSON column without the business rules. The request schema extends it with the rules; the read mapper uses it as it is, because stored data is checked for shape only. A day of the weekly hours has no time zone of its own: its slots are times in the `timezone` of the salon, as the times of a calendar row (`openingHours`) are, so the hours and the salon cannot disagree. The entries once had the key, and the migration `202611160500_business_hours_without_time_zone.sql` takes it out of the values that are stored: a stored value with a key the model does not have is a salon that cannot be read.

Schemas are run through `parseWith(schema, input, message)` in `backend/packages/domain/src/shared/validation.ts`. It takes `unknown`, returns `Result<T, DomainError>`, and reports every broken rule at once, each as `{ field, rule, message }`.

## 6. Mappers

Property names are the column names, so a mapper never renames. It converts the representation of three kinds of column: `numeric`, `timestamp` and `jsonb` (step 3).

API request → rows (`backend/packages/domain/src/mappers/write/salon.mapper.ts`):

```typescript
const toNumeric = (value: number): string => String(value)

// ...

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

`fromUpdateRequest` does the same for the properties that are present and nothing for the absent ones. It returns `{ type: 'keep' }` for the calendar when `openingHours` is absent and `{ type: 'replace', ... }` when it is present, even if the list is empty.

Rows → API response. The two conversions every read mapper needs are in `backend/packages/domain/src/mappers/read/columns.ts`:

```typescript
/** `numeric` is read as a string and returned as a number. */
export const numericSchema = z.string().transform(Number).pipe(z.number())

/** `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601. */
export const timestampSchema = z
  .string()
  .transform((value) => parseISO(value))
  .pipe(z.date())
  .transform((value) => value.toISOString())
```

`backend/packages/domain/src/mappers/read/salon.mapper.ts` imports them:

```typescript
const businessHoursSchema = z.array(storedBusinessHoursSchema).nullable()

const convertedColumnsSchema = z.object({
  latitude: numericSchema.nullable(),
  longitude: numericSchema.nullable(),
  rating: numericSchema.nullable(),
  taxRate: numericSchema,
  businessHours: businessHoursSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

// ...

const toApiSalon = (
  salon: DbSalon,
  openingHours: DbOpeningHours[],
): Result<ApiSalonResponse, DomainError> => {
  const { deletedAt, ...columns } = salon

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, salon, 'Invalid stored salon'),
      (converted) => ({
        ...columns,
        ...converted,
        openingHours: openingHours.map(toApiOpeningHours),
      }),
    ),
    (error) => storedDoesNotMatch(salon.id, error),
  )
}

/** The request was fine; the stored row is not. */
const storedDoesNotMatch = (id: string, cause: unknown): DomainError =>
  DomainErrors.database(
    `Stored salon ${id} does not match the API model`,
    cause,
  )
```

- **The conversion is a parse.** A cast would claim that the `jsonb` value has the API shape; the schema checks it. The `pipe` steps also reject a number or a date that did not convert.
- **The read mapper returns a `Result`.** A stored row that does not fit is a `database` error, not a `validation` error: the client did nothing wrong and gets a 500 without details, while the cause is logged.
- **Hidden columns are removed by destructuring**, the same three that the response rule in step 3 omits.

## 7. Repository Interface

`backend/packages/domain/src/repositories/salon.repository.ts` states what the use cases need, in terms of the model types:

```typescript
export interface ISalonRepository {
  create(
    salon: DbNewSalon,
    openingHours: DbNewOpeningHours[],
  ): Promise<Result<SalonWithOpeningHours, DomainError>>

  findById(
    id: SalonId,
  ): Promise<Result<SalonWithOpeningHours | null, DomainError>>

  /** Whether there is such a salon, for what belongs to a salon. */
  exists(id: SalonId): Promise<Result<boolean, DomainError>>

  /** Newest first. */
  list(criteria: SalonListCriteria): Promise<Result<SalonList, DomainError>>

  /** Resolves to null when the salon does not exist. */
  update(
    id: SalonId,
    changes: DbSalonChanges,
    openingHours: OpeningHoursChange,
  ): Promise<Result<SalonWithOpeningHours | null, DomainError>>

  /** Marks the salon as deleted, unless one of its bookings is not finished. */
  delete(id: SalonId): Promise<Result<SalonDeletion, DomainError>>
}
```

- **A missing salon is not an error here.** `findById` and `update` resolve to `null`, and `delete` answers with a sum type (`SalonDeletion`: `deleted`, `notFound`, or `bookingsUnfinished` while a booking of the salon is not finished); the use case turns a missing salon into `notFound` and the bookings into a conflict (409). The error side of the `Result` is for what went wrong.
- **Two guarantees**, stated in the comment above the interface: deleted salons are invisible to every method, and each write is atomic, so a salon and its calendar change together or not at all.
- **`SalonListCriteria` has no optional property.** A filter that is not applied is `null` (or an empty list for `features`), so the use case states every criterion.
- **`exists` is for the domains whose data belongs to a salon.** Their use cases need to know that the salon is there, not what it holds (see [Data That Belongs to a Salon](#data-that-belongs-to-a-salon)).

## 8. Repository Implementation

`backend/packages/infrastructure/src/repositories/salon.repository.impl.ts` implements the interface with Drizzle. It contains no `throw`, no `catch` and no cast.

### Failures become values, and a unique violation becomes `alreadyExists`

```typescript
const emailUniqueViolation = {
  code: '23505',
  constraint_name: 'salons_email_unique',
}

const toDomainError =
  (message: string, email: string | null) =>
  (cause: unknown): DomainError =>
    match({ cause, email })
      .with(
        {
          email: P.string,
          cause: P.union(emailUniqueViolation, { cause: emailUniqueViolation }),
        },
        (violation) =>
          DomainErrors.alreadyExists('Salon', 'email', violation.email),
      )
      .otherwise(() =>
        DomainErrors.database(message, describeDatabaseError(cause)),
      )

const attempt = async <T>(
  message: string,
  email: string | null,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, email),
  )
```

Every method runs its queries inside `attempt`. `Result.fromPromise`, in the utility package, is the one place where a rejected query is caught and turned into a value; `toDomainError` classifies it:

- **The unique index is the uniqueness check.** There is no "does this email exist" query before the insert, which would leave a gap between the check and the write. The repository recognises SQLSTATE `23505` on the index `salons_email_unique` (PostgreSQL reports its name as `constraint_name`), on the error or on its `cause`, because Drizzle wraps the driver's error.
- **The value in the error comes from the caller.** `attempt` is given the email being written (`salon.email` on create, `changes.email ?? null` on update), so nothing is parsed out of PostgreSQL's message. A method that writes no email passes `null`, and a violation there is not an expected failure.
- **Everything else is a `database` error** whose cause is `describeDatabaseError(cause)`: the driver's message, the SQLSTATE, the constraint, table and column names, and the statement with placeholders. The bound values are left out, so the cause is safe to log.
- **A deleted salon gives its email back.** Delete is a soft delete and the row keeps its email, but the index covers only the rows whose `deletedAt` is null, so another salon can take the email.

### Keyset pagination

```typescript
    // Keyset pagination on (createdAt, id): the page starts after the row
    // the cursor names, wherever that row is by now.
    const cursorSalon = alias(salons, 'cursor_salon')
    const afterCursor =
      after === null
        ? undefined
        : sql`(${salons.createdAt}, ${salons.id}) < (${this.db
            .select({ createdAt: cursorSalon.createdAt, id: cursorSalon.id })
            .from(cursorSalon)
            .where(eq(cursorSalon.id, after))})`

    return attempt('Failed to list salons', null, async () => {
      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(salons)
          .where(and(filters, afterCursor))
          .orderBy(desc(salons.createdAt), desc(salons.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(salons).where(filters),
      ])
```

- **The cursor is the ID of the last salon of the previous page**, not an offset. The search schema validates it as a `SalonId`, and the list use case returns it as `meta.nextCursor`.
- **The order is `(createdAt, id)` descending.** `id` breaks ties between salons created in the same instant, so the order is total. The condition is a row comparison against the cursor row, looked up by a subquery: the page holds the rows that sort after it.
- **Pages are stable.** A salon added while a client walks the list sorts before every page already delivered, so nothing is skipped or repeated. The subquery does not filter on `deletedAt`, so a cursor still works after its salon was deleted. A cursor that names no salon yields an empty page.
- **`limit + 1` rows are read.** The extra row only answers `hasMore` and is cut off. `total` counts the matches of the filters without the cursor, across all pages.
- **Pages are walked forwards only**: `prevCursor` is always `null`.

The calendars of a page are loaded with one query for all its salons and grouped by `salonId`.

### Writes are transactions; the calendar is replaced as a whole

```typescript
    return attempt('Failed to update salon', changes.email ?? null, () =>
      this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(salons)
          .set({ ...changes, updatedAt: CLOCK })
          .where(and(eq(salons.id, id), notDeleted))
          .returning()
        if (updated === undefined) {
          return null
        }

        await match(openingHoursChange)
          .with({ type: 'keep' }, async () => undefined)
          .with({ type: 'replace' }, async (replacement) => {
            await tx.delete(openingHours).where(eq(openingHours.salonId, id))
            await insertOpeningHours(tx, id, replacement.openingHours)
          })
          .exhaustive()

        return withOpeningHours(tx, updated)
      }),
    )
```

- **One transaction for the salon and its calendar.** If the email is taken or the calendar cannot be inserted, the transaction rolls back and none of the request is applied.
- **`replace` deletes every row of the calendar and inserts the new list.** There is no per-entry diff; `openingHours` in a `PATCH` is the whole calendar. `keep` touches nothing.
- **`notDeleted` is part of the `where`**, so a deleted salon is not updated and the method resolves to `null`.
- **The calendar is read back** inside the transaction (`withOpeningHours`), so the response shows what is stored: entries in date order, times with seconds.
- **`updatedAt` is set by the database**, not by the application clock. `CLOCK` (`backend/packages/infrastructure/src/database/clock.ts`) is `clock_timestamp()`, the moment the statement gets to the row: an update that waited for another update of the same salon is recorded as the later of the two. `now()` is the moment the transaction began, which is before the wait, and would record it as the earlier.

`create` is built the same way: insert the salon, insert the calendar with the new ID, read the calendar back. Under `noUncheckedIndexedAccess` the first of the returned rows may be `undefined`; the method turns that case into a `database` error instead of asserting it away. `delete` sets `deletedAt` and resolves to whether a row changed; the row and its calendar are kept.

The helper functions take a `DatabaseExecutor`, which is either the database or a transaction on it, so the same query code runs in both. The class is exported from `backend/packages/infrastructure/src/index.ts`.

## 9. Use Cases

One class per operation in `backend/packages/domain/src/business-logic/salon/`, each with the same constructor and one `execute` method. There is no base class. The dependencies are one object (`_shared/dependencies.ts`):

```typescript
export interface SalonUseCaseDependencies {
  salonRepository: ISalonRepository
}
```

`update-salon.usecase.ts` shows every step a use case can have:

```typescript
export class UpdateSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  /**
   * Changes the properties present in the request and leaves the others as
   * they are. `openingHours`, when present, replaces the whole calendar.
   * Whether the actor may is decided from the ID alone, before the request
   * is read and before the salon is looked up.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiSalonResponse, DomainError>> {
    const salonId = parseSalonId(id)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayUpdateSalon(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }

    const request = parseWith(
      salonUpdateRequestSchema,
      input,
      'Invalid salon update',
    )
    if (request.type === 'error') {
      return request
    }

    const { changes, openingHours } = SalonWriteMapper.fromUpdateRequest(
      request.data,
    )
    const updated = await this.dependencies.salonRepository.update(
      salonId.data,
      changes,
      openingHours,
    )
    if (updated.type === 'error') {
      return updated
    }
    if (updated.data === null) {
      return Result.error(DomainErrors.notFound('Salon', salonId.data))
    }

    return SalonReadMapper.toApiSalon(
      updated.data.salon,
      updated.data.openingHours,
    )
  }
}
```

- **The actor comes first, and the permission is decided first.** `actor` is who the access token stands for (`Actor` in `backend/packages/domain/src/models/auth.ts`); the handler got it from `authenticated` (step 10). The rule is a pure function in `_shared/authorization.ts`, shown below. A refusal is `DomainErrors.forbidden()`, a 403. Because a salon is public information, the answer does not depend on whether the salon exists: the owner of another salon gets 403 for every well-formed ID but that of their own salon.
- **The inputs are `unknown`.** What arrives over HTTP is not a `SalonUpdateRequest` until it has been checked. If the handler declared the body with the request type, the compiler would accept an unchecked value as checked, which is a type assertion in everything but name. With `unknown`, the value cannot be used before `parseWith` has returned the typed one, and validation happens in exactly one place whoever the caller is.
- **A failed step is returned as it is.** After `request.type === 'error'` the value is the error variant, which fits every `Result<T, DomainError>`.
- **The use case decides what "not found" is.** The repository reported `null`; the use case names the entity and the ID.
- **No uniqueness check here.** The use case relies on the repository to report `alreadyExists` (step 8).
- **The return value is the API model**, mapped from the rows the repository read back.

| Use case | `execute` | Permission | Success data |
|----------|-----------|------------|--------------|
| `CreateSalonUseCase` | `(actor: Actor, input: unknown)` | `mayCreateSalon(actor)` | `ApiSalonResponse` |
| `GetSalonUseCase` | `(id: unknown)` | none: public | `ApiSalonResponse` |
| `ListSalonsUseCase` | `(input: unknown)` | none: public | `SalonPage`: `data` and pagination `meta` |
| `UpdateSalonUseCase` | `(actor: Actor, id: unknown, input: unknown)` | `mayUpdateSalon(actor, salonId)` | `ApiSalonResponse` |
| `DeleteSalonUseCase` | `(actor: Actor, id: unknown)` | `mayDeleteSalon(actor, salonId)` | the `SalonId` that was deleted |

The three rules are the whole of `_shared/authorization.ts`:

```typescript
/** A new salon is a new tenant; only the platform's administrators add one. */
export const mayCreateSalon = (actor: Actor): boolean =>
  actor.scope.type === 'platform'

/** Administrators, and the owner and the managers of the salon itself. */
export const mayUpdateSalon = (actor: Actor, salonId: SalonId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon', role: P.union('owner', 'manager') },
      (scope) => scope.salonId === salonId,
    )
    .with(
      { type: 'salon', role: 'staff' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()

/** Administrators, and the owner of the salon itself. */
export const mayDeleteSalon = (actor: Actor, salonId: SalonId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon', role: 'owner' },
      (scope) => scope.salonId === salonId,
    )
    .with(
      { type: 'salon', role: P.union('manager', 'staff') },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
```

A rule reads `actor.scope`, which the authentication derived from the user's role and the staff member or customer the user is linked to. It needs no repository, so it is tested as a plain function. A domain whose data belongs to a salon compares the salon of the actor with the salon in the path of the request in the same way (`mayManageServiceCategories` in `business-logic/service-category/_shared/authorization.ts`); what to answer for data of another salon is in [Authentication and Authorization](./authentication.md). A domain whose data belongs to no salon decides from the actor alone (`mayHandleCustomers` in `business-logic/customer/_shared/authorization.ts`).

`ListSalonsUseCase` applies the default `limit` of 20, turns absent filters into `null` for the repository and builds `meta`: `nextCursor` is the ID of the last salon of the page when `hasMore` is true, otherwise `null`.

The use cases and `SalonUseCaseDependencies` are exported from `business-logic/salon/index.ts`, and the package exports them with the models, the repository interface and the shared error and validation code from `backend/packages/domain/src/index.ts`. Schemas and mappers stay internal to the package.

## 10. Handlers and Router

Each operation has a handler file in `backend/packages/api/src/routes/salon/`, and `index.ts` there exports `createSalonRouter(dependencies, authenticated)`. A handler is a factory over `SalonUseCaseDependencies`: it passes `req.body`, `req.params.id` or the decoded query to the use case and matches the `Result` into a response or into problem details.

The handlers of create, update and delete also take `authenticated` (`backend/packages/api/src/shared/authentication.ts`) and are wrapped with it. From `backend/packages/api/src/routes/salon/update-salon.handler.ts`:

```typescript
  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)
```

`authenticated` answers 401 when the request has no access token that works, and otherwise calls the handler with the actor. The handlers of list and get are not wrapped.

The layout of the API package, the handler pattern, the shared helpers and the middleware are described in the [API Route Modular Structure Guide](./api-route-modular-structure.md).

## 11. Wiring

`createApp` in `backend/packages/api/src/index.ts` constructs each repository once and mounts the router. `authenticated` is built once, from the authentication dependencies, a few lines above:

```typescript
  const authenticated = createAuthenticated(authDependencies)

  // ...
  const salonRepository = new SalonRepository(database)
  // ...
  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter({ salonRepository }, authenticated),
  )
```

A new domain adds one such statement next to it, before `notFoundHandler`. The salon repository has a name because the routers of the service categories, of the services and of the staff ledger, mounted in the three statements after it at `${API_BASE_PATH}/salons/:salonId/service-categories`, `${API_BASE_PATH}/salons/:salonId/services` and `${API_BASE_PATH}/salons/:salonId/staff`, are given the same instance. So are the routers of the staff invitations, of the staff accounts and of the staff schedules, mounted after them below a staff member, at `${API_BASE_PATH}/salons/:salonId/staff/:id/invitation`, `${API_BASE_PATH}/salons/:salonId/staff/:id/account` and `${API_BASE_PATH}/salons/:salonId/staff/:id/schedules`. The dependencies of the staff invitations are built between the salon repository and the Salon router (the lines left out above), because a second router shares them: the one for whoever holds a mailed token, mounted at `${API_BASE_PATH}/auth/staff-invitation`. It is given `authenticated` as well, for its one route that needs a signed-in user. The router of the staff profiles follows at `${API_BASE_PATH}/staff-profiles`, with a repository of its own; it is given `authenticated` for the two routes of a staff member's own profile, and its list and its get stay public. The router of the customer ledger is mounted after them at `${API_BASE_PATH}/customers`, with a repository of its own and the `clock` of the authentication dependencies: `createApp` builds one function that returns the current time and hands it to both. Nothing changes in `backend/apps/server`: it reads the configuration, connects the database, creates the mailer and the authenticator of two-factor authentication and calls `createApp({ database, logger, mailer, twoFactorAuthenticator, settings })`.

## 12. Tests

| File | Kind | What it covers |
|------|------|----------------|
| `backend/packages/domain/src/__tests__/salon.schema.test.ts` | unit | the request schemas: what they accept and the rules they reject |
| `backend/packages/domain/src/__tests__/salon.mapper.test.ts` | unit | both mappers, including stored rows that do not fit |
| `backend/packages/domain/src/__tests__/salon.usecase.test.ts` | unit | each use case against a stubbed repository, and who may change a salon |
| `backend/packages/domain/src/__tests__/fixtures.ts` | helper | a valid request, rows as the driver returns them, `salonRepositoryWith` (the stub of the repository), `brokenRules` |
| `backend/packages/domain/src/__tests__/auth-fixtures.ts` | helper | `actors`: an admin, a member of a salon by role, a customer with and without a customer record, a user without a scope |
| `backend/packages/api/src/routes/salon/_shared/__tests__/` | unit | link building and query decoding |
| `backend/packages/api/src/__tests__/salon.integration.test.ts` | integration | every endpoint through HTTP against PostgreSQL, signed in as the user the scenario needs |

The repository has no unit test of its own; its queries, transactions and constraint handling are exercised by the integration tests against a real PostgreSQL.

Use case tests replace the repository with a stub that holds one salon, and a test overrides the method it is about. The stub is in `backend/packages/domain/src/__tests__/fixtures.ts`, and `salon.usecase.test.ts` imports it as `repositoryWith`:

```typescript
/** A salon repository that holds one salon; a test overrides what it needs. */
export const salonRepositoryWith = (
  overrides: Partial<ISalonRepository> = {},
): ISalonRepository => {
  const stored = { salon: dbSalon(), openingHours: [dbOpeningHours()] }

  return {
    create: vi.fn(async () => Result.success(stored)),
    findById: vi.fn(async () => Result.success(stored)),
    exists: vi.fn(async () => Result.success(true)),
    list: vi.fn(async () =>
      Result.success({ salons: [stored], total: 1, hasMore: false }),
    ),
    update: vi.fn(async () => Result.success(stored)),
    delete: vi.fn(async () =>
      Result.success<SalonDeletion>({ type: 'deleted' }),
    ),
    ...overrides,
  }
}
```

For a use case that takes an actor, the actor is one of `actors` from `auth-fixtures.ts`. The tests of what the use case does pass `actors.admin`; the tests of who may do it go through the kinds of actor in a table and assert that a refused one never reaches the repository:

```typescript
  it.each<[string, Actor]>([
    ['a manager of the salon', actors.ofSalon('manager', SALON_ID)],
    ['the owner of another salon', ownerOfOtherSalon],
    ['a staff member of the salon', actors.ofSalon('staff', SALON_ID)],
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ])(
    'forbids %s to delete the salon without touching the repository',
    async (_case, actor) => {
      const salonRepository = repositoryWith()

      const result = await new DeleteSalonUseCase({ salonRepository }).execute(
        actor,
        SALON_ID,
      )

      expect(result).toEqual(forbidden)
      expect(salonRepository.delete).not.toHaveBeenCalled()
    },
  )
```

Integration tests run the production `createApp` (through `createTestApp` in `__tests__/_shared/test-helpers.ts`) with a PostgreSQL schema of their own per test. A request to an operation that is not public carries the `Authorization` header of a user the test has inserted and signed in (`asAdmin` comes from `signInAsAdmin` in `__tests__/_shared/auth-helpers.ts`). The tests assert the response and the stored state (`salon.integration.test.ts`):

```typescript
    it('rejects an email that another salon uses', async () => {
      await createSalon()

      const response = await request(app)
        .post(SALONS)
        .set('Authorization', asAdmin)
        .send(salonRequest({ name: 'Second salon' }))

      expectProblem(response, conflict)
      expect(response.body.detail).toBe(
        'Salon with email aoyama@example.com already exists',
      )
      expect(await db.$count(salons)).toBe(1)
    })
```

Each endpoint has at least five error scenarios, most of them rows of an `it.each` table that name the broken rule as `field:rule` (for example `postalCode:too_big`). Beyond the validation cases, the Salon tests cover an unknown ID, a deleted salon, a duplicate email, a corrupt stored row, a request that must leave the stored data untouched, pagination while salons are added, a request without a token, and every kind of user who may not create, change or delete a salon.

```bash
pnpm test               # unit tests of every package
pnpm test:integration   # integration tests; needs Docker (TEST_DATABASE_URL replaces only the PostgreSQL container)
```

The conventions are in [Testing Requirements](./testing-requirements.md) and the [API Testing Guide](./api-testing-guide.md).

## Data That Belongs to a Salon

Salon is a resource of its own. A domain whose data belongs to a salon is built in the same twelve steps and differs in the places below. The service categories of a salon are the example to read; their rules are in [Service Menu](./service-menu.md) (Japanese).

| Step | What differs | Where to read it |
|------|--------------|------------------|
| 1. API contract | The routes are below the salon, `/api/v1/salons/{salonId}/service-categories`, so the path names the salon. The create and update requests have no `salonId`; the response has. Every operation declares 404, which is also the answer for a salon that does not exist | `specs/operations/service-operations.tsp`, `specs/models/service.tsp` |
| 3. `pnpm check:api-db` | `salonId` is one of the `omittedColumns` of the create and the update rule | `serviceCategoryManagedColumns` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. Models | The salon of the path has its own parser, `parseSalonIdOfPath`, which reports a failure under the field `salonId`. The ID of the resource is parsed as in Salon (`parseCategoryId`, field `id`) | `backend/packages/domain/src/models/salon.ts`, `models/service-category.ts` |
| 6. Mappers | There is no write mapper. The properties of the request are the columns and none needs converting, so the repository stores the validated request. A write mapper has something to do when a column needs converting, as the `numeric` columns and the calendar of Salon do, or when a request holds the rows of more than one table, as that of a service does (below). The write mapper of the customers converts nothing and returns the request as the row ([Data That Belongs to No Salon](#data-that-belongs-to-no-salon)) | `backend/packages/domain/src/mappers/read/service-category.mapper.ts` |
| 7. Repository interface | Every method takes the salon ID and sees only the rows of that salon. Whether the salon exists is not the repository's question. What a write can come to without having failed is a sum type (`ServiceCategoryCreation`, `ServiceCategoryUpdate`), which the use case matches exhaustively | `backend/packages/domain/src/repositories/service-category.repository.ts` |
| 8. Repository implementation | Every query carries the salon ID, so a row of another salon is not found. The failures go through the shared `attempt` (`backend/packages/infrastructure/src/database/attempt.ts`), because no constraint violation is an expected outcome | `backend/packages/infrastructure/src/repositories/service-category.repository.impl.ts` |
| 9. Use cases | The dependencies hold the salon repository next to the domain's own. A use case parses the salon of the path, decides the permission from that salon alone, validates the rest of the input, and then calls `requireSalon`, which returns `notFound` when the salon does not exist or is deleted. Only then does it reach its own repository | `backend/packages/domain/src/business-logic/service-category/`, `business-logic/_shared/existing-salon.ts` |
| 10. Handlers and router | The router is created with `Router({ mergeParams: true })`, because `salonId` is a parameter of the mount path. The handlers declare it in their path parameters and pass `req.params.salonId` on unchecked | `backend/packages/api/src/routes/service-category/` |
| 11. Wiring | The router is mounted at `${API_BASE_PATH}/salons/:salonId/service-categories` and is given the salon repository of the salon router | `backend/packages/api/src/index.ts` |
| 12. Tests | A use case test stubs two repositories: `serviceCategoryDependencies` builds the dependencies from a stub of the domain's repository and from `salonRepositoryWith`, in which the salon exists | `backend/packages/domain/src/__tests__/service-category-fixtures.ts` |

Two answers follow from this for every route below a salon: the permission is decided from the salon in the path, and a resource that is not of that salon is answered with 404, like one that does not exist. Both are stated in [Authentication and Authorization](./authentication.md).

The services of a salon (`/api/v1/salons/{salonId}/services`; their rules are in [Service Menu](./service-menu.md) too) differ from Salon in the same places. Read them for what neither Salon nor the service categories have:

| Step | What the services show | Where to read it |
|------|------------------------|------------------|
| 1. API contract | A bulk operation, `bulkUpdate` at `PATCH /bulk`, with a request and a response model of its own (`ServiceBulkUpdateRequest`, `ServiceBulkUpdateResponse`). A delete that declares 409. One model, `ServiceOption`, for the rows of the child table in the requests and in the response | `specs/operations/service-operations.tsp`, `specs/models/service.tsp` |
| 3. `pnpm check:api-db` | The create and the update request hold the rows of a child table, so `options` is `embedded` in their rules as it is in the rule of the response | `serviceRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 5. Validation schemas | A rule that ties two properties together is not a `.check()` of the request schema: the update schema is derived from the create schema, and an update may name only one of the two properties. The schemas check each property by itself. A list in which no entry may come twice uses `noRepeatedEntries` | `backend/packages/domain/src/schemas/service.schema.ts` |
| 6. Mappers | A write mapper, although no column needs converting: a request holds the rows of two tables, the service and its options, and the mapper tells them apart. For an update it says whether the options are kept or replaced (`ServiceOptionsChange`) | `backend/packages/domain/src/mappers/write/service.mapper.ts` |
| 7. Repository interface | Outcomes with more than two refusals (`ServiceWriteRefusal`, `ServiceChangeRefusal`, and the outcome of each write that is built from them). A method for several rows, `updateMany`, which changes all of them or none. A deleted service is one that does not exist, except that the cursor of the list may still name it | `backend/packages/domain/src/repositories/service.repository.ts` |
| 8. Repository implementation | A write checks what the database cannot guarantee (the category and the member services of a package are of the same salon, and a package does not contain a package) and writes in one transaction, holding the rows it looked at; the comments on `lockCategory`, `lockServices` and `applyChanges` say which rows a write locks and in which order. An update checks the rules that tie two properties together for the stored row with the changes applied, by calling `serviceRuleIssues` of the domain | `backend/packages/infrastructure/src/repositories/service.repository.impl.ts` |
| 9. Use cases | The rules that tie two properties together are a pure function, `serviceRuleIssues`, which the use case of the create calls on the validated request. Every refusal of the repository becomes the error for the client in one place, `toRefusalError`. The use case of the delete answers `DomainErrors.conflict` for a service that a package contains | `backend/packages/domain/src/business-logic/service/`, with `_shared/rules.ts` and `_shared/refusals.ts` |
| 10. Handlers and router | A route whose path is a fixed segment, `/bulk`, is registered before `/:id`, which would otherwise take `bulk` for the ID of a service | `backend/packages/api/src/routes/service/index.ts` |
| 12. Tests | The rules that tie two properties together are tested as the pure function they are. `serviceDependencies` builds the dependencies of a use case test, as `serviceCategoryDependencies` does. The integration test also calls `ServiceRepository` directly, and writes rows past it to show what the constraints of the two tables refuse | `backend/packages/domain/src/__tests__/service.rules.test.ts`, `backend/packages/domain/src/__tests__/service-fixtures.ts`, `backend/packages/api/src/__tests__/service.integration.test.ts` |

The staff ledger of a salon (`/api/v1/salons/{salonId}/staff`; its rules are in [Staff Ledger](./staff.md), Japanese) differs from Salon in the same places as well, and no operation on it is public. Read it for what neither the service categories nor the services have:

| Step | What the staff ledger shows | Where to read it |
|------|-----------------------------|------------------|
| 1. API contract | No operation is `@useAuth(NoAuth)`: each of the implemented ones declares `CommonErrors`. The interface `StaffCrud` defines five operations, and each has a handler: list, create, get, update and delete. The update and the delete declare 409 for what nobody does to their own staff record | `specs/operations/staff-operations.tsp`, `specs/models/staff.tsp` |
| 3. Database schema | Two unique values, both within one salon and with different scopes: the email is unique among the staff members of a salon that are not deleted (the unique index `staff_email_salon_unique`), the staff code among all staff members of a salon, deleted ones included (the unique constraint `staff_code_salon_unique`). Two lists (`specialties`, `certifications`) are NOT NULL without a default, so a create request states them, as an empty list if there is nothing to state | `staff` in `backend/packages/database/src/schema.ts`, `backend/packages/database/sql/migrations/202611151800_staff_columns.sql` |
| 3. `pnpm check:api-db` | Columns that no request writes are `omittedColumns` of the create and the update rule. Besides the usual ones they are `userId`, because a login account is linked by accepting or joining an invitation and not by a request to the ledger | `staffRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 6. Mappers | A write mapper with one conversion: `commissionRate` is a `numeric` column, a number in the API and a string in a row. Everything else is passed on as it is | `backend/packages/domain/src/mappers/write/staff.mapper.ts` |
| 8. Repository implementation | The two unique violations are expected outcomes, told apart by the name of the violated constraint and returned as `alreadyExists`, as in the customer repository. An update and a delete are one statement each, which names the salon, the ID and `deletedAt IS NULL`: of two requests that arrive at the same moment, the later one finds no row, and no lock is needed. The list is in the order of registration, `(createdAt, id)` ascending | `backend/packages/infrastructure/src/repositories/staff.repository.impl.ts` |
| 9. Use cases | Every use case, the list and the get included, decides the permission from the salon of the path before anything else of the request is looked at (`mayKeepStaffLedger`: an administrator, or the owner of that salon). The use case of the list therefore takes the decoded query as a `Result`, as that of the customer list does (`ListStaffUseCase.execute(actor, salon, query)`). A second rule compares the actor with the target: nobody deactivates or deletes the staff member that their own account belongs to (`isOwnStaffRecord`). It is answered with `DomainErrors.conflict`, not with `forbidden`, and is decided without the database, after the ID and the body are validated and before the salon is looked up | `backend/packages/domain/src/business-logic/staff/`, with `_shared/authorization.ts` and `_shared/refusals.ts` |
| 10. Handlers and router | The router is created with `Router({ mergeParams: true })`, and every handler is wrapped with `authenticated`. The list handler passes the outcome of `decodeStaffSearchQuery` on to the use case | `backend/packages/api/src/routes/staff/` |
| 12. Tests | A staff member is what gives a login account its salon, so the integration test also signs in as the account of a staff member and shows what deactivating, reactivating and deleting that member does to the account. `staffDependencies` builds the dependencies of a use case test | `backend/packages/api/src/__tests__/staff.integration.test.ts`, `backend/packages/domain/src/__tests__/staff-fixtures.ts` |

The payment methods of a salon (`/api/v1/salons/{salonId}/payment-methods`; their rules are in [Payments](./payments.md), Japanese) are not public either. Read them for what the staff ledger does not have:

| Step | What the payment methods show | Where to read it |
|------|-------------------------------|------------------|
| 1. API contract | A property of the create request that no update request has: `method` is fixed once the row exists. A column that is in no model at all: `processorConfig`, the settings of a payment processor. The delete declares 409 for a payment method that a payment refers to | `specs/operations/payment-operations.tsp` (`PaymentMethodCrud`), `specs/models/payment.tsp` |
| 3. Database schema | CHECK constraints for what a row can be checked for by itself: the fee is a percentage, a limit of the amount is at least 1 and the lower one is not above the upper one, no `sortOrder` is negative. A nullable column loses a default that said 0 where the writer said nothing (`fee`) | `backend/packages/database/sql/migrations/202611160800_payment_method_rules.sql` |
| 3. `pnpm check:api-db` | `processorConfig` is one of the `omittedColumns` of every rule, that of the response included; `method` is one of those of the update rule only | `paymentMethodManagedColumns` and `paymentRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 5. Validation schemas | A rule that ties two properties together is a `.check()` of both request schemas here (`limitsInOrder`). The two schemas are built from one record of property schemas (`statedOfPaymentMethod`), not one from the other, and the check passes a request that names fewer than two limits: of an update that names one, only the stored row tells. It also passes when a limit is refused for what it is, so one answer does not say two things about one value | `backend/packages/domain/src/schemas/payment-method.schema.ts` |
| 6. Mappers | A write mapper with one conversion, as in the staff ledger: `fee` is a `numeric` column. The read mapper names every property, so `processorConfig` does not reach a response | `backend/packages/domain/src/mappers/write/payment-method.mapper.ts`, `backend/packages/domain/src/mappers/read/payment-method.mapper.ts` |
| 7. Repository interface | `PaymentMethodUpdate` and `PaymentMethodRemoval` are sum types: an update can find nothing, or find that the limits would be out of order; a delete can find nothing, or find a payment | `backend/packages/domain/src/repositories/payment-method.repository.ts` |
| 8. Repository implementation | The rule of the two limits is checked where the row is held: the update selects the row `FOR UPDATE` in a `READ COMMITTED` transaction, applies the pure functions `limitsAfter` and `limitsAreInOrder` to the limits as they would be, and writes or answers `limitsOutOfOrder`. Checked before the transaction, two updates that each name one limit could both pass and leave the row out of order. The delete holds the row `FOR UPDATE` too, which is the lock the foreign key of a payment waits for, and looks for a payment in the statement after it | `backend/packages/infrastructure/src/repositories/payment-method.repository.impl.ts`, `backend/packages/domain/src/business-logic/payment-method/_shared/limits.ts` |
| 9. Use cases | Two permissions, both decided from the salon of the path before anything else of the request is looked at: `mayReadPaymentMethods` for the list and the get, the staff of the salon included, and `mayKeepPaymentMethods` for the create, the update and the delete. The use case of the update turns `limitsOutOfOrder` into a broken rule of the limit the request names, and the use case of the delete turns `inUse` into `DomainErrors.conflict` | `backend/packages/domain/src/business-logic/payment-method/` |
| 12. Tests | The integration test holds a row while an update of the other limit waits for it, sends an update of each limit at the same moment, and writes a payment in an open transaction while a delete waits for it. `paymentMethodDependencies` builds the dependencies of a use case test | `backend/packages/api/src/__tests__/payment-method.integration.test.ts`, `backend/packages/domain/src/__tests__/payment-method-fixtures.ts` |

### A Rule of Three Properties and a Delete That Marks: the Products

The products of a salon (`/api/v1/salons/{salonId}/products`; their rules are in [Products](./products.md), Japanese) are built like the payment methods, with a permission to read and one to keep. Read them for what the payment methods do not have:

| Step | What the products show | Where to read it |
|------|------------------------|------------------|
| 1. API contract | The create request states every column a request writes, the update request any of them. `supplierId`, which named no table, became `supplier`, the name of a supplier. The `@doc` of the create and the update says in which order the stock levels lie, and the delete declares 409 for a product that has stock | `specs/models/inventory.tsp`, `specs/operations/inventory-operations.tsp` |
| 3. Database schema | CHECK constraints for what a row says by itself: no price is negative, the stock levels lie in order among those that are set, the lead time is not negative and the months to expiry are at least 1. `minimumStock` became `NOT NULL`. The unique constraint of the product code became a partial unique index over the rows that are not deleted, under the same name | `backend/packages/database/sql/migrations/202611171300_product_rules.sql` |
| 3. `pnpm check:api-db` | `deletedAt` is one of the `omittedColumns` of the response; the requests leave out the ID, the salon and the timestamps | `productManagedColumns` and the product rules in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 5. Validation schemas | A rule that ties three properties: the `.check()` of both request schemas (`stockLevelsInOrder`) compares the levels a request names, and only when none of them was refused for what it is | `backend/packages/domain/src/schemas/product.schema.ts` |
| 6. Mappers | The stock levels are `numeric` columns: the write mapper turns them into text, and the read mapper turns them back into numbers and reports a value that is no finite number as a database error | `backend/packages/domain/src/mappers/write/product.mapper.ts`, `backend/packages/domain/src/mappers/read/product.mapper.ts` |
| 7. Repository interface | `ProductUpdate` (`updated`, `notFound`, or `stockLevelsOutOfOrder` with the pairs out of order) and `ProductRemoval` (`deleted`, `notFound` or `inStock`) are sum types | `backend/packages/domain/src/repositories/product.repository.ts` |
| 8. Repository implementation | The update holds the row `FOR UPDATE` in a `READ COMMITTED` transaction and applies `stockLevelsAfter` and `brokenOrders` to the levels as they would be. The delete holds the row the same way, looks for a row of `inventory` in the next statement and writes `deletedAt` and `updatedAt` with `CLOCK`. A violation of `products_code_salon_unique` is `alreadyExists` | `backend/packages/infrastructure/src/repositories/product.repository.impl.ts` |
| 9. Use cases | `mayReadProducts` and `mayKeepProducts`, as for the payment methods. The update reports `stockLevelsOutOfOrder` with `stockLevelIssues`, the function the schema uses: under the upper level of a pair, or under the one level of it that the request names | `backend/packages/domain/src/business-logic/product/` |
| 12. Tests | The integration test holds a row while a change of another level waits for it, sends two changes of the levels at the same moment, writes a code and a stock row in open transactions while a create and a delete wait for them, and checks every constraint with a raw insert. `productDependencies` builds the dependencies of a use case test | `backend/packages/api/src/__tests__/product.integration.test.ts`, `backend/packages/domain/src/__tests__/product-fixtures.ts` |

### A Rule That Another Table Decides: the Stock Rows

The stock rows of a salon (`/api/v1/inventory`; their rules are in [Inventory](./inventory.md), Japanese) are reached like the sales ledger, in two steps, with a reach to read and one to keep. Read them for what the products do not have:

| Step | What the stock rows show | Where to read it |
|------|--------------------------|------------------|
| 1. API contract | The create request states the salon, the product and what is kept of a row, never the stock figures; the update request any of them but the salon and the product. The low stock and what expires soon are lists of their own, with a required `salonId`. The `@doc` of the response says that the stock figures change only through stock movements, counts and the receipt of purchase orders | `specs/models/inventory.tsp`, `specs/operations/inventory-operations.tsp` |
| 3. Database schema | A CHECK constraint holds the stock figures together (`inventory_stock`), and a partial unique index (`inventory_unique_without_lot`) allows one row without a lot for a product, which the unique constraint `inventory_unique` does not, since it counts two NULLs as different | `backend/packages/database/sql/migrations/202611171400_inventory_rules.sql` |
| 5. Validation schemas | `expiryDate` is a `calendarDate` of `schemas/rules.ts`, from 1900-01-01 to 2999-12-31 as every date of a request. The schemas are strict, so a stock figure in a request is an unknown property | `backend/packages/domain/src/schemas/inventory.schema.ts` |
| 7. Repository interface | `InventoryCreation` (`created`, `productNotFound`, `lotNumberRefused`), `InventoryUpdate` (`updated`, `notFound`, `lotNumberRefused`) and `InventoryRemoval` (`deleted`, `notFound`, `inStock`) are sum types; the lists resolve to null for a cursor they cannot start from | `backend/packages/domain/src/repositories/inventory.repository.ts` |
| 8. Repository implementation | The create holds the product `FOR KEY SHARE` and applies `lotNumberRefusal` to it; an update that names the lot does the same. The delete holds the row `FOR UPDATE` and looks at its stock. The low stock joins the summed stock of each product at the salon | `backend/packages/infrastructure/src/repositories/inventory.repository.impl.ts` |
| 9. Use cases | `inventoryReachOf` and `inventoryKeeperReachOf` decide from the actor, and `isWithin` the salon of the body or the query. The expiring list reads the salon for its time zone and works out the last day with `lastExpiringDayOf` and the `clock` of the dependencies | `backend/packages/domain/src/business-logic/inventory/` |
| 12. Tests | The integration test holds a product while a create and a change of the lot wait for it, holds a row while a delete waits for stock to be written, sends several creates of one lot at the same moment, and counts the days of the expiring list in time zones on both sides of the date line. `inventoryDependencies` builds the dependencies of a use case test | `backend/packages/api/src/__tests__/inventory.integration.test.ts`, `backend/packages/domain/src/__tests__/inventory-fixtures.ts` |

### A Ledger That Moves Another Row: the Stock Movements

The stock movements of a stock row (`POST /api/v1/inventory/movement` and `GET /api/v1/inventory/{id}/movements`; their rules are in [Inventory](./inventory.md#在庫の移動), Japanese) are written one at a time, each from the stock that the one before it left, and move the stock of the row by their quantity. Read them for what the stock rows do not have:

| Step | What the stock movements show | Where to read it |
|------|-------------------------------|------------------|
| 1. API contract | The record request states the row, the kind, the quantity with its sign, the unit cost, a reference and a reason; the salon, the product, the lot, the balances and the total cost are the server's. The `@doc` of each operation names who records which kind and every 400, 404 and 409 | `specs/models/inventory.tsp` (`InventoryMovementRequest`, `InventoryTransactionResponse`, `InventoryTransactionSearchRequest`), `specs/operations/inventory-operations.tsp` |
| 3. Database schema | Five CHECK constraints state what a movement can be by itself: the sign of its kind, the balances, the cost, the reference pair and the reason of its kind. The migration records an opening adjustment for every row whose stock differs from the balance after its latest movement | `backend/packages/database/sql/migrations/202611171500_inventory_transaction_rules.sql` |
| 5. Validation schemas | The rules of a kind come from pure functions with an exhaustive `match` (`directionOf`, `needsReason`) in `.check()`s. The total cost is checked first, on the unit cost, and not when the quantity or the unit cost is wrong by itself | `backend/packages/domain/src/schemas/inventory.schema.ts`, `business-logic/inventory/_shared/movements.ts` |
| 6. Mappers | The write mapper writes the quantity with two decimals and works out the total cost in `bigint` (`totalCostOf`); the read mapper returns the quantity and the balances as numbers | `mappers/write/inventory-transaction.mapper.ts`, `mappers/read/inventory-transaction.mapper.ts` |
| 7. Repository interface | `InventoryMovementRecording` (`recorded`, `notFound`, `belowReserved`, `overLimit`) and `InventoryMovementListing` (`listed`, `inventoryNotFound`, `cursorNotFound`) are sum types | `backend/packages/domain/src/repositories/inventory.repository.ts` |
| 8. Repository implementation | The record holds the row `FOR UPDATE`, decides on the stock it holds, moves the row and writes the movement with the balances before and after, at `clock_timestamp()`. The history reads the row, the cursor, the page and the count in one read-only `REPEATABLE READ` snapshot, and compares the time to the millisecond, as a response shows it | `backend/packages/infrastructure/src/repositories/inventory.repository.impl.ts` |
| 9. Use cases | Who records a movement depends on its kind, so the reach is decided twice: `inventoryReachOf` before the body is read and `movementReachOf` once it is known. `performerOf` names the staff member who records it | `backend/packages/domain/src/business-logic/inventory/record-inventory-movement.usecase.ts`, `list-inventory-movements.usecase.ts` |
| 12. Tests | The integration test sends eight sales of a row with a stock of five at the same moment, makes a movement wait for a change and for a delete of its row, and reads a history while a movement holds the row. The migration test checks every constraint with a raw insert and the opening adjustments of rows with and without movements | `backend/packages/api/src/__tests__/inventory-movement.integration.test.ts`, `backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |

### A Request That Writes Many Rows at One Moment: the Stock Count

A stock count (`POST /api/v1/inventory/stock-count`; its rules are in [Inventory](./inventory.md#棚卸し), Japanese) sets the stock rows of a salon that it names to what was counted, all of them or none, and records an adjustment of each difference. Read it for what a request of one row does not show:

| Step | What the stock count shows | Where to read it |
|------|----------------------------|------------------|
| 1. API contract | The request names the salon and up to 500 rows with what was counted of each; the response is the adjustments and the differences, in the order of the request | `specs/models/inventory.tsp` (`InventoryStockCountRequest`, `InventoryStockCountResponse`), `specs/operations/inventory-operations.tsp` |
| 5. Validation schemas | A row named twice is reported where it is named again, by a `.check()` on the request | `backend/packages/domain/src/schemas/inventory.schema.ts` |
| 7. Repository interface | `InventoryStockCount` (`counted`, `rowsNotFound` with every position, `belowReserved`) tells the use case what to answer, decided before anything is written | `backend/packages/domain/src/repositories/inventory.repository.ts` |
| 8. Repository implementation | The rows are held `FOR UPDATE` in the order of their IDs, so two counts that share rows never wait for each other; what was counted becomes a value of each row through a `CASE` on its ID and is compared in SQL with the stock as held. Every row and every adjustment of the count is written at the `statement_timestamp()` of the update, once every row is held | `backend/packages/infrastructure/src/repositories/inventory.repository.impl.ts` |
| 9. Use cases | The keepers count (`inventoryKeeperReachOf`), and the positions of the rows that are not of the salon become `items.<n>.inventoryId` issues | `backend/packages/domain/src/business-logic/inventory/perform-stock-count.usecase.ts` |
| 12. Tests | The integration test makes a count wait for a change and for a delete of one of its rows, times a count that waited, and sends counts that share rows in other orders, and a count among sales of its row, at the same moment | `backend/packages/api/src/__tests__/inventory-count.integration.test.ts` |

### Items That Copy Another Domain, and a Status That Moves Step by Step: the Purchase Orders

The purchase orders of a salon (`/api/v1/purchase-orders`; their rules are in [Purchase Orders](./purchase-orders.md), Japanese) are reached as the stock rows are. Read them for what the stock does not show:

| Step | What the purchase orders show | Where to read it |
|------|-------------------------------|------------------|
| 1. API contract | A new item (`PurchaseOrderItemCreateRequest`) names its stock row, its quantity and its unit price; the item of the response (`PurchaseOrderItem`) has the product the server copied and what the item comes to. The approval has no body. A received item (`PurchaseOrderReceivedItem`) takes the names of the stock movement columns, and a suggestion (`ReorderSuggestionResponse`) is one product with the figures it is worked out from | `specs/models/inventory.tsp`, `specs/operations/inventory-operations.tsp` (`PurchaseOrderCrud`) |
| 2. Database | The amounts, the approval, the cancellation and the delivery are held by CHECK constraints; an item keeps its order when its stock row is removed (`ON DELETE SET NULL`) | `backend/packages/database/sql/migrations/202611171600_purchase_orders.sql` |
| 3. Consistency rules | The stock row of a new item never takes the null of its column (`nonNullable`) | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 5. Validation schemas | A row named twice is reported where it is named again; an item that comes to more than an `integer` is reported at its unit price with the most it may be; the total of the order is looked at once nothing else is wrong | `backend/packages/domain/src/schemas/purchase-order.schema.ts` |
| 6. Business rules | Pure functions say why an update, an approval, a cancellation or a receipt is refused from a status, work out the amounts exactly, and plan the movements of a receipt or every item it may not take | `backend/packages/domain/src/business-logic/purchase-order/_shared/status.ts`, `_shared/amounts.ts`, `_shared/goods-receipt.ts` |
| 7. Repository interface | `PurchaseOrderCreation` (`created`, `orderNumberTaken`, `rowsNotFound` with every position), `PurchaseOrderChange` (`changed`, `notFound`, or the refusal of the status), `PurchaseOrderReceipt` (`received`, `notFound`, the refusal of the status, `itemsRefused` with every position, `overLimit`) and `ReorderSuggestionListing` (`listed`, `cursorNotFound`) | `backend/packages/domain/src/repositories/purchase-order.repository.ts` |
| 8. Repository implementation | The create holds the stock rows and their products `FOR KEY SHARE` in the order of the IDs of the rows and copies the products; a change holds the order `FOR UPDATE` and decides on its status as held; a receipt then holds the stock rows `FOR UPDATE` in the order of their IDs and writes the order, the rows and the movements at one moment; the suggestions are one query over the products, the stock and the open orders, in one read-only snapshot | `backend/packages/infrastructure/src/repositories/purchase-order.repository.impl.ts` |
| 12. Tests | The integration test approves one order twice at the same moment, makes a create wait for the removal of one of its rows and for a change of a product, and checks every refused step of the status; it receives one order twice at the same moment, makes a receipt wait for a cancellation, a movement and the removal of a row, and covers every rule of the suggestions with one product each | `backend/packages/api/src/__tests__/purchase-order.integration.test.ts` |

### What Is Worked Out at Every Read, and What Is Kept of It: the Inventory Alerts

The alerts of the stock of a salon (`/api/v1/inventory-alerts`; their rules are in [Inventory Alerts](./inventory-alerts.md), Japanese) are reached as the stock rows are read. An alert is not stored: it is worked out of the products, the stock rows and their movements whenever it is read, and only the acknowledgements of the alerts are rows. Read them for a resource that has no table of its own:

| Step | What the inventory alerts show | Where to read it |
|------|-------------------------------|------------------|
| 1. API contract | An alert has no ID: it is named by its type and by the product or the stock row it is about, and the acknowledgement has no path ID, its body names the alert. The response nests the acknowledgement that holds as the row it is (`acknowledgement`), and the acknowledgement request has no `acknowledgedBy`: who acknowledges is the one signed in | `specs/models/inventory.tsp`, `specs/operations/inventory-operations.tsp` (`InventoryAlertCrud`) |
| 2. Database | The acknowledgements only, with CHECK constraints that tie the type to its subject and to its severity; the movements of a product are indexed by their time (`idx_inventory_transactions_product_time`), which the reconstruction of the stock reads | `backend/packages/database/sql/migrations/202611171700_inventory_alert_acknowledgements.sql` |
| 3. Consistency rules | The acknowledgement request is a `create` rule that leaves out every column the server decides (`omittedColumns`); the alert itself is no row and is not checked | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 5. Validation schemas | The type of the alert decides whether `inventoryId` is null; the issue names the alert | `backend/packages/domain/src/schemas/inventory-alert.schema.ts` |
| 6. Business rules | Pure functions say which alert a product or a stock row has now (`productAlertOf`, `stockRowAlertOf`), whether an acknowledgement still holds (`productAcknowledgementHolds`, `stockRowAcknowledgementHolds`), the order, the filter, the page and the counts (`alertsOf`, `matchesFilter`, `pageOfAlerts`, `summaryOf`), and whether an alert is there to acknowledge and what is recorded of it (`decideAcknowledgement`) | `backend/packages/domain/src/business-logic/inventory-alert/_shared/alerts.ts` |
| 7. Repository interface | The repository reads facts, not alerts (`DbInventoryAlertFacts`: the stock of the products past a stock level, the rows with stock that expire soon or have expired, and the latest acknowledgements with what the stock has been since each), and answers an acknowledgement with a sum type (`InventoryAlertAcknowledging`: `acknowledged`, `notFound`, `notActive`, `alreadyAcknowledged`, `unknownTimeZone`); a cursor that names nothing of the salon is `cursorNotFound` | `backend/packages/domain/src/repositories/inventory-alert.repository.ts` |
| 8. Repository implementation | The facts and the places of the cursor are read in one read-only `REPEATABLE READ` snapshot; the stock since an acknowledgement is worked out of the movements after it with window functions in `numeric`; an acknowledgement holds the product `FOR NO KEY UPDATE`, then its rows `FOR SHARE` in the order of their IDs, decides with the pure function and writes at `clock_timestamp()` | `backend/packages/infrastructure/src/repositories/inventory-alert.repository.impl.ts` |
| 12. Tests | The integration test acknowledges one alert five times at the same moment, makes an acknowledgement wait for a movement and for an update of the product, checks that a row create and the reads do not wait for it, and compares the spans of the stock the repository works out with movements of one moment | `backend/packages/api/src/__tests__/inventory-alert.integration.test.ts` |

### A Record Held to the Row It Is Written For: the Treatment Records

The treatment records (`/api/v1/treatments`; their rules are in [Treatments](./treatments.md), Japanese) belong to a salon through their booking: the table has no salon column, and a booking takes one record. Read them for a resource whose reach and whose rules come from another row:

| Step | What the treatment records show | Where to read it |
|------|---------------------------------|------------------|
| 1. API contract | The update request has no `bookingId`, `customerId` or `staffId`: a record keeps its booking. The lists are required and not nullable, and the photos are rows of their own, nested in the response with their IDs, added in bulk and removed one by one. The statistics have no table and say in their `@doc` how each figure is counted | `specs/models/treatment.tsp`, `specs/operations/treatment-operations.tsp` (`TreatmentRecordCrud`) |
| 2. Database | A migration gives the jsonb columns a shape: the lists NOT NULL with CHECK constraints, the conditions and the colour formula text, the photo columns dropped for the rows of `treatment_photos`; the materials get a `sortOrder`. A second one makes the kind of a photo an enum, and a public photo one with consent, by CHECK constraints, and one address one photo of a record by a unique constraint; rows that break a constraint are not fixed, and the migration fails without changing anything | `backend/packages/database/sql/migrations/202611171800_treatment_record_rules.sql`, `202611171900_treatment_photo_rules.sql` |
| 3. Consistency rules | The update rule leaves out the booking, the customer and the staff member; the materials leave out `sortOrder`, their place in the list | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 6. Business rules | Pure functions say what of a request does not fit the booking and its salon (`creationIssues`, `treatmentIssues`) and whether the booking takes a record (`isTreated`); who reads and writes and who removes are two reaches (`treatmentRecordReachOf`, `treatmentRecordRemovalReachOf`); `photoAdditionRefusal` says whether a record takes the photos of an addition, and `statisticsOf` averages the processing times | `backend/packages/domain/src/business-logic/treatment-record/_shared/` |
| 7. Repository interface | The create answers a sum type (`TreatmentRecordCreation`: `created`, `bookingNotFound`, `refused` with every issue, `bookingNotTreated`, `recordExists`), and so do the update (`TreatmentRecordChange`), the delete (`TreatmentRecordRemoval`) and the photos (`TreatmentPhotoAddition`, `TreatmentPhotoRemoval`); the statistics read figures (`TreatmentFigures`), or null for a salon that is missing or deleted | `backend/packages/domain/src/repositories/treatment-record.repository.ts` |
| 8. Repository implementation | The reach is an `EXISTS` on the booking and a salon that is not deleted (`shownTo`); the create holds the booking `FOR SHARE` and what it names `FOR KEY SHARE` in the lock order of the bookings, with the products last, and inserts `ON CONFLICT DO NOTHING` on the unique booking; the update holds the record `FOR UPDATE` and writes the materials again when it names them; the addition and the removal of photos hold the record `FOR NO KEY UPDATE` and write its `updatedAt`; the reads and the statistics are one read-only `REPEATABLE READ` snapshot | `backend/packages/infrastructure/src/repositories/treatment-record.repository.impl.ts` |
| 12. Tests | The integration test creates the record of one booking twice at the same moment, makes a create wait for a cancellation of its booking and for the removal of a service, a staff member, a product and the customer, takes two changes of the materials in turns, and lets the database refuse what the request schema would not let through. The tests of the photos take two additions in turns, so that the second counts the photos of the first, and make the photos wait for a change and a removal of the record; the tests of the statistics count while a record is written | `backend/packages/api/src/__tests__/treatment-record.integration.test.ts`, `treatment-photo.integration.test.ts`, `treatment-statistics.integration.test.ts` |

### Rows That Belong to a Record of a Salon: the Staff Schedules

A schedule says when a staff member works: the rows of `staff_schedules` of one staff member, read and replaced as a whole. Their rules are in [Staff Ledger](./staff.md#勤務スケジュール) (Japanese). They are built like the staff ledger and differ in these places:

| Step | What the staff schedules show | Where to read it |
|------|-------------------------------|------------------|
| 1. API contract | An interface of its own (`StaffSchedules`) below a staff member, with a `GET` and a `PUT` and no route for one row. The body of the `PUT` is an array, and a named one (`model StaffScheduleUpdateRequest is StaffSchedule[]`), because `@maxItems` on a `@body` parameter does not reach the OpenAPI document. The model of a row (`StaffSchedule`) serves the request and the response; the list is not paginated (`ApiResponse<StaffSchedule[]>`) | `specs/operations/staff-operations.tsp`, `specs/models/staff.tsp` |
| 3. Database schema, `pnpm check:api-db` | What a row can be is stated by CHECK constraints, and that no day comes twice by two partial unique indexes, so the rules hold for whatever writes rows. One rule compares the model of a row with the table as a response (every property required, nullable where the column is); its `omittedColumns` are the ID, the staff member and the timestamps | `backend/packages/database/sql/migrations/202611152100_staff_schedules_rules.sql`, `staffRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. Models | No ID type: a row is addressed by its staff member. `DbNewStaffSchedule` leaves out `staffId` as well as the columns the database fills, because the repository takes the staff member from the path | `backend/packages/domain/src/models/staff-schedule.ts` |
| 5. Validation schemas | A schema of the array: the rules of a row in a `.check()` on the row, the rule between rows (no day of the week and no date twice) in a `.check()` on the array, and a maximum length. The issues of a row carry `continue: true`; without it Zod would not run the check of the array, and a request would learn of its repetitions only after correcting its rows. The time format and the day of the week of a date are shared rules (`timeOfDay`, `dayOfWeekOf`) | `backend/packages/domain/src/schemas/staff-schedule.schema.ts`, `backend/packages/domain/src/schemas/rules.ts` |
| 6. Mappers | Neither converts anything (`date` and `time` columns are read and written as the strings of the API), and both return plain values. The read mapper names every property, so the ID and the staff member of a row do not reach the response | `backend/packages/domain/src/mappers/write/staff-schedule.mapper.ts`, `backend/packages/domain/src/mappers/read/staff-schedule.mapper.ts` |
| 7. Repository interface | Two methods, `findByStaff` and `replace`, which take the salon and the staff member and resolve to `null` when the staff member is not of the salon or is deleted | `backend/packages/domain/src/repositories/staff-schedule.repository.ts` |
| 8. Repository implementation | `replace` is one transaction: it selects the row of the staff member `FOR UPDATE`, deletes the rows of the schedule, inserts the new ones and reads them back. The lock makes two replacements wait for each other, so their rows never mix, and it makes a replacement and a delete of the staff member take turns. One function gives both methods the order of the rows (weekly ones by day of the week, then single dates by date) | `backend/packages/infrastructure/src/repositories/staff-schedule.repository.impl.ts` |
| 9. Use cases | The permission is decided in two steps, both before the query, the body and any lookup: from the salon of the path (`mayPlanSchedules`, `mayReadSchedules`), and, once the ID of the staff member is parsed, from whose schedule it is (`mayReadScheduleOf`: a staff member reads their own). Which row applies to a date is a pure function (`scheduleOn`) that the list calls for a request with `date` and that the booking domain will call | `backend/packages/domain/src/business-logic/staff-schedule/` |
| 10. Handlers and router | The router is mounted below the staff member and created with `Router({ mergeParams: true })`; its two routes are `GET /` and `PUT /`. The list handler passes `req.query` as it is: the one parameter is text, so there is nothing to decode. `self` repeats the query of the request | `backend/packages/api/src/routes/staff-schedule/` |
| 12. Tests | The integration test sends replacements of the same schedule at the same moment and shows that what is stored is the whole of one of them; it calls the repository directly, and inserts rows that the constraints refuse. The use case test goes through every kind of actor for both permission rules | `backend/packages/api/src/__tests__/staff-schedule.integration.test.ts`, `backend/packages/domain/src/__tests__/staff-schedule.usecase.test.ts`, `backend/packages/domain/src/__tests__/staff-schedule-fixtures.ts` |

### A Record a Mailed Token Gives Access To: the Staff Invitations

An invitation is how a staff member of the ledger gets a login account: a row of `staff_invitations`, at most one per staff member, which whoever keeps the ledger creates and whoever receives the mail accepts, or joins with an account they have. Their rules are in [Staff Ledger](./staff.md#スタッフのログインアカウント) (Japanese). They are built like the staff schedules and differ in these places:

| Step | What the staff invitations show | Where to read it |
|------|---------------------------------|------------------|
| 1. API contract | An interface of its own (`StaffInvitations`) below a staff member, with a `GET`, a `POST` and a `DELETE` on one path that names no invitation: a staff member holds at most one, and the `POST` replaces it. The create request has the role only, an enum of its own (`SalonRoleType`), because an invitation gives the roles of a salon and no other. The three operations of whoever was invited are operations of `AuthCrud` and take the mailed token in the body. Two are `@useAuth(NoAuth)` with `PublicErrors`: reading the invitation, and accepting it with a new password. The third, joining with an account that exists, needs a session of that account as well (`CommonErrors`): a mailed token is not a password. One response model, `StaffInvitationResponse`, answers both sides, and has neither the token nor its hash | `specs/operations/staff-operations.tsp`, `specs/operations/auth-operations.tsp`, `specs/models/staff.tsp`, `specs/models/auth.tsp` |
| 3. Database schema, `pnpm check:api-db` | A table that only has open invitations: one row per staff member (a unique constraint on `staffId`), replaced by a new invitation and deleted by an acceptance or a revocation. It keeps the hash of the token, never the token. Two partial unique indexes keep an account and a staff member one to one (`users_staff_unique`, `staff_user_unique`). The response rule omits `tokenHash`; the create rule omits every column but `role`, which the server fills | `backend/packages/database/sql/migrations/202611152300_staff_invitations.sql`, `staffRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. Models | No ID type, because no route names an invitation. The roles an invitation gives are a type taken from the column (`SalonRole = DbStaffInvitation['role']`), not written by hand | `backend/packages/domain/src/models/staff-invitation.ts` |
| 5. Validation schemas | The schema of the create request is with the invitations; those of the three requests that carry the token are with the authentication schemas, next to the rules they share (`mailedTokenSchema`, `newPasswordSchema`) | `backend/packages/domain/src/schemas/staff-invitation.schema.ts`, `backend/packages/domain/src/schemas/auth.schema.ts` |
| 6. Mappers | A read mapper only. It names every property, so the hash of the token does not reach a response | `backend/packages/domain/src/mappers/read/staff-invitation.mapper.ts` |
| 7. Repository interface | Every method resolves to a sum type that says what happened, not to a row or `null`: `issue` to `issued`, `staffNotFound`, `linked`, `inactive` or `mailedMomentsAgo`, `accept` to `accepted`, `unusable` or `accountExists`, `join` to `joined`, `unusable`, `otherAddress` or `accountNotFree`. One transaction can end in more than two ways, and each is a different answer | `backend/packages/domain/src/repositories/staff-invitation.repository.ts` |
| 8. Repository implementation | `issue`, `revoke`, `accept` and `join` are transactions that select the row of the staff member `FOR UPDATE` first and then read again what they decide from, so of two writes that arrive together the second sees what the first did; the update and the delete of the ledger wait for the same lock. One query says whether an invitation is usable (`usableInvitation`), for the read and for the acceptance. `accept` creates the account with one `INSERT … ON CONFLICT … DO UPDATE … WHERE` against the unique index of the email: no account at the address, an account that never confirmed it and any other account are told apart by the statement itself, not by a lookup before it. `join` locks two staff members, the one joined and the one the account names, in the order of their IDs, and then the user: the order every write that links or unlinks keeps, so no two of them wait for each other | `backend/packages/infrastructure/src/repositories/staff-invitation.repository.impl.ts` |
| 9. Use cases | The create has two permissions: from the salon of the path (`mayInviteStaff`), and, once the body is validated, from the role it asks for (`mayGiveRole`: only an administrator gives the role of an owner), both before anything is looked up. The use cases match the outcome of the repository exhaustively and name each refusal. The token is a mailed token of the authentication (`STAFF_INVITATION` in `mailed-token.ts`), and a token that cannot be used gets one answer, whatever the reason (`invitationRefused`). The accept checks in this order: body, token, an account at the address, the password against the blocklist, and then hashes the password and writes. The join refuses by the scope of the actor first (a customer and an administrator with 403, an account that reaches a salon with 409), and the repository asks the same rule again once it holds its locks (`isWithoutSalon`, which stands next to the scope it restates). The verify returns the invitation and the name of the route that takes the token next, `accept` or `join` | `backend/packages/domain/src/business-logic/staff-invitation/`, `backend/packages/domain/src/business-logic/auth/_shared/mailed-token.ts`, `backend/packages/domain/src/business-logic/auth/_shared/actor.ts` |
| 10. Handlers and router | Two routers in one directory: `createStaffInvitationRouter`, mounted below the staff member with every handler wrapped, and `createStaffInvitationAcceptanceRouter`, mounted at `/auth/staff-invitation` with `Cache-Control: no-store` on every response; of its three handlers only the join is wrapped. The verify builds its one link from the name the use case returns. `self` is the mount path, since there is one invitation per staff member | `backend/packages/api/src/routes/staff-invitation/`, `backend/packages/api/src/shared/never-stored.ts` |
| 11. Wiring | One object of dependencies for both routers. It takes the password hasher, the token issuer, the mailer and the clock from the authentication dependencies | `createApp` in `backend/packages/api/src/index.ts` |
| 12. Tests | The integration test reads the token from the recorded mail and accepts with it; it goes through every way an invitation stops working and every kind of account that stands in the way, sends acceptances, invitations, revocations, deletions and registrations at the same moment, and holds a transaction open to decide which of two requests comes first. The use case test fixes the clock and replaces the repository. The joining is tested with the staff accounts | `backend/packages/api/src/__tests__/staff-invitation.integration.test.ts`, `backend/packages/api/src/__tests__/staff-account.integration.test.ts`, `backend/packages/domain/src/__tests__/staff-invitation.usecase.test.ts`, `backend/packages/domain/src/__tests__/staff-invitation-fixtures.ts` |

### Rows of Another Domain That a Salon Keeps: the Staff Accounts

The account of a staff member is a row of `users`, which belongs to the authentication. The salon reads a part of it, changes its role and unlinks it (`/api/v1/salons/{salonId}/staff/{id}/account`); the rules are in [Staff Ledger](./staff.md#紐づいたアカウントの管理) (Japanese). The staff accounts are built like the side of the invitations that invites, and differ in these places:

| Step | What the staff accounts show | Where to read it |
|------|------------------------------|------------------|
| 1. API contract | An interface of its own (`StaffAccounts`) below a staff member, with a `GET`, a `PATCH` and a `DELETE` on one path that names no user: a staff member has at most one account. There is no create, because an account is made by accepting an invitation, and the `DELETE` unlinks and deletes nothing. The response has what the salon is shown and nothing that authenticates; the update request has the role only. `role` is `SalonRoleType`, an enum with three of the five values of the column | `specs/operations/staff-operations.tsp`, `specs/models/staff.tsp` |
| 3. Database schema, `pnpm check:api-db` | No table. A check constraint says what the narrower enum promises: a user that names a staff member has the role of an owner, a manager or staff (`users_staff_needs_salon_role`). The two rules name the table `users`, omit every column the salon is not shown or may not write, and list `role` in `narrowed`: the check then asks for some of the values of the enum of the column, and not all of them | `backend/packages/database/sql/migrations/202611152330_users_staff_needs_salon_role.sql`, `staffRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts`, `backend/packages/database/src/scripts/api-consistency.ts` |
| 4. Models | The row type is a `Pick` of `DbUser` with the eight columns the repository selects (`DbStaffAccount`), so what authenticates an account is not in the type either. No ID type | `backend/packages/domain/src/models/staff-account.ts` |
| 5. Validation schemas | A strict object with the optional role and `atLeastOneProperty`, like every update request | `backend/packages/domain/src/schemas/staff-account.schema.ts` |
| 6. Mappers | A read mapper only. It checks the stored role against the schema of the narrower enum: a value the constraint should have refused becomes a `database` error, not a response the contract does not allow | `backend/packages/domain/src/mappers/read/staff-account.mapper.ts` |
| 7. Repository interface | `findByStaff`, `update` and `unlink` resolve to sum types that tell a staff member the salon does not have (`staffNotFound`) from a staff member without an account (`none`): they are different 404s | `backend/packages/domain/src/repositories/staff-account.repository.ts` |
| 8. Repository implementation | The account is found from the staff member: the user that names it in `staffId` and is not deleted. `update` and `unlink` lock the row of the staff member first, as the invitations do. `unlink` sets `users.staffId` and `staff.userId` to null in that transaction, and clears a pointer that only one of the two tables still has. The condition "the staff member of this salon, not deleted" is one function that the repositories below a staff member share (`staffMemberOf`) | `backend/packages/infrastructure/src/repositories/staff-account.repository.impl.ts`, `backend/packages/infrastructure/src/repositories/staff-member.ts` |
| 9. Use cases | The permission from the salon of the path (`mayKeepStaffAccounts`), for the update a second one from the validated body (`mayGiveRole`), and then a rule about the actor's own record, which is a 409 and not a 403: nobody changes the role of their own account or unlinks it (`isOwnStaffRecord` of the staff ledger). All of it comes before the salon is looked up. No session is revoked, because the scope of an actor is derived on every request | `backend/packages/domain/src/business-logic/staff-account/` |
| 10. Handlers and router | Mounted below the staff member, every handler wrapped. `self` is the mount path and `staff` the path without its last segment | `backend/packages/api/src/routes/staff-account/` |
| 11. Wiring | The repository of the accounts and the salon repository; nothing of the authentication dependencies | `createApp` in `backend/packages/api/src/index.ts` |
| 12. Tests | The integration test changes a role and unlinks an account, and then sends a request with the access token the account already had. It goes through every kind of account that joins an invitation and every kind that does not, sends joinings, revocations, acceptances and unlinkings at the same moment, holds a transaction open to decide which of two requests comes first, calls both repositories directly and inserts rows that the check constraint refuses | `backend/packages/api/src/__tests__/staff-account.integration.test.ts`, `backend/packages/domain/src/__tests__/staff-account.usecase.test.ts`, `backend/packages/domain/src/__tests__/staff-account-fixtures.ts` |

### A Part of the Staff Ledger That Everyone May Read: the Staff Profiles

Customers choose a staff member from what the salon shows of them. The staff profiles (`/api/v1/staff-profiles`) are that part of the rows of the ledger, read without an access token; their rules are in [Staff Ledger](./staff.md#顧客に見せるプロフィール) (Japanese). They share the table of the ledger and nothing else:

| Step | What the staff profiles show | Where to read it |
|------|------------------------------|------------------|
| 1. API contract | An interface of its own (`StaffProfile`) with a flat path, because the list goes across salons; the salon is an optional filter of the search request. A response model of its own (`StaffProfileResponse`) with the properties customers are shown, not the ledger's response with optional properties. Both operations are `@useAuth(NoAuth)` and declare `PublicErrors` | `specs/operations/staff-operations.tsp`, `specs/models/staff.tsp` |
| 3. `pnpm check:api-db` | A response rule for the same table as the ledger, whose `omittedColumns` are the columns customers are not shown. A column added to `staff` is reported until it is put in the model or in that list | `staffRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. Models | No new database type: `DbStaffProfile` is `Pick`ed from `DbStaff` | `backend/packages/domain/src/models/staff-profile.ts` |
| 6. Mappers | A read mapper that returns a plain value, not a `Result`: none of the columns needs converting, so nothing can fail. It names every property, so the response has what the model has and nothing a row happens to carry | `backend/packages/domain/src/mappers/read/staff-profile.mapper.ts` |
| 7. Repository interface | A repository of its own with `findById` and `list` and no salon ID in their signatures. `list` resolves to `null` for a cursor that names no staff member | `backend/packages/domain/src/repositories/staff-profile.repository.ts` |
| 8. Repository implementation | It selects the profile columns and no other, and one condition says who is shown: active, not deleted, of a salon that is not deleted (an inner join with `salons`). The filters are added to that condition; the cursor is looked up without it, so a staff member who is not shown any more still says where the next page begins. A specialty is matched as an element of the array (`arrayContains`), the city as the whole value | `backend/packages/infrastructure/src/repositories/staff-profile.repository.impl.ts` |
| 9. Use cases | Neither the list nor the get takes an actor. The get answers `notFound` for whoever is not shown, with the same words as for an ID that no staff member has. The list turns a cursor that names no staff member into a `validation` error | `backend/packages/domain/src/business-logic/staff-profile/` |
| 10. Handlers and router | A plain `Router()`. Neither the list handler nor the get handler is wrapped with `authenticated`. The list handler answers a query it cannot decode itself, as the salon list does | `backend/packages/api/src/routes/staff-profile/` |
| 12. Tests | The integration test registers staff through the ledger with values that appear nowhere else and shows that none of them is in a response of the profiles; it also shows who is hidden and when (deactivated, deleted, the salon deleted) and that everyone, signed in or not, is answered alike | `backend/packages/api/src/__tests__/staff-profile.integration.test.ts`, `backend/packages/domain/src/__tests__/staff-profile-fixtures.ts` |

### The Part of a Profile That the Staff Member Writes: the Own Profile

A staff member describes themselves: the specialties, the biography, the photo, the years of experience and the certifications. The own profile (`/api/v1/staff-profiles/me`) lets the signed-in staff member read the profile and change those five properties; the rules are in [Staff Ledger](./staff.md#スタッフ本人のプロフィール) (Japanese). It is the part of the staff profiles that needs a signed-in user, and it adds to their files:

| Step | What the own profile shows | Where to read it |
|------|----------------------------|------------------|
| 1. API contract | An interface of its own (`StaffOwnProfile`) at `/me` below the profiles, with no ID in the path: the account says whose profile it is. The response is the model customers read (`StaffProfileResponse`). The update request (`StaffProfileUpdateRequest`) has the five properties the staff member writes and no other, all optional. The operations declare `CommonErrors`, the update `RequestBodyErrors` as well | `specs/operations/staff-operations.tsp`, `specs/models/staff.tsp` |
| 3. `pnpm check:api-db` | An update rule for the same table, whose `omittedColumns` are the columns customers are not shown and the four the salon decides | `staffRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 5. Validation schemas | The schema is picked from the schema of the ledger (`staffCreateRequestSchema.pick(…).exactPartial()`), so the rules of the five properties are written once. A request that names none of them is refused, and any other property is an unknown one | `backend/packages/domain/src/schemas/staff-profile.schema.ts` |
| 6. Mappers | No write mapper: the properties are named and typed as the columns are, so the validated request is the change (`StaffProfileChanges`). The answer goes through the read mapper of the profiles | `backend/packages/domain/src/repositories/staff-profile.repository.ts` |
| 7. Repository interface | `update(id, changes)` on the repository of the profiles; it resolves to the profile, or to `null` when the staff member is not shown | `backend/packages/domain/src/repositories/staff-profile.repository.ts` |
| 8. Repository implementation | One statement, `UPDATE … FROM salons`, with the condition of who is shown in its `WHERE` clause, returning the profile columns. There is no read before the write and no lock: a staff member who is deactivated or deleted at the same moment matches no row | `backend/packages/infrastructure/src/repositories/staff-profile.repository.impl.ts` |
| 9. Use cases | `ownProfileOf(actor)` turns the scope of the actor into the staff member whose profile it is, or into `notAStaffMember` (403), before the body is read. `null` from the repository becomes `notFound` | `backend/packages/domain/src/business-logic/staff-profile/_shared/own-profile.ts`, `get-own-staff-profile.usecase.ts`, `update-own-staff-profile.usecase.ts` |
| 10. Handlers and router | The two handlers are wrapped with `authenticated` and pass the `actor`; the links name `/me` and the address at which customers read the profile. `/me` is registered before `/:id`, which would take `me` for an ID otherwise | `backend/packages/api/src/routes/staff-profile/` |
| 12. Tests | The integration test goes through every kind of account that has a profile of its own and every kind that has none, shows that a change leaves every other column and every other staff member as they were, and holds a transaction open on the row of the staff member to show that a change waits for it and then writes nothing for a staff member who left | `backend/packages/api/src/__tests__/staff-own-profile.integration.test.ts`, `backend/packages/domain/src/__tests__/staff-own-profile.usecase.test.ts` |

### Data of a Salon Whose Routes Are Not Below It: the Booking Ledger

A booking belongs to a salon, but the contract puts the bookings at `/api/v1/bookings`: a booking is found by its ID alone, and a list may span the salons of the platform. The booking ledger (the eleven operations of `BookingCrud`: list, create, get, update, delete, the five actions on the status of a booking, and reschedule) is kept by the members of a salon for their salon and by the administrators for every salon; a customer does not reach it. Its rules are in [Booking Ledger](./bookings.md) (Japanese). It is built in the same twelve steps and differs in these places:

| Step | What the booking ledger shows | Where to read it |
|------|-------------------------------|------------------|
| 1. API contract | The interface is at `/api/v1/bookings`, not below a salon, and none of its operations is public. What names the salon differs by operation: the body of the create, the query of the list, the stored row of every operation on one booking. The create request holds what the user decides and nothing else: whom the booking is for, the staff member in charge, the service lines (service, staff member, beginning, notes), the deposit, the request of the customer, the notes and the source. What the system decides (the number, the day, the times, the amounts, the status) is in the response model only, and the `@doc` of the operation says how it is decided. A request that breaks a rule between stored rows, here a staff member who is occupied, is answered with 409, which the operation declares | `specs/operations/booking-operations.tsp`, `specs/models/booking.tsp` |
| 3. Database schema, `pnpm check:api-db` | The columns the system decides are the `omittedColumns` of the create rules (`bookingSystemColumns`, `bookingServiceSystemColumns`), and the rule of the response leaves out the address and the user agent of the request. CHECK constraints state what a booking and a line can be by themselves (they end after they begin, the duration is the minutes between, no amount is negative, a total is what its parts add up to), and a unique constraint gives the lines of a booking an order, so the rules hold for whatever writes rows. A nullable amount has no default: a writer that leaves it out stores null, not another way of saying none. The indexes are the questions the ledger asks: a staff member and a time, and the bookings of a salon in the order they are listed. The migration sets what follows from other columns in the rows written before, and fails on rows for which nothing says what was meant | `backend/packages/database/src/scripts/api-consistency-rules.ts`, `backend/packages/database/sql/migrations/202611160200_bookings_rules.sql` |
| 4. Models | The types of the rows to write leave no column to a default (`DbNewBooking`, `DbNewBookingService`, `DbNewBookingStatusChange`), and `BookingWrite` is the three together: a booking, its lines and the first entry of its status history. `BookingWithServices` is what is read. `BookingReach` says which bookings an actor reaches, every salon's or those of one salon | `backend/packages/domain/src/models/booking.ts` |
| 5. Validation schemas | The schema holds the rules a request can be checked for by itself. A beginning is in UTC and on a whole minute, and the schema returns it in one spelling, so two times that are the same moment are the same text. A booking has between one and twenty lines, and every line begins within 24 hours of the earliest one, because a booking is one visit. The rules that need the rows a booking refers to are not here: they are the plan's and the repository's. Two shared rules are about time zones: `timeZoneName`, the name of a time zone that the runtime knows, which the salon schemas use for `timezone`, and `inTimeZone`, with which the plan tells the day of a visit | `backend/packages/domain/src/schemas/booking.schema.ts`, `backend/packages/domain/src/schemas/rules.ts` |
| 6. Mappers | No write mapper: most columns of the rows come from the rows the request refers to, not from the request, so a pure function plans them (step 9). The read mapper names every property it returns, so the address and the user agent of the request are in no response | `backend/packages/domain/src/mappers/read/booking.mapper.ts` |
| 7. Repository interface | `create` takes the validated request and what the booking keeps of how it came to be (`BookingOrigin`: the number, who created it, the client) and answers with a sum type, `BookingCreation`: created, or why not (`invalid` with the issues, `timeZoneUnknown`, `staffOccupied` with the staff members, `bookingNumberTaken`). `findById` and `list` take the reach of the reader, and a booking outside of it is one that does not exist. The number is issued behind an interface of its own, `IBookingNumberIssuer`, because randomness is not the domain's | `backend/packages/domain/src/repositories/booking.repository.ts`, `backend/packages/domain/src/services/booking-number-issuer.ts` |
| 8. Repository implementation | One transaction, at `read committed`. It locks the rows the request refers to, always in the same order: the salon, the customer and the services `FOR SHARE`, so they are neither deleted nor changed until the booking is written, and every staff member the request names `FOR UPDATE`, in the order of their IDs, so the bookings of one staff member are written one after the other and two requests that name two staff members in opposite orders do not wait for each other for ever. It then calls `planBooking` with what it found, reads the times at which those staff members are taken and calls `isOccupiedBeyondCapacity`, and writes the booking, its lines and the first entry of the history. The insert of the booking does nothing when another booking has its number (`onConflictDoNothing` on the number), and the repository answers `bookingNumberTaken`. The reach of a reader is a condition of the query (`within`), not a check after it | `backend/packages/infrastructure/src/repositories/booking.repository.impl.ts`, `backend/packages/infrastructure/src/security/random-booking-number-issuer.ts` |
| 9. Use cases | The permission is decided in two steps. `bookingReachOf` says which bookings the actor reaches, before the body, the query or the ID is looked at: none is a 403 whatever else is wrong. Once the validated request names a salon, `isWithin` says whether that salon is within the reach (403). The rows are planned by a pure function, `planBooking`: from the request and the rows it refers to, it derives the times and the amounts of the lines and of the booking, the day of the visit in the time zone of the salon and the tax, and it reports everything the request refers to that is not there at once. Whether a staff member is occupied is pure as well (`occupancyWindowOf`, `isOccupiedBeyondCapacity`). `toRefusalError` turns a refusal into the error of the client; a number that is taken is not among them, the use case issues another and tries again, three times in all | `backend/packages/domain/src/business-logic/booking/` |
| 10. Handlers and router | A router with `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` and one `POST /:id/<action>` for each action on the status and for the reschedule, built like that of the customer ledger. The handler of the create passes the address and the user agent of the request to the use case, and the booking keeps them | `backend/packages/api/src/routes/booking/` |
| 11. Wiring | The router is mounted at `/bookings` with its repository and the issuer of the numbers. It gets no salon repository: the path names no salon, and whether the salon of a request exists is decided inside the transaction of the create | `backend/packages/api/src/index.ts` |
| 12. Tests | The plan and the occupancy are tested as the pure functions they are, with no repository. The integration test sends bookings for the same staff member at the same moment and counts how many are entered, sends two that name two staff members in opposite orders, and holds a transaction open on a staff member and on a service to show that a create waits for it and then decides from what was written. It reads as the member of another salon (404, not listed, a cursor that is refused), calls the repository directly and inserts rows that the constraints refuse | `backend/packages/api/src/__tests__/booking.integration.test.ts`, `backend/packages/domain/src/__tests__/booking.plan.test.ts`, `backend/packages/domain/src/__tests__/booking.rules.test.ts`, `backend/packages/domain/src/__tests__/booking.usecase.test.ts` |

#### A Status That Is Changed by Actions

The status of a booking is not a property of an update request. Each change is an operation of its own (`POST /api/v1/bookings/{id}/confirm`, `/cancel`, `/start`, `/complete`, `/no-show`), because each has its own rule, its own request and its own effects. The five are built as one:

| Step | What the status actions show | Where to read it |
|------|------------------------------|------------------|
| 1. API contract | One operation per action, with a body only where the user has something to say (the reason of a cancellation, the actual times of a visit). Each declares 409 for a status the action does not lead on from, and its `@doc` names the statuses it leads on from and what it writes besides the status | `specs/operations/booking-operations.tsp` |
| 3. Database schema | CHECK constraints tie what goes with a status to the status: a booking has the time it was cancelled exactly when it is cancelled, and the time it was completed exactly when it is completed. The counters of a customer are constrained to what counts can be. The migration sets the counters to what the bookings say and fails on rows for which nothing says what was meant | `backend/packages/database/sql/migrations/202611160300_booking_status_rules.sql` |
| 4. Models | `BookingStatusWrite` is everything one action writes: the columns of the booking, the moment its lines are completed at (or null), the row of the status history, and whether the customer is counted again | `backend/packages/domain/src/models/booking.ts` |
| 7. Repository interface | One method for all actions, `changeStatus(id, reach, action, changedBy)`. The action is a sum type (`BookingAction`), and so is the answer (`BookingStatusChange`): changed, not found, or why not | `backend/packages/domain/src/repositories/booking.repository.ts` |
| 8. Repository implementation | One transaction at `read committed`. It locks the booking `FOR UPDATE` within the reach of the actor in a subquery and reads, in that statement, the status, the times and `clock_timestamp()` of the row the subquery returns: the clock is the database's at the moment the change got hold of the booking. `now()` is the moment the transaction began, before what it waited for, and by it a change that waited would be written as the earlier one; `updatedAt` and the `createdAt` of the history are written with `clock_timestamp()` for the same reason. It asks `planStatusChange` and writes what the plan says: the booking, the lines that are not completed yet, the history. When the booking arrives at a status that is counted, it locks the customer and sets the counters from a count of the customer's bookings; a count is right whatever was stored before, an increment is right only if every writer before was. The order of the locks is always the booking, then the customer. A booking and its lines are read by one statement (a join), so a reader never meets a completed booking with lines that are not | `backend/packages/infrastructure/src/repositories/booking.repository.impl.ts` |
| 9. Use cases | The transitions are a table (`TRANSITIONS`: from which statuses an action leads to which), and `planStatusChange` is a pure function of the booking as it was read, the action and who acts when. It answers with the rows to write or with a refusal (`StatusChangeRefusal`), which `changeBookingStatus` turns into a conflict that names the status and those the action leads on from. The five use cases differ only in how they read their request; the order of the checks is theirs together: the reach of the actor (403), the ID (400), the request (400), then the repository (404, 409) | `backend/packages/domain/src/business-logic/booking/_shared/status.ts`, `_shared/change-status.ts` |
| 10. Handlers and router | One handler file per action, named after it (`confirm-booking.handler.ts`), answering 200 with the booking as it is then | `backend/packages/api/src/routes/booking/` |
| 12. Tests | The rule is tested as the pure function it is, for every pair of an action and a status. The integration test takes every action from every status over HTTP, sends the same action several times at the same moment and counts the rows of the history, holds a transaction open on the booking and on the customer to show that an action waits and then decides from what was committed, and changes several bookings of one customer at once to show that no count is lost | `backend/packages/domain/src/__tests__/booking.status.test.ts`, `backend/packages/domain/src/__tests__/booking-status.usecase.test.ts`, `backend/packages/api/src/__tests__/booking-status.integration.test.ts` |

#### A Booking That Is Changed or Removed Afterwards

Three more operations write a booking that exists: `PATCH /api/v1/bookings/{id}` (what the salon notes of it), `POST /api/v1/bookings/{id}/reschedule` (its time and its staff member in charge) and `DELETE /api/v1/bookings/{id}`. Each writes columns of its own, so that none of them goes around the rules of another, and all three begin as an action on the status does, by locking the booking:

| Step | What the three operations show | Where to read it |
|------|--------------------------------|------------------|
| 1. API contract | The update request has the four properties a salon notes of a booking (the deposit, the request of the customer, the internal notes, the source) and nothing else: the status has its actions and the time has the reschedule, so an update cannot go around the rules of either. The reschedule is an action, `POST /{id}/reschedule`, with a request of two required properties (the new beginning and the staff member in charge); it declares 409 for a status from which a booking is not moved and for a staff member who is occupied. The delete declares 409 for a booking that other records refer to, and its `@doc` says who may call it, what is deleted with the booking and what is counted again | `specs/operations/booking-operations.tsp`, `specs/models/booking.tsp` |
| 3. Database schema, `pnpm check:api-db` | No migration. The foreign keys to `bookings` already say what a delete does to the rows that refer to a booking: the lines and the status history go with it (`ON DELETE CASCADE`), a sale and a treatment record keep it (`ON DELETE RESTRICT`). A review keeps it as well, although its foreign key cascades: the repository looks for one first ([the reviews](#rows-a-customer-writes-about-a-visit-the-reviews)). The rule of the update request leaves out, besides the columns the system decides, the salon, the customer and the staff member | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. Models | `DbBookingNotes` is the columns an update writes, each of them optional. `BookingRescheduleWrite` is what a reschedule writes: the staff member, the day and the times of the booking, and the staff member and the times of each of its lines | `backend/packages/domain/src/models/booking.ts` |
| 5. Validation schemas | The update schema is made of the same definitions as the create (`notedOfBooking`), with every property optional and at least one present. The reschedule schema reads the beginning by the rule of the create (`minuteInUtc`: UTC, on a whole minute, in one spelling) | `backend/packages/domain/src/schemas/booking.schema.ts` |
| 7. Repository interface | `update(id, reach, notes)` resolves to the booking or to `null`. `reschedule(id, reach, request)` and `delete(id, reach)` answer with sum types: `BookingReschedule` (rescheduled, not found, or why not: `statusDoesNotAllow`, `invalid`, `timeZoneUnknown`, `staffOccupied`, the last three being refusals of a create as well) and `BookingDeletion` (deleted, not found, or `referredTo` with what refers to the booking) | `backend/packages/domain/src/repositories/booking.repository.ts` |
| 8. Repository implementation | Each method is one transaction at `read committed` that first locks the booking `FOR UPDATE` within the reach of the actor, in a statement of its own. A time of the change is written with `clock_timestamp()` in a later statement: a clock in the statement that waits for the lock can be read before the wait. The update then writes the named columns. The reschedule reads the lines, asks `moveBooking`, locks the salon `FOR SHARE` and the staff members of the moved lines `FOR UPDATE` in the order of their IDs, asks `planReschedule`, reads the times at which those staff members are taken by other bookings (the lines of the booking itself are left out, or it would stand in its own way), and writes the booking and each line. The order of the locks is the booking, the salon, the staff members; a create locks no booking, so the two cannot wait for each other for ever. The delete looks for a sale, a treatment record and a review that refer to the booking before it deletes, so the refusal is an answer of its own and not a violated foreign key; a sale that is being written holds the booking (the lock a foreign key takes), so the delete waits for it and then finds it. When the status of the deleted booking was counted, the customer is locked and counted again, booking before customer as in an action | `backend/packages/infrastructure/src/repositories/booking.repository.impl.ts` |
| 9. Use cases | The permission of a delete is a reach of its own, `bookingRemovalReachOf`: an administrator, and of a salon the owner and the managers, because a delete takes the history of the booking with it and changes what the customer has of visits; the staff cancel a booking that will not take place. The update and the reschedule use `bookingReachOf`. The order of the checks is that of the actions: the reach (403), the ID (400), the request (400), then the repository (404, 409). The rules of a move are two pure functions: `moveBooking` says whether the status allows it and what the booking and its lines are afterwards, and `planReschedule` says, from the staff members and the time zone that were read, what to write and whom the booking occupies when, or that the staff member in charge is not one of the salon. The refusals a reschedule shares with a create go through `toRefusalError` | `backend/packages/domain/src/business-logic/booking/_shared/authorization.ts`, `_shared/reschedule.ts`, `update-booking.usecase.ts`, `reschedule-booking.usecase.ts`, `delete-booking.usecase.ts` |
| 10. Handlers and router | `PATCH /:id`, `DELETE /:id` and `POST /:id/reschedule`, one handler file each. The update and the reschedule answer 200 with the booking as it is then, the delete 204 with no body | `backend/packages/api/src/routes/booking/` |
| 12. Tests | The move and its plan are tested as pure functions, the three use cases together for what they share (the order of the checks, the booking of another salon). The integration test moves two bookings to one time at the same moment and counts how many are moved, moves bookings whose staff members are named in opposite orders, sends a move, a note and an action on the status of one booking at once and checks that all three are kept, holds a transaction open on the booking to show that a change waits and writes the time after the wait, deletes a booking while a sale is being written for it, and removes bookings of a customer while others of theirs are completed to show that the count is right | `backend/packages/domain/src/__tests__/booking.reschedule.test.ts`, `backend/packages/domain/src/__tests__/booking-changes.usecase.test.ts`, `backend/packages/api/src/__tests__/booking-changes.integration.test.ts` |

#### What a Booking Refers to Is Not Deleted

A rule of one domain can belong to the deletes of others. A booking that is not finished expects its salon, its customer, its staff members and its services, so their four deletes refuse (409) while such a booking refers to them. No operation is added.

| Step | What the rule shows | Where to read it |
|------|---------------------|------------------|
| 1. API contract | The four delete operations say the rule in their description, and those that had no 409 declare one | `specs/operations/customer-operations.tsp`, `staff-operations.tsp`, `service-operations.tsp`, `salon-operations.tsp` |
| 7. Repository interface | A delete answers with a sum type instead of a boolean: `deleted`, `notFound` or `bookingsUnfinished` (`CustomerDeletion`, `SalonDeletion`, `StaffDeletion`; `ServiceDeletion` has `containedInPackage` as well) | `backend/packages/domain/src/repositories/` |
| 8. Repository implementation | One transaction at `read committed`: lock the row to delete `FOR UPDATE` in a statement of its own, look for a booking that is not finished in the next one, then mark the row. A create, a reschedule and the addition of a line hold the rows they refer to, so the delete waits for them, and only a statement that begins after the wait sees what they wrote. The bookings are read, never locked: a writer of a booking locks the booking before what it refers to. The time of the delete is `clock_timestamp()` (`database/clock.ts`) | `backend/packages/infrastructure/src/repositories/unfinished-bookings.ts` and the four `delete` methods |
| 9. Use cases | Which statuses are not finished is derived from the transitions (`UNFINISHED_STATUSES`: the statuses an action leads on from). The four use cases turn `bookingsUnfinished` into one conflict that names what was to be deleted | `backend/packages/domain/src/business-logic/booking/_shared/status.ts`, `business-logic/_shared/unfinished-bookings.ts` |
| 12. Tests | One file for the four deletes, table-driven: every status of the booking, a row held the way a create holds it (the delete finds the booking after the wait, and writes the time after the wait), a create and the delete at the same moment (one of the two outcomes, never both) | `backend/packages/api/src/__tests__/booking-references.integration.test.ts` |

#### Lines That Are Added to a Booking and Removed from It

A booking is entered with its service lines, and until it is finished a line can be added to it and removed from it: `POST /api/v1/bookings/{bookingId}/services`, and `GET` and `DELETE /api/v1/bookings/{bookingId}/services/{id}`, the three operations of `BookingServiceCrud`. A line is a row of its own, but what the booking says of its lines taken together (the day, the times, the amounts, the tax) is stored in the booking, so whatever writes a line writes the booking as well:

| Step | What the service lines show | Where to read it |
|------|-----------------------------|------------------|
| 1. API contract | The interface is below a booking, and its path names the booking `bookingId` and the line `id`. The create takes the model that a line has in the request of a new booking (`BookingServiceCreateRequest`), so a line is asked for in one way. There is no update and no list: a line is replaced by adding one and removing one, and the lines of a booking are read with the booking. The create and the delete declare 409, and their `@doc` says what refuses them | `specs/operations/booking-operations.tsp` |
| 3. Database schema, `pnpm check:api-db` | A line keeps whether its price includes the tax (`taxIncluded`), as it keeps the price: the booking is summed up again from its lines whenever one is added or removed, and a sum that read the services again would change what the lines that stay cost. The column has no default, so a writer that leaves it out fails, and the migration fills the rows written before from their services. The column is in the response and among the `omittedColumns` of the request | `backend/packages/database/sql/migrations/202611160400_booking_services_tax_included.sql`, `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. Models | `DbBookingSummary` is the columns of a booking that follow from its lines: a create writes them with the booking, and a change of the lines writes them again. `parseBookingIdOfPath` reads the booking of the path and reports a failure under `bookingId`, the name the contract gives the parameter | `backend/packages/domain/src/models/booking.ts` |
| 5. Validation schemas | The schema of the request is the schema of a line of the create request (`bookingServiceCreateRequestSchema`). What depends on the lines the booking has already (twenty lines, 24 hours) cannot be checked by a schema and is a rule of the plan | `backend/packages/domain/src/schemas/booking.schema.ts` |
| 6. Mappers | `toApiBookingService` maps one line with the function that maps each line of a booking | `backend/packages/domain/src/mappers/read/booking.mapper.ts` |
| 7. Repository interface | `addService(id, reach, request)` and `removeService(id, serviceId, reach)` answer with sum types: `BookingServiceAddition` (added, not found, `staffOccupied`, or why the line was not planned) and `BookingServiceRemoval` (removed, not found, or why the line stays). `findService(id, serviceId, reach)` resolves to the line or to `null` | `backend/packages/domain/src/repositories/booking.repository.ts` |
| 8. Repository implementation | Each write is one transaction at `read committed` that first locks the booking `FOR UPDATE` within the reach of the actor and reads its lines, then locks the salon `FOR SHARE` (`heldForLines`): the lines, the tax rate and the time zone that the booking is summed up from do not change until it is written. An addition then locks its service `FOR SHARE` and its staff member `FOR UPDATE`, as a create does, and checks the occupancy without the lines of the booking itself. A removal locks no staff member, because it only frees time. The locks are taken in the order of the other writers of a booking that exists: the booking first, then the salon, then what the request refers to | `backend/packages/infrastructure/src/repositories/booking.repository.impl.ts` |
| 9. Use cases | `summarize` sums a booking up from its lines, and `planBooking` uses it as well, so a booking that is entered and a booking whose lines changed are computed by the same code. `planServiceAddition` and `planServiceRemoval` are pure functions of the booking as it was read, the request and the rows it refers to. They answer with what to write or with a refusal (a booking that is finished, a booking that would have more than twenty lines or none, a visit of more than 24 hours), which the use cases turn into conflicts. A removal is not the delete of a booking, so the staff of the salon may (`bookingReachOf`, not `bookingRemovalReachOf`) | `backend/packages/domain/src/business-logic/booking/_shared/summary.ts`, `_shared/service-lines.ts`, `create-booking-service.usecase.ts`, `get-booking-service.usecase.ts`, `delete-booking-service.usecase.ts` |
| 10. Handlers and router | A router of its own with `POST /`, `GET /:id` and `DELETE /:id`, created with `mergeParams`, because it is mounted below a booking. The links of a line are built from the mount path: the line itself, and its booking | `backend/packages/api/src/routes/booking-service/` |
| 11. Wiring | Mounted at `/bookings/:bookingId/services`, before the router of the ledger and with the same dependencies | `backend/packages/api/src/index.ts` |
| 12. Tests | The plans are tested as pure functions, with amounts at the limit of what a column holds. The integration test compares the booking after an addition and after a removal with what its lines add up to, holds a transaction open on the booking, on the salon, on the service and on the staff member to show that a write waits and uses what it finds after the wait, and sends additions and removals at the same moment and counts what is left | `backend/packages/domain/src/__tests__/booking.service-lines.test.ts`, `backend/packages/domain/src/__tests__/booking-services.usecase.test.ts`, `backend/packages/api/src/__tests__/booking-services.integration.test.ts` |

#### What Is Worked Out and Not Stored

The available slots of a salon (`GET /api/v1/salons/{salonId}/available-slots` and `POST /api/v1/salons/{salonId}/available-slots/check`, the two operations of `AvailableSlotCrud`) have no table: every answer is worked out from the hours of the salon, the schedules of its staff and the bookings there are. They show a domain whose rules read the data of other domains and write nothing:

| Step | What the available slots show | Where to read it |
|------|-------------------------------|------------------|
| 1. API contract | Two operations that answer different questions, and their `@doc` says which: the list is what a customer can book, the check is whether the ledger would take a booking. The check is a `POST` that answers 200. A model without a table is in no rule of `pnpm check:api-db` | `specs/operations/booking-operations.tsp`, `specs/models/booking.tsp` |
| 3. Database schema | A rule that only the requests kept (one row of the calendar per date) becomes a unique index once code relies on it: the slots let the row of a date decide alone. The migration keeps the row that was written last, and is tested like every other one | `backend/packages/database/sql/migrations/202611160600_opening_hours_one_row_per_date.sql` |
| 4. Models | No `Db` type of its own: `SalonOfSlots`, `ServiceOfSlots` and `StaffOfSlots` pick the columns that the rules read from the rows of the other domains, so a rule cannot read a column that the repository did not select | `backend/packages/domain/src/models/available-slot.ts` |
| 5. Validation schemas | The slots have no ID, so the cursor of a page is its last slot, and the schema checks it with the function that reads it (`slotPositionOf`) | `backend/packages/domain/src/schemas/available-slot.schema.ts`, `backend/packages/domain/src/business-logic/available-slot/_shared/page.ts` |
| 7. Repository interface | Two reads that return what a rule needs and decide nothing: `findDay` (null for a salon that is not there) and `findOccupancy` | `backend/packages/domain/src/repositories/available-slot.repository.ts` |
| 8. Repository implementation | One transaction that is `repeatable read` and read only: every statement sees the same moment, nothing is locked and nothing waits. What depends on the time zone of the salon is read wide (`widestDayOf`: the date in any time zone, and the longest time a staff member keeps free around a booking) and narrowed by the rules, so the repository interprets no time zone | `backend/packages/infrastructure/src/repositories/available-slot.repository.impl.ts` |
| 9. Use cases | The rules are pure functions of what was read and of `now`, which comes from the `clock` of the dependencies: when the salon is open (`openRangesOf`), when a staff member works (`workingRangesOf`), what the salon takes (`acceptance.ts`) and the slots themselves (`slotsOf`, a sum type that has a case for a time zone the runtime does not know). A time of day becomes a moment in one file (`salon-time.ts`). The occupancy is decided by the function of the ledger, so the list offers nothing that the ledger would refuse | `backend/packages/domain/src/business-logic/available-slot/` |
| 10. Handlers and router | The list handler hands the decoded query over as a `Result`, because the use case looks at the path first. The router is created with `mergeParams`, because it is mounted below a salon | `backend/packages/api/src/routes/available-slot/` |
| 11. Wiring | Mounted at `/salons/:salonId/available-slots`, with the salon repository and the clock | `backend/packages/api/src/index.ts` |
| 12. Tests | The rules are tested with a fixed `now`. The integration test cannot give the server a clock, so its dates are counted from today, and it finds the nights on which the clocks of a time zone change from what the runtime knows of the zone | `backend/packages/domain/src/__tests__/available-slot.slots.test.ts`, `backend/packages/api/src/__tests__/available-slot.integration.test.ts` |

#### What a Customer Does With Their Own Bookings

A customer books, reads, moves and cancels their own bookings at `/api/v1/customers/me/bookings` (the five operations of `CustomerBookings`). The bookings are rows of the ledger, so the routes share its tables, its repository and its rules, and show how a second way into the same data is added without a second set of rules:

| Step | What a customer's own bookings show | Where to read it |
|------|-------------------------------------|------------------|
| 1. API contract | An interface of its own at a fixed path below `/customers/me`, without the ID of the customer. Response models of their own, because the same rows are shown differently: `CustomerBookingResponse` leaves out what the salon notes and records. The create request names a slot, not the columns of a row, and has no rule in `pnpm check:api-db`; the cancel and the reschedule take the requests of the ledger | `specs/operations/booking-operations.tsp`, `specs/models/booking.tsp`, `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. Models | Whose bookings a query is about is a sum type: `BookingReach` is a `LedgerReach` (every salon, or one) or a `CustomerReach` (the bookings of one customer). The methods that only the ledger has take a `LedgerReach`, so the compiler refuses the reach of a customer where a customer has no operation | `backend/packages/domain/src/models/booking.ts`, `backend/packages/domain/src/repositories/booking.repository.ts` |
| 5. Validation schemas | The search is the search of the ledger without the conditions a customer does not have (`omit`), so a parameter has one rule wherever it is sent | `backend/packages/domain/src/schemas/booking.schema.ts` |
| 6. Mappers | The read mapper is built on the one of the ledger and names every property it returns, so a property added to the ledger's response is not shown to the customer by itself | `backend/packages/domain/src/mappers/read/customer-booking.mapper.ts` |
| 7. Repository interface | `book` answers with a sum type that says what stood in the way (`CustomerBookingCreation`): the customer or what the request names is not there, the time is not a slot, the salons do not take bookings from the customer, the customer is booked elsewhere. `rebook` answers with `CustomerBookingReschedule`, which is put together from the answers of the two pure functions that decide a move, so a refusal has one name in the rules, in the repository and in the use case | `backend/packages/domain/src/repositories/booking.repository.ts` |
| 8. Repository implementation | One `read committed` transaction locks the salon, the customer, the service and the staff member in the order of the ledger's create, and reads everything a slot depends on after the locks, so two requests cannot both find the slot free, the last booking of a day still to take or the customer not booked. The reads of a day are those of the slots' repository (`slot-reads.ts`). The time zone of the salon is known only after the locks, so the reads are wide (`candidateDatesOf`, `candidateTimeOf`) and the plan narrows them. A move (`rebook`) holds the booking first, as every change of a booking does, and then takes the same locks and makes the same reads, told which booking to leave out | `backend/packages/infrastructure/src/repositories/booking.repository.impl.ts`, `backend/packages/infrastructure/src/repositories/slot-reads.ts` |
| 9. Use cases | `ownBookingsOf` turns the actor into the reach, or into 403 or 404, before anything is read. A customer can book what the list of slots offers and nothing else, and that is one function called twice: `planCustomerBooking` asks the `slotsOf` of the list for the day and looks for the time among its slots, then makes the rows with the `planBooking` of the ledger. The cancel is an action of the status rules of its own (`cancelAsCustomer`), so the one difference to the cancel of the ledger, that the booking has not begun, is a case of the same pure function. The move of a customer is the move of the ledger and more: `moveCustomerBooking` and `planCustomerMove` (`_shared/move.ts`) call `moveBooking` and `planReschedule`, and then hold the result to the slot with `refusalOfSlot`, the checks that `planCustomerBooking` makes. What the two creates and the five actions share is shared: `underFreeNumber`, `toStatusRefusalError` | `backend/packages/domain/src/business-logic/customer-booking/`, `backend/packages/domain/src/business-logic/booking/_shared/status.ts`, `backend/packages/domain/src/business-logic/_shared/numbered.ts` |
| 10. Handlers and router | A plain `Router()`. The handlers take the path parameters, the links and the decoding of the query from the routes of the ledger, and have response types of their own | `backend/packages/api/src/routes/customer-booking/` |
| 11. Wiring | Mounted at `/customers/me/bookings` before the routers of the customers, with the dependencies of the ledger and the clock | `backend/packages/api/src/index.ts` |
| 12. Tests | The plan is tested as a pure function, branch by branch and in the order of its checks. The integration test books every slot the list offers and is refused what it does not offer, sends six requests at the same moment for one slot, for the last booking a service takes that day and from one customer for one time, and counts the bookings that were written | `backend/packages/domain/src/__tests__/customer-booking.plan.test.ts`, `backend/packages/domain/src/__tests__/customer-booking.move.test.ts`, `backend/packages/domain/src/__tests__/customer-booking.usecase.test.ts`, `backend/packages/api/src/__tests__/customer-booking.integration.test.ts`, `backend/packages/api/src/__tests__/customer-booking-reschedule.integration.test.ts` |

### A Request That States Its Amounts: the Sales Ledger

A sale belongs to a salon and its routes are not below one (`/api/v1/sales`), so the sales ledger (the list, the create, the get, the update and the void of `SaleCrud`) follows the booking ledger in what is said above: the reach, the plan, the transaction, the number. It is the example of a request that does not leave its amounts to the server, because a sale is what the till charged. Its rules are in [Sales Ledger](./sales.md) (Japanese). What it shows that the booking ledger does not:

| Step | What the sales ledger shows | Where to read it |
|------|------------------------------|------------------|
| 3. Database schema | CHECK constraints on values that a request states (the total of a line is quantity times unit price, less the discount, plus the tax, worked out as `bigint`), next to the rule of the schema that answers 400 before them; a partial unique index for a rule between rows (one sale that is not void for a booking); no foreign key from a line to what was sold, because `itemType` says which table `itemId` is of | `backend/packages/database/sql/migrations/202611160700_sales_rules.sql` |
| 5. Validation schemas | `.check()` on a line, on the list of lines and on the request. An issue that a `.check()` pushes stops the checks after it unless it carries `continue: true`; those of a line and of the list carry it, so one answer names everything. The arithmetic of a line is done with `BigInt`, and only when its amounts are within their range | `backend/packages/domain/src/schemas/sale.schema.ts` |
| 6. Mappers | No write mapper: `planSale` makes the rows, the commission rate as the text a `numeric(5,2)` column takes. The read mapper names every property, so what a payment processor answered does not reach a response | `backend/packages/domain/src/business-logic/sale/_shared/plan.ts`, `backend/packages/domain/src/mappers/read/sale.mapper.ts` |
| 7. Repository interface | `SaleCreation` is the refusals of the plan and two outcomes of the write (`created`, `saleNumberTaken`); `SaleUpdate` and `SaleVoiding` are what became of an update and of a void, with the refusals that `_shared/change.ts` names; `findById`, `list`, `update` and `voidSale` take a `LedgerReach` | `backend/packages/domain/src/repositories/sale.repository.ts` |
| 8. Repository implementation | The create takes the locks that its foreign keys would take, before it writes and in the order of every writer: the booking `FOR UPDATE`, then the salon, the customer and the staff members by ID `FOR KEY SHARE`. The look for a sale of the booking is a statement after the lock. The reads run in a read-only `REPEATABLE READ` transaction, because a sale is returned with the rows of a second query, its payments. The update and the void hold the sale `FOR UPDATE` before anything else, which is the lock that the foreign key of a payment waits for, and read what they decide by in the statements after it; an update then locks only what the request names, in the order of the create | `backend/packages/infrastructure/src/repositories/sale.repository.impl.ts` |
| 9. Use cases | `saleReachOf` answers with the `LedgerReach` of the bookings, and `isWithin` is theirs; `saleVoidReachOf` leaves the staff out, as `bookingRemovalReachOf` does for the delete of a booking; what an update writes and why a change is refused are pure functions (`planSaleChange`, `refusalOfChange` and `refusalOfVoid` in `_shared/change.ts`); the number is tried three times by `underFreeNumber`, which the bookings use too | `backend/packages/domain/src/business-logic/sale/`, `backend/packages/domain/src/business-logic/_shared/numbered.ts`, `backend/packages/domain/src/business-logic/_shared/record-number.ts` |
| 12. Tests | The schema is tested rule by rule and for everything at once, the plan as a pure function in the order of its checks. The integration test bills one booking six times at once, holds a booking, a salon, a customer and a staff member while a sale waits for them, sends a sale and a booking that name the same two staff members, and breaks every constraint of the two tables. The one of the changes voids one sale six times at once, corrects six sales to one booking, voids a sale while a payment of it is being written, and probes that the sale is held before the booking | `backend/packages/domain/src/__tests__/sale.schema.test.ts`, `backend/packages/domain/src/__tests__/sale.plan.test.ts`, `backend/packages/domain/src/__tests__/sale.change.test.ts`, `backend/packages/api/src/__tests__/sale.integration.test.ts`, `backend/packages/api/src/__tests__/sale-changes.integration.test.ts` |

### What Is Made and Not Stored: the Receipt and the Calculation of a Sale

The receipt of a sale (`getReceipt` of `SaleCrud`) and the calculation of a sale before it is entered (`calculate`) write nothing: a receipt is made from a stored sale at every request, and a calculation from the rows a request names. They are the example of an operation whose answer is worked out and kept nowhere. Their rules are in [Sales Ledger](./sales.md) (Japanese). What they show that the sales ledger does not:

| Step | What the receipt and the calculation show | Where to read it |
|------|-------------------------------------------|------------------|
| 1. API contract | The contract of the calculation was narrowed before it was implemented: a discount code, points to use, a customer and notes were removed, because no table holds discount codes, the worth of a point is not decided and the others change no amount, and a salon was added, whose tax rate and payment methods are used. The receipt declares 409 for a sale that has none | `specs/operations/payment-operations.tsp` (`SaleCrud`), `specs/models/payment.tsp` |
| 3. `pnpm check:api-db` | `SaleBreakdownResponse` has the values of the amount columns of a sale that is not written yet, so it has a rule of `sales` that leaves out every other column. The request and the two responses that wrap row models have no rule of their own | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 7. Repository interface | The receipt uses `findById` of the get. The calculation has a read of its own, `findCalculationReferences`, which returns what the request refers to as it is, and leaves every decision to the plan | `backend/packages/domain/src/repositories/sale.repository.ts` |
| 8. Repository implementation | The salon, the lines of the booking, the services and the payment methods are read in one read-only `REPEATABLE READ` transaction, without a lock: nothing is written, so nothing needs to wait | `backend/packages/infrastructure/src/repositories/sale.repository.impl.ts` |
| 9. Use cases | Why a sale has no receipt is a pure function (`refusalOfReceipt`); the calculation is a pure function too (`planCalculation`), and it sums its lines up with `amountsOf`, the function that sums a booking up, so the two never round the tax differently. The time of a receipt comes from the `clock` of the dependencies | `backend/packages/domain/src/business-logic/sale/_shared/receipt.ts`, `backend/packages/domain/src/business-logic/sale/_shared/calculation.ts`, `backend/packages/domain/src/business-logic/_shared/amounts.ts` |
| 10. Handlers and router | `POST /calculate` names no sale, so its route has no `:id`; the receipt is a route below a sale | `backend/packages/api/src/routes/sale/get-sale-receipt.handler.ts`, `backend/packages/api/src/routes/sale/calculate-sale.handler.ts` |
| 12. Tests | The plan of a calculation is tested as a pure function, with an example whose tax differs by a yen when it is rounded per line. The integration test checks that nothing is written, and that a receipt and a calculation that arrive while rows they read are being changed answer at once with what was committed | `backend/packages/domain/src/__tests__/sale.calculation.test.ts`, `backend/packages/domain/src/__tests__/sale.receipt.test.ts`, `backend/packages/api/src/__tests__/sale-receipt-calculation.integration.test.ts` |

### Rows Below a Record That Its Value Is Counted From: the Payments of a Sale

A payment is a row below a sale (`payment_transactions`), and the payment status of the sale is counted from the payments of the sale whenever one is written. The two operations are an action on the sale (`process` of `SaleCrud`, the record of a payment) and an action on the row (`refund` of `PaymentCrud`). No payment processor is connected, so a payment is the record of what the till took. Who may is decided by the functions of the sales ledger. Their rules are in [Payments](./payments.md) (Japanese). What they show that the sales ledger does not:

| Step | What the payments show | Where to read it |
|------|------------------------|------------------|
| 1. API contract | Two actions on two paths: the record of a payment below the sale and the refund of a payment on the payment. No operation reads one payment; a sale returns its payments. The `@doc` says that no payment processor is connected, what is refused with 409 and with 400, and what each value of `PaymentStatusType` means for a payment and for a sale | `specs/operations/payment-operations.tsp` (`SaleCrud`, `PaymentCrud`), `specs/models/payment.tsp` |
| 3. Database schema | CHECK constraints tie the columns that go with a status to it (the time a payment was received at; the time, the amount and the reason of a refund; the time and the error of a failure) and hold a refund in full to the whole amount. A rule over the payments of a sale is left to the transaction that holds the sale | `backend/packages/database/sql/migrations/202611160900_payment_transaction_rules.sql` |
| 3. `pnpm check:api-db` | The request of a payment adds a row, so it is a create rule of `paymentTransactions`; the request of a refund writes a part of a row that exists and has no rule | `paymentRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 6. Mappers | One read mapper of a payment, used by the response of a payment and by that of a sale. No write mapper: `planPayment` and `planRefund` work out what is written | `backend/packages/domain/src/mappers/read/payment.mapper.ts`, `backend/packages/domain/src/business-logic/payment/_shared/plan.ts` |
| 7. Repository interface | `PaymentRecording` and `PaymentRefunding` are what became of a payment and of a refund, with the refusals of the plan | `backend/packages/domain/src/repositories/payment.repository.ts` |
| 8. Repository implementation | The sale is held `FOR UPDATE` first, by the function the update and the void of a sale use, and its payments are read in the statement after it; the payment method is read `FOR SHARE`; the payment, or the refund, and the payment status of the sale are written in the same transaction, the times from the clock of the database. A refund reads the sale of the payment without a lock, holds the sale and reads the payment again | `backend/packages/infrastructure/src/repositories/payment.repository.impl.ts`, `backend/packages/infrastructure/src/repositories/held-sale.ts` |
| 9. Use cases | `saleReachOf` for a payment and `saleVoidReachOf` for a refund; the payment status of a sale, why a sale takes no payment and what a payment and a refund write are pure functions (`paymentStatusOf`, `refusalOfPayment`, `planPayment`, `planRefund`); the payment number is tried three times by `underFreeNumber` | `backend/packages/domain/src/business-logic/payment/` |
| 10. Handlers and router | The record of a payment is a handler of the sale router, which takes the dependencies of the payments as well; the refund has a router of its own at `/payments` | `backend/packages/api/src/routes/sale/process-sale.handler.ts`, `backend/packages/api/src/routes/payment/` |
| 12. Tests | The plan is tested as pure functions in the order of its checks. The integration test sends six payments of one sale at once (the whole, parts that add up to it, parts that exceed it), six refunds of one payment, a payment and a void together, holds a sale and a payment method while a payment waits for them, and breaks every constraint of the table. The tests that write payments directly take the columns that go with a status from `paymentColumns` | `backend/packages/domain/src/__tests__/payment.plan.test.ts`, `backend/packages/domain/src/__tests__/payment.usecase.test.ts`, `backend/packages/api/src/__tests__/payment.integration.test.ts`, `backend/packages/api/src/__tests__/_shared/payment-helpers.ts` |

### Figures Counted from the Rows of Other Domains: the Sales Reports

The sales reports (`SalesReportCrud`) have no table: every report is counted from the sales ledger, its lines and its payments when it is asked for, and stored nowhere. They are the example of a read-only domain whose answer is a sum of the rows of others. Their rules are in [Sales Reports](./sales-reports.md) (Japanese). What they show that the sales ledger does not:

| Step | What the sales reports show | Where to read it |
|------|-----------------------------|------------------|
| 1. API contract | The queries were narrowed before they were implemented: every parameter is required and has no default, a parameter that decided nothing (the grouping of a report, whether to include refunds) was removed, and the satisfaction of customers was removed from the staff row, because no table records it. The export wrote a file in one of three formats and answered its download URL, but nothing stores files: it answers a CSV file itself, the one operation whose success is not wrapped in `ApiResponse`. Each figure says in its `@doc` which rows it is counted from | `specs/operations/payment-operations.tsp` (`SalesReportCrud`), `specs/models/payment.tsp` |
| 3. `pnpm check:api-db` | A report has no table, so no model of it has a rule. Its properties take the names of the columns they are counted from where there is one (`displayName`, `category`, `method`) | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 5. Validation schemas | A rule of two parameters, checked once both are dates: the end is not before the beginning, and the period is at most 366 days, both ends included, counted in calendar days | `backend/packages/domain/src/schemas/sales-report.schema.ts` |
| 7. Repository interface | One read, `findFigures`, returns sums (`SalesFigures`) and not rows, or null for a salon that is not there; what the sums mean is written on their types | `backend/packages/domain/src/repositories/sales-report.repository.ts` |
| 8. Repository implementation | Four `GROUP BY` queries and the look-up of the salon in one read-only `REPEATABLE READ` transaction, without a lock, so the figures are of the same sales and nothing waits for a writer. The SQL decides which rows count (not void, in the period, received payments, service lines, the staff member of the line or else of the sale) | `backend/packages/infrastructure/src/repositories/sales-report.repository.impl.ts` |
| 9. Use cases | A reach of its own (`salesReportReachOf`), which leaves out the staff who keep the ledger. The reports are pure functions of the sums (`reportOf`, `dailyOf`, `staffRowsOf`, `categoryRowsOf`, `trendsOf`, and `exportOf`, which writes the CSV file), which add them up, divide them, round them and put them in order, and the days, weeks and months are counted in UTC whatever the time zone of the server | `backend/packages/domain/src/business-logic/sales-report/_shared/` |
| 10. Handlers and router | Six `GET`s whose query names the salon, so no route has a parameter; the query is text only, so the handlers pass it as it is, and the links of a report are the request itself. The export answers the file with `res.attachment` and no links | `backend/packages/api/src/routes/sales-report/` |
| 12. Tests | The functions of the reports and of the calendar are tested with sums that are written out, a leap year and the ends of weeks, months and years among them. The integration test writes the rows of a month directly, with the sales, the lines and the payments that a report leaves out, and checks every figure against them | `backend/packages/domain/src/__tests__/sales-report.report.test.ts`, `backend/packages/domain/src/__tests__/sales-report.export.test.ts`, `backend/packages/domain/src/__tests__/sales-report.usecase.test.ts`, `backend/packages/api/src/__tests__/sales-report.integration.test.ts` |

### Rows a Customer Writes About a Visit: the Reviews

The reviews (`ReviewCrud`, `ReviewReportCrud`, `SalonReviewSummary`, `StaffReviewSummary`) are rows of a salon that its customers write and that anyone reads: a review is of one completed booking, and the rating and the review count of the salon are counted from the reviews. Every operation of the review contract is implemented: `list`, `create`, `get`, `update`, `delete`, `markHelpful`, `report` and `respond` of `ReviewCrud`, `list` and `dismiss` of `ReviewReportCrud` and the two summaries. They are the example of data that a customer writes about a salon, of a figure of a row of another table that the transaction which writes a row counts again, of a row that its author changes and that its author or an administrator removes, of a count of a row that is the number of rows of another table, one per customer, and of a queue of rows that the administrators work through, oldest first. Their rules are in [Reviews](./reviews.md) (Japanese). What they show that the booking ledger does not:

| Step | What the reviews show | Where to read it |
|------|-----------------------|------------------|
| 1. API contract | The reads became public (`@useAuth(NoAuth)` and `PublicErrors`), because they are read before a salon is chosen, as the salons and the staff profiles are. `imageUrls` was `string[] \| null`, two ways of saying "none"; it is `string[]`, and the column is `NOT NULL`. The `@doc` of the create says who may write, which staff member a review may name, and what is refused with 400, 403 and 409; those of the update and the delete say who may change and remove a review, what is refused with 400, 403 and 404, and that the salon is counted again; that of the mark says who may mark, that the author may not, that a second mark is not counted and that the body is not read; that of the report says who may report, that a second report of an account is refused with 409 and that the review stays as it is. The reason of a report was free text; it is an enum (`ReviewReportReasonType`), and the response of a report, which was an ID alone, is the row | `specs/operations/review-operations.tsp`, `specs/models/review.tsp` |
| 3. Database schema | CHECK constraints say what a review can be by itself (every rating from 1 to 5, the counts not negative, a response of the salon as a text and a time together, the images a JSON array), and what the salon says of its reviews (a count not negative, a rating from 1 to 5, a rating exactly when there are reviews). A data step counted every salon again from its reviews, because nothing had counted them. A table of the marks as helpful, one row per review and customer (a unique constraint, the review first), with the rows of a review removed with it; a data step counted every review again from it, to 0, because nothing had recorded who marked a review. A table of the reports, one row per review and account, with a CHECK that a dismissed report says who dismissed it and when and one that a report for another reason says what it is about; a data step counted the pending reports of every review, to 0 | `backend/packages/database/sql/migrations/202611171000_review_rules.sql`, `202611171100_review_helpful_votes.sql`, `202611171200_review_reports.sql` |
| 5. Validation schemas | A rule between two properties: a staff rating needs a staff member (a `.check()` that pushes its issue onto `staffRating`), and a report for another reason needs details (onto `details`). Whose the booking is and which staff member took it are not in the schema; they are the plan's. The update takes the properties a review says, shared with the create, through `.exactPartial()` and refuses `{}`; whether the stored review names a staff member is the plan's | `backend/packages/domain/src/schemas/review.schema.ts` |
| 6. Mappers | No write mapper: `planReview` makes the row, `isVerified` true. The read mapper turns the average of a tally (`numeric`) into a number and gives the distribution every rating from 1 to 5 | `backend/packages/domain/src/business-logic/review/_shared/plan.ts`, `backend/packages/domain/src/mappers/read/review.mapper.ts` |
| 7. Repository interface | `create` takes the customer and the request and answers `ReviewCreation`: the row, or a refusal of the plan. `update` takes the customer and the change and answers `ReviewChange`; `delete` takes who removes (`ReviewRemover`: an administrator or the author) and answers `ReviewRemoval`. `salonTally` and `staffTally` answer the figures or null for a salon or a staff member that is not there. `report` takes who reports (`ReviewReporter`: a customer or a salon) and answers `ReviewReporting`; `respond` takes who responds (`ReviewResponder`: a salon or an administrator) and answers `ReviewResponding`; `IReviewReportRepository` lists the reports and dismisses one (`ReportDismissal`) | `backend/packages/domain/src/repositories/review.repository.ts`, `backend/packages/domain/src/repositories/review-report.repository.ts` |
| 8. Repository implementation | One `READ COMMITTED` transaction reads that the customer is not deleted, holds the booking `FOR SHARE` and its salon `FOR NO KEY UPDATE`, reads the staff members who took the booking and an earlier review, writes the row at `clock_timestamp()` and counts the `rating` and the `reviewCount` of the salon again with one `UPDATE … FROM` a counted subquery. The reviews of one salon are written one after the other, so the count is never of a moment that missed one. A change and a removal hold the review `FOR UPDATE` and then the salon, so the salon is the last row every write waits for; the salon is written only when `(rating, reviewCount) IS DISTINCT FROM` the counted figures, so a change that keeps the overall rating leaves its `updatedAt`. A mark holds the review `FOR NO KEY UPDATE` and no salon, writes its row with `ON CONFLICT DO NOTHING` and counts the marks of the review again in a later statement, which begins once the review is held and so sees every mark it waited for; the review is written only when its count changes, and its `updatedAt` stays. A report holds the review the same way, writes its row with `ON CONFLICT DO NOTHING` on the review and the account (nothing written is a second report, 409) and counts the pending reports again (`countReportsOf`, shared with the dismissal); a dismissal holds the review of the report, found by a subquery from the ID of the report, before it reads the report. The list is a keyset page on the order asked for (`overallRating` or `helpfulCount`, then `createdAt` and `id`) in one read-only `REPEATABLE READ` transaction, and so is the list of the reports, oldest first | `backend/packages/infrastructure/src/repositories/review.repository.impl.ts`, `review-report.repository.impl.ts`, `review-report-count.ts` |
| 9. Use cases | `reviewerOf` turns the scope into the customer who writes, or a refusal, before the body is read; a body that names another customer is refused as one written for someone else (403). `reviewRemoverOf` lets an administrator remove too. The mark takes the same customer as a review (`reviewerOf`); a report takes a customer or the owner or a manager of a salon (`reviewReporterOf`), and the reports are the administrators' alone (`mayHandleReviewReports`), who refuse anybody else before a query that cannot be decoded is looked at. The plans (`planReview`, `planReviewChange`, `planReviewRemoval`, `planHelpfulMark`, `planReviewReport`, `planReportDismissal`) are pure functions of what the transaction read; a review of another customer is 403, not 404, because anyone reads it | `backend/packages/domain/src/business-logic/review/`, `backend/packages/domain/src/business-logic/review-report/` |
| 10. Handlers and router | Four routers: `/reviews` with `authenticated` on the create, the change, the removal, the mark and the report, `/review-reports` with `authenticated` on both of its routes, and the summaries below a salon and below a staff member, made with `Router({ mergeParams: true })` to read the ID of the mount path. A dismissal links the review next to the mount path of the reports | `backend/packages/api/src/routes/review/`, `backend/packages/api/src/routes/review-report/` |
| 12. Tests | The plan is tested as a pure function in the order of its checks. The integration test writes four reviews of one booking at once and five of one salon at once, holds the salon while a review waits for it and writes another meanwhile, deletes a booking while its review is written, both ways round, lets a review past a booking held for share and a salon held by a foreign key, and answers 409 to a review that meets the unique constraint of the booking. The orders of the list are walked one review a page over reviews whose IDs are not in the order of their time. The migration test counts salons with and without reviews again. The change test holds a review while a change waits for it and changes the review meanwhile, holds it while another review of the salon is written, holds the salon while a change and a removal wait for it, and changes and removes reviews of one salon at once. The mark test marks a review by five customers at once and by one customer three times at once, holds the review while a mark waits for it and marks it meanwhile, removes it while a mark waits, and lets a mark past its salon, its customer and the review held by a foreign key. The report test reports a review by five accounts at once and by one account three times at once, holds the review while a report or a dismissal waits for it, answers 409 to a report that meets an uncommitted report of the same account, dismisses a report twice at once and walks the reports one a page | `backend/packages/domain/src/__tests__/review.plan.test.ts`, `backend/packages/domain/src/__tests__/review.change.test.ts`, `backend/packages/domain/src/__tests__/review.helpful.test.ts`, `backend/packages/domain/src/__tests__/review.report.test.ts`, `backend/packages/domain/src/__tests__/review-report.usecase.test.ts`, `backend/packages/domain/src/__tests__/review.usecase.test.ts`, `backend/packages/api/src/__tests__/review.integration.test.ts`, `backend/packages/api/src/__tests__/review-changes.integration.test.ts`, `backend/packages/api/src/__tests__/review-helpful.integration.test.ts`, `backend/packages/api/src/__tests__/review-report.integration.test.ts`, `backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |

### Rows Whose Content Is Kept Outside the Database: the Attachments

The attachments (`AttachmentCrud`; their rules are in [Attachments](./attachments.md), Japanese) are rows of a salon whose content, a file, is in an object storage. The server never carries the file: a client sends and fetches it with URLs that are signed for that one file. Read them for a resource that needs a service outside the database, and for writes that two systems have to agree on without a transaction that spans both:

| Step | What the attachments show | Where to read it |
|------|---------------------------|------------------|
| 1. API contract | No operation takes a file. `getUploadUrl` creates the row (201 and `Location`) and answers it with the URL and the headers of the upload; `complete` is an operation of its own, because the server learns of an upload only when it is told. The response has no storage key, and the request none of the columns the server decides | `specs/models/attachment.tsp`, `specs/operations/attachment-operations.tsp` |
| 2. Database | The table has no column for the key: it is made of the ID. `deletedAt` marks a row whose file is removed, and the row stays until its upload URL has run out, since the URL would still take a file. Two partial indexes serve the lists, one what the purge reads | `backend/packages/database/sql/migrations/202611182100_attachments.sql` |
| 3. Consistency rules | The response leaves out `deletedAt`; the request that announces a file is a `create` that leaves out the columns the server decides | `attachmentRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. A port for the service | The domain says what it needs of the storage in its own words (`issueUpload`, `inspect`, `issueDownload`, `remove`), with a `Result` for every call, and knows no SDK. What a URL promises is in the interface: one upload of exactly this type and size, until a moment | `backend/packages/domain/src/services/file-storage.ts` |
| 5. Business rules | Pure functions say which files are taken, where a file is stored, how a file of each kind begins (`beginsAs`) and how a download is named (`contentDispositionOf`). The reach is that of the booking ledger, and whoever uploaded an attachment may take it back | `backend/packages/domain/src/business-logic/attachment/_shared/` |
| 6. Use cases | The order of two writes decides what a failure in between leaves: a delete removes the file and then marks the row, so that a failure leaves an attachment that can be deleted again; a completion that refuses a file marks the row and then removes the file, so that no request that looked at another file marks it uploaded. What stays behind either way is removed by the purge | `backend/packages/domain/src/business-logic/attachment/` |
| 7. Repository | Each write is one conditional statement (`markUploaded` for a row that is pending and not deleted, `markDeleted` for one that is not deleted), so no row is held across a call to the storage. The purge alone holds a row `FOR UPDATE` while a callback removes its file, and deletes the row only when that succeeded | `backend/packages/infrastructure/src/repositories/attachment.repository.impl.ts` |
| 8. The service itself | `S3FileStorage` signs with a client for the endpoint a browser reaches and calls the storage with one for the endpoint the server reaches. It turns off the default checksum of the SDK, which a URL signed before there is a body cannot carry, signs an upload for its type, its length and `If-None-Match: *`, and tells "nothing stored" (`NoSuchKey`) from every other failure | `backend/packages/infrastructure/src/storage/s3-file-storage.ts` |
| 9. A new kind of error | A failed call is `storage`, not `database`: the exhaustive match of the API package would not compile until it had a problem for it (500, code `4004`), and `sendProblem` logs its cause, which never holds a signed URL | `backend/packages/domain/src/shared/errors.ts`, `backend/packages/api/src/shared/problem-details.ts` |
| 10. Configuration and wiring | Six required variables, two of them endpoints that must use https when deployed. `startServer` creates the storage without contacting it, hands it to `createApp` as `AppDependencies.fileStorage` and closes it when the server stops | `backend/packages/config/src/app-config.ts`, `backend/apps/server/src/server.ts`, `backend/packages/api/src/index.ts` |
| 11. Handlers and router | Seven handlers on a plain `Router()`; the fixed paths (`/upload-url`, `/purge`) are routed before those with `/:attachmentId`. The purge answers `links: null` | `backend/packages/api/src/routes/attachment/` |
| 12. Tests | The use cases are tested with fakes of the repository and the storage, including the order of their calls. The API tests run the routes against the database with a storage that keeps its files in memory, notes every call, fails on demand and lets a test act between two calls (`InMemoryFileStorage`). The storage itself is tested against a real S3-compatible storage, with real uploads and downloads through the signed URLs; the same tests run against another storage when `TEST_STORAGE_ENDPOINT` names one | `backend/packages/domain/src/__tests__/attachment.usecase.test.ts`, `backend/packages/api/src/__tests__/attachment.integration.test.ts`, `backend/packages/infrastructure/src/storage/__tests__/s3-file-storage.integration.test.ts` |

### A Secret That Opens a Row Without an Account: the Share Links

The share links (`ShareLinkCrud` and `SharedFileCrud`; their rules are in [Attachments](./attachments.md#共有リンク), Japanese) let somebody without an account see one attachment. They are the one place where a request is let in by a secret of the resource itself and not by a session.

| Step | What the share links show | Where to read it |
|------|---------------------------|------------------|
| 1. API contract | The token and the password of a link travel in a body, so the two operations of a viewer are `POST`s although a viewer creates nothing: a URL would keep both in logs, histories and `Referer`. The create answers a model of its own (`ShareLinkCreateResponse`), because the token exists in that one response only | `specs/operations/attachment-operations.tsp`, `specs/models/attachment.tsp` |
| 2. Database | The table stores the SHA-256 of the token and the Argon2id hash of the password, never the values. CHECK constraints hold the end of a link to 720 hours from its creation and its downloads to the limit; the foreign key to the attachment is `ON DELETE CASCADE`, so the purge of the attachments knows nothing of links | `backend/packages/database/sql/migrations/202611182200_share_links.sql` |
| 3. Consistency rules | The response omits the hashes and the count of wrong passwords and declares `hasPassword` as `computed`; what a viewer is told of the file is a rule on `attachments` that omits all but three columns | `shareLinkRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. One clock | The clock of the application decides when a link may end, is written as `createdAt`, and is what a token is checked against, so the CHECK constraint and the validation cannot disagree | `create-share-link.usecase.ts`, `_shared/link-rules.ts` |
| 5. A limit on guesses that is reused | The lock of a link is that of an account: the same threshold and time (`LOCK_THRESHOLD`, `lockEnd`), the password hashed before the lock is looked at, a count that one statement adds to | `_shared/password-check.ts`, `recordWrongPassword` in `share-link.repository.impl.ts` |
| 6. One answer for every reason | A token that opens nothing is the same `notFound` whether no link has it or the link has run out, issued every download or lost its attachment (`noSharedFile`). The query that finds a link (`findWorking`) holds every condition, so the use case cannot tell the reasons apart either | `_shared/open-shared-file.ts` |
| 7. A new kind of error | A password that is not accepted is `passwordRequired` (403, code `1002`): a 401 has to carry a challenge (RFC 9110, 15.5.2), and there is none for a password in a body | `backend/packages/domain/src/shared/errors.ts`, `backend/packages/api/src/shared/problem-details.ts` |
| 8. A count under concurrency | The URL is signed first and the download counted second, by one conditional `UPDATE` that also checks the limit; a request that is not counted answers 404 and no URL | `issue-shared-file-download-url.usecase.ts`, `countDownload` |
| 9. Handlers and routers | Two routers: the routes of those who manage links are mounted at `/attachments` before the router of the attachments, since `share-links` is no ID of an attachment; the routes of a viewer at `/share` take no `authenticated` and are stored by no cache (`neverStored`) | `backend/packages/api/src/routes/share-link/`, `routes/shared-file/` |
| 10. Tests | The API tests compare the whole answer of every token that opens nothing, send wrong passwords and downloads at the same moment, and read the log for tokens and passwords | `backend/packages/api/src/__tests__/share-link.integration.test.ts` |

## Data That Belongs to No Salon

The customer ledger is one for the whole platform: a customer belongs to no salon, and no operation on a customer is public. Its routes are flat like those of Salon (`/api/v1/customers`), and it is built in the same twelve steps; its rules are in [Customer Ledger](./customers.md) (Japanese). Read it for what Salon, the service categories and the services do not have:

| Step | What the customers show | Where to read it |
|------|-------------------------|------------------|
| 1. API contract | No operation is `@useAuth(NoAuth)`. The interface `CustomerCrud` defines 22 operations, and all of them are implemented. This table is about the five of the ledger itself: list, create, get, update and delete. `getPreferences` and `updatePreferences` are those of [the preferences](#a-record-every-customer-has-the-preferences); the batch get and the bulk operations, the statistics, the history and the versions, the restore, the merge, the two exports and the deletion requests have their rules, and where their code is, in [Customer Ledger](./customers.md) (Japanese) | `specs/operations/customer-operations.tsp`, `specs/models/customer.tsp` |
| 3. Database schema | Two unique values with different scopes: the email is unique among the customers that are not deleted (the unique index `customers_email_unique`), the referral code among all customers, deleted ones included (the unique constraint `customers_referral_code_unique`) | `customers` in `backend/packages/database/src/schema.ts` |
| 5. Validation schemas | The email is `lowerCaseEmail` (`schemas/rules.ts`): it is stored and compared in lower case, as the email of a user is. The search schema compares two date-times (`registeredFrom`, `registeredTo`) as times, not as text: as text, the same second with and without a fraction would compare the wrong way round. The rules that need the current time or another customer are not in a schema; they are the use case's | `backend/packages/domain/src/schemas/customer.schema.ts` |
| 6. Mappers | A write mapper that converts nothing. Property names are the column names and every column has the representation of the API, so `CustomerWriteMapper` returns the request as the row: the mapper is where the compiler checks that the two agree. The read mapper also checks a text column against the values of the API (`gender`) | `backend/packages/domain/src/mappers/write/customer.mapper.ts`, `mappers/read/customer.mapper.ts` |
| 8. Repository implementation | Two unique violations are expected outcomes. `toDomainError` tells them apart by the name of the violated constraint and returns `alreadyExists` for either (409, code `3002`). The keyword of the list is matched with `containing` (`backend/packages/infrastructure/src/database/like.ts`), which the salon repository uses too. The filters on the time of registration are compared with `createdAt` cut to milliseconds (`date_trunc('milliseconds', …)`), the precision of a response: the column keeps microseconds | `backend/packages/infrastructure/src/repositories/customer.repository.impl.ts` |
| 9. Use cases | Every use case takes the actor and decides the permission first, from the actor alone (`mayHandleCustomers`, `mayDeleteCustomers`): before the ID, the query and the body are looked at, so a user who may not is answered with 403 whatever else the request holds. The use case of the list therefore takes the decoded query as a `Result` (`ListCustomersUseCase.execute(actor, query)`) and returns a query that could not be decoded as an error only after the permission. The dependencies hold a `clock` next to the repository, because a rule needs the current time: a birth date is not in the future (`customerRuleIssues`) | `backend/packages/domain/src/business-logic/customer/`, with `_shared/authorization.ts`, `_shared/dependencies.ts` and `_shared/rules.ts` |
| 10. Handlers and router | Every handler is wrapped with `authenticated`, and the router is a plain `Router()`. The list handler does not answer a query that it cannot decode: it passes the outcome of `decodeCustomerSearchQuery` on to the use case | `backend/packages/api/src/routes/customer/` |
| 11. Wiring | The router is mounted at `${API_BASE_PATH}/customers` and is given the `clock` that the authentication dependencies hold | `backend/packages/api/src/index.ts` |

Who may do what is stated in [Authentication and Authorization](./authentication.md).

### Data That Belongs to the Signed-In Account: a Customer's Own Profile

A customer account reads, creates and updates its own customer record at `/api/v1/customers/me`. The record is a row of the ledger, so the profile shares the table, the repository, the dependencies and the router of the customers, and adds what differs:

| Step | What the profile shows | Where to read it |
|------|------------------------|------------------|
| 1. API contract | An interface of its own (`CustomerProfile`) at a fixed path below the collection, without an ID. Models of its own, because the same table is shown and written differently: `CustomerProfileResponse` leaves out what the staff keep to themselves, and the two requests have only what a customer states. `pnpm check:api-db` checks them against `customers` with the columns each may leave out | `specs/operations/customer-operations.tsp`, `specs/models/customer.tsp`, `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 3. Database schema | One account, one customer: `customers.userId` is unique among the customers that are not deleted. `customers.userId` has no foreign key, because `users.customerId` has one and two tables that refer to each other cannot be typed in the generated schema; the code writes both columns in one transaction | `backend/packages/database/sql/migrations/202611151500_customers_user_unique.sql` |
| 5. Validation schemas | `pick`ed from the schema of the ledger, so a property has one rule wherever it is written | `backend/packages/domain/src/schemas/customer.schema.ts` |
| 6. Mappers | The write mapper returns two things, the new row and the changes of a row that is taken over, because only the repository learns which applies. The read mapper names every property it returns, so a new column of the table is not shown to the customer by itself | `backend/packages/domain/src/mappers/write/customer-profile.mapper.ts`, `backend/packages/domain/src/mappers/read/customer-profile.mapper.ts` |
| 7. Repository interface | `createProfile` answers with a sum type that includes why an account did not get a profile (`CustomerProfileCreation`): the reasons depend on rows that only the transaction sees as they are | `backend/packages/domain/src/repositories/customer.repository.ts` |
| 8. Repository implementation | One transaction locks the account's row, decides, locks the customer the ledger has under the account's email, writes the row and the link on both sides. The delete of the ledger clears the link in its own transaction | `backend/packages/infrastructure/src/repositories/customer.repository.impl.ts` |
| 9. Use cases | The record is found through the actor, not through the request: `profileAccessOf` turns the scope into the account's own record, a customer account without one, or not a customer account, and the use case matches on it before it reads the body | `backend/packages/domain/src/business-logic/customer/_shared/profile.ts`, `backend/packages/domain/src/business-logic/customer/create-customer-profile.usecase.ts` |
| 10. Handlers and router | `/me` is registered before `/:id`. The links of the profile are `{ self }`, the same for every customer | `backend/packages/api/src/routes/customer/index.ts`, `backend/packages/api/src/routes/customer/_shared/links.ts` |

### A Record Every Customer Has: the Preferences

The preferences of a customer are one record per customer in a table of their own, `customer_preferences`: at `/api/v1/customers/{id}/preferences` for whoever keeps the ledger, and at `/api/v1/customers/me/preferences` for the customer. A customer for whom no row is stored has preferences too, empty ones, so the operations are a get and an update and nothing else. The preferences have a repository, use cases and routers of their own, take the permissions of the ledger and of the profile as they are, and add what differs; their rules are in [Customer Ledger](./customers.md#好み設定) (Japanese):

| Step | What the preferences show | Where to read it |
|------|---------------------------|------------------|
| 1. API contract | Two operations in each of two interfaces (`getPreferences` and `updatePreferences` of `CustomerCrud` and of `CustomerProfile`), no create and no delete. One response model for both, because nothing in it is kept from the customer. A list is never null: none is the empty list, and null is left to single values. The row itself is not shown, so the rule of `pnpm check:api-db` leaves out its ID, its customer and its times. A name in `omittedColumns` that is no column of the table is a finding of the check as well (`omittedUnknownColumn`), so a rule cannot go on naming a column that is gone | `specs/operations/customer-operations.tsp`, `specs/models/customer.tsp`, `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 3. Database schema | The columns say what the API says. A list is `NOT NULL` without a default, so every writer states it; a list of IDs is `uuid[]`, not `jsonb`; CHECK constraints keep the two `jsonb` columns an array and an object, and the preferred staff member out of the avoided ones. The migration repairs the rows written before, and fails on the one kind of row for which nothing says what was meant | `backend/packages/database/sql/migrations/202611160100_customer_preferences_columns.sql` |
| 4. Models | `DbCustomerPreferences` is the row without its ID, its customer and its times: the columns that are the preferences. `noCustomerPreferences()` is what a customer without a row has. The repository returns it in place of a missing row, so nothing above the repository knows whether a row is stored | `backend/packages/domain/src/models/customer-preferences.ts` |
| 5. Validation schemas | Two schemas per `jsonb` column: the one of the request, with every rule, and the one that stored values are checked against when they are read, which holds only what the API model promises. The shape of a time slot is a shared rule (`timeSlot`, `orderedTimeSlot`), which the business hours of a salon use too | `backend/packages/domain/src/schemas/customer-preferences.schema.ts`, `backend/packages/domain/src/schemas/rules.ts` |
| 6. Mappers | No write mapper: the properties of the request are the columns, so the validated request is the change. The read mapper checks the two `jsonb` columns against the API model | `backend/packages/domain/src/mappers/read/customer-preferences.mapper.ts` |
| 7. Repository interface | Both methods answer with a sum type. `findByCustomerId` tells a customer who is not there from one who is, with or without a row (`CustomerPreferencesLookup`). `update` tells why it wrote nothing (`CustomerPreferencesUpdate`): the customer is not there, a staff member that the change names is not, or the preferences would break a rule once changed | `backend/packages/domain/src/repositories/customer-preferences.repository.ts` |
| 8. Repository implementation | One transaction locks the row of the customer (`FOR UPDATE`), looks up the staff members that the change names, reads the stored row, checks the rule against the preferences as they will be, and writes with an insert that updates the row when there is one. The lock makes the changes of one customer wait for each other, so a change that prefers a staff member and one that avoids the same staff member are never both written, and neither are two first changes that would each insert the row. The read is two queries, not a join: the nested selection of a left-joined table comes back from Drizzle as null when its first column is null, which `preferredStaffId` of a stored row may be | `backend/packages/infrastructure/src/repositories/customer-preferences.repository.impl.ts` |
| 9. Use cases | Two pairs of use cases and one flow. Those of the ledger decide `mayHandleCustomers` and parse the ID; those of the customer match on `profileAccessOf`. Both then call `readPreferencesOf` or `changePreferencesOf`, and say what a customer who is not there is called. The rule that ties two properties is a pure function (`customerPreferencesRuleIssues`): the flow calls it for a request that names both, before anything is looked up, and the repository calls it inside the transaction, where the stored row is known. `toRefusalError` turns what the repository refused into the error of the client, with the property and the index of each staff member that was not found | `backend/packages/domain/src/business-logic/customer-preferences/` |
| 10. Handlers and router | Two routers with `GET /` and `PATCH /` each. The links are built from where the router is mounted: `self`, and `customer` one segment above | `backend/packages/api/src/routes/customer-preferences/` |
| 11. Wiring | The two routers are mounted at their full paths before the customer router, `/customers/me/preferences` first: the router of `/customers/:id/preferences` would take `me` for an ID | `backend/packages/api/src/index.ts` |
| 12. Tests | The integration test reads and changes the preferences of a customer without a row, sends two first changes at the same moment, sends a change that prefers a staff member together with one that avoids the same staff member, and holds a transaction open on the row of the customer to show that a change waits for it and a read does not | `backend/packages/api/src/__tests__/customer-preferences.integration.test.ts`, `backend/packages/domain/src/__tests__/customer-preferences.usecase.test.ts` |

### A Record of a Customer Read by Its Customer: the Medical Charts

The medical chart of a customer (`/api/v1/medical-charts`; its rules are in [Medical Charts](./medical-charts.md), Japanese) is one row per customer in `medical_charts`, created once and then changed. It takes the permission of the customer ledger as it is (`mayHandleCustomers`), is read by the ID of its customer and changed by its own, and keeps a list of objects in a `jsonb` column. What it shows that the preferences do not:

| Step | What the medical charts show | Where to read it |
|------|------------------------------|------------------|
| 1. API contract | The contract was cut to what no other place keeps: the allergies are the rows of `customer_allergies`, the usual scalp and hair the columns of the customer, the state at a treatment the treatment record, and who wrote last (`AuditInfo`, removed) is no record of the changes. A list is never null. The get is by the customer (`/customer/{customerId}`), where the `Location` of the create points; the allergies of a customer are below it (`/customer/{customerId}/allergies`) | `specs/models/treatment.tsp`, `specs/operations/treatment-operations.tsp` (`MedicalChartCrud`) |
| 3. Database schema | The customer is unique and the row goes with the customer (`ON DELETE CASCADE`); a CHECK constraint keeps `previousTreatments` an array and the two `text[]` lists free of NULL elements. The lists have no default: drizzle-kit reads `'{}'::text[]` back as `['']`, and a chart is written with every column stated | `backend/packages/database/sql/migrations/202611181000_medical_charts.sql` |
| 4. Models | `DbNewMedicalChart` types the `jsonb` column as the API model of a previous treatment and the customer as a `CustomerId`, so the compiler checks the write mapper; a change names no customer (`DbMedicalChartChanges`) | `backend/packages/domain/src/models/medical-chart.ts` |
| 5. Validation schemas | A previous treatment is a strict object of the `TreatmentType`, a calendar date, the salon and notes; a list of names repeats no name. Whether a treatment lies in the past needs the clock, so the use case asks `medicalChartRuleIssues` after the schema and before the repository, which judges a date as a birth date is (`latestDateOf`) | `backend/packages/domain/src/schemas/medical-chart.schema.ts`, `backend/packages/domain/src/business-logic/medical-chart/_shared/rules.ts` |
| 6. Mappers | The read mapper checks the stored previous treatments against the schema of a previous treatment, and a row that does not match is a database error (500) | `backend/packages/domain/src/mappers/read/medical-chart.mapper.ts` |
| 7. Repository interface | Every method answers a sum type: the create tells a customer who is not there from one who has a chart (`MedicalChartCreation`), the get a customer who is not there from one without a chart (`MedicalChartOfCustomer`), the list a cursor that names no chart of the list (`MedicalChartListing`) | `backend/packages/domain/src/repositories/medical-chart.repository.ts` |
| 8. Repository implementation | The create holds the customer `FOR SHARE` in a `READ COMMITTED` transaction and inserts `ON CONFLICT DO NOTHING` on the customer at `clock_timestamp()`; the get is one statement, the customer left-joined to the chart; the update is one `UPDATE` of the named columns and `updatedAt`, for a chart whose customer is not deleted; the list is one read-only `REPEATABLE READ` snapshot that matches the keyword in the names of the two lists with `unnest` and asks `customer_allergies` with `EXISTS` | `backend/packages/infrastructure/src/repositories/medical-chart.repository.impl.ts` |
| 10. Handlers and router | `GET /customer/:customerId` reads by the customer and `PATCH /:id` changes by the chart; every response links the chart by its customer (`medicalChartLinks`) | `backend/packages/api/src/routes/medical-chart/` |
| 12. Tests | The integration test creates the chart of one customer twice at the same moment, makes a create wait for a change and a removal of the customer and for a chart that another writer has not committed, keeps both of two changes of different items, and writes an older chart while a list waits, which the list does not see | `backend/packages/api/src/__tests__/medical-chart.integration.test.ts`, `backend/packages/domain/src/__tests__/medical-chart.usecase.test.ts` |

The allergies of a customer (`customer_allergies`, under the chart routes at `/customer/{customerId}/allergies`) add one thing: a change can break a unique constraint. An allergen is recorded once for a customer (`customer_allergies_customer_allergen_unique`). The add inserts `ON CONFLICT DO NOTHING` on the customer and the allergen after holding the customer `FOR SHARE`, as the create of a chart does. The update is one `UPDATE`, and `CustomerAllergyRepository` turns the violation of that constraint (SQLSTATE `23505` on the error or on its `cause`, under the name of the constraint) into `allergenExists` of the sum type `CustomerAllergyChange`, which the use case answers with 409; any other failure stays a database error. When an update or a removal finds no row, a second read tells a customer who is not there from an allergy the customer does not have. The list orders by the enum `allergy_severity` downwards, which is declared mildest first, so the severest come first (`backend/packages/infrastructure/src/repositories/customer-allergy.repository.impl.ts`, `backend/packages/api/src/__tests__/customer-allergy.integration.test.ts`).

### A Balance and the Ledger of Its Changes: the Points

The points of a customer are a balance (`customers.loyaltyPoints`) and the ledger of its changes (`customer_points`): every movement writes a row with the balance after it and sets the balance to it, so the balance of a customer is that of their latest row. The ledger is one for the whole platform, as the customer ledger is, and the seven operations of `PointCrud` are implemented. It is the example of a value that no request writes directly and that is kept equal to the latest row of another table. Its rules are in [Points](./points.md) (Japanese). What it shows that the customer ledger does not:

| Step | What the points show | Where to read it |
|------|----------------------|------------------|
| 1. API contract | The kind of record a transaction refers to became an enumeration (`PointReferenceType`: a sale or a booking). The three movements name the customer in the body, so a customer who is not there is a broken rule of the body (400), while the two reads name the customer in the path (404). The `@doc` of each operation says who may and what is refused with 400 and with 409 | `specs/operations/payment-operations.tsp` (`PointCrud`), `specs/models/payment.tsp` |
| 3. Database schema | CHECK constraints say what a row of each type can be (the sign of `points`, an expiry date only on an earning, a reference as a kind and an ID together), the balance is not negative in either table, and a partial unique index allows one earning and one use per record. A data step of the migration opened the ledger: an adjustment for every customer whose balance was not that of their latest row | `backend/packages/database/sql/migrations/202611161000_customer_points_rules.sql` |
| 5. Validation schemas | A rule between two properties is a `.check()` that pushes its issue with `continue: true` onto the property that is null; an adjustment takes `points` of either sign but 0 | `backend/packages/domain/src/schemas/point.schema.ts` |
| 6. Mappers | No write mapper: `planPoints` makes the row. The read mapper checks the kind of record against the enumeration of the API | `backend/packages/domain/src/business-logic/point/_shared/plan.ts`, `backend/packages/domain/src/mappers/read/point.mapper.ts` |
| 7. Repository interface | `record` takes the movement and the reach and answers `PointRecording`: the row, a customer who is not there, or a refusal of the plan | `backend/packages/domain/src/repositories/point.repository.ts` |
| 8. Repository implementation | One `READ COMMITTED` transaction holds the record `FOR SHARE` and then the customer `FOR NO KEY UPDATE`, which lets a row that refers to the customer be written past it; every statement after the lock sees what was committed before it, so a movement that waited counts from the balance it waited for. The row and `loyaltyPoints` are written at `clock_timestamp()`. The history is a keyset page on (`createdAt`, `id`) in one read-only `REPEATABLE READ` transaction. The expiry holds each customer `FOR NO KEY UPDATE` in a transaction of their own and reads their transactions after the lock, so it counts the movement it waited for, and a second run finds nothing to expire | `backend/packages/infrastructure/src/repositories/point.repository.impl.ts` |
| 9. Use cases | Two reaches (`pointReachOf`, `pointAdjustReachOf`) that answer a `LedgerReach`: every member of a salon reaches every customer, and the reach limits the records a movement may name. The three movements share one flow (`recordMovement`); the plan is a pure function of the balance, the record and whether it was taken; an expiry date is checked against the `clock`. What is left of an earning is not stored: the pure `lotsOf` counts it from the transactions in the order they were written, a decrease taking the earliest expiry date first, and `expiringOf` and `planExpiry` read the points about to expire and plan an expiry from it; the expiry is the administrators' (`mayExpirePoints`) | `backend/packages/domain/src/business-logic/point/` |
| 10. Handlers and router | A plain router at `/points`, as the contract puts it; every response links the balance and the history of the customer | `backend/packages/api/src/routes/point/` |
| 12. Tests | The plan is tested as a pure function in the order of its checks. The integration test spends one balance six times at once, earns on one record five times at once, holds the customer, the sale and the booking while a movement waits for them, and lets a movement past the lock a foreign key takes; four expiries at once write one row per customer, and an expiry waits for a customer that is held and counts the use written meanwhile. The migration test opens the ledger of customers with and without rows, two of them of one moment | `backend/packages/domain/src/__tests__/point.plan.test.ts`, `backend/packages/domain/src/__tests__/point.lots.test.ts`, `backend/packages/domain/src/__tests__/point.usecase.test.ts`, `backend/packages/api/src/__tests__/point.integration.test.ts`, `backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |

## Error Handling

A use case fails in one of eight ways (`backend/packages/domain/src/shared/errors.ts`):

```typescript
export type DomainError =
  | { type: 'validation'; message: string; issues: ValidationIssue[] }
  | { type: 'unauthenticated'; reason: AuthenticationFailure }
  | { type: 'forbidden' }
  | { type: 'passwordRequired' }
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'conflict'; message: string }
  | { type: 'database'; message: string; cause: unknown }
  | { type: 'storage'; message: string; cause: unknown }
```

Errors are built with `DomainErrors.validation`, `.unauthenticated`, `.forbidden`, `.passwordRequired`, `.notFound`, `.alreadyExists`, `.conflict`, `.database` and `.storage`. Where each kind comes from:

| Kind | Where it is created | What the client gets |
|------|---------------------|----------------------|
| `validation` | `parseWith`, called by a use case (and by the query decoding of a list handler). The authentication use cases also build it themselves for what a schema cannot check: a password that is too easy to guess, a wrong current password, a mailed token that cannot be used, a code of two-factor authentication that is not accepted, a cursor of the session list that names no session of the user. The service category use cases do so for a parent that is not a category of the same salon or that is the category itself or one below it, and for a cursor that names no category of the salon. The service use cases do so for a service that would break a rule tying two of its properties together, for a category that is not of the same salon, for a member of a package that is not a service of the same salon, is a package or is the service itself, for making a package of a service that a package contains, and for a cursor that names no service of the salon; `toRefusalError` (`backend/packages/domain/src/business-logic/service/_shared/refusals.ts`) builds the ones that answer a refusal of the repository. The customer use cases do so for a birth date before 1900 or in the future, for a referrer that does not exist, is deleted or is the customer itself, and for a cursor that names no customer. The use case of the staff list does so for a cursor that names no staff member of the salon | 400 with the broken rules in `errors` |
| `unauthenticated` | the authentication use cases only: `AuthenticateUseCase` behind `authenticated`, login and refresh, and the current-user, change-password and two-factor use cases when the user of the session no longer exists | 401 with a `WWW-Authenticate` header |
| `forbidden` | a use case, when its permission rule refuses the actor | 403 |
| `passwordRequired` | the use cases of the viewer of a share link, when the link has a password and the request brought none that is accepted | 403; the body does not say whether the password was missing, wrong or locked |
| `notFound` | a use case, when the repository resolved to `null` or `false` or reported that there is no such row; `requireSalon`, when the salon in the path does not exist; a use case of a customer's own profile, when the account has no customer record | 404 |
| `alreadyExists` | the repository, from a unique violation: the email of a salon, the email of a customer, the referral code of a customer, the email and the staff code of a staff member within a salon | 409 |
| `conflict` | a use case, when the request is fine and what it acts on is not in a state that allows it: the use cases of two-factor authentication (enabling what is already enabled, for example), those of the administrator operations (unlocking an account that is not locked, for example), the use case that deletes a service, when a package contains the service, and the use case that creates a customer's own profile, when the account has one already, has not confirmed its email address, or the customer with its email address belongs to another account. The customer repository returns it as well, when a customer with that email address is added at the moment the profile is created. The use cases that update and delete a staff member return it for what an actor may do to every staff member but their own: deactivating or deleting the one their account belongs to | 409 |
| `database` | the repository, from a failed query; the read mapper, from a stored row that does not fit | 500 without details; the cause is logged |
| `storage` | the file storage of the attachments (`S3FileStorage`), from a call to the object storage that failed or was refused | 500 without details; the cause is logged, never a signed URL |

The API package maps the kind to a status and a problem details body (`backend/packages/api/src/shared/problem-details.ts`). A domain adds nothing there unless it introduces a new kind of error, and then the exhaustive match in that file stops compiling until the new kind has a status.

## Implementation Checklist

For a new domain, with `<domain>` as its name. Each item names what the Salon domain has.

Contract and database:

- [ ] `specs/models/<domain>.tsp` defines the response, create, update and search models; property names and nullability are those of the columns
- [ ] `specs/operations/<domain>-operations.tsp` defines only the operations that will be implemented, each with its success response and the error responses its use case can produce; both files are imported in `specs/main.tsp`
- [ ] Each operation is either public (`@useAuth(NoAuth)`, `PublicErrors`) or declares `SessionErrors` or `CommonErrors`, and names in its `@doc` who may call it
- [ ] `pnpm generate` has been run and the generated files are committed
- [ ] If the table must change: a migration, then `pnpm db:migrate`, `pnpm db:introspect` and `pnpm db:generate-sql`, with the regenerated files committed and the seed data in `backend/packages/database/src/seeds/seed-data/` adjusted
- [ ] The models that are backed by a table are listed in `api-consistency-rules.ts` with `omittedColumns`, and `pnpm check:api-db` passes

Domain package (`backend/packages/domain/src/`):

- [ ] `models/<domain>.ts`: branded ID with its parser, API types, database types
- [ ] `schemas/<domain>.schema.ts`: one strict schema per request, each with `satisfies z.ZodType<...>`; the rules that more than one domain needs (`nonBlankText`, `lowerCaseEmail`, `phoneNumber`, `timeSlot`, `timeZoneName`, `MAX_INTEGER`, `noRepeatedEntries`, `atLeastOneProperty`, and `calendarDate`, `momentOfRequest` and `momentInUtc` for every date and moment) come from `schemas/rules.ts`
- [ ] `mappers/read/<domain>.mapper.ts`, and `mappers/write/<domain>.mapper.ts` when a column needs converting on the way in or a request holds the rows of more than one table; when neither is the case the request is the row, and a write mapper only states that (`mappers/write/customer.mapper.ts`; the service categories have none): no renaming; the read mapper returns a `Result`
- [ ] `repositories/<domain>.repository.ts`: the interface
- [ ] `business-logic/<domain>/`: `_shared/dependencies.ts`, one `<action>-<domain>.usecase.ts` per operation with `execute` taking `unknown`, and `index.ts`
- [ ] `business-logic/<domain>/_shared/authorization.ts`: one pure function per permission rule; the use case of every operation that is not public takes `actor: Actor` first and returns `DomainErrors.forbidden()` when the rule refuses
- [ ] The use cases, models and repository interface are exported from `index.ts`
- [ ] `__tests__/`: schema, mapper and use case tests, the last including every kind of actor for each permission rule
- [ ] When the data belongs to a salon: the use case parses the salon of the path with `parseSalonIdOfPath`, decides the permission from that salon, and calls `requireSalon` before it reaches its repository; the dependencies hold `salonRepository`; every method of the repository interface takes the salon ID
- [ ] When the data belongs to a salon and none of it is public (`business-logic/staff/` is the example): every use case, the list and the get included, decides the permission from the salon of the path first; the use case of a list takes the decoded query as a `Result`
- [ ] When a rule ties two properties of a row and an update may name one of them (`business-logic/payment-method/` is the example): the rule is a pure function of the domain; the repository holds the row, applies the function to the row as it would be afterwards, and answers with a sum type instead of writing; the use case reports the refusal under the property the request names
- [ ] When a rule ties three or more properties (`business-logic/product/` is the example): one pure function finds the pairs out of order and another says under which property each is reported, and the schema and the use case of the update use both, so a request and the row as it would be are reported alike
- [ ] When a rule depends on a row of another table (`business-logic/inventory/` is the example): the rule is a pure function, and the repository applies it to the other row held with the lock that a change of that row waits for (`FOR KEY SHARE` against `FOR UPDATE`), so the rule is never decided on a row that is about to change
- [ ] When rows belong to a record of a salon and are replaced as a whole (`business-logic/staff-schedule/` is the example): the router is mounted below the record; the body of the `PUT` is a named array model with `@maxItems`; the schema checks each row and then the rows against each other, and the table keeps the same rules with CHECK constraints and unique indexes; the permission is decided for the salon and then for the record; the repository replaces the rows in one transaction that locks the record
- [ ] When a mailed token gives access to a record (`business-logic/staff-invitation/` is the example): only the hash of the token is stored; the operations of whoever holds the token are public, take the token in the body and answer every token that cannot be used in the same way; an operation that changes an account that exists asks for a session of that account as well, because a mailed token is not a password; the request does not name the address the mail goes to, and the answer does not tell whether that address has an account; the repository answers with sum types, and every write locks the record it decides from and reads it again
- [ ] When a salon keeps a part of rows that belong to another domain (`business-logic/staff-account/` is the example): a response model with the properties the salon is shown and a request model with the ones it may write; the repository selects those columns only; a property that takes some of the values of the enum of its column gets an enum of its own, a check constraint that keeps the column to those values where the model applies, and an entry in `narrowed` of its rule; a rule about the actor's own record is a 409, checked after the body and before anything is looked up
- [ ] When a part of data that is not public is shown to everyone (`business-logic/staff-profile/` is the example): a response model, a repository, use cases and a router of their own, not a branch in those of the data; the repository selects the shown columns only and decides in one place who is shown; the use cases that everyone may call take no actor. When the owner of such a record writes a part of it (`*-own-staff-profile.usecase.ts` is the example): the route names no ID and the actor says whose record it is; the request has only the properties the owner writes, with a schema picked from the one of the data; the write is one statement with the condition of who is shown
- [ ] When the data belongs to no salon and is not public (`business-logic/customer/` is the example): the use case decides the permission from the actor alone and first, before it reads the ID, the query or the body; the use case of a list takes the decoded query as a `Result`
- [ ] When the data belongs to the signed-in account (`business-logic/customer/*-customer-profile.usecase.ts` is the example): the route has no ID and the use case finds the record through the scope of the actor; the models leave out what the account is not shown or may not write, and the read mapper names every property it returns
- [ ] When every record of another table has the data, whether a row of it is stored or not (`business-logic/customer-preferences/` is the example): a get and an update, no create and no delete; the repository returns the empty value in place of a missing row, and the first update inserts the row; the response does not show the row (its ID, its times); a rule between properties is checked against the data as it will be stored, inside the transaction that locks the record the data belongs to
- [ ] When the data belongs to a salon and its routes are not below the salon (`business-logic/booking/` is the example): the use case first asks which data the actor reaches, and a reach of none is a 403 before anything of the request is read; the salon that a body or a query names is checked against the reach once it is validated; the repository takes the reach as a condition of its queries, so data of another salon is not found. When most of a row comes from the rows a request refers to: the request holds only what the user decides; a pure function plans the rows from the request and those rows, and the repository calls it inside the transaction that locks them; the locks are always taken in the same order; a rule between stored rows is checked after the locks and answered with 409
- [ ] When a value of a record is counted from rows written below it (`business-logic/payment/` is the example): no request states the value; a pure function counts it from the rows, and the transaction that writes a row holds the record first, reads the rows in the statement after it and writes the row and the value together; nothing else writes the value, and nothing decides by it instead of by the rows

Infrastructure package (`backend/packages/infrastructure/src/`):

- [ ] `repositories/<domain>.repository.impl.ts`: queries inside a function like `attempt`, writes in transactions, expected constraint violations mapped to domain errors, deleted rows filtered out
- [ ] The class is exported from `index.ts`
- [ ] When the data belongs to a salon: every query carries the salon ID

API package:

- [ ] Routes, mounting and integration tests as listed in the [API Route Modular Structure Guide](./api-route-modular-structure.md), with at least five error scenarios per endpoint
- [ ] The handler of every operation that is not public is wrapped with `authenticated`
- [ ] When the data belongs to a salon: the router is mounted below `/salons/:salonId` and created with `Router({ mergeParams: true })`

Before the pull request:

- [ ] `make ci-check` passes: it includes `pnpm check:generated`, `pnpm check:api-db`, `pnpm knip`, `pnpm test` and `pnpm test:integration`
- [ ] If a table changed: `pnpm check:db-schema` passes (CI runs it; it recreates the local database)
