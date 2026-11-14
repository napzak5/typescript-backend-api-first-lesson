# API Route Modular Structure Guide

This guide describes how the HTTP layer, `backend/packages/api`, is organised: one handler file per endpoint, one router per domain, and the helpers and middleware they share. Salon is the only domain with routes today and is the pattern for the next one.

The layers below the API (models, validation, mappers, repository, use cases) are described in the [Domain Implementation Reference](./domain-implementation-reference.md).

## Directory Structure

```
backend/packages/api/src/
├── index.ts                        # createApp: middleware order, repositories, routers
├── settings.ts                     # AppSettings: proxy hops, CORS, rate limit
├── middleware/
│   ├── request-logging.ts          # req.id, req.log, X-Request-Id, one log line per request
│   ├── rate-limiting.ts            # limit per client address
│   └── errors.ts                   # requireJsonBody, notFoundHandler, errorHandler
├── shared/
│   ├── api-version.ts              # API_VERSION, API_BASE_PATH, SYSTEM_BASE_PATH
│   ├── problem-details.ts          # DomainError | HttpError → problem details
│   └── responses.ts                # responseMeta, sendProblem
├── routes/
│   ├── salon/
│   │   ├── _shared/
│   │   │   ├── types.ts            # response body types, taken from the generated operations
│   │   │   ├── links.ts            # salonLinks, salonPageLinks
│   │   │   ├── query.ts            # decodeSalonSearchQuery
│   │   │   └── index.ts            # re-exports the three files above
│   │   ├── list-salons.handler.ts  # GET    /api/v1/salons
│   │   ├── create-salon.handler.ts # POST   /api/v1/salons
│   │   ├── get-salon.handler.ts    # GET    /api/v1/salons/:id
│   │   ├── update-salon.handler.ts # PATCH  /api/v1/salons/:id
│   │   ├── delete-salon.handler.ts # DELETE /api/v1/salons/:id
│   │   └── index.ts                # createSalonRouter
│   └── system/
│       └── index.ts                # GET /api/system/alive, /api/system/ready, /api/system/health
└── __tests__/                      # integration tests and their helpers (see Tests)
```

There is one handler per operation of the `SalonCrud` interface in `specs/operations/salon-operations.tsp`, and no other route. Filtering is part of the list operation; there is no separate search endpoint.

## Key Principles

1. **One endpoint, one file.** `<action>-<domain>.handler.ts` holds the handler of one operation. `index.ts` maps routes to handlers and is the only file that names paths.
2. **A handler is created from its dependencies.** Each file exports a factory that takes `SalonUseCaseDependencies` and returns the Express handler. A handler reads nothing from a global, from the `app` object or from the environment.
3. **A handler translates; it does not decide.** It hands the raw input to a use case and turns the `Result` into a response. Validation, business rules and "not found" belong to the use case.
4. **Types come from the contract.** Response body types are taken from the generated `operations`, so a response that does not match the OpenAPI document does not compile.
5. **Every error response is problem details** (RFC 9457), produced by one function, `sendProblem`.

## Implementation Pattern

### Handler

The whole of `routes/salon/create-salon.handler.ts`:

```typescript
import {
  CreateSalonUseCase,
  type SalonUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type CreateSalonResponse, salonLinks } from './_shared'

/**
 * POST /api/v1/salons - create a salon
 */
export const createSalonHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  CreateSalonResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateSalonUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = salonLinks(req.baseUrl, data.id)
        res
          .status(201)
          .location(links.self)
          .json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
```

What to notice:

- **Factory.** The use case is constructed once, when the router is built, not on every request.
- **`RequestHandler` type arguments** are the path parameters, the response body and the request body. The request body is `unknown`: nothing has checked it yet, and the use case is what checks it. Handlers with an `:id` declare `{ id: string }` and pass `req.params.id` on unchecked in the same way.
- **The handler has no error handling of its own.** A failure the application expects is a `Result` and goes through `sendProblem`. A promise that rejects unexpectedly is forwarded by Express 5 to `errorHandler`, which answers 500.
- **`.exhaustive()`** makes both branches of the `Result` mandatory.
- **`req.baseUrl`** is the path the router is mounted on (`/api/v1/salons`), so the links never repeat it as a literal.
- **`res.json(...)`** is checked against `CreateSalonResponse | ProblemDetails`.

The five handlers differ only in what they pass on and what they answer:

