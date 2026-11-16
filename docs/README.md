# Documentation Index

The conventions every change must follow are in [CLAUDE.md](../CLAUDE.md);
set-up, commands and operation of the API server are in the
[README](../README.md). The documents here explain one topic each in more
depth. When a document disagrees with the code or with `CLAUDE.md`, the
document is wrong: fix it in the same change.

## 📚 Architecture & Design
- [**Architecture Overview**](./architecture-overview.md) - The system as a whole: layers, packages, request flow, what is implemented
- [Backend Architecture Guidelines](./backend-architecture-guidelines.md) - How to write backend code in each layer (日本語)
- [Domain Implementation Reference](./domain-implementation-reference.md) - The Salon domain layer by layer, as the model for a new domain
- [API Route Modular Structure](./api-route-modular-structure.md) - One handler file per endpoint in the API package
- [Authentication and Authorization](./authentication.md) - Sessions, passwords, registration, email verification and password reset, the accounts of staff members by invitation, two-factor authentication, who may do what, how to protect an operation, the seeded accounts (日本語)
- [Service Menu](./service-menu.md) - The service categories of a salon: who may change them, the list, the rules for each property, parent and child categories, what a delete does. The services of a salon: the rules for each property, options, packages, bulk update, what a delete does (日本語)
- [Customer Ledger](./customers.md) - The customers, in one ledger for the platform: what is implemented, who may do what, the order of the checks, the list and its search, the rules for each property, a customer's own profile and how it takes over a record of the ledger, the preferences of a customer (what a customer without any has, the rules for each property, the staff members they name), what a delete does, requests that arrive at the same moment (日本語)
- [Staff Ledger](./staff.md) - The staff of a salon as the employer keeps them: what is implemented, who may do what (administrators and the owner of the salon only), the order of the checks, the staff member an account belongs to and what deactivating or deleting one does to the account, the list, the rules for each property, what is unique within a salon, the profile that customers are shown (which properties, which staff members, the filters of its list), a staff member's own profile (which properties the staff member writes and which the salon decides), the working schedules (weekly entries and entries for a single date, the rules of an entry, which entry applies to a date, who may read and plan them), the login accounts of the staff by invitation (who may invite to which role, how long an invitation works, what accepting it creates, how an account that exists joins one), the accounts that are linked to the staff (what the salon is shown, changing the role, unlinking), requests that arrive at the same moment (日本語)
- [Booking Ledger](./bookings.md) - The bookings of a salon and their service lines: what is implemented, what a salon may enter and what is not checked, who may do what, the order of the checks, the rules of a create request, what the system derives (times, amounts, the tax, the booking number, the day of the visit in the time zone of the salon), when a staff member is occupied, the five actions on the status of a booking and what each writes, how the visits, cancellations and no-shows of a customer are counted, the update of what a salon noted, the reschedule to another time or staff member in charge, the service lines that are added to a booking and removed from it, the delete and what refuses it, the list and its filters, the available slots of a salon (how a slot is worked out from the hours of the salon, the schedules of the staff and the bookings, what the list applies of the settings of the salon and what the check asks), the bookings a customer makes, reads and cancels by themself (only a slot the list offers, which customers book, what a customer is shown of a booking), requests that arrive at the same moment, the constraints of the tables, the seed (日本語)
- [Sales Ledger](./sales.md) - The sales of a salon and their lines: what is implemented, what the server checks and what it leaves to the till (prices, tax, commissions), who may do what, the order of the checks, the rules of a create request, what the system derives (the sums, the sale number, the day of the sale in the time zone of the salon), one sale that is not void for a booking, the update and the void of a sale, the list and its filters, requests that arrive at the same moment and the locks of a create, an update and a void, the constraints of the database (日本語)
- [Payments](./payments.md) - The payment methods of a salon: what is implemented, who reads them and who sets them up, the order of the checks, the rules of a request, why the method is fixed, the limits of the amount, deleting and deactivating, the list and its filters, requests that arrive at the same moment, the constraints of the database (日本語)
- [Email](./email.md) - Which mails the server sends and how: the mailer, SMTP settings, Mailpit for local development (日本語)
- [Multi-Agent Collaboration Framework](./multi-agent-collaboration-framework.md) - Which AI agent owns what, and the hand-over points

