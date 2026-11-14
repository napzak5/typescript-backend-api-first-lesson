# Beauty Salon Reservation System

A modern, type-safe beauty salon reservation system built with TypeScript, TypeSpec API-First development, and Clean Architecture principles.

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Operating the API Server](#-operating-the-api-server)
- [Testing](#-testing)
- [Documentation](#-documentation)

## 🧱 Architecture

This project follows Clean Architecture principles with API-First development using TypeSpec for type generation.

### Core Principles

1. **API-First Development**: TypeSpec → OpenAPI → TypeScript types
2. **Clean Architecture**: Business logic isolated from infrastructure
3. **Type Safety**: Sum types and exhaustive pattern matching with ts-pattern
4. **Exception-Free**: Result types for error handling
5. **Testability**: Integration testing with testcontainers

### System Layers

```
┌─────────────────────────────────────────┐
│           API Layer (Express)           │ ← HTTP handlers, routing
├─────────────────────────────────────────┤
│      Use Case Layer (Business Logic)    │ ← Orchestration, workflows
├─────────────────────────────────────────┤
│        Domain Layer (Pure Logic)        │ ← Business rules, entities
├─────────────────────────────────────────┤
│   Infrastructure Layer (External I/O)   │ ← Database access, mail, logging
└─────────────────────────────────────────┘
```

For detailed architecture documentation, see [docs/architecture-overview.md](docs/architecture-overview.md).

### Implementation Status

| Area | Status |
|------|--------|
| Salon API (`/api/v1/salons`) | Implemented in every layer; the reference for the other domains. List and get are public; create, update and delete need a signed-in user who is allowed to |
| Authentication (`/api/v1/auth`, `/api/v1/admin/auth`) | Implemented, every operation of the contract: `login`, `refresh`, `logout`, `logout-all` and `me`, on server-side sessions with bearer tokens; registration of customer accounts, email verification, password reset and password change, with the links sent by mail; two-factor authentication with the codes of an authenticator app (TOTP) and backup codes; the list of the signed-in user's sessions and revoking one of them; and, for administrators, reading a user's account, unlocking it and resetting its two-factor authentication |
| Authorization | Decided in the use cases from the role and the salon of the signed-in user; applied to the Salon API (create, update, delete) and to the administrator operations (`/api/v1/admin/auth`). See [docs/authentication.md](docs/authentication.md) |
| System endpoints (`/api/system/alive`, `ready`, `health`) | Implemented |
| Customers, staff, services, bookings, payments and the other domains | Specified in TypeSpec and present in the database schema; no backend code yet |
| Email | Implemented for the mails of the authentication flows: plain text over SMTP. Locally they are caught by Mailpit. See [docs/email.md](docs/email.md) |
| File storage | Design documents only |
| Frontend apps | Application shells; they do not call the API yet, and nothing in them signs in or sends a token. The pages that the links in the mails point at do not exist yet |

## 🚀 Quick Start

### Prerequisites

- Node.js 26.13.1 (`.node-version`)
- pnpm 12.18.0 (`package.json#packageManager`)
- PostgreSQL 18, either through Docker (`make infra-up`) or any instance that
  `DATABASE_URL` in `.env.localhost` points to
- An SMTP server for the mails the backend sends. `make infra-up` starts
  Mailpit, which catches them, and the `SMTP_*` variables in `.env.localhost`
  point to it

### Installation

```bash
pnpm install       # Install dependencies and the pre-commit hook
make infra-up      # Start PostgreSQL and Mailpit (the local mail catcher) in Docker
pnpm db:fresh      # Create the schema from sql/setup.sql
pnpm db:seed       # Insert sample data, including accounts to sign in with (optional)
pnpm dev           # Backend on :3000, frontend apps on :3001-3003
```

Generated files are checked in, so `pnpm generate` is only needed after a
TypeSpec change. `make help` lists every Makefile target.

Registration (`POST /api/v1/auth/register`) creates customer accounts only,
and such an account can sign in once the link in the mail it was sent has
been confirmed; locally that mail is shown by Mailpit at
<http://localhost:8025>. Accounts with the other roles come from the seed.
Every seeded account has the same password, which is published in the
repository
(`SEED_PASSWORD` in `backend/packages/database/src/seeds/seed-data/users.ts`);
`pnpm db:seed` therefore refuses to run when `NODE_ENV` is `production`. The
accounts and their roles are listed in
[docs/authentication.md](docs/authentication.md).

## 📁 Project Structure

```
.
├── specs/                      # TypeSpec API definitions
│   ├── models/                # Data model definitions
│   └── operations/            # API operation definitions
│
├── backend/                    # Backend monorepo
│   ├── packages/
│   │   ├── domain/           # Business logic layer
│   │   ├── infrastructure/  # Database access, mail (SMTP), password hashing, tokens, one-time passwords, logging
│   │   ├── api/              # HTTP layer
│   │   ├── database/         # Database schema, migrations, seeds
│   │   ├── generated/        # Auto-generated types
│   │   ├── config/           # Configuration
│   │   └── utility/          # Result type and shared helpers
│   └── apps/
│       └── server/           # Express application
│
├── frontend/                   # Frontend applications
│   ├── packages/             # Shared frontend packages
│   └── apps/                 # Frontend applications
│
├── shared-config/              # Shared TypeScript configuration
├── scripts/                    # Repository scripts (run with node)
└── docs/                      # Documentation
```

## 🔧 Development

### Type Generation Pipeline

1. Define API contracts in TypeSpec (`specs/`)
2. Run `pnpm generate` (or `pnpm generate:watch` while editing), which
   - compiles TypeSpec to OpenAPI (`pnpm generate:spec`)
   - generates the frontend API client (`pnpm generate:api`)
   - generates the backend types and Zod schemas (`pnpm generate:backend`)
3. Commit the generated files together with the TypeSpec change;
   `pnpm check:generated` fails in CI when they drift

### Database Workflow

The database is the source of truth for the Drizzle schema:

1. Write a SQL migration in `backend/packages/database/sql/migrations/`,
   named `YYYYMMDDHHMM_description.sql`
2. `pnpm db:migrate` applies it, once
3. `pnpm db:introspect` regenerates `schema.ts` and `relations.ts`
4. `pnpm db:generate-sql` regenerates `sql/setup.sql`
5. Commit all of them; `pnpm check:db-schema` fails in CI when they drift,
   and the integration tests fail when `setup.sql` lacks a migration

`pnpm db:migrate` is the one command for every database and safe to run on
each deployment. It creates an empty database from `sql/setup.sql`, which
already contains every migration; on any other database it applies the
migrations that are missing, in the order of their names and each in its own
transaction. What has been applied is recorded in
`migration_history.applied_migrations`, and concurrent runs wait for each
other. A migration that has been applied anywhere is never edited: write a new
one. While writing a migration, `pnpm db:migrate <file>` runs it without
recording it.

### API ↔ Database Consistency

API property names, nullability and enum values follow the database columns.
`pnpm check:api-db` compares the generated OpenAPI document with the Drizzle
schema and fails in CI on any difference. Every API model that is backed by a
table is covered, in all domains; the rules are in
`backend/packages/database/src/scripts/api-consistency-rules.ts`.

### Available Scripts

```bash
# Development
pnpm dev                     # Backend and every frontend app in watch mode
pnpm dev:backend             # Backend only, reloading on source changes
pnpm dev:watch:admin-app     # Admin app with its packages in watch mode
pnpm dev:watch:portal-app    # Portal app with its packages in watch mode
pnpm dev:watch:dashboard-app # Dashboard app with its packages in watch mode
pnpm generate                # TypeSpec → OpenAPI → backend types + API client
pnpm generate:watch          # Regenerate on every TypeSpec change

# Building
pnpm build                   # Production build of every package
pnpm build:dev               # Also build:test, build:stg, build:prod
pnpm build:backend           # Backend only
pnpm build:frontend          # Frontend packages and apps
pnpm start:backend           # Run the built backend
pnpm preview:frontend        # Serve the built frontend apps

# Testing
pnpm test                    # Unit tests
pnpm test:integration        # Tests against PostgreSQL and an SMTP server (see Testing)

# Code Quality
pnpm lint                    # Biome lint
pnpm format:check            # Check formatting (Biome and TypeSpec)
pnpm format:fix              # Apply formatting, import sorting and safe fixes
pnpm typecheck               # Type check (run a build first)
pnpm knip                    # Unused files, exports and dependencies
pnpm check:generated         # Generated files match the TypeSpec
pnpm check:db-schema         # schema.ts and setup.sql match the database
pnpm check:api-db            # API models agree with the database schema
make ci-check                # The CI checks, in the same order (all but check:db-schema)

# Database
pnpm db:fresh                # Drop everything and recreate the schema
pnpm db:migrate              # Create the schema or apply the missing migrations
pnpm db:seed                 # Insert sample data (--if-empty: only without data); not in production
pnpm db:truncate             # Delete all rows, keep the schema
pnpm db:introspect           # Regenerate schema.ts from the database
pnpm db:generate-sql         # Regenerate sql/setup.sql from schema.ts

# Maintenance
pnpm clean                   # Remove build outputs
pnpm fresh                   # Remove build outputs and node_modules, reinstall
pnpm update:check            # List dependencies with newer releases
```

## 🚦 Operating the API Server

### Configuration

The server reads its configuration from environment variables. The file
`.env.<NODE_ENV>` (or `.env` when it exists) fills in what the process
environment does not set, so a deployment sets the variables directly and
needs no file. Every variable below is required; the server validates all of
them at start-up and exits with the list of what is missing or malformed.

| Variable | Meaning |
|----------|---------|
| `NODE_ENV` | `production`, `staging`, `development`, `test` or `localhost` |
| `HOST`, `PORT` | Address and port to listen on |
| `TRUST_PROXY_HOPS` | Reverse proxies in front of the server (0 = clients connect directly). The rate limit counts by client address, which is only right when this matches the deployment |
| `DATABASE_URL` | `postgres://` connection URL |
| `DATABASE_POOL_MAX` | Largest number of pooled connections |
| `DATABASE_CONNECTION_TIMEOUT` | Connection timeout in milliseconds |
| `CORS_ORIGIN` | Comma-separated origins allowed to call the API from a browser |
| `CORS_CREDENTIALS`, `CORS_MAX_AGE` | Whether credentials are allowed; preflight cache time in seconds |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | Requests allowed per client address in each window (counted per server instance) |
| `SMTP_HOST`, `SMTP_PORT` | Host and port of the SMTP server that carries the mails |
| `SMTP_TLS` | How the SMTP connection is encrypted: `implicit` (TLS from the start, port 465), `starttls` (upgraded with STARTTLS, port 587) or `none` (plain text, for a local mail catcher) |
| `SMTP_USER`, `SMTP_PASSWORD` | Credentials for the SMTP server; the server always signs in |
| `MAIL_FROM` | Sender of every mail: an address, or `Name <address>` |
| `PUBLIC_APP_URL` | Origin of the web application that the links in mails point at |
| `TWO_FACTOR_ENCRYPTION_KEY` | Key under which the secrets of authenticator apps (two-factor authentication) are encrypted in the database: 32 characters or more, random and kept secret. Changing it makes every stored secret unusable: the codes of the authenticator apps are no longer accepted |
| `LOG_LEVEL` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `LOG_FORMAT` | `json` (one object per line) or `pretty` (for a terminal) |

When `NODE_ENV` is `staging` or `production`, the server also refuses to
start with `SMTP_TLS=none` or with a `PUBLIC_APP_URL` that does not start with
`https://`: the mails carry tokens. The accepted values of every variable are
in [docs/env-configuration.md](docs/env-configuration.md), and how mail is
sent is in [docs/email.md](docs/email.md).

### Logs and Request IDs

The server writes structured logs (pino) to standard output: one line per
request with method, URL, status and duration, and one line for every
failure with its cause. The line of a request that was authenticated also
names the signed-in user (`userId`), which tells afterwards who did what.
Request headers and bodies, and the values bound to
a failed SQL statement, are never logged. Every mail leaves one line,
`Mail delivered` or `Failed to deliver mail`, with the subject of the message
and without its recipient or text.

Every request has an ID: the caller's `X-Request-Id` if it sent one,
otherwise a new UUID. The ID is on every log line of the request, in the
`X-Request-Id` response header, and in the body as `meta.correlationId`
(or `correlationId` of an error), so a reported error leads straight to its
log lines.

### Errors

Every error response is RFC 9457 problem details (`application/problem+json`),
including the ones raised before a route runs: unknown route (404), malformed JSON (400), a body that
is not JSON (415) or over 100 kB (413), too many requests (429) and
unexpected failures (500, without internal details). A request without a
valid access token to an operation that needs one is answered with 401 and a
`WWW-Authenticate: Bearer` header, and a signed-in user who lacks the
permission with 403. The probes below are the one exception: a probe that
fails answers 503 with its own body.

### Probes and Shutdown

| Endpoint | Purpose |
|----------|---------|
| `GET /api/system/alive` | Liveness: the process answers |
| `GET /api/system/ready` | Readiness: 200 while the database answers, otherwise 503 with `{ "ready": false, "reason": "database" }` |
| `GET /api/system/health` | The same check with details per dependency |

The probes are not rate limited and not written to the request log. On
`SIGTERM` or `SIGINT` the server stops accepting connections, lets requests
in flight finish (for up to 10 seconds), waits for the mails that are still
being delivered, closes the database connections and exits with status 0. It
does not start at all when the database is unreachable. The SMTP server is
not checked, at start-up or by the probes: the server connects to it only
when a mail goes out, and a mail that cannot be delivered is logged and
dropped.

## 🧪 Testing

- **Unit tests** (`pnpm test`): pure logic, no external services (Vitest)
- **Integration tests** (`pnpm test:integration`): the HTTP API, the
  server's start-up and shutdown, and the migration runner against a real
  PostgreSQL, with one isolated schema per API test and one database per
  migration test. They start a PostgreSQL
  container through testcontainers, or use an existing database when
  `TEST_DATABASE_URL` is set:

  ```bash
  TEST_DATABASE_URL=postgres://<user>:<password>@localhost:5432/<database> pnpm test:integration
  ```

  The integration tests of the infrastructure package send mail to a Mailpit
  container, which they also start through testcontainers.

See [docs/testing-requirements.md](docs/testing-requirements.md) for testing guidelines.

## 📚 Documentation

The full index is [docs/README.md](docs/README.md).

### Core Documentation

- [Development Guidelines](CLAUDE.md) - The conventions every change follows
- [Architecture Overview](docs/architecture-overview.md) - System design and architecture
- [Development Workflow](docs/development-workflow.md) - Set-up, the daily loop, checks
- [AI Agent Guidelines](AGENTS.md) - Instructions and roles for AI coding agents

### Development Guides

- [TypeScript Configuration](docs/typescript-configuration.md)
- [Type Safety Principles](docs/type-safety-principles.md)
- [Sum Types & Pattern Matching](docs/sum-types-pattern-matching.md)
- [Backend Architecture](docs/backend-architecture-guidelines.md)
- [Multi-Agent Collaboration](docs/multi-agent-collaboration-framework.md) - AI agent design validation protocol

### Implementation Guides

- [Domain Implementation Reference](docs/domain-implementation-reference.md) - Complete reference for implementing new domains
- [API Route Modular Structure](docs/api-route-modular-structure.md) - Guide for modular route organization
- [Uniform Implementation](docs/uniform-implementation-guide.md)
- [Authentication and Authorization](docs/authentication.md) - Sessions, passwords, registration, two-factor authentication, permissions, seeded accounts (日本語)
- [Email](docs/email.md) - Which mails are sent, SMTP settings, Mailpit for local development (日本語)
- [Testing Requirements](docs/testing-requirements.md)
- [API Testing Guide](docs/api-testing-guide.md)
- [Type Generation System](docs/type-generation-system.md)
- [Database Commands](backend/packages/database/docs/database-commands.md)

## 🔑 Key Technologies

### Backend
- **TypeScript** - Type-safe JavaScript
- **TypeSpec** - API-first type generation
- **Express** - Web framework
- **Drizzle ORM** - Type-safe database access
- **PostgreSQL** - Relational database
- **ts-pattern** - Pattern matching
- **Zod** - Runtime validation
- **pino** - Structured logging
- **nodemailer** - Mail over SMTP
- **Vitest**, **testcontainers** - Unit and integration testing
- **Biome**, **knip** - Lint, format, unused-code detection

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **TanStack Query** - Data fetching
- **orval** - API client generated from the OpenAPI document
- **Tailwind CSS** - Styling
