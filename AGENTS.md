# AI Agent Guidelines

Instructions for AI coding agents that work in this repository, and the list
of the specialized agents defined for it.

## 📏 Rules

[CLAUDE.md](CLAUDE.md) is the one statement of the project's conventions:
architecture, type-safety rules, naming, API–DB consistency, testing
requirements, the reference implementation and the definition of done. Every
agent reads it before changing anything.

This file and the agent definitions do not carry their own copy of those
conventions. If one of them seems to disagree with `CLAUDE.md`, `CLAUDE.md` is
right and the other file needs fixing.

The rules that most often decide whether a change is acceptable:

- No `any`, no type assertions (`as`), no type guards, no thrown exceptions in application code
- State and errors are sum types, handled exhaustively with ts-pattern; functions that can fail return a `Result`
- The API contract is written in TypeSpec first; types are generated, never written by hand
- The database schema is the source of truth: API property names are the column names, and a nullable column is a nullable property
- Nothing is built "for the future" (YAGNI); unused code is removed, not commented out

## 🧭 Working in the Repository

- **Toolchain**: the Node version in `.node-version`, and pnpm (the version in `packageManager` of `package.json`). Lint and format are Biome; tests are Vitest
- **What exists**: the Salon domain and the system endpoints. The other domains are specified in TypeSpec and present in the database schema, but have no backend code. Follow the Salon files listed in `CLAUDE.md` when adding one
- **Generated files are never edited by hand**: `specs/tsp-output/`, `backend/packages/generated/src/`, `frontend/packages/api-client/src/generated/` (from `pnpm generate`), and `backend/packages/database/src/schema.ts`, `relations.ts`, `sql/setup.sql` (from `pnpm db:introspect` and `pnpm db:generate-sql`). They are committed together with the change that caused them
- **A migration that has been applied is never edited**: write a new file in `backend/packages/database/sql/migrations/`

Before reporting a task as done, run the checks CI runs:

```bash
make ci-check   # install, generated-file and API–DB checks, lint, format, build, typecheck, knip, unit and integration tests, audit
```

The integration tests need a PostgreSQL: the one at `TEST_DATABASE_URL` when
it is set, otherwise a container started through Docker. When a change touches
the database schema, also run `pnpm check:db-schema` (it recreates the database
it is pointed at). Both `pnpm check:generated` and `pnpm check:db-schema`
compare the regenerated files with what git has, so they fail until
regenerated files are committed. If a check cannot be run, say so in the
report instead of reporting success.

## 🤖 Available Agents

The definitions are in `.claude/agents/`. The name is what a task is delegated to.

| Agent | Owns | Typical tasks |
|-------|------|---------------|
| [`salon-business-expert`](.claude/agents/salon-business-expert.md) | Business requirements | Salon operations and workflows, what a feature must do, validating a design against real practice |
| [`database-schema-architect`](.claude/agents/database-schema-architect.md) | `backend/packages/database` (schema, migrations, seeds) | Tables, constraints and indexes, SQL migrations, query performance |
| [`typespec-api-architect`](.claude/agents/typespec-api-architect.md) | `specs/`, and the API–DB consistency rules and baseline in `backend/packages/database` | Models and operations in TypeSpec, the OpenAPI document, type generation |
| [`backend-typescript-architect`](.claude/agents/backend-typescript-architect.md) | `backend/packages/{domain,infrastructure,api,config,utility}`, `backend/apps/server` | Use cases, repositories, mappers, handlers, middleware, backend tests |
| [`senior-frontend-architect`](.claude/agents/senior-frontend-architect.md) | `frontend/` | React components and applications, state, use of the generated API client, frontend tests |
| [`senior-ui-designer`](.claude/agents/senior-ui-designer.md) | Interface design | Layout, interaction, accessibility, the design system |
| [`design-review-architect`](.claude/agents/design-review-architect.md) | Cross-layer review | Agreement between database, API contract, domain code and UI; compliance with `CLAUDE.md` |
| [`documentation-specialist`](.claude/agents/documentation-specialist.md) | `docs/`, `README.md`, `CLAUDE.md`, this file, `.claude/agents/`, documents inside packages | Keeping the documentation true to the code |

## 🔀 Order of Work for a Feature

1. `salon-business-expert`: requirements and workflows
2. `database-schema-architect` and `typespec-api-architect`: the tables and the API contract, agreed together because property names, nullability and enums must match
3. Generation: `pnpm generate`, `pnpm db:introspect`, `pnpm db:generate-sql`, then `pnpm check:api-db`
4. `backend-typescript-architect`: domain, infrastructure and API layers with their tests
5. `senior-ui-designer` and `senior-frontend-architect`: the interface, on the generated client
6. `design-review-architect`: review across the layers
7. `documentation-specialist`: documentation that the change made untrue

The hand-over points and the checks at each of them are described in
[docs/multi-agent-collaboration-framework.md](docs/multi-agent-collaboration-framework.md).
