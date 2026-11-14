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
| Salon API (`/api/v1/salons`) | Implemented in every layer: list, create, get, update, delete. It is the reference implementation for every other domain. |
| System endpoints (`/api/system`) | Implemented: `alive`, `ready` and `health`. |
| Other domains (auth, staff, service, customer, reservation, booking, review, attachment, treatment, payment, inventory, permission) | Specified in TypeSpec, so their generated types exist, and the database schema already has tables and seed data for most of them. There is no domain, repository or route code. A request to one of these routes is answered with 404. Tracked in GitHub issue #91. |
| Authentication and authorization | Not implemented. The OpenAPI document declares bearer authentication for every operation, but the server does not check it. |
| Email, file storage | Not implemented. `make infra-up` starts MailHog and MinIO next to PostgreSQL, but the server uses neither. |
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
- **Errors are values.** Every operation that can fail returns a
  `Result<T, E>`, so its signature states how it can fail. Application code
  does not throw, and it contains exactly one `try`/`catch`:
  `Result.fromPromise` in `backend/packages/utility/src/result/result.ts`,
  which turns what third-party code throws (in practice the database driver)
  into a `Result`. Whatever still escapes a route, such as an unreadable body
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
│   │   │                    repository interfaces, errors
│   │   ├── infrastructure/  Database connection, repository implementations,
│   │   │                    logger
│   │   └── api/             Express application: middleware, routes, error
│   │                        responses
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
├── mappers/write/salon.mapper.ts      API request → rows
├── mappers/read/salon.mapper.ts       Rows → API response
├── repositories/salon.repository.ts   ISalonRepository
├── business-logic/salon/              One *.usecase.ts per operation
└── shared/                            DomainError, parseWith

infrastructure/src/
├── database/                          Connection, ping, log-safe failure description
├── logging/logger.ts                  createLogger
└── repositories/salon.repository.impl.ts

api/src/
├── index.ts                           createApp
├── settings.ts                        AppSettings
├── middleware/                        Request logging, rate limit, error handlers
├── routes/salon/                      One *.handler.ts per operation, index.ts (router)
├── routes/system/index.ts             alive, ready, health
└── shared/                            Problem details, response helpers, API version
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
 infrastructure           │           I/O: database connection, repositories, logger
  ┌─────┴─────────┐       │
  │               ▼       ▼
  │                domain             rules: use cases, schemas, mappers,
  │     ┌─────────────┴───────┐       repository interfaces
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
database through `ISalonRepository`, which `infrastructure` implements.

| Package (`@beauty-salon-backend/…`) | Contains | Workspace packages it depends on |
|-------------------------------------|----------|----------------------------------|
| `utility` | `Result`, `DeepRequired`, `Omit` | none |
| `generated` | `api-types.ts` (`paths`, `components`, `operations`) and `schema.ts` (a Zod schema per enum) | none |
| `config` | `loadEnvFile`, `parseAppConfig` | `utility` |
| `database` | `schema.ts`, `relations.ts`, `sql/`, the `db:*` scripts, seeds | `config`, `utility` |
| `domain` | Models, schemas, mappers, use cases, repository interfaces, `DomainError` | `database` (types), `generated`, `utility` |
| `infrastructure` | `connectDatabase`, `pingDatabase`, `SalonRepository`, `createLogger` | `database`, `domain`, `utility` |
| `api` | `createApp`, middleware, routes, problem details | `domain`, `generated`, `infrastructure`, `utility`; `database` in tests |
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
   │  pnpm generate:spec      tsp compile, then specs/scripts/postprocess-openapi.ts
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

The backend consumes the generated types in two places:

- `backend/packages/domain/src/models/salon.ts` names the request and response
  models, for example
  `components['schemas']['Models.SalonCreateRequest']`. The Zod schemas in
  `backend/packages/domain/src/schemas/salon.schema.ts` are checked against
  these types with `satisfies`.
- `backend/packages/api/src/routes/salon/_shared/types.ts` takes the response
  body of each operation from `operations`, for example
  `operations['SalonCrud_create']`.

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
  with the schema: property names and nullability must agree. The known
  differences of the domains that are not implemented yet are recorded in
  `backend/packages/database/api-consistency-baseline.json`; Salon has none.

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
   connects to the database and pings it, builds the application with
   `createApp({ database, logger, settings })`, and listens. It returns a
   `Result`: the server does not start when the database is unreachable or
   the port cannot be bound.
5. On `SIGTERM` or `SIGINT` the server stops accepting connections, lets
   requests in flight finish (for up to 10 seconds), closes the database
   connections and exits with status 0.

