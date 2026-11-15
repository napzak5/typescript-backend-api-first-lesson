# API Route Modular Structure Guide

This guide describes how the HTTP layer, `backend/packages/api`, is organised: one handler file per endpoint, one router per domain, and the helpers and middleware they share. Salon is the pattern for the next domain; the authentication routes (`routes/auth/`, `routes/admin-auth/`) follow it too, and so do the routes of the service categories (`routes/service-category/`), of the services (`routes/service/`) and of the staff ledger (`routes/staff/`), which are mounted below a salon, and the routes of the customer ledger (`routes/customer/`). No route of the two ledgers is public. The routes of the staff schedules (`routes/staff-schedule/`) are mounted one level further down, below a staff member of a salon, and none of them is public either. The routes of the staff invitations (`routes/staff-invitation/`) are of two kinds and have two routers: three below a staff member of a salon, for whoever invites, and three under `/auth/staff-invitation`, for whoever holds the mailed token: two public ones, and one for an account that signs in to join. The routes of the staff accounts (`routes/staff-account/`) are mounted below a staff member of a salon as well, and none of them is public. The routes of the staff profiles (`routes/staff-profile/`) are mostly the opposite: the list and the get are public, and the two of a staff member's own profile (`/me`) need a signed-in user.

The layers below the API (models, validation, mappers, repository, use cases) are described in the [Domain Implementation Reference](./domain-implementation-reference.md).

## Directory Structure

