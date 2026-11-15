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
- [Data That Belongs to No Salon](#data-that-belongs-to-no-salon)
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
| `delete` | `DELETE /api/v1/salons/{id}` | none | 204 | 400, 404, `CommonErrors` | `admin`, or the `owner` of the salon |

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

### `pnpm check:api-db`

The check compares API models with their tables: same names, same nullability, and the optionality that the kind of model calls for. Which model belongs to which table is listed in `backend/packages/database/src/scripts/api-consistency-rules.ts`:

```typescript
const salonRules: ModelRule[] = [
  {
    model: 'Models.SalonResponse',
    table: 'salons',
    kind: 'response',
    embedded: ['openingHours'],
    omittedColumns: ['cancellationPolicy', 'bookingPolicy', 'deletedAt'],
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

The same file has one block of rules per domain. The table-backed models of every domain are listed there with `omittedColumns` and agree with their tables, including the domains whose backend is not implemented yet. Any difference fails the check; there is no list of tolerated differences. Models without a table (computed reports, action requests, and features whose tables do not exist yet, such as permissions and attachments) have no rule.

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
  | 'cancellationPolicy'
  | 'bookingPolicy'
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
- **`storedBusinessHoursSchema`** is the shape of the `businessHours` JSON column without the business rules. The request schema extends it with the rules; the read mapper uses it as it is, because stored data is checked for shape only.

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
const convertedColumnsSchema = z.object({
  latitude: numericSchema.nullable(),
  longitude: numericSchema.nullable(),
  rating: numericSchema.nullable(),
  taxRate: numericSchema,
  businessHours: z.array(storedBusinessHoursSchema).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

// ...

const toApiSalon = (
  salon: DbSalon,
  openingHours: DbOpeningHours[],
): Result<ApiSalonResponse, DomainError> => {
  const { deletedAt, cancellationPolicy, bookingPolicy, ...columns } = salon

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, salon, 'Invalid stored salon'),
      (converted) => ({
        ...columns,
        ...converted,
        openingHours: openingHours.map(toApiOpeningHours),
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored salon ${salon.id} does not match the API model`,
        error,
      ),
  )
}
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

  /** Resolves to false when the salon does not exist. */
  delete(id: SalonId): Promise<Result<boolean, DomainError>>
}
```

- **A missing salon is not an error here.** `findById` and `update` resolve to `null` and `delete` to `false`; the use case turns that into `notFound`. The error side of the `Result` is for what went wrong.
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
          .set({ ...changes, updatedAt: sql`now()` })
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
- **`updatedAt` is set by the database** (`now()`), not by the application clock.

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
    delete: vi.fn(async () => Result.success(true)),
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
| 3. `pnpm check:api-db` | Columns that no request writes are `omittedColumns` of the create and the update rule. Besides the usual ones they are `userId`, because a login account is linked by accepting or joining an invitation and not by a request to the ledger, and `awards`, a `jsonb` column without a defined structure, which the response leaves out too | `staffRules` in `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 6. Mappers | A write mapper with one conversion: `commissionRate` is a `numeric` column, a number in the API and a string in a row. Everything else is passed on as it is | `backend/packages/domain/src/mappers/write/staff.mapper.ts` |
| 8. Repository implementation | The two unique violations are expected outcomes, told apart by the name of the violated constraint and returned as `alreadyExists`, as in the customer repository. An update and a delete are one statement each, which names the salon, the ID and `deletedAt IS NULL`: of two requests that arrive at the same moment, the later one finds no row, and no lock is needed. The list is in the order of registration, `(createdAt, id)` ascending | `backend/packages/infrastructure/src/repositories/staff.repository.impl.ts` |
| 9. Use cases | Every use case, the list and the get included, decides the permission from the salon of the path before anything else of the request is looked at (`mayKeepStaffLedger`: an administrator, or the owner of that salon). The use case of the list therefore takes the decoded query as a `Result`, as that of the customer list does (`ListStaffUseCase.execute(actor, salon, query)`). A second rule compares the actor with the target: nobody deactivates or deletes the staff member that their own account belongs to (`isOwnStaffRecord`). It is answered with `DomainErrors.conflict`, not with `forbidden`, and is decided without the database, after the ID and the body are validated and before the salon is looked up | `backend/packages/domain/src/business-logic/staff/`, with `_shared/authorization.ts` and `_shared/refusals.ts` |
| 10. Handlers and router | The router is created with `Router({ mergeParams: true })`, and every handler is wrapped with `authenticated`. The list handler passes the outcome of `decodeStaffSearchQuery` on to the use case | `backend/packages/api/src/routes/staff/` |
| 12. Tests | A staff member is what gives a login account its salon, so the integration test also signs in as the account of a staff member and shows what deactivating, reactivating and deleting that member does to the account. `staffDependencies` builds the dependencies of a use case test | `backend/packages/api/src/__tests__/staff.integration.test.ts`, `backend/packages/domain/src/__tests__/staff-fixtures.ts` |

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
| 3. Database schema, `pnpm check:api-db` | No migration. The foreign keys to `bookings` already say what a delete does to the rows that refer to a booking: the lines, the status history and the reviews go with it (`ON DELETE CASCADE`), a sale and a treatment record keep it (`ON DELETE RESTRICT`). The rule of the update request leaves out, besides the columns the system decides, the salon, the customer and the staff member | `backend/packages/database/src/scripts/api-consistency-rules.ts` |
| 4. Models | `DbBookingNotes` is the columns an update writes, each of them optional. `BookingRescheduleWrite` is what a reschedule writes: the staff member, the day and the times of the booking, and the staff member and the times of each of its lines | `backend/packages/domain/src/models/booking.ts` |
| 5. Validation schemas | The update schema is made of the same definitions as the create (`notedOfBooking`), with every property optional and at least one present. The reschedule schema reads the beginning by the rule of the create (`minuteInUtc`: UTC, on a whole minute, in one spelling) | `backend/packages/domain/src/schemas/booking.schema.ts` |
| 7. Repository interface | `update(id, reach, notes)` resolves to the booking or to `null`. `reschedule(id, reach, request)` and `delete(id, reach)` answer with sum types: `BookingReschedule` (rescheduled, not found, or why not: `statusDoesNotAllow`, `invalid`, `timeZoneUnknown`, `staffOccupied`, the last three being refusals of a create as well) and `BookingDeletion` (deleted, not found, or `referredTo` with what refers to the booking) | `backend/packages/domain/src/repositories/booking.repository.ts` |
| 8. Repository implementation | Each method is one transaction at `read committed` that first locks the booking `FOR UPDATE` within the reach of the actor, in a statement of its own. A time of the change is written with `clock_timestamp()` in a later statement: a clock in the statement that waits for the lock can be read before the wait. The update then writes the named columns. The reschedule reads the lines, asks `moveBooking`, locks the salon `FOR SHARE` and the staff members of the moved lines `FOR UPDATE` in the order of their IDs, asks `planReschedule`, reads the times at which those staff members are taken by other bookings (the lines of the booking itself are left out, or it would stand in its own way), and writes the booking and each line. The order of the locks is the booking, the salon, the staff members; a create locks no booking, so the two cannot wait for each other for ever. The delete looks for a sale and for a treatment record that refer to the booking before it deletes, so the refusal is an answer of its own and not a violated foreign key; a sale that is being written holds the booking (the lock a foreign key takes), so the delete waits for it and then finds it. When the status of the deleted booking was counted, the customer is locked and counted again, booking before customer as in an action | `backend/packages/infrastructure/src/repositories/booking.repository.impl.ts` |
| 9. Use cases | The permission of a delete is a reach of its own, `bookingRemovalReachOf`: an administrator, and of a salon the owner and the managers, because a delete takes the history of the booking with it and changes what the customer has of visits; the staff cancel a booking that will not take place. The update and the reschedule use `bookingReachOf`. The order of the checks is that of the actions: the reach (403), the ID (400), the request (400), then the repository (404, 409). The rules of a move are two pure functions: `moveBooking` says whether the status allows it and what the booking and its lines are afterwards, and `planReschedule` says, from the staff members and the time zone that were read, what to write and whom the booking occupies when, or that the staff member in charge is not one of the salon. The refusals a reschedule shares with a create go through `toRefusalError` | `backend/packages/domain/src/business-logic/booking/_shared/authorization.ts`, `_shared/reschedule.ts`, `update-booking.usecase.ts`, `reschedule-booking.usecase.ts`, `delete-booking.usecase.ts` |
| 10. Handlers and router | `PATCH /:id`, `DELETE /:id` and `POST /:id/reschedule`, one handler file each. The update and the reschedule answer 200 with the booking as it is then, the delete 204 with no body | `backend/packages/api/src/routes/booking/` |
| 12. Tests | The move and its plan are tested as pure functions, the three use cases together for what they share (the order of the checks, the booking of another salon). The integration test moves two bookings to one time at the same moment and counts how many are moved, moves bookings whose staff members are named in opposite orders, sends a move, a note and an action on the status of one booking at once and checks that all three are kept, holds a transaction open on the booking to show that a change waits and writes the time after the wait, deletes a booking while a sale is being written for it, and removes bookings of a customer while others of theirs are completed to show that the count is right | `backend/packages/domain/src/__tests__/booking.reschedule.test.ts`, `backend/packages/domain/src/__tests__/booking-changes.usecase.test.ts`, `backend/packages/api/src/__tests__/booking-changes.integration.test.ts` |

