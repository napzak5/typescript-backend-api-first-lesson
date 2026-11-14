# API Route Modular Structure Guide

This guide describes how the HTTP layer, `backend/packages/api`, is organised: one handler file per endpoint, one router per domain, and the helpers and middleware they share. Salon is the pattern for the next domain; the authentication routes (`routes/auth/`, `routes/admin-auth/`) follow it too.

The layers below the API (models, validation, mappers, repository, use cases) are described in the [Domain Implementation Reference](./domain-implementation-reference.md).

## Directory Structure

```
backend/packages/api/src/
├── index.ts                        # createApp: middleware order, repositories, authenticated, routers
├── settings.ts                     # AppSettings: proxy hops, CORS, rate limit, origin of the web application
├── middleware/
│   ├── request-logging.ts          # req.id, req.log, X-Request-Id, one log line per request
│   ├── rate-limiting.ts            # limit per client address
│   └── errors.ts                   # requireJsonBody, notFoundHandler, errorHandler
├── shared/
│   ├── api-version.ts              # API_VERSION, API_BASE_PATH, SYSTEM_BASE_PATH
│   ├── authentication.ts           # createAuthenticated: the wrapper for handlers that need a signed-in user
│   ├── operation-types.ts          # JsonBody: the JSON body of a generated response
│   ├── page-links.ts               # pageLinks: the links of a page of a list
│   ├── problem-details.ts          # DomainError | HttpError → problem details, toBearerChallenge
│   ├── query-parameters.ts         # numberParameter, booleanParameter, listParameter
│   ├── responses.ts                # responseMeta, sendProblem
│   └── signed-in-user.ts           # noteSignedInUser, signedInUserOf: the user a request was authenticated as
├── routes/
│   ├── admin-auth/
│   │   ├── _shared/
│   │   │   ├── types.ts            # response body types, taken from the generated operations
│   │   │   └── links.ts            # userLinks
│   │   ├── get-user.handler.ts                   # GET  /api/v1/admin/auth/users/:userId
│   │   ├── unlock-account.handler.ts             # POST /api/v1/admin/auth/unlock/:userId
│   │   ├── reset-two-factor.handler.ts           # POST /api/v1/admin/auth/reset-two-factor/:userId
│   │   └── index.ts                              # createAdminAuthRouter
│   ├── auth/
│   │   ├── _shared/
│   │   │   ├── types.ts            # response body types, taken from the generated operations
│   │   │   └── query.ts            # decodeSessionSearchQuery
│   │   ├── register.handler.ts                   # POST /api/v1/auth/register
│   │   ├── login.handler.ts                      # POST /api/v1/auth/login
│   │   ├── refresh-token.handler.ts              # POST /api/v1/auth/refresh
│   │   ├── logout.handler.ts                     # POST /api/v1/auth/logout
│   │   ├── logout-all.handler.ts                 # POST /api/v1/auth/logout-all
│   │   ├── get-current-user.handler.ts           # GET  /api/v1/auth/me
│   │   ├── send-email-verification.handler.ts    # POST /api/v1/auth/verify-email/send
│   │   ├── confirm-email-verification.handler.ts # POST /api/v1/auth/verify-email/confirm
│   │   ├── forgot-password.handler.ts            # POST /api/v1/auth/forgot-password
│   │   ├── verify-reset-token.handler.ts         # POST /api/v1/auth/reset-password/verify
│   │   ├── reset-password.handler.ts             # POST /api/v1/auth/reset-password
│   │   ├── change-password.handler.ts            # POST /api/v1/auth/change-password
│   │   ├── enable-two-factor.handler.ts          # POST /api/v1/auth/2fa/enable
│   │   ├── verify-two-factor.handler.ts          # POST /api/v1/auth/2fa/verify
│   │   ├── disable-two-factor.handler.ts         # POST /api/v1/auth/2fa/disable
│   │   ├── generate-backup-codes.handler.ts      # POST /api/v1/auth/2fa/backup-codes
│   │   ├── list-sessions.handler.ts              # GET  /api/v1/auth/sessions
│   │   ├── revoke-session.handler.ts             # DELETE /api/v1/auth/sessions/:sessionId
│   │   └── index.ts                              # createAuthRouter
│   ├── salon/
│   │   ├── _shared/
│   │   │   ├── types.ts            # response body types, taken from the generated operations
│   │   │   ├── links.ts            # salonLinks
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

There is one handler per operation of the `SalonCrud` interface in `specs/operations/salon-operations.tsp`, and no other salon route. Filtering is part of the list operation; there is no separate search endpoint. Each operation in `specs/operations/auth-operations.tsp` has a handler in the same way: those of the interfaces `AuthCrud` and `SessionCrud` in `routes/auth/`, and those of `AdminAuthCrud`, which the contract puts under a path of its own (`/api/v1/admin/auth`), in `routes/admin-auth/`.

## Key Principles

1. **One endpoint, one file.** `<action>-<domain>.handler.ts` holds the handler of one operation. `index.ts` maps routes to handlers and is the only file that names paths.
2. **A handler is created from its dependencies.** Each file exports a factory that takes `SalonUseCaseDependencies` and returns the Express handler. A handler reads nothing from a global, from the `app` object or from the environment.
3. **A handler translates; it does not decide.** It hands the raw input to a use case and turns the `Result` into a response. Validation, business rules, permissions and "not found" belong to the use case.
4. **A handler that needs a signed-in user is wrapped.** Its factory also takes `authenticated` and returns `authenticated(async (actor, req, res) => …)`. The wrapper answers 401 without a valid access token; the handler passes the actor on and never looks at a role. See [Authentication and Authorization](./authentication.md) (Japanese).
5. **Types come from the contract.** Response body types are taken from the generated `operations`, so a response that does not match the OpenAPI document does not compile.
6. **Every error response is problem details** (RFC 9457), produced by one function, `sendProblem`.

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
import type { Authenticated } from '../../shared/authentication'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import { type CreateSalonResponse, salonLinks } from './_shared'

/**
 * POST /api/v1/salons - create a salon (administrators)
 */
export const createSalonHandler = (
  dependencies: SalonUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,
  CreateSalonResponse | ProblemDetails,
  unknown
> => {
  const useCase = new CreateSalonUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

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
  })
}
```

