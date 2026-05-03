# AuditVault

Maritime audit management platform for **Nivyash Maritime Consultancy**.

Replaces an email + WeTransfer + spreadsheet workflow with a single web app where the office tracks every active inspection and clients self-serve to download their reports. Built for a senior, non-technical primary user (a 50+ ex-ship-captain), so the UX leans on plain language, large readable type, and tabular layouts that mirror the Excel sheet the team already uses.

---

## Architecture

```
┌─────────────────┐         HTTPS + JWT cookie         ┌──────────────────┐
│  Next.js 14     │ ─────────────────────────────────▶ │  Go 1.22 API     │
│  (Vercel)       │                                    │  (Render)        │
│  App Router     │                                    │  chi · sqlc      │
│  Tailwind       │                                    │  pgx · JWT       │
└─────────────────┘                                    └────┬─────────┬───┘
                                                            │         │
                                  ┌─────────────────────────┘         └─────────────────────────┐
                                  ▼                                                              ▼
                       ┌────────────────────┐                                       ┌────────────────────────┐
                       │ Postgres (Neon)    │                                       │ Cloudflare R2 / AWS S3 │
                       │ schema + RBAC      │                                       │ documents + reports    │
                       └────────────────────┘                                       └────────────────────────┘
```

- **Frontend** (Next.js 14, App Router, TypeScript, Tailwind) renders pages and handles UI only. All data and file operations go through the Go API. Vercel hosting.
- **Backend** (Go 1.22, [chi](https://github.com/go-chi/chi), [sqlc](https://github.com/sqlc-dev/sqlc), [pgx](https://github.com/jackc/pgx)) is a small HTTP service. Issues a JWT on `POST /auth/login`; the frontend stores it in an `httpOnly` `av_session` cookie set by a thin proxy route. Render hosting.
- **Postgres** (Neon free tier) holds the data model. Schema lives in [`backend/migrations/`](backend/migrations/) and is applied with `golang-migrate`.
- **File storage** is pluggable behind a small `Storage` interface — pick **Cloudflare R2** or **AWS S3** with one env var (`STORAGE_PROVIDER=r2|s3`). Browser uploads go directly to the bucket via presigned multipart URLs (50 MiB chunks, 10 GB single-file cap, resumable). Downloads return a 5-minute signed URL.
- **Email** via [Resend](https://resend.com): five plain-text transactional templates fired from a goroutine after the response (never blocks the user).

---

## What the platform does

| Capability | Notes |
|---|---|
| Vessel registry | Each ship belongs to a client company. IMO + flag + type metadata. |
| 5 audit types | Internal, Remote Nav (VDR-based), Incident Investigation, Pre-Purchase, Ship Recycling. |
| 8-stage lifecycle | enquiry → confirmed → data collection → analysis → report draft → report submitted → awaiting feedback → completed. Each transition is audit-logged. |
| Per-vessel RBAC | Admin grants client users access to specific ships. Org-level scoping is **not** sufficient — a CLIENT_VIEWER may see one ship in a multi-ship company. |
| Excel-style client view | `/clients/[id]` renders one flat table per client with the same 9 columns the team already uses, including inline upload buttons for the report and feedback files and an inline editor for company remarks. |
| File vault | Per-project documents categorised as RAW_DATA / DRAFT_REPORT / FINAL_REPORT / FEEDBACK / OTHER. Clients only ever see FINAL_REPORT and FEEDBACK. |
| Email notifications | Stage advance to REPORT_SUBMITTED / COMPLETED, new FINAL_REPORT, client FEEDBACK upload, new project creation. Recipients filtered by per-vessel grants. |
| Audit log | Every mutation (stage change, file upload/delete, grant change, user create) is recorded with actor and metadata. |

Excluded from v1: AI analysis, Kanban drag-and-drop, inline PDF/audio preview, public marketing site.

---

## Repository layout

```
auditvault/
├── frontend/           Next.js 14 app (Vercel)
│   ├── src/app/        App Router pages
│   ├── src/components/
│   └── src/lib/        api client, label helpers, multipart upload helper
├── backend/            Go API (Render)
│   ├── cmd/server/     entry point
│   ├── cmd/migrate/    golang-migrate runner
│   ├── cmd/seed/       demo data seeder
│   ├── internal/
│   │   ├── auth/       JWT + bcrypt + middleware
│   │   ├── audit/      audit-log writer
│   │   ├── config/     env loading
│   │   ├── db/         pgx pool + sqlc-generated queries
│   │   ├── email/      Resend client + transactional templates
│   │   ├── handlers/   chi handlers per resource
│   │   ├── httpx/      JSON helpers
│   │   ├── middleware/ logger, CORS, etc.
│   │   └── storage/    Storage interface + R2 + S3 adapters
│   ├── migrations/     SQL up/down files (golang-migrate)
│   └── queries/        SQL files consumed by sqlc
├── docs/               PRD, QA guide, run guide
└── docker-compose.yml  local Postgres for development
```

---

## Quick start (local development)

Prereqs: Go 1.22+, Node 20+, Docker Desktop (for the local Postgres).

```sh
cp .env.example .env
# fill in JWT_SECRET, R2_* or S3_* credentials, RESEND_API_KEY (optional)

make install            # backend mod download + frontend npm install
make db-up              # starts Postgres in Docker on :5432
make migrate-up         # applies the schema
make seed               # creates 5 demo accounts + sample projects
make dev                # backend on :8080, frontend on :3000
```

Open <http://localhost:3000> and sign in as `admin@nivyash.com` / `admin12345`.

Full step-by-step in [docs/RUN.md](docs/RUN.md). End-to-end test plan with R2/S3 setup steps in [docs/QA-GUIDE.md](docs/QA-GUIDE.md).

---

## Deployment

**Backend → Render** (free Web Service)

- Connect this repo to Render → root directory `backend/`.
- Build: `go build -o server ./cmd/server`
- Start: `./server`
- Env vars (all required unless noted):

  | Var | Purpose |
  |---|---|
  | `DATABASE_URL` | Neon connection string with `sslmode=require` |
  | `JWT_SECRET` | 32+ bytes, generate with `openssl rand -base64 48` |
  | `STORAGE_PROVIDER` | `r2` or `s3` |
  | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | if R2 |
  | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` | if S3 |
  | `RESEND_API_KEY` | optional — disables email if blank |
  | `EMAIL_FROM` | `onboarding@resend.dev` works without a verified domain |
  | `FRONTEND_ORIGIN` | the Vercel URL — used for CORS |

**Frontend → Vercel** (Hobby)

- Connect this repo → root directory `frontend/`.
- Env var: `NEXT_PUBLIC_API_URL` = the Render service URL.

**One bucket-side step that's easy to miss**: the R2 / S3 bucket's CORS policy must include `ExposeHeaders: ["ETag"]`. Without that the browser cannot read the part etag and multipart uploads fail at the complete step. Sample policy in [docs/QA-GUIDE.md](docs/QA-GUIDE.md).

---

## Documentation

- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — Client → Ship → Project → File chain, per-ship RBAC, visibility rules.
- [docs/RUN.md](docs/RUN.md) — day-to-day run cheat sheet, demo logins, common operations.
- [docs/QA-GUIDE.md](docs/QA-GUIDE.md) — end-to-end test plan + provisioning steps for a fresh environment.
- [docs/AuditVault-Developer-Plan.md](docs/AuditVault-Developer-Plan.md) — original PRD.

---

## License

Proprietary. All rights reserved.
