# Running AuditVault locally

Cheat sheet for day-to-day testing. Assumes `backend/.env` is already filled in with live Neon + S3 creds (which it is — done during the live wire-up). For first-time setup of a *new* environment instead, see [QA-GUIDE.md](QA-GUIDE.md).

## Two-terminal flow

**Terminal 1 — backend** (Go API on `:8080`)

```sh
cd backend
go run ./cmd/server
```

You should see `server.listen` and `storage.ready provider=s3` in the log within a second. Hitting `Ctrl-C` shuts down cleanly.

**Terminal 2 — frontend** (Next.js on `:3000`)

```sh
cd frontend
npm run dev
```

Open <http://localhost:3000>. It redirects to `/login`.

> **If port 3000 is already taken** by another project on this machine, run `npm run dev -- -p 3010` and open `http://localhost:3010`. The backend's CORS is locked to `http://localhost:3000` though — to use a different port, also change `FRONTEND_ORIGIN` in `backend/.env` and restart the backend.

## Demo logins

Seeded by `make seed`. All passwords work as shown.

| Role | Email | Password | What they should see |
|---|---|---|---|
| Nivyash admin | `admin@nivyash.com` | `admin12345` | Everything — start here |
| Nivyash staff | `staff@nivyash.com` | `staff12345` | Everything except user mgmt + audit log |
| Pacific manager (CLIENT_ADMIN) | `manager@pacifictankers.com` | `client12345` | Pacific Star + Ocean Glory |
| **Pacific viewer** (CLIENT_VIEWER) | `viewer@pacifictankers.com` | `client12345` | **Only Pacific Star** — RBAC demo |
| Nordic manager | `ops@nordicbulk.com` | `client12345` | Both Nordic ships |

The viewer's partial grant is the live demo for the per-vessel RBAC requirement.

## Where to click first

1. Log in as `admin@nivyash.com`. Sidebar shows three items: **Dashboard**, **Users**, **Audit log**.
2. **Dashboard** lands on the list of all client companies. Click **Pacific Tankers Pte Ltd** — the Excel-replica table is the headline screen. Try editing remarks, changing a stage, uploading a PDF as the report.
3. **Users → click the viewer → Manage access** — tick/untick a ship to see the RBAC mechanics live.
4. **Audit log** — every mutation you just did is recorded with actor and metadata.
5. Sign out. Log in as `viewer@pacifictankers.com`. Their **Dashboard** redirects directly to Pacific Tankers' page (only one client = no list step). Confirm Ocean Glory does not appear anywhere.

## File types you can upload

Any file type — PDF, Word, Excel, MP3 (VDR audio), MP4 / MOV (video), images, archives. Hard cap is 10 GB per file. Anything bigger than 50 MiB chunk-uploads in 50 MiB pieces with retry on flaky connections, so multi-GB VDR recordings or surveyor video clips are fine.

## Useful one-liners

```sh
# Apply / inspect migrations
cd backend && go run ./cmd/migrate up
cd backend && go run ./cmd/migrate version

# Re-seed demo data (idempotent — safe to re-run)
make seed

# Free port 8080 if a stray server is hanging on
lsof -i :8080
kill -9 <pid>

# Tail backend logs as JSON (when running with `make dev` or backgrounded)
tail -f /tmp/avbe.log

# List S3 bucket contents (uses .env creds via aws CLI env vars)
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1 \
  aws s3 ls s3://auditvaultai/ --recursive
```

## Switching storage between S3 and R2

The backend supports both. Swap `STORAGE_PROVIDER` in `backend/.env`:

- `STORAGE_PROVIDER=s3` (current) — uses `S3_*` vars, writes to AWS S3 bucket `auditvaultai`.
- `STORAGE_PROVIDER=r2` — uses `R2_*` vars (you'll need to fill them in first).

Restart the backend after the change. No code/database changes needed.

## What's not running yet

- **Email notifications** are wired and Resend is connected, but free-tier delivery is **only to the email that owns the Resend account** until a sender domain is verified. To enable real delivery: add a domain at <https://resend.com/domains>, follow the DNS steps, then set `EMAIL_FROM=noreply@<your-verified-domain>` in `backend/.env` and restart the backend.
- **CSV import** for legacy projects — Phase 5.

## Email triggers (what fires when)

| Trigger | Recipients |
|---|---|
| Project stage → `REPORT_SUBMITTED` | All client users with grants on that ship |
| Project stage → `COMPLETED` | Same |
| New `FINAL_REPORT` file completed | Same |
| Client uploads a `FEEDBACK` file | All Nivyash admin/staff |
| New project created on a ship | All client users with grants on that ship |

Sends happen in a goroutine after the API response — never blocks the user's action. Failures are logged at `level=ERROR msg=notify.send`. Successful sends log at `level=INFO msg=notify.sent`.

## Stop everything

`Ctrl-C` in both terminals. The Neon DB and S3 bucket are remote so nothing local lingers.
