# Development Guidelines

This document defines the core development principles and coding standards for the Beauty Salon Reservation System.

## 🏗️ Architecture

The system follows Clean Architecture with API-First development. See [docs/architecture-overview.md](docs/architecture-overview.md) for detailed architecture documentation.

### Key Principles

1. **API-First**: TypeSpec → OpenAPI → TypeScript types
2. **Clean Architecture**: Domain/UseCase/Infrastructure/API layers
3. **Type Safety**: Sum types with exhaustive pattern matching
4. **Exception-Free**: Result types for all error handling
5. **YAGNI**: No code "for the future"
6. **DB-Driven Design**: Database schemas are the source of truth for domain models
7. **Property Consistency**: API property names must match DB column names exactly
8. **Nullable Alignment**: API nullable types must match DB nullable constraints
9. **Branded Types**: Use branded types for all entity IDs for type safety
10. **Optional Constraints**: Optional fields only in Search and Update APIs

## 🔒 Type Safety Requirements

### Absolute Rules
- ❌ **NO** `any` types
- ❌ **NO** type assertions (`as`)
- ❌ **NO** type guards
- ❌ **NO** throwing exceptions
- ✅ **USE** Sum types for all state
- ✅ **USE** ts-pattern for exhaustive matching
- ✅ **USE** Result types for errors

The rules cover application code, backend and frontend. The backend follows
them without exception; its two `try`/`catch` are in `Result.fromPromise` and
`Result.fromThrowable`, which turn an exception of a library into a value.
The frontend utility
packages predate the rules and still contain type guards and assertions: new
frontend code follows the rules and does not take them as a model.

`pnpm lint` enforces the four prohibitions: `any` and `!` everywhere, and
type assertions, type guards and `throw` in application code, through the
Biome plugins in `shared-config/biome/`. What is exempt is listed in
[docs/type-safety-principles.md](docs/type-safety-principles.md).

The database scripts (`backend/packages/database/src/scripts`), the seeds and
the tests are command-line programs and test code; there a thrown error that
ends the run with a non-zero status, and `console` output, are the expected
behaviour.

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

See [docs/typescript-configuration.md](docs/typescript-configuration.md) for complete configuration.

## 🎨 Sum Types & Pattern Matching

All state management uses discriminated unions (Sum types) with ts-pattern:

```typescript
// Result type (from @beauty-salon-backend/utility)
export type Result<T, E> =
  | { type: 'success'; data: T }
  | { type: 'error'; error: E }

// Domain error types (backend/packages/domain/src/shared/errors.ts)
// What an error tells a client is in every language (LocalizedText), and a string does not compile:
// the headline of a validation error (message), what an issue says (ValidationIssue.message), what
// an error is about (entity) and why the state does not allow an operation (the message of a conflict)
export type DomainError =
  | { type: 'validation'; message: LocalizedText; issues: ValidationIssue[] }
  | { type: 'unauthenticated'; reason: AuthenticationFailure }
  | { type: 'forbidden' }
  | { type: 'passwordRequired' }
  | { type: 'notFound'; entity: LocalizedText; id: string | null }
  | { type: 'alreadyExists'; entity: LocalizedText; field: string; value: string }
  | { type: 'conflict'; message: LocalizedText }
  | { type: 'database'; message: string; cause: unknown }
  | { type: 'storage'; message: string; cause: unknown }

// Exhaustive handling in API routes
match(result)
  .with({ type: 'success' }, ({ data }) => {
    res.status(201).json({ data, meta: responseMeta(req), links })
  })
  .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
  .exhaustive()
```

Inside a function, a failed step is returned as it is:

```typescript
const found = await repository.findById(id)
if (found.type === 'error') {
  return found
}
```

See [docs/sum-types-pattern-matching.md](docs/sum-types-pattern-matching.md) for patterns.

## 🎯 Implementation Standards

### Uniform Patterns
All implementations must follow standardized patterns for:
- Pagination
- Response formatting
- Error handling
- Date/time processing (date-fns)
- Query parameters
- Request validation (Zod v4 schemas typed against the generated API types)
- Authorization
- Logging
- ID validation

See [docs/uniform-implementation-guide.md](docs/uniform-implementation-guide.md) for implementation patterns.

## 🧪 Testing Requirements

