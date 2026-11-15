# Beauty Salon Backend Architecture Overview

This document explains the system as a whole: what exists, how the packages
depend on each other, where the types come from, and what happens to a request
from the moment the server starts. Read it first.

It does not say how to write code. For that, see:

- [CLAUDE.md](../CLAUDE.md): the rules, the conventions and the commands. It
  is the canonical statement, and this document does not repeat it.
- [Backend Architecture Guidelines](./backend-architecture-guidelines.md)
  (Japanese): how to write backend code in each layer, with the Salon files as
  the reference.

## Table of Contents

1. [What Is Implemented](#what-is-implemented)
2. [Architecture Principles](#architecture-principles)
3. [Directory Structure](#directory-structure)
4. [Layers and Package Dependencies](#layers-and-package-dependencies)
5. [Type Generation Pipeline](#type-generation-pipeline)
6. [Database](#database)
7. [Request Flow](#request-flow)
8. [Errors](#errors)
9. [Configuration, Logging and Probes](#configuration-logging-and-probes)
10. [Tests, CI and Images](#tests-ci-and-images)
11. [Frontend](#frontend)
12. [References](#references)

## What Is Implemented

The API contract and the database schema cover far more than the code does.
Before relying on anything, check this table.

| Area | State |
|------|-------|
| Salon API (`/api/v1/salons`) | Implemented in every layer: list, create, get, update, delete. It is the reference implementation for every other domain. List and get are public; create, update and delete need a signed-in user with the permission. |
| Service categories of a salon (`/api/v1/salons/{salonId}/service-categories`) | Implemented in every layer: list, create, get, update, delete, the five operations of `ServiceCategoryCrud`. They are the example of data that belongs to a salon: the routes are below the salon, and a category that is not of the salon in the path is answered with 404. List and get are public; create, update and delete need a signed-in user with the permission. See [Service Menu](./service-menu.md) (Japanese). |
| Services of a salon (`/api/v1/salons/{salonId}/services`) | Implemented in every layer: list, create, get, update, bulk update, delete, the six operations of `ServiceCrud`. A service carries its options (the rows of `service_options`) in its requests and responses, and a package names the services it combines. The bulk update changes all the services it names or none of them. A delete keeps the row and marks it with `deletedAt`, and is refused with 409 while a package contains the service. List and get are public; create, update, bulk update and delete need a signed-in user with the permission. `isActive`, `serviceStatus`, `availability`, `bookingRequirements` and `maxBookingsPerDay` are stored and returned, and the list can filter by `isActive`; nothing else reads them: which services can be booked is not decided yet. See [Service Menu](./service-menu.md) (Japanese). |
| Customer ledger (`/api/v1/customers`) | Implemented in every layer: list, create, get, update, delete, five of the 18 operations of `CustomerCrud`. A customer belongs to no salon: the ledger is one for the whole platform, and its routes are not below a salon. No operation is public: list, create, get and update need a signed-in administrator or member of a salon (owner, manager or staff of any salon), delete an administrator, an owner or a manager. A delete keeps the row and marks it with `deletedAt`. The other 13 operations of `CustomerCrud` are not implemented: the preferences (`PATCH /api/v1/customers/{id}/preferences`), batch get, bulk create, bulk update, bulk delete, restore, merge, audit history, versions, the two exports, statistics and the data deletion request. A signed-in customer reaches no route of the ledger; their own record is the profile of the next row. `isActive` and `customerStatus` are stored and returned, and the list can filter by `customerStatus`; nothing else reads them: which customers can book is not decided yet. Nothing maintains the points, the lifetime value or the visit counters. See [Customer Ledger](./customers.md) (Japanese). |
| Customer profile (`/api/v1/customers/me`) | Implemented in every layer: get, create, update, the three operations of `CustomerProfile`. The profile is the customer record of the signed-in account. The route names no record: the account alone says which one, so a customer reaches no other. Only a customer account has a profile; an administrator and a member of a salon are answered with 403. A registered user has no record until they create the profile. The creation takes over the customer that the ledger has under the account's email address, unless that customer belongs to another account (409), and needs an account that has confirmed its address (409); without such a customer it adds one to the ledger. The response leaves out what the staff keep to themselves (notes, tags, status, the referrer, the lifetime value, the counts of no-shows and cancellations), and the requests write only what is the customer's own: the name, the contact details, the birth date, the preferences and the three consents. A delete of the customer in the ledger takes the profile from the account, which may then create a new one. See [Customer Ledger](./customers.md) (Japanese). |
| Staff ledger of a salon (`/api/v1/salons/{salonId}/staff`) | Implemented in every layer: list, create, get, update, delete, five of the seven operations of `StaffCrud`. The ledger is what a salon keeps about its staff as their employer: names and contact details, the terms of employment (base salary, commission rate, employment type, hire date) and how a staff member takes bookings. Nothing of it is public, reading included: every operation needs an administrator or the owner of the salon in the path; a manager and a staff member are answered with 403. Deactivating (`isActive: false`) or deleting a staff member takes the salon from the login account that is linked to it, from its next request on, so nobody deactivates or deletes the staff member their own account belongs to (409). The email is unique among the staff members of one salon who are not deleted, the staff code among all staff members of the salon. A delete keeps the row and marks it with `deletedAt`. Not implemented: the schedules of a staff member (`getAvailability`, `updateAvailability`), the search across salons (`GlobalStaff`), a profile of a staff member that customers may see, and linking a login account to a staff member. See [Staff Ledger](./staff.md) (Japanese). |
| Authentication (`/api/v1/auth`, `/api/v1/admin/auth`) | Implemented: `login`, `refresh`, `logout`, `logout-all` and `me`, on server-side sessions with opaque bearer tokens, and registration of customer accounts, email verification and password reset, each through a single-use token sent by mail, and password change, and two-factor authentication with the one-time passwords of an authenticator app (TOTP) and backup codes, and the list of the signed-in user's sessions with the revocation of one of them, and under `/api/v1/admin/auth` the administrator operations: read a user, unlock an account, reset two-factor authentication. That is every operation in `specs/operations/auth-operations.tsp`: the 16 of `AuthCrud`, the 2 of `SessionCrud` and the 3 of `AdminAuthCrud`. See [Authentication and Authorization](./authentication.md). |
| Authorization | Implemented for the Salon API (create, update, delete), for the service categories of a salon (create, update, delete), for the services of a salon (create, update, bulk update, delete), for the customer ledger and a customer's own profile (every operation), for the staff ledger of a salon (every operation) and for the administrator operations. An implemented operation that the contract does not mark `@useAuth(NoAuth)` needs a valid access token, and its use case decides whether the signed-in user may do what is asked. |
| System endpoints (`/api/system`) | Implemented: `alive`, `ready` and `health`. |
| The other domains (booking, review, treatment, payment, inventory) | Specified in TypeSpec, so their generated types exist, and the database schema has their tables and seed data. The models agree with the tables (`pnpm check:api-db`). There is no domain, repository or route code. A request to one of these routes is answered with 404. The implementation order is in GitHub issue #4. |
| Attachments, roles and permissions, purchase orders, medical charts | Specified in TypeSpec only. No table exists for them yet. |
| Email | Implemented for the mails of the authentication flows (confirm the address, reset the password, and the notices: the password was changed, two-factor authentication was enabled, disabled or turned off by an administrator, the backup codes were replaced, a backup code was used to sign in): plain text over SMTP. Docker Compose starts Mailpit, which catches them locally. See [Email](./email.md) (Japanese). |
| File storage | Not implemented. Docker Compose starts no service for it. |
| Frontend | Three application shells and shared packages. The API client is generated, but no application calls the API yet. See [Frontend](#frontend). |

## Architecture Principles

[CLAUDE.md](../CLAUDE.md) lists the principles as rules. This is how they
shape the system, and why:

- **API-first.** The TypeSpec files in `specs/` are the contract. The OpenAPI
  document, the backend types and the frontend client are generated from them,
  and CI rejects generated files that are out of date, so the API cannot drift
  from its definition.
- **Database-driven models.** The database decides the stored shape.
  `schema.ts` is generated from the database, the domain types are inferred
  from `schema.ts`, and API property names and nullability follow the columns.
  Nobody maintains a second description of a table.
- **One direction of dependency.** Each package depends only on packages
  below it (see [Layers and Package Dependencies](#layers-and-package-dependencies)).
  The domain declares the repository interface; the infrastructure implements
  it.
- **Validation in the use case.** A handler passes the request body on as
  `unknown`. The use case validates it with a Zod schema that is checked
  against the generated request type. Input becomes trusted in one place, and
  that place is unit-tested without HTTP.
- **Authorization in the use case.** The HTTP layer only establishes who is
  asking: `authenticated` turns the bearer token into an `Actor` or answers
  401. The use case of a protected operation takes the actor as its first
  argument and decides whether that actor may do what is asked, so a
  permission rule is a pure function that is unit-tested like any other
  rule. See [Authentication and Authorization](./authentication.md).
- **Errors are values.** Every operation that can fail returns a
  `Result<T, E>`, so its signature states how it can fail. Application code
  does not throw, and it contains exactly two `try`/`catch`:
  `Result.fromPromise` and `Result.fromThrowable` in
  `backend/packages/utility/src/result/result.ts`, which turn what code
  outside the application throws (in practice the database driver, and
  `node:crypto` when a stored secret cannot be decrypted) into a `Result`.
  Whatever still escapes a route, such as an unreadable body
  or a defect, is forwarded by Express to the error-handling middleware at
  the end of the chain.
- **Sum types, matched exhaustively.** Results, errors and other states are
  discriminated unions handled with ts-pattern, so adding a case fails the
  build until every match handles it.
- **Separate write and read mappers.** A request and a response of the same
  resource have different shapes. Property names never change between the API
  and the database; the mappers only convert representations (`numeric` to
  number, `timestamptz` to ISO 8601) and check `jsonb` values against the API
  model.
- **Nothing is passed through a global.** Dependencies are built once at
  start-up and handed down as arguments, and only the server's entry point
  reads the environment. The integration tests call the same `createApp` with
  a database schema of their own, so they test the application that runs in
  production.

## Directory Structure

```
.
├── specs/                   TypeSpec definitions (models/, operations/) and the
│                            generated OpenAPI document (tsp-output/)
├── backend/
│   ├── packages/
│   │   ├── utility/         Result type and type helpers
│   │   ├── generated/       API types generated from the OpenAPI document
│   │   ├── config/          Environment files and parseAppConfig
│   │   ├── database/        Drizzle schema, SQL, migration and seed scripts
│   │   ├── domain/          Models, validation schemas, mappers, use cases,
│   │   │                    repository and service interfaces, errors
│   │   ├── infrastructure/  Database connection, repository implementations,
│   │   │                    password hashing, tokens, one-time passwords,
│   │   │                    mail over SMTP, logger
│   │   └── api/             Express application: middleware, routes,
│   │                        authentication, error responses
│   └── apps/
│       └── server/          The process that runs the API
├── frontend/
│   ├── packages/            Shared packages, including the generated API client
│   └── apps/                admin-app, portal-app, dashboard-app
├── shared-config/           Shared tsconfig files
├── scripts/                 Repository scripts, run with node
├── docs/
├── Dockerfile.backend, Dockerfile.frontend, docker-compose.yml
└── Makefile, package.json   Every command (see CLAUDE.md)
```

Inside a backend package the code is grouped by kind, then by domain. The
Salon files show the pattern:

```
domain/src/
├── models/salon.ts                    ID, API and database types
├── schemas/salon.schema.ts            Zod schema of each request
├── schemas/rules.ts                   nonBlankText, lowerCaseEmail, phoneNumber, MAX_INTEGER,
│                                      noRepeatedEntries, atLeastOneProperty (the schemas of
│                                      more than one domain)
├── mappers/write/salon.mapper.ts      API request → rows
├── mappers/read/salon.mapper.ts       Rows → API response
├── mappers/read/columns.ts            numericSchema, timestampSchema (every read mapper)
├── repositories/salon.repository.ts   ISalonRepository
├── business-logic/salon/              One *.usecase.ts per operation;
│                                      _shared/authorization.ts decides who may
└── shared/                            DomainError, parseWith

infrastructure/src/
├── database/                          Connection, ping, attempt, log-safe failure description,
│                                      the LIKE pattern of a keyword (containing)
├── logging/logger.ts                  createLogger
└── repositories/salon.repository.impl.ts

api/src/
├── index.ts                           createApp
├── settings.ts                        AppSettings
├── middleware/                        Request logging, rate limit, error handlers
├── routes/salon/                      One *.handler.ts per operation, index.ts (router)
├── routes/system/index.ts             alive, ready, health
└── shared/                            Problem details, response helpers, API version,
                                       authentication (authenticated), JsonBody, the links
                                       of a page (pageLinks), the converters of query
                                       parameters, the signed-in user of a request
```

Authentication has the same layout, with what only it needs added:

```
domain/src/
├── models/auth.ts                     IDs, API and database types, Actor and ActorScope
├── schemas/auth.schema.ts             Zod schema of each request
├── mappers/read/user.mapper.ts        Row of users → API response
├── mappers/read/session.mapper.ts     Rows of sessions → API response
├── repositories/user.repository.ts    IUserRepository
├── repositories/session.repository.ts ISessionRepository
├── services/                          IPasswordHasher, ITokenIssuer, ITwoFactorAuthenticator,
│                                      IMailer
└── business-logic/auth/               One *.usecase.ts per operation, AuthenticateUseCase;
                                       _shared/ holds what they share: dependencies, the actor,
                                       session policy, password check and blocklist, the limit
                                       on guesses, the check of the second factor, the set-up
                                       of two-factor authentication, the answer for a session
                                       whose user is gone, mailed tokens, the texts of the mails,
                                       who may administer accounts (authorization.ts)

infrastructure/src/
├── repositories/user.repository.impl.ts, session.repository.impl.ts, account.ts
├── security/                          Argon2PasswordHasher, RandomTokenIssuer, TotpAuthenticator
└── mail/smtp-mailer.ts                SmtpMailer

api/src/
├── routes/auth/                       One *.handler.ts per operation of AuthCrud and
│                                      SessionCrud, index.ts (router)
└── routes/admin-auth/                 One *.handler.ts per operation of AdminAuthCrud,
                                       index.ts (router)
```

So have the service categories of a salon. What differs comes from the salon
they belong to:

```
domain/src/
├── models/service-category.ts         CategoryId, API and database types
├── models/salon.ts                    parseSalonIdOfPath: the salon that the path names
├── schemas/service-category.schema.ts Zod schema of each request
├── mappers/read/service-category.mapper.ts
│                                      Rows → API response. There is no write mapper:
│                                      no column needs converting
├── repositories/service-category.repository.ts
│                                      IServiceCategoryRepository; every method takes
│                                      the salon ID
├── business-logic/_shared/existing-salon.ts
│                                      requireSalon: not found when the salon does not exist
└── business-logic/service-category/   One *.usecase.ts per operation; _shared/ holds the
                                       dependencies, who may (authorization.ts) and the
                                       rule for the parent of a category (hierarchy.ts,
                                       parent.ts)

infrastructure/src/
└── repositories/service-category.repository.impl.ts

api/src/
└── routes/service-category/           One *.handler.ts per operation of ServiceCategoryCrud,
                                       index.ts (router, mounted below /salons/:salonId)
```

The services of a salon are laid out like its service categories. What
differs comes from their options, their packages and the bulk update:

```
domain/src/
├── models/service.ts                  ServiceId, API and database types, a service with
│                                      its options (ServiceWithOptions)
├── schemas/service.schema.ts          Zod schema of each request
├── mappers/write/service.mapper.ts    API request → rows of two tables, the service and
│                                      its options. No column needs converting
├── mappers/read/service.mapper.ts     Rows → API response
├── repositories/service.repository.ts IServiceRepository; what became of a write is a
│                                      sum type (ServiceCreation, ServiceUpdate,
│                                      ServiceBulkUpdate, ServiceDeletion)
└── business-logic/service/            One *.usecase.ts per operation; _shared/ holds the
                                       dependencies, who may (authorization.ts), the rules
                                       that tie two properties together (rules.ts) and the
                                       error for each refusal of the repository
                                       (refusals.ts)

infrastructure/src/
└── repositories/service.repository.impl.ts

api/src/
└── routes/service/                    One *.handler.ts per operation of ServiceCrud,
                                       index.ts (router, mounted below /salons/:salonId)
```

The customer ledger has the layout of Salon. A customer belongs to no salon,
so nothing of it takes a salon ID:

```
domain/src/
├── models/customer.ts                 CustomerId, API and database types
├── schemas/customer.schema.ts         Zod schema of each request, and of the stored
│                                      preferences
├── mappers/write/customer.mapper.ts   API request → row. Nothing is converted: the
│                                      request is the row
├── mappers/read/customer.mapper.ts    Row → API response
├── mappers/write/customer-profile.mapper.ts
│                                      Request of a customer for their own profile → the
│                                      new row, and the changes of a row that is taken over
├── mappers/read/customer-profile.mapper.ts
│                                      Row → the profile; names every property it shows
├── repositories/customer.repository.ts
│                                      ICustomerRepository; what became of a create, an
│                                      update or the creation of a profile is a sum type
│                                      (CustomerCreation, CustomerUpdate,
│                                      CustomerProfileCreation)
└── business-logic/customer/           One *.usecase.ts per operation, of the ledger and
                                       of the profile (*-customer-profile.usecase.ts);
                                       _shared/ holds the dependencies (the repository
                                       and the clock), who may (authorization.ts), whose
                                       profile a request is about (profile.ts), the rules
                                       that need the current time or another customer
                                       (rules.ts) and the reading of a keyword as a phone
                                       number (search.ts)

infrastructure/src/
└── repositories/customer.repository.impl.ts

api/src/
└── routes/customer/                   One *.handler.ts per implemented operation of
                                       CustomerCrud and of CustomerProfile, index.ts
                                       (router, mounted at /customers; /me is registered
                                       before /:id)
```

The staff ledger belongs to a salon and has the layout of the service
categories, with a write mapper:

```
domain/src/
├── models/staff.ts                    StaffId, API and database types
├── schemas/staff.schema.ts            Zod schema of each request
├── mappers/write/staff.mapper.ts      API request → row; converts the commission rate
│                                      (a number in the API, numeric in the database)
├── mappers/read/staff.mapper.ts       Row → API response; leaves out awards and deletedAt
├── repositories/staff.repository.ts   IStaffRepository; every method takes the salon ID
└── business-logic/staff/              One *.usecase.ts per implemented operation;
                                       _shared/ holds the dependencies, who may and
                                       whether a staff member is the actor's own
                                       (authorization.ts), and the refusals (refusals.ts)

infrastructure/src/
└── repositories/staff.repository.impl.ts

api/src/
└── routes/staff/                      One *.handler.ts per implemented operation of
                                       StaffCrud, index.ts (router, mounted below
                                       /salons/:salonId)
```

## Layers and Package Dependencies

An arrow means "depends on":

```
           apps/server                reads the environment, builds everything, runs it
                │
                ▼
               api                    HTTP: middleware, routes, error responses
        ┌───────┴─────────┐
        ▼                 │
 infrastructure           │           I/O: database connection, repositories,
  ┌─────┴─────────┐       │           password hashing, tokens, one-time passwords, mail, logger
  │               ▼       ▼
  │                domain             rules: use cases, schemas, mappers,
  │     ┌─────────────┴───────┐       repository and service interfaces
  ▼     ▼                     ▼
  database                generated   stored shape (from PostgreSQL),
                                      API shape (from TypeSpec)
```

(`api` also takes its response types from `generated`. `utility` and `config`
are left out; the table below is complete.)

The two packages at the bottom are the two sources of truth, and both are
generated. The domain sits on both: it infers its database types from
`database` and takes its API types from `generated`, so a change to a table or
to the contract surfaces as a type error in the mappers.

Use cases and domain logic live in one package, `domain`. It imports nothing
that performs I/O: from `database` it imports types only, and it reaches the
database through repository interfaces (`ISalonRepository`,
`IServiceCategoryRepository`, `IServiceRepository`, `ICustomerRepository`,
`IUserRepository`, `ISessionRepository`), which `infrastructure` implements.
Password hashing, token generation, the one-time passwords of two-factor
authentication and mail are behind interfaces in the same way
(`IPasswordHasher`, `ITokenIssuer`, `ITwoFactorAuthenticator`, `IMailer`),
and the current time is a dependency (`clock`), so the authentication use
cases are unit-tested without a database, a real hash, an authenticator app
or a mail server.

| Package (`@beauty-salon-backend/…`) | Contains | Workspace packages it depends on |
|-------------------------------------|----------|----------------------------------|
| `utility` | `Result`, `DeepRequired`, `Omit` | none |
| `generated` | `api-types.ts` (`paths`, `components`, `operations`) and `schema.ts` (a Zod schema per enum) | none |
| `config` | `loadEnvFile`, `parseAppConfig` | `utility` |
| `database` | `schema.ts`, `relations.ts`, `sql/`, the `db:*` scripts, seeds | `config`, `utility` |
| `domain` | Models, schemas, mappers, use cases, repository and service interfaces, `DomainError` | `database` (types), `generated`, `utility` |
| `infrastructure` | `connectDatabase`, `pingDatabase`, `SalonRepository`, `ServiceCategoryRepository`, `ServiceRepository`, `CustomerRepository`, `UserRepository`, `SessionRepository`, `Argon2PasswordHasher`, `RandomTokenIssuer`, `TotpAuthenticator`, `SmtpMailer`, `createLogger` | `database`, `domain`, `utility` |
| `api` | `createApp`, middleware, routes, authentication of a request, problem details | `domain`, `generated`, `infrastructure`, `utility`; `database` in tests |
| `server` (application) | Entry point and `startServer` | `api`, `config`, `domain`, `infrastructure`, `utility` |

`api` does not depend on `config`: it receives plain values (`AppSettings`),
and the server maps the parsed configuration onto them.

### How Packages Are Built and Resolved

Each backend package has a single entry point with two targets:

```json
"exports": {
  ".": {
    "@beauty-salon-backend/source": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  }
}
```

- `pnpm dev:backend`, the database scripts (`pnpm db:migrate` and the others) and the Vitest
  configurations of the packages that import other workspace packages resolve
  with the custom condition `@beauty-salon-backend/source`, so development,
  database commands and tests run the workspace packages from source and need
  no build.
- Everything else resolves to `dist`: the built server, and `pnpm typecheck`,
  which is why a build must come first.
- The packages are built by rslib. The server application is built by `tsc`
  alone.

## Type Generation Pipeline

```
specs/**/*.tsp
   │  pnpm generate:spec      tsp compile
   ▼
specs/tsp-output/@typespec/openapi3/generated/openapi.yaml
   │
   ├─ pnpm generate:backend   openapi-typescript
   │    ▼
   │  backend/packages/generated/src/api-types.ts   paths, components, operations
   │  backend/packages/generated/src/schema.ts      a Zod schema per enum
   │
   └─ pnpm generate:api       orval
        ▼
      frontend/packages/api-client/src/generated/   React Query hooks and models
```

`pnpm generate` runs all three steps. The generated files are committed.
`pnpm check:generated` regenerates them and fails when the result differs from
what is committed, so a TypeSpec change and its generated files always travel
together.

The backend consumes the generated types in two places per domain:

- `backend/packages/domain/src/models/salon.ts` names the request and response
  models, for example
  `components['schemas']['Models.SalonCreateRequest']`. The Zod schemas in
  `backend/packages/domain/src/schemas/salon.schema.ts` are checked against
  these types with `satisfies`.
- `backend/packages/api/src/routes/salon/_shared/types.ts` takes the response
  body of each operation from `operations`, for example
  `operations['SalonCrud_create']`.

Authentication does the same in `backend/packages/domain/src/models/auth.ts`,
`backend/packages/domain/src/schemas/auth.schema.ts`,
`backend/packages/api/src/routes/auth/_shared/types.ts` and
`backend/packages/api/src/routes/admin-auth/_shared/types.ts`, the
service categories in
`backend/packages/domain/src/models/service-category.ts`,
`backend/packages/domain/src/schemas/service-category.schema.ts` and
`backend/packages/api/src/routes/service-category/_shared/types.ts`, the
services in `backend/packages/domain/src/models/service.ts`,
`backend/packages/domain/src/schemas/service.schema.ts` and
`backend/packages/api/src/routes/service/_shared/types.ts`, the
customers in `backend/packages/domain/src/models/customer.ts`,
`backend/packages/domain/src/schemas/customer.schema.ts` and
`backend/packages/api/src/routes/customer/_shared/types.ts`, and the
staff in `backend/packages/domain/src/models/staff.ts`,
`backend/packages/domain/src/schemas/staff.schema.ts` and
`backend/packages/api/src/routes/staff/_shared/types.ts`.

Model naming and nullability rules are in
[TypeSpec API Type Rules](./typespec-api-type-rules.md); the pipeline in
detail is in [Type Generation System](./type-generation-system.md).

## Database

PostgreSQL is the source of truth for the stored shape, and the files follow
it:

```
sql/migrations/*.sql ── pnpm db:migrate ──▶ database
                                              │ pnpm db:introspect
                                              ▼
                              src/schema.ts, src/relations.ts
                                              │ pnpm db:generate-sql
                                              ▼
                                        sql/setup.sql
```

(All paths are inside `backend/packages/database`.)

- A change starts as a SQL migration. `pnpm db:migrate` applies each migration
  once and records it in `migration_history.applied_migrations`. An empty
  database is created from `sql/setup.sql`, which already contains every
  migration.
- drizzle-kit only reads the database (`db:introspect`) and exports
  `setup.sql` from `schema.ts` (`db:generate-sql`). It neither generates nor
  runs migrations. Column names are camelCase in the database itself, so the
  schema needs no name mapping.
- `pnpm check:db-schema` fails when `schema.ts`, `relations.ts` or `setup.sql`
  do not match the database. `pnpm check:api-db` compares the OpenAPI document
  with the schema: property names, nullability and enum values must agree for
  every model that is backed by a table. No difference is tolerated.

The workflow step by step is in [CLAUDE.md](../CLAUDE.md) and the
[README](../README.md); how the domain types are derived from the schema is in
[DB-Driven Domain Model](./db-driven-domain-model.md).

## Request Flow

### Start-up

`backend/apps/server/src/index.ts` is the composition root: the only code that
reads the environment or ends the process.

1. `loadEnvFile()` reads `.env`, or `.env.<NODE_ENV>` when there is no `.env`,
   into the environment. Variables that are already set win.
2. `parseAppConfig(process.env)` validates all variables and returns a
   `Result`. On an error the server logs every issue and exits.
3. `createLogger(...)` creates the pino logger.
4. `startServer(config, logger)` in `backend/apps/server/src/server.ts`
   connects to the database and pings it, creates the mailer (`SmtpMailer`,
   from `config.mail`) and the authenticator of two-factor authentication
   (`TotpAuthenticator`, from `config.twoFactor.encryptionKey`), builds the
   application with
   `createApp({ database, logger, mailer, twoFactorAuthenticator, settings })`,
   and listens. It
   returns a `Result`: the server does not start when the database is
   unreachable or the port cannot be bound. The SMTP server is not contacted
   at start-up; the mailer connects when a mail goes out.
5. On `SIGTERM` or `SIGINT` the server stops accepting connections, lets
   requests in flight finish (for up to 10 seconds), waits for the mails
   that are still being delivered, closes the mailer and the database
   connections and exits with status 0.

### Middleware Order

`createApp` in `backend/packages/api/src/index.ts` creates the repositories,
the password hasher, the token issuer and the clock (`clock`, the current
time of the authentication and the customer use cases) once, takes the
mailer and the authenticator of two-factor authentication as dependencies
(`AppDependencies.mailer`, `AppDependencies.twoFactorAuthenticator`), and
mounts everything in this order. The order is part of the design:

1. `requestLogging`: gives every request its ID (`req.id`) and logger
   (`req.log`), first, so that everything after it can log and answer with
   the ID.
2. `helmet` and `cors`: security headers, and the allowed origins.
3. The system router at `/api/system`: before the rate limit, so that probes
   are never throttled.
4. `rateLimiting`: requests per client address and window.
5. `compression`, `requireJsonBody` and `express.json`: a body that is not
   JSON is rejected with 415, and a body over 100 kB with 413.
6. The authentication router at `/api/v1/auth`, the router of the
   administrator operations at `/api/v1/admin/auth`, the Salon router at
   `/api/v1/salons`, the router of the service categories at
   `/api/v1/salons/:salonId/service-categories`, the router of the
   services at `/api/v1/salons/:salonId/services`, the router of the staff
   ledger at `/api/v1/salons/:salonId/staff` and the router of the
   customer ledger at `/api/v1/customers`. Each receives
   `authenticated`, which `createAuthenticated` builds once from the
   authentication dependencies.
7. `notFoundHandler` and `errorHandler`: turn what is left over into problem
   details.

Authentication is not a middleware in this chain. A router wraps the handlers
that need a signed-in user with `authenticated`
(`backend/packages/api/src/shared/authentication.ts`), and only a wrapped
handler receives an `Actor`, so a handler that was not wrapped cannot call a
use case that asks for one.

### A Salon Request

Creating a salon, from the route to the database and back:

```
POST /api/v1/salons
  │
  ▼ api             authenticated                  shared/authentication.ts
  │                   AuthenticateUseCase: Authorization header → Actor,
  │                   or 401 and the handler does not run
  ▼ api             createSalonHandler             routes/salon/create-salon.handler.ts
  │                   passes the actor, and req.body as `unknown`, to the use case
  ▼ domain          CreateSalonUseCase.execute     business-logic/salon/create-salon.usecase.ts
  │                   1. mayCreateSalon(actor)                        authorize, or `forbidden`
  │                   2. parseWith(salonCreateRequestSchema, …)       validate
  │                   3. SalonWriteMapper.fromCreateRequest           API request → rows
  │                   4. salonRepository.create(salon, openingHours)
  ▼ infrastructure  SalonRepository.create         repositories/salon.repository.impl.ts
  │                   one transaction: the salon row and its opening_hours rows
  ▼ domain            5. SalonReadMapper.toApiSalon                   rows → API response
  ▼ api             match(result)
                      success → 201, Location header, { data, meta, links }
                      error   → sendProblem → problem details
```

Each step returns a `Result`, and a failed step is returned as it is, so the
handler receives either the API model or a `DomainError` and matches on it
exhaustively. A handler has no `try`/`catch`: Express 5 forwards a rejected
promise to the error handler.

The five operations follow the same path:

| Operation | Route | Who may | Use case | Success |
|-----------|-------|---------|----------|---------|
| List | `GET /api/v1/salons` | Anyone | `ListSalonsUseCase` | 200, a page: `{ data, meta, links }` with `meta.nextCursor` |
| Create | `POST /api/v1/salons` | `admin` | `CreateSalonUseCase` | 201 with a `Location` header |
| Get | `GET /api/v1/salons/{id}` | Anyone | `GetSalonUseCase` | 200 |
| Update | `PATCH /api/v1/salons/{id}` | `admin`, or the `owner` or a `manager` of that salon | `UpdateSalonUseCase` | 200. An absent property is left alone, `null` clears a nullable column |
| Delete | `DELETE /api/v1/salons/{id}` | `admin`, or the `owner` of that salon | `DeleteSalonUseCase` | 204. The row is kept and marked with `deletedAt` |

Five things differ from create:

- **Public operations.** List and get are marked `@useAuth(NoAuth)` in the
  contract. Their handlers are not wrapped with `authenticated`, and their
  use cases take no actor.
- **Permission for one salon.** Update and delete decide from the actor and
  the ID in the path (`mayUpdateSalon`, `mayDeleteSalon` in
  `business-logic/salon/_shared/authorization.ts`), after the ID is parsed
  and before the body is validated or the salon is looked up.
- **Path parameter.** The use case receives `req.params.id` as it is and
  turns it into a `SalonId` (a branded UUID) with `parseSalonId`.
- **Query string.** A query string carries text only, so the list handler
  first gives the parameters their types (`decodeSalonSearchQuery` in
  `routes/salon/_shared/query.ts`, built from the converters in
  `shared/query-parameters.ts`). The rules for the values are still the
  use case's.
- **Pagination.** Lists use keyset pagination; the salon list is newest
  first. `cursor` is the ID of the last salon of the previous page, returned
  as `meta.nextCursor`.

### A Request Below a Salon

The service categories belong to a salon, so their routes are below it:
`/api/v1/salons/{salonId}/service-categories`. A request takes the same path
through the layers, with one use case per operation
(`business-logic/service-category/`). What the salon adds:

- **The salon of the path.** The router is mounted with `:salonId` in its
  path and is created with `Router({ mergeParams: true })`, so its handlers
  read `req.params.salonId` and pass it on as it is. The use case turns it
  into a `SalonId` with `parseSalonIdOfPath` (`models/salon.ts`).
- **Permission from the path.** Create, update and delete decide from the
  actor and the salon in the path alone (`mayManageServiceCategories` in
  `business-logic/service-category/_shared/authorization.ts`), before the
  body is validated and before anything is looked up. List and get are
  public.
- **The salon must exist.** Every operation calls `requireSalon`
  (`business-logic/_shared/existing-salon.ts`), which returns `notFound` for
  a salon that does not exist or is deleted.
- **Nothing of another salon.** Every method of
  `IServiceCategoryRepository` takes the salon ID, so a category of another
  salon is answered like one that does not exist: 404.
- **No write mapper.** The properties of the request are the columns, and
  none needs converting, so the repository stores the validated request.
- **Order of the list.** The list is in the order a menu shows the
  categories: by `displayOrder`, then by ID.

The services of a salon (`/api/v1/salons/{salonId}/services`,
`business-logic/service/`) are built the same way: the salon of the path,
the permission from the path (`mayManageServices`), `requireSalon`, a
repository whose every method takes the salon ID, and a list in the order of
a menu, by `sortOrder`, then by ID. They add what the categories do not
have:

- **A write mapper for two tables.** A request holds the service and its
  options. No column needs converting, but `ServiceWriteMapper`
  (`mappers/write/service.mapper.ts`) tells the row of `services` from the
  rows of `service_options`, and says for an update whether the options are
  kept or replaced.
- **Rules that tie two properties together.** A discounted price is not
  above the price; a package names at least two member services, and a
  service that is not a package names none. An update names only some
  properties, so such a rule has to hold for the service as it will be
  stored. `serviceRuleIssues`
  (`business-logic/service/_shared/rules.ts`) is a pure function: the create
  use case calls it on the request, and the repository calls it inside the
  transaction of an update, on the stored row with the changes applied.
- **More than one refusal.** The repository answers a write with a sum type
  (`ServiceCreation`, `ServiceUpdate`, `ServiceBulkUpdate`,
  `ServiceDeletion` in `repositories/service.repository.ts`): what was
  stored, or why nothing was. `toRefusalError`
  (`business-logic/service/_shared/refusals.ts`) is the one place that turns
  a refusal of a create or an update into the error the client gets.
- **A bulk update.** `PATCH /bulk` applies the same changes to as many as
  100 services in one transaction, to all of them or to none. The router
  registers `/bulk` before `/:id`, which would otherwise take `bulk` for the
  ID of a service.
- **A soft delete.** A delete sets `deletedAt` and the row stays. A deleted
  service is answered like one that does not exist, but the cursor of the
  list may still name it: the page starts after the place the row holds. A
  service that a package contains is not deleted; the answer is `conflict`,
  409.

The rules of the service categories and of the services are in
[Service Menu](./service-menu.md), who may change them in
[Authentication and Authorization](./authentication.md) (both Japanese).

### A Customer Request

A customer belongs to no salon, and the customer ledger is not public. Its
routes are flat (`/api/v1/customers`), every handler is wrapped with
`authenticated`, and a request takes the same path through the layers, with
one use case per operation (`business-logic/customer/`). What that changes:

- **Permission first, from the actor alone.** Who may is decided from the
  actor and nothing in the request (`mayHandleCustomers`, and
  `mayDeleteCustomers` for a delete, in
  `business-logic/customer/_shared/authorization.ts`), so every use case
  decides it before the ID, the query and the body are looked at. An actor
  who may not is answered with 403 whatever else is wrong with the request.
  (The update and the delete of a salon decide after the ID is parsed,
  because the permission depends on the salon; the routes below a salon
  decide from the `salonId` of the path.)
- **A query the use case answers.** The list handler gives the query
  parameters their types (`decodeCustomerSearchQuery` in
  `routes/customer/_shared/query.ts`) and passes the outcome on as it is:
  `ListCustomersUseCase.execute(actor, query)` takes the decoded query as a
  `Result`. A query that cannot be decoded is an error of the request, and
  the use case returns it only to an actor who may list customers.
- **The current time.** A birth date is not in the future, so the create and
  the update use case read the time from `clock` in
  `CustomerUseCaseDependencies`. `createApp` builds one `clock` and hands it
  to the authentication and the customer use cases.
- **Two unique values.** The email is unique among the customers that are
  not deleted (a partial unique index), the referral code among all
  customers, deleted ones included (a unique constraint). The repository
  tells the two apart by the name of the violated constraint and returns
  `alreadyExists` for either: 409.
- **A write mapper that converts nothing.** The properties of the request
  are the columns, and every column has the representation of the API.
  `CustomerWriteMapper` (`mappers/write/customer.mapper.ts`) returns the
  request as the row: it is where the compiler checks that the two agree.
- **Times at the precision of a response.** The list filters by the time of
  registration (`registeredFrom`, `registeredTo`). The schema compares the
  two as times, not as text (`schemas/customer.schema.ts`), and the
  repository compares them with `createdAt` cut to milliseconds
  (`date_trunc('milliseconds', …)` in
  `repositories/customer.repository.impl.ts`): the column keeps
  microseconds, and a response shows milliseconds.

The list is newest first, and a delete keeps the row and marks it with
`deletedAt`, as for a salon.

A customer's own profile (`/api/v1/customers/me`) is served by the same
router, repository and dependencies, with use cases, mappers and models of
its own. What differs from the ledger:

- **The account says which record.** The route has no ID. The scope of a
  customer account carries `customerId`, which is null until the account has
  a profile, and `profileAccessOf`
  (`business-logic/customer/_shared/profile.ts`) turns the scope into one of
  three cases: the account's own record, a customer account without one, or
  not a customer account. The use cases match on it before the body is read:
  403 for an account that is no customer account, 404 for a get or an update
  without a profile, 409 for a second creation.
- **Models that show and take less.** `CustomerProfileResponse` leaves out
  what the staff keep to themselves, and the two requests have only the
  properties a customer states about themselves; the schemas are
  `pick`ed from the schema of the ledger, so the rules are the same.
  `CustomerProfileReadMapper` names each property it returns, so a column
  that is added to `customers` does not reach the customer by itself.
- **A creation that links two tables.** `createProfile` of the repository
  runs one transaction: it locks the account's row, reads from it what the
  decision depends on (the role, the confirmed email, the customer it may
  already have), locks the customer that the ledger has under that email,
  and either changes that row or inserts a new one, and writes the link on
  both sides (`users.customerId`, `customers.userId`). What became of it is
  the sum type `CustomerProfileCreation`. The mapper hands over both
  outcomes, the new row and the changes of a row that is taken over, because
  only the repository learns which applies.
- **A delete that unlinks.** The delete of the ledger clears
  `users.customerId` of the account that has the customer, in the
  transaction that marks the row.

The rules of the customer ledger and of the profile are in
[Customer Ledger](./customers.md), who may use them in
[Authentication and Authorization](./authentication.md) (both Japanese).

### A Staff Request

The staff ledger belongs to a salon, so a request takes the path of a
request below a salon: the salon of the path, the permission from the path,
`requireSalon`, and a repository whose every method takes the salon ID
(`business-logic/staff/`). What differs from the service menu:

- **Nothing is public.** Every handler is wrapped with `authenticated`,
  the list and the get included. `mayKeepStaffLedger`
  (`business-logic/staff/_shared/authorization.ts`) lets in an administrator
  and the owner of the salon in the path, and nobody else: the ledger holds
  pay and private contact details, and its operations change what an
  account may do.
- **A query the use case answers.** As for the customer list, the handler
  decodes the query (`decodeStaffSearchQuery` in
  `routes/staff/_shared/query.ts`) and `ListStaffUseCase.execute(actor,
  salon, query)` takes the outcome as a `Result`, so an actor who may not
  read the ledger is told that and nothing about the query.
- **The staff member an account belongs to.** The scope of a salon actor
  carries the ID of the staff member that gives the account its salon.
  `isOwnStaffRecord` compares it with the staff member of the request: an
  update that sets `isActive` to false, and a delete, are refused with
  `conflict` (409) when they are the same, after the request is validated
  and before anything is looked up.
- **No code for the effect on accounts.** The scope of an actor is rebuilt
  for every request from `users.staffId` and the staff row, which has to be
  active and not deleted (`staffOfUser` in
  `infrastructure/src/repositories/account.ts`). Deactivating or deleting a
  staff member therefore takes the salon from the linked account at its
  next request, and reactivating gives it back, without the staff use cases
  touching `users`.
- **A write mapper that converts one column.** `commissionRate` is a number
  in the API and `numeric(5,2)` in the database, which the driver reads and
  writes as a string. `StaffWriteMapper` (`mappers/write/staff.mapper.ts`)
  converts it, and for an update only when the request names it.
- **Two unique values with different scopes.** The email is unique among
  the staff members of one salon who are not deleted (a partial unique
  index on the salon and the email), the staff code among all staff
  members of the salon, deleted ones included (a unique constraint). The
  repository tells them apart by the name of the violated constraint and
  returns `alreadyExists` for either: 409. Nothing is compared across
  salons, so a salon learns nothing about the staff of another.
- **Writes in one statement.** The update and the delete carry "of this
  salon and not deleted" in their WHERE clause, so a staff member who is
  deleted at the same moment is changed before the delete or not found
  after it.

The list is in the order of registration, oldest first, so a new staff
member comes last, and a delete keeps the row and marks it with
`deletedAt`. The rules are in [Staff Ledger](./staff.md), who may keep the
ledger in [Authentication and Authorization](./authentication.md) (both
Japanese).

### An Authentication Request

The authentication operations take the same path through the layers. Every
response under `/api/v1/auth` and `/api/v1/admin/auth` carries
`Cache-Control: no-store`.

| Operation | Route | Access token | Use case | Success |
|-----------|-------|--------------|----------|---------|
| Login | `POST /api/v1/auth/login` | Not needed | `LoginUseCase` | 200 with a new access token and refresh token |
| Refresh | `POST /api/v1/auth/refresh` | Not needed; the body carries the refresh token | `RefreshSessionUseCase` | 200 with both tokens replaced |
| Logout | `POST /api/v1/auth/logout` | Needed | `LogoutUseCase` | 204 |
| Logout everywhere | `POST /api/v1/auth/logout-all` | Needed | `LogoutAllUseCase` | 204 |
| Current user | `GET /api/v1/auth/me` | Needed | `GetCurrentUserUseCase` | 200 |
| Register | `POST /api/v1/auth/register` | Not needed | `RegisterUseCase` | 204 |
| Send the verification mail again | `POST /api/v1/auth/verify-email/send` | Not needed | `SendEmailVerificationUseCase` | 204 |
| Confirm the email address | `POST /api/v1/auth/verify-email/confirm` | Not needed; the body carries the mailed token | `ConfirmEmailVerificationUseCase` | 204 |
| Request a password reset | `POST /api/v1/auth/forgot-password` | Not needed | `ForgotPasswordUseCase` | 204 |
| Check a reset token | `POST /api/v1/auth/reset-password/verify` | Not needed; the body carries the mailed token | `VerifyResetTokenUseCase` | 204 |
| Reset the password | `POST /api/v1/auth/reset-password` | Not needed; the body carries the mailed token | `ResetPasswordUseCase` | 204 |
| Change the password | `POST /api/v1/auth/change-password` | Needed | `ChangePasswordUseCase` | 204 |
| Start the set-up of two-factor authentication | `POST /api/v1/auth/2fa/enable` | Needed | `EnableTwoFactorUseCase` | 200 with the secret for the authenticator app and the backup codes |
| Confirm the set-up | `POST /api/v1/auth/2fa/verify` | Needed | `VerifyTwoFactorUseCase` | 204 |
| Disable two-factor authentication | `POST /api/v1/auth/2fa/disable` | Needed | `DisableTwoFactorUseCase` | 204 |
| Replace the backup codes | `POST /api/v1/auth/2fa/backup-codes` | Needed | `GenerateBackupCodesUseCase` | 200 with the new backup codes |
| List the sessions | `GET /api/v1/auth/sessions` | Needed | `ListSessionsUseCase` | 200, a page of the user's own sessions: `{ data, meta, links }` |
| Revoke a session | `DELETE /api/v1/auth/sessions/{sessionId}` | Needed | `RevokeSessionUseCase` | 204 |
| Read a user | `GET /api/v1/admin/auth/users/{userId}` | Needed, of an `admin` | `GetUserUseCase` | 200 |
| Unlock an account | `POST /api/v1/admin/auth/unlock/{userId}` | Needed, of an `admin` | `UnlockAccountUseCase` | 200 with the user |
| Reset the two-factor authentication of a user | `POST /api/v1/admin/auth/reset-two-factor/{userId}` | Needed, of an `admin` | `ResetTwoFactorUseCase` | 200 with the user |

The session list reads its query string the way the salon list does
(`decodeSessionSearchQuery` in `routes/auth/_shared/query.ts`), and both
lists build the links of a page with `pageLinks` (`shared/page-links.ts`).
The three administrator operations have a router of their own
(`routes/admin-auth/`), and their use cases start with the permission rule
`mayAdministerAccounts` (`business-logic/auth/_shared/authorization.ts`):
a signed-in user who is not an `admin` is answered with 403.

The use cases that send a mail hand it to `IMailer.deliver` and do not wait
for the delivery, so the response does not depend on it. Login asks an
account that has two-factor authentication enabled for a code as well
(`twoFactorCode` in the body) and answers 401 with the code `1007` until it
gets one it accepts. The use cases reach the one-time passwords through the
port `ITwoFactorAuthenticator`; its implementation `TotpAuthenticator` uses
`node:crypto` only (TOTP of RFC 6238) and returns each secret encrypted
(AES-256-GCM) under a key derived from `TWO_FACTOR_ENCRYPTION_KEY`, which is
the form the database keeps. How sessions, tokens, passwords, the lockout, registration,
the mailed tokens, two-factor authentication, the session list and the
administrator operations work is in
[Authentication and Authorization](./authentication.md); how the mails are
sent is in [Email](./email.md).

## Errors

Every error response is RFC 9457 problem details with the media type
`application/problem+json`, whatever raised it. `sendProblem` in `backend/packages/api/src/shared/responses.ts` is the only
place that sends one, and `toProblemDetails` in
`backend/packages/api/src/shared/problem-details.ts` maps each kind of error
to its status and code. The one exception is a probe that answers 503: it
returns the body the contract defines for it, not problem details.

| Kind | Raised by | Status |
|------|-----------|--------|
| `validation` | A use case, when the input breaks a rule of its Zod schema; an authentication use case, also for a rule the schema cannot check (a new password on the blocklist or equal to the current one, a current password that is wrong, a mailed token that cannot be used, a code of two-factor authentication that is not accepted, a cursor of the session list that names no session of the user); a service category use case, for a parent that is not a category of the same salon or that is the category itself or one below it, and for a cursor that names no category of the salon; a service use case, for a service that would break a rule tying two of its properties together (a discounted price above the price, member services that do not fit `isPackage`), for a category that is not of the same salon, for a member of a package that is not a service of the same salon, is a package or is the service itself, for making a package of a service that a package contains, and for a cursor that names no service of the salon; a customer use case, for a birth date before 1900 or in the future, for a referrer that does not exist, is deleted or is the customer itself, and for a cursor that names no customer; a list handler, when a query parameter cannot be read as its type (the handler of the customer list hands that error to its use case, which returns it only to an actor who may list customers) | 400 |
| `unauthenticated` | `AuthenticateUseCase`, when the request carries no access token that works; the login and refresh use cases, when the credentials are not accepted, which for login includes a missing or refused code of two-factor authentication; the current-user, change-password and two-factor use cases, when the user of the session no longer exists | 401, with a `WWW-Authenticate: Bearer` header |
| `forbidden` | A use case, when the signed-in user may not do what is asked | 403 |
| `notFound` | A use case, when what the ID in the path names is not there: a salon or a user that does not exist or is deleted, a service category that does not exist or is not of the salon in the path, a service that does not exist, is deleted or is not of the salon in the path, a customer that does not exist or is deleted, the profile of a customer account that has none, a session that is not one of the signed-in user's own sessions that have not ended | 404 |
| `alreadyExists` | The repository, when a write violates a unique index or constraint: the `email` of a salon among the salons that are not deleted, the `email` of a customer among the customers that are not deleted, the `referralCode` of a customer among all customers | 409 |
| `conflict` | A two-factor use case or the use case of an administrator operation, when the state of the account does not allow the operation: enabling what is enabled, confirming when no set-up is under way, disabling, resetting or replacing backup codes when it is not enabled, unlocking an account that is not locked; the use case that deletes a service, when a package contains the service; the use case that creates a customer's profile, when the account has one, has not confirmed its email address, or the customer with its email address belongs to another account; the customer repository, when a customer with that email address is added to the ledger at the moment the profile is created | 409 |
| `database` | The repository, when a query fails; the read mapper, when a stored row does not match the API model | 500 |
| `routeNotFound` | `notFoundHandler` | 404 |
| `malformedBody`, `badRequest` | `errorHandler`, from what the body parser or Express raised | 400 |
| `unsupportedMediaType` | `requireJsonBody`, `errorHandler` | 415 |
| `bodyTooLarge` | `errorHandler` | 413 |
| `rateLimited` | `rateLimiting` | 429 |
| `unexpected` | `errorHandler`, for anything it does not recognize | 500 |

The first seven are the `DomainError` union
(`backend/packages/domain/src/shared/errors.ts`); the others are the
`HttpError` union of the API layer. `unauthenticated` carries a `reason`,
which decides the code of the problem (`1001` to `1004`, and `1007` when a
login still needs a code of two-factor authentication) and the challenge in
the header (`toBearerChallenge`); the table of them is in
[Authentication and Authorization](./authentication.md). A 500 response never
carries the cause.
The cause is logged instead: `sendProblem` logs a `database` error, and
`errorHandler` logs an unexpected one with its stack.

## Configuration, Logging and Probes

The [README](../README.md) describes these for whoever operates the server
(section "Operating the API Server", including the table of variables). This
is where each one lives in the code:

| Concern | Where | Notes |
|---------|-------|-------|
| Configuration | `backend/packages/config/src/app-config.ts` | `parseAppConfig` validates 22 variables, all required, and returns `Result<AppConfig, ConfigIssue[]>`. When `NODE_ENV` is `staging` or `production` it also refuses `SMTP_TLS=none` and a `PUBLIC_APP_URL` that does not start with `https://`. Application code receives values and does not read the environment. |
| Environment files | `backend/packages/config/src/env-loader.ts` | One file per environment at the repository root: `.env.localhost`, `.env.development`, `.env.test`, `.env.staging`, `.env.production`. `.env.template` and `.env.example` are templates, and `.env.test.ci` is what CI uses as `.env.test`. A deployment sets the variables directly and needs no file. |
| Logging | `backend/packages/infrastructure/src/logging/logger.ts`, `backend/packages/api/src/middleware/request-logging.ts` | Structured logs (pino) on standard output: one line per request, one line per failure. The line of a request that was authenticated carries the ID of the signed-in user as `userId`: `authenticated` notes it (`backend/packages/api/src/shared/signed-in-user.ts`) and the middleware puts it on the line when the request completes. The line of a request that was not authenticated has no `userId`. Headers, bodies and the values bound to a SQL statement are never logged, and so no token is. There is no `console` call in application code. |
| Request ID | `backend/packages/api/src/middleware/request-logging.ts` | The caller's `X-Request-Id` or a new UUID. It is on every log line of the request, in the response header, and in the body as `meta.correlationId` (`correlationId` in an error). |
| Mail | `backend/packages/domain/src/services/mailer.ts`, `backend/packages/infrastructure/src/mail/smtp-mailer.ts` | The use cases know the port `IMailer`; `SmtpMailer` (nodemailer) sends through the SMTP server of `config.mail`. `deliver` returns at once. A delivery is logged with the subject of the message, never its recipient or text, and a failed one is not retried. See [Email](./email.md). |
| Probes | `backend/packages/api/src/routes/system/index.ts` | `GET /api/system/alive` (the process answers), `GET /api/system/ready` (200 while the database answers, otherwise 503), `GET /api/system/health` (the same check with details). Not rate limited and not written to the request log. The SMTP server is not probed. |
| Shutdown | `backend/apps/server/src/server.ts` | See [Start-up](#start-up). |

What protects the API today: security headers, the origin allow-list, the
rate limit, the body size limit, strict validation that rejects unknown
properties, and bearer-token authentication with a permission check on the
operations that change a salon, its service categories or its services, on
every operation of the customer ledger, of a customer's own profile and of
the staff ledger of a salon, and on the administrator operations.
The system endpoints, the salon list, a
single salon, the service categories and the services of a salon and the
authentication operations a signed-out user needs
(register, login, refresh, email verification, password reset) are open to
anyone who can reach the server.
See [Authentication and Authorization](./authentication.md).

## Tests, CI and Images

| Command | What runs | Where the tests are |
|---------|-----------|---------------------|
| `pnpm test` | Unit tests (Vitest), no external services | Next to the code: in `__tests__` directories, or as `*.test.ts(x)` files beside the module |
| `pnpm test:integration` | Tests against a real PostgreSQL: the one at `TEST_DATABASE_URL`, otherwise a testcontainers container. The tests of the infrastructure package send mail to a real SMTP server instead: a Mailpit container they start through testcontainers | `backend/packages/api/src/__tests__` (the HTTP API through the production `createApp`, one database per test), `backend/apps/server/src/__tests__` (start-up and shutdown), `backend/packages/database/src/scripts/__tests__` (the migration runner), `backend/packages/infrastructure/src/mail/__tests__` (mail delivery) |

There is no separate end-to-end suite: the API integration tests drive the
production application over HTTP, and the server tests start the real server.
Requirements and patterns are in
[Testing Requirements](./testing-requirements.md) and the
[API Testing Guide](./api-testing-guide.md).

The workflows in `.github/workflows`:

- `ci.yml` runs on every pull request and on pushes to `main` and `develop`:
  the toolchain-version, generated-file, API–database and schema-file checks,
  lint, format check, build, type check, knip, the unit tests, the integration
  tests (once against an external PostgreSQL and once through
  testcontainers), a build for each environment, and a dependency audit. On a
  push to `main`, once the checks have passed, it calls `publish-images.yml`
  for staging. `make ci-check` runs the same checks locally, except
  `pnpm check:db-schema`, which recreates the database and therefore has a
  target of its own, `make db-check`. Locally the build is the production
  build only.
- `docker-validation.yml` runs on pull requests that touch the images' inputs.
  It builds every image and smoke-tests the containers. The backend container
  must become ready against a real database and exit with status 0 when
  stopped.
- `publish-images.yml` builds the images and pushes them to GitHub Container
  Registry, tagged for one environment: for staging when `ci.yml` calls it, or
  for the environment chosen in a manual run. The frontend images are built
  with the `VITE_*` values of that environment.

Nothing in the repository rolls an image out to a host or runs
`pnpm db:migrate` during a deployment. `Dockerfile.backend` builds the API
server image; `Dockerfile.frontend` builds one static-file image per
application, selected with the `APP` build argument. See
[Release Workflow](./release-workflow.md).

## Frontend

`frontend/apps` holds three Vite + React applications: `portal-app`,
`admin-app` and `dashboard-app` (ports 3001 to 3003 under `pnpm dev`). Each is
a shell so far. `frontend/packages` holds what they share (UI components,
theme, configuration, assets) and the API client that orval generates
into `frontend/packages/api-client`. The client and its fetch function
(`frontend/packages/io`) are tested, but no application imports the client yet.
Nothing in the frontend signs in, stores a token or sends an `Authorization`
header, and the pages that the links in the mails point at (`/verify-email`
and `/reset-password` under `PUBLIC_APP_URL`) do not exist yet.
See [Frontend API Integration](./frontend-api-integration.md).

## References

- [CLAUDE.md](../CLAUDE.md): rules, conventions, commands, the Salon reference
- [README](../README.md): setup, scripts, operating the server
- [Backend Architecture Guidelines](./backend-architecture-guidelines.md)
- [Domain Implementation Reference](./domain-implementation-reference.md)
- [Authentication and Authorization](./authentication.md) (Japanese)
- [Service Menu](./service-menu.md) (Japanese)
- [Customer Ledger](./customers.md) (Japanese)
- [Staff Ledger](./staff.md) (Japanese)
- [Email](./email.md) (Japanese)
- [Type Generation System](./type-generation-system.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [DB-Driven Domain Model](./db-driven-domain-model.md)
- [API-DB Type Constraints Mapping](./api-db-type-constraints-mapping.md)
- [Testing Requirements](./testing-requirements.md)
- [Development Workflow](./development-workflow.md)
- [Release Workflow](./release-workflow.md)