### Middleware Order

`createApp` in `backend/packages/api/src/index.ts` creates the repositories
once and mounts everything in this order. The order is part of the design:

1. `requestLogging`: gives every request its ID (`req.id`) and logger
   (`req.log`), first, so that everything after it can log and answer with
   the ID.
2. `helmet` and `cors`: security headers, and the allowed origins.
3. The system router at `/api/system`: before the rate limit, so that probes
   are never throttled.
4. `rateLimiting`: requests per client address and window.
5. `compression`, `requireJsonBody` and `express.json`: a body that is not
   JSON is rejected with 415, and a body over 100 kB with 413.
6. The Salon router at `/api/v1/salons`.
7. `notFoundHandler` and `errorHandler`: turn what is left over into problem
   details.

### A Salon Request

Creating a salon, from the route to the database and back:

```
POST /api/v1/salons
  │
  ▼ api             createSalonHandler             routes/salon/create-salon.handler.ts
  │                   passes req.body to the use case as `unknown`
  ▼ domain          CreateSalonUseCase.execute     business-logic/salon/create-salon.usecase.ts
  │                   1. parseWith(salonCreateRequestSchema, …)       validate
  │                   2. SalonWriteMapper.fromCreateRequest           API request → rows
  │                   3. salonRepository.create(salon, openingHours)
  ▼ infrastructure  SalonRepository.create         repositories/salon.repository.impl.ts
  │                   one transaction: the salon row and its opening_hours rows
  ▼ domain            4. SalonReadMapper.toApiSalon                   rows → API response
  ▼ api             match(result)
                      success → 201, Location header, { data, meta, links }
                      error   → sendProblem → problem details
```

Each step returns a `Result`, and a failed step is returned as it is, so the
handler receives either the API model or a `DomainError` and matches on it
exhaustively. A handler has no `try`/`catch`: Express 5 forwards a rejected
promise to the error handler.

The five operations follow the same path:

| Operation | Route | Use case | Success |
|-----------|-------|----------|---------|
| List | `GET /api/v1/salons` | `ListSalonsUseCase` | 200, a page: `{ data, meta, links }` with `meta.nextCursor` |
| Create | `POST /api/v1/salons` | `CreateSalonUseCase` | 201 with a `Location` header |
| Get | `GET /api/v1/salons/{id}` | `GetSalonUseCase` | 200 |
| Update | `PATCH /api/v1/salons/{id}` | `UpdateSalonUseCase` | 200. An absent property is left alone, `null` clears a nullable column |
| Delete | `DELETE /api/v1/salons/{id}` | `DeleteSalonUseCase` | 204. The row is kept and marked with `deletedAt` |

Three things differ from create:

- **Path parameter.** The use case receives `req.params.id` as it is and
  turns it into a `SalonId` (a branded UUID) with `parseSalonId`.
- **Query string.** A query string carries text only, so the list handler
  first gives the parameters their types (`decodeSalonSearchQuery` in
  `routes/salon/_shared/query.ts`). The rules for the values are still the
  use case's.
- **Pagination.** Lists use keyset pagination, newest first. `cursor` is the
  ID of the last salon of the previous page, returned as `meta.nextCursor`.

## Errors

Every error response is RFC 9457 problem details with the media type
`application/problem+json`, whatever raised it. `sendProblem` in `backend/packages/api/src/shared/responses.ts` is the only
place that sends one, and `toProblemDetails` in
`backend/packages/api/src/shared/problem-details.ts` maps each kind of error
to its status and code. The one exception is a probe that answers 503: it
returns the body the contract defines for it, not problem details.

| Kind | Raised by | Status |
|------|-----------|--------|
| `validation` | A use case, when the input breaks a rule of its Zod schema; the list handler, when a query parameter cannot be read as its type | 400 |
| `notFound` | A use case, when the salon does not exist or is deleted | 404 |
| `alreadyExists` | The repository, when the unique constraint on `email` is violated | 409 |
| `database` | The repository, when a query fails; the read mapper, when a stored row does not match the API model | 500 |
| `routeNotFound` | `notFoundHandler` | 404 |
| `malformedBody`, `badRequest` | `errorHandler`, from what the body parser or Express raised | 400 |
| `unsupportedMediaType` | `requireJsonBody`, `errorHandler` | 415 |
| `bodyTooLarge` | `errorHandler` | 413 |
| `rateLimited` | `rateLimiting` | 429 |
| `unexpected` | `errorHandler`, for anything it does not recognize | 500 |