What to notice:

- **Factory.** The use case is constructed once, when the router is built, not on every request.
- **`authenticated`.** Creating a salon needs a signed-in user, so the handler is wrapped. `authenticated` reads the `Authorization` header and calls the handler with the `Actor` of the access token, or answers 401 and does not call it. Only a wrapped handler has an actor, so a handler that was not wrapped cannot call `CreateSalonUseCase.execute`. That the actor must be an administrator is decided by the use case, not here. The handlers of the public operations (list, get) are plain `async (req, res) => …` functions and take no `authenticated`.
- **`RequestHandler` type arguments** are the path parameters, the response body and the request body. The request body is `unknown`: nothing has checked it yet, and the use case is what checks it. Handlers with an `:id` declare `{ id: string }` and pass `req.params.id` on unchecked in the same way.
- **The handler has no error handling of its own.** A failure the application expects is a `Result` and goes through `sendProblem`. A promise that rejects unexpectedly is forwarded by Express 5 to `errorHandler`, which answers 500.
- **`.exhaustive()`** makes both branches of the `Result` mandatory.
- **`req.baseUrl`** is the path the router is mounted on (`/api/v1/salons`), so the links never repeat it as a literal.
- **`res.json(...)`** is checked against `CreateSalonResponse | ProblemDetails`.

The five handlers differ only in what they pass on and what they answer:

| File | Route | Wrapped with `authenticated` | Passed to the use case | Success |
|------|-------|------------------------------|------------------------|---------|
| `list-salons.handler.ts` | `GET /` | No (public) | the decoded query (below) | 200, `{ data, meta, links }` with pagination `meta` and `links` |
| `create-salon.handler.ts` | `POST /` | Yes | `actor`, `req.body` | 201, `Location` header, `{ data, meta, links }` |
| `get-salon.handler.ts` | `GET /:id` | No (public) | `req.params.id` | 200, `{ data, meta, links }` |
| `update-salon.handler.ts` | `PATCH /:id` | Yes | `actor`, `req.params.id`, `req.body` | 200, `{ data, meta, links }` |
| `delete-salon.handler.ts` | `DELETE /:id` | Yes | `actor`, `req.params.id` | 204, no body |

