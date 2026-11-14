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
- [Authentication and Authorization](./authentication.md) - Sessions, passwords, registration, email verification and password reset, two-factor authentication, who may do what, how to protect an operation, the seeded accounts (日本語)
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
