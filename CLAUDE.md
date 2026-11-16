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
export type DomainError =
  | { type: 'validation'; message: string; issues: ValidationIssue[] }
  | { type: 'unauthenticated'; reason: AuthenticationFailure }
  | { type: 'forbidden' }
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'conflict'; message: string }
  | { type: 'database'; message: string; cause: unknown }

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
- End-to-end coverage of the critical paths: the API integration tests drive the production app over HTTP, and the server tests start the real server
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
    ├── infrastructure/   # Database access, mail (SMTP), password hashing, tokens, one-time passwords, logging
    ├── api/              # HTTP layer
    ├── database/         # DB schema, migrations, seeds
    ├── generated/        # Auto-generated API types
    ├── config/           # Configuration
    └── utility/          # Result type and shared helpers
```

The Salon domain, the system endpoints and every operation of the
authentication contract are implemented: under `/api/v1/auth` login, refresh,
logout, the current user, registration, email verification, password reset
and change, verifying, accepting and joining the invitation of a staff member,
two-factor authentication, and the list of the signed-in user's
sessions with the revocation of one of them; under `/api/v1/admin/auth` the
administrator operations (read a user, unlock an account, reset two-factor
authentication). So is the Service domain: the service categories of a salon
(`/api/v1/salons/{salonId}/service-categories`) and its services, with their
options and packages (`/api/v1/salons/{salonId}/services`). Of the Customer
domain the customer ledger is implemented: list, create, get, update and
delete under `/api/v1/customers`, for administrators and the members of a
salon. So is a customer's own profile: get, create and update under
`/api/v1/customers/me`, for the signed-in customer account. So are the
preferences of a customer: get and update under
`/api/v1/customers/{id}/preferences`, for whoever keeps the ledger, and under
`/api/v1/customers/me/preferences`, for the customer. The other
operations of `CustomerCrud` are not. Of the Staff domain the staff ledger of
a salon is implemented: list, create, get, update and delete under
`/api/v1/salons/{salonId}/staff`, for administrators and the owner of that
salon. So are the staff profiles, the part of the ledger that customers are
shown: list and get under `/api/v1/staff-profiles`, for anyone, and get and
update of a staff member's own profile under `/api/v1/staff-profiles/me`,
for the signed-in staff member. So are the
schedules of the staff, which say when a staff member works: list and update
under `/api/v1/salons/{salonId}/staff/{id}/schedules`, for administrators,
the owner and the managers of that salon, and for a staff member to read
their own. So are the invitations by which a staff member gets a login
account: get, create and delete under
`/api/v1/salons/{salonId}/staff/{id}/invitation`, for administrators and the
owner of that salon, and verify, accept and join under
`/api/v1/auth/staff-invitation`, for whoever holds the mailed token (an
account that exists joins signed in). So are the accounts that are linked to
the staff: get, update (the role) and delete (which unlinks) under
`/api/v1/salons/{salonId}/staff/{id}/account`, for administrators and the
owner of that salon. Of the Booking domain the booking ledger is implemented:
list, create, get, update, delete, the five actions on the status of a
booking (confirm, cancel, start, complete, no-show) and reschedule under
`/api/v1/bookings`, for administrators and the members of the salon of a
booking (a delete not for its staff); a customer account does not reach it.
A customer, a staff member, a service and a salon are not deleted while a
booking that is not finished refers to them (409).
So are the service lines of a booking that exists: add, get and remove under
`/api/v1/bookings/{bookingId}/services`, as long as the booking is not finished.
The available slots of a salon are implemented as well: the list of what a
customer can book and the check of whether a staff member is occupied, under
`/api/v1/salons/{salonId}/available-slots`. So are a customer's own
bookings: list, create (of a slot the list offers), get, cancel and
reschedule (to a slot the list offers) under
`/api/v1/customers/me/bookings`, for the signed-in customer account. Of
the payment contract the sales ledger of a salon is implemented: list,
create, get, update and void under `/api/v1/sales`, and so are the payment
methods of a salon: list, create, get, update and delete under
`/api/v1/salons/{salonId}/payment-methods`, and so are the payments of a
sale: recording one (`POST /api/v1/sales/{id}/process`) and refunding one
(`POST /api/v1/payments/{id}/refund`), and so are the receipt of a sale
(`GET /api/v1/sales/{id}/receipt`) and the calculation of a sale before
it is entered (`POST /api/v1/sales/calculate`). The rest of that contract
(sales reports, points) and
the other domains
exist in TypeSpec and in the database schema only. Sessions, passwords,
two-factor authentication, permissions, the administrator operations and the
seeded accounts are described in
[docs/authentication.md](docs/authentication.md), the service categories and
the services in [docs/service-menu.md](docs/service-menu.md), the customer
ledger, a customer's own profile and the preferences of a customer in
[docs/customers.md](docs/customers.md), the staff ledger, the
staff profiles, the staff schedules, the staff invitations and the staff accounts in [docs/staff.md](docs/staff.md), the booking ledger in
[docs/bookings.md](docs/bookings.md), the sales ledger in
[docs/sales.md](docs/sales.md), the payment methods of a salon and the payments of a sale in
[docs/payments.md](docs/payments.md), the mails the server sends in
[docs/email.md](docs/email.md).

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
pnpm test:integration # Tests against PostgreSQL and an SMTP server (*.integration.test.ts)
                      # PostgreSQL: TEST_DATABASE_URL when set, otherwise testcontainers;
                      # SMTP: a Mailpit container (testcontainers), so Docker is needed

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
- [Email](docs/email.md)
- [Testing Requirements](docs/testing-requirements.md)
- [Multi-Agent Collaboration](docs/multi-agent-collaboration-framework.md)

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
    const request = parseWith(salonCreateRequestSchema, input, 'Invalid salon')
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

// 8. Mappers: property names are the column names; only representations change
// backend/packages/domain/src/mappers/write/salon.mapper.ts
export const SalonWriteMapper = {
  fromCreateRequest(request: ApiSalonCreateRequest): { salon: DbNewSalon; openingHours: DbNewOpeningHours[] }
  fromUpdateRequest(request: ApiSalonUpdateRequest): { changes: DbSalonChanges; openingHours: OpeningHoursChange }
}
// backend/packages/domain/src/mappers/read/salon.mapper.ts
// numeric → number, timestamptz → ISO 8601, jsonb → checked against the API model
export const SalonReadMapper = {
  toApiSalon(salon: DbSalon, openingHours: DbOpeningHours[]): Result<ApiSalonResponse, DomainError>
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
export const createApp = ({ database, logger, mailer, twoFactorAuthenticator, settings }: AppDependencies): Express
// One clock for the use cases that need the current time (authentication, the staff invitations, customers, the available slots, a customer's own bookings, the receipt of a sale)
const clock = (): Date => new Date()
const authenticated = createAuthenticated(authDependencies)
app.use(`${API_BASE_PATH}/auth`, createAuthRouter(authDependencies, authenticated))
const salonRepository = new SalonRepository(database)
// The routes of whoever holds an invitation live below /auth: two are public, and the one by which an account that exists joins needs a session.
// staffInvitationDependencies has the invitation and salon repositories, and the password hasher, the token issuer, the mailer and the clock of authentication
app.use(`${API_BASE_PATH}/auth/staff-invitation`, createStaffInvitationAcceptanceRouter(staffInvitationDependencies, authenticated))
app.use(`${API_BASE_PATH}/salons`, createSalonRouter({ salonRepository }, authenticated))
// The routers of what belongs to a salon are mounted below the salon and are given the same salon repository
app.use(`${API_BASE_PATH}/salons/:salonId/service-categories`, createServiceCategoryRouter({ serviceCategoryRepository: new ServiceCategoryRepository(database), salonRepository }, authenticated))
app.use(`${API_BASE_PATH}/salons/:salonId/payment-methods`, createPaymentMethodRouter({ paymentMethodRepository: new PaymentMethodRepository(database), salonRepository }, authenticated))
app.use(`${API_BASE_PATH}/salons/:salonId/services`, createServiceRouter({ serviceRepository: new ServiceRepository(database), salonRepository }, authenticated))
app.use(`${API_BASE_PATH}/salons/:salonId/staff`, createStaffRouter({ staffRepository: new StaffRepository(database), salonRepository }, authenticated))
// What belongs to a staff member is mounted below the staff member: the router sees `salonId` and `id`
app.use(`${API_BASE_PATH}/salons/:salonId/staff/:id/invitation`, createStaffInvitationRouter(staffInvitationDependencies, authenticated))
app.use(`${API_BASE_PATH}/salons/:salonId/staff/:id/account`, createStaffAccountRouter({ staffAccountRepository: new StaffAccountRepository(database), salonRepository }, authenticated))
app.use(`${API_BASE_PATH}/salons/:salonId/staff/:id/schedules`, createStaffScheduleRouter({ staffScheduleRepository: new StaffScheduleRepository(database), salonRepository }, authenticated))
// The available slots of a salon are worked out, not stored: the router is given the clock, because a slot begins after now
app.use(`${API_BASE_PATH}/salons/:salonId/available-slots`, createAvailableSlotRouter({ availableSlotRepository: new AvailableSlotRepository(database), salonRepository, clock }, authenticated))
// The list and the get of the staff profiles are public: `authenticated` wraps the two routes of `/me` only
app.use(`${API_BASE_PATH}/staff-profiles`, createStaffProfileRouter({ staffProfileRepository: new StaffProfileRepository(database) }, authenticated))
// What belongs to the signed-in customer is mounted before the routers of the customers, which would take "me" for an ID.
// A customer's own bookings are rows of the ledger: the router shares its dependencies and is given the clock, because a slot begins after now
const bookingDependencies = { bookingRepository: new BookingRepository(database), bookingNumberIssuer: new RandomBookingNumberIssuer() }
app.use(`${API_BASE_PATH}/customers/me/bookings`, createCustomerBookingRouter({ ...bookingDependencies, clock }, authenticated))
// The preferences of a customer have two routers: "me" first
const customerPreferencesDependencies = { customerPreferencesRepository: new CustomerPreferencesRepository(database) }
app.use(`${API_BASE_PATH}/customers/me/preferences`, createOwnCustomerPreferencesRouter(customerPreferencesDependencies, authenticated))
app.use(`${API_BASE_PATH}/customers/:id/preferences`, createCustomerPreferencesRouter(customerPreferencesDependencies, authenticated))
// The customers belong to no salon: their router is mounted beside the salons
app.use(`${API_BASE_PATH}/customers`, createCustomerRouter({ customerRepository: new CustomerRepository(database), clock }, authenticated))
// The bookings are a salon's, but their routes are not below it: the salon comes from the body, the query or the booking
// The service lines of a booking are mounted below the booking: the router sees `bookingId`
app.use(`${API_BASE_PATH}/bookings/:bookingId/services`, createBookingServiceRouter(bookingDependencies, authenticated))
app.use(`${API_BASE_PATH}/bookings`, createBookingRouter(bookingDependencies, authenticated))

// 11. Composition root: the only code that reads the environment or ends the process
// backend/apps/server/src/index.ts
// loadEnvFile() → parseAppConfig(process.env) → createLogger(...) → startServer(config, logger)
// backend/packages/config/src/app-config.ts
export const parseAppConfig = (variables: Record<string, string | undefined>): Result<AppConfig, ConfigIssue[]>
// backend/apps/server/src/server.ts
export const startServer = (config: AppConfig, logger: Logger, shutdownGraceMs?: number): Promise<Result<RunningServer, StartFailure>>
```