The first four are the `DomainError` union
(`backend/packages/domain/src/shared/errors.ts`); the others are the
`HttpError` union of the API layer. A 500 response never carries the cause.
The cause is logged instead: `sendProblem` logs a `database` error, and
`errorHandler` logs an unexpected one with its stack.

## Configuration, Logging and Probes

The [README](../README.md) describes these for whoever operates the server
(section "Operating the API Server", including the table of variables). This
is where each one lives in the code:

| Concern | Where | Notes |
|---------|-------|-------|
| Configuration | `backend/packages/config/src/app-config.ts` | `parseAppConfig` validates 14 variables, all required, and returns `Result<AppConfig, ConfigIssue[]>`. Application code receives values and does not read the environment. |
| Environment files | `backend/packages/config/src/env-loader.ts` | One file per environment at the repository root: `.env.localhost`, `.env.development`, `.env.test`, `.env.staging`, `.env.production`. `.env.template` and `.env.example` are templates, and `.env.test.ci` is what CI uses as `.env.test`. A deployment sets the variables directly and needs no file. |
| Logging | `backend/packages/infrastructure/src/logging/logger.ts`, `backend/packages/api/src/middleware/request-logging.ts` | Structured logs (pino) on standard output: one line per request, one line per failure. Headers, bodies and the values bound to a SQL statement are never logged. There is no `console` call in application code. |
| Request ID | `backend/packages/api/src/middleware/request-logging.ts` | The caller's `X-Request-Id` or a new UUID. It is on every log line of the request, in the response header, and in the body as `meta.correlationId` (`correlationId` in an error). |
| Probes | `backend/packages/api/src/routes/system/index.ts` | `GET /api/system/alive` (the process answers), `GET /api/system/ready` (200 while the database answers, otherwise 503), `GET /api/system/health` (the same check with details). Not rate limited and not written to the request log. |
| Shutdown | `backend/apps/server/src/server.ts` | See [Start-up](#start-up). |

What protects the API today: security headers, the origin allow-list, the
rate limit, the body size limit, and strict validation that rejects unknown
properties. There is no authentication, so every endpoint is open to anyone
who can reach the server.

## Tests, CI and Images

| Command | What runs | Where the tests are |
|---------|-----------|---------------------|
| `pnpm test` | Unit tests (Vitest), no external services | Next to the code: in `__tests__` directories, or as `*.test.ts(x)` files beside the module |
| `pnpm test:integration` | Tests against a real PostgreSQL: the one at `TEST_DATABASE_URL`, otherwise a testcontainers container | `backend/packages/api/src/__tests__` (the HTTP API through the production `createApp`, one schema per test), `backend/apps/server/src/__tests__` (start-up and shutdown), `backend/packages/database/src/scripts/__tests__` (the migration runner) |

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
  push to `main` it also builds the images and pushes them to GitHub Container
  Registry. `make ci-check` runs the same checks locally, except
  `pnpm check:db-schema`, which recreates the database and therefore has a
  target of its own, `make db-check`. Locally the build is the production
  build only.
- `docker-validation.yml` runs on pull requests that touch the images' inputs.
  It builds every image and smoke-tests the containers. The backend container
  must become ready against a real database and exit with status 0 when
  stopped.
- `deploy.yml` builds the images and pushes them to GitHub Container Registry:
  for staging on a push to `main`, or for the environment chosen in a manual
  run.

Nothing in the repository rolls an image out to a host or runs
`pnpm db:migrate` during a deployment. `Dockerfile.backend` builds the API
server image; `Dockerfile.frontend` builds one static-file image per
application, selected with the `APP` build argument. See
[Release Workflow](./release-workflow.md).

## Frontend

`frontend/apps` holds three Vite + React applications: `portal-app`,
`admin-app` and `dashboard-app` (ports 3001 to 3003 under `pnpm dev`). Each is
a shell so far. `frontend/packages` holds what they share (UI components,
theme, stores, utilities, validations) and the API client that orval generates
into `frontend/packages/api-client`. No application imports the client yet.
See [Frontend API Integration](./frontend-api-integration.md).

## References

- [CLAUDE.md](../CLAUDE.md): rules, conventions, commands, the Salon reference
- [README](../README.md): setup, scripts, operating the server
- [Backend Architecture Guidelines](./backend-architecture-guidelines.md)
- [Domain Implementation Reference](./domain-implementation-reference.md)
- [Type Generation System](./type-generation-system.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [DB-Driven Domain Model](./db-driven-domain-model.md)
- [API-DB Type Constraints Mapping](./api-db-type-constraints-mapping.md)
- [Testing Requirements](./testing-requirements.md)
- [Development Workflow](./development-workflow.md)
- [Release Workflow](./release-workflow.md)