| File | Route | Passed to the use case | Success |
|------|-------|------------------------|---------|
| `list-salons.handler.ts` | `GET /` | the decoded query (below) | 200, `{ data, meta, links }` with pagination `meta` and `links` |
| `create-salon.handler.ts` | `POST /` | `req.body` | 201, `Location` header, `{ data, meta, links }` |
| `get-salon.handler.ts` | `GET /:id` | `req.params.id` | 200, `{ data, meta, links }` |
| `update-salon.handler.ts` | `PATCH /:id` | `req.params.id`, `req.body` | 200, `{ data, meta, links }` |
| `delete-salon.handler.ts` | `DELETE /:id` | `req.params.id` | 204, no body |

### Query parameters

A query string carries text only, so the list handler gives the parameters their types before the use case sees them (`routes/salon/list-salons.handler.ts`):

```typescript
  return async (req, res) => {
    const query = decodeSalonSearchQuery(req.query)
    const result =
      query.type === 'error' ? query : await useCase.execute(query.data)
```

`routes/salon/_shared/query.ts`:

```typescript
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

- Decoding changes the representation and nothing else: `limit=10` becomes the number 10, `isActive=false` the boolean, `features=color` the list `['color']`. Which values are allowed is decided by the use case.
- The object is loose on purpose. A parameter the API does not define (`page=2`) is passed on, and the strict schema of the use case rejects it by name, so the list of parameters exists in one place.
- The result is still `unknown`. A parameter that cannot be decoded (`limit=ten`) is a `validation` error and is answered like every other one.

### Response types

The whole of `routes/salon/_shared/types.ts`:

```typescript
import type { operations } from '@beauty-salon-backend/generated'

type JsonBody<Content> = Content extends { 'application/json': infer Body }
  ? Body
  : never

export type ListSalonsResponse = JsonBody<
  operations['SalonCrud_list']['responses'][200]['content']
>
export type CreateSalonResponse = JsonBody<
  operations['SalonCrud_create']['responses'][201]['content']
>
export type GetSalonResponse = JsonBody<
  operations['SalonCrud_get']['responses'][200]['content']
>
export type UpdateSalonResponse = JsonBody<
  operations['SalonCrud_update']['responses'][200]['content']
>
```

Only response bodies are needed: request bodies are `unknown`, and the delete operation answers without a body. Nothing is declared by hand, so after `pnpm generate` a handler that no longer matches the contract stops compiling.

### Links

`routes/salon/_shared/links.ts` builds the `links` of a response from the mount path:

- `salonLinks(collectionPath, id)` returns `{ self, list }` for one salon.
- `salonPageLinks(collectionPath, requestUrl, meta)` returns the links of a page: the request's own query string with `cursor` replaced. Pages are only walked forwards, so `prev` and `last` are always `null`.

### Router

`routes/salon/index.ts`:

```typescript
export const createSalonRouter = (
  dependencies: SalonUseCaseDependencies,
): Router => {
  const router = Router()

  router.get('/', listSalonsHandler(dependencies))
  router.post('/', createSalonHandler(dependencies))
  router.get('/:id', getSalonHandler(dependencies))
  router.patch('/:id', updateSalonHandler(dependencies))
  router.delete('/:id', deleteSalonHandler(dependencies))

  return router
}
```

Paths are relative to where the router is mounted, and the router is a function of its dependencies, like the handlers.

### Mounting in `createApp`

`src/index.ts` is where repositories are constructed and routers are mounted:

```typescript
  app.use(requestLogging(logger))
  app.use(helmet())
  app.use(
    cors({
      origin: settings.cors.origins,
      credentials: settings.cors.credentials,
      maxAge: settings.cors.maxAgeSeconds,
    }),
  )

  app.use(SYSTEM_BASE_PATH, createSystemRouter({ database }))

  app.use(rateLimiting(settings.rateLimit))
  app.use(compression())
  app.use(requireJsonBody)
  app.use(express.json({ limit: BODY_LIMIT_BYTES }))

  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter({ salonRepository: new SalonRepository(database) }),
  )

  app.use(notFoundHandler)
  app.use(errorHandler)