### Conventions the reference follows
- **Validation** happens once, in the use case, with the Zod schema of the request. Cross-field rules use `.check()`; a rule that ties two properties of which a partial update may name only one cannot be checked on the request and is a pure function of the domain instead (the services, below)
- **Authentication** is the wrapper `authenticated`: it turns `Authorization: Bearer <access token>` into an `Actor` (`backend/packages/domain/src/models/auth.ts`) or answers 401. **Authorization** is decided in the use case, first, from the actor; the rules are pure functions in `business-logic/<domain>/_shared/authorization.ts`, and a refusal is `DomainErrors.forbidden()` (403). In TypeSpec a public operation has `@useAuth(NoAuth)` and `PublicErrors`, one that any signed-in user may call has `SessionErrors`, and one with a permission check has `CommonErrors`. See [docs/authentication.md](docs/authentication.md)
- **Errors** are `DomainError` values; `api/src/shared/problem-details.ts` maps each kind to an HTTP status and never exposes the cause of a `database` error. What goes wrong outside a use case (unknown route, unreadable body, rate limit, unexpected exception) is an `HttpError` and takes the same path, so every error response of the API is problem details (a system probe that fails answers 503 with its own body)
- **Logging** is structured (pino): `req.log` inside a request, the injected `Logger` elsewhere, never `console`. `sendProblem` logs a `database` error with its cause; headers, bodies and bound SQL values are never logged
- **Request ID**: `req.id` (the caller's `X-Request-Id` or a new UUID) is on every log line of the request, in the response header and in `meta.correlationId` / `correlationId`
- **Configuration** is read once, by `parseAppConfig`, and passed down as values; application code does not read `process.env`. A new variable is added to the schema, to every `.env.*` file and to the README table
- **Partial update** is `PATCH`: a property that is absent is left alone, `null` clears a nullable column
- **Lists** use keyset pagination: `cursor` is the ID of the last item of the previous page (`meta.nextCursor`)
- **Deleted rows** (`deletedAt`) are invisible to every repository method. The cursor of the service list, of the staff list, of the list of staff profiles and of the customer list may still name a deleted row: the row stays, so the page starts after its place
- **Data that belongs to a salon** is served below the salon; the service categories (`business-logic/service-category/`, `routes/service-category/`) are the example to read. The router is mounted at `/salons/:salonId/...` and created with `Router({ mergeParams: true })`, so its handlers see `salonId`. The use case reads the salon of the path with `parseSalonIdOfPath`, decides the permission from that salon alone, and answers 404 through `requireSalon` when the salon does not exist. Every repository method takes the salon ID, so a resource of another salon is not found (404). The create and update requests do not carry `salonId`. A write mapper exists where a column needs converting or a request holds the rows of more than one table: the service categories have none, and the services (`business-logic/service/`, `routes/service/`) have one that tells the service from its options. The services also show what the categories do not: rules that tie two properties together, checked for the row as it will be stored after a partial update (`serviceRuleIssues` in `business-logic/service/_shared/rules.ts`, called by the use case for a create and by the repository inside its transaction for an update); a bulk update that changes all the services or none, whose route `/bulk` is registered before `/:id`; a soft delete; and a delete that is refused with `DomainErrors.conflict` (409). See [docs/authentication.md](docs/authentication.md) and [docs/service-menu.md](docs/service-menu.md)
- **The staff ledger** belongs to a salon and is not public (`business-logic/staff/`, `routes/staff/`). It is built like the service categories, with `authenticated` on every handler: every use case, the list and the get included, decides the permission from the salon of the path first (`mayKeepStaffLedger`: an administrator or the owner of that salon), and the list handler hands the decoded query to the use case as a `Result` (`ListStaffUseCase.execute(actor, salon, query)`). Nobody deactivates or deletes the staff member that their own account belongs to: `isOwnStaffRecord` compares the actor with the target, and the refusal is `DomainErrors.conflict` (409), not `forbidden`. The write mapper (`mappers/write/staff.mapper.ts`) converts one column, the `numeric` `commissionRate`. An email that a staff member of the salon who is not deleted has, and a staff code that any staff member of the salon has or had, are reported by the repository as `alreadyExists` (409), from the name of the violated constraint. A staff member who is deactivated or deleted no longer gives a login account the salon. The ledger does not write `userId`: the link to an account is made when an invitation is accepted or joined, and removed when the account is unlinked (below). See [docs/staff.md](docs/staff.md)
- **The staff profiles** are the part of the staff ledger that everyone may read (`business-logic/staff-profile/`, `routes/staff-profile/`). They have a response model (`StaffProfileResponse`), a repository, use cases and a router of their own; the ledger has no branch for them. The repository selects the 11 columns customers are shown and no other, and decides in one place who is shown: staff members who are active and not deleted, of salons that are not deleted. Anyone else is `notFound`, like an ID that no staff member has. The list and the get take no actor, and their handlers are not wrapped with `authenticated`. The routes are flat (`/staff-profiles`), because the list goes across salons; `salonId`, `specialty` and `city` filter it. The read mapper names every property and returns a plain value, not a `Result`: no column needs converting. A staff member's own profile (`/staff-profiles/me`, the `*-own-staff-profile` files) is the part that needs a signed-in user: the actor says whose profile it is (`ownProfileOf`), everyone whose scope is not `salon` is refused before the body is read, the request has only the five properties a staff member writes (a schema picked from the one of the ledger; the display name, the level, the position and `canReceiveBookings` stay with the salon), and the repository writes them in one statement that has the condition of who is shown. See [docs/staff.md](docs/staff.md)
- **The staff schedules** say when a staff member works (`business-logic/staff-schedule/`, `routes/staff-schedule/`). They are rows that belong to a staff member of a salon and are read and replaced as a whole: `GET` and `PUT` on `/salons/:salonId/staff/:id/schedules`, a router with `Router({ mergeParams: true })` mounted below the staff member. The body of the `PUT` is the array of all entries (`StaffScheduleUpdateRequest`, a named array model so that `@maxItems` reaches OpenAPI), and an entry (`StaffSchedule`) is the same model in the request and in the response. An entry is weekly or for a single date, and a working day or a day off; the Zod schema and the CHECK constraints and unique indexes of `staff_schedules` keep the same rules. The permission has two steps: for the salon of the path first (`mayPlanSchedules`: an administrator, the owner or a manager of that salon; `mayReadSchedules` adds its staff), and, once the ID of the staff member is read, for the schedule (`mayReadScheduleOf`: a staff member reads their own). The repository replaces the rows in one transaction that locks the row of the staff member (`SELECT … FOR UPDATE`), so two replacements never mix; both of its methods resolve to `null` for a staff member who is not of the salon or is deleted (404). Which entry applies to a date is one pure function (`scheduleOn` in `_shared/applicable-schedule.ts`): the entry of that date, or else the weekly entry of its day of the week. See [docs/staff.md](docs/staff.md)
- **The staff invitations** are how a staff member gets a login account (`business-logic/staff-invitation/`, `routes/staff-invitation/`). A staff member holds at most one, so the routes of the salon name no invitation ID: `GET`, `POST` and `DELETE` on `/salons/:salonId/staff/:id/invitation`, for whoever keeps the ledger (`mayInviteStaff`). The create has a second permission that needs the body: only an administrator gives the role of an owner (`mayGiveRole`), checked after the body is validated and before anything is looked up. The mail goes to the address of the ledger, which the request cannot name, and the answer is the same whether or not that address has an account. The invited person has no account yet, so `verify` and `accept` are public operations of `AuthCrud` under `/auth/staff-invitation` that take the mailed token in the body. An account that exists for the invited address joins with a third one, `join`, which asks for a session of that account as well, because a mailed token is not a password; only an account with the role of a salon that reaches no salon may join (`isWithoutSalon`, next to `scopeOf` in `business-logic/auth/_shared/actor.ts`), and `verify` names the route that takes the token next in its `links` (`accept` or `join`). The token is a mailed token like those of the password reset (`business-logic/auth/_shared/mailed-token.ts`: random, only its hash stored, single use, 7 days), and every reason it cannot be used gets one 400 (`invitationRefused`). The repository answers with sum types (`issued` | `staffNotFound` | `linked` | `inactive` | `mailedMomentsAgo`, and so on) that the use case matches exhaustively. Every write locks the row of the staff member first (`SELECT … FOR UPDATE`) and then reads again what it decides from; accepting creates the account with one `INSERT … ON CONFLICT … DO UPDATE … WHERE` against the unique index of the email, so that a registration that never confirmed the address becomes the account and any other account stays (409), and writes `users.staffId` and `staff.userId` in the same transaction. Joining locks two staff members, the one joined and the one the account names, in the order of their IDs, and then the user: every write that links or unlinks locks the staff member before the user. See [docs/staff.md](docs/staff.md)
- **The staff accounts** are the rows of `users` that are linked to the staff, as far as a salon keeps them (`business-logic/staff-account/`, `routes/staff-account/`). A staff member has at most one, so the routes name no user ID: `GET`, `PATCH` and `DELETE` on `/salons/:salonId/staff/:id/account`, for whoever keeps the ledger (`mayKeepStaffAccounts`). There is no create: an account is linked by accepting or joining an invitation. The response (`StaffAccountResponse`) has what the salon is shown and nothing that authenticates, and the repository selects those columns only (`DbStaffAccount`, a `Pick` of `DbUser`). The `PATCH` changes the role, with the second permission of the invitations (`mayGiveRole`); the `DELETE` unlinks: it sets `users.staffId` and `staff.userId` to null and deletes nothing. Nobody does either to their own account (`DomainErrors.conflict`, 409, checked after the body and before anything is looked up). `role` is `SalonRoleType`, an enum narrower than the one of the column: the check constraint `users_staff_needs_salon_role` keeps a linked user to those roles, the rule of `pnpm check:api-db` lists the property in `narrowed`, and the read mapper answers a stored role outside the enum with a `database` error. The repository tells a staff member the salon does not have from one without an account (`staffNotFound` | `none`, two different 404s), and its writes lock the row of the staff member first, like those of the invitations. No session is revoked: the scope of an actor is derived on every request, so a change applies from the next one. See [docs/staff.md](docs/staff.md)
- **The customer ledger** belongs to no salon and is not public (`business-logic/customer/`, `routes/customer/`). The router is a plain `Router()` mounted at `/customers`, and every handler is wrapped with `authenticated`. The use case decides the permission from the actor alone and first, before it reads the ID, the query or the body. The list handler decodes the query and hands the outcome to the use case as a `Result` (`ListCustomersUseCase.execute(actor, query)`), so a query that cannot be decoded is reported only after the permission. The use cases take the current time from `clock` in `CustomerUseCaseDependencies`. The write mapper (`mappers/write/customer.mapper.ts`) converts nothing: property names and representations are those of the columns, and the mapper is where the compiler checks that the request and the row agree. An email that a customer who is not deleted has, and a referral code that any customer has or had, are reported by the repository as `alreadyExists` (409), from the name of the violated constraint. See [docs/customers.md](docs/customers.md)
- **The preferences of a customer** are a record every customer has, whether a row of `customer_preferences` is stored or not (`business-logic/customer-preferences/`, `routes/customer-preferences/`): `GET` and `PATCH` on `/customers/:id/preferences` for whoever keeps the ledger (`mayHandleCustomers`), and on `/customers/me/preferences` for the customer (`profileAccessOf`). There is no create and no delete: a customer without a row has the empty preferences (`noCustomerPreferences`), a read answers 200 with them, and the first change creates the row. The two routers are mounted at their full paths before the customers, `me` first, and the two pairs of use cases share one flow (`_shared/preferences-of.ts`); they differ in who may and in what a customer that is not there is called. There is no write mapper: the properties of the request are the columns. A staff member that a change names has to exist when it is written (400, `not_found`), and the preferred one is not among the avoided ones in the preferences as they are stored afterwards (`customerPreferencesRuleIssues`; 400, `avoided`). So the repository locks the row of the customer, looks the staff members up, reads the stored row, checks the rule and writes, in one transaction, and answers with a sum type (`CustomerPreferencesUpdate`). The read mapper checks the two `jsonb` columns against the API model. See [docs/customers.md](docs/customers.md#好み設定)
- **The booking ledger** is a salon's, but its routes are not below the salon (`business-logic/booking/`, `routes/booking/`): `GET` and `POST` on `/bookings`, `GET`, `PATCH` and `DELETE` on `/bookings/:id` and `POST` on `/bookings/:id/confirm`, `/cancel`, `/start`, `/complete`, `/no-show` and `/reschedule`, a plain `Router()` with `authenticated` on every handler. Which salon a request is about comes from the body (create), the query (list) or the stored row (every route with an ID), so the permission is decided in two steps: `bookingReachOf` says from the actor alone, before anything is read, which bookings the actor reaches (those of every salon for an administrator, of their salon for a member of a salon, none for a customer account: 403), and once the request names a salon, `isWithin` says whether it is within that reach (403). A delete asks `bookingRemovalReachOf` instead, by which the staff of a salon reach nothing (403). The repository takes the reach as a condition of its queries, so the booking of another salon is not found (404), not listed and no cursor (400). A create request says whom the booking is for and which services begin when; every other column follows from the rows it refers to and is worked out by a pure function, `planBooking` (`_shared/plan.ts`): the time and the amounts of a line from its service, those of the booking from its lines, the tax once for the booking, the day of the visit in the time zone of the salon. There is no write mapper. The repository calls it inside one transaction that locks the salon, the customer and the services `FOR SHARE` and the staff members the request names `FOR UPDATE` in the order of their IDs, checks that no staff member is occupied by more bookings at a time than `maxConcurrentBookings` (`isOccupiedBeyondCapacity` in `_shared/occupancy.ts`; 409), and writes the booking, its lines and the first row of its status history. The transaction states `READ COMMITTED`: a request that waited for a staff member has to see the booking it waited for. The repository answers with a sum type (`BookingCreation`); the use case has the booking number issued (`IBookingNumberIssuer`) and tries another when one is taken. The status is changed by actions, never by an update: the five use cases share `changeBookingStatus` (`_shared/change-status.ts`), and the repository's `changeStatus` locks the booking `FOR UPDATE`, reads its status and the clock of the database, lets the pure `planStatusChange` (`_shared/status.ts`) decide from the transitions what to write or why not (409), and writes the booking, its lines when it is completed and a row of the status history in one `READ COMMITTED` transaction; a change to `completed`, `cancelled` or `no_show` locks the customer and counts their visits, cancellations and no-shows again from their bookings. The other writers of a booking lock it `FOR UPDATE` first as well, and write the time of the change with `clock_timestamp()` in a later statement, because `now()` is the moment the transaction began, before what it waited for: `update` writes the four properties a salon notes of a booking, whatever its status; `reschedule` asks the pure `moveBooking` and `planReschedule` (`_shared/reschedule.ts`) what to write (the booking and every line moved by as much, the lines of the staff member who was in charge handed to the new one), locks the salon `FOR SHARE` and the staff members of the moved lines `FOR UPDATE` in the order of their IDs, and checks the occupancy without the lines the booking had before (409); `delete` removes the row, with which its lines, its status history and its reviews go, answers with a sum type (`BookingDeletion`) that refuses a booking a sale or a treatment record refers to (409), and counts the customer again when the status of the booking was counted (`isCounted`). The service lines of a booking that exists are a resource below it (`routes/booking-service/`, a `Router({ mergeParams: true })` mounted at `/bookings/:bookingId/services`): `POST /` adds a line, `GET /:id` reads one and `DELETE /:id` removes one, for whoever reaches the booking (a removal is not the delete of a booking, so the staff of the salon may). The repository's `addService` and `removeService` lock the booking `FOR UPDATE` and read its lines, lock the salon `FOR SHARE`, and let the pure `planServiceAddition` and `planServiceRemoval` (`_shared/service-lines.ts`) decide what to write or why not: only a booking in one of the `UNFINISHED_STATUSES` is changed, and it keeps between one and `MAX_BOOKING_SERVICES` lines, which begin within `HOURS_OF_A_VISIT` of the earliest one (409). What a booking says of its lines taken together (the day, the times, the amounts, the tax) is summed up again by `summarize` (`_shared/summary.ts`), by which `planBooking` sums up a booking that is entered, and written in the same transaction as the line. A line keeps whether its price includes the tax (`taxIncluded`, a copy of its service like the price), so the sum reads the lines and the salon and never a service. A line that is added is planned like a line of a create (`toServiceRow`), with its service locked `FOR SHARE` and its staff member `FOR UPDATE`, and the occupancy is checked without the lines of the booking itself (409). What a booking that is not finished refers to is not deleted: the deletes of a customer, a staff member, a service and a salon lock their row `FOR UPDATE`, look in the next statement for a booking in one of the `UNFINISHED_STATUSES` (draft, pending, confirmed, in progress) that refers to it (`repositories/unfinished-bookings.ts` in the infrastructure package) and answer `bookingsUnfinished` (409) when there is one; they read the bookings and never lock them, because a writer of a booking locks the booking before what it refers to. What a salon enters or moves is held to what keeps the ledger sound, not to the opening hours, the schedules or what is active: those are for what customers can book. The available slots of a salon (`routes/available-slot/`, a `Router({ mergeParams: true })` mounted at `/salons/:salonId/available-slots`; `business-logic/available-slot/`) apply them: `GET /` lists the times at which a staff member can begin a service on a date, for every signed-in user, and `POST /check` says whether a staff member is occupied at a time, for whoever reaches the ledger of the salon (`mayAskLedgerOf`), with the occupancy functions of the ledger and nothing else. No table holds a slot. The repository reads what a day depends on in one read-only transaction (`repeatable read`) and decides nothing; the pure `slotsOf` (`_shared/slots.ts`) works the slots out from it and from `now`, which is the `clock` of the dependencies: where the salon is open (`openRangesOf`: the row of the calendar for the date alone, or else the weekly hours) and the staff member works (`workingRangesOf` over `scheduleOn`), every `SLOT_STEP_MINUTES` from the beginning of each stretch, as far as the staff member is not occupied beyond what they take at once. A time of day of the salon becomes a moment in `_shared/salon-time.ts` and nowhere else. A customer's own bookings (`routes/customer-booking/`, a plain `Router()` mounted at `/customers/me/bookings` before the routers of the customers; `business-logic/customer-booking/`) are rows of the same ledger, for a customer account with a profile (`ownBookingsOf`, which asks `profileAccessOf`: 403 for every other role, 404 without a profile): `GET /` and `GET /:id` read them, `POST /` books a slot, `POST /:id/cancel` cancels and `POST /:id/reschedule` moves a booking to another slot. The reach that the repository takes is a `BookingReach`, a `LedgerReach` (every salon, or one) or a `CustomerReach` (the bookings of one customer), and the methods that only the ledger has take a `LedgerReach`. A customer books what the list of slots offers and nothing else: `book` of the repository locks the salon `FOR SHARE` and the customer, the service and the staff member `FOR UPDATE`, in the order of the ledger's create, reads everything a slot depends on after the locks (`repositories/slot-reads.ts`, shared with the repository of the slots), and lets the pure `planCustomerBooking` (`_shared/plan.ts`) decide: the same `slotsOf` as the list, with `now` from the `clock`, then whether the salons take bookings from the customer (`booksOnline`) and whether the customer has another booking at that time, and the rows are those `planBooking` makes for the ledger, one line, `source` `online`. The cancel is an action of the status rules (`cancelAsCustomer`), refused from the moment the booking begins by the clock of the database. The responses are `CustomerBookingResponse`: `CustomerBookingReadMapper` names every property a customer is shown, which leaves out what the salon notes and records. A customer moves a booking with `rebook` of the repository, which holds the booking `FOR UPDATE` first and then locks and reads as `book` does, leaving the booking itself out of what occupies the staff member, of the bookings its service has that day and of the other bookings of the customer. The pure rules are in `_shared/move.ts`: `moveCustomerBooking` (the `moveBooking` of the ledger, then: the booking has not begun by the `clock`, and has one line with the staff member in charge; the time and the staff member it has already change nothing) and `planCustomerMove` (the `planReschedule` of the ledger, then `refusalOfSlot`, the checks that `planCustomerBooking` makes, for the time the booking takes). A confirmed booking is pending again, with a row of the status history. See [docs/bookings.md](docs/bookings.md)
- **The sales ledger** is a salon's and has the shape of the booking ledger (`business-logic/sale/`, `routes/sale/`): `GET` and `POST` on `/sales`, `GET` and `PATCH` on `/sales/:id` and `POST` on `/sales/:id/void`, a plain `Router()` with `authenticated` on every handler. `saleReachOf` decides from the actor alone which sales the actor reaches (the `LedgerReach` of the bookings: every salon for an administrator, one salon for its owner, managers and staff, none for a customer account), `isWithin` refuses a salon outside the reach once the body or the query names one (403), and the repository takes the reach as a condition of the get, of the list, of the update and of the void, so the sale of another salon is not found (404). A sale is the bill of one visit as the till charged it: the request states the amounts of every line, and the schema (`schemas/sale.schema.ts`) checks that a line agrees with itself (the discount within quantity times unit price, the total their difference plus the tax, worked out as bigints), that only a line whose `itemType` is `service` or `product` has an `itemId`, and that no two lines share a `sortOrder`. An issue that `.check()` pushes for a line carries `continue: true`; without it Zod stops, and the checks of the list and of the request, which come after, would not run. `planSale` (`_shared/plan.ts`) is a pure function from the request and what it refers to: it reports every reference that is not there or not of the salon at once (400; the booking has to be one of the salon and of the customer of the sale), sums the sale up from its lines (400 beyond an `integer`), takes `saleDate` from the time zone of the salon (409 when it is not known) and refuses a booking that has a sale that is not void (409). It compares no price, tax rate or commission with anything, and the create writes nothing but the sale and its lines. `create` of the repository is one `READ COMMITTED` transaction: it holds the booking `FOR UPDATE` and looks for a sale of it in a statement of its own, then locks the salon, the customer and the staff members `FOR KEY SHARE` (the staff members in the order of their IDs), which is the lock the foreign keys of the insert take anyway, taken up front in the order in which the booking ledger locks its rows; the services and the products of the lines, to which a line has no foreign key, are read without a lock. It answers with a sum type (`SaleCreation`). The sale number (`SL-XXXX-XXXX`) comes from `ISaleNumberIssuer`; the format and the three attempts at a free number are shared with the bookings (`business-logic/_shared/record-number.ts`, `numbered.ts`). The get and the list read a sale, its lines and its payments in a read-only `REPEATABLE READ` transaction, so they are of one moment; the list is ordered by `saleTime` downwards and includes void sales. The update and the void begin by holding the row of the sale `FOR UPDATE` within the reach of the actor, in a statement of its own; that is the lock the foreign key of a payment does not get past, so a void waits for a payment that is being written and then counts it. The order of the locks is sale, booking, salon, customer, service, staff, payment method, and nothing that holds one of the later rows goes on to hold a sale. `planSaleChange` (`_shared/change.ts`), a pure function, holds the sale as it is after the update to the rules of a create: a sale without a customer has no points, the booking is of the customer of the sale, and a booking is billed once, the sale itself not counted. Only what a request names is looked up and locked, the lines are replaced as a whole and only while the payment status is `pending`, `saleDate` is taken again only when the request names `saleTime`, and a void sale is not changed (409). The void is the administrators', the owner's and the managers' (`saleVoidReachOf`; 403 for the staff before the ID or the body is looked at); `refusalOfVoid` refuses a sale that is void already or that has a payment whose status is `completed` or `partial_refund` (409), and a void frees the booking for another sale while the void sale still refers to it. Both write `updatedAt` (the void `voidedAt` as well) with `CLOCK`. The receipt (`GET` on `/sales/:id/receipt`) is made from the sale the get returns, under its sale number and at the time of the `clock` the router is given, and is stored nowhere; `refusalOfReceipt` (`_shared/receipt.ts`) refuses a void sale and a sale whose received payments do not come to its total (409). The calculation (`POST` on `/sales/calculate`) writes nothing: the repository reads the salon, the lines of the booking, the services and the payment methods in one read-only `REPEATABLE READ` transaction (`findCalculationReferences`), and `planCalculation` (`_shared/calculation.ts`), a pure function, reports what is not of the salon (400) and sums the lines up with `amountsOf` (`business-logic/_shared/amounts.ts`), which `summarize` of the bookings uses too, so the tax of the salon is added once to the sum. See [docs/sales.md](docs/sales.md)
- **The payment methods of a salon** are served below the salon and are not public (`business-logic/payment-method/`, `routes/payment-method/`): `GET` and `POST` on `/salons/:salonId/payment-methods` and `GET`, `PATCH` and `DELETE` on `/salons/:salonId/payment-methods/:id`, built like the staff ledger, with `authenticated` on every handler. Two permissions are decided from the salon of the path alone, before the ID, the query or the body is looked at: `mayReadPaymentMethods` (an administrator, or the owner, a manager or a staff member of that salon) for the list and the get, and `mayKeepPaymentMethods` (an administrator, the owner or a manager) for the create, the update and the delete; a customer account reaches none of them. `method` is fixed once a payment method is created: `PaymentMethodUpdateRequest` has no such property, and the strict schema refuses it. `processorConfig` is in no model of the API: the read mapper names every property, and no request can state it. The lower limit of the amount of one payment is not above the upper one. A request that names both limits is checked by the schema (`limitsInOrder`); an update that names one of them is checked by the repository, which holds the row `FOR UPDATE` in a `READ COMMITTED` transaction, applies the pure functions `limitsAfter` and `limitsAreInOrder` (`_shared/limits.ts`) to the limits as they would be afterwards and answers `limitsOutOfOrder`, which the use case reports as a broken rule of the limit the request names (400). The delete holds the row `FOR UPDATE` as well, which is the lock the foreign key of a payment waits for, looks for a row of `payment_transactions` in the next statement and answers `inUse` (409: the payment method is deactivated instead) or deletes the row; a deleted payment method is gone, not marked. An update writes `updatedAt` with `CLOCK`. The list is ordered by `sortOrder` and then by ID, with keyset pagination on the two. See [docs/payments.md](docs/payments.md)
- **The payments of a sale** are written below the sale and are not public (`business-logic/payment/`, `routes/sale/process-sale.handler.ts`, `routes/payment/`): `POST` on `/sales/:id/process` records a payment that was taken, because no payment processor is connected, and `POST` on `/payments/:id/refund` refunds a completed payment once, in full or in part. The sale router takes the dependencies of the payments as well, and the payment router, mounted at `/payments`, takes the same ones. `saleReachOf` decides who records a payment and `saleVoidReachOf` who refunds one (not the staff), before the ID or the body is looked at. The rules are pure functions in `_shared/plan.ts`: `paymentStatusOf` counts the payment status of a sale from its payments, `refusalOfPayment` refuses a void sale, a sale with a refund and a sale with nothing left to pay (409), `planPayment` holds a request to its payment method (in use, of the salon of the sale, within its limits, card details only with a card) and to what is left to pay (400), and `planRefund` refuses a payment that is not `completed` (409) and an amount above that of the payment (400). `PaymentRepository` holds the sale `FOR UPDATE` first (`heldSaleOf` in `repositories/held-sale.ts`, shared with the update and the void of a sale), reads its payments in the statement after it, reads the payment method `FOR SHARE`, and writes the payment and the `paymentStatus` of the sale in one `READ COMMITTED` transaction, the times with `CLOCK`; a refund learns the sale from the payment without a lock and reads the payment again once the sale is held. The payment number (`PT-XXXX-XXXX`) comes from `IPaymentNumberIssuer` and is tried again like a sale number. Nothing else writes the payment status of a sale, and nothing decides by it instead of by the payments. See [docs/payments.md](docs/payments.md)
- **Tests**: unit tests for schemas, mappers and use cases in the domain package; integration tests per endpoint against PostgreSQL in the api package

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