## Data That Belongs to No Salon

The customer ledger is one for the whole platform: a customer belongs to no salon, and no operation on a customer is public. Its routes are flat like those of Salon (`/api/v1/customers`), and it is built in the same twelve steps; its rules are in [Customer Ledger](./customers.md) (Japanese). Read it for what Salon, the service categories and the services do not have:

| Step | What the customers show | Where to read it |
|------|-------------------------|------------------|
| 1. API contract | No operation is `@useAuth(NoAuth)`: each of the implemented ones declares `CommonErrors`. The interface `CustomerCrud` defines 19 operations, and five of them have a handler here: list, create, get, update and delete. Two more, `getPreferences` and `updatePreferences`, are those of [the preferences](#a-record-every-customer-has-the-preferences). The other 12 are not implemented | `specs/operations/customer-operations.tsp`, `specs/models/customer.tsp` |
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

## Error Handling

A use case fails in one of seven ways (`backend/packages/domain/src/shared/errors.ts`):

```typescript
export type DomainError =
  | { type: 'validation'; message: string; issues: ValidationIssue[] }
  | { type: 'unauthenticated'; reason: AuthenticationFailure }
  | { type: 'forbidden' }
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'conflict'; message: string }
  | { type: 'database'; message: string; cause: unknown }
```

Errors are built with `DomainErrors.validation`, `.unauthenticated`, `.forbidden`, `.notFound`, `.alreadyExists`, `.conflict` and `.database`. Where each kind comes from:

| Kind | Where it is created | What the client gets |
|------|---------------------|----------------------|
| `validation` | `parseWith`, called by a use case (and by the query decoding of a list handler). The authentication use cases also build it themselves for what a schema cannot check: a password that is too easy to guess, a wrong current password, a mailed token that cannot be used, a code of two-factor authentication that is not accepted, a cursor of the session list that names no session of the user. The service category use cases do so for a parent that is not a category of the same salon or that is the category itself or one below it, and for a cursor that names no category of the salon. The service use cases do so for a service that would break a rule tying two of its properties together, for a category that is not of the same salon, for a member of a package that is not a service of the same salon, is a package or is the service itself, for making a package of a service that a package contains, and for a cursor that names no service of the salon; `toRefusalError` (`backend/packages/domain/src/business-logic/service/_shared/refusals.ts`) builds the ones that answer a refusal of the repository. The customer use cases do so for a birth date before 1900 or in the future, for a referrer that does not exist, is deleted or is the customer itself, and for a cursor that names no customer. The use case of the staff list does so for a cursor that names no staff member of the salon | 400 with the broken rules in `errors` |
| `unauthenticated` | the authentication use cases only: `AuthenticateUseCase` behind `authenticated`, login and refresh, and the current-user, change-password and two-factor use cases when the user of the session no longer exists | 401 with a `WWW-Authenticate` header |
| `forbidden` | a use case, when its permission rule refuses the actor | 403 |
| `notFound` | a use case, when the repository resolved to `null` or `false` or reported that there is no such row; `requireSalon`, when the salon in the path does not exist; a use case of a customer's own profile, when the account has no customer record | 404 |
| `alreadyExists` | the repository, from a unique violation: the email of a salon, the email of a customer, the referral code of a customer, the email and the staff code of a staff member within a salon | 409 |
| `conflict` | a use case, when the request is fine and what it acts on is not in a state that allows it: the use cases of two-factor authentication (enabling what is already enabled, for example), those of the administrator operations (unlocking an account that is not locked, for example), the use case that deletes a service, when a package contains the service, and the use case that creates a customer's own profile, when the account has one already, has not confirmed its email address, or the customer with its email address belongs to another account. The customer repository returns it as well, when a customer with that email address is added at the moment the profile is created. The use cases that update and delete a staff member return it for what an actor may do to every staff member but their own: deactivating or deleting the one their account belongs to | 409 |
| `database` | the repository, from a failed query; the read mapper, from a stored row that does not fit | 500 without details; the cause is logged |

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
- [ ] `schemas/<domain>.schema.ts`: one strict schema per request, each with `satisfies z.ZodType<...>`; the rules that more than one domain needs (`nonBlankText`, `lowerCaseEmail`, `phoneNumber`, `timeSlot`, `timeZoneName`, `MAX_INTEGER`, `noRepeatedEntries`, `atLeastOneProperty`) come from `schemas/rules.ts`
- [ ] `mappers/read/<domain>.mapper.ts`, and `mappers/write/<domain>.mapper.ts` when a column needs converting on the way in or a request holds the rows of more than one table; when neither is the case the request is the row, and a write mapper only states that (`mappers/write/customer.mapper.ts`; the service categories have none): no renaming; the read mapper returns a `Result`
- [ ] `repositories/<domain>.repository.ts`: the interface
- [ ] `business-logic/<domain>/`: `_shared/dependencies.ts`, one `<action>-<domain>.usecase.ts` per operation with `execute` taking `unknown`, and `index.ts`
- [ ] `business-logic/<domain>/_shared/authorization.ts`: one pure function per permission rule; the use case of every operation that is not public takes `actor: Actor` first and returns `DomainErrors.forbidden()` when the rule refuses
- [ ] The use cases, models and repository interface are exported from `index.ts`
- [ ] `__tests__/`: schema, mapper and use case tests, the last including every kind of actor for each permission rule
- [ ] When the data belongs to a salon: the use case parses the salon of the path with `parseSalonIdOfPath`, decides the permission from that salon, and calls `requireSalon` before it reaches its repository; the dependencies hold `salonRepository`; every method of the repository interface takes the salon ID
- [ ] When the data belongs to a salon and none of it is public (`business-logic/staff/` is the example): every use case, the list and the get included, decides the permission from the salon of the path first; the use case of a list takes the decoded query as a `Result`
- [ ] When rows belong to a record of a salon and are replaced as a whole (`business-logic/staff-schedule/` is the example): the router is mounted below the record; the body of the `PUT` is a named array model with `@maxItems`; the schema checks each row and then the rows against each other, and the table keeps the same rules with CHECK constraints and unique indexes; the permission is decided for the salon and then for the record; the repository replaces the rows in one transaction that locks the record
- [ ] When a mailed token gives access to a record (`business-logic/staff-invitation/` is the example): only the hash of the token is stored; the operations of whoever holds the token are public, take the token in the body and answer every token that cannot be used in the same way; an operation that changes an account that exists asks for a session of that account as well, because a mailed token is not a password; the request does not name the address the mail goes to, and the answer does not tell whether that address has an account; the repository answers with sum types, and every write locks the record it decides from and reads it again
- [ ] When a salon keeps a part of rows that belong to another domain (`business-logic/staff-account/` is the example): a response model with the properties the salon is shown and a request model with the ones it may write; the repository selects those columns only; a property that takes some of the values of the enum of its column gets an enum of its own, a check constraint that keeps the column to those values where the model applies, and an entry in `narrowed` of its rule; a rule about the actor's own record is a 409, checked after the body and before anything is looked up
- [ ] When a part of data that is not public is shown to everyone (`business-logic/staff-profile/` is the example): a response model, a repository, use cases and a router of their own, not a branch in those of the data; the repository selects the shown columns only and decides in one place who is shown; the use cases that everyone may call take no actor. When the owner of such a record writes a part of it (`*-own-staff-profile.usecase.ts` is the example): the route names no ID and the actor says whose record it is; the request has only the properties the owner writes, with a schema picked from the one of the data; the write is one statement with the condition of who is shown
- [ ] When the data belongs to no salon and is not public (`business-logic/customer/` is the example): the use case decides the permission from the actor alone and first, before it reads the ID, the query or the body; the use case of a list takes the decoded query as a `Result`
- [ ] When the data belongs to the signed-in account (`business-logic/customer/*-customer-profile.usecase.ts` is the example): the route has no ID and the use case finds the record through the scope of the actor; the models leave out what the account is not shown or may not write, and the read mapper names every property it returns
- [ ] When every record of another table has the data, whether a row of it is stored or not (`business-logic/customer-preferences/` is the example): a get and an update, no create and no delete; the repository returns the empty value in place of a missing row, and the first update inserts the row; the response does not show the row (its ID, its times); a rule between properties is checked against the data as it will be stored, inside the transaction that locks the record the data belongs to
- [ ] When the data belongs to a salon and its routes are not below the salon (`business-logic/booking/` is the example): the use case first asks which data the actor reaches, and a reach of none is a 403 before anything of the request is read; the salon that a body or a query names is checked against the reach once it is validated; the repository takes the reach as a condition of its queries, so data of another salon is not found. When most of a row comes from the rows a request refers to: the request holds only what the user decides; a pure function plans the rows from the request and those rows, and the repository calls it inside the transaction that locks them; the locks are always taken in the same order; a rule between stored rows is checked after the locks and answered with 409

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