## 🎯 Core Concepts
- [Type Safety Principles](./type-safety-principles.md) - The type-safety rules and what replaces `any`, `as` and type guards
- [Sum Types & Pattern Matching](./sum-types-pattern-matching.md) - Discriminated unions, `Result` and ts-pattern
- [DB-Driven Domain Model](./db-driven-domain-model.md) - The database as the source of truth, and the migration workflow
- [Uniform Implementation Guide](./uniform-implementation-guide.md) - The standard patterns: pagination, responses, errors, validation, authorization, logging

## 🔧 Development
- [Development Workflow](./development-workflow.md) - Set-up, the daily loop and the checks before a commit
- [TypeScript Configuration](./typescript-configuration.md) - Compiler settings and how packages are built
- [Environment Configuration](./env-configuration.md) - Environment files and variables
- [Release Workflow](./release-workflow.md) - CI, image builds and what a release needs
- [Cleanup Policy](./cleanup-policy.md) - YAGNI in practice and the tools that enforce it

## 🏗️ Type Generation & API
- [Type Generation System](./type-generation-system.md) - TypeSpec → OpenAPI → TypeScript pipeline
- [**TypeSpec API Type Rules**](./typespec-api-type-rules.md) - Model naming, required / optional / nullable rules
- [TypeSpec Directory Structure](./typespec-directory-structure.md) - How `specs/` is organized
- [OpenAPI TypeScript Usage](./openapi-typescript-usage.md) - Using the generated types in the backend
- [Frontend API Integration](./frontend-api-integration.md) - The generated client and the frontend packages

## 🗄️ Database
- [API-DB Type Constraints Mapping](./api-db-type-constraints-mapping.md) - How column types and constraints map to the API, and the `check:api-db` check
- [Database Commands](../backend/packages/database/docs/database-commands.md) - The database commands: migrate, seed, recreate, introspect (日本語)

## ✅ Testing
- [Testing Requirements](./testing-requirements.md) - What must be tested, and to what standard
- [API Testing Guide](./api-testing-guide.md) - Writing an API integration test

## 📝 Planned Features (design only, not implemented)
These describe features that have no code yet. Their samples predate the
current conventions and must be revised when the feature is built.
- [Storage Providers](./storage-providers.md) (日本語)
- [File Upload](./file-upload.md) (日本語)

## Quick Links

### For New Developers
1. [README](../README.md) - Quick start
2. [CLAUDE.md](../CLAUDE.md) - The rules
3. [Architecture Overview](./architecture-overview.md)
4. [Development Workflow](./development-workflow.md)

### For Backend Development
1. [Domain Implementation Reference](./domain-implementation-reference.md)
2. [Sum Types & Pattern Matching](./sum-types-pattern-matching.md)
3. [Uniform Implementation Guide](./uniform-implementation-guide.md)
4. [Authentication and Authorization](./authentication.md)
5. [API Testing Guide](./api-testing-guide.md)

### For API Development
1. [TypeSpec API Type Rules](./typespec-api-type-rules.md)
2. [Type Generation System](./type-generation-system.md)
3. [API-DB Type Constraints Mapping](./api-db-type-constraints-mapping.md)
4. [OpenAPI TypeScript Usage](./openapi-typescript-usage.md)

### For Frontend Integration
1. [Frontend API Integration](./frontend-api-integration.md)
2. [Type Generation System](./type-generation-system.md)

## Contributing

When adding documentation:
1. Add it to this index
2. Point at the real files and quote short excerpts rather than writing sample code that can drift
3. Show only commands that exist in `package.json` or the `Makefile`
4. Keep it to one topic; link to other documents instead of repeating them