```
backend/packages/api/src/
├── index.ts                        # createApp: middleware order, repositories, clock, authenticated, routers
├── settings.ts                     # AppSettings: proxy hops, CORS, rate limit, origin of the web application
├── middleware/
│   ├── request-logging.ts          # req.id, req.log, X-Request-Id, one log line per request
│   ├── rate-limiting.ts            # limit per client address
│   └── errors.ts                   # requireJsonBody, notFoundHandler, errorHandler
├── shared/
│   ├── api-version.ts              # API_VERSION, API_BASE_PATH, SYSTEM_BASE_PATH
│   ├── authentication.ts           # createAuthenticated: the wrapper for handlers that need a signed-in user
│   ├── never-stored.ts             # neverStored: Cache-Control: no-store for routes whose responses no cache may keep
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
│   ├── customer/
│   │   ├── _shared/
│   │   │   ├── types.ts            # CustomerParams, and the response body types
│   │   │   ├── links.ts            # customerLinks, customerProfileLinks
│   │   │   ├── query.ts            # decodeCustomerSearchQuery
│   │   │   └── index.ts            # re-exports the three files above
│   │   ├── list-customers.handler.ts             # GET    /api/v1/customers
│   │   ├── create-customer.handler.ts            # POST   /api/v1/customers
│   │   ├── get-customer-profile.handler.ts       # GET    /api/v1/customers/me
│   │   ├── create-customer-profile.handler.ts    # POST   /api/v1/customers/me
│   │   ├── update-customer-profile.handler.ts    # PATCH  /api/v1/customers/me
│   │   ├── get-customer.handler.ts               # GET    /api/v1/customers/:id
│   │   ├── update-customer.handler.ts            # PATCH  /api/v1/customers/:id
│   │   ├── delete-customer.handler.ts            # DELETE /api/v1/customers/:id
│   │   └── index.ts                              # createCustomerRouter
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
│   ├── staff/
│   │   ├── _shared/
│   │   │   ├── types.ts            # StaffParams, and the response body types
│   │   │   ├── links.ts            # staffLinks
│   │   │   ├── query.ts            # decodeStaffSearchQuery
│   │   │   └── index.ts            # re-exports the three files above
│   │   ├── list-staff.handler.ts                 # GET    /api/v1/salons/:salonId/staff
│   │   ├── create-staff.handler.ts               # POST   /api/v1/salons/:salonId/staff
│   │   ├── get-staff.handler.ts                  # GET    /api/v1/salons/:salonId/staff/:id
│   │   ├── update-staff.handler.ts               # PATCH  /api/v1/salons/:salonId/staff/:id
│   │   ├── delete-staff.handler.ts               # DELETE /api/v1/salons/:salonId/staff/:id
│   │   └── index.ts                              # createStaffRouter
│   ├── staff-account/
│   │   ├── _shared/
│   │   │   ├── types.ts            # StaffAccountParams, and the response body types
│   │   │   ├── links.ts            # staffAccountLinks
│   │   │   └── index.ts            # re-exports the two files above
│   │   ├── get-staff-account.handler.ts          # GET    /api/v1/salons/:salonId/staff/:id/account
│   │   ├── update-staff-account.handler.ts       # PATCH  /api/v1/salons/:salonId/staff/:id/account
│   │   ├── delete-staff-account.handler.ts       # DELETE /api/v1/salons/:salonId/staff/:id/account
│   │   └── index.ts                              # createStaffAccountRouter
│   ├── staff-invitation/
│   │   ├── _shared/
│   │   │   ├── types.ts            # StaffInvitationParams, and the response body types
│   │   │   ├── links.ts            # staffInvitationLinks
│   │   │   └── index.ts            # re-exports the two files above
│   │   ├── get-staff-invitation.handler.ts       # GET    /api/v1/salons/:salonId/staff/:id/invitation
│   │   ├── create-staff-invitation.handler.ts    # POST   /api/v1/salons/:salonId/staff/:id/invitation
│   │   ├── delete-staff-invitation.handler.ts    # DELETE /api/v1/salons/:salonId/staff/:id/invitation
│   │   ├── verify-staff-invitation.handler.ts    # POST   /api/v1/auth/staff-invitation/verify
│   │   ├── accept-staff-invitation.handler.ts    # POST   /api/v1/auth/staff-invitation/accept
│   │   ├── join-staff-invitation.handler.ts      # POST   /api/v1/auth/staff-invitation/join
│   │   └── index.ts                              # createStaffInvitationRouter, createStaffInvitationAcceptanceRouter
│   ├── staff-schedule/
│   │   ├── _shared/
│   │   │   ├── types.ts            # StaffScheduleParams, and the response body types
│   │   │   ├── links.ts            # staffScheduleLinks
│   │   │   └── index.ts            # re-exports the two files above
│   │   ├── list-staff-schedules.handler.ts       # GET    /api/v1/salons/:salonId/staff/:id/schedules
│   │   ├── update-staff-schedules.handler.ts     # PUT    /api/v1/salons/:salonId/staff/:id/schedules
│   │   └── index.ts                              # createStaffScheduleRouter
│   ├── staff-profile/
│   │   ├── _shared/
│   │   │   ├── types.ts            # StaffProfileParams, and the response body types
│   │   │   ├── links.ts            # staffProfileLinks, ownStaffProfileLinks
│   │   │   ├── query.ts            # decodeStaffProfileSearchQuery
│   │   │   └── index.ts            # re-exports the three files above
│   │   ├── list-staff-profiles.handler.ts        # GET    /api/v1/staff-profiles
│   │   ├── get-own-staff-profile.handler.ts      # GET    /api/v1/staff-profiles/me
│   │   ├── update-own-staff-profile.handler.ts   # PATCH  /api/v1/staff-profiles/me
│   │   ├── get-staff-profile.handler.ts          # GET    /api/v1/staff-profiles/:id
│   │   └── index.ts                              # createStaffProfileRouter
│   └── system/
│       └── index.ts                # GET /api/system/alive, /api/system/ready, /api/system/health
└── __tests__/                      # integration tests and their helpers (see Tests)
```

