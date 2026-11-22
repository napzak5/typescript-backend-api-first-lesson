# API Testing Guide

How to write and run an integration test for an API endpoint in this
repository. What has to be covered, and to what standard, is in
[Testing Requirements](./testing-requirements.md); this guide shows the
mechanics, with the Salon tests as the example.

An API integration test sends HTTP requests to the production Express
application (`createApp`) and lets it work on a real PostgreSQL. Nothing is
mocked; the one part that is replaced is the mailer, which keeps the mails
for the test instead of sending them.

## Where the Tests Are

```
backend/packages/api/
├── vitest.config.ts                 # unit tests: src/**/*.test.ts
├── vitest.integration.config.ts     # integration tests: src/**/*.integration.test.ts
└── src/
    ├── routes/                      # the tests of the endpoints of a route are in its folder
    │   ├── salon/__tests__/salon.integration.test.ts                        # the Salon endpoints: the reference
    │   ├── service-category/__tests__/service-category.integration.test.ts  # the service category endpoints: the reference for routes below a salon
    │   ├── service/__tests__/service.integration.test.ts                    # the service endpoints: a bulk operation, a soft delete below a salon, the repository called directly
    │   ├── auth/__tests__/auth.integration.test.ts                          # signing in, tokens, the seeded accounts
    │   ├── auth/__tests__/auth-registration.integration.test.ts             # registration, email verification, passwords
    │   ├── auth/__tests__/auth-sessions.integration.test.ts                 # the sessions of the signed-in user
    │   ├── auth/__tests__/auth-two-factor.integration.test.ts               # two-factor authentication
    │   └── admin-auth/__tests__/admin-auth.integration.test.ts              # what an administrator does to accounts
    └── __tests__/                   # what is about no single route, and what all the tests share
        ├── _shared/
        │   ├── setup.ts                 # the PostgreSQL instance of the run, a database for each test
        │   ├── test-databases.ts        # the template with the schema; copies and drops the databases
        │   ├── test-helpers.ts          # createTestApp, getTestDb, request
        │   ├── auth-helpers.ts          # users, staff, salons and sessions as rows; signing in
        │   └── two-factor-helpers.ts    # one-time passwords, stored secrets, a user with two-factor authentication
        ├── test-server/                 # what the tests of the frontend call instead of a stub (see below)
        │   ├── main.ts                  # the program: the PostgreSQL instance, the template with the seed data
        │   ├── test-apis.ts             # the APIs it runs: createApp on a port and a database copy each
        │   └── control.ts               # the requests it answers: start, reset, query and remove an API
        ├── app.integration.test.ts            # what the application does for every route
        ├── request-dates.integration.test.ts  # the dates and moments a request may name, at the operations that take one
        └── write-stamps.integration.test.ts   # the time of a write that waited for another write of its row
```

An integration test is in the `__tests__` of the route folder whose handlers
it calls. Its file is named after the route, or after the part of the route
it covers (`auth-sessions`, `booking-status`). Where the name of a file
begins with no route, the file is where the handlers are: the tests of the
allergies of a customer are in `routes/medical-chart/__tests__/`, those of the
profile of the signed-in staff member in `routes/staff-profile/__tests__/`,
and those of the photos and the statistics of treatments in
`routes/treatment-record/__tests__/`.

Unit tests of the same package (problem details, middleware, links, query
decoding) sit in `__tests__` directories beside the code they test and need no
database.

## The Test Server

The tests of the frontend that call the API (`*.integration.test.ts(x)` in
`frontend/packages` and `frontend/apps`, and the browser tests in
`frontend/e2e`) run against the
production application as well, from another process. `test-server/` is the
program they start:

```bash
TEST_SERVER_TOKEN=<any value> pnpm --filter @beauty-salon-backend/api run test:server
# READY http://127.0.0.1:<port>
```

- It uses the PostgreSQL at `TEST_DATABASE_URL`, or starts a container, as the
  setup of the integration tests does. With `openTestDatabases` it builds one
  template that has the schema and the seed data (`seedDatabase` of the
  database package: the rows of `pnpm db:seed`).