### Minimum Coverage
- Unit tests for all domain logic
- Integration tests against a real PostgreSQL (`TEST_DATABASE_URL` when set, otherwise testcontainers)
- End-to-end coverage of the critical paths: the API integration tests drive the production app over HTTP, the server tests start the real server, and the browser tests (`pnpm test:e2e`) drive the built frontend applications against that app and a real PostgreSQL
- Frontend code that calls the API is tested against that production app on a real PostgreSQL with the seed data, without a stub (`*.integration.test.tsx`, through the test server of the backend)
- Minimum 5 error scenarios per endpoint

### Test Structure
```typescript
describe('Feature', () => {
  it('should handle success case', async () => {
    // Arrange
    const input = createTestInput()

    // Act
    const result = await executeFeature(input)

    // Assert
    expect(result).toMatchObject({ type: 'success' })
  })
})
```

See [docs/testing-requirements.md](docs/testing-requirements.md) for testing patterns.

## 📁 Package Structure

### Backend Packages
```
backend/
├── apps/server/          # Composition root: configuration, logger, start-up, shutdown
└── packages/
    ├── domain/           # Pure business logic
    ├── infrastructure/   # Database access, mail (SMTP), object storage (S3), password hashing, tokens, one-time passwords, logging
    ├── api/              # HTTP layer
    ├── database/         # DB schema, migrations, seeds
    ├── generated/        # Auto-generated API types
    ├── config/           # Configuration
    └── utility/          # Result type and shared helpers
```

