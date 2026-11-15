# Type Generation System

TypeSpec is the single source of truth for the API contract. The OpenAPI
document, the backend types and the frontend API client are generated from it,
and all three are committed to the repository.

## Pipeline

```
specs/main.tsp, specs/models/*.tsp, specs/operations/*.tsp
    │
    │  pnpm generate:spec       tsp compile
    ▼
specs/tsp-output/@typespec/openapi3/generated/openapi.yaml
    │
    ├── pnpm generate:api       orval
    │       ▼
    │   frontend/packages/api-client/src/generated/
    │
    └── pnpm generate:backend   openapi-typescript
            ▼
        backend/packages/generated/src/
```

## Commands

| Command | What it runs | Result |
|---------|--------------|--------|
| `pnpm generate` | `generate:spec`, `generate:api`, `generate:backend`, in this order | Everything below |
| `pnpm generate:spec` | The `compile` script of `@beauty-salon/specs` | `specs/tsp-output/@typespec/openapi3/generated/openapi.yaml` |
| `pnpm generate:api` | The `generate` script of `@beauty-salon-frontend/api-client` (orval) | `frontend/packages/api-client/src/generated/` |
| `pnpm generate:backend` | The `generate` script of `@beauty-salon-backend/generated` | `backend/packages/generated/src/` |
| `pnpm generate:watch` | `scripts/generate-watch.ts` | Runs `pnpm generate` once, then again after every change to a `.tsp` file under `specs/` |
| `pnpm check:generated` | `pnpm generate`, then `scripts/check-clean.ts` | Fails when the generated files differ from what is committed |

`make generate` runs `pnpm generate`.

`generate:api` and `generate:backend` read the OpenAPI document, so they only
see a TypeSpec change after `generate:spec` has run. Use `pnpm generate` unless
you have a reason to run one step alone.

## Step 1: TypeSpec to OpenAPI

`specs/main.tsp` imports every model file in `specs/models/` and every
operation file in `specs/operations/`. The `compile` script in
`specs/package.json` is:

```
tsp compile .
```

`specs/tspconfig.yaml` selects the emitter and the file name:

```yaml
emit:
  - "@typespec/openapi3"

options:
  "@typespec/openapi3":
    output-file: "generated/openapi.yaml"
```

