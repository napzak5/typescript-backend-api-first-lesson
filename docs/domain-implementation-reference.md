# Domain Implementation Reference Guide

The Salon domain is the only domain implemented in the backend, and it is the reference for every other one. This document walks through it in the order in which a new domain is built, from the API contract to the tests, and explains the decisions the code makes on the way.

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
- [Error Handling](#error-handling)
- [Implementation Checklist](#implementation-checklist)

## Architecture Overview

A request passes through three packages:

```
HTTP request
  → handler      (api)             passes the raw input on
  → use case     (domain)          validates, maps, decides
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

Shared by every domain and already in place: `Result` (`backend/packages/utility/src/result/result.ts`), `DomainError` and `parseWith` (`backend/packages/domain/src/shared/`), `describeDatabaseError` (`backend/packages/infrastructure/src/database/failure.ts`) and the response helpers of the API package.

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

| Operation | Route | Request | Success | Declared errors |
|-----------|-------|---------|---------|-----------------|
| `list` | `GET /api/v1/salons` | `SalonSearchRequest` as query parameters | 200, `CursorPaginationResponse<SalonResponse>` | 400 |
| `create` | `POST /api/v1/salons` | `SalonCreateRequest` | 201 with `Location`, `ApiResponse<SalonResponse>` | 400, 409 |
| `get` | `GET /api/v1/salons/{id}` | none | 200, `ApiResponse<SalonResponse>` | 400, 404 |
| `update` | `PATCH /api/v1/salons/{id}` | `SalonUpdateRequest` | 200, `ApiResponse<SalonResponse>` | 400, 404, 409 |
| `delete` | `DELETE /api/v1/salons/{id}` | none | 204 | 400, 404 |

Two decisions to copy:

- **Only what is implemented is specified.** Every operation in the file has a handler. Each declares its success response, from which the handler takes its response type (step 10), and the 400, 404 and 409 responses its use case can produce.
- **Update is `PATCH`**, and filtering is part of `list`. There is no `PUT` and no separate search route.

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
    unique('salons_email_unique').on(table.email),
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
| `unique('salons_email_unique')` | The source of the `alreadyExists` error (step 8) |
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

- `embedded` names properties that are rows of a child table, not columns.
- `omittedColumns` names the columns the model leaves out on purpose. Once it is given, every other column must be in the model, so leaving a column out is a decision and not an oversight.

The domains that are specified but not implemented are listed in the same file under `specifiedOnlyRules`, without `omittedColumns`. Their TypeSpec models and their tables both exist and disagree; the known differences are recorded in `backend/packages/database/api-consistency-baseline.json` (GitHub issue #91). A new difference fails the check, and so does a baseline entry that no longer occurs.

A domain is done when its models are listed with `omittedColumns` and have no entry in the baseline. After the differences are fixed in TypeSpec or with a migration, `pnpm check:api-db --update-baseline` records what still differs as the new baseline, which drops the resolved entries. It records every remaining difference, new ones included, so read the diff of the baseline file before committing it.

## 4. Models

`backend/packages/domain/src/models/salon.ts` holds the types of the domain and the schema of its ID. No shape is declared by hand: API types come from the generated package, database types from the Drizzle tables.

```typescript
export const salonIdSchema = z.uuid().brand<'SalonId'>()
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
  .check((context) => {
    // An unknown property is reported as such, not as an empty request.
    if (
      context.issues.length === 0 &&
      Object.keys(context.value).length === 0
    ) {
      context.issues.push({
        code: 'custom',
        path: [],
        message: 'At least one property must be specified',
        input: context.value,
      })
    }
  }) satisfies z.ZodType<ApiSalonUpdateRequest>
```

- **`satisfies z.ZodType<...>`** ties the schema to the generated type: what the schema produces must be assignable to the API type. A property that the TypeSpec model adds or retypes is a compile error until the schema follows.
- **`z.strictObject`** rejects a property the model does not have. A client that sends `rating` gets a validation error naming `rating`; the property is not silently dropped.
- **Three sources of rules.** The shape comes from the API type, the length limits from the columns (`varchar(255)` → `.max(255)`), and the rest are business rules: text must not be blank, a calendar entry must fall on the day of the week it names, closing must be later than opening.
- **Cross-field rules use `.check()`** and push an issue with the `path` of the offending property, so the client learns which field to fix.
- **The update schema is derived** from the create schema with `exactPartial()`: every key may be absent, and a key that is present is checked by the same rule as on create. Its one rule of its own rejects an empty request.
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

Rows → API response (`backend/packages/domain/src/mappers/read/salon.mapper.ts`):

```typescript
const numericSchema = z.string().transform(Number).pipe(z.number())

const timestampSchema = z
  .string()
  .transform((value) => parseISO(value))
  .pipe(z.date())
  .transform((value) => value.toISOString())

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

- **The unique constraint is the uniqueness check.** There is no "does this email exist" query before the insert, which would leave a gap between the check and the write. The repository recognises SQLSTATE `23505` on the constraint `salons_email_unique`, on the error or on its `cause`, because Drizzle wraps the driver's error.
- **The value in the error comes from the caller.** `attempt` is given the email being written (`salon.email` on create, `changes.email ?? null` on update), so nothing is parsed out of PostgreSQL's message. A method that writes no email passes `null`, and a violation there is not an expected failure.
- **Everything else is a `database` error** whose cause is `describeDatabaseError(cause)`: the driver's message, the SQLSTATE, the constraint, table and column names, and the statement with placeholders. The bound values are left out, so the cause is safe to log.
- **The deleted row keeps its email.** Delete is a soft delete, so the email of a deleted salon still conflicts.

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
   */
  async execute(
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiSalonResponse, DomainError>> {
    const salonId = parseSalonId(id)
    if (salonId.type === 'error') {
      return salonId
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

- **The inputs are `unknown`.** What arrives over HTTP is not a `SalonUpdateRequest` until it has been checked. If the handler declared the body with the request type, the compiler would accept an unchecked value as checked, which is a type assertion in everything but name. With `unknown`, the value cannot be used before `parseWith` has returned the typed one, and validation happens in exactly one place whoever the caller is.
- **A failed step is returned as it is.** After `request.type === 'error'` the value is the error variant, which fits every `Result<T, DomainError>`.
- **The use case decides what "not found" is.** The repository reported `null`; the use case names the entity and the ID.
- **No uniqueness check here.** The use case relies on the repository to report `alreadyExists` (step 8).
- **The return value is the API model**, mapped from the rows the repository read back.

| Use case | `execute` | Success data |
|----------|-----------|--------------|
| `CreateSalonUseCase` | `(input: unknown)` | `ApiSalonResponse` |
| `GetSalonUseCase` | `(id: unknown)` | `ApiSalonResponse` |
| `ListSalonsUseCase` | `(input: unknown)` | `SalonPage`: `data` and pagination `meta` |
| `UpdateSalonUseCase` | `(id: unknown, input: unknown)` | `ApiSalonResponse` |
| `DeleteSalonUseCase` | `(id: unknown)` | the `SalonId` that was deleted |

`ListSalonsUseCase` applies the default `limit` of 20, turns absent filters into `null` for the repository and builds `meta`: `nextCursor` is the ID of the last salon of the page when `hasMore` is true, otherwise `null`.

The use cases and `SalonUseCaseDependencies` are exported from `business-logic/salon/index.ts`, and the package exports them with the models, the repository interface and the shared error and validation code from `backend/packages/domain/src/index.ts`. Schemas and mappers stay internal to the package.

## 10. Handlers and Router

Each operation has a handler file in `backend/packages/api/src/routes/salon/`, and `index.ts` there exports `createSalonRouter(dependencies)`. A handler is a factory over `SalonUseCaseDependencies`: it passes `req.body`, `req.params.id` or the decoded query to the use case and matches the `Result` into a response or into problem details.

The layout of the API package, the handler pattern, the shared helpers and the middleware are described in the [API Route Modular Structure Guide](./api-route-modular-structure.md).

## 11. Wiring

`createApp` in `backend/packages/api/src/index.ts` constructs each repository once and mounts the router:

```typescript
  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter({ salonRepository: new SalonRepository(database) }),
  )
```

A new domain adds one such statement next to it, before `notFoundHandler`. Nothing changes in `backend/apps/server`: it reads the configuration, connects the database and calls `createApp({ database, logger, settings })`.

## 12. Tests

| File | Kind | What it covers |
|------|------|----------------|
| `backend/packages/domain/src/__tests__/salon.schema.test.ts` | unit | the request schemas: what they accept and the rules they reject |
| `backend/packages/domain/src/__tests__/salon.mapper.test.ts` | unit | both mappers, including stored rows that do not fit |
| `backend/packages/domain/src/__tests__/salon.usecase.test.ts` | unit | each use case against a stubbed repository |
| `backend/packages/domain/src/__tests__/fixtures.ts` | helper | a valid request, rows as the driver returns them, `brokenRules` |
| `backend/packages/api/src/routes/salon/_shared/__tests__/` | unit | link building and query decoding |
| `backend/packages/api/src/__tests__/salon.integration.test.ts` | integration | every endpoint through HTTP against PostgreSQL |

The repository has no unit test of its own; its queries, transactions and constraint handling are exercised by the integration tests against a real PostgreSQL.

Use case tests replace the repository with a stub that holds one salon, and a test overrides the method it is about (`salon.usecase.test.ts`):

```typescript
/** A repository that holds one salon; a test overrides what it needs. */
const repositoryWith = (
  overrides: Partial<ISalonRepository> = {},
): ISalonRepository => ({
  create: vi.fn(async () => Result.success(stored)),
  findById: vi.fn(async () => Result.success(stored)),
  list: vi.fn(async () =>
    Result.success({ salons: [stored], total: 1, hasMore: false }),
  ),
  update: vi.fn(async () => Result.success(stored)),
  delete: vi.fn(async () => Result.success(true)),
  ...overrides,
})
```

Integration tests run the production `createApp` (through `createTestApp` in `__tests__/_shared/test-helpers.ts`) with a PostgreSQL schema of their own per test. They assert the response and the stored state (`salon.integration.test.ts`):

```typescript
    it('rejects an email that another salon uses', async () => {
      await createSalon()

      const response = await request(app)
        .post(SALONS)
        .send(salonRequest({ name: 'Second salon' }))

      expectProblem(response, conflict)
      expect(response.body.detail).toBe(
        'Salon with email aoyama@example.com already exists',
      )
      expect(await db.$count(salons)).toBe(1)
    })
```

Each endpoint has at least five error scenarios, most of them rows of an `it.each` table that name the broken rule as `field:rule` (for example `postalCode:too_big`). Beyond the validation cases, the Salon tests cover an unknown ID, a deleted salon, a duplicate email, a corrupt stored row, a request that must leave the stored data untouched, and pagination while salons are added.

```bash
pnpm test               # unit tests of every package
pnpm test:integration   # integration tests; uses TEST_DATABASE_URL, otherwise testcontainers (Docker)
```

The conventions are in [Testing Requirements](./testing-requirements.md) and the [API Testing Guide](./api-testing-guide.md).

## Error Handling

A use case fails in one of four ways (`backend/packages/domain/src/shared/errors.ts`):

```typescript
export type DomainError =
  | { type: 'validation'; message: string; issues: ValidationIssue[] }
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'database'; message: string; cause: unknown }
```

Errors are built with `DomainErrors.validation`, `.notFound`, `.alreadyExists` and `.database`. Where each kind comes from:

| Kind | Where it is created | What the client gets |
|------|---------------------|----------------------|
| `validation` | `parseWith`, called by a use case (and by the query decoding of the list handler) | 400 with the broken rules in `errors` |
| `notFound` | a use case, when the repository resolved to `null` or `false` | 404 |
| `alreadyExists` | the repository, from the unique violation | 409 |
| `database` | the repository, from a failed query; the read mapper, from a stored row that does not fit | 500 without details; the cause is logged |

The API package maps the kind to a status and a problem details body (`backend/packages/api/src/shared/problem-details.ts`). A domain adds nothing there unless it introduces a new kind of error, and then the exhaustive match in that file stops compiling until the new kind has a status.

## Implementation Checklist

For a new domain, with `<domain>` as its name. Each item names what the Salon domain has.

Contract and database:

- [ ] `specs/models/<domain>.tsp` defines the response, create, update and search models; property names and nullability are those of the columns
- [ ] `specs/operations/<domain>-operations.tsp` defines only the operations that will be implemented, each with its success response and the error responses its use case can produce; both files are imported in `specs/main.tsp`
- [ ] `pnpm generate` has been run and the generated files are committed
- [ ] If the table must change: a migration, then `pnpm db:migrate`, `pnpm db:introspect` and `pnpm db:generate-sql`, with the regenerated files committed and the seed data in `backend/packages/database/src/seeds/seed-data/` adjusted
- [ ] The models are listed in `api-consistency-rules.ts` with `omittedColumns`, `pnpm check:api-db` passes, and the domain has no entry left in `api-consistency-baseline.json`

Domain package (`backend/packages/domain/src/`):

- [ ] `models/<domain>.ts`: branded ID with its parser, API types, database types
- [ ] `schemas/<domain>.schema.ts`: one strict schema per request, each with `satisfies z.ZodType<...>`
- [ ] `mappers/write/<domain>.mapper.ts` and `mappers/read/<domain>.mapper.ts`: no renaming; the read mapper returns a `Result`
- [ ] `repositories/<domain>.repository.ts`: the interface
- [ ] `business-logic/<domain>/`: `_shared/dependencies.ts`, one `<action>-<domain>.usecase.ts` per operation with `execute` taking `unknown`, and `index.ts`
- [ ] The use cases, models and repository interface are exported from `index.ts`
- [ ] `__tests__/`: schema, mapper and use case tests

Infrastructure package (`backend/packages/infrastructure/src/`):

- [ ] `repositories/<domain>.repository.impl.ts`: queries inside a function like `attempt`, writes in transactions, expected constraint violations mapped to domain errors, deleted rows filtered out
- [ ] The class is exported from `index.ts`

API package:

- [ ] Routes, mounting and integration tests as listed in the [API Route Modular Structure Guide](./api-route-modular-structure.md), with at least five error scenarios per endpoint

Before the pull request:

- [ ] `make ci-check` passes: it includes `pnpm check:generated`, `pnpm check:api-db`, `pnpm knip`, `pnpm test` and `pnpm test:integration`
- [ ] If a table changed: `pnpm check:db-schema` passes (CI runs it; it recreates the local database)
