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
| Integration | `pnpm test:integration` | `*.integration.test.ts` | A PostgreSQL: the one at `TEST_DATABASE_URL`, otherwise a container started through testcontainers (Docker) |

Both run on Vitest. Tests resolve the workspace packages they import from
source (the export condition `@beauty-salon-backend/source`, or
`@beauty-salon-frontend/source` in the frontend, in the Vitest configuration),
so they run on a fresh clone and a change in one package reaches the tests of
another without a rebuild.

What the repository does not have:

- A separate end-to-end suite. `CLAUDE.md` asks for end-to-end coverage of
  the critical paths, and the integration tests provide it: the API tests
  drive the production Express application over HTTP against a real database,
  and the server tests start the real server. Nothing tests the frontend
  against a running API.
- A coverage threshold. Coverage is not measured in CI; the requirements below
  are stated per behaviour instead of as a percentage.
- A request mocking library, in the backend or the frontend.

## What Must Be Tested

### Backend

| Subject | Kind | Reference |
|---------|------|-----------|
| Request schemas: every rule, with a value that passes and one that breaks it | Unit | `backend/packages/domain/src/__tests__/salon.schema.test.ts` |
| Mappers: both directions, `null` kept as `null`, the changes of representation | Unit | `backend/packages/domain/src/__tests__/salon.mapper.test.ts` |
| Use cases: the success path, every error passed on unchanged, the repository left untouched by invalid input | Unit, with the repository interface stubbed | `backend/packages/domain/src/__tests__/salon.usecase.test.ts` |
| Pure helpers of the HTTP layer: links, query decoding, problem details, middleware | Unit | `backend/packages/api/src/routes/salon/_shared/__tests__/`, `backend/packages/api/src/shared/__tests__/problem-details.test.ts`, `backend/packages/api/src/middleware/__tests__/middleware.test.ts` |
| Every endpoint (see [Requirements per Endpoint](#requirements-per-endpoint)) | Integration | `backend/packages/api/src/__tests__/salon.integration.test.ts` |
| What the application does for every route: request IDs, requests it cannot read, a failing database, CORS, the rate limit, the probes, security headers | Integration | `backend/packages/api/src/__tests__/app.integration.test.ts` |
| Server start-up and shutdown | Integration | `backend/apps/server/src/__tests__/server.integration.test.ts` |
| The migration runner, and the migrations of the repository | Integration | `backend/packages/database/src/scripts/__tests__/migrations.integration.test.ts` |
| Configuration: every variable, and every environment file in the repository (the local ones allow the origins of the frontend applications) | Unit | `backend/packages/config/src/__tests__/app-config.test.ts` |
| Shared helpers: `Result`, the logger, the description of database failures | Unit | `backend/packages/utility/src/__tests__/result.test.ts`, `backend/packages/infrastructure/src/logging/__tests__/logger.test.ts`, `backend/packages/infrastructure/src/database/__tests__/failure.test.ts` |

The repository implementation
(`backend/packages/infrastructure/src/repositories/salon.repository.impl.ts`)
has no test file of its own. Its behaviour — transactions, the unique
violation that becomes `alreadyExists`, soft delete, keyset pagination — is
required to be covered through the endpoint tests, against a real database.

### Frontend

| Subject | Kind | Reference |
|---------|------|-----------|
| Configuration read from the environment | Unit, beside the module | `frontend/packages/config/src/env/env.test.ts` |
| The fetch function, and the generated API client through it: the request, every status as a typed value, transport failures | Unit, with `fetch` stubbed | `frontend/packages/io/src/libs/fetcher/fetcher.test.ts`, `frontend/packages/api-client/src/salons.test.ts` |
| UI components | Component test | `frontend/packages/ui/src/components/button.test.tsx` |
| Applications: routes, navigation, what depends on the environment | Component test | `frontend/apps/admin-app/src/App.test.tsx` |

The frontend tests render with `renderToStaticMarkup` from `react-dom/server`.
A file that needs a DOM opts in with `// @vitest-environment jsdom` on its
first line. Environment variables are set with `vi.stubEnv`, or with `test.env`
in the Vitest configuration of the package when every test of it needs the same
value (`frontend/packages/api-client`). There are no browser-driven tests.

## Requirements per Endpoint

Every endpoint has integration tests in the `api` package that cover:

1. **Success**: at least one scenario that asserts the whole response — status,
   headers that matter (such as `Location`), and the complete body (`data`,
   `meta`, `links`), not a sample of its properties.
2. **At least five error scenarios.** Each row of an `it.each` table is one
   scenario. Between them they cover every kind of error the endpoint can
   answer with: validation (400), not found (404), conflict (409) and, where
   stored data can be at fault, the 500 that reveals nothing.
3. **Problem details**: every error scenario asserts the status, the `type`
   and the `code` of the problem, and a validation error also asserts which
   rule of which field was broken.
4. **State**: after a rejected write nothing has changed; after an accepted
   one, what is stored is what was returned. Verify through the API or through
   the test's database connection.
5. **Deleted resources**: a soft-deleted row is invisible to every endpoint,
   so each endpoint that takes an ID has a scenario for a deleted resource.

### The Salon Endpoints as the Example

Error scenarios in `backend/packages/api/src/__tests__/salon.integration.test.ts`:

| Endpoint | Error scenarios | Count |
|----------|-----------------|-------|
| `POST /api/v1/salons` | Seven invalid bodies (a missing property, a property the client may not set, `null` for a NOT NULL column, a value longer than its column, several invalid values, a calendar entry on the wrong day of the week, a calendar that repeats a date); a body that is not an object; an email that another salon uses (409); the email of a deleted salon (409) | 10 |
| `GET /api/v1/salons/:id` | Three malformed IDs (400); an ID that no salon has (404); a deleted salon (404); a stored salon that is corrupt (500 without details) | 6 |
| `GET /api/v1/salons` | Eight invalid queries: a limit of 0, over 100, or not a number; a boolean that is not `true` or `false`; a cursor that is not an ID; a rating above 5; an empty keyword; a parameter that does not exist | 8 |
| `PATCH /api/v1/salons/:id` | An ID that is not a UUID, an empty request, `null` for a NOT NULL column, a property the client may not set, an invalid calendar (400); an ID that no salon has (404); a deleted salon (404); the email of another salon (409) | 8 |
| `DELETE /api/v1/salons/:id` | Three malformed IDs (400); an ID that no salon has (404); a salon that is already deleted (404) | 5 |

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
- **Independent**: no test relies on another having run. Every API test gets a
  schema of its own and every migration test a database of its own.
- **Integration tests use the real thing**: the production `createApp`, the
  real repository, a real PostgreSQL. A failure is produced by real means — a
  database nothing listens on, a dropped column, a corrupt stored value — not
  by a mock.
- **Unit tests of use cases stub one thing**: the repository interface
  (`ISalonRepository`), with `vi.fn`. Schemas and mappers are tested without
  any stub.
- **Failures are asserted as values**: a use case or mapper through the
  `Result` it returns, an endpoint through its problem details.
- **Nothing internal leaks**: a test of a server-side failure asserts that the
  response carries no detail, and a test of logging asserts that the bound
  values of a statement and the request headers stay out of the log.
- **Test data is explicit**: a builder returns a complete valid request and a
  test overrides what it is about (`salonRequest(overrides)` in the endpoint
  tests, `salonCreateRequest()` in
  `backend/packages/domain/src/__tests__/fixtures.ts`). Dates are fixed, never
  taken from the clock.
- **The type rules apply to backend test code**: no `any`, no `as`. Tests are
  scripts, not application code, so a helper may `throw` when its
  precondition is not met.

## Checklist for a New Domain

A new domain follows the Salon tests file by file:

- [ ] Schema tests: every rule of every request schema, accepted and rejected
- [ ] Mapper tests: write and read mappers, including `null` and every change of representation
- [ ] Use case tests: success, each error passed on, no repository call on invalid input
- [ ] `backend/packages/api/src/__tests__/<domain>.integration.test.ts` meeting the [requirements per endpoint](#requirements-per-endpoint)
- [ ] `pnpm test` and `pnpm test:integration` pass

## Running the Tests

```bash
pnpm test                # every unit test (backend and frontend)
pnpm test:backend        # unit tests of the backend packages
pnpm test:frontend       # unit and component tests of the frontend
pnpm test:integration    # integration tests; needs Docker or TEST_DATABASE_URL
```

CI runs the unit tests once and the integration tests twice: against a
PostgreSQL service through `TEST_DATABASE_URL`, and with testcontainers. How to
run one package, one file or one test is in the
[API Testing Guide](./api-testing-guide.md).
