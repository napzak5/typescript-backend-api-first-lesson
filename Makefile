# Thin wrappers around the pnpm scripts in package.json, plus the Docker
# workflows that have no pnpm equivalent. `make help` lists every target.

COMPOSE := docker compose
INFRA_SERVICES := postgres mailhog minio minio-init

# Node environment for each build flavour (used by backend-start-<env>)
NODE_ENV_dev := development
NODE_ENV_test := test
NODE_ENV_stg := staging
NODE_ENV_prod := production

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN { FS = ":.*## " } \
	  /^## / { printf "\n%s\n", substr($$0, 4) } \
	  /^[a-zA-Z0-9_%-]+:.*## / { printf "  make %-22s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

## Setup
.PHONY: install fresh clean clean-all
install: ## Install all dependencies
	pnpm install

fresh: ## Remove every build output and node_modules, then reinstall
	pnpm fresh

clean: ## Remove build outputs
	pnpm clean

clean-all: ## Remove build outputs and node_modules
	pnpm clean:all

## Development
.PHONY: generate backend-build backend-start backend-dev frontend-build frontend-dev frontend-preview
generate: ## Generate OpenAPI, backend types and the frontend API client from TypeSpec
	pnpm generate

backend-build: ## Generate types and build the backend
	pnpm generate
	pnpm build:backend

backend-start: infra-up ## Start the built backend against the local services
	pnpm start:backend

backend-dev: infra-up ## Start the backend in watch mode against the local services
	pnpm dev:backend

frontend-build: ## Generate the API client and build the frontend
	pnpm generate
	pnpm build:frontend

frontend-dev: ## Start the frontend dev servers (run frontend-build first)
	pnpm --parallel --filter './frontend/apps/*' run dev

frontend-preview: ## Serve the built frontend apps
	pnpm preview:frontend

## Build for a specific environment (dev, test, stg, prod)
.PHONY: build
build: ## Build all packages for production
	pnpm build:prod

build-%: ## Build all packages for <env>, e.g. make build-stg
	pnpm build:$*

backend-start-%: infra-up ## Start the built backend with the <env> configuration
	NODE_ENV=$(NODE_ENV_$*) pnpm start:backend

## Quality
.PHONY: lint format format-check typecheck knip test test-integration audit ci-check
lint: ## Lint with Biome
	pnpm lint

format: ## Format the code
	pnpm format

format-check: ## Check formatting without writing
	pnpm format:check

typecheck: ## Type check all packages (build first)
	pnpm typecheck

knip: ## Report unused files, exports and dependencies
	pnpm knip

test: ## Run unit tests
	pnpm test

test-integration: ## Run API integration tests (needs Docker or TEST_DATABASE_URL)
	pnpm test:integration

audit: ## Fail on high or critical vulnerabilities
	pnpm audit --audit-level=high

ci-check: ## Run the same checks as the CI workflow
	pnpm install --frozen-lockfile
	pnpm check:versions
	pnpm check:generated
	pnpm lint
	pnpm format:check
	pnpm build:prod
	pnpm typecheck
	pnpm knip
	pnpm test
	pnpm test:integration
	pnpm audit --audit-level=high
	@echo "All CI checks passed."

## Database
.PHONY: db-fresh db-migrate db-seed db-truncate db-introspect db-generate-sql db-check
db-fresh: ## Drop everything and recreate the schema from sql/setup.sql
	pnpm db:fresh

db-migrate: ## Apply the SQL migrations
	pnpm db:migrate

db-seed: ## Insert sample data
	pnpm db:seed

db-truncate: ## Delete all rows, keeping the schema
	pnpm db:truncate

db-introspect: ## Regenerate schema.ts and relations.ts from the database
	pnpm db:introspect

db-generate-sql: ## Regenerate sql/setup.sql from schema.ts
	pnpm db:generate-sql

db-check: ## Verify schema.ts, relations.ts and setup.sql agree (recreates the database)
	pnpm check:db-schema

## Local services (Docker Compose)
.PHONY: infra-up docker-up docker-down docker-build docker-logs docker-clean
infra-up: ## Start PostgreSQL, MailHog and MinIO and wait for the database
	$(COMPOSE) up -d $(INFRA_SERVICES)
	$(COMPOSE) up -d --wait postgres

docker-up: ## Start every service, including the backend container (recreates the database)
	$(COMPOSE) up -d
	@echo "Backend: http://localhost:3000  MailHog: http://localhost:8025  MinIO: http://localhost:9001"

docker-down: ## Stop all services
	$(COMPOSE) down

docker-build: ## Build the Compose images
	$(COMPOSE) build

docker-logs: ## Follow the service logs
	$(COMPOSE) logs -f

docker-clean: ## Stop all services and delete their volumes
	$(COMPOSE) down -v

## Docker image checks
.PHONY: ci-check-dockerfile docker-check-backend docker-check-frontend
ci-check-dockerfile: docker-check-backend docker-check-frontend ## Build every production image
	@echo "All Docker images build."

docker-check-backend: ## Build the backend production image
	docker build -f Dockerfile.backend --target production -t beauty-salon-backend:check .

docker-check-frontend: ## Build the three frontend images
	docker build -f Dockerfile.frontend --build-arg APP=admin --build-arg APP_PORT=4001 -t beauty-salon-frontend-admin:check .
	docker build -f Dockerfile.frontend --build-arg APP=portal --build-arg APP_PORT=4002 -t beauty-salon-frontend-portal:check .
	docker build -f Dockerfile.frontend --build-arg APP=dashboard --build-arg APP_PORT=4003 -t beauty-salon-frontend-dashboard:check .