There is one handler per operation of the `SalonCrud` interface in `specs/operations/salon-operations.tsp`, and no other salon route. Filtering is part of the list operation; there is no separate search endpoint. Each operation in `specs/operations/auth-operations.tsp` has a handler in the same way: those of the interfaces `AuthCrud` and `SessionCrud` in `routes/auth/` (but for the three of `AuthCrud` that verify, accept and join the invitation of a staff member, which are in `routes/staff-invitation/`), and those of `AdminAuthCrud`, which the contract puts under a path of its own (`/api/v1/admin/auth`), in `routes/admin-auth/`. The five operations of `ServiceCategoryCrud` in `specs/operations/service-operations.tsp` have theirs in `routes/service-category/`, and the six operations of `ServiceCrud` in the same file have theirs in `routes/service/`. Of the 18 operations of `CustomerCrud` in `specs/operations/customer-operations.tsp`, the five that are implemented (list, create, get, update, delete) have theirs in `routes/customer/`; the other 13 have no handler. The three operations of `CustomerProfile` in the same file (get, create, update of a customer's own profile) have theirs in `routes/customer/` as well, in the files named `*-customer-profile.handler.ts`. The five operations of `StaffCrud` in `specs/operations/staff-operations.tsp` (list, create, get, update, delete of the ledger) have theirs in `routes/staff/`, and the two operations of `StaffSchedules` in the same file (list and update of the schedule of a staff member) have theirs in `routes/staff-schedule/`. The three operations of `StaffInvitations` in the same file (get, create and delete of the invitation of a staff member) have theirs in `routes/staff-invitation/`, next to the three operations of `AuthCrud` by which the invited person reads, accepts and joins the invitation: the six are one feature with one set of use cases, so they share a directory, and the two kinds of callers get a router each. The three operations of `StaffAccounts` in the same file (get, update and delete of the account of a staff member) have theirs in `routes/staff-account/`. The two operations of `StaffProfile` in the same file (list and get of what customers are shown of a staff member) have theirs in `routes/staff-profile/`, and so have the two of `StaffOwnProfile` (get and update of a staff member's own profile), whose files are named `*-own-staff-profile.handler.ts`.

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