Every operation of the API contract is implemented, in every layer. What each
area does is stated once, in the table "Implementation Status" of
[README.md](README.md#implementation-status), which names the document of each
area. This file does not repeat it.

Every domain has the same places: `domain/src/business-logic/<domain>/` (one
use case per file, the pure rules in `_shared/`), `domain/src/models/`,
`schemas/`, `mappers/` and `repositories/` (the contract of the repository),
`infrastructure/src/repositories/<domain>.repository.impl.ts` (its
implementation, which is I/O; what the implementations share is in
`repositories/_shared/`) and `api/src/routes/<domain>/` (one handler per
operation). The routers are mounted in `api/src/index.ts`. A test is in the
`__tests__` of the folder whose code it tests (`schemas/__tests__/`,
`mappers/__tests__/`, `business-logic/<domain>/__tests__/`, and the integration
tests of the endpoints in `api/src/routes/<domain>/__tests__/`), and what the
tests of more than one folder share is in `domain/src/__tests__/fixtures/` and
`api/src/__tests__/_shared/`.

Before changing a domain, read its document under `docs/` (the rules, and what
is deliberately not there) and its section of
[docs/domain-implementation-reference.md](docs/domain-implementation-reference.md)
(what its layers do differently from the reference, and why).

### Frontend Packages
```
frontend/
├── apps/                 # portal-app, admin-app, dashboard-app: Vite and React single-page applications
├── e2e/                  # Browser tests (Playwright): the built applications against the real API and PostgreSQL
└── packages/
    ├── theme/            # Design tokens, typefaces, reset, the check of the style rules
    ├── ui/               # Shared components (CSS Modules) and their Storybook, and what a form was sent with and says
    ├── testing/          # What the frontend tests share: matchers, the accessibility check, what jsdom lacks, the tools of the screen tests, the answers of the API a test makes up and what its stand-in for `fetch` was asked, the names of the seed data, the real API of the integration tests and what a test reads from its database
    ├── api-client/       # API client generated by orval, and the fetch function it calls
    ├── answers/          # How an answer of the API is read: why nothing came of a request, the values it refused, the pages of a list, the parts of the patterns, the sentences of a request that got nowhere
    ├── fields/           # The rules of the values a form takes, in every application: days, names, addresses of mail, telephone numbers, lengths, choices, addresses of the web, and the record of a customer
    ├── io/               # The session the browser keeps, and the files a page saves
    ├── session/          # The session of an application: who is signed in, the sign-in screen, the guard of the screens that need a session
    ├── app-frame/        # The start and the frame of an application: the query client and the router, the header with its links, the screen of an address that is none, and the application that is all behind a session, with the screens of the account
    ├── preferences/      # What a customer wishes for, which the portal and the admin application share: the form, and how it is shown
    ├── salon-screens/    # What the screens of a salon share in the admin and the dashboard applications: the table that goes on, the clock of a salon, the choice of a salon and the salon of an address, the period of a count and the days of a search
    ├── config/           # Values of the environment
    └── brand/            # The names of the applications, their icons and the image of a shared link, and the Vite plugin that serves them and names them in the head of the page
```

A shared package sorts the modules of its `src` by what they are, and an
application those of each of its areas (`src/<area>/`), under the same names
everywhere: `api/` (the functions that call the API), `components/<name>/`
(what only shows), `hooks/`, `screens/` (what knows the API, the session or
the router) and `utils/` (pure functions, for the most part). A test is
beside the module it tests. A package whose modules are all of one kind
keeps them in `src/` (`fields`, `answers`, `theme`). `testing` sorts its
tools by what each is for (`setup/`, `stories/`, `accessibility/`,
`screens/`, `fixtures/`, `api/`), and a browser test is in the folder of its
application (`frontend/e2e/src/admin/`, `dashboard/`, `portal/`), beside
`applications/`, `layout/` and `support/`.

Styles are CSS Modules over the tokens of `theme`, layout is CSS Grid and
never flex, and a component is tested from its stories, with an accessibility
test for every story. The rules are two skills,
[frontend-ui](.claude/skills/frontend-ui/SKILL.md) and
[frontend-testing](.claude/skills/frontend-testing/SKILL.md): read them before
changing anything under `frontend/`. `pnpm test` fails on a broken style rule.

### Shared Packages
```
shared-config/            # @beauty-salon-shared/config: tsconfig files, the build of the packages, Biome plugins
shared-i18n/              # @beauty-salon-shared/i18n: the languages (en, ja), how one is chosen from Accept-Language, and the messages
```

A text that is told in more than one language is a message of
`shared-i18n/src/messages/<who says it>/` (`api/`, for what the API says),
written in every language with `text({ en, ja })`: one that lacks a language
does not compile. The headline of a validation error and the message of a
rule, of a schema or of a use case, are such messages, in the file of their
domain (`messages/api/salon.ts`; `rules.ts` for the rules that domains
share). A schema gives one to Zod as one string (`asOneString`): a sentence
written as a string in a schema fails a test. A use case puts one into the
issue as it is (`message: ruleMessages.aSalon`): a string there does not
compile. What was not found, or is there already, is named with a message
of `entities.ts` (`DomainErrors.notFound(entityMessages.salon, id)`), and
the API layer makes the sentence in the language asked for: a name written
as a string does not compile. Why the state of something does not allow an
operation is a message of the file of its domain
(`DomainErrors.conflict(saleMessages.alreadyVoid)`), told as it is: a value
in it (a status, an ID) stands in every language as it is, and a string
does not compile. Read [docs/i18n.md](docs/i18n.md) before
adding one: it also says what is told in one language alone (the screens,
the mails, the log).

### Namespace Convention
- Backend: `@beauty-salon-backend/*`
- Frontend: `@beauty-salon-frontend/*`
- Specs: `@beauty-salon/specs`
- Shared: `@beauty-salon-shared/*`

## 📝 TypeSpec Model Naming Convention

### Input Models (Request)
- Create: `XXXCreateRequest`
- Update: `XXXUpdateRequest`
- Delete: `XXXDeleteRequest`
- Bulk Create: `XXXBulkCreateRequest`
- Bulk Update: `XXXBulkUpdateRequest`
- Bulk Delete: `XXXBulkDeleteRequest`
- Get: `XXXGetRequest`
- Search/List: `XXXSearchRequest`

### Output Models (Response)
- All responses: `XXXResponse`

### Examples
```typespec
model CustomerCreateRequest { ... }     // Create customer input
model CustomerUpdateRequest { ... }     // Update customer input
model CustomerSearchRequest { ... }     // Search customers input
model CustomerResponse { ... }          // Customer response

model AuthLoginRequest { ... }          // Login input
model AuthLoginResponse { ... }         // Login response
```

## 🔄 Development Workflow

### Type Generation Pipeline
1. Define models in TypeSpec (`specs/`)
2. Run `pnpm generate` (OpenAPI → frontend API client → backend types)
3. Implement with generated types
4. Commit the generated files with the TypeSpec change (`pnpm check:generated` guards this in CI)

### Database Workflow
1. Write a SQL migration in `backend/packages/database/sql/migrations/` (`YYYYMMDDHHMM_description.sql`). Each one is applied once and recorded, so a migration that has been applied anywhere is never edited: write a new one
2. `pnpm db:migrate` → `pnpm db:introspect` → `pnpm db:generate-sql`
3. Commit `schema.ts`, `relations.ts` and `sql/setup.sql` (`pnpm check:db-schema` guards this in CI, and the integration tests fail when `setup.sql` lacks a migration)
4. Keep the API models in line with the tables (`pnpm check:api-db` guards this in CI)
5. A model that is stored in a `jsonb` column is checked whenever it is read. When a property leaves such a model or is renamed, the same change has a migration that rewrites the stored values (`202611160500_business_hours_without_time_zone.sql`); it regenerates nothing, and the migration tests say what it does to the rows

### Code Quality Checks
```bash
pnpm lint          # Biome lint
pnpm format:check  # Formatting (Biome and TypeSpec), read-only
pnpm format:fix    # Apply formatting, import sorting and safe fixes
pnpm typecheck     # Type checking (build first)
pnpm knip          # Unused files, exports and dependencies
pnpm check:api-db  # API models agree with the database schema
pnpm test          # Unit tests
make ci-check      # The CI checks, in the same order (all but check:db-schema)
```

## 🚀 Quick Commands

```bash
# Development
pnpm dev              # Backend (:3000) and frontend apps (:3001-3003) in watch mode
pnpm dev:backend      # Backend only, runs workspace packages from source
pnpm generate         # Generate all types
pnpm generate:watch   # Regenerate on every TypeSpec change

# Database
pnpm db:fresh         # Drop everything and recreate the schema from sql/setup.sql
pnpm db:migrate       # Create the schema from setup.sql, or apply the migrations not applied yet
pnpm db:seed          # Seed data with statistics, including accounts to sign in with;
                      # refuses to run when NODE_ENV=production
pnpm db:truncate      # Clear all table data
pnpm db:introspect    # Regenerate schema.ts and relations.ts from the DB
pnpm db:generate-sql  # Regenerate sql/setup.sql from schema.ts

# Testing
pnpm test             # Unit tests (*.test.ts)
pnpm test:integration # Tests against PostgreSQL, an SMTP server and an object storage (*.integration.test.ts),
                      # and the frontend tests that call the real API (*.integration.test.tsx)
                      # PostgreSQL: TEST_DATABASE_URL when set, otherwise testcontainers;
                      # SMTP and the storage: a Mailpit and a SeaweedFS container (testcontainers),
                      # so Docker is needed
pnpm test:e2e         # Browser tests (frontend/e2e, *.e2e.test.ts): Playwright on the built frontend
                      # applications, the real API and PostgreSQL; builds the frontend packages first.
                      # `pnpm test:e2e:install` installs its browser, once

# Build
pnpm build            # Production build (same as build:prod)
pnpm build:dev        # Development build
pnpm build:test       # Test build
pnpm build:stg        # Staging build
pnpm build:prod       # Production build

# CI/CD Local Testing
make ci-check             # Run the CI checks locally (all but the schema check)
make db-check             # The schema check: recreates the database it is pointed at
make ci-check-dockerfile  # Test all Docker builds locally before pushing

# Images (GitHub Actions, .github/workflows/publish-images.yml)
# Push to main     → After the CI checks pass, builds the staging images and pushes them to GitHub Container Registry
# Manual trigger   → The same for the chosen environment (staging or production), without the checks
# Rolling an image out, and running pnpm db:migrate first, is not automated
```

## 📚 Documentation References

The full index is [docs/README.md](docs/README.md).

### Core Concepts
- [Architecture Overview](docs/architecture-overview.md)
- [Type Safety Principles](docs/type-safety-principles.md)
- [Sum Types & Pattern Matching](docs/sum-types-pattern-matching.md)

### Implementation Guides
- [Backend Architecture](docs/backend-architecture-guidelines.md)
- [Uniform Implementation](docs/uniform-implementation-guide.md)
- [Authentication and Authorization](docs/authentication.md)
- [Service Menu](docs/service-menu.md)
- [Customer Ledger](docs/customers.md)
- [Staff Ledger](docs/staff.md)
- [Booking Ledger](docs/bookings.md)
- [Sales Ledger](docs/sales.md)
- [Payments](docs/payments.md)
- [Sales Reports](docs/sales-reports.md)
- [Points](docs/points.md)
- [Reviews](docs/reviews.md)
- [Products](docs/products.md)
- [Inventory](docs/inventory.md)
- [Purchase Orders](docs/purchase-orders.md)
- [Inventory Alerts](docs/inventory-alerts.md)
- [Treatments](docs/treatments.md)
- [Medical Charts](docs/medical-charts.md)
- [Attachments](docs/attachments.md)
- [Email](docs/email.md)
- [i18n](docs/i18n.md)
- [Testing Requirements](docs/testing-requirements.md)
- [Multi-Agent Collaboration](docs/multi-agent-collaboration-framework.md)

### Frontend
- [Frontend UI](.claude/skills/frontend-ui/SKILL.md) (skill)
- [Frontend Testing](.claude/skills/frontend-testing/SKILL.md) (skill)
- [Frontend API Integration](docs/frontend-api-integration.md)

### API Development
- [TypeSpec API Rules](docs/typespec-api-type-rules.md)
- [Type Generation System](docs/type-generation-system.md)
- [API Testing Guide](docs/api-testing-guide.md)

## 📖 Reference Implementation (Salon Domain)

The salon domain serves as the reference implementation for all other domains.
Every operation in `specs/operations/salon-operations.tsp` is implemented, and
nothing else is specified.

### Layer Structure:
```typescript
// 1. Database Schema (Source of Truth)
// backend/packages/database/src/schema.ts
export const salons = pgTable('salons', {...})

// 2. Models: types only, inferred from the DB schema and the generated API types
// backend/packages/domain/src/models/salon.ts
export const salonIdSchema = uuidSchema.brand<'SalonId'>()
export type SalonId = z.infer<typeof salonIdSchema>

export type ApiSalonResponse = components['schemas']['Models.SalonResponse']
export type ApiSalonCreateRequest = components['schemas']['Models.SalonCreateRequest']

export type DbSalon = DeepRequired<typeof salons.$inferSelect>
// Without the columns the database or other features fill in
export type DbNewSalon = DeepRequired<Omit<typeof salons.$inferInsert, SalonManagedColumn>>

// 3. Validation: one Zod schema per request, checked against the generated type
// backend/packages/domain/src/schemas/salon.schema.ts
export const salonCreateRequestSchema = z.strictObject({
  name: nonBlankText.max(255),          // limits are those of the columns
  nameKana: nonBlankText.max(255).nullable(),
  // The message of a rule is written in every language and given to Zod as one string
  currency: z.string().regex(/^[A-Z]{3}$/, asOneString(salonMessages.currencyCode)),
  // ...
}) satisfies z.ZodType<ApiSalonCreateRequest>

// The rules that the schemas of more than one domain share (nonBlankText, lowerCaseEmail, phoneNumber,
// MAX_INTEGER, noRepeatedEntries, atLeastOneProperty) are in backend/packages/domain/src/schemas/rules.ts
export const salonUpdateRequestSchema = salonCreateRequestSchema.exactPartial().check(atLeastOneProperty)

// 4. Repository Interface
// backend/packages/domain/src/repositories/salon.repository.ts
export interface ISalonRepository {
  create(salon: DbNewSalon, openingHours: DbNewOpeningHours[]): Promise<Result<SalonWithOpeningHours, DomainError>>
  findById(id: SalonId): Promise<Result<SalonWithOpeningHours | null, DomainError>>
  exists(id: SalonId): Promise<Result<boolean, DomainError>>
  list(criteria: SalonListCriteria): Promise<Result<SalonList, DomainError>>
  update(id: SalonId, changes: DbSalonChanges, openingHours: OpeningHoursChange): Promise<Result<SalonWithOpeningHours | null, DomainError>>
  delete(id: SalonId): Promise<Result<SalonDeletion, DomainError>>
}

// 5. Dependencies Interface (Object-based DI)
// backend/packages/domain/src/business-logic/salon/_shared/dependencies.ts
export interface SalonUseCaseDependencies {
  salonRepository: ISalonRepository
}

// 6. Authorization: who may, as pure functions of the actor
// backend/packages/domain/src/business-logic/salon/_shared/authorization.ts
export const mayCreateSalon = (actor: Actor): boolean =>
  actor.scope.type === 'platform'

// 7. Use Case: the actor and untrusted input in, API model or DomainError out
// backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts
export class CreateSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  async execute(actor: Actor, input: unknown): Promise<Result<ApiSalonResponse, DomainError>> {
    // Authorize → Validate → Map API→DB → Save → Map DB→API → Return
    if (!mayCreateSalon(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(salonCreateRequestSchema, input, salonMessages.invalidSalon)
    if (request.type === 'error') {
      return request
    }
    const { salon, openingHours } = SalonWriteMapper.fromCreateRequest(request.data)
    const created = await this.dependencies.salonRepository.create(salon, openingHours)
    if (created.type === 'error') {
      return created
    }
    return SalonReadMapper.toApiSalon(created.data.salon, created.data.openingHours)
  }
}

// 8. Mappers, on both sides of every domain: property names are the column names; only representations change.
// A request that was checked goes to the write mapper and nowhere else, also where nothing is converted
// backend/packages/domain/src/mappers/write/salon.mapper.ts
export const SalonWriteMapper = {
  fromCreateRequest(request: ApiSalonCreateRequest): { salon: DbNewSalon; openingHours: DbNewOpeningHours[] }
  fromUpdateRequest(request: ApiSalonUpdateRequest): { changes: DbSalonChanges; openingHours: OpeningHoursChange }
  // The limit (20 when the request names none) and the cursor: toPaging in mappers/write/page.ts
  fromSearchRequest(request: SalonSearchRequest): SalonListCriteria
}
// backend/packages/domain/src/mappers/read/salon.mapper.ts
// numeric → number, timestamptz → ISO 8601, jsonb → checked against the API model, with `parseStored`:
// a stored value that does not match is a `database` error that names the row for the log, never a validation error
export const SalonReadMapper = {
  toApiSalon(salon: DbSalon, openingHours: DbOpeningHours[]): Result<ApiSalonResponse, DomainError>
  // `data` and the pagination `meta`: toApiPage in mappers/read/page.ts
  toApiSalonPage(list: SalonList, paging: Paging<SalonId>): Result<ApiPage<ApiSalonResponse>, DomainError>
}

// 9. Repository Implementation: no throw, no cast; writes are transactions.
// An unexpected failure becomes a `database` error whose cause is safe to log
// (the statement and the SQLSTATE, never the bound values).
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts
export class SalonRepository implements ISalonRepository {
  constructor(private readonly db: Database) {}
}

// 10. API Route with Dependency Injection (Modular Handler Pattern)
// backend/packages/api/src/routes/salon/create-salon.handler.ts
// Each endpoint has its own handler file following [action]-[domain].handler.ts.
// A handler is created from its dependencies; it never reaches for a global.
// A handler that needs a signed-in user is wrapped with `authenticated`
// (backend/packages/api/src/shared/authentication.ts): without a valid access
// token the request is answered with 401 and the handler does not run.
// Public operations (list, get) are not wrapped and their use cases take no actor.
export const createSalonHandler = (
  dependencies: SalonUseCaseDependencies,
  authenticated: Authenticated,
): RequestHandler<
  Record<string, never>,                 // Path params
  CreateSalonResponse | ProblemDetails,  // Response body types
  unknown                                // Request body: validated by the use case
> => {
  const useCase = new CreateSalonUseCase(dependencies)

  return authenticated(async (actor, req, res) => {
    const result = await useCase.execute(actor, req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = salonLinks(req.baseUrl, data.id)
        res.status(201).location(links.self).json({ data, meta: responseMeta(req), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  })
}

// backend/packages/api/src/routes/salon/index.ts
export const createSalonRouter = (dependencies: SalonUseCaseDependencies, authenticated: Authenticated): Router

// backend/packages/api/src/index.ts: repositories and `authenticated` are created once, here
export const createApp = ({ database, logger, mailer, fileStorage, twoFactorAuthenticator, settings }: AppDependencies): Express
// One clock for the use cases that need the current time
const clock = (): Date => new Date()
const authenticated = createAuthenticated(authDependencies)
app.use(`${API_BASE_PATH}/auth`, createAuthRouter(authDependencies, authenticated))
const salonRepository = new SalonRepository(database)
app.use(`${API_BASE_PATH}/salons`, createSalonRouter({ salonRepository }, authenticated))
// The routers of what belongs to a salon are mounted below the salon and are given the same salon repository
app.use(`${API_BASE_PATH}/salons/:salonId/service-categories`, createServiceCategoryRouter({ serviceCategoryRepository: new ServiceCategoryRepository(database), salonRepository }, authenticated))
// Every other router is mounted in this file in the same way. A router that would take a fixed
// segment for an ID is mounted after the router of that segment (`/customers/me/...` before `/customers`)

// 11. Composition root: the only code that reads the environment or ends the process
// backend/apps/server/src/index.ts
// loadEnvFile() → parseAppConfig(process.env) → createLogger(...) → startServer(config, logger)
// backend/packages/config/src/app-config.ts
export const parseAppConfig = (variables: Record<string, string | undefined>): Result<AppConfig, ConfigIssue[]>
// backend/apps/server/src/server.ts
export const startServer = (config: AppConfig, logger: Logger, shutdownGraceMs?: number): Promise<Result<RunningServer, StartFailure>>
```

### Conventions the reference follows
- **Validation** happens once, in the use case, with the Zod schema of the request. The headline of a refusal (`salonMessages.invalidSalon`) and the message of a rule (`asOneString(ruleMessages.notBlank)`) are messages of the language package, and `parseWith` lets Zod say its own sentences in every language (see [docs/i18n.md](docs/i18n.md)). Cross-field rules use `.check()`; a rule that ties two properties of which a partial update may name only one cannot be checked on the request and is a pure function of the domain instead (the services, below)
- **Mappers** stand on both sides of every domain: `mappers/write/` (API request → what the repository takes: a row, the changes of one, the criteria of a list) and `mappers/read/` (rows → API response, the page of a list too). A use case gives a request it has checked (`request.data`) to its write mapper and to nothing else, and what it answers with comes from a read mapper, also where nothing is converted: there the mapper is where the compiler checks that the request and the row agree. `use-case-flow.test.ts` of the domain package reads the sources of every domain and fails when a use case leaves this flow
- **Authentication** is the wrapper `authenticated`: it turns `Authorization: Bearer <access token>` into an `Actor` (`backend/packages/domain/src/models/auth.ts`) or answers 401. **Authorization** is decided in the use case, first, from the actor; the rules are pure functions in `business-logic/<domain>/_shared/authorization.ts`, and a refusal is `DomainErrors.forbidden()` (403). In TypeSpec a public operation has `@useAuth(NoAuth)` and `PublicErrors`, one that any signed-in user may call has `SessionErrors`, and one with a permission check has `CommonErrors`. See [docs/authentication.md](docs/authentication.md)
- **Errors** are `DomainError` values; `api/src/shared/problem-details.ts` maps each kind to an HTTP status and never exposes the cause of a `database` error. `sendProblem` tells a problem in the language of `Accept-Language` (English without it) and names it in `Content-Language`: every text of an error is written in every language, so an answer is in one language as a whole (see [docs/i18n.md](docs/i18n.md)). What goes wrong outside a use case (unknown route, unreadable body, rate limit, unexpected exception) is an `HttpError` and takes the same path, so every error response of the API is problem details (a system probe that fails answers 503 with its own body)
- **Logging** is structured (pino): `req.log` inside a request, the injected `Logger` elsewhere, never `console`. `sendProblem` logs a `database` error with its cause; headers, bodies and bound SQL values are never logged
- **Request ID**: `req.id` (the caller's `X-Request-Id` or a new UUID) is on every log line of the request, in the response header and in `meta.correlationId` / `correlationId`
- **Configuration** is read once, by `parseAppConfig`, and passed down as values; application code does not read `process.env`. A new variable is added to the schema, to every `.env.*` file and to the README table
- **Partial update** is `PATCH`: a property that is absent is left alone, `null` clears a nullable column
- **Lists** use keyset pagination: `cursor` is the ID of the last item of the previous page (`meta.nextCursor`). The write mapper turns `limit` and `cursor` into the place of the page (`toPaging`), and the read mapper makes the page (`toApiPage`)
- **Deleted rows** (`deletedAt`) are invisible to the repository methods, but for those whose subject is the deleted row (the history and the restore of a customer, the purge of the attachments). The cursor of the service list, of the staff list, of the list of staff profiles and of the customer list may still name a deleted row: the row stays, so the page starts after its place
- **Data that belongs to a salon** is served below the salon; the service categories (`business-logic/service-category/`, `routes/service-category/`) are the example to read. The router is mounted at `/salons/:salonId/...` and created with `Router({ mergeParams: true })`, so its handlers see `salonId`. The use case reads the salon of the path with `parseSalonIdOfPath`, decides the permission from that salon alone, and answers 404 through `requireSalon` when the salon does not exist. Every repository method takes the salon ID, so a resource of another salon is not found (404). The create and update requests do not carry `salonId`. The write mapper of the service categories returns a request as the row, and makes the criteria of the list from the query and the salon of the path; the one of the services (`business-logic/service/`, `routes/service/`) tells the service from its options. The services also show what the categories do not: rules that tie two properties together, checked for the row as it will be stored after a partial update (`serviceRuleIssues` in `business-logic/service/_shared/rules.ts`, called by the use case for a create and by the repository inside its transaction for an update); a bulk update that changes all the services or none, whose route `/bulk` is registered before `/:id`; a soft delete; and a delete that is refused with `DomainErrors.conflict` (409). See [docs/authentication.md](docs/authentication.md) and [docs/service-menu.md](docs/service-menu.md)
- **The other domains** have the shape of the reference and differ from it where their data does: data that belongs to no salon, data of a salon whose routes are not below it, rows that are worked out at every read, a record that a mailed token opens, files kept outside the database. What each domain does differently, layer by layer and with the reason, is in [docs/domain-implementation-reference.md](docs/domain-implementation-reference.md), under [Data That Belongs to a Salon](docs/domain-implementation-reference.md#data-that-belongs-to-a-salon) and [Data That Belongs to No Salon](docs/domain-implementation-reference.md#data-that-belongs-to-no-salon); the rules of a domain are in its document (Documentation References, above). Read both before changing a domain, and change them together with the code
- **Tests**: unit tests for schemas, mappers and use cases in the domain package, each file in the `__tests__` of the folder it tests and with tests of one of these kinds; integration tests per endpoint against PostgreSQL in the api package, in the `__tests__` of the folder of the route

## ⚠️ Important Notes

### TypeSpec Enum Naming
All Enum types must end with `Type` suffix (e.g., `ServiceCategoryType`, `PaymentMethodType`)

### DB-Driven Models
Database schemas are the source of truth for domain models:
```typescript
// Types are inferred from Drizzle ORM schemas with DeepRequired wrapper
// backend/packages/domain/src/models/salon.ts
export type DbSalon = DeepRequired<typeof salons.$inferSelect>
export type DbNewSalon = DeepRequired<Omit<typeof salons.$inferInsert, SalonManagedColumn>>
```

`schema.ts` itself is generated from the database by `pnpm db:introspect` and
is never edited by hand. Column names are camelCase in the database, so the
schema, the API and the code use one spelling.

### API-DB Consistency Rules

#### Property Naming
- API property names MUST match DB column names exactly
- No UI-driven renaming (e.g., `websiteUrl` not `website` when the column is `websiteUrl`)
- Mappers must NOT transform property names

#### Type Alignment
- Nullable fields in DB MUST be nullable in API (`Type | null`)
- NOT NULL fields in DB MUST be required in API
- Never convert null to empty string or default values

#### Optional Field Constraints
| API Type | Optional Fields | Required Fields |
|----------|-----------------|-----------------|
| Create | None | All (values can be null) |
| Update | All | None |
| Search | Filter params | Core params (if any) |
| Response | None | All |

#### Validation Checklist
- [ ] All API properties have corresponding DB columns
- [ ] Nullable consistency between API and DB
- [ ] No property name transformations in mappers
- [ ] New API properties trigger DB migration

`pnpm check:api-db` checks the first two, and the values of enum columns, for
every model listed in
`backend/packages/database/src/scripts/api-consistency-rules.ts`. Every model
that is backed by a table is listed there with `omittedColumns`, and any
difference fails the check: there is no list of tolerated differences. A
property whose enum has only some of the values of the enum of its column is
named in `narrowed` of its rule, and must then leave at least one value of
the column out.

### Clean Code Policy
- Remove unused code immediately
- No commented-out code
- No "TODO" comments without tickets
- Use YAGNI principle strictly

## 🎯 Definition of Done

✅ All TypeScript strict checks pass
✅ No linting warnings
✅ All tests green
✅ API documentation updated
✅ Code follows Sum type patterns
✅ No exceptions thrown
✅ Result types used for errors
✅ Pattern matching is exhaustive