- It starts a SeaweedFS container through testcontainers whatever
  `TEST_DATABASE_URL` says (`test-server/test-storage.ts`): the object
  storage that all its APIs keep their files in. A test sends a file to it
  at the URL an API signed and reads it back from a URL of a download, as a
  browser does; the files of one API are never those of another, since
  every file is stored under the ID of its attachment. So the test server
  always needs Docker.
- It answers on the loopback address, and only requests that carry
  `Authorization: Bearer <TEST_SERVER_TOKEN>`; the process that starts it
  chooses the token. Every other request is answered with 401.

| Request | What it does | Answer |
|---------|--------------|--------|
| `POST /apis` with `{ port, corsOrigins, publicAppUrl }` | Starts an API: `createApp` on a copy of the template. `port` is the port to listen on, or `null` for a free one; `corsOrigins` are the origins whose pages may call the API from a browser; `publicAppUrl` is the origin the links in its mails point at, or `null` | 201 `{ id, origin, seedPassword }`; 400 `{ issues }` when the body is not of that shape; 409 `{ message }` when the port is taken |
| `POST /apis/{id}/reset` | Gives the API a new copy of the template, drops the previous one and forgets the mails | 204 |
| `GET /apis/{id}/mails` | What the API handed to its mailer since the last reset, oldest first | 200 `{ mails }`, each with `to`, `subject` and `text` |
| `POST /apis/{id}/query` with `{ text, values }` | Runs the statement on the database of the API | 200 `{ rows }`; 400 `{ message }` when the body is not of that shape or the database refuses the statement |
| `DELETE /apis/{id}` | Stops the API and drops its database | 204 |
| `POST /authenticator-codes` with `{ secret, stepsAhead }` | Computes the code an authenticator app shows for the secret (Base32) now (`stepsAhead: 0`) or in the next 30 seconds (`1`): a test has no such app | 200 `{ code }`; 400 `{ issues }` when the body is not of that shape |

An unknown `id` is answered with 404.

A test in jsdom calls its API with the `fetch` of Node.js, which asks no
permission: it starts its API on a free port and opens it to no origin. A
run of the browser tests starts one API, on the port that the applications
were built for, and names the origins of the applications: a browser asks
the API before a page of another origin may call it, as it does in
production (`CORS_ORIGIN`). A reset keeps the port, the origins and the
origin of the links.

No mail is sent anywhere. The API keeps what it would send, and a test reads
there the link a person would find in their mailbox: a browser test opens
it (the run names its portal as `publicAppUrl`), a test in jsdom renders the
screen at the path of the link. A reset starts an empty list, so the mails
of a test are those of that test.

