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
| Integration | `pnpm test:integration` | `*.integration.test.ts` and, in the frontend, `*.integration.test.tsx` | A PostgreSQL: the one at `TEST_DATABASE_URL`, otherwise a container started through testcontainers (Docker). The frontend tests of this kind call the API through the test server of the backend, which uses the same PostgreSQL and always starts a SeaweedFS container for the files of its APIs, so they need Docker. The mail delivery tests and the file storage tests of the `infrastructure` package always need Docker: they start a Mailpit and a SeaweedFS container through testcontainers (the storage tests use another S3-compatible storage when `TEST_STORAGE_ENDPOINT` names one) |
| Browser | `pnpm test:e2e` | `*.e2e.test.ts` in the folders of `frontend/e2e/src` (one for each application, `applications/`, `layout/`) | The Chromium of Playwright (`pnpm test:e2e:install`, once), a PostgreSQL as for the integration tests, Docker for the object storage of the test server, and the ports 4100 to 4103 of this machine. A run builds the three frontend applications and starts the test server of the backend |

A backend test is in the `__tests__` directory of the folder whose code it
tests. In the domain package, the tests of the request schemas are in
`backend/packages/domain/src/schemas/__tests__/`, those of the two mappers of a
domain in `backend/packages/domain/src/mappers/__tests__/`, and those of its
use cases and of its pure rules in
`backend/packages/domain/src/business-logic/<domain>/__tests__/`. A file holds
tests of one of these kinds: a schema is not tested in the file of a use case.
What the tests of more than one folder share (rows, requests, stand-ins for
the repositories) is in `backend/packages/domain/src/__tests__/fixtures/`, one
file per domain; beside it, `backend/packages/domain/src/__tests__/` holds only
the tests of the whole package: the one that reads its sources
(`use-case-flow.test.ts`) and the one that asks every use case
(`use-case-headlines.test.ts`).

The integration tests of the API drive every layer from an endpoint, so they
are in the `__tests__` of the folder of its route:
`backend/packages/api/src/routes/<domain>/__tests__/`, in a file named after
the route or after the part of it the file covers
(`booking-status.integration.test.ts`). `backend/packages/api/src/__tests__/`
holds the three that are about no single route (`app.integration.test.ts`,
`request-dates.integration.test.ts`, `write-stamps.integration.test.ts`), what
all the integration tests share (`_shared/`) and the test server
(`test-server/`).

