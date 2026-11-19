# Testing Requirements

What must be tested in this repository, and to what standard. How to write an
API integration test with the helpers that exist here is in the
[API Testing Guide](./api-testing-guide.md).

The Salon domain is the reference implementation, and its tests are the
reference for the tests of every domain that follows.

## Kinds of Tests

| Kind | Command | Files | Needs |
|------|---------|-------|-------|
| Unit | `pnpm test` | `*.test.ts` and `*.test.tsx`, in a `__tests__` directory or beside the module | Nothing |
| Integration | `pnpm test:integration` | `*.integration.test.ts` and, in the frontend, `*.integration.test.tsx` | A PostgreSQL: the one at `TEST_DATABASE_URL`, otherwise a container started through testcontainers (Docker). The frontend tests of this kind call the API through the test server of the backend, which uses the same PostgreSQL. The mail delivery tests and the file storage tests of the `infrastructure` package always need Docker: they start a Mailpit and a SeaweedFS container through testcontainers (the storage tests use another S3-compatible storage when `TEST_STORAGE_ENDPOINT` names one) |
| Browser | `pnpm test:e2e` | `*.e2e.test.ts` in `frontend/e2e/src` | The Chromium of Playwright (`pnpm test:e2e:install`, once), a PostgreSQL as for the integration tests, and the ports 4100 to 4103 of this machine. A run builds the three frontend applications and starts the test server of the backend |

The unit and the integration tests run on Vitest. They resolve the workspace packages they import from
source (the export condition `@beauty-salon-backend/source`, or
`@beauty-salon-frontend/source` in the frontend, in the Vitest configuration),
so they run on a fresh clone and a change in one package reaches the tests of
another without a rebuild. The browser tests run on Playwright, on the
frontend applications as they are built: `pnpm test:e2e` builds the frontend
packages first.

`CLAUDE.md` asks for end-to-end coverage of the critical paths. It has three
parts: the API tests drive the production Express application over HTTP
against a real database, the server tests start the real server, and the
browser tests drive the built frontend applications against that application
and a real database. Between them, the integration tests of the frontend call
the same application from the code of the client.

What the repository does not have:

- A coverage threshold. Coverage is not measured in CI; the requirements below
  are stated per behaviour instead of as a percentage.
- A request mocking library, in the backend or the frontend.

## What Must Be Tested

### Backend