The API takes a code of an authenticator app once, and after it only later
ones ([Two-factor authentication](./authentication.md#2-要素認証)). A test
that sets two-factor authentication up with the code of now therefore signs
in with the code of the next 30 seconds, which the API takes as well, or
with a backup code.

The APIs are created like `createTestApp` creates the application of a test:
the same rate limit, the object storage of the test server, the real `TotpAuthenticator`,
and a mailer that keeps the mails for the test to read. No origin is allowed
by CORS unless the API is started with one: the tests
that call an API run in jsdom, where `fetch` is that of Node.js and applies
no same-origin policy.

The program stops when its standard input ends, so it does not outlive the
process that started it, and on `SIGINT` or `SIGTERM`. It then stops the APIs,
drops their databases and the template, and removes the containers it started.

How a test of the frontend uses it is in the skill
[frontend-testing](../.claude/skills/frontend-testing/SKILL.md).

## Running

```bash
# Every integration test of the workspace (api, server, database, infrastructure, and the frontend packages that call the API)
pnpm test:integration

# The API package only
pnpm --filter @beauty-salon-backend/api run test:integration

# Files whose path contains "salon"
pnpm --filter @beauty-salon-backend/api run test:integration salon

# Tests whose name matches
pnpm --filter @beauty-salon-backend/api run test:integration -t "POST /api/v1/salons"

# The unit tests of the package (no database)
pnpm --filter @beauty-salon-backend/api run test
```

The integration tests need a PostgreSQL. There are two ways to give them one.

**Docker running, nothing set.** The setup starts a `postgres:18-alpine`
container through testcontainers and stops it afterwards.

Testcontainers finds Docker Desktop by itself. Another runtime has to be
named, or the run ends with `Could not find a working container runtime
strategy`. For Colima, the
[testcontainers documentation](https://node.testcontainers.org/supported-container-runtimes/)
gives these two variables:

```bash
export DOCKER_HOST=unix://${HOME}/.colima/default/docker.sock
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
```

**`TEST_DATABASE_URL` set.** The setup uses that PostgreSQL instance and starts no
container:

```bash
TEST_DATABASE_URL=postgres://<user>:<password>@localhost:5432/<database> pnpm test:integration
```

The tests change nothing in the database the URL names, so the instance of
`make infra-up` can be used. They create and drop databases of their own on
the same instance, one per test, so the user needs the right to create
databases.

CI runs the integration tests both ways. Each way is cut into four parts,
run by four jobs side by side: every package's test files are split by
Vitest's `--shard` (`pnpm test:integration --shard=<part>/4
--passWithNoTests`). `pnpm test:integration` does not wait for the tests of
a package's dependencies (`pnpm -r --no-sort`), so the API tests do not
wait for those of the database package. A pull request that changes nothing
but the frontend, the docs and the skills runs the unit and integration
tests of the packages it changed and of those that depend on them only
(the `scope` job of `ci.yml`); any other change runs them all.

The integration tests of the `infrastructure` package send mail to a real
SMTP server and use no database. They always start a Mailpit container
through testcontainers, so `pnpm test:integration` for the whole workspace
needs Docker even when `TEST_DATABASE_URL` is set. The API tests need no SMTP
server.

The integration tests of the file storage (`S3FileStorage`, in
`backend/packages/infrastructure/src/storage/__tests__/`) upload and download
through signed URLs against a real S3-compatible storage: a SeaweedFS container
they start through testcontainers, or the storage that `TEST_STORAGE_ENDPOINT`,
`TEST_STORAGE_REGION`, `TEST_STORAGE_BUCKET`, `TEST_STORAGE_ACCESS_KEY_ID` and
`TEST_STORAGE_SECRET_ACCESS_KEY` name, where they write below a random prefix
and remove what they wrote. The API tests need no storage: `createTestApp`
gives the app an `InMemoryFileStorage`
(`backend/packages/api/src/__tests__/_shared/in-memory-file-storage.ts`), which
keeps the files in a map, notes every call in its order and fails the calls a
test names ([Attachments](./attachments.md#テスト), Japanese).

## How a Test Gets Its Database

`vitest.integration.config.ts` names `src/__tests__/_shared/setup.ts` as a
setup file, so its hooks run around every integration test of the package.

Once per test file, the setup picks the PostgreSQL instance and builds a
template on it:

```typescript
// backend/packages/api/src/__tests__/_shared/setup.ts (excerpt)
beforeAll(async () => {
  const { TEST_DATABASE_URL: externalUrl } = process.env

  if (!externalUrl) {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withStartupTimeout(120000)
      .start()
  }

  databases = await openTestDatabases(
    container?.getConnectionUri() ?? externalUrl ?? '',
  )
})
```

`openTestDatabases` (`test-databases.ts`) creates a database named
`api_test_<mark>_template`, applies `backend/packages/database/sql/setup.sql`
to it as it is, and closes the connection. Its tables are empty: a caller
that wants every copy to start with rows passes a function that inserts them
into the template, which only the test server does. Around each test, the
setup gives the test a database of its own:

1. Before the test it creates a database named `api_test_<mark>_<uuid>` as a
   copy of the template (`CREATE DATABASE … TEMPLATE …`) and opens a connection to it.
2. After the test it closes the connection and drops the database.

The template is dropped when the file is done. The mark (12 hexadecimal
digits) is chosen once per call of `openTestDatabases`, so the databases of
one file, or of one test server, are told from those that other files and
servers make and drop on the same instance meanwhile (a job of the
integration tests in CI runs the tests of every package on one PostgreSQL,
the service of the job).

PostgreSQL copies a database much faster than it applies the schema again
(about 250 statements), which is why the schema is applied once per file and
not once per test. A database can only be copied while nothing is connected
to it, so nothing may connect to the template after it is built.

Three things follow from this:

- Every test starts with empty tables and cleans up nothing. Tests cannot see
  each other's rows, and a test may change a table's definition without
  affecting another test.
- The tables, types and constraints are in `public`, as in a database made by
  `pnpm db:fresh`.
- The tests run against `sql/setup.sql`, not against the migrations. After
  writing a migration, regenerate it (`pnpm db:generate-sql`, see the
  [Development Workflow](./development-workflow.md)) or the tests will not see
  the change. The migration test fails until you do: it applies every
  migration to a database created from `setup.sql` and expects the schema to
  stay the same.

Test files run one at a time (`fileParallelism: false`), which keeps the
number of open connections bounded. A test may take up to 60 seconds and a
hook up to 120, enough for the first start of the container.

## The Application under Test

`test-helpers.ts` builds the same application the server runs, with a mailer
that hands the mails to the test and with the real `TotpAuthenticator` under
a key of its own (`TWO_FACTOR_ENCRYPTION_KEY`):

```typescript
// backend/packages/api/src/__tests__/_shared/test-helpers.ts (excerpt)
export type TestAppOptions = {
  /** The test's isolated database unless another one is given. */
  database?: Database
  rateLimit?: AppSettings['rateLimit']
  /** Receives every line the application logs, parsed. Not logged if absent. */
  logs?: unknown[]
  /** Receives every mail the application hands over. Dropped if absent. */
  mails?: Mail[]
}

export function createTestApp({
  database = getTestDb(),
  rateLimit = settings.rateLimit,
  logs,
  mails,
}: TestAppOptions = {}): Express {
  return createApp({
    database,
    settings: { ...settings, rateLimit },
    mailer: { deliver: (mail) => mails?.push(mail) },
    twoFactorAuthenticator: new TotpAuthenticator(TWO_FACTOR_ENCRYPTION_KEY),
    logger: createLogger(
      {
        level: logs === undefined ? 'silent' : 'info',
        format: 'json',
        environment: 'test',
      },
      { write: (line) => logs?.push(JSON.parse(line)) },
    ),
  })
}
```

| Helper | Use |
|--------|-----|
| `createTestApp()` | The application on the test's own database, with logging silent and mails dropped |
| `createTestApp({ logs })` | The same, collecting every log line as a parsed object in `logs` |
| `createTestApp({ mails })` | The same, collecting every mail the application hands to its mailer (`to`, `subject`, `text`) in `mails` |
| `createTestApp({ rateLimit })` | A lower rate limit, to test the limit itself |
| `createTestApp({ database })` | Another database, for example an unreachable one |
| `getTestDb()` | The Drizzle database of the test's own database, to arrange or inspect rows |
| `getTestDbClient()` | The postgres.js client under `getTestDb()`, for code that builds a Drizzle instance of its own (the authentication tests run the seed with it) |
| `connectUnreachableDatabase()` | A connection nothing answers: every query fails at once |
| `PUBLIC_APP_URL` | The origin of the web application in the test settings: the links in the mails start with it |
| `TWO_FACTOR_ENCRYPTION_KEY` | The key under which the application under test encrypts the secrets of authenticator apps |
| `request` | supertest |

Every operation that is not public needs an access token, and the tests get
one the way a client does: by signing in. `auth-helpers.ts` has the helpers.
Registration creates customer accounts only, and such an account cannot sign
in before its email address is confirmed, so the users are inserted as rows,
with a password hashed by the hasher the application uses
(`Argon2PasswordHasher`). That password, `PASSWORD`
(`'correct horse battery staple'`), signs the inserted users in, but the API
refuses it as a new password because it is a well-known one: a test that
registers a user or sets a password through the API has to send a different
one (see [Authentication and Authorization](./authentication.md) for the
rules).

| Helper of `auth-helpers.ts` | Use |
|-----------------------------|-----|
| `signInAsAdmin(app, db)` | Inserts an admin, signs in and returns the value of the `Authorization` header |
| `signedInUser(app, db, overrides)` | Inserts a user (an active customer unless overridden), signs in and returns the user with the tokens and the header value |
| `insertUser(db, overrides)`, `insertMember(db, role, salonId)` | A user row; with `insertMember`, an owner, manager or staff user linked to a new staff member of the salon |
| `insertSalon(db)`, `insertCustomer(db)` | The rows a user's role refers to, each returning the ID |
| `signIn(app, email)` | `POST /api/v1/auth/login` with `PASSWORD`; returns `accessToken`, `refreshToken`, `authorization` and the user. A third argument overrides properties of the login request, for example `{ twoFactorCode }` for an account with two-factor authentication |
| `insertSession(db, userId, overrides)` | Stores a session of the user as a row, for times that no login produces (by default it started an hour ago); returns `id`, `accessToken`, `refreshToken` and `authorization`, and the tokens work like those of a login |
| `sessionIdOf(db, accessToken)` | The ID of the stored session that an access token belongs to |

## Writing a Test

The excerpts are from
`backend/packages/api/src/routes/salon/__tests__/salon.integration.test.ts`.

### 1. Set up the application

```typescript
import {
  insertCustomer,
  insertMember,
  insertSalon,
  signedInUser,
  signIn,
  signInAsAdmin,
} from './_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from './_shared/test-helpers'

const SALONS = '/api/v1/salons'

describe('Salon API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
  })

  // ... one describe block per endpoint ...
})
```

An admin may call every Salon operation, so the tests that are not about
permissions send `asAdmin`.

### 2. Build requests from one valid request

A function returns a request that satisfies every rule, and each test
overrides only what it is about. The Create model requires every property, so
the builder lists them all (abridged here):

```typescript
/** A request that satisfies every rule. */
const salonRequest = (overrides: Record<string, unknown> = {}) => ({
  name: 'Hair Studio Aoyama',
  nameKana: 'ヘアスタジオアオヤマ',
  // ... the other properties of the request ...
  openingHours: [workingMonday, holidayMonday],
  ...overrides,
})
```

State that a test needs is created through the API, with small helpers inside
the `describe` block:

```typescript
const createSalon = async (overrides: Record<string, unknown> = {}) => {
  const response = await request(app)
    .post(SALONS)
    .set('Authorization', asAdmin)
    .send(salonRequest(overrides))
  expect(response.status).toBe(201)
  return response.body.data
}
```

### 3. Assert the whole success response

```typescript
it('creates the salon and returns it with what the server assigned', async () => {
  const response = await request(app)
    .post(SALONS)
    .set('Authorization', asAdmin)
    .send(salonRequest())

  expect(response.status).toBe(201)
  const { data, meta, links } = response.body
  expect(data).toEqual({
    ...salonRequest(),
    openingHours: storedCalendar,
    id: expect.stringMatching(UUID),
    rating: null,
    reviewCount: 0,
    createdAt: expect.stringMatching(ISO_TIMESTAMP),
    updatedAt: expect.stringMatching(ISO_TIMESTAMP),
  })
  expect(response.headers['location']).toBe(`${SALONS}/${data.id}`)
  expect(links).toEqual({ self: `${SALONS}/${data.id}`, list: SALONS })
  expect(meta).toEqual({
    correlationId: expect.stringMatching(UUID),
    timestamp: expect.stringMatching(ISO_TIMESTAMP),
    version: 'v1',
  })

  const stored = await request(app).get(`${SALONS}/${data.id}`)
  expect(stored.body.data).toEqual(data)
})
```

`toEqual` on the whole object fails when the response gains or loses a
property, which `toMatchObject` on a few properties would not notice. The last
two lines read the salon back: what was returned is what was stored.

### 4. Assert errors as problem details

Every error response is RFC 9457 problem details, sent as
`application/problem+json`. Two helpers in `_shared/test-helpers.ts` keep the
assertions short, and each test file names the problems it expects:

```typescript
// _shared/test-helpers.ts
export type ExpectedProblem = { status: number; code: string; type: string }