The unit and the integration tests run on Vitest, configured in one place
for every package: the `vitest.config.ts` of a package calls `backendTests`,
`frontendTests` or `sharedTests` of `@beauty-salon-shared/config/vitest`
(`shared-config/vitest/package-tests.ts`) with the tests it has and what is
its own (the document of its tests, a setup of its own, the files that are
not measured). Its unit tests and its integration tests are the two projects
of that configuration, `unit` and `integration`: `pnpm test` runs
`vitest run --project unit`, `pnpm test:integration`
`vitest run --project integration`, and `pnpm test:coverage` both in one run
(see [Coverage](#coverage)). They resolve the workspace packages they import
from source (the export condition `@beauty-salon-backend/source`, or
`@beauty-salon-frontend/source` in the frontend), so they run on a fresh
clone and a change in one package reaches the tests of another without a
rebuild. The browser tests run on Playwright, on the
frontend applications as they are built: `pnpm test:e2e` builds the frontend
packages first.

`CLAUDE.md` asks for end-to-end coverage of the critical paths. It has three
parts: the API tests drive the production Express application over HTTP
against a real database, the server tests start the real server, and the
browser tests drive the built frontend applications against that application
and a real database. Between them, the integration tests of the frontend call
the same application from the code of the client.

What the repository does not have: a request mocking library, in the
backend or the frontend.

## What Must Be Tested

### Backend

| Subject | Kind | Reference |
|---------|------|-----------|
| Request schemas: every rule, with a value that passes and one that breaks it | Unit | `backend/packages/domain/src/schemas/__tests__/salon.schema.test.ts`, `auth.schema.test.ts`, `service-category.schema.test.ts`, `service.schema.test.ts`; the rules that the schemas share in `schema-rules.test.ts`, the IDs of a path in `backend/packages/domain/src/models/__tests__/path-parameters.test.ts` |
| Rules that tie two properties of a request together, as the pure function that the use case and the repository both call: every rule kept and broken | Unit | `backend/packages/domain/src/business-logic/service/__tests__/service.rules.test.ts` |
| Mappers: both directions, `null` kept as `null`, the changes of representation, and the columns that must not reach a response left out | Unit | `backend/packages/domain/src/mappers/__tests__/salon.mapper.test.ts`, `user.mapper.test.ts`, `service.mapper.test.ts` |
| The flow of the use cases, read from their sources: a request that was checked goes to the write mapper of its domain and nowhere else, what the API answers with comes from a read mapper, the page of a list is made by the mappers, and a mapper file of one side has one of the same name on the other. The test reads every domain, and shows on sample sources what it reads as leaving the flow | Unit | `backend/packages/domain/src/__tests__/use-case-flow.test.ts` |
| The headline of a validation error, which says which request was wrong: every use case that names one says it of what is no request, every function that reads IDs of what is no ID, every decoder of a query of a query it cannot decode. Each table is compared with the sources, and fails for a use case, a function or a decoder that it lacks | Unit | `backend/packages/domain/src/__tests__/use-case-headlines.test.ts`, `backend/packages/domain/src/models/__tests__/id-headlines.test.ts`, `backend/packages/api/src/routes/__tests__/query-headlines.test.ts` |
| Use cases: the success path, every error passed on unchanged, the repository left untouched by invalid input | Unit, with the interfaces the use case depends on stubbed | `backend/packages/domain/src/business-logic/salon/__tests__/salon.usecase.test.ts`, `backend/packages/domain/src/business-logic/auth/__tests__/auth.usecase.test.ts`, `backend/packages/domain/src/business-logic/service-category/__tests__/service-category.usecase.test.ts`, `backend/packages/domain/src/business-logic/service/__tests__/service.usecase.test.ts` |
| Permission rules: every kind of actor, allowed or refused, and the repository left untouched by a refused one | Unit, through the use cases | `describe('who may change a salon', …)` in `backend/packages/domain/src/business-logic/salon/__tests__/salon.usecase.test.ts` |
| Password hashing, the generation of tokens, and the secrets, one-time passwords and backup codes of two-factor authentication | Unit | `backend/packages/infrastructure/src/security/__tests__/` |
| Mail delivery (`SmtpMailer`): what reaches the SMTP server, what is logged and what is kept out of the log, a delivery that fails, closing while deliveries are under way | Unit for what needs no server; integration against a Mailpit container | `backend/packages/infrastructure/src/mail/__tests__/` |
| File storage (`S3FileStorage`): what a signed upload URL takes and refuses (another type, another length, a second upload, a URL that ran out), what is read of a stored file, what a signed download URL answers, removal, a public endpoint of its own, a storage that refuses or cannot be reached | Integration against a SeaweedFS container, with real uploads and downloads | `backend/packages/infrastructure/src/storage/__tests__/` |
| Pure helpers of the HTTP layer: links, query decoding, problem details, middleware | Unit | `backend/packages/api/src/routes/salon/_shared/__tests__/`, `backend/packages/api/src/routes/service-category/_shared/__tests__/`, `backend/packages/api/src/routes/service/_shared/__tests__/`, `backend/packages/api/src/shared/__tests__/`, `backend/packages/api/src/middleware/__tests__/middleware.test.ts` |
| Every endpoint (see [Requirements per Endpoint](#requirements-per-endpoint)) | Integration | `backend/packages/api/src/routes/salon/__tests__/salon.integration.test.ts`, `backend/packages/api/src/routes/auth/__tests__/auth.integration.test.ts`, `backend/packages/api/src/routes/service-category/__tests__/service-category.integration.test.ts` (routes below a salon), `backend/packages/api/src/routes/service/__tests__/service.integration.test.ts` (a bulk operation, a soft delete below a salon) |
| The seeded accounts: one of each role signs in with `SEED_PASSWORD`, and the owner and the manager can change the first seeded salon but not the second | Integration | `describe('the seeded accounts', …)` in `backend/packages/api/src/routes/auth/__tests__/auth.integration.test.ts` |
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
`backend/packages/api/src/routes/service/__tests__/service.integration.test.ts` also calls
`ServiceRepository` directly, method by method, and writes rows past it to
show what the constraints of `services` and `service_options` refuse.

### Frontend

| Subject | Kind | Reference |
|---------|------|-----------|
| Configuration read from the environment | Unit, beside the module | `frontend/packages/config/src/env/env.test.ts` |
| The fetch function, and the generated API client through it: the request, every status as a typed value, transport failures | Unit, with `fetch` stubbed | `frontend/packages/api-client/src/fetcher/fetcher.test.ts`, `frontend/packages/api-client/src/salons.test.ts` |
| The session: the stored tokens, the access token on a request, the renewal after it expired (once, also for requests and tabs that find it expired together), `useSession`, signing in and out | Unit, in jsdom, over the real client and the real fetch function, with `fetch` stubbed | `frontend/packages/io/src/libs/session/stored-session.test.ts`, `frontend/packages/api-client/src/fetcher/fetcher.session.test.ts`, `frontend/packages/session/src/session.test.tsx` |
| Code that calls the API, against the production application on a real PostgreSQL with the seed data: the session against the real authentication endpoints, and what the tests are given (an API for each test file, a fresh copy of the database for each test, the code of an authenticator app) | Integration, in jsdom, with nothing stubbed | `frontend/packages/session/src/session.integration.test.tsx`, `frontend/packages/testing/src/api/test-api.integration.test.ts`, `frontend/packages/testing/src/fixtures/seed.integration.test.ts`, `frontend/packages/testing/src/api/sign-in.integration.test.tsx` |
| How a test makes the API fail, without a stub: a write the database refuses, a table or a column of one taken away and given back, a moment of a row that the API cannot answer with and that is given back | Integration, in jsdom, with nothing stubbed | `frontend/packages/testing/src/api/failures.integration.test.ts` |
| The start of the test server for a run (the token it is handed, the origin it prints when it is ready, a server that ends or is not ready in time), and the global setup that provides where it listens | Unit, with a program of Node.js that stands in for the server | `frontend/packages/testing/src/api/test-server-process.test.ts`, `frontend/packages/testing/src/api/global-setup.test.ts` |
| How a test makes the API fail, without a stub: a write the database refuses, a table or a column of one taken away and given back, a moment of a row that the API cannot answer with and that is given back | Integration, in jsdom, with nothing stubbed | `frontend/packages/testing/src/api/failures.integration.test.ts` |
| The start of the test server for a run (the token it is handed, the origin it prints when it is ready, a server that ends or is not ready in time), and the global setup that provides where it listens | Unit, with a program of Node.js that stands in for the server | `frontend/packages/testing/src/api/test-server-process.test.ts`, `frontend/packages/testing/src/api/global-setup.test.ts` |
| What the tests of screens share: an application at an address, its address and what its page said at first sight, the history, the heading of a screen, the notifications, the terms of a card, the rows of a table, the options of a select, the client of a test | Unit, in jsdom | `frontend/packages/testing/src/screens/screens.test.tsx` |
| The values a form was sent with, as the tests of the functions that read them make them: one value under each name, several values of a name in their order, a file | Unit, in jsdom | `frontend/packages/testing/src/fixtures/forms.test.ts` |
| The answers of the API a test makes up: a problem, with the values the API refused or with a code and a detail, one record and a page of a list as the API wraps them, an answer with no body, the page of a gateway, the stub of `fetch`, what it was asked (a line for each request, with the path below the API and the query in the order of its names) and what it was sent (the bodies, JSON as its value and a file as its bytes), the tables of the answers that say nothing | Unit, in jsdom | `frontend/packages/testing/src/fixtures/answers.test.ts` |
| That those answers are answers of the contract: each compared in full with a value of the generated type | Unit, in jsdom | `frontend/packages/api-client/src/made-up-answers.test.ts` |
| A screen, worked as its user works it (typed into and pressed), against the same API: signing in with its two steps, what the form says about a refused attempt, the screens a session and a role open, signing out, the screens of an account that a mailed link opens (the test reads the link from the mails the API kept), the search for a salon and the page of a salon (a failure of the API is arranged in the database, not in the answer), booking a service (the day and who works on it are arranged in the database, relative to today; what another customer does meanwhile is done through the API), the bookings of a customer with cancelling and moving one (what the salon does meanwhile is a statement on the database), the page of a customer and the form of their profile (what the form leaves alone is asserted in the row), what a customer wishes for (what the customer and a salon wrote before is asked of the API; what the form offers is asserted against the database), the reviews of a customer: writing about a visit, the list, changing and removing (what the customer, a salon and an administrator do meanwhile is asked of the API; a member of the staff or a salon that is gone is a statement on the database), what a reader does with the reviews of a salon: finding one helpful, reporting one, the ratings of the staff (what an account did before is asked of the API, and not taken from the seed data), the security of an account: changing the password, the devices that are signed in, signing one or all of them out (another device signs in through the API; twenty more are rows the test writes; a write that fails is refused by a trigger; an account or a device that cannot be read has a moment the API cannot answer with), the start of an application of a salon, the choice of a salon and a screen of the salon of the address (a member is led on to their salon and the operator chooses one; the salon of a member that cannot be read is a column taken away) | Integration, in jsdom, with nothing stubbed | `frontend/packages/session/src/screens/sign-in.integration.test.tsx`, `frontend/packages/session/src/security/screens/security.integration.test.tsx`, `frontend/packages/salon-screens/src/screens/start-screen.integration.test.tsx`, `frontend/packages/salon-screens/src/screens/salon-choice-screen.integration.test.tsx`, `frontend/packages/salon-screens/src/screens/with-salon.integration.test.tsx`, `frontend/packages/app-frame/src/screens/staff-application.integration.test.tsx`, `frontend/apps/admin-app/src/App.integration.test.tsx`, `frontend/apps/portal-app/src/account/screens/account.integration.test.tsx`, `frontend/apps/portal-app/src/salons/screens/salons.integration.test.tsx`, `frontend/apps/portal-app/src/bookings/screens/bookings.integration.test.tsx`, `frontend/apps/portal-app/src/bookings/screens/own-bookings.integration.test.tsx`, `frontend/apps/portal-app/src/profile/screens/profile.integration.test.tsx`, `frontend/apps/portal-app/src/preferences/screens/preferences.integration.test.tsx`, `frontend/apps/portal-app/src/reviews/screens/review-writing.integration.test.tsx`, `frontend/apps/portal-app/src/reviews/screens/own-reviews.integration.test.tsx`, `frontend/apps/portal-app/src/reviews/screens/review-readers.integration.test.tsx`, `frontend/apps/portal-app/src/reviews/screens/review-screens.integration.test.tsx`, `frontend/apps/portal-app/src/security/screens/security.integration.test.tsx` |
| The critical paths in a browser, on the built applications against the same API, and what only a browser shows: the layout at the width of a phone, the contrast of what is painted, the focus as the browser moves it, a reload, the way back, a second tab, a page of one origin calling the API of another | Browser test (Playwright, Chromium), with nothing stubbed | `frontend/e2e/src/admin/sign-in.e2e.test.ts`, `frontend/e2e/src/applications/applications.e2e.test.ts`, `frontend/e2e/src/portal/account.e2e.test.ts`, `frontend/e2e/src/portal/salons.e2e.test.ts`, `frontend/e2e/src/portal/bookings.e2e.test.ts`, `frontend/e2e/src/portal/own-bookings.e2e.test.ts`, `frontend/e2e/src/portal/mypage.e2e.test.ts`, `frontend/e2e/src/portal/preferences.e2e.test.ts`, `frontend/e2e/src/portal/reviews.e2e.test.ts`, `frontend/e2e/src/portal/review-readers.e2e.test.ts`, `frontend/e2e/src/portal/security.e2e.test.ts` |
| UI components, in `ui`, in `session` and in an application | The stories of the component, composed and run in jsdom, with an accessibility test for every story | `frontend/packages/ui/src/components/button/button.test.tsx`, `frontend/packages/session/src/components/sign-in-form/sign-in-form.test.tsx`, `frontend/apps/portal-app/src/salons/components/salon-hours/salon-hours.test.tsx` |
| What a form does with its values and with the answer of the API | Unit, of pure functions | `frontend/packages/session/src/utils/sign-in-flow.test.ts`, `frontend/apps/portal-app/src/account/utils/account-flow.test.ts`, `frontend/apps/portal-app/src/bookings/utils/booking-flow.test.ts` |
| The rules of the values a form takes, and the sentences they say: a name, an address of mail, a telephone number, a day, a length (the longest value a form takes is tested with characters outside the basic plane, which the API counts as one each), a choice, the record of a customer | Unit, of pure functions | `frontend/packages/fields/src/email.test.ts`, `frontend/packages/fields/src/customers.test.ts` |
| What a screen makes of its address and of what it read: the conditions of a search, dates and amounts in the time zone and the currency of the salon, the pages of a list | Unit, of pure functions | `frontend/apps/portal-app/src/salons/utils/salon-search.test.ts`, `frontend/apps/portal-app/src/salons/utils/salon-format.test.ts`, `frontend/packages/answers/src/pages.test.ts` |
| Applications: the frame, the routes and what depends on the environment, as somebody who is not signed in sees them | Component test in a `MemoryRouter`, with an accessibility test; no API | `frontend/apps/portal-app/src/App.test.tsx`, `frontend/packages/app-frame/src/screens/app-frame.test.tsx` |
| The start of an application: the element it is drawn in, the addresses of the browser, how its queries are read, what was read for one user and the next | Started in the document of jsdom and ended after the test; no API | `frontend/packages/app-frame/src/screens/start-application.test.tsx` |
| The language of the page: where the choice is kept and the language of the browser without one, the choice in the header, the language every request asks the API in, the language of the document, what the shared components say in English, and that a package whose texts are messages writes none in Japanese in its source | Unit, in jsdom; the last reads the sources of the package | `frontend/packages/io/src/libs/language/stored-language.test.ts`, `frontend/packages/ui/src/components/language-choice/language-choice.test.tsx`, `frontend/packages/ui/src/components/app-shell/app-shell.test.tsx`, `frontend/packages/api-client/src/fetcher/fetcher.test.ts`, `frontend/packages/app-frame/src/utils/page-language.test.ts`, `frontend/packages/ui/src/components/not-recorded/not-recorded.test.tsx`, `frontend/packages/ui/src/texts.test.ts` |
| The style rules (CSS Modules, Grid and no flex, tokens) in every package and application; the contrast of the colour tokens; the typefaces the theme loads | Unit | `frontend/packages/theme/src/style-rules.test.ts`, `frontend/packages/theme/src/tokens.test.ts`, `frontend/packages/theme/src/typefaces.test.ts` |

The tests of `config`, of `theme`, of `answers`, of `fields` and of `brand`
run in Node, the others in jsdom (the session and the language of the page are kept in `localStorage`; the shared setup sets the browser to Japanese, `setBrowserLanguages` to another language). The unit
tests of `admin-app`,
`portal-app` and `ui` run in the `vmThreads` pool of Vitest: the DOM is set
up once per worker, and every file still runs in a context of its own. How a component is tested from its
stories, how accessibility is checked and how code that calls the API is
tested is the subject of the skill
[frontend-testing](../.claude/skills/frontend-testing/SKILL.md). Environment
variables are set with `vi.stubEnv`; the one that the API client reads, the
origin of the API (`VITE_BACKEND_BASE_URL`), is set for every unit test of
the frontend by `frontendTests`. The browser tests are in `frontend/e2e`;
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

Error scenarios in `backend/packages/api/src/routes/salon/__tests__/salon.integration.test.ts`:

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
`backend/packages/api/src/routes/auth/__tests__/auth.integration.test.ts`. The 409 of a
delete while a booking of the salon is not finished is covered in
`backend/packages/api/src/routes/booking/__tests__/booking-references.integration.test.ts`,
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
  of the frontend a fresh copy of the seeded database. The unit tests of
  `domain` and of `api` share the modules they import across the files of a
  worker (`isolate: false`): a test there writes no state of a module and
  stubs nothing global; what it stubs belongs to the test, as the
  dependencies of a use case do. `vitest doctor` in the package runs the
  files twice in a shuffled order with this setting, and says whether they
  still pass.
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
  `backend/packages/domain/src/__tests__/fixtures/fixtures.ts`); for the
  authentication use cases the two repositories, the password hasher, the
  token issuer, the authenticator of two-factor authentication and the
  mailer, with the clock fixed (`authDependencies` in
  `backend/packages/domain/src/__tests__/fixtures/auth-fixtures.ts`; its
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
  `backend/packages/domain/src/__tests__/fixtures/fixtures.ts`). Dates are fixed, never
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

## Coverage

The coverage of a package is measured over its unit and its integration
tests together, with the v8 provider of Vitest. The bar is 100% of the
statements, the branches, the functions and the lines. A package whose tests
cover all of it says so with `full: true` in its `vitest.config.ts`, and from
then on a run that covers less fails; until then its coverage is reported,
and nothing fails. Every shared package of the frontend
(`frontend/packages/*`), `shared-i18n`, `shared-config`, the dashboard
(`frontend/apps/dashboard-app`), the portal (`frontend/apps/portal-app`),
the admin application (`frontend/apps/admin-app`), and the `utility`
and `config` packages and the server (`backend/apps/server`) of the
backend say so; the other packages of the backend do not yet.

| Where | How |
|---|---|
| One package | `pnpm test:coverage` in the package (`vitest run --coverage`): both projects in one run. A package with integration tests needs Docker, as `pnpm test:integration` does |
| Every package | `pnpm test:coverage` at the root (`make test-coverage`); `make ci-check` runs it in place of `pnpm test` and `pnpm test:integration` |
| CI | The job Unit Test and the four parts of Integration Test keep what they covered: Vitest writes a blob report of each package (`.vitest/blob`), and the jobs keep them as the artifacts `coverage-*`. The job Coverage puts them back in the folders of the packages and merges the reports of each package with its `test:coverage` (`vitest run --coverage --merge-reports`): the coverage is that of a single run of both projects, and a package below what its configuration says fails the job. On a pull request it measures the packages whose tests ran |

The report names the files that are not fully covered, with the lines that
no test reached, and writes a page for every file to `coverage/index.html` in
the package. Neither `coverage/` nor `.vitest/` is kept in git.

What is measured is the sources of the package: `src`, and `vite` and
`vitest` in `shared-config`. What is not:

| Not measured | Why |
|---|---|
| Tests, stories, `__tests__/`, `__stories__/`, `__fixtures__/`, `components/examples.ts` and declarations (`*.d.ts`) | Test material. A library does not build it either (`NOT_BUILT` in `shared-config/vite/library.ts`) |
| `src/generated/` of `api-client` | Generated by orval from the contract (`pnpm generate`) |
| `src/schema.ts` and `src/relations.ts` of `database` | Generated from the database by `pnpm db:introspect` |

Code that no test can run is left out with a comment of v8 in the code,
which says why (`/* v8 ignore next -- <why> */`), and is listed here with
the same reason. No code is left out this way yet. What a test does not
reach is reached, or is not written:

| What no test reached | What is done |
|---|---|
| A path that a user, the API or another tab can take | A test that takes it. A failure of the API that a screen meets is arranged in the database (`refuse`, `takeAway`, `unreadable` of `@beauty-salon-frontend/testing/api`), never in the answer. A change that falls between two reads of a screen is made in the database when the second is asked for (`whenAskedFor`), and the real API answers it |
| A branch that the types allow and that never happens: a fallback for a part that a format always gives, a value a pattern always holds, the item of an array that the API answers as long as another, a row that always has its header, the first line of a booking (a booking keeps one at least), the moment of a response (the database keeps the two together), the option that a choice of a `select` names | It is not written. The code says in a comment why it needs none, and optional chaining, which is no branch, stands where the types say a value may be missing |
| The composition root of the server, which ends the process and takes its signals and the exceptions that nothing caught | `main` (`backend/apps/server/src/main.ts`) takes the process: a test runs it with an event emitter that emits the signals and the exceptions and keeps the statuses, and reads its log (`logTo`). The entry (`src/index.ts`: `main(process)`) is imported by a test that replaces `process.exit` and gives a configuration that cannot be read |
| What depends on the files of the repository: its `.env`, which a developer may put there | A test reads files of its own, in a directory of its own (`loadEnvFileFrom` of `config`). What reads the repository is asserted to have read a file of it, and no more |
| Code that only the main process of Vitest runs: the global setup that starts the test server | A function of what it starts (`globalSetupOf`, `startTestServer` of a `TestServerProgram`), which a test runs with a program of Node.js that stands in for the server |
| Code of a package that only the tests of another package run | A test in its own package: the screens of `salon-screens` have integration tests of their own |
| The entry of an application (`src/main.tsx`), which the page runs as it loads | A test that loads it as the page does (`src/main.test.tsx`): the element `root` of `index.html` in the document, the entry imported inside `act`, and the application drawn in that element. `startApplication`, which it calls, is tested in `app-frame` |

## Checklist for a New Domain

A new domain follows the Salon tests file by file:

- [ ] Schema tests (`schemas/__tests__/<domain>.schema.test.ts`): every rule of every request schema, accepted and rejected
- [ ] Mapper tests (`mappers/__tests__/<domain>.mapper.test.ts`): write and read mappers, including `null`, every change of representation, the criteria of a list (a filter the request does not name, and one whose value is `false` or 0) and the page of a list
- [ ] `use-case-flow.test.ts` passes: it reads the new domain as it reads every other, without being told of it
- [ ] A row for every use case of the domain that names a headline in `use-case-headlines.test.ts`, for its function that reads IDs in `id-headlines.test.ts`, and for every decoder of a query in `query-headlines.test.ts` of the API package: each test fails until it has its rows
- [ ] Use case tests (`business-logic/<domain>/__tests__/<domain>.usecase.test.ts`; the tests of pure rules beside them): success, each error passed on, no repository call on invalid input; for an operation that is not public, every kind of actor allowed or refused
- [ ] `backend/packages/api/src/routes/<domain>/__tests__/<domain>.integration.test.ts` meeting the [requirements per endpoint](#requirements-per-endpoint)
- [ ] `pnpm test` and `pnpm test:integration` pass, and `pnpm test:coverage` in the packages the domain changes names no file of the domain as not fully covered

## Running the Tests

```bash
pnpm test                # every unit test (backend and frontend)
pnpm test:backend        # unit tests of the backend packages
pnpm test:frontend       # unit and component tests of the frontend
pnpm test:integration    # integration tests, backend and frontend; needs Docker (TEST_DATABASE_URL replaces only the PostgreSQL container)
pnpm test:coverage       # the unit and the integration tests of every package, and the coverage of both together; needs Docker
pnpm test:e2e            # browser tests; needs the Chromium of `pnpm test:e2e:install` and a PostgreSQL (TEST_DATABASE_URL, or Docker)
```

CI runs the unit tests and the integration tests once each, and measures
the coverage of each package over both (see [Coverage](#coverage)). The integration
tests use a PostgreSQL service through `TEST_DATABASE_URL`, as the browser
tests do; the mail delivery tests start their Mailpit container and the file
storage tests their SeaweedFS container through testcontainers. On a
developer's machine `TEST_DATABASE_URL` is left out, and the tests start a
PostgreSQL container as well: that needs nothing but Docker and leaves the
development database alone. The browser tests run in a job of
their own, against the PostgreSQL service; a run that fails keeps its report
and its traces as an artifact. How to
run one package, one file or one test is in the
[API Testing Guide](./api-testing-guide.md).
