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
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'database'; message: string; cause: unknown }

// Exhaustive handling in API routes
match(result)
  .with({ type: 'success' }, ({ data }) => {
    res.status(201).json({ data, meta: responseMeta(), links })
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
- Integration tests with testcontainers
- E2E tests for critical paths
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
backend/packages/
├── domain/           # Pure business logic
├── infrastructure/   # External services
├── api/             # HTTP layer
├── database/        # DB schemas
├── generated/       # Auto-generated types
└── config/          # Configuration
```

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
1. Write a SQL migration in `backend/packages/database/sql/migrations/`
2. `pnpm db:migrate` → `pnpm db:introspect` → `pnpm db:generate-sql`
3. Commit `schema.ts`, `relations.ts` and `sql/setup.sql` (`pnpm check:db-schema` guards this in CI)
4. Keep the API models in line with the tables (`pnpm check:api-db` guards this in CI)

### Code Quality Checks
```bash
pnpm lint          # Biome lint
pnpm format:check  # Formatting (Biome and TypeSpec), read-only
pnpm format:fix    # Apply formatting, import sorting and safe fixes
pnpm typecheck     # Type checking (build first)
pnpm knip          # Unused files, exports and dependencies
pnpm check:api-db  # API models agree with the database schema
pnpm test          # Unit tests
make ci-check      # Everything CI runs, in the same order
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
pnpm db:migrate       # Apply the SQL migrations
pnpm db:seed          # Seed data with statistics
pnpm db:truncate      # Clear all table data
pnpm db:introspect    # Regenerate schema.ts and relations.ts from the DB
pnpm db:generate-sql  # Regenerate sql/setup.sql from schema.ts

# Testing
pnpm test             # Unit tests (*.test.ts)
pnpm test:integration # API tests against PostgreSQL (*.integration.test.ts)
                      # uses TEST_DATABASE_URL when set, otherwise testcontainers

# Build
pnpm build            # Production build (same as build:prod)
pnpm build:dev        # Development build
pnpm build:test       # Test build
pnpm build:stg        # Staging build
pnpm build:prod       # Production build

# CI/CD Local Testing
make ci-check             # Run every CI check locally
make ci-check-dockerfile  # Test all Docker builds locally before pushing

# Deployment (GitHub Actions)
# Push to main     → Automatic staging deployment
# Manual trigger   → Production deployment via Actions tab
```

## 📚 Documentation References

### Core Concepts
- [Architecture Overview](docs/architecture-overview.md)
- [Type Safety Principles](docs/type-safety-principles.md)
- [Sum Types & Pattern Matching](docs/sum-types-pattern-matching.md)

### Implementation Guides
- [Backend Architecture](docs/backend-architecture-guidelines.md)
- [Uniform Implementation](docs/uniform-implementation-guide.md)
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
export const salonIdSchema = z.uuid().brand<'SalonId'>()
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

export const salonUpdateRequestSchema = salonCreateRequestSchema.exactPartial()

// 4. Repository Interface
// backend/packages/domain/src/repositories/salon.repository.ts
export interface ISalonRepository {
  create(salon: DbNewSalon, openingHours: DbNewOpeningHours[]): Promise<Result<SalonWithOpeningHours, DomainError>>
  findById(id: SalonId): Promise<Result<SalonWithOpeningHours | null, DomainError>>
  list(criteria: SalonListCriteria): Promise<Result<SalonList, DomainError>>
  update(id: SalonId, changes: DbSalonChanges, openingHours: OpeningHoursChange): Promise<Result<SalonWithOpeningHours | null, DomainError>>
  delete(id: SalonId): Promise<Result<boolean, DomainError>>
}

// 5. Dependencies Interface (Object-based DI)
// backend/packages/domain/src/business-logic/salon/_shared/dependencies.ts
export interface SalonUseCaseDependencies {
  salonRepository: ISalonRepository
}

// 6. Use Case: untrusted input in, API model or DomainError out
// backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts
export class CreateSalonUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  async execute(input: unknown): Promise<Result<ApiSalonResponse, DomainError>> {
    // Validate → Map API→DB → Save → Map DB→API → Return
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

// 7. Mappers: property names are the column names; only representations change
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

// 8. Repository Implementation: no throw, no cast; writes are transactions
// backend/packages/infrastructure/src/repositories/salon.repository.impl.ts
export class SalonRepository implements ISalonRepository {
  constructor(private readonly db: Database) {}
}

// 9. API Route with Dependency Injection (Modular Handler Pattern)
// backend/packages/api/src/routes/salon/create-salon.handler.ts
// Each endpoint has its own handler file following [action]-[domain].handler.ts.
// A handler is created from its dependencies; it never reaches for a global.
export const createSalonHandler = (
  dependencies: SalonUseCaseDependencies,
): RequestHandler<
  Record<string, never>,                 // Path params
  CreateSalonResponse | ProblemDetails,  // Response body types
  unknown                                // Request body: validated by the use case
> => {
  const useCase = new CreateSalonUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const links = salonLinks(req.baseUrl, data.id)
        res.status(201).location(links.self).json({ data, meta: responseMeta(), links })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}

// backend/packages/api/src/routes/salon/index.ts
export const createSalonRouter = (dependencies: SalonUseCaseDependencies): Router

// backend/packages/api/src/index.ts: repositories are created once, here
app.use(`${API_BASE_PATH}/salons`, createSalonRouter({ salonRepository: new SalonRepository(database) }))
```

### Conventions the reference follows
- **Validation** happens once, in the use case, with the Zod schema of the request. Cross-field rules use `.check()`
- **Errors** are `DomainError` values; `api/src/shared/problem-details.ts` maps each kind to an HTTP status and never exposes the cause of a `database` error
- **Partial update** is `PATCH`: a property that is absent is left alone, `null` clears a nullable column
- **Lists** use keyset pagination: `cursor` is the ID of the last item of the previous page (`meta.nextCursor`)
- **Deleted rows** (`deletedAt`) are invisible to every repository method
- **Tests**: unit tests for schemas, mappers and use cases in the domain package; integration tests per endpoint against PostgreSQL in the api package

## ⚠️ Important Notes

### TypeSpec Enum Naming
All Enum types must end with `Type` suffix (e.g., `ServiceCategoryType`, `PaymentMethodType`)

### DB-Driven Models
Database schemas are the source of truth for domain models:
```typescript
// Types are inferred from Drizzle ORM schemas with DeepRequired wrapper
// backend/packages/domain/src/models/customer.ts
export type DbCustomer = DeepRequired<typeof customers.$inferSelect>
export type DbNewCustomer = DeepRequired<Omit<typeof customers.$inferInsert, 'id'>>
```

### API-DB Consistency Rules

#### Property Naming
- API property names MUST match DB column names exactly
- No UI-driven renaming (e.g., `websiteUrl` not `website` if DB has `website_url`)
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

`pnpm check:api-db` checks the first two for every model listed in
`backend/packages/database/src/scripts/api-consistency-rules.ts`. A domain is
done when its models are listed there with `omittedColumns` and have no entry in
`api-consistency-baseline.json`.

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