The document describes every domain that is defined in TypeSpec. The backend
implements only the Salon operations, the operations on the service
categories and on the services of a salon (`ServiceCategoryCrud`,
`ServiceCrud`), seven of the nineteen operations of `CustomerCrud` (the
customer ledger: `list`, `create`, `get`, `update` and `delete`; the
preferences of a customer: `getPreferences` and `updatePreferences`), the
five of `CustomerProfile` (a customer's own profile, and their own
preferences), the eleven operations of `BookingCrud` (the booking
ledger: `list`, `create`, `get`, `update` and `delete`, the actions on the
status of a booking: `confirm`, `cancel`, `start`, `complete` and `noShow`,
and `reschedule`), the three of `BookingServiceCrud` (the service lines of
a booking that exists: `create`, `get` and `delete`), the five
operations of
`StaffCrud` (the staff ledger of a salon: `list`, `create`, `get`, `update`
and `delete`), the two of `StaffSchedules` (when a staff member works:
`list` and `update`), the three of `StaffInvitations` (the invitation by
which a staff member gets a login account: `get`, `create` and `delete`),
the three of `StaffAccounts` (the account of a staff member, as the salon
keeps it: `get`, `update` and `delete`),
the two of `StaffProfile` (what customers
are shown of a staff member: `list` and `get`), the two of
`StaffOwnProfile` (a staff member's own profile: `get` and `update`), the
authentication operations (those of
`AuthCrud`, `SessionCrud` and `AdminAuthCrud`: login, refresh, logout, the
current user, registration, email verification, password reset and change,
verifying, accepting and joining the invitation of a staff member, two-factor
authentication, the session list, the administrator operations)
and the system probes (`alive`, `ready`, `health`); the types and client
functions of everything else are generated all the same.

## Step 2: OpenAPI to backend types

Package: `@beauty-salon-backend/generated` (`backend/packages/generated`).

```
backend/packages/generated/
├── scripts/
│   ├── generate-types.ts   # the generator, run with tsx
│   └── tsconfig.json       # type-checks the generator (`pnpm typecheck`)
├── src/                    # generated, committed, never edited by hand
│   ├── api-types.ts        # paths, components, operations
│   ├── schema.ts           # one Zod schema and type per string enum
│   └── index.ts            # re-exports both files
├── rslib.config.ts         # builds src/ to dist/
└── package.json
```

`backend/packages/generated/scripts/generate-types.ts`:

1. stops with an error if the OpenAPI document does not exist;
2. runs the `openapi-typescript` CLI (version 7) on the document;
3. reads `components.schemas` of the document through a Zod schema, and stops
   with an error when the document does not have it;
4. writes `src/api-types.ts`: the CLI output (`paths`, `components`,
   `operations`), with the JSDoc of every documented enum schema reformatted
   so that each enum value is described on its own line;
5. writes `src/schema.ts`: for every string enum in `components.schemas`, a Zod
   schema and the type inferred from it, named after the enum without the
   `Models.` prefix (`DayOfWeekTypeSchema`, `DayOfWeekType`);
6. writes `src/index.ts`.

This package alone pins `typescript` to 5.9.3, because `openapi-typescript` 7
uses the TypeScript compiler API and declares `typescript ^5.x` as its peer
dependency. Every other package uses TypeScript 7. Do not change the pin
together with the rest of the workspace.

Other backend packages import the package by name. In development and in tests
the import resolves to `src/index.ts` through the
`@beauty-salon-backend/source` export condition; a production build uses
`dist/`.

How the types are used is described in
[OpenAPI TypeScript Usage](./openapi-typescript-usage.md).

## Step 3: OpenAPI to frontend client

Package: `@beauty-salon-frontend/api-client` (`frontend/packages/api-client`).
Its `generate` script runs `orval` with
`frontend/packages/api-client/orval.config.ts`:

```typescript
export default defineConfig({
  beautySalon: {
    input: {
      target:
        '../../../specs/tsp-output/@typespec/openapi3/generated/openapi.yaml',
    },
    output: {
      clean: true,
      mode: 'tags-split',
      target: './src/generated/endpoints',
      schemas: './src/generated/models',
      client: 'react-query',
      httpClient: 'fetch',
      mock: false,
      override: {
        mutator: {
          path: './src/mutator.ts',
          name: 'customInstance',
        },
      },
    },
  },
})
```

Output, under `frontend/packages/api-client/src/generated/`:

- `endpoints/<tag>/<tag>.ts`: one file per OpenAPI tag (for example
  `endpoints/salons/salons.ts`). For every operation it holds a fetch function,
  its URL builder and response types, and the TanStack Query hook with its
  options and key helpers.
- `endpoints/index.ts`: re-exports every tag file.
- `models/`: one file per type (component schemas, query parameter objects,
  inline request and response bodies), and an `index.ts` that re-exports them.

`clean: true` deletes both directories before they are written again, so a
model that is removed from TypeSpec disappears from the client.

The package is consumed through its build output (`dist/`), not from source.
After regenerating, rebuild it with
`pnpm --filter @beauty-salon-frontend/api-client run build:dev`, or keep
`pnpm dev` running: the `dev` script of the package rebuilds on change.

What the frontend does with the client is described in
[Frontend API Integration](./frontend-api-integration.md).

## Generated files are committed

The OpenAPI document, `backend/packages/generated/src/` and
`frontend/packages/api-client/src/generated/` are tracked by git. A TypeSpec
change is committed together with the files it regenerates.

`pnpm check:generated` enforces this:

```
pnpm generate && node ./scripts/check-clean.ts specs/tsp-output backend/packages/generated/src frontend/packages/api-client/src/generated
```

`scripts/check-clean.ts` runs `git status --porcelain` on the three paths and
fails if anything is reported. The check runs in the `quality` job of
`.github/workflows/ci.yml` and in `make ci-check`. Locally it also fails while
regenerated files are not committed yet.

Biome does not lint or format the generated TypeScript (`biome.json` excludes
both directories) and does not touch YAML. `.tsp` files are formatted with
`tsp format` by `pnpm format:fix`.

## Changing the API

1. Edit the `.tsp` files under `specs/`, following
   [TypeSpec API Type Rules](./typespec-api-type-rules.md).
2. Run `pnpm generate` (or leave `pnpm generate:watch` running).
3. Fix what no longer compiles: `pnpm typecheck` (after a build, as in CI).
   The request Zod schemas are checked against the generated types with
   `satisfies z.ZodType<…>`, so a property that was added, or whose type
   changed, shows up as a type error in
   `backend/packages/domain/src/schemas/salon.schema.ts` (or
   `auth.schema.ts`, `service-category.schema.ts`, `service.schema.ts` or
   `customer.schema.ts` next to it). A property that was
   removed from a model is not reported there: remove it from the schema
   yourself.
4. If a model that maps to a table changed, run `pnpm check:api-db`.
5. Commit the `.tsp` change and the generated files together.

## Troubleshooting

**`OpenAPI file not found`** from `pnpm generate:backend`: the OpenAPI document
is missing. Run `pnpm generate:spec`, or `pnpm generate`.

**`pnpm check:generated` fails in CI**: the commit changed TypeSpec without the
generated files, or changed a generated file by hand. Run `pnpm generate`
locally and commit the result.

**A generated type is missing or stale in the editor**: run `pnpm generate`
and restart the TypeScript server. For the frontend client, rebuild the
`api-client` package as described in step 3.

**`openapi-typescript` fails after a dependency update**: check that
`typescript` in `backend/packages/generated/package.json` is still a 5.x
release.

## Related Documentation

- [Architecture Overview](./architecture-overview.md)
- [TypeSpec API Type Rules](./typespec-api-type-rules.md)
- [OpenAPI TypeScript Usage](./openapi-typescript-usage.md)
- [Frontend API Integration](./frontend-api-integration.md)
- [Backend Architecture Guidelines](./backend-architecture-guidelines.md)
