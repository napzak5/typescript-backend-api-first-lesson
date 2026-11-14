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

// Domain error types
export type DomainError =
  | { type: 'validation'; message: string; code: string; details: string[] }
  | { type: 'notFound'; entity: string; field: string; value: unknown }
  | { type: 'alreadyExists'; entity: string; field: string; value: unknown }
  | { type: 'database'; message: string; cause: unknown }

// Exhaustive handling in API routes
match(result)
  .with({ type: 'success' }, ({ data }) => {
    res.status(201).json({ data, meta: {...}, links: {...} })
  })
  .with({ type: 'error' }, ({ error }) => {
    const problemDetails = toProblemDetails(error)
    res.status(problemDetails.status).json(problemDetails)
  })
  .exhaustive()
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
- Request validation (Zod v4 with `z.custom<T>().check()`)
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

### Code Quality Checks
```bash
pnpm lint          # Biome lint
pnpm format:check  # Formatting (Biome and TypeSpec), read-only
pnpm format:fix    # Apply formatting, import sorting and safe fixes
pnpm typecheck     # Type checking (build first)
pnpm knip          # Unused files, exports and dependencies
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

The salon domain serves as the reference implementation for all other domains:

### Layer Structure:
```typescript
// 1. Database Schema (Source of Truth)
// backend/packages/database/src/schema.ts
export const salons = pgTable('salons', {...})

// backend/packages/domain/src/models/salon.ts
// Type inference with DeepRequired - NO manual type definitions
export type DbSalon = DeepRequired<typeof salons.$inferSelect>
export type DbNewSalon = DeepRequired<Omit<typeof salons.$inferInsert, 'id'>>

// 2. Repository Interface
// backend/packages/domain/src/repositories/salon.repository.ts
export interface ISalonRepository {
  create(salon: DbSalon, openingHours?: DbNewOpeningHours[]): Promise<Result<DbSalon, DomainError>>
  findById(id: SalonId): Promise<Result<DbSalon | null, DomainError>>
}

// 3. Dependencies Interface (Object-based DI)
// backend/packages/domain/src/business-logic/salon/_shared/dependencies.ts
export interface SalonUseCaseDependencies {
  salonRepository: ISalonRepository
  // Future dependencies can be added here:
  // userRepository?: IUserRepository
  // notificationService?: INotificationService
}

// 4. Use Case with Dependencies
// backend/packages/domain/src/business-logic/salon/create-salon.usecase.ts
export class CreateSalonUseCase extends BaseSalonUseCase {
  constructor(dependencies: SalonUseCaseDependencies) {
    super(dependencies)
  }

  async execute(request: ApiCreateSalonRequest): Promise<Result<ApiSalon, DomainError>> {
    // Validate → Check business rules → Map API→DB → Save → Map DB→API → Return
  }
}

// 5. Mappers
// backend/packages/domain/src/mappers/write/salon.mapper.ts
export const SalonWriteMapper = {
  fromCreateRequest(request: ApiCreateSalonRequest): { salon: DbNewSalon; openingHours: DbNewOpeningHours[] }
}
// backend/packages/domain/src/mappers/read/salon.mapper.ts
export const SalonReadMapper = {
  toApiSalon(dbSalon: DbSalon, openingHours: DbOpeningHours[]): ApiSalon
}

// 6. API Route with Dependency Injection (Modular Handler Pattern)
// backend/packages/api/src/routes/salon/create-salon.handler.ts
// Note: Each endpoint has its own handler file following [action]-[domain].handler.ts pattern
// See docs/api-route-modular-structure.md for full modular structure details
export const createSalonHandler: RequestHandler<
  Record<string, never>,                    // Path params
  CreateSalonResponse | ErrorResponse,      // Response body types
  CreateSalonRequest                        // Request body type
> = async (req, res, next) => {
  try {
    // Instantiate dependencies
    const db = req.app.locals.database as Database
    const salonRepository = new SalonRepository(db)

    // Create use case with dependencies object
    const useCase = new CreateSalonUseCase({ salonRepository })

    const result = await useCase.execute(req.body)
    match(result)
      .with({ type: 'success' }, ({ data }) => {
        const response: CreateSalonResponse = {
          data,
          meta: {
            correlationId: `req-${Date.now()}`,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
          links: {
            self: `/salons/${data.id}`,
            list: '/salons',
          },
        }
        res.status(201).json(response)
      })
      .with({ type: 'error' }, ({ error }) =>
        handleDomainError(res as Response<ErrorResponse>, error)
      )
      .exhaustive()
  } catch (error) {
    next(error)
  }
}
```

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