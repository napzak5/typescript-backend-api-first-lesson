# API Route Modular Structure Guide

This guide describes how the HTTP layer, `backend/packages/api`, is organised: one handler file per endpoint, one router per domain, and the helpers and middleware they share. Salon is the pattern for the next domain; the authentication routes (`routes/auth/`, `routes/admin-auth/`) follow it too, and so do the routes of the service categories (`routes/service-category/`) and of the services (`routes/service/`), which are mounted below a salon.

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
│   ├── operation-types.ts          # JsonBody: the JSON body of a generated response; SalonParams: the salon of a route below a salon
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
│   ├── service/
│   │   ├── _shared/
│   │   │   ├── types.ts            # ServiceParams, and the response body types
│   │   │   ├── links.ts            # serviceLinks
│   │   │   ├── query.ts            # decodeServiceSearchQuery
│   │   │   └── index.ts            # re-exports the three files above
│   │   ├── list-services.handler.ts              # GET    /api/v1/salons/:salonId/services
│   │   ├── create-service.handler.ts             # POST   /api/v1/salons/:salonId/services
│   │   ├── bulk-update-services.handler.ts       # PATCH  /api/v1/salons/:salonId/services/bulk
│   │   ├── get-service.handler.ts                # GET    /api/v1/salons/:salonId/services/:id
│   │   ├── update-service.handler.ts             # PATCH  /api/v1/salons/:salonId/services/:id
│   │   ├── delete-service.handler.ts             # DELETE /api/v1/salons/:salonId/services/:id
│   │   └── index.ts                              # createServiceRouter
│   ├── service-category/
│   │   ├── _shared/
│   │   │   ├── types.ts            # ServiceCategoryParams, and the response body types
│   │   │   ├── links.ts            # serviceCategoryLinks
│   │   │   ├── query.ts            # decodeServiceCategorySearchQuery
│   │   │   └── index.ts            # re-exports the three files above
│   │   ├── list-service-categories.handler.ts    # GET    /api/v1/salons/:salonId/service-categories
│   │   ├── create-service-category.handler.ts    # POST   /api/v1/salons/:salonId/service-categories
│   │   ├── get-service-category.handler.ts       # GET    /api/v1/salons/:salonId/service-categories/:id
│   │   ├── update-service-category.handler.ts    # PATCH  /api/v1/salons/:salonId/service-categories/:id
│   │   ├── delete-service-category.handler.ts    # DELETE /api/v1/salons/:salonId/service-categories/:id
│   │   └── index.ts                              # createServiceCategoryRouter
│   └── system/
│       └── index.ts                # GET /api/system/alive, /api/system/ready, /api/system/health
└── __tests__/                      # integration tests and their helpers (see Tests)
```

There is one handler per operation of the `SalonCrud` interface in `specs/operations/salon-operations.tsp`, and no other salon route. Filtering is part of the list operation; there is no separate search endpoint. Each operation in `specs/operations/auth-operations.tsp` has a handler in the same way: those of the interfaces `AuthCrud` and `SessionCrud` in `routes/auth/`, and those of `AdminAuthCrud`, which the contract puts under a path of its own (`/api/v1/admin/auth`), in `routes/admin-auth/`. The five operations of `ServiceCategoryCrud` in `specs/operations/service-operations.tsp` have theirs in `routes/service-category/`, and the six operations of `ServiceCrud` in the same file have theirs in `routes/service/`.

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

The five handlers in `routes/service-category/` are those of the table above for a resource below a salon: the same two are public, the same three are wrapped, and the answers are the same. Each passes `req.params.salonId` as well, before the ID of the category: the update handler, for example, passes `actor`, `req.params.salonId`, `req.params.id` and `req.body`. Where that parameter comes from is described under [Router](#router).

The six handlers in `routes/service/` are the same five for the services of a salon, and one more. `bulk-update-services.handler.ts` (`PATCH /bulk`) is wrapped, passes `actor`, `req.params.salonId` and `req.body`, and answers 200 with `{ data, meta, links }`: `data.updated` lists the IDs of the services that were changed, and `links` holds `list` only.

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
- `numberParameter`, `booleanParameter` and `listParameter` are the converters of `shared/query-parameters.ts`, which every list uses. The session list decodes its `limit` with the same `numberParameter` (`decodeSessionSearchQuery` in `routes/auth/_shared/query.ts`), and the list of service categories and the list of services their `limit` and `isActive` (`decodeServiceCategorySearchQuery` in `routes/service-category/_shared/query.ts`, `decodeServiceSearchQuery` in `routes/service/_shared/query.ts`).

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

`JsonBody` (`shared/operation-types.ts`) picks the `application/json` body out of the `content` of a generated response; `routes/auth/_shared/types.ts`, `routes/admin-auth/_shared/types.ts`, `routes/service-category/_shared/types.ts` and `routes/service/_shared/types.ts` use it in the same way. Only response bodies are needed: request bodies are `unknown`, and the delete operation answers without a body. Nothing is declared by hand, so after `pnpm generate` a handler that no longer matches the contract stops compiling.

### Links

The `links` of a response are built from the mount path:

- `salonLinks(collectionPath, id)` in `routes/salon/_shared/links.ts` returns `{ self, list }` for one salon. `serviceCategoryLinks(collectionPath, id)` in `routes/service-category/_shared/links.ts` returns the same for one category, and `serviceLinks(collectionPath, id)` in `routes/service/_shared/links.ts` for one service; their `collectionPath` names the salon, because the mount path does. `userLinks(basePath, id)` in `routes/admin-auth/_shared/links.ts` returns `{ self }` for a user as an administrator reaches it.
- `pageLinks(collectionPath, requestUrl, meta)` in `shared/page-links.ts` returns the links of a page: the request's own query string with `cursor` replaced. Pages are only walked forwards, so `prev` and `last` are always `null`. The salon list, the list of service categories, the list of services and the session list use it.

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

`routes/service-category/index.ts` exports `createServiceCategoryRouter(dependencies, authenticated)` with the same five routes as the salon router. It is mounted below a salon (`/salons/:salonId/service-categories`), so `:salonId` is a parameter of the mount path, and a router does not see the parameters of its mount path unless it is created to:

```typescript
  const router = Router({ mergeParams: true })
