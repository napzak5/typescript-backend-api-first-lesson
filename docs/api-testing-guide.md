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
└── src/__tests__/
    ├── _shared/
    │   ├── setup.ts                 # the PostgreSQL instance of the run, a database for each test
    │   ├── test-databases.ts        # the template with the schema; copies and drops the databases
    │   ├── test-helpers.ts          # createTestApp, getTestDb, request
    │   ├── auth-helpers.ts          # users, staff, salons and sessions as rows; signing in
    │   └── two-factor-helpers.ts    # one-time passwords, stored secrets, a user with two-factor authentication
    ├── salon.integration.test.ts              # the Salon endpoints: the reference
    ├── service-category.integration.test.ts   # the service category endpoints: the reference for routes below a salon
    ├── service.integration.test.ts            # the service endpoints: a bulk operation, a soft delete below a salon, the repository called directly
    ├── auth.integration.test.ts               # signing in, tokens, the seeded accounts
    ├── auth-registration.integration.test.ts  # registration, email verification, passwords
    ├── auth-sessions.integration.test.ts      # the sessions of the signed-in user
    ├── auth-two-factor.integration.test.ts    # two-factor authentication
    ├── admin-auth.integration.test.ts         # what an administrator does to accounts
    └── app.integration.test.ts                # what the application does for every route
```

Unit tests of the same package (problem details, middleware, links, query
decoding) sit in `__tests__` directories beside the code they test and need no
database.

## Running

```bash
# Every integration test of the workspace (api, server, database, infrastructure)
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

CI runs the integration tests both ways.

The integration tests of the `infrastructure` package send mail to a real
SMTP server and use no database. They always start a Mailpit container
through testcontainers, so `pnpm test:integration` for the whole workspace
needs Docker even when `TEST_DATABASE_URL` is set. The API tests need no SMTP
server.

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
`api_test_template_<uuid>`, applies `backend/packages/database/sql/setup.sql`
to it as it is, and closes the connection. Around each test, the setup gives
the test a database of its own:

1. Before the test it creates a database named `api_test_<uuid>` as a copy of
   the template (`CREATE DATABASE … TEMPLATE …`) and opens a connection to it.
2. After the test it closes the connection and drops the database.

The template is dropped when the file is done.

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
`backend/packages/api/src/__tests__/salon.integration.test.ts`.

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
| Not found | 404 | `not-found` | `3001` | `null` |
| Already exists | 409 | `already-exists` | `3002` | `null` |
| The state does not allow the operation (the two-factor operations) | 409 | `operation-not-allowed` | `3003` | `null` |
| Database failure or corrupt stored data | 500 | `database` | `4003` | `null`, and `detail` is `null` too |

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
`auth.integration.test.ts` on the authentication endpoints. The Salon file
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

1. Create `backend/packages/api/src/__tests__/<domain>.integration.test.ts`;
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