| Subject | Kind | Reference |
|---------|------|-----------|
| Request schemas: every rule, with a value that passes and one that breaks it | Unit | `backend/packages/domain/src/__tests__/salon.schema.test.ts`, `auth.schema.test.ts`, `service-category.schema.test.ts`, `service.schema.test.ts`; the rules that the schemas share in `schema-rules.test.ts`, the IDs of a path in `path-parameters.test.ts` |
| Rules that tie two properties of a request together, as the pure function that the use case and the repository both call: every rule kept and broken | Unit | `backend/packages/domain/src/__tests__/service.rules.test.ts` |
| Mappers: both directions, `null` kept as `null`, the changes of representation, and the columns that must not reach a response left out | Unit | `backend/packages/domain/src/__tests__/salon.mapper.test.ts`, `user.mapper.test.ts`, `service.mapper.test.ts` |
| Use cases: the success path, every error passed on unchanged, the repository left untouched by invalid input | Unit, with the interfaces the use case depends on stubbed | `backend/packages/domain/src/__tests__/salon.usecase.test.ts`, `auth.usecase.test.ts`, `service-category.usecase.test.ts`, `service.usecase.test.ts` |
| Permission rules: every kind of actor, allowed or refused, and the repository left untouched by a refused one | Unit, through the use cases | `describe('who may change a salon', …)` in `backend/packages/domain/src/__tests__/salon.usecase.test.ts` |
| Password hashing, the generation of tokens, and the secrets, one-time passwords and backup codes of two-factor authentication | Unit | `backend/packages/infrastructure/src/security/__tests__/` |
| Mail delivery (`SmtpMailer`): what reaches the SMTP server, what is logged and what is kept out of the log, a delivery that fails, closing while deliveries are under way | Unit for what needs no server; integration against a Mailpit container | `backend/packages/infrastructure/src/mail/__tests__/` |
| File storage (`S3FileStorage`): what a signed upload URL takes and refuses (another type, another length, a second upload, a URL that ran out), what is read of a stored file, what a signed download URL answers, removal, a public endpoint of its own, a storage that refuses or cannot be reached | Integration against a SeaweedFS container, with real uploads and downloads | `backend/packages/infrastructure/src/storage/__tests__/` |
| Pure helpers of the HTTP layer: links, query decoding, problem details, middleware | Unit | `backend/packages/api/src/routes/salon/_shared/__tests__/`, `backend/packages/api/src/routes/service-category/_shared/__tests__/`, `backend/packages/api/src/routes/service/_shared/__tests__/`, `backend/packages/api/src/shared/__tests__/`, `backend/packages/api/src/middleware/__tests__/middleware.test.ts` |
| Every endpoint (see [Requirements per Endpoint](#requirements-per-endpoint)) | Integration | `backend/packages/api/src/__tests__/salon.integration.test.ts`, `auth.integration.test.ts`, `service-category.integration.test.ts` (routes below a salon), `service.integration.test.ts` (a bulk operation, a soft delete below a salon) |
| The seeded accounts: one of each role signs in with `SEED_PASSWORD`, and the owner and the manager can change the first seeded salon but not the second | Integration | `describe('the seeded accounts', …)` in `backend/packages/api/src/__tests__/auth.integration.test.ts` |
| What the application does for every route: request IDs, requests it cannot read, a failing database, CORS, the rate limit, the probes, security headers | Integration | `backend/packages/api/src/__tests__/app.integration.test.ts` |
| Server start-up and shutdown | Integration | `backend/apps/server/src/__tests__/server.integration.test.ts` |
| The migration runner, and the migrations of the repository | Integration | `backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
| Configuration: every variable, and every environment file in the repository (the local ones allow the origins of the frontend applications) | Unit | `backend/packages/config/src/__tests__/app-config.test.ts` |
| Shared helpers: `Result`, the logger, the description of database failures | Unit | `backend/packages/utility/src/__tests__/result.test.ts`, `backend/packages/infrastructure/src/logging/__tests__/logger.test.ts`, `backend/packages/infrastructure/src/database/__tests__/failure.test.ts` |

The repository implementations
(`backend/packages/infrastructure/src/repositories/`) have no test files of
their own. Their behaviour — transactions, the unique violation that becomes
`alreadyExists`, soft delete, keyset pagination, a refresh token that only one
of several parallel requests can use — is required to be covered through the
endpoint tests, against a real database.
`backend/packages/api/src/__tests__/service.integration.test.ts` also calls
`ServiceRepository` directly, method by method, and writes rows past it to
show what the constraints of `services` and `service_options` refuse.

### Frontend

| Subject | Kind | Reference |
|---------|------|-----------|
| Configuration read from the environment | Unit, beside the module | `frontend/packages/config/src/env/env.test.ts` |
| The fetch function, and the generated API client through it: the request, every status as a typed value, transport failures | Unit, with `fetch` stubbed | `frontend/packages/io/src/libs/fetcher/fetcher.test.ts`, `frontend/packages/api-client/src/salons.test.ts` |
| The session: the stored tokens, the access token on a request, the renewal after it expired (once, also for requests and tabs that find it expired together), `useSession`, signing in and out | Unit, in jsdom, over the real client and the real fetch function, with `fetch` stubbed | `frontend/packages/io/src/libs/fetcher/fetcher.session.test.ts`, `frontend/packages/session/src/session.test.tsx` |
| Code that calls the API, against the production application on a real PostgreSQL with the seed data: the session against the real authentication endpoints, and what the tests are given (an API for each test file, a fresh copy of the database for each test, the code of an authenticator app) | Integration, in jsdom, with nothing stubbed | `frontend/packages/session/src/session.integration.test.tsx`, `frontend/packages/testing/src/api/test-api.integration.test.ts` |
| A screen, worked as its user works it (typed into and pressed), against the same API: signing in with its two steps, what the form says about a refused attempt, the screens a session and a role open, signing out, the screens of an account that a mailed link opens (the test reads the link from the mails the API kept), the search for a salon and the page of a salon (a failure of the API is arranged in the database, not in the answer) | Integration, in jsdom, with nothing stubbed | `frontend/packages/session/src/sign-in.integration.test.tsx`, `frontend/apps/admin-app/src/App.integration.test.tsx`, `frontend/apps/portal-app/src/account/account.integration.test.tsx`, `frontend/apps/portal-app/src/salons/salons.integration.test.tsx` |
| The critical paths in a browser, on the built applications against the same API, and what only a browser shows: the layout at the width of a phone, the contrast of what is painted, the focus as the browser moves it, a reload, the way back, a second tab, a page of one origin calling the API of another | Browser test (Playwright, Chromium), with nothing stubbed | `frontend/e2e/src/sign-in.e2e.test.ts`, `frontend/e2e/src/applications.e2e.test.ts`, `frontend/e2e/src/account.e2e.test.ts`, `frontend/e2e/src/salons.e2e.test.ts` |
| UI components, in `ui`, in `session` and in an application | The stories of the component, composed and run in jsdom, with an accessibility test for every story | `frontend/packages/ui/src/components/button/button.test.tsx`, `frontend/packages/session/src/components/sign-in-form/sign-in-form.test.tsx`, `frontend/apps/portal-app/src/salons/components/salon-hours/salon-hours.test.tsx` |
| What a form does with its values and with the answer of the API | Unit, of pure functions | `frontend/packages/session/src/components/sign-in-screen/sign-in-flow.test.ts`, `frontend/apps/portal-app/src/account/account-flow.test.ts` |
| What a screen makes of its address and of what it read: the conditions of a search, dates and amounts in the time zone and the currency of the salon, the pages of a list | Unit, of pure functions | `frontend/apps/portal-app/src/salons/salon-search.test.ts`, `frontend/apps/portal-app/src/salons/salon-format.test.ts`, `frontend/apps/portal-app/src/salons/pages.test.ts` |
| Applications: the frame, the routes and what depends on the environment, as somebody who is not signed in sees them | Component test in a `MemoryRouter`, with an accessibility test; no API | `frontend/apps/portal-app/src/App.test.tsx` |
| The style rules (CSS Modules, Grid and no flex, tokens) in every package and application; the contrast of the colour tokens | Unit | `frontend/packages/theme/src/style-rules.test.ts`, `frontend/packages/theme/src/tokens.test.ts` |

The tests of `config` and of `theme` run in Node, the others in jsdom (the
session is kept in `localStorage`). How a component is tested from its
stories, how accessibility is checked and how code that calls the API is
tested is the subject of the skill
[frontend-testing](../.claude/skills/frontend-testing/SKILL.md). Environment
variables are set with `vi.stubEnv`, or with `test.env` in the Vitest
configuration of the package when every test of it needs the same value
(`frontend/packages/api-client`). The browser tests are in `frontend/e2e`;
the same skill says what is tested there and what in jsdom.

The integration tests of the frontend run against the **test server**
(`backend/packages/api/src/__tests__/test-server/`, started with
`pnpm --filter @beauty-salon-backend/api run test:server` by the global setup
of the tests). It creates a template database with the schema and the seed
data, and starts an API for every test file that asks for one: the production
`createApp` on a copy of the template and on a port of its own. After every
test the API gets a fresh copy, so a test sees the seed data and nothing of
another test. A run of the browser tests asks for one API instead: on the
port that the applications were built for, and open to the origins of those
applications, for a browser asks the API before a page may call it. What a test cannot bring about through the screen or the API,
such as time having passed, it does with a statement on the database of its
API. The server listens on the loopback address only and answers nothing
without the token of the run; it stops, and removes its container and its
databases, when the process that started it ends.

## Requirements per Endpoint

Every endpoint has integration tests in the `api` package that cover:

1. **Success**: at least one scenario that asserts the whole response — status,
   headers that matter (such as `Location`), and the complete body (`data`,
   `meta`, `links`), not a sample of its properties.
2. **At least five error scenarios.** Each row of an `it.each` table is one
   scenario. Between them they cover every kind of error the endpoint can
   answer with: validation (400), not found (404), conflict (409), for an
   endpoint that is not public a missing token (401) and a user who is not
   allowed (403) and, where stored data can be at fault, the 500 that reveals
   nothing.
3. **Who may call it**, for an endpoint that is not public: a request without
   an access token (401 with a `WWW-Authenticate` header) and a request from
   each kind of user who is not allowed (403). Where a permission belongs to
   one salon, a user with the same role at another salon is one of them.
   Where somebody other than an admin is allowed, a success scenario shows
   it.
4. **Problem details**: every error scenario asserts the status, the `type`
   and the `code` of the problem, and a validation error also asserts which
   rule of which field was broken.
5. **State**: after a rejected write nothing has changed; after an accepted
   one, what is stored is what was returned. Verify through the API or through
   the test's database connection.
6. **Deleted resources**: a soft-deleted row is invisible to every endpoint,
   so each endpoint that takes an ID has a scenario for a deleted resource.

### The Salon Endpoints as the Example

Error scenarios in `backend/packages/api/src/__tests__/salon.integration.test.ts`:

| Endpoint | Error scenarios | Count |
|----------|-----------------|-------|
| `POST /api/v1/salons` | Seven invalid bodies (a missing property, a property the client may not set, `null` for a NOT NULL column, a value longer than its column, several invalid values, a calendar entry on the wrong day of the week, a calendar that repeats a date); a body that is not an object; an email that another salon uses (409); no token, and a token that names no session (401); five kinds of user who are not an admin (403); an owner with an invalid body (403, not 400) | 17 |
| `GET /api/v1/salons/:id` | Three malformed IDs (400); an ID that no salon has (404); a deleted salon (404); a stored salon that is corrupt (500 without details) | 6 |
| `GET /api/v1/salons` | Eight invalid queries: a limit of 0, over 100, or not a number; a boolean that is not `true` or `false`; a cursor that is not an ID; a rating above 5; an empty keyword; a parameter that does not exist | 8 |
| `PATCH /api/v1/salons/:id` | An ID that is not a UUID, an empty request, `null` for a NOT NULL column, a property the client may not set, an invalid calendar (400); an ID that no salon has (404); a deleted salon (404); the email of another salon (409); no token (401); seven kinds of user who may not change the salon (403), the same seven with an ID that no salon has (403), and the owner of a deleted salon (403); an ID that is not a UUID from five kinds of user (400) | 29 |
| `DELETE /api/v1/salons/:id` | Three malformed IDs (400); an ID that no salon has (404); a salon that is already deleted (404); no token (401); five kinds of user who may not delete the salon (403) | 11 |

The two `GET` endpoints are public and have no scenario for a token. What the
server does with a token that has expired, belongs to a signed-out session or
belongs to a suspended, inactive or deleted user is covered in
`backend/packages/api/src/__tests__/auth.integration.test.ts`. The 409 of a
delete while a booking of the salon is not finished is covered in
`backend/packages/api/src/__tests__/booking-references.integration.test.ts`,
together with the same rule of the deletes of a customer, a staff member and
a service.

## Standards for Every Test

- **The name states the expected behaviour**, as the sentence that follows
  "it". Names from the repository:
  `it('should report every missing variable at once', …)`,
  `it('rejects an email that another salon uses', …)`,
  `it('keeps null as null', …)`.
  Related inputs go into one `it.each` table whose title names the case, such
  as `'rejects %s and stores nothing'`.
- **Arrange, Act, Assert**, in that order and visibly apart, one behaviour per
  test. The frontend tests mark the steps with comments; the backend tests
  separate them with blank lines.
- **Independent**: no test relies on another having run. Every API test and
  every migration test gets a database of its own, and every integration test
  of the frontend a fresh copy of the seeded database.
- **Integration tests use the real thing**: the production `createApp`, the
  real repository, a real PostgreSQL. A failure is produced by real means — a
  database nothing listens on, a dropped column, a corrupt stored value — not
  by a mock. A test that needs a signed-in user inserts the user and signs in
  through `POST /api/v1/auth/login`
  (`backend/packages/api/src/__tests__/_shared/auth-helpers.ts`). The one
  substitute is the mailer: the API tests give `createApp` a mailer that
  keeps the mails for the test (`createTestApp({ mails })` in
  `backend/packages/api/src/__tests__/_shared/test-helpers.ts`), and
  delivery over SMTP is tested in the `infrastructure` package against a real
  SMTP server. Two-factor authentication is not substituted: `createTestApp`
  passes the real `TotpAuthenticator`.
- **Unit tests of use cases stub only what the use case depends on**: the
  repository interface (`ISalonRepository`), with `vi.fn`
  (`salonRepositoryWith` in
  `backend/packages/domain/src/__tests__/fixtures.ts`); for the
  authentication use cases the two repositories, the password hasher, the
  token issuer, the authenticator of two-factor authentication and the
  mailer, with the clock fixed (`authDependencies` in
  `backend/packages/domain/src/__tests__/auth-fixtures.ts`; its
  `fakeTwoFactorAuthenticator` accepts the one code `APP_CODE`). Schemas and
  mappers are tested without any stub.
- **Failures are asserted as values**: a use case or mapper through the
  `Result` it returns, an endpoint through its problem details.
- **Nothing internal leaks**: a test of a server-side failure asserts that the
  response carries no detail, and a test of logging asserts that the bound
  values of a statement and the request headers stay out of the log.
- **Test data is explicit**: a builder returns a complete valid request and a
  test overrides what it is about (`salonRequest(overrides)` in the endpoint
  tests, `salonCreateRequest()` in
  `backend/packages/domain/src/__tests__/fixtures.ts`). Dates are fixed, never
  taken from the clock. The one exception is an instant that has to lie
  before or after the present of the running application, which reads the
  system clock: an expired token or the end of a lock in the authentication
  endpoint tests (`minutesFromNow` in `auth-helpers.ts`).
- **Two moments are compared on one clock**: a test that asserts that a stamp
  was written after something else happened reads the other moment from the
  database as well (`databaseMoment` in `test-helpers.ts`, read last in the
  transaction that held the row), and compares the two. It does not compare
  their distance with the length of a timer of the test: a timer of Node.js
  may fire up to a millisecond early, and such a test fails now and then.
- **The type rules apply to backend test code**: no `any`, no `as`. Tests are
  scripts, not application code, so a helper may `throw` when its
  precondition is not met.

## Checklist for a New Domain

A new domain follows the Salon tests file by file:

- [ ] Schema tests: every rule of every request schema, accepted and rejected
- [ ] Mapper tests: write and read mappers, including `null` and every change of representation
- [ ] Use case tests: success, each error passed on, no repository call on invalid input; for an operation that is not public, every kind of actor allowed or refused
- [ ] `backend/packages/api/src/__tests__/<domain>.integration.test.ts` meeting the [requirements per endpoint](#requirements-per-endpoint)
- [ ] `pnpm test` and `pnpm test:integration` pass

## Running the Tests

```bash
pnpm test                # every unit test (backend and frontend)
pnpm test:backend        # unit tests of the backend packages
pnpm test:frontend       # unit and component tests of the frontend
pnpm test:integration    # integration tests, backend and frontend; needs Docker (TEST_DATABASE_URL replaces only the PostgreSQL container)
pnpm test:e2e            # browser tests; needs the Chromium of `pnpm test:e2e:install` and a PostgreSQL (TEST_DATABASE_URL, or Docker)
```

CI runs the unit tests once and the integration tests twice: against a
PostgreSQL service through `TEST_DATABASE_URL`, and with testcontainers; the
mail delivery tests start their Mailpit container and the file storage tests
their SeaweedFS container in both runs. The browser tests run in a job of
their own, against the PostgreSQL service; a run that fails keeps its report
and its traces as an artifact. How to
run one package, one file or one test is in the
[API Testing Guide](./api-testing-guide.md).
