# Domain Implementation Reference Guide

The Salon domain is the reference for every other domain of the backend. This document walks through it in the order in which a new domain is built, from the API contract to the tests, and explains the decisions the code makes on the way. Authentication is described in [Authentication and Authorization](./authentication.md) (Japanese); what a domain needs from it is in step 9 (the permission check) and step 10 (the `authenticated` wrapper). The service categories of a salon are built in the same steps; what they do differently because their data belongs to a salon is collected in [Data That Belongs to a Salon](#data-that-belongs-to-a-salon). So are the services of a salon; the same section names what they show that neither Salon nor the service categories do. The customer ledger is built in these steps too; what it shows because its data belongs to no salon and none of it is public is collected in [Data That Belongs to No Salon](#data-that-belongs-to-no-salon).

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

`nonBlankText` and `atLeastOneProperty` are not Salon's own, and neither is `phoneNumber`, the rule of the two phone numbers of a salon. The rules that the request schemas of more than one domain share are in `backend/packages/domain/src/schemas/rules.ts`. The file also holds `lowerCaseEmail`, an address that is stored and compared in lower case, `MAX_INTEGER`, the largest value of an `integer` column, and `noRepeatedEntries`, for a list in which no entry may come twice; Salon needs none of the three.

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
  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter({ salonRepository }, authenticated),
  )
```

A new domain adds one such statement next to it, before `notFoundHandler`. The salon repository has a name because the routers of the service categories and of the services, mounted in the two statements that follow at `${API_BASE_PATH}/salons/:salonId/service-categories` and `${API_BASE_PATH}/salons/:salonId/services`, are given the same instance. The router of the customer ledger is mounted after them at `${API_BASE_PATH}/customers`, with a repository of its own and the `clock` of the authentication dependencies: `createApp` builds one function that returns the current time and hands it to both. Nothing changes in `backend/apps/server`: it reads the configuration, connects the database, creates the mailer and the authenticator of two-factor authentication and calls `createApp({ database, logger, mailer, twoFactorAuthenticator, settings })`.

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

## Data That Belongs to No Salon

The customer ledger is one for the whole platform: a customer belongs to no salon, and no operation on a customer is public. Its routes are flat like those of Salon (`/api/v1/customers`), and it is built in the same twelve steps; its rules are in [Customer Ledger](./customers.md) (Japanese). Read it for what Salon, the service categories and the services do not have:

| Step | What the customers show | Where to read it |
|------|-------------------------|------------------|
| 1. API contract | No operation is `@useAuth(NoAuth)`: each of the implemented ones declares `CommonErrors`. The interface `CustomerCrud` defines 18 operations, and five of them have a handler: list, create, get, update and delete. The other 13 are not implemented | `specs/operations/customer-operations.tsp`, `specs/models/customer.tsp` |
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
| `validation` | `parseWith`, called by a use case (and by the query decoding of a list handler). The authentication use cases also build it themselves for what a schema cannot check: a password that is too easy to guess, a wrong current password, a mailed token that cannot be used, a code of two-factor authentication that is not accepted, a cursor of the session list that names no session of the user. The service category use cases do so for a parent that is not a category of the same salon or that is the category itself or one below it, and for a cursor that names no category of the salon. The service use cases do so for a service that would break a rule tying two of its properties together, for a category that is not of the same salon, for a member of a package that is not a service of the same salon, is a package or is the service itself, for making a package of a service that a package contains, and for a cursor that names no service of the salon; `toRefusalError` (`backend/packages/domain/src/business-logic/service/_shared/refusals.ts`) builds the ones that answer a refusal of the repository. The customer use cases do so for a birth date before 1900 or in the future, for a referrer that does not exist, is deleted or is the customer itself, and for a cursor that names no customer | 400 with the broken rules in `errors` |
| `unauthenticated` | the authentication use cases only: `AuthenticateUseCase` behind `authenticated`, login and refresh, and the current-user, change-password and two-factor use cases when the user of the session no longer exists | 401 with a `WWW-Authenticate` header |
| `forbidden` | a use case, when its permission rule refuses the actor | 403 |
| `notFound` | a use case, when the repository resolved to `null` or `false` or reported that there is no such row; `requireSalon`, when the salon in the path does not exist; a use case of a customer's own profile, when the account has no customer record | 404 |
| `alreadyExists` | the repository, from a unique violation: the email of a salon, the email of a customer, the referral code of a customer | 409 |
| `conflict` | a use case, when the request is fine and what it acts on is not in a state that allows it: the use cases of two-factor authentication (enabling what is already enabled, for example), those of the administrator operations (unlocking an account that is not locked, for example), the use case that deletes a service, when a package contains the service, and the use case that creates a customer's own profile, when the account has one already, has not confirmed its email address, or the customer with its email address belongs to another account. The customer repository returns it as well, when a customer with that email address is added at the moment the profile is created | 409 |
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
- [ ] `schemas/<domain>.schema.ts`: one strict schema per request, each with `satisfies z.ZodType<...>`; the rules that more than one domain needs (`nonBlankText`, `lowerCaseEmail`, `phoneNumber`, `MAX_INTEGER`, `noRepeatedEntries`, `atLeastOneProperty`) come from `schemas/rules.ts`
- [ ] `mappers/read/<domain>.mapper.ts`, and `mappers/write/<domain>.mapper.ts` when a column needs converting on the way in or a request holds the rows of more than one table; when neither is the case the request is the row, and a write mapper only states that (`mappers/write/customer.mapper.ts`; the service categories have none): no renaming; the read mapper returns a `Result`
- [ ] `repositories/<domain>.repository.ts`: the interface
- [ ] `business-logic/<domain>/`: `_shared/dependencies.ts`, one `<action>-<domain>.usecase.ts` per operation with `execute` taking `unknown`, and `index.ts`
- [ ] `business-logic/<domain>/_shared/authorization.ts`: one pure function per permission rule; the use case of every operation that is not public takes `actor: Actor` first and returns `DomainErrors.forbidden()` when the rule refuses
- [ ] The use cases, models and repository interface are exported from `index.ts`
- [ ] `__tests__/`: schema, mapper and use case tests, the last including every kind of actor for each permission rule
- [ ] When the data belongs to a salon: the use case parses the salon of the path with `parseSalonIdOfPath`, decides the permission from that salon, and calls `requireSalon` before it reaches its repository; the dependencies hold `salonRepository`; every method of the repository interface takes the salon ID
- [ ] When the data belongs to no salon and is not public (`business-logic/customer/` is the example): the use case decides the permission from the actor alone and first, before it reads the ID, the query or the body; the use case of a list takes the decoded query as a `Result`
- [ ] When the data belongs to the signed-in account (`business-logic/customer/*-customer-profile.usecase.ts` is the example): the route has no ID and the use case finds the record through the scope of the actor; the models leave out what the account is not shown or may not write, and the read mapper names every property it returns

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