```

The order matters. Every request gets its ID and logger first. The probes are answered before the rate limit, so monitoring is never throttled. The body is parsed before the domain routers. The two handlers at the end turn whatever is left over into problem details. The router of a new domain is mounted next to the salon router.

## Shared Helpers

`src/shared/` holds what every domain's routes use.

- `responses.ts`
  - `responseMeta(req)` returns the `meta` of a successful response: `correlationId` (the request ID), `timestamp` and `version`.
  - `sendProblem(req, res, error)` sends an `ApiError` as problem details with the matching status. It logs the cause of a `database` error through `req.log`, because that cause never reaches the response.
- `problem-details.ts` defines `HttpError` (what goes wrong in the HTTP layer itself), `ApiError = DomainError | HttpError` and the mapping below. The mapping is an exhaustive match, so a new kind of error does not compile until it has a status.
- `api-version.ts` holds `API_VERSION` (`v1`), `API_BASE_PATH` (`/api/v1`) and `SYSTEM_BASE_PATH` (`/api/system`).

| Error | Status | `code` | `type` (after `urn:beauty-salon:problem:`) |
|-------|--------|--------|---------------------------------------------|
| `validation` | 400 | `2001` | `validation` |
| `notFound` | 404 | `3001` | `not-found` |
| `alreadyExists` | 409 | `3002` | `already-exists` |
| `database` | 500 | `4003` | `database` |
| `routeNotFound` | 404 | `3001` | `route-not-found` |
| `malformedBody` | 400 | `2002` | `malformed-body` |
| `unsupportedMediaType` | 415 | `2002` | `unsupported-media-type` |
| `bodyTooLarge` | 413 | `2004` | `body-too-large` |
| `badRequest` | 400 | `2002` | `bad-request` |
| `rateLimited` | 429 | `4005` | `rate-limited` |
| `unexpected` | 500 | `4001` | `internal` |

The first four are the `DomainError` kinds a use case returns; the rest are `HttpError`. A `validation` problem lists the broken rules in `errors`. In the two 500 responses `detail` is `null`, so nothing about the failure leaves the server.

## Middleware

`src/middleware/`, in the order `createApp` installs it:

- `request-logging.ts`: `requestLogging(logger)` assigns `req.id` (the caller's `X-Request-Id` when it is safe to log, otherwise a new UUID), returns it in the `X-Request-Id` response header and gives the request `req.log`. It writes one line per completed request, without headers or bodies, and none for the probes.
- `rate-limiting.ts`: `rateLimiting({ windowMs, maxRequests })` limits the requests of one client address. The counts are kept in the memory of the process. A request over the limit is answered as a `rateLimited` problem.
- `errors.ts`:
  - `requireJsonBody` answers 415 when a request declares a body that is not JSON.
  - `notFoundHandler` answers every request no route took.
  - `errorHandler` is last. `toHttpError` tells the client mistakes the body parser reports from defects of the server, and only a defect is logged with its stack.

## System Routes

`routes/system/index.ts` exports `createSystemRouter({ database })` with `GET /api/system/alive`, `GET /api/system/ready` and `GET /api/system/health`. The three handlers are in one file and share `probeDatabase`. They are mounted before the rate limit and are not written to the request log.

## Tests

| File (under `backend/packages/api/src/`) | What it covers |
|------------------------------------------|----------------|
| `routes/salon/_shared/__tests__/links.test.ts`, `query.test.ts` | link building and query decoding |
| `shared/__tests__/problem-details.test.ts` | the error mapping |
| `middleware/__tests__/middleware.test.ts` | the middleware |
| `__tests__/salon.integration.test.ts` | every salon endpoint against PostgreSQL |
| `__tests__/app.integration.test.ts` | request IDs, unreadable requests, a failing database, CORS, rate limit, probes, response headers |
| `__tests__/_shared/` | `setup.ts` (database, one schema per test), `test-helpers.ts` (`createTestApp`, which calls the production `createApp`), `test-schema-manager.ts` |

```bash
pnpm --filter @beauty-salon-backend/api test              # unit tests
pnpm --filter @beauty-salon-backend/api test:integration  # uses TEST_DATABASE_URL, otherwise testcontainers (Docker)
```

How the tests are written is described in the [API Testing Guide](./api-testing-guide.md).

## Implementation Checklist

For the routes of a new domain, with `<domain>` as its name. The operations must already be defined in TypeSpec and the use cases must exist.

- [ ] `routes/<domain>/_shared/types.ts`: response body types taken from the generated `operations`
- [ ] `routes/<domain>/_shared/links.ts`, and `query.ts` if an operation has query parameters, each with unit tests
- [ ] One `<action>-<domain>.handler.ts` per operation: a factory over the dependencies that passes the raw input to the use case and matches the `Result` exhaustively
- [ ] `routes/<domain>/index.ts`: `create<Domain>Router(dependencies)` with paths relative to the mount point
- [ ] Mount the router in `createApp` under `API_BASE_PATH`, constructing the repository there
- [ ] `__tests__/<domain>.integration.test.ts`: every endpoint, with at least five error scenarios each
- [ ] `make ci-check` passes (it includes `pnpm typecheck`, `pnpm knip`, `pnpm test` and `pnpm test:integration`)