The authentication handlers in `routes/auth/` have the same shape. `login.handler.ts` and `refresh-token.handler.ts` are not wrapped (they are how a client gets a token), and neither are the handlers of registration, email verification and password reset, which a signed-out user calls; `logout.handler.ts`, `logout-all.handler.ts` and `get-current-user.handler.ts` are wrapped and pass only the `actor`, and `change-password.handler.ts` and the four handlers of two-factor authentication are wrapped and pass the `actor` and `req.body`. `list-sessions.handler.ts` is wrapped and passes the `actor` and the decoded query, `revoke-session.handler.ts` the `actor` and `req.params.sessionId`. The handlers of login, refresh, the current user, `enable-two-factor.handler.ts`, `generate-backup-codes.handler.ts` and `list-sessions.handler.ts` answer 200 with a body; every other one answers 204 without a body.

The three handlers in `routes/admin-auth/` are wrapped as well. Each passes the `actor` and `req.params.userId` and answers 200 with the user as `{ data, meta, links }`; that the actor must be an administrator is decided by the use case.

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
- `numberParameter`, `booleanParameter` and `listParameter` are the converters of `shared/query-parameters.ts`, which every list uses. The session list decodes its `limit` with the same `numberParameter` (`decodeSessionSearchQuery` in `routes/auth/_shared/query.ts`).

### Response types

The whole of `routes/salon/_shared/types.ts`:

```typescript
import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

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

`JsonBody` (`shared/operation-types.ts`) picks the `application/json` body out of the `content` of a generated response; `routes/auth/_shared/types.ts` and `routes/admin-auth/_shared/types.ts` use it in the same way. Only response bodies are needed: request bodies are `unknown`, and the delete operation answers without a body. Nothing is declared by hand, so after `pnpm generate` a handler that no longer matches the contract stops compiling.

### Links

The `links` of a response are built from the mount path:

- `salonLinks(collectionPath, id)` in `routes/salon/_shared/links.ts` returns `{ self, list }` for one salon. `userLinks(basePath, id)` in `routes/admin-auth/_shared/links.ts` returns `{ self }` for a user as an administrator reaches it.
- `pageLinks(collectionPath, requestUrl, meta)` in `shared/page-links.ts` returns the links of a page: the request's own query string with `cursor` replaced. Pages are only walked forwards, so `prev` and `last` are always `null`. The salon list and the session list both use it.

### Router

`routes/salon/index.ts`:

```typescript
export const createSalonRouter = (
  dependencies: SalonUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listSalonsHandler(dependencies))
  router.post('/', createSalonHandler(dependencies, authenticated))
  router.get('/:id', getSalonHandler(dependencies))
  router.patch('/:id', updateSalonHandler(dependencies, authenticated))
  router.delete('/:id', deleteSalonHandler(dependencies, authenticated))

  return router
}
```

Paths are relative to where the router is mounted, and the router is a function of its dependencies, like the handlers. The router is also where one sees which routes are protected: the handlers that receive `authenticated`.

`routes/auth/index.ts` exports `createAuthRouter(dependencies, authenticated)` in the same way. It additionally sets `Cache-Control: no-store` on every response of its routes, because they carry tokens or the data of one user. `routes/admin-auth/index.ts` exports `createAdminAuthRouter(dependencies, authenticated)`, which sets the same header for the same reason: its responses carry the data of one user.

### Mounting in `createApp`

`src/index.ts` is where repositories and `authenticated` are constructed and routers are mounted. `createApp` is given the database, the logger, the mailer, the authenticator of two-factor authentication and the settings (`AppDependencies`):

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

  const authDependencies: AuthUseCaseDependencies = {
    userRepository: new UserRepository(database),
    sessionRepository: new SessionRepository(database),
    passwordHasher: new Argon2PasswordHasher(),
    tokenIssuer: new RandomTokenIssuer(),
    twoFactorAuthenticator,
    mailer,
    publicAppUrl: settings.publicAppUrl,
    clock: () => new Date(),
  }
  const authenticated = createAuthenticated(authDependencies)

  app.use(
    `${API_BASE_PATH}/auth`,
    createAuthRouter(authDependencies, authenticated),
  )
  app.use(
    `${API_BASE_PATH}/admin/auth`,
    createAdminAuthRouter(authDependencies, authenticated),
  )
  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter(
      { salonRepository: new SalonRepository(database) },
      authenticated,
    ),
  )

  app.use(notFoundHandler)
  app.use(errorHandler)
```

