# Uniform Implementation Guide

The standard patterns that every backend endpoint follows, each with the file
that implements it. The Salon domain is the reference for the others, so
every excerpt below is taken from it or from the shared code. Excerpts are
shortened; the file named above each one is the authority.

| Pattern | Where it lives |
|---------|----------------|
| [Request validation](#request-validation) | `backend/packages/domain/src/schemas/salon.schema.ts`, `backend/packages/domain/src/schemas/rules.ts`, `backend/packages/domain/src/shared/validation.ts` |
| [ID validation](#id-validation) | `backend/packages/domain/src/models/salon.ts` |
| [Query parameters](#query-parameters) | `backend/packages/api/src/shared/query-parameters.ts`, `backend/packages/api/src/routes/salon/_shared/query.ts`, `backend/packages/api/src/routes/customer/list-customers.handler.ts` (a list with a permission check) |
| [Pagination](#pagination) | `list-salons.usecase.ts`, `salon.repository.impl.ts`, `backend/packages/api/src/shared/page-links.ts` |
| [Response formatting](#response-formatting) | `backend/packages/api/src/shared/responses.ts` |
| [Error handling](#error-handling) | `backend/packages/api/src/shared/problem-details.ts`, `backend/packages/api/src/middleware/errors.ts` |
| [Logging](#logging) | `backend/packages/infrastructure/src/logging/logger.ts`, `backend/packages/api/src/middleware/request-logging.ts` |
| [Date and time](#date-and-time) | `backend/packages/domain/src/mappers/read/columns.ts`, `salon.schema.ts`, `customer.schema.ts`, `customer.repository.impl.ts` |
| [Authorization](#authorization) | `backend/packages/api/src/shared/authentication.ts`, `backend/packages/domain/src/business-logic/salon/_shared/authorization.ts` |

Related documents: the layer-by-layer walk through the Salon domain is in
[domain-implementation-reference.md](./domain-implementation-reference.md), the
layout of the route files in
[api-route-modular-structure.md](./api-route-modular-structure.md), `Result`
and ts-pattern in [sum-types-pattern-matching.md](./sum-types-pattern-matching.md),
and the type rules in [type-safety-principles.md](./type-safety-principles.md).

## Request validation

- A handler does not validate. It passes `req.body`, typed `unknown`, to the
  use case, and the use case parses it before using it. Only the permission
  check comes earlier (see [Authorization](#authorization)).
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
- A rule that ties two properties of which a partial update may name only
  one cannot be decided from the request. It is a pure function of the
  domain, checked for the row as it will be stored: `serviceRuleIssues` in
  `backend/packages/domain/src/business-logic/service/_shared/rules.ts`,
  which the use case calls for a create and the repository calls inside its
  transaction for an update.
- A rule that needs the current time is not in a schema either. The use case
  checks it with the time its dependencies give it (see
  [Date and time](#date-and-time)): `customerRuleIssues` in
  `backend/packages/domain/src/business-logic/customer/_shared/rules.ts`
  refuses a birth date in the future.
- The update schema is derived from the create schema with `.exactPartial()`
  and additionally requires at least one property (`atLeastOneProperty`).
- The rules that the schemas of more than one domain share are in
  `backend/packages/domain/src/schemas/rules.ts`: `nonBlankText`, for a text
  that must say something, `lowerCaseEmail`, for an address that is stored
  and compared in lower case, `phoneNumber`, for a phone number as people
  write it, `MAX_INTEGER`, the largest value of an `integer` column,
  `noRepeatedEntries`, for a list in which no entry may come twice, and
  `atLeastOneProperty`. A domain imports them and does not write them again.

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
  actor: Actor,
  input: unknown,
): Promise<Result<ApiSalonResponse, DomainError>> {
  if (!mayCreateSalon(actor)) {
    return Result.error(DomainErrors.forbidden())
  }

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
export const salonIdSchema = uuidSchema.brand<'SalonId'>()
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
- `uuidSchema` (`backend/packages/domain/src/shared/identifier.ts`) is
  `z.uuid().toLowerCase()`. The letters of a UUID may be written in either
  case, and PostgreSQL always returns them in lower case, so an ID from a
  request is brought into that spelling when it is checked. An ID is compared
  as a string in several places (is this the salon of the actor, is this the
  administrator's own account, is the referrer of a customer the customer
  itself), and both sides then spell the same ID the same way. Every ID
  schema is built from `uuidSchema`; do not call `z.uuid()` for an ID.
- Every domain has a parser of this form for the ID in its path:
  `parseCustomerId` in `backend/packages/domain/src/models/customer.ts` is
  the one of `/api/v1/customers/{id}`. A customer use case calls it after
  the permission check, which does not need the ID (see
  [Authorization](#authorization)). `parseStaffId` in
  `backend/packages/domain/src/models/staff.ts` is the one of
  `/api/v1/salons/{salonId}/staff/{id}`; a staff use case reads the salon ID
  first, decides the permission from it, and reads the staff ID after that.
- An ID that is not a UUID is a `validation` error (400) with `field: 'id'`. A
  well-formed ID of a salon that does not exist, or that has been deleted, is
  `notFound` (404).
- IDs are assigned by the database (`uuid().defaultRandom()` in
  `backend/packages/database/src/schema.ts`). A client cannot choose one: the
  create schema has no `id` property.

A route below a salon, such as
`/api/v1/salons/{salonId}/service-categories/{id}`, has the ID of the salon
in its path as well. That ID has a parser of its own, so that a failure names
the field `salonId`:

```typescript
// backend/packages/domain/src/models/salon.ts
const salonIdOfPathSchema = z.object({ salonId: salonIdSchema })

export const parseSalonIdOfPath = (
  salonId: unknown,
): Result<SalonId, DomainError> =>
  Result.map(
    parseWith(salonIdOfPathSchema, { salonId }, 'Invalid salon ID'),
    (parameters) => parameters.salonId,
  )
```

- The ID of the resource itself is parsed by the parser of its domain:
  `parseCategoryId` in
  `backend/packages/domain/src/models/service-category.ts`, `parseServiceId`
  in `backend/packages/domain/src/models/service.ts` (`field: 'id'`).
- Once the input is valid, the use case calls `requireSalon`
  (`backend/packages/domain/src/business-logic/_shared/existing-salon.ts`): a
  salon that does not exist, or that has been deleted, is `notFound` (404).
- The repository is given both IDs. A well-formed ID of a resource that is not
  of the salon in the path is `notFound` (404), like one that does not exist.

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

   `numberParameter`, `booleanParameter` and `listParameter` are defined
   once, in `backend/packages/api/src/shared/query-parameters.ts`; the
   decoding schema of every list is built from them.

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
- A list with a permission check answers a query that cannot be decoded
  only after that check: an actor who may not list is told that and nothing
  about the request. The handler of the customer list therefore does not
  answer the error itself. It hands the decoded query on as the `Result` it
  is (`useCase.execute(actor, decodeCustomerSearchQuery(req.query))` in
  `backend/packages/api/src/routes/customer/list-customers.handler.ts`),
  and `ListCustomersUseCase` returns the error once it has decided that the
  actor may list customers.

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

The salon repository orders by `(createdAt, id)` descending, starts after
the row the cursor names, and reads one row more than the limit to learn
whether another page follows:

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

The order belongs to the list. The salon list is newest first, and so is the
customer list, by `(createdAt, id)` descending
(`backend/packages/infrastructure/src/repositories/customer.repository.impl.ts`);
the service categories of a salon are listed in the order a menu shows them, by
`(displayOrder, id)` ascending
(`backend/packages/infrastructure/src/repositories/service-category.repository.impl.ts`),
and so are its services, by `(sortOrder, id)` ascending
(`backend/packages/infrastructure/src/repositories/service.repository.impl.ts`).

A cursor is validated as an ID, so `cursor=offset:20` is a 400. A well-formed
cursor that names no salon yields an empty page. The session list and the
list of service categories answer 400 instead (`field: 'cursor'`, rule
`not_found`), because their cursor has to name an item that is still there;
see [authentication.md](./authentication.md#一覧と無効化) and
[service-menu.md](./service-menu.md) (both Japanese). The list of services
answers 400 in the same way for a cursor that names no service of the salon.
A service that was deleted keeps its row, so a cursor that names one is
accepted and still says where the next page begins. The customer list does
both as well: it answers 400 for a cursor that names no customer, and a
deleted customer still says where the next page begins
([customers.md](./customers.md), Japanese). So does the staff list of a
salon, which is ordered by registration, oldest first
([staff.md](./staff.md), Japanese). The list of staff profiles has the
same order across salons; its cursor may name any staff member, one who
is not shown any more or one the filters leave out included, and only a
cursor that names no staff member is answered with 400. The booking list is
ordered by the time a booking begins, earliest first, and then by ID; a
booking is not soft-deleted, and its cursor has to name a booking the reader
reaches: one of another salon is answered with 400 like an ID that names
none ([bookings.md](./bookings.md), Japanese). The sale list is ordered
the other way, by the time of the sale, latest first, and then by ID
downwards; its cursor is held to the same rule
([sales.md](./sales.md), Japanese). The list of the payment methods of a
salon is ordered by `sortOrder` and then by ID, and its cursor has to name
a payment method of that salon ([payments.md](./payments.md), Japanese).
The schedule of a
staff member is the one list without pages: it has at most 373 entries, the
contract says so (`@maxItems`), and the response is `{ data, meta, links }`
with the whole schedule in `data` and no pagination metadata
([staff.md](./staff.md#勤務スケジュール), Japanese). The
page links are built by
`pageLinks` in `backend/packages/api/src/shared/page-links.ts`, for every
list, from the request URL with the cursor replaced.

## Response formatting

Every successful response with a body is `{ data, meta, links }`.

| Operation | Status | `meta` | `links` | Extra |
|-----------|--------|--------|---------|-------|
| Create | 201 | `responseMeta(req)` | `salonLinks(req.baseUrl, data.id)` | `Location` header set to `links.self` |
| Get, update | 200 | `responseMeta(req)` | `salonLinks(req.baseUrl, data.id)` | |
| List | 200 | Pagination metadata | `pageLinks(...)` | |
| Bulk update (services) | 200 | `responseMeta(req)` | `{ list: req.baseUrl }` | `data.updated` holds the IDs of what was changed |
| Delete | 204 | | | No body |

```typescript
// backend/packages/api/src/shared/responses.ts
export const responseMeta = (req: Pick<Request, 'id'>): ResponseMeta => ({
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
  authenticated: Authenticated,
): RequestHandler<
  { id: string },
  UpdateSalonResponse | ProblemDetails,
  unknown
> => {
  const useCase = new UpdateSalonUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.params.id, req.body)

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
  })
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
| `validation` | `parseWith` in a use case; an authentication use case, also for what a schema cannot check (a password that is too easy to guess, a wrong current password, a mailed token that cannot be used, a code of two-factor authentication that is not accepted, a cursor of the session list that names no session of the user); a service category use case, for a parent that is not a category of the same salon or that is the category itself or one below it, and for a cursor that names no category of the salon; a service use case, for a service that would break a rule tying two of its properties together, for a category that is not of the same salon, for a member of a package that is not a service of the same salon, is a package or is the service itself, for making a package of a service that a package contains, and for a cursor that names no service of the salon; a customer use case, for a birth date before 1900 or in the future, for a referrer who does not exist, is deleted or is the customer itself, and for a cursor that names no customer | 400 | `2001` |
| `unauthenticated` | `AuthenticateUseCase` behind `authenticated`; the login and refresh use cases; the current-user, change-password and two-factor use cases, when the user of the session no longer exists | 401 | `1001` to `1004` and `1007`, by `reason` |
| `forbidden` | A use case, when the actor may not do what is asked | 403 | `1005` |
| `notFound` | A use case, when the repository finds no row; on a route below a salon, that includes a salon that does not exist and a resource that is not of the salon in the path; on the routes of a customer's own profile, an account that has no customer record | 404 | `3001` |
| `alreadyExists` | The repository, from the name of the constraint that a write violated: the unique index on the `email` of a salon; for a customer, the unique index on `email`, which covers the customers that are not deleted, and the unique constraint on `referralCode`, which covers every customer | 409 | `3002` |
| `conflict` | A two-factor use case or the use case of an administrator operation, when the request is fine and the state of the account does not allow it (enabling what is already enabled, or unlocking an account that is not locked, for example); the use case that deletes a service, when a package contains the service; the use case that creates a customer's own profile, when the account has one already, has not confirmed its email address, or the customer with its email address belongs to another account; the use case that creates a booking, when a staff member is occupied at that time or the time zone of the salon is not one the runtime knows; a use case that changes the status of a booking, when the status does not allow the action, when a no-show is noted before the booking has begun, or when the actual end would not be after the actual start the booking has | 409 | `3003` |
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
that an operation can answer is declared on it in TypeSpec: 400, 404 and 409
one by one, 401, 403, 429 and 500 through `PublicErrors`, `SessionErrors` or
`CommonErrors` (see [Authorization](#authorization)), and 413 and 415 through
`RequestBodyErrors` on the operations that take a body.

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
`application/json`. A 401 also carries a `WWW-Authenticate: Bearer` header,
which `sendProblem` takes from `toBearerChallenge` in `problem-details.ts`.

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
- The line of a request that was authenticated carries the ID of the
  signed-in user as `userId`. `authenticated` notes it for the request
  (`noteSignedInUser` in `backend/packages/api/src/shared/signed-in-user.ts`)
  and `requestLogging` reads it when the request completes. The line of a
  request that was not authenticated has no `userId`.
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
- The mailer logs by itself, with the injected `Logger`: a delivery goes on
  after the use case has returned, so its outcome cannot be a returned value.
  `SmtpMailer` (`backend/packages/infrastructure/src/mail/smtp-mailer.ts`)
  writes `Mail delivered` or `Failed to deliver mail` with the subject of the
  message, never its recipient or text.
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
- `now()` is the moment the transaction began, which is before anything the
  transaction waited for. A change that is judged by the clock, or whose
  order is kept (the status of a booking and its history), reads
  `clock_timestamp()` once it holds the row: the outer query reads the clock
  of the row a subquery locks `FOR UPDATE`, and `updatedAt` and the
  `createdAt` of the history are written with `clock_timestamp()` too. Of
  two changes to one booking, the one that waited writes the later time.
- Drizzle reads a `timestamptz` as text. Every read mapper converts it to
  ISO 8601 in UTC with the same schema, which uses date-fns:

  ```typescript
  // backend/packages/domain/src/mappers/read/columns.ts
  export const timestampSchema = z
    .string()
    .transform((value) => parseISO(value))
    .pipe(z.date())
    .transform((value) => value.toISOString())
  ```

- **Calendar dates and times of day** (`date` and `time` columns) stay strings
  from the request to the database: `YYYY-MM-DD` checked with `calendarDate`,
  and `HH:mm` or `HH:mm:ss`. Two times of day are compared as strings once both
  have seconds. The format and the comparison are shared rules (`calendarDate`,
  `timeOfDay` and `withSeconds` in
  `backend/packages/domain/src/schemas/rules.ts`), which the calendar of a
  salon and the schedule of a staff member use.
- **Every date and moment of a request lies from 1900-01-01 to 2999-12-31**,
  a moment by the day it is written on in UTC. An earlier one is refused with
  `too_small`, a later one with `too_big`. `z.iso.date()` and
  `z.iso.datetime()` accept the year 0, which PostgreSQL does not hold, and
  PostgreSQL does not read a moment past the year 9999 as `toISOString`
  writes it; both would answer 500. A day of the range stays within what
  PostgreSQL holds when it is turned into the day of a time zone or into
  the day before or after. A date or a moment that the database reads is
  checked with `calendarDate`, `momentOfRequest` (kept as written) or
  `momentInUtc` (written again as `toISOString` writes it), all in
  `rules.ts`. The rule and what it leaves out are in
  [api-db-type-constraints-mapping.md](./api-db-type-constraints-mapping.md#リクエストの日付と日時の範囲)
  (Japanese).
- Parsing, validity checks and formatting use date-fns (`parseISO`, `isValid`,
  `format`), not hand-written arithmetic:

  ```typescript
  // backend/packages/domain/src/schemas/rules.ts
  export const dayOfWeekOf = (date: string): string | null => {
    const parsed = parseISO(date)
    return isValid(parsed) ? format(parsed, 'EEEE').toLowerCase() : null
  }
  ```

- The `timestamp` of a response or a problem is `new Date().toISOString()`.
- A use case that needs the current time does not call `new Date()`. It takes
  the time from its dependencies: `clock: () => Date` in
  `AuthUseCaseDependencies` and in `CustomerUseCaseDependencies`. `createApp`
  (`backend/packages/api/src/index.ts`) builds one clock and hands it to
  both.
- The two date-times of the customer search, `registeredFrom` and
  `registeredTo`, are compared as times, not as text: as text, the same
  second with and without a fraction would compare the wrong way round.
  `customerSearchRequestSchema`
  (`backend/packages/domain/src/schemas/customer.schema.ts`) parses both
  with `parseISO` before it compares them.
- A date-time filter is compared at the precision a response shows. A
  `timestamptz` column keeps microseconds and a response milliseconds, so
  the customer repository truncates `createdAt` with
  `date_trunc('milliseconds', …)` before it compares it with
  `registeredFrom` and `registeredTo`
  (`backend/packages/infrastructure/src/repositories/customer.repository.impl.ts`).
  Compared as stored, a customer would not be found "until" the very time
  their own response states.

## Authorization

An operation is public only when its contract says so with `@useAuth(NoAuth)`.
Every other operation needs a signed-in user, and the pattern has three parts.
How sessions, tokens and roles work is in
[authentication.md](./authentication.md) (Japanese); this section is only the
pattern.

**1. The route is protected by wrapping its handler.** The router factory
receives `authenticated` and hands it to the handlers that need it:

```typescript
// backend/packages/api/src/routes/salon/index.ts
router.get('/', listSalonsHandler(dependencies))
router.post('/', createSalonHandler(dependencies, authenticated))
router.get('/:id', getSalonHandler(dependencies))
router.patch('/:id', updateSalonHandler(dependencies, authenticated))
router.delete('/:id', deleteSalonHandler(dependencies, authenticated))
```

`authenticated` (`backend/packages/api/src/shared/authentication.ts`) reads
`Authorization: Bearer <access token>`, and calls the wrapped handler with the
`Actor` the token stands for (see the update handler under
[Response formatting](#response-formatting)). Without a token that works, it
answers 401 and the handler does not run. There is no authentication
middleware to forget: a handler that is not wrapped has no actor, so it
cannot call a use case that takes one.

**2. The permission check lives in the use case.** `execute` takes
`actor: Actor` as its first parameter and decides before it validates the
body or reads the database. The rule itself is a pure function in
`business-logic/<domain>/_shared/authorization.ts`:

```typescript
// backend/packages/domain/src/business-logic/salon/_shared/authorization.ts
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
```

```typescript
// backend/packages/domain/src/business-logic/salon/update-salon.usecase.ts
const salonId = parseSalonId(id)
if (salonId.type === 'error') {
  return salonId
}
if (!mayUpdateSalon(actor, salonId.data)) {
  return Result.error(DomainErrors.forbidden())
}
```

- The handler and the middleware never look at a role. They only pass the
  actor on.
- A rule reads `actor.scope` (`ActorScope` in
  `backend/packages/domain/src/models/auth.ts`), not `users.role` or
  `users.permissions`.
- A rule about one resource compares the salon of the actor with the salon of
  the resource. When the ID in the path is enough to decide, as for a salon,
  the check comes right after the ID is parsed.
- On a route below a salon, the salon of the resource is the one in the path,
  and the permission is decided from it alone
  (`mayManageServiceCategories` in
  `backend/packages/domain/src/business-logic/service-category/_shared/authorization.ts`,
  `mayManageServices` in
  `backend/packages/domain/src/business-logic/service/_shared/authorization.ts`).
  A resource that is not of that salon is answered with 404. The rule is
  stated in
  [authentication.md](./authentication.md#サロンの下にあるルートの権限).
- A rule that needs the actor alone is decided first, before the ID, the
  query and the body are looked at, as `mayCreateSalon` is. The customer
  ledger does not belong to a salon and none of its operations is public, so
  each of its use cases begins that way (`mayHandleCustomers` and
  `mayDeleteCustomers` in
  `backend/packages/domain/src/business-logic/customer/_shared/authorization.ts`).
  A user who is not allowed is answered with 403 whatever else is wrong with
  the request, and whether or not the customer exists. The rule is stated in
  [authentication.md](./authentication.md#顧客台帳の権限).
- A rule that needs the actor and a salon that the path does not name is
  decided in two steps. The booking ledger is a salon's, but its routes are
  not below a salon, so each of its use cases first asks which bookings the
  actor reaches (`bookingReachOf` in
  `backend/packages/domain/src/business-logic/booking/_shared/authorization.ts`):
  none is a 403 whatever else is wrong with the request. Once the body or
  the query names a salon, `isWithin` says whether it is within that reach
  (403), and the repository takes the reach as a condition of what it
  reads, so the booking of another salon is not found (404). An operation
  that fewer may call has a reach of its own: the delete of a booking asks
  `bookingRemovalReachOf`, by which the staff of a salon reach no booking
  (403). The rule is
  stated in [authentication.md](./authentication.md#予約台帳の権限).
- A rule that needs the actor and the target, and nothing that is stored, is
  decided once the request is known to be valid and before anything is
  looked up. The staff ledger has one: nobody deactivates or deletes the
  staff member their own account belongs to (`isOwnStaffRecord` in
  `backend/packages/domain/src/business-logic/staff/_shared/authorization.ts`).
  It is not a question of permission, because the actor may do the same to
  any other staff member of the salon, so the answer is `conflict` (409)
  and not `forbidden` ([staff.md](./staff.md#自分自身のスタッフ情報), Japanese).

**3. The error is a `DomainError`.** Nothing in this pattern builds a
response by hand.

| Situation | Error | Response |
|-----------|-------|----------|
| No access token, or one that does not work | `DomainErrors.unauthenticated(reason)`, returned by `AuthenticateUseCase` | 401 with `WWW-Authenticate` |
| Signed in, and not allowed | `DomainErrors.forbidden()`, returned by the use case | 403, code `1005` |

In TypeSpec the operation declares the alias of
`specs/models/_shared/common-api-patterns.tsp` that matches how it is called:

| Operation | Declares |
|-----------|----------|
| Public | `@useAuth(NoAuth)` and `PublicErrors` (429, 500) |
| Any signed-in user may call it | `SessionErrors` (401 and `PublicErrors`) |
| It has a permission check | `CommonErrors` (403 and `SessionErrors`) |

## Checklist for a new endpoint

- [ ] The operation and its models are defined in TypeSpec, and the generated
      files are committed with them (`pnpm generate`)
- [ ] The operation is either public in the contract (`@useAuth(NoAuth)`,
      `PublicErrors`) or declares `SessionErrors` or `CommonErrors`
- [ ] The request has a Zod schema that `satisfies` the generated type
- [ ] The use case takes `unknown`, parses before it uses the input and
      returns `Result<..., DomainError>`
- [ ] The use case of an operation that is not public takes `actor: Actor`
      first, and decides the permission with a function from
      `_shared/authorization.ts` before anything else; a refusal is
      `DomainErrors.forbidden()`
- [ ] The handler of an operation that is not public is wrapped with
      `authenticated`
- [ ] Path IDs go through a branded ID schema
- [ ] An endpoint below a salon parses the salon of the path with
      `parseSalonIdOfPath`, decides the permission from that salon, calls
      `requireSalon`, and gives the salon ID to every repository method
- [ ] The handler is a factory over its dependencies, takes its response types
      from `operations`, validates nothing, and ends in
      `match(result)...exhaustive()` with `responseMeta` and `sendProblem`
- [ ] A list uses `cursor` and `limit` and returns `meta.nextCursor`
- [ ] Nothing throws, and nothing writes to `console`
- [ ] The endpoint has integration tests with at least five error scenarios
      (see [testing-requirements.md](./testing-requirements.md)); for an
      operation that is not public they include a request without a token
      (401) and one from a user who is not allowed (403)