export const expectProblem = (
  response: Response,
  expected: ExpectedProblem,
): void => {
  expect(response.status).toBe(expected.status)
  expect(response.headers['content-type']).toBe(
    'application/problem+json; charset=utf-8',
  )
  expect(response.body).toMatchObject({
    type: `urn:beauty-salon:problem:${expected.type}`,
    status: expected.status,
    code: expected.code,
    instance: response.request.url.replace(/^https?:\/\/[^/]+/, ''),
    timestamp: expect.stringMatching(ISO_TIMESTAMP),
  })
}

export const brokenRules = (response: Response): string[] =>
  response.body.errors.map(
    ({ field, rule }: { field: string; rule: string }) => `${field}:${rule}`,
  )

// salon.integration.test.ts
const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const conflict = { status: 409, code: '3002', type: 'already-exists' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }
```

The kinds of error an endpoint test meets:

| Error | Status | `type` after `urn:beauty-salon:problem:` | `code` | `errors` |
|-------|--------|------------------------------------------|--------|----------|
| Validation | 400 | `validation` | `2001` | One entry per broken rule: `field` (a dot path, empty for the input as a whole), `rule`, `message` |
| No access token | 401 | `authentication-required` | `1001` | `null` |
| A token the server does not accept | 401 | `invalid-token`, or `token-expired` for an access token past its end | `1004`, `1003` | `null` |
| Wrong email or password (login only) | 401 | `invalid-credentials` | `1002` | `null` |
| Right password, and the code of two-factor authentication is missing or refused (login only) | 401 | `two-factor-required` | `1007` | `null` |
| Not allowed | 403 | `forbidden` | `1005` | `null` |
| A share link has a password and the request brought none that is accepted (the two operations of a viewer only) | 403 | `password-required` | `1002` | `null` |
| Not found | 404 | `not-found` | `3001` | `null` |
| Already exists | 409 | `already-exists` | `3002` | `null` |
| The state does not allow the operation (the two-factor operations) | 409 | `operation-not-allowed` | `3003` | `null` |
| Database failure or corrupt stored data | 500 | `database` | `4003` | `null`, and `detail` is `null` too |
| A call to the object storage of the attachments failed | 500 | `storage` | `4004` | `null`, and `detail` is `null` too |

Every 401 also carries a `WWW-Authenticate` header.
`backend/packages/api/src/shared/problem-details.ts` defines these and the
errors of the HTTP layer itself (unknown route, unreadable body, rate limit),
which `app.integration.test.ts` covers once for all routes.

Invalid inputs that differ only in the value go into one table. Each row is
one of the five or more error scenarios the endpoint needs (three of the seven
rows are shown):

```typescript
it.each([
  ['a missing property', { city: undefined }, ['city:invalid_type']],
  [
    'a property the client may not set',
    { rating: 5 },
    ['rating:unrecognized_keys'],
  ],
  ['null for a NOT NULL column', { name: null }, ['name:invalid_type']],
])('rejects %s and stores nothing', async (_case, change, expected) => {
  const response = await request(app)
    .post(SALONS)
    .set('Authorization', asAdmin)
    .send(salonRequest(change))

  expectProblem(response, badRequest)
  expect(brokenRules(response)).toEqual(expected)
  expect(await db.$count(salons)).toBe(0)
})
```

The last line checks the state: a rejected request stored nothing. An error
that depends on existing data arranges it first:

```typescript
it('rejects an email that another salon uses', async () => {
  await createSalon()

  const response = await request(app)
    .post(SALONS)
    .set('Authorization', asAdmin)
    .send(salonRequest({ name: 'Second salon' }))

  expectProblem(response, conflict)
  expect(response.body.detail).toBe(
    'Salon with email aoyama@example.com already exists',
  )
  expect(await db.$count(salons)).toBe(1)
})
```

### 5. Test who may call the operation

An operation that is not public is tested without a token and as each kind of
user who is not allowed. The Salon file keeps these scenarios in one
`describe('who may change salons', …)` block. Without a token the answer is
401 and nothing is stored:

```typescript
it('asks for an access token and stores nothing without one', async () => {
  const response = await request(app).post(SALONS).send(salonRequest())

  expectProblem(response, authenticationRequired)
  expect(response.headers['www-authenticate']).toBe(
    'Bearer realm="beauty-salon-api"',
  )
  expect(await db.$count(salons)).toBe(0)
})
```

The users who are refused go into one table. Each row names the user and
gives a function that inserts that user and signs in (`member`,
`memberOfOther`, `customer` and `staffUserWithoutStaffMember` are defined in
the block, on top of `insertMember`, `signedInUser` and `signIn`):

```typescript
it.each<[string, SignInAs]>([
  ['a manager of the salon', member('manager')],
  ['the owner of another salon', memberOfOther('owner')],
  ['a staff member of the salon', member('staff')],
  ['a customer', customer],
  ['a staff user without a staff member', staffUserWithoutStaffMember],
])(
  'forbids %s to delete the salon and deletes nothing',
  async (_case, signInAs) => {
    const created = await createSalon()
    const authorization = await signInAs(
      created.id,
      await insertSalon(db),
    )

    const response = await request(app)
      .delete(`${SALONS}/${created.id}`)
      .set('Authorization', authorization)

    expectProblem(response, forbidden)
    expect(
      (await request(app).get(`${SALONS}/${created.id}`)).status,
    ).toBe(200)
  },
)
```

Where a permission belongs to one salon, the table has a user with the same
role at another salon, and the block also has the scenarios that succeed for
somebody other than an admin (the owner and a manager change their salon, the
owner deletes it). What the server does with a token (an expired one, one of
a signed-out session, one of a suspended user) is tested in
`backend/packages/api/src/routes/auth/__tests__/auth.integration.test.ts` on the authentication endpoints. The Salon file
repeats one such case only, a token that names no session.

### 6. Write to the database only for what the API cannot produce

`getTestDb()` is for inspecting rows and for states no request can create,
such as an admin (registration creates customer accounts only) or a stored
value that does not have the shape the schema promises:

```typescript
it('answers 500 without details when the stored salon is corrupt', async () => {
  const created = await createSalon()
  await db
    .update(salons)
    .set({ businessHours: { monday: 'ten to seven' } })
    .where(eq(salons.id, created.id))

  const response = await request(app).get(`${SALONS}/${created.id}`)

  expectProblem(response, { status: 500, code: '4003', type: 'database' })
  expect(response.body.detail).toBeNull()
  expect(JSON.stringify(response.body)).not.toContain('ten to seven')
})
```

## Testing Failures and Logs

A failing database is a real one that does not answer, and the log is read
through the `logs` option. From
`backend/packages/api/src/__tests__/app.integration.test.ts` (the assertions on
the response body are left out here):

```typescript
it('should answer 500 without the cause and log the cause under the request ID', async () => {
  const connection = connectUnreachableDatabase()
  const logs: unknown[] = []
  const app = createTestApp({ database: connection.database, logs })

  const response = await request(app).get(SALONS)
  await connection.close()

  expect(response.status).toBe(500)
  expect(logs).toContainEqual(
    expect.objectContaining({
      level: 'error',
      req: expect.objectContaining({ id: response.headers['x-request-id'] }),
      msg: 'Failed to list salons',
      cause: expect.objectContaining({ code: 'ECONNREFUSED' }),
    }),
  )
})
```

## Tests for a New Domain

1. Create `backend/packages/api/src/routes/<domain>/__tests__/<domain>.integration.test.ts`;
   the name must end in `.integration.test.ts` to be picked up.
2. Start from the structure of the Salon file: the `beforeEach` that signs
   in, a builder for a valid request, helpers that create state through the
   API.
3. For each endpoint write the scenarios listed in
   [Testing Requirements](./testing-requirements.md): the success response in
   full, at least five error scenarios, who may call it, the state after the
   request, deleted resources.
4. Check problems with `expectProblem` and `brokenRules`, and timestamps
   and IDs with `ISO_TIMESTAMP` and `UUID`, from `_shared/test-helpers.ts`;
   do not copy them into the new file.
