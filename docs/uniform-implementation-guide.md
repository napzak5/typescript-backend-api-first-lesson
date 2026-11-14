# Uniform Implementation Guide

The standard patterns that every backend endpoint follows, each with the file
that implements it. The Salon domain is the only implemented domain and the
reference for the others, so every excerpt below is taken from it or from the
shared code. Excerpts are shortened; the file named above each one is the
authority.

| Pattern | Where it lives |
|---------|----------------|
| [Request validation](#request-validation) | `backend/packages/domain/src/schemas/salon.schema.ts`, `backend/packages/domain/src/shared/validation.ts` |
| [ID validation](#id-validation) | `backend/packages/domain/src/models/salon.ts` |
| [Query parameters](#query-parameters) | `backend/packages/api/src/routes/salon/_shared/query.ts` |
| [Pagination](#pagination) | `list-salons.usecase.ts`, `salon.repository.impl.ts`, `backend/packages/api/src/routes/salon/_shared/links.ts` |
| [Response formatting](#response-formatting) | `backend/packages/api/src/shared/responses.ts` |
| [Error handling](#error-handling) | `backend/packages/api/src/shared/problem-details.ts`, `backend/packages/api/src/middleware/errors.ts` |
| [Logging](#logging) | `backend/packages/infrastructure/src/logging/logger.ts`, `backend/packages/api/src/middleware/request-logging.ts` |
| [Date and time](#date-and-time) | `backend/packages/domain/src/mappers/read/salon.mapper.ts`, `salon.schema.ts` |
| [Authorization](#authorization) | Not implemented |

Related documents: the layer-by-layer walk through the Salon domain is in
[domain-implementation-reference.md](./domain-implementation-reference.md), the
layout of the route files in
[api-route-modular-structure.md](./api-route-modular-structure.md), `Result`
and ts-pattern in [sum-types-pattern-matching.md](./sum-types-pattern-matching.md),
and the type rules in [type-safety-principles.md](./type-safety-principles.md).

## Request validation

- A handler does not validate. It passes `req.body`, typed `unknown`, to the
  use case, and the use case parses it before doing anything else.
- There is one Zod schema per request, in
  `backend/packages/domain/src/schemas/salon.schema.ts`.
- Each schema is checked against the generated API type with
  `satisfies z.ZodType<...>`: a schema whose output cannot be used as that
  type, for example after a TypeSpec change, does not compile.
- Schemas are `z.strictObject`: a property the API does not define is rejected,
  not ignored.
- Length limits are those of the database columns. Rules that span several
  properties use `.check()`, or `.refine()` with a `path`, and report the
  issue on the property at fault.
- The update schema is derived from the create schema with `.exactPartial()`
  and additionally requires at least one property.

```typescript
// backend/packages/domain/src/schemas/salon.schema.ts
export const salonCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(255),
  nameKana: nonBlankText.max(255).nullable(),
  // ...
  email: z.email().max(255),
  websiteUrl: z.httpUrl().max(500).nullable(),
  // ...
  openingHours: openingHoursListSchema,
}) satisfies z.ZodType<ApiSalonCreateRequest>
```

The use case parses with `parseWith` from
`backend/packages/domain/src/shared/validation.ts`, which turns a failed parse
into a `validation` error that lists every broken rule, not only the first:

```typescript
// backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts
async execute(
  input: unknown,
): Promise<Result<ApiSalonResponse, DomainError>> {
  const request = parseWith(salonCreateRequestSchema, input, 'Invalid salon')
  if (request.type === 'error') {
    return request
  }
  // request.data is an ApiSalonCreateRequest from here on
```

Each issue is `{ field, rule, message }`: `field` is the path of the value in
dot notation (`openingHours.0.closeTime`), `rule` is the Zod issue code
(`too_big`, `invalid_format`, `unrecognized_keys`, `custom`, ...). The client
receives them as `errors` of a 400 response (see [Error handling](#error-handling)).

## ID validation

An entity ID is a UUID carried in a branded type, so that a string that has
not been checked cannot be passed where an ID is expected.

```typescript
// backend/packages/domain/src/models/salon.ts
export const salonIdSchema = z.uuid().brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

const salonIdParameterSchema = z.object({ id: salonIdSchema })

export const parseSalonId = (id: unknown): Result<SalonId, DomainError> =>
  Result.map(
    parseWith(salonIdParameterSchema, { id }, 'Invalid salon ID'),
    (parameters) => parameters.id,
  )
```

- The handler passes `req.params.id` as it is; the use case calls
  `parseSalonId` first and hands the resulting `SalonId` to the repository,
  whose methods accept nothing else.
- An ID that is not a UUID is a `validation` error (400) with `field: 'id'`. A
  well-formed ID of a salon that does not exist, or that has been deleted, is
  `notFound` (404).
- IDs are assigned by the database (`uuid().defaultRandom()` in
  `backend/packages/database/src/schema.ts`). A client cannot choose one: the
  create schema has no `id` property.

## Query parameters

A query string carries text only, so a list request is read in two steps.

1. The API layer gives the parameters the types the API defines for them and
   nothing more:

   ```typescript
   // backend/packages/api/src/routes/salon/_shared/query.ts
   const salonSearchQuerySchema = z.looseObject({
     limit: numberParameter.exactOptional(),
     minRating: numberParameter.exactOptional(),
     isActive: booleanParameter.exactOptional(),
     features: listParameter.exactOptional(),
   })

   export const decodeSalonSearchQuery = (
     query: unknown,
   ): Result<unknown, DomainError> =>
     parseWith(salonSearchQuerySchema, query, 'Invalid salon search')
   ```

2. The use case validates the result with `salonSearchRequestSchema`
   (`backend/packages/domain/src/schemas/salon.schema.ts`), which holds the
   rules for the values and for which parameters exist.

```typescript
// backend/packages/api/src/routes/salon/list-salons.handler.ts
const query = decodeSalonSearchQuery(req.query)
const result =
  query.type === 'error' ? query : await useCase.execute(query.data)
```

- The decoding schema is a `looseObject`, so text parameters and unknown
  parameters pass through unchanged; the use case's `strictObject` then rejects
  a parameter the API does not define (`?page=2` is a 400).
- A repeated parameter is a list: `features=a` and `features=a&features=b` both
  become arrays.
- Every filter is optional (`.exactOptional()`). The use case turns an absent
  filter into `null` for the repository (`keyword: keyword ?? null`), where
  `null` means "do not filter".

## Pagination

Lists use keyset pagination. There is no page number and no offset.

| Where | Name | Meaning |
|-------|------|---------|
| Request | `limit` | Items per page, 1 to 100, 20 when absent |
| Request | `cursor` | ID of the last item of the previous page, taken from `meta.nextCursor`; absent for the first page |
| Response | `meta.total` | Number of items that match the filters, across all pages |
| Response | `meta.limit`, `meta.hasMore` | The limit applied; whether another page follows |
| Response | `meta.cursor`, `meta.nextCursor` | The cursor of this request; the cursor of the next page, `null` on the last one |
| Response | `meta.prevCursor` | Always `null`: pages are only walked forwards |
| Response | `links` | `self`, `first` and `next` as URLs that keep the filters (`next` is `null` on the last page); `prev` and `last` are always `null` |

The use case builds `meta`:

```typescript
// backend/packages/domain/src/business-logic/salon/list-salons.usecase.ts
const { salons, total, hasMore } = listed.data
const lastSalonId = salons.at(-1)?.salon.id ?? null

return Result.map(SalonReadMapper.toApiSalons(salons), (data) => ({
  data,
  meta: {
    total,
    limit,
    hasMore,
    cursor: cursor ?? null,
    nextCursor: hasMore ? lastSalonId : null,
    // Pages are only walked forwards.
    prevCursor: null,
  },
}))
```

The repository orders by `(createdAt, id)` descending, starts after the row
the cursor names, and reads one row more than the limit to learn whether
another page follows:

```typescript
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts
const afterCursor =
  after === null
    ? undefined
    : sql`(${salons.createdAt}, ${salons.id}) < (${this.db
        .select({ createdAt: cursorSalon.createdAt, id: cursorSalon.id })
        .from(cursorSalon)
        .where(eq(cursorSalon.id, after))})`

// ... inside the query for the page:
this.db
  .select()
  .from(salons)
  .where(and(filters, afterCursor))
  .orderBy(desc(salons.createdAt), desc(salons.id))
  // One extra row tells whether another page follows.
  .limit(limit + 1)
```

A cursor is validated as an ID, so `cursor=offset:20` is a 400. A well-formed
cursor that names no salon yields an empty page. The page links are built by
`salonPageLinks` in `backend/packages/api/src/routes/salon/_shared/links.ts`
from the request URL with the cursor replaced.

## Response formatting

Every successful response with a body is `{ data, meta, links }`.

| Operation | Status | `meta` | `links` | Extra |
|-----------|--------|--------|---------|-------|
| Create | 201 | `responseMeta(req)` | `salonLinks(req.baseUrl, data.id)` | `Location` header set to `links.self` |
| Get, update | 200 | `responseMeta(req)` | `salonLinks(req.baseUrl, data.id)` | |
| List | 200 | Pagination metadata | `salonPageLinks(...)` | |
| Delete | 204 | | | No body |

```typescript
// backend/packages/api/src/shared/responses.ts
export const responseMeta = (req: Request): ResponseMeta => ({
  correlationId: correlationIdOf(req),
  timestamp: new Date().toISOString(),
  version: API_VERSION,
})
```

- `correlationId` is the request ID (see [Logging](#logging)), not a value made
  up for the response. A list response has pagination metadata in `meta`
  instead; its request ID is in the `X-Request-Id` header.
- Links are built from `req.baseUrl`, the path the router is mounted on, so a
  handler contains no hard-coded path.
- The response body types are taken from the generated `operations` type in
  `backend/packages/api/src/routes/salon/_shared/types.ts` and given to
  `RequestHandler`, so `res.json(...)` is type-checked against the API
  contract.

```typescript
// backend/packages/api/src/routes/salon/update-salon.handler.ts
export const updateSalonHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<
  { id: string },
  UpdateSalonResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateSalonUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.params.id, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({
          data,
          meta: responseMeta(req),
          links: salonLinks(req.baseUrl, data.id),
        })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
```

Property names in `data` are the database column names. The read mapper
renames nothing; it only changes representations: `numeric` to number,
`timestamptz` to ISO 8601, and `jsonb` checked against the API model.

## Error handling

A use case returns a `DomainError`
(`backend/packages/domain/src/shared/errors.ts`). What goes wrong in the HTTP
layer itself is an `HttpError`. Both are sent by `sendProblem(req, res, error)`
as RFC 9457 problem details, so every error response of the API has the same
shape. Nothing in a handler catches exceptions or builds an error body. The
only other error body is that of a failing probe under `/api/system`, which
answers 503 with the body its operation defines.

| Error | Raised by | Status | `code` |
|-------|-----------|--------|--------|
| `validation` | `parseWith` in a use case | 400 | `2001` |
| `notFound` | A use case, when the repository finds no row | 404 | `3001` |
| `alreadyExists` | The repository, on the unique index on `email` | 409 | `3002` |
| `database` | The repository on an unexpected failure; the read mapper on stored data that does not match the API model | 500 | `4003` |
| `routeNotFound` | `notFoundHandler` | 404 | `3001` |
| `malformedBody` | The JSON body parser | 400 | `2002` |
| `unsupportedMediaType` | `requireJsonBody`, the body parser | 415 | `2002` |
| `bodyTooLarge` | The body parser, above 100,000 bytes | 413 | `2004` |
| `badRequest` | Any other 4xx error Express raises | 400 | `2002` |
| `rateLimited` | `rateLimiting` | 429 | `4005` |
| `unexpected` | `errorHandler`, for anything else that was thrown or rejected | 500 | `4001` |

The mapping is one exhaustive `match` in
`backend/packages/api/src/shared/problem-details.ts`; a new error kind does not
compile until it has a status and a code there. Every status of this table
that an operation can answer is declared on it in TypeSpec: the kinds of the
use case one by one, 429 and 500 through `CommonErrors`, and 413 and 415
through `RequestBodyErrors` on the operations that take a body.

```typescript
// backend/packages/api/src/shared/problem-details.ts
.with({ type: 'alreadyExists' }, ({ entity, field, value }) => ({
  type: 'urn:beauty-salon:problem:already-exists',
  title: 'Resource already exists',
  status: 409,
  detail: `${entity} with ${field} ${value} already exists`,
  code: '3002',
  errors: null,
}))
// The cause stays on the server: it may name tables, columns or data.
.with({ type: 'database' }, () => ({
  type: 'urn:beauty-salon:problem:database',
  title: 'Internal server error',
  status: 500,
  detail: null,
  code: '4003',
  errors: null,
}))
```

`sendProblem` adds what identifies the response: `instance` (the request URL),
`correlationId` (the request ID) and `timestamp`. `errors` is filled for
`validation` only, with one entry per broken rule. The response is sent with
the media type `application/problem+json` (RFC 9457); a successful response is
`application/json`.

A `database` or `unexpected` error never shows its cause to the client. It is
logged instead: `sendProblem` logs a `database` error with its cause, and
`errorHandler` logs an unexpected exception with its stack.

Use cases and repositories do not throw. A repository runs its queries through
`attempt`, which turns a rejected promise into a `DomainError`:

```typescript
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts
async findById(
  id: SalonId,
): Promise<Result<SalonWithOpeningHours | null, DomainError>> {
  return attempt('Failed to find salon', null, async () => {
    const [salon] = await this.db
      .select()
      .from(salons)
      .where(and(eq(salons.id, id), notDeleted))
      .limit(1)

    return salon === undefined ? null : withOpeningHours(this.db, salon)
  })
}
```

## Logging

Logging is structured, with pino. Application code never writes to `console`.

- `createLogger` in `backend/packages/infrastructure/src/logging/logger.ts`
  creates the logger in the server's entry point
  (`backend/apps/server/src/index.ts`) from `LOG_LEVEL` and `LOG_FORMAT`. It
  is passed to `createApp`, not imported as a global.
- `requestLogging` in `backend/packages/api/src/middleware/request-logging.ts`
  gives every request `req.id` and `req.log`, a logger whose lines carry that
  ID, and writes one line per completed request (`error` for 5xx, `warn` for
  4xx, otherwise `info`).
- Inside a request, log with `req.log`; elsewhere, with the injected `Logger`.
  The fields come first, the message second:

  ```typescript
  // backend/packages/api/src/shared/responses.ts
  if (error.type === 'database') {
    req.log.error({ cause: error.cause }, error.message)
  }
  ```

- The request ID is the caller's `X-Request-Id` when it is 1 to 128 characters
  of letters, digits and `_.:-`, otherwise a new UUID. It is returned in the
  `X-Request-Id` response header and as `meta.correlationId`, or
  `correlationId` of a problem.
- Use cases and repositories do not log. They return the failure as a value,
  and the API layer logs it once.
- Never logged: request headers and bodies, and the values bound to a failed
  SQL statement. `describeDatabaseError` in
  `backend/packages/infrastructure/src/database/failure.ts` keeps the statement
  with its placeholders and the SQLSTATE and drops the rest.
- The probes under `/api/system` are not written to the request log.

## Date and time

- **Timestamps** (`timestamptz` columns) are written by the database:
  `createdAt` and `updatedAt` default to `now()`, and the repository sets
  `updatedAt` and `deletedAt` with `` sql`now()` ``. Application code does not
  create a `Date` to store it.
- Drizzle reads a `timestamptz` as text. The read mapper converts it to
  ISO 8601 in UTC with date-fns:

  ```typescript
  // backend/packages/domain/src/mappers/read/salon.mapper.ts
  const timestampSchema = z
    .string()
    .transform((value) => parseISO(value))
    .pipe(z.date())
    .transform((value) => value.toISOString())
  ```

- **Calendar dates and times of day** (`date` and `time` columns) stay strings
  from the request to the database: `YYYY-MM-DD` checked with `z.iso.date()`,
  and `HH:mm` or `HH:mm:ss`. Two times of day are compared as strings once both
  have seconds.
- Parsing, validity checks and formatting use date-fns (`parseISO`, `isValid`,
  `format`), not hand-written arithmetic:

  ```typescript
  // backend/packages/domain/src/schemas/salon.schema.ts
  const dayOfWeekOf = (date: string): string | null => {
    const parsed = parseISO(date)
    return isValid(parsed) ? format(parsed, 'EEEE').toLowerCase() : null
  }
  ```

- The `timestamp` of a response or a problem is `new Date().toISOString()`.

## Authorization

Not implemented: the backend has no authentication or authorization code, and
every endpoint is public. The auth and permission models under `specs/` are a
contract without an implementation, so there is no pattern to follow yet.

## Checklist for a new endpoint

- [ ] The operation and its models are defined in TypeSpec, and the generated
      files are committed with them (`pnpm generate`)
- [ ] The request has a Zod schema that `satisfies` the generated type
- [ ] The use case takes `unknown`, parses first and returns
      `Result<..., DomainError>`
- [ ] Path IDs go through a branded ID schema
- [ ] The handler is a factory over its dependencies, takes its response types
      from `operations`, validates nothing, and ends in
      `match(result)...exhaustive()` with `responseMeta` and `sendProblem`
- [ ] A list uses `cursor` and `limit` and returns `meta.nextCursor`
- [ ] Nothing throws, and nothing writes to `console`
- [ ] The endpoint has integration tests with at least five error scenarios
      (see [testing-requirements.md](./testing-requirements.md))
