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

## 🏗️ Architecture

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
│   Infrastructure Layer (External I/O)   │ ← Database, email, storage
└─────────────────────────────────────────┘
```

For detailed architecture documentation, see [docs/architecture-overview.md](docs/architecture-overview.md).

## 🚀 Quick Start

### Prerequisites

- Node.js 26.13.1 (`.node-version`)
- pnpm 12.18.0 (`package.json#packageManager`)
- PostgreSQL 18, either through Docker (`make infra-up`) or any instance that
  `DATABASE_URL` in `.env.localhost` points to

### Installation

```bash
pnpm install       # Install dependencies and the pre-commit hook
make infra-up      # Start PostgreSQL, MailHog and MinIO in Docker
pnpm db:fresh      # Create the schema from sql/setup.sql
pnpm db:seed       # Insert sample data (optional)
pnpm dev           # Backend on :3000, frontend apps on :3001-3003
```

Generated files are checked in, so `pnpm generate` is only needed after a
TypeSpec change. `make help` lists every Makefile target.

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
│   │   ├── infrastructure/  # External services
│   │   ├── api/              # HTTP layer
│   │   ├── database/         # Database schemas
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

## 🛠️ Development

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

1. Write a SQL migration in `backend/packages/database/sql/migrations/`
2. `pnpm db:migrate` applies it
3. `pnpm db:introspect` regenerates `schema.ts` and `relations.ts`
4. `pnpm db:generate-sql` regenerates `sql/setup.sql`
5. Commit all of them; `pnpm check:db-schema` fails in CI when they drift

### API ↔ Database Consistency

API property names and nullability follow the database columns.
`pnpm check:api-db` compares the generated OpenAPI document with the Drizzle
schema and fails in CI on any difference that is not recorded in
`backend/packages/database/api-consistency-baseline.json`. The baseline holds
the known differences of the domains that are specified but not implemented
yet; the salon domain, the reference implementation, has none. After fixing a
recorded difference, run `pnpm check:api-db --update-baseline`.

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
pnpm test:integration        # API tests against PostgreSQL (see Testing)

# Code Quality
pnpm lint                    # Biome lint
pnpm format:check            # Check formatting (Biome and TypeSpec)
pnpm format:fix              # Apply formatting, import sorting and safe fixes
pnpm typecheck               # Type check (run a build first)
pnpm knip                    # Unused files, exports and dependencies
pnpm check:generated         # Generated files match the TypeSpec
pnpm check:db-schema         # schema.ts and setup.sql match the database
pnpm check:api-db            # API models agree with the database schema
make ci-check                # Everything CI runs, in the same order

# Database
pnpm db:fresh                # Drop everything and recreate the schema
pnpm db:migrate              # Apply the SQL migrations
pnpm db:seed                 # Insert sample data
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
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | Requests one client address may make per window (kept per server instance) |
| `LOG_LEVEL` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `LOG_FORMAT` | `json` (one object per line) or `pretty` (for a terminal) |

### Logs and Request IDs

The server writes structured logs (pino) to standard output: one line per
request with method, URL, status and duration, and one line for every
failure with its cause. Request headers and bodies, and the values bound to
a failed SQL statement, are never logged.

Every request has an ID: the caller's `X-Request-Id` if it sent one,
otherwise a new UUID. The ID is on every log line of the request, in the
`X-Request-Id` response header, and in the body as `meta.correlationId`
(or `correlationId` of an error), so a reported error leads straight to its
log lines.

### Errors

Every error response is RFC 9457 problem details, including the ones raised
before a route runs: unknown route (404), malformed JSON (400), a body that
is not JSON (415) or over 100 kB (413), too many requests (429) and
unexpected failures (500, without internal details).

### Probes and Shutdown

| Endpoint | Purpose |
|----------|---------|
| `GET /api/system/alive` | Liveness: the process answers |
| `GET /api/system/ready` | Readiness: 200 while the database answers, otherwise 503 |
| `GET /api/system/health` | The same check with details per dependency |

The probes are not rate limited and not written to the request log. On
`SIGTERM` or `SIGINT` the server stops accepting connections, lets requests
in flight finish (for up to 10 seconds), closes the database connections and
exits with status 0. It does not start at all when the database is
unreachable.

## 🧪 Testing

- **Unit tests** (`pnpm test`): pure logic, no external services (Vitest)
- **Integration tests** (`pnpm test:integration`): the HTTP API and the
  server's start-up and shutdown against a real PostgreSQL, with one isolated
  schema per API test. They start a PostgreSQL
  container through testcontainers, or use an existing database when
  `TEST_DATABASE_URL` is set:

  ```bash
  TEST_DATABASE_URL=postgres://<user>:<password>@localhost:5432/<database> pnpm test:integration
  ```

See [docs/testing-requirements.md](docs/testing-requirements.md) for testing guidelines.

## 📚 Documentation

### Core Documentation

- [Architecture Overview](docs/architecture-overview.md) - System design and architecture
- [Development Guidelines](CLAUDE.md) - Coding standards and best practices
- [API Documentation](docs/api-testing-guide.md) - API testing and development

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
- [Testing Requirements](docs/testing-requirements.md)
- [Type Generation System](docs/type-generation-system.md)

## 🔑 Key Technologies

### Backend
- **TypeScript** - Type-safe JavaScript
- **TypeSpec** - API-first type generation
- **Express** - Web framework
- **Drizzle ORM** - Type-safe database access
- **PostgreSQL** - Relational database
- **ts-pattern** - Pattern matching
- **Zod** - Runtime validation
- **testcontainers** - Integration testing

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **TanStack Query** - Data fetching
