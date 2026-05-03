.PHONY: help db-up db-down db-logs migrate-up migrate-down migrate-new sqlc seed backend frontend dev install

help:
	@echo "AuditVault — common dev commands"
	@echo ""
	@echo "  make install         install backend + frontend deps"
	@echo "  make db-up           start local Postgres in Docker"
	@echo "  make db-down         stop local Postgres"
	@echo "  make db-logs         tail Postgres logs"
	@echo "  make migrate-up      run all pending migrations"
	@echo "  make migrate-down    rollback the most recent migration"
	@echo "  make migrate-new N=add_foo  create a new migration pair"
	@echo "  make sqlc            regenerate Go code from queries/*.sql"
	@echo "  make backend         run the Go API on :8080"
	@echo "  make frontend        run the Next.js dev server on :3000"
	@echo "  make dev             db-up + backend + frontend concurrently"

install:
	cd backend && go mod download
	cd frontend && npm install

db-up:
	docker compose up -d postgres
	@echo "Waiting for Postgres to be healthy..."
	@until docker compose exec -T postgres pg_isready -U $${POSTGRES_USER:-auditvault} >/dev/null 2>&1; do sleep 1; done
	@echo "Postgres ready on :$${POSTGRES_PORT:-5432}"

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

migrate-up:
	cd backend && go run ./cmd/migrate up

migrate-down:
	cd backend && go run ./cmd/migrate down

migrate-new:
	@if [ -z "$(N)" ]; then echo "Usage: make migrate-new N=add_foo_table"; exit 1; fi
	@TS=$$(date +%s); \
	  touch backend/migrations/$${TS}_$(N).up.sql backend/migrations/$${TS}_$(N).down.sql; \
	  echo "Created backend/migrations/$${TS}_$(N).{up,down}.sql"

sqlc:
	cd backend && sqlc generate

seed:
	cd backend && go run ./cmd/seed

backend:
	cd backend && go run ./cmd/server

frontend:
	cd frontend && npm run dev

dev:
	@$(MAKE) db-up
	@trap 'kill 0' INT TERM; \
	  $(MAKE) -j2 backend frontend