```

The handlers declare the parameter in their path parameters (`SalonParams` in `shared/operation-types.ts`, which the routers below a salon share, and `ServiceCategoryParams` in `routes/service-category/_shared/types.ts` for the routes with an `:id`) and pass `req.params.salonId` to the use case unchecked, like every other path parameter. `req.baseUrl` is the mount path with the ID of the salon in it, so the links name the salon without the handler writing a path.

`routes/service/index.ts` exports `createServiceRouter(dependencies, authenticated)`, which is mounted below a salon in the same way (`/salons/:salonId/services`); its handlers declare `SalonParams`, or `ServiceParams` (`routes/service/_shared/types.ts`) for the routes with an `:id`. It has a sixth route, the bulk update, whose path is a fixed segment where the routes of one service have an ID:

```typescript
  router.patch('/bulk', bulkUpdateServicesHandler(dependencies, authenticated))
  router.get('/:id', getServiceHandler(dependencies))
  router.patch('/:id', updateServiceHandler(dependencies, authenticated))
```

Express tries the routes in the order in which they were registered, so `/bulk` is registered before `/:id`, which would otherwise take `bulk` for the ID of a service.

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
  const salonRepository = new SalonRepository(database)
  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter({ salonRepository }, authenticated),
  )
  app.use(
    `${API_BASE_PATH}/salons/:salonId/service-categories`,
    createServiceCategoryRouter(
      {
        serviceCategoryRepository: new ServiceCategoryRepository(database),
        salonRepository,
      },
      authenticated,
    ),
  )
  app.use(
    `${API_BASE_PATH}/salons/:salonId/services`,
    createServiceRouter(
      { serviceRepository: new ServiceRepository(database), salonRepository },
      authenticated,
    ),
  )

  app.use(notFoundHandler)
  app.use(errorHandler)
```

The order matters. Every request gets its ID and logger first. The probes are answered before the rate limit, so monitoring is never throttled. The body is parsed before the domain routers. The two handlers at the end turn whatever is left over into problem details. The router of a new domain is mounted next to the salon router, and receives the same `authenticated` if any of its operations is not public. The router of what belongs to a salon is mounted below the salon, with the parameter in the mount path, as the routers of the service categories and of the services are. It is given the salon repository of the salon router next to its own, because its use cases ask whether the salon exists.

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
| `routes/service-category/_shared/__tests__/links.test.ts`, `query.test.ts` | the links of a service category and query decoding |
| `routes/service/_shared/__tests__/links.test.ts`, `query.test.ts` | the links of a service and query decoding |
| `shared/__tests__/` | the error mapping, the links of a page, the converters of query parameters, the signed-in user of a request |
| `middleware/__tests__/middleware.test.ts` | the middleware |
| `__tests__/salon.integration.test.ts` | every salon endpoint against PostgreSQL, including who may call it |
| `__tests__/service-category.integration.test.ts` | every service category endpoint: the salon of the path, who may call it, the rules on the parent, requests that arrive at the same time |
| `__tests__/service.integration.test.ts` | every service endpoint: the salon of the path, who may call it, options and packages, the bulk update, requests that arrive at the same time; `ServiceRepository` called directly, and what the constraints of the two tables refuse |
| `__tests__/auth.integration.test.ts` | signing in, the tokens, what the server does with an access token, and the seeded accounts |
| `__tests__/auth-registration.integration.test.ts`, `auth-sessions.integration.test.ts`, `auth-two-factor.integration.test.ts`, `admin-auth.integration.test.ts` | the other authentication endpoints: registration, email verification and passwords; the sessions of the signed-in user; two-factor authentication; what an administrator does to accounts |
| `__tests__/app.integration.test.ts` | request IDs, unreadable requests, a failing database, CORS, rate limit, probes, response headers |
| `__tests__/_shared/` | `setup.ts` and `test-databases.ts` (a database for every test, copied from a template that has the schema), `test-helpers.ts` (`createTestApp`, which calls the production `createApp` with a mailer that records the mails instead of sending them and with the real `TotpAuthenticator`), `auth-helpers.ts` (inserting users and signing in), `test-schema-manager.ts` |

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
- [ ] For a resource that belongs to a salon (`routes/service-category/` is the example): mount the router at `${API_BASE_PATH}/salons/:salonId/<resources>` and pass it the salon repository that exists; create it with `Router({ mergeParams: true })`; declare `salonId` in the path parameters of every handler and pass `req.params.salonId` to the use case
- [ ] A route whose path is a fixed segment where other routes have a parameter (`/bulk` next to `/:id` in `routes/service/index.ts`) is registered before them
- [ ] `__tests__/<domain>.integration.test.ts`: every endpoint, with at least five error scenarios each; for an operation that is not public, a request without a token (401) and one from a user who is not allowed (403) are among them
- [ ] `make ci-check` passes (it includes `pnpm typecheck`, `pnpm knip`, `pnpm test` and `pnpm test:integration`)