The five handlers in `routes/customer/` are those of the table above with one difference: none is public. All five are wrapped with `authenticated` and pass the `actor` first; the get handler, for example, passes `actor` and `req.params.id`. The answers are the same. What the list handler passes next to the `actor` is described under [Query parameters](#query-parameters). The three handlers of a customer's own profile have no `:id`: the get handler passes the `actor` alone, the create and the update handler the `actor` and `req.body`, and the use case finds the record through the actor. A created profile is answered with 201 and a `Location` header like any created resource; its location is `/api/v1/customers/me`, for whichever customer.

The five handlers in `routes/staff/` have both properties: their routes are below a salon, like those of the service categories, and none is public, like those of the customer ledger. All five are wrapped with `authenticated` and pass the `actor`, then `req.params.salonId`, then the ID of the staff member where the route has one: the update handler, for example, passes `actor`, `req.params.salonId`, `req.params.id` and `req.body`. The answers are those of the table above.

The two handlers in `routes/staff-schedule/` are wrapped as well, and both have the salon and the staff member in their path and no ID of their own. The list handler (`GET /`) passes `actor`, `req.params.salonId`, `req.params.id` and `req.query`; the update handler (`PUT /`) passes `req.body` in the place of the query. Both answer 200 with `{ data, meta, links }`, where `data` is the array of the entries of the schedule: the update replaces the whole schedule and answers with what it stored.

Four of the six handlers in `routes/staff-invitation/` are wrapped. Three are those of whoever invites: get, create and delete pass `actor`, `req.params.salonId` and `req.params.id`, and the create `req.body` as well. The create answers 201 with a `Location` header: the address of the invitation is the mount path (`req.baseUrl`), because a staff member holds one invitation at most. The fourth is join: an account that exists joins an invitation signed in, so the handler passes `actor` and `req.body`, which carries the mailed token, and answers 204. The other two, verify and accept, are not wrapped. Whoever was invited has no account yet, so they pass `req.body` and nothing else. Verify answers 200 with the invitation and one link, `accept` or `join`: the route next to it (below `req.baseUrl`) that takes the token. Accept answers 204.

The three handlers in `routes/staff-account/` are wrapped: get, update and delete pass `actor`, `req.params.salonId` and `req.params.id`, and the update `req.body` as well. Get and update answer 200 with the account, delete 204.

Two of the four handlers in `routes/staff-profile/` are the two public rows of the table: neither is wrapped, the list handler passes the decoded query and the get handler `req.params.id`, and both answer 200 with `{ data, meta, links }`. A request with an access token is answered like one without: the token is not looked at. The other two, those of a staff member's own profile, are wrapped and have no `:id`, like those of a customer's own profile: the get handler passes the `actor` alone, the update handler the `actor` and `req.body`, and the use case finds the staff member through the actor. Both answer 200 with the profile.

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
- `numberParameter`, `booleanParameter` and `listParameter` are the converters of `shared/query-parameters.ts`, which every list uses. The session list decodes its `limit` with the same `numberParameter` (`decodeSessionSearchQuery` in `routes/auth/_shared/query.ts`), and the list of service categories and the list of services their `limit` and `isActive` (`decodeServiceCategorySearchQuery` in `routes/service-category/_shared/query.ts`, `decodeServiceSearchQuery` in `routes/service/_shared/query.ts`). The customer list decodes its `limit` and its `tags` (`decodeCustomerSearchQuery` in `routes/customer/_shared/query.ts`), and the staff list its `limit` (`decodeStaffSearchQuery` in `routes/staff/_shared/query.ts`), as does the list of staff profiles (`decodeStaffProfileSearchQuery` in `routes/staff-profile/_shared/query.ts`), whose filters are text.

The salon list is public, so its handler answers a query that cannot be decoded itself. The customer list is not public, and a user who may not list customers is told that and nothing about the request. Its handler therefore passes the outcome of the decoding on as it is, and the use case, which takes the decoded query as a `Result`, returns a decoding error only after it has decided the permission (`routes/customer/list-customers.handler.ts`):

```typescript
  return authenticated(async (actor, req, res) => {
    // A query that cannot be decoded is the use case's to answer: it says
    // so only to an actor who may list customers.
    const result = await useCase.execute(
      actor,
      decodeCustomerSearchQuery(req.query),
    )
```

The staff list is not public either, and its handler does the same: it passes `actor`, `req.params.salonId` and the outcome of `decodeStaffSearchQuery` (`routes/staff/list-staff.handler.ts`).

The list of staff profiles is public, like the salon list, and its handler answers a query that cannot be decoded itself (`routes/staff-profile/list-staff-profiles.handler.ts`).

The list of the schedule of a staff member has no `query.ts`. Its one parameter, `date`, is text, so nothing has to be converted: the handler passes `req.query` as it is, and the use case checks it with the strict schema of the request, after the permission (`routes/staff-schedule/list-staff-schedules.handler.ts`).

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

`JsonBody` (`shared/operation-types.ts`) picks the `application/json` body out of the `content` of a generated response; `routes/auth/_shared/types.ts`, `routes/admin-auth/_shared/types.ts`, `routes/service-category/_shared/types.ts`, `routes/service/_shared/types.ts`, `routes/customer/_shared/types.ts`, `routes/staff/_shared/types.ts`, `routes/staff-account/_shared/types.ts`, `routes/staff-invitation/_shared/types.ts`, `routes/staff-schedule/_shared/types.ts` and `routes/staff-profile/_shared/types.ts` use it in the same way. Only response bodies are needed: request bodies are `unknown`, and the delete operation answers without a body. Nothing is declared by hand, so after `pnpm generate` a handler that no longer matches the contract stops compiling.

### Links

The `links` of a response are built from the mount path:

- `salonLinks(collectionPath, id)` in `routes/salon/_shared/links.ts` returns `{ self, list }` for one salon. `serviceCategoryLinks(collectionPath, id)` in `routes/service-category/_shared/links.ts` returns the same for one category, `serviceLinks(collectionPath, id)` in `routes/service/_shared/links.ts` for one service, and `staffLinks(collectionPath, id)` in `routes/staff/_shared/links.ts` for one staff member; their `collectionPath` names the salon, because the mount path does. `customerLinks(collectionPath, id)` in `routes/customer/_shared/links.ts` returns `{ self, list }` for one customer, and `customerProfileLinks(collectionPath)` in the same file `{ self }` for a customer's own profile, which has one address and no list. `staffProfileLinks(collectionPath, id)` in `routes/staff-profile/_shared/links.ts` returns `{ self, list }` for the profile of one staff member; its `collectionPath` names no salon, because the profiles are not mounted below one. `ownStaffProfileLinks(collectionPath, id)` in the same file returns `{ self, profile }` for a staff member's own profile: `self` is `/me` below the collection, and `profile` is the address at which customers read the same profile. `staffScheduleLinks(schedulePath, requestUrl)` in `routes/staff-schedule/_shared/links.ts` returns `{ self, list }` for the schedule of one staff member: `list` is the mount path, which names the salon and the staff member, and `self` is the same path with the query of the request, so the answer for one date links to itself; it reads the query with `queryOf` of `shared/page-links.ts`. `staffInvitationLinks(invitationPath)` in `routes/staff-invitation/_shared/links.ts` returns `{ self, staff }` for the invitation of one staff member: `self` is the mount path, and `staff` the same path without its last segment, which is the staff member in the ledger; an invitation has no list. `staffAccountLinks(accountPath)` in `routes/staff-account/_shared/links.ts` returns `{ self, staff }` for the account of one staff member in the same way. `userLinks(basePath, id)` in `routes/admin-auth/_shared/links.ts` returns `{ self }` for a user as an administrator reaches it.
- `pageLinks(collectionPath, requestUrl, meta)` in `shared/page-links.ts` returns the links of a page: the request's own query string with `cursor` replaced. Pages are only walked forwards, so `prev` and `last` are always `null`. The salon list, the list of service categories, the list of services, the customer list, the staff list and the session list use it.

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

`routes/auth/index.ts` exports `createAuthRouter(dependencies, authenticated)` in the same way. It additionally sets `Cache-Control: no-store` on every response of its routes, because they carry tokens or the data of one user (`neverStored` in `shared/never-stored.ts`). `routes/admin-auth/index.ts` exports `createAdminAuthRouter(dependencies, authenticated)`, which sets the same header for the same reason: its responses carry the data of one user.

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

`routes/customer/index.ts` exports `createCustomerRouter(dependencies, authenticated)` with the same five routes as the salon router, and the three of a customer's own profile. A customer belongs to no salon, so the router is mounted at `/customers` and is a plain `Router()`; its handlers with an `:id` declare `CustomerParams` (`routes/customer/_shared/types.ts`). No operation of the customer ledger or of the profile is public, so every handler receives `authenticated`. The routes of `/me` are registered before those of `/:id`, which would take `me` for an ID otherwise:

```typescript
  router.get('/', listCustomersHandler(dependencies, authenticated))
  router.post('/', createCustomerHandler(dependencies, authenticated))
  router.get('/me', getCustomerProfileHandler(dependencies, authenticated))
  router.post('/me', createCustomerProfileHandler(dependencies, authenticated))
  router.patch(
    '/me',
    updateCustomerProfileHandler(dependencies, authenticated),
  )
  router.get('/:id', getCustomerHandler(dependencies, authenticated))
  router.patch('/:id', updateCustomerHandler(dependencies, authenticated))
  router.delete('/:id', deleteCustomerHandler(dependencies, authenticated))
```

`routes/staff/index.ts` exports `createStaffRouter(dependencies, authenticated)` with the same five routes as the salon router. It is mounted below a salon (`/salons/:salonId/staff`) and created with `Router({ mergeParams: true })`, like the routers of the service categories and of the services; its handlers declare `SalonParams`, or `StaffParams` (`routes/staff/_shared/types.ts`) for the routes with an `:id`. No operation of the staff ledger is public, so every handler receives `authenticated`, as in the customer router.

`routes/staff-schedule/index.ts` exports `createStaffScheduleRouter(dependencies, authenticated)` with two routes, `GET /` and `PUT /`. It is mounted below a staff member of a salon (`/salons/:salonId/staff/:id/schedules`) and created with `Router({ mergeParams: true })`, so its handlers see both parameters of the mount path and declare `StaffScheduleParams` (`routes/staff-schedule/_shared/types.ts`). The schedule is one resource per staff member, read and replaced as a whole, so the router has no route with an ID of its own. Express matches the router of the staff ledger first, because it is mounted at a prefix of this path; that router has no route for `/:id/schedules`, so the request passes on to this one.

`routes/staff-invitation/index.ts` exports two factories, because its routes have two kinds of callers. `createStaffInvitationRouter(dependencies, authenticated)` has three routes, `GET /`, `POST /` and `DELETE /`, is mounted below a staff member of a salon (`/salons/:salonId/staff/:id/invitation`) and created with `Router({ mergeParams: true })`, like the router of the schedules; its handlers declare `StaffInvitationParams` (`routes/staff-invitation/_shared/types.ts`). `createStaffInvitationAcceptanceRouter(dependencies, authenticated)` has three routes, `POST /verify`, `POST /accept` and `POST /join`, and is a plain `Router()` mounted at `/auth/staff-invitation`. Only the handler of `/join` is given `authenticated`; the other two are public, like the routes of the staff profiles. The router sets `Cache-Control: no-store` with `neverStored`, like the authentication router: the answers tell what a mailed token gives access to. Express matches the authentication router first, because it is mounted at a prefix of this path; that router has no route below `/staff-invitation`, so the request passes on to this one. The header is on the response by then, because the authentication router sets it for every path below `/auth`; this router sets it as well, so that its answers do not depend on which of the two is mounted first.

`routes/staff-account/index.ts` exports `createStaffAccountRouter(dependencies, authenticated)` with three routes, `GET /`, `PATCH /` and `DELETE /`. It is mounted below a staff member of a salon (`/salons/:salonId/staff/:id/account`) and created with `Router({ mergeParams: true })`, like the routers of the schedules and of the invitations; its handlers declare `StaffAccountParams` (`routes/staff-account/_shared/types.ts`). A staff member has one account at most, so the router has no route with an ID of its own.

`routes/staff-profile/index.ts` exports `createStaffProfileRouter(dependencies, authenticated)` with four routes, `GET /`, `GET /me`, `PATCH /me` and `GET /:id`. Only the two handlers of `/me` are given `authenticated`; the list and the get are public. The routes of `/me` are registered before `/:id`, as in the customer router. It is a plain `Router()` mounted at `/staff-profiles`: the profiles go across salons, and the salon is a filter of the list.

### Mounting in `createApp`

`src/index.ts` is where repositories, the clock and `authenticated` are constructed and routers are mounted. `createApp` is given the database, the logger, the mailer, the authenticator of two-factor authentication and the settings (`AppDependencies`):

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

  const clock = (): Date => new Date()

  const authDependencies: AuthUseCaseDependencies = {
    userRepository: new UserRepository(database),
    sessionRepository: new SessionRepository(database),
    passwordHasher: new Argon2PasswordHasher(),
    tokenIssuer: new RandomTokenIssuer(),
    twoFactorAuthenticator,
    mailer,
    publicAppUrl: settings.publicAppUrl,
    clock,
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
  const staffInvitationDependencies: StaffInvitationUseCaseDependencies = {
    staffInvitationRepository: new StaffInvitationRepository(database),
    salonRepository,
    passwordHasher: authDependencies.passwordHasher,
    tokenIssuer: authDependencies.tokenIssuer,
    mailer,
    publicAppUrl: settings.publicAppUrl,
    clock,
  }
  app.use(
    `${API_BASE_PATH}/auth/staff-invitation`,
    createStaffInvitationAcceptanceRouter(
      staffInvitationDependencies,
      authenticated,
    ),
  )
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
  app.use(
    `${API_BASE_PATH}/salons/:salonId/staff`,
    createStaffRouter(
      { staffRepository: new StaffRepository(database), salonRepository },
      authenticated,
    ),
  )
  app.use(
    `${API_BASE_PATH}/salons/:salonId/staff/:id/invitation`,
    createStaffInvitationRouter(staffInvitationDependencies, authenticated),
  )
  app.use(
    `${API_BASE_PATH}/salons/:salonId/staff/:id/account`,
    createStaffAccountRouter(
      {
        staffAccountRepository: new StaffAccountRepository(database),
        salonRepository,
      },
      authenticated,
    ),
  )
  app.use(
    `${API_BASE_PATH}/salons/:salonId/staff/:id/schedules`,
    createStaffScheduleRouter(
      {
        staffScheduleRepository: new StaffScheduleRepository(database),
        salonRepository,
      },
      authenticated,
    ),
  )

  app.use(
    `${API_BASE_PATH}/staff-profiles`,
    createStaffProfileRouter(
      { staffProfileRepository: new StaffProfileRepository(database) },
      authenticated,
    ),
  )
  app.use(
    `${API_BASE_PATH}/customers`,
    createCustomerRouter(
      { customerRepository: new CustomerRepository(database), clock },
      authenticated,
    ),
  )

  app.use(notFoundHandler)
  app.use(errorHandler)
```

The order matters. Every request gets its ID and logger first. The probes are answered before the rate limit, so monitoring is never throttled. The body is parsed before the domain routers. The two handlers at the end turn whatever is left over into problem details. The router of a new domain is mounted next to the salon router, and receives the same `authenticated` if any of its operations is not public. The router of what belongs to a salon is mounted below the salon, with the parameter in the mount path, as the routers of the service categories, of the services and of the staff ledger are. It is given the salon repository of the salon router next to its own, because its use cases ask whether the salon exists. The router of what belongs to a record of a salon is mounted below that record in the same way: the router of the staff schedules has both parameters in its mount path (`/salons/:salonId/staff/:id/schedules`), and so have the routers of the staff invitations (`/salons/:salonId/staff/:id/invitation`) and of the staff accounts (`/salons/:salonId/staff/:id/account`). The two routers of the staff invitations are given one object of dependencies, which takes the password hasher, the token issuer, the mailer and the clock from those of the authentication: an invitation is a mailed token, and accepting it stores a password. The one for whoever holds a token receives `authenticated` too, for its one route that needs a signed-in user. The router of the staff accounts needs none of that: it is given its repository and the salon repository. The router of the staff profiles is mounted at `/staff-profiles` and receives `authenticated` for the two routes of a staff member's own profile; its list and its get are public. The router of the customer ledger is mounted at `/customers`, because a customer belongs to no salon. The use cases that write a customer need the current time, so the router is given the `clock` that the authentication use cases have: `createApp` builds one and hands it to both.

## Shared Helpers

`src/shared/` holds what every domain's routes use.

- `responses.ts`
  - `responseMeta(req)` returns the `meta` of a successful response: `correlationId` (the request ID), `timestamp` and `version`.
  - `sendProblem(req, res, error)` sends an `ApiError` as problem details with the matching status, and a 401 with its `WWW-Authenticate` header. It logs the cause of a `database` error through `req.log`, because that cause never reaches the response.
- `problem-details.ts` defines `HttpError` (what goes wrong in the HTTP layer itself), `ApiError = DomainError | HttpError` and the mapping below. The mapping is an exhaustive match, so a new kind of error does not compile until it has a status. `toBearerChallenge(error)` returns the `WWW-Authenticate` value of an `unauthenticated` error and `null` for every other one.
- `authentication.ts` exports `createAuthenticated(dependencies)`, which `createApp` calls once, and the type `Authenticated`. The wrapper runs `AuthenticateUseCase` on `req.headers.authorization` and either calls the handler with the actor or sends the error with `sendProblem`. Before it calls the handler, it notes the user ID of the actor for the request log (`noteSignedInUser`).
- `signed-in-user.ts` keeps, for as long as a request lives, which user it was authenticated as: `noteSignedInUser(req, userId)` writes it and `signedInUserOf(req)` reads it, `undefined` for a request that was not authenticated. The request logging reads it (see [Middleware](#middleware)).
- `page-links.ts` holds `pageLinks`, the links of a page of any list, and `queryOf`, the query of a request URL, for the links that repeat it (see [Links](#links)).
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
| `__tests__/_shared/` | `setup.ts` and `test-databases.ts` (a database for every test, copied from a template that has the schema), `test-helpers.ts` (`createTestApp`, which calls the production `createApp` with a mailer that records the mails instead of sending them and with the real `TotpAuthenticator`), `auth-helpers.ts` (inserting users and signing in) |

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
- [ ] The handler of a list that only some users may read passes the outcome of decoding the query to the use case as it is (`routes/customer/list-customers.handler.ts`), so that a query that cannot be decoded is answered only after the permission is decided
- [ ] `routes/<domain>/index.ts`: `create<Domain>Router(dependencies, authenticated)` with paths relative to the mount point (without `authenticated` only if every operation is public)
- [ ] Mount the router in `createApp` under `API_BASE_PATH`, constructing the repository there and passing the `authenticated` that already exists
- [ ] For a resource that belongs to a salon (`routes/service-category/` is the example): mount the router at `${API_BASE_PATH}/salons/:salonId/<resources>` and pass it the salon repository that exists; create it with `Router({ mergeParams: true })`; declare `salonId` in the path parameters of every handler and pass `req.params.salonId` to the use case
- [ ] A route whose path is a fixed segment where other routes have a parameter (`/bulk` next to `/:id` in `routes/service/index.ts`) is registered before them
- [ ] `__tests__/<domain>.integration.test.ts`: every endpoint, with at least five error scenarios each; for an operation that is not public, a request without a token (401) and one from a user who is not allowed (403) are among them
- [ ] `make ci-check` passes (it includes `pnpm typecheck`, `pnpm knip`, `pnpm test` and `pnpm test:integration`)