The order matters. Every request gets its ID and logger first. The probes are answered before the rate limit, so monitoring is never throttled. The body is parsed before the domain routers. The two handlers at the end turn whatever is left over into problem details. The router of a new domain is mounted next to the salon router, and receives the same `authenticated` if any of its operations is not public.

## Shared Helpers

`src/shared/` holds what every domain's routes use.

- `responses.ts`
  - `responseMeta(req)` returns the `meta` of a successful response: `correlationId` (the request ID), `timestamp` and `version`.
  - `sendProblem(req, res, error)` sends an `ApiError` as problem details with the matching status, and a 401 with its `WWW-Authenticate` header. It logs the cause of a `database` error through `req.log`, because that cause never reaches the response.
- `problem-details.ts` defines `HttpError` (what goes wrong in the HTTP layer itself), `ApiError = DomainError | HttpError` and the mapping below. The mapping is an exhaustive match, so a new kind of error does not compile until it has a status. `toBearerChallenge(error)` returns the `WWW-Authenticate` value of an `unauthenticated` error and `null` for every other one.
- `authentication.ts` exports `createAuthenticated(dependencies)`, which `createApp` calls once, and the type `Authenticated`. The wrapper runs `AuthenticateUseCase` on `req.headers.authorization` and either calls the handler with the actor or sends the error with `sendProblem`. Before it calls the handler, it notes the user ID of the actor for the request log (`noteSignedInUser`).
- `signed-in-user.ts` keeps, for as long as a request lives, which user it was authenticated as: `noteSignedInUser(req, userId)` writes it and `signedInUserOf(req)` reads it, `undefined` for a request that was not authenticated. The request logging reads it (see [Middleware](#middleware)).
- `page-links.ts` holds `pageLinks`, the links of a page of any list (see [Links](#links)).
- `query-parameters.ts` holds `numberParameter`, `booleanParameter` and `listParameter`, from which a domain's `_shared/query.ts` builds the schema that decodes its query string (see [Query parameters](#query-parameters)).
- `operation-types.ts` holds `JsonBody` (see [Response types](#response-types)).
- `api-version.ts` holds `API_VERSION` (`v1`), `API_BASE_PATH` (`/api/v1`) and `SYSTEM_BASE_PATH` (`/api/system`).

| Error | Status | `code` | `type` (after `urn:beauty-salon:problem:`) |
|-------|--------|--------|---------------------------------------------|
| `validation` | 400 | `2001` | `validation` |
| `unauthenticated`, reason `missingCredentials` | 401 | `1001` | `authentication-required` |
| `unauthenticated`, reason `invalidCredentials` | 401 | `1002` | `invalid-credentials` |
| `unauthenticated`, reason `expiredToken` | 401 | `1003` | `token-expired` |
| `unauthenticated`, reason `invalidToken` | 401 | `1004` | `invalid-token` |
| `unauthenticated`, reason `twoFactorRequired` | 401 | `1007` | `two-factor-required` |
| `forbidden` | 403 | `1005` | `forbidden` |
| `notFound` | 404 | `3001` | `not-found` |
| `alreadyExists` | 409 | `3002` | `already-exists` |
| `conflict` | 409 | `3003` | `operation-not-allowed` |
| `database` | 500 | `4003` | `database` |
| `routeNotFound` | 404 | `3001` | `route-not-found` |
| `malformedBody` | 400 | `2002` | `malformed-body` |
| `unsupportedMediaType` | 415 | `2002` | `unsupported-media-type` |
| `bodyTooLarge` | 413 | `2004` | `body-too-large` |
| `badRequest` | 400 | `2002` | `bad-request` |
| `rateLimited` | 429 | `4005` | `rate-limited` |
| `unexpected` | 500 | `4001` | `internal` |

The rows down to `database` are the seven `DomainError` kinds a use case returns (`unauthenticated` has one row per `reason`); the rest are `HttpError`. A `validation` problem lists the broken rules in `errors`. In the two 500 responses `detail` is `null`, so nothing about the failure leaves the server. When each 401 is returned is in [Authentication and Authorization](./authentication.md).

## Middleware

`src/middleware/`, in the order `createApp` installs it:

- `request-logging.ts`: `requestLogging(logger)` assigns `req.id` (the caller's `X-Request-Id` when it is safe to log, otherwise a new UUID), returns it in the `X-Request-Id` response header and gives the request `req.log`. It writes one line per completed request, without headers or bodies, and none for the probes. The line of a request that `authenticated` let through carries the ID of the signed-in user as `userId` (read with `signedInUserOf` when the request completes); the line of any other request has no `userId`.
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
| `routes/salon/_shared/__tests__/links.test.ts`, `query.test.ts` | the links of a salon and query decoding |
| `shared/__tests__/` | the error mapping, the links of a page, the converters of query parameters, the signed-in user of a request |
| `middleware/__tests__/middleware.test.ts` | the middleware |
| `__tests__/salon.integration.test.ts` | every salon endpoint against PostgreSQL, including who may call it |
| `__tests__/auth.integration.test.ts` | the authentication endpoints, what the server does with an access token, and the seeded accounts |
| `__tests__/app.integration.test.ts` | request IDs, unreadable requests, a failing database, CORS, rate limit, probes, response headers |
| `__tests__/_shared/` | `setup.ts` (database, one schema per test), `test-helpers.ts` (`createTestApp`, which calls the production `createApp` with a mailer that records the mails instead of sending them and with the real `TotpAuthenticator`), `auth-helpers.ts` (inserting users and signing in), `test-schema-manager.ts` |

```bash
pnpm --filter @beauty-salon-backend/api test              # unit tests
pnpm --filter @beauty-salon-backend/api test:integration  # uses TEST_DATABASE_URL, otherwise testcontainers (Docker)
```

How the tests are written is described in the [API Testing Guide](./api-testing-guide.md).

## Implementation Checklist

For the routes of a new domain, with `<domain>` as its name. The operations must already be defined in TypeSpec and the use cases must exist.

- [ ] `routes/<domain>/_shared/types.ts`: response body types taken from the generated `operations`
- [ ] `routes/<domain>/_shared/links.ts` for the links of one resource, and `query.ts` if an operation has query parameters, each with unit tests. The links of a page come from `pageLinks` (`shared/page-links.ts`), and `query.ts` builds its schema from the converters of `shared/query-parameters.ts`; neither is written again
- [ ] One `<action>-<domain>.handler.ts` per operation: a factory over the dependencies that passes the raw input to the use case and matches the `Result` exhaustively
- [ ] The handler of every operation that is not `@useAuth(NoAuth)` in the contract takes `authenticated`, is wrapped with it and passes the `actor` to the use case
- [ ] `routes/<domain>/index.ts`: `create<Domain>Router(dependencies, authenticated)` with paths relative to the mount point (without `authenticated` only if every operation is public)
- [ ] Mount the router in `createApp` under `API_BASE_PATH`, constructing the repository there and passing the `authenticated` that already exists
- [ ] `__tests__/<domain>.integration.test.ts`: every endpoint, with at least five error scenarios each; for an operation that is not public, a request without a token (401) and one from a user who is not allowed (403) are among them
- [ ] `make ci-check` passes (it includes `pnpm typecheck`, `pnpm knip`, `pnpm test` and `pnpm test:integration`)
