# AuditVault — QA guide

A practical walkthrough for end-to-end testing of the build before showing the customer.

## 1. Prerequisites

- Go 1.22+ (or 1.24, what's installed locally)
- Node 20+
- Docker Desktop **or** a managed Postgres (Neon free tier works)
- A Cloudflare account with R2 enabled

## 2. Pick a storage backend

The backend supports both **Cloudflare R2** (default, recommended) and **AWS S3**. Either works — file behaviour is identical because both speak the S3 protocol. Set `STORAGE_PROVIDER=r2` *or* `STORAGE_PROVIDER=s3` and fill in only that block in `.env`.

| | R2 | S3 |
|---|---|---|
| Cost | 10 GB free, ~$0.015/GB after, **zero egress** | ~$0.023/GB + per-GB egress fees |
| Setup speed | Fastest, single dashboard | Same, plus IAM policy |
| When to pick it | Default. Cheaper at scale, no egress surprises. | Already have AWS, or compliance / data residency wants AWS. |

The bucket-side setup (CORS rule, lifecycle rule) is identical for both — just done in their respective dashboards.

## 2a. Provision R2 (one-time)

1. Cloudflare dashboard → R2 → **Create bucket** → name it `auditvault`.
2. R2 → **Manage API tokens** → **Create API token** → **Permissions: Object Read & Write**, scope to the bucket. Copy:
   - Account ID
   - Access Key ID
   - Secret Access Key
3. **Bucket → Settings → CORS Policy** — paste this (replace the origin with your Vercel URL once deployed):
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   The `ETag` exposure is critical — without it the browser can't read the part etag and multipart uploads will fail at the complete step.
4. **Bucket → Settings → Object lifecycle rules** → add: *Abort incomplete multipart uploads after 7 days*. Stops abandoned uploads from accruing storage charges.

## 2b. Provision S3 (one-time, alternative to R2)

1. AWS Console → S3 → **Create bucket**. Pick a region close to your users (e.g. `ap-south-1` for Mumbai). Keep all public access blocked.
2. IAM → **Create user** → **Programmatic access** → attach a policy scoped to this bucket only:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject", "s3:GetObject", "s3:DeleteObject",
           "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts",
           "s3:ListBucket", "s3:ListBucketMultipartUploads"
         ],
         "Resource": [
           "arn:aws:s3:::YOUR_BUCKET",
           "arn:aws:s3:::YOUR_BUCKET/*"
         ]
       }
     ]
   }
   ```
   Save the access key id and secret.
3. **Bucket → Permissions → CORS** — same shape as R2, with the `ETag` exposure (also required on S3):
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. **Bucket → Management → Lifecycle rules** → *Delete incomplete multipart uploads after 7 days*. Same reasoning as R2.

In `.env` set `STORAGE_PROVIDER=s3` and fill in `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`. Leave `S3_ENDPOINT` and `S3_USE_PATH_STYLE` empty for real AWS.

(For local dev with **MinIO** instead: `S3_ENDPOINT=http://localhost:9000`, `S3_USE_PATH_STYLE=true`, plus your MinIO root creds and a created bucket. Same code path.)

## 3. Local environment

```sh
cp .env.example .env
# fill in JWT_SECRET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
make install
make db-up            # local Postgres in Docker
make migrate-up       # applies the schema
make seed             # creates demo orgs / users / vessels / projects + per-vessel grants
make dev              # starts backend on :8080 and frontend on :3000
```

Open <http://localhost:3000>.

## 4. Demo accounts (created by `make seed`)

| Role | Email | Password | What they should see |
|---|---|---|---|
| Nivyash admin | `admin@nivyash.com` | `admin12345` | Everything. Sees all clients, ships, projects, users, audit log. |
| Nivyash staff | `staff@nivyash.com` | `staff12345` | Same as admin minus user management and audit log. |
| Pacific manager (CLIENT_ADMIN) | `manager@pacifictankers.com` | `client12345` | Both Pacific Tankers ships and their projects. No internal notes/remarks. |
| Pacific viewer (CLIENT_VIEWER) | `viewer@pacifictankers.com` | `client12345` | **Only Pacific Star** — exercises the per-vessel RBAC. Should NOT see Ocean Glory. |
| Nordic manager | `ops@nordicbulk.com` | `client12345` | Both Nordic Bulk ships, never Pacific Tankers. |

## 5. End-to-end test plan

### 5.1 Auth + role gates

- [ ] `GET /` redirects to `/login`.
- [ ] Wrong password shows an inline error, no redirect.
- [ ] Successful login redirects to `/dashboard`. Cookie `av_session` is set, httpOnly, sameSite=lax.
- [ ] Sign-out clears the cookie and redirects back to `/login`.
- [ ] Pasting a client URL while logged out redirects to login.

### 5.2 Headline screen — Excel-style table on /clients/[id]

Login as `admin@nivyash.com`, click **Pacific Tankers Pte Ltd**.

- [ ] All 9 spreadsheet columns render in order: Sr no, Ship name, Project type, Proposed date, Region, Stage, Report uploaded, Remarks by company, Feedback from ship.
- [ ] Stage dropdown changes the DB row and the badge re-colours (refresh — it persists).
- [ ] Remarks: click **Edit** → type → **Save**. Refresh — value persists.
- [ ] Click **Upload report** in a row → choose any PDF → progress bar → row shows the filename as a download chip. Click chip → file downloads (302 to a fresh R2 presigned URL).
- [ ] Same for **Upload feedback** with a different file.
- [ ] Confirm both uploaded files exist in R2 under `{orgId}/{vesselId}/{projectId}/{fileId}/{filename}`.

### 5.3 Per-vessel RBAC

Sign out, sign in as `viewer@pacifictankers.com`.

- [ ] Sidebar has no "Clients", "Users", or "Audit log" links (correct — viewer is a client).
- [ ] `/vessels` shows **only Pacific Star** (no Ocean Glory).
- [ ] `/projects` shows only projects on Pacific Star.
- [ ] `/projects/<oceanGloryProjectId>` (paste the URL) returns 404.
- [ ] `/projects/<pacificStarProjectId>` works and the table shows neither internal remarks nor an "Internal notes" panel.
- [ ] On a Pacific Star project, the only file upload category available is **Feedback**.

Sign back in as admin → **Users** → click the viewer → **Manage access** → tick **Ocean Glory** → **Save access**. Sign back in as the viewer:
- [ ] Now sees Ocean Glory and its projects.

### 5.4 Project detail

Login as admin, open any project.

- [ ] Stage tracker shows all 8 steps; current step is the filled teal cell, completed steps are pale teal.
- [ ] Stage updater dropdown writes through and the page re-renders.
- [ ] Internal remarks render in the amber callout for Nivyash, hidden for clients.
- [ ] Files panel: upload a small (<5 MB) PDF as RAW_DATA. Download. Delete (admin) shows confirm dialog → soft-deleted (row disappears from list).
- [ ] Internal notes: add a note as staff, visible to admin/staff. Sign in as a client user → notes panel is absent.

### 5.5 R2 multipart resumable upload

On a project as admin, upload a file >100 MB so it actually splits into multiple parts.

- [ ] Progress bar advances chunk by chunk.
- [ ] Network DevTools shows multiple PUTs to `https://<account>.r2.cloudflarestorage.com/...` with `Content-Range` headers.
- [ ] Each PUT response carries an `ETag` header readable by the browser (CORS check).
- [ ] After completion, the file appears, downloads correctly.
- [ ] Mid-upload disconnect (toggle DevTools → Offline mid-upload, then back online): the helper retries the failing chunk; if a presigned URL has expired, it calls `GET /projects/{id}/files/{fileId}/parts/{n}/url` to refresh, then retries.

### 5.6 Users + grants

Login as admin → `/users`:

- [ ] Table lists all 6 seeded users with role badges and joined date.
- [ ] **Add user** → fill the form for a new CLIENT_VIEWER on Nordic Bulk → tick one of the Nordic ships → submit. Redirects to that user's grant page.
- [ ] On the user page, additional ships can be granted/revoked. **Save access** persists; refresh confirms.
- [ ] The new user can log in (use the temporary password) and sees only the granted ship.

### 5.7 Audit log

Login as admin → **Audit log**:

- [ ] Entries appear for every mutation done in this QA pass: project stage updates, remarks edits, file uploads, file deletes, user creates, vessel grant changes.
- [ ] Each entry shows actor name + email and a `metadata` blob with the relevant fields.

### 5.8 UX bar (senior user)

These should pass at-a-glance on every page:

- [ ] Body text is clearly readable on a normal laptop screen at arm's length (base font 17 px).
- [ ] No critical control is icon-only — every button has both an icon **and** a text label.
- [ ] Buttons and form fields are at least 44 px tall.
- [ ] No body copy is in faint grey (`text-gray-400`).
- [ ] Destructive actions (file delete) ask for confirmation.

## 6. Things deliberately NOT shipped in this build

These are tracked but live outside the QA scope:

- Email notifications (Phase 4 — `email.NoopMailer` logs would-have-sent emails to stdout instead).
- Password reset / change flows.
- CSV import of historical projects.
- Mobile-responsive polish on the project detail page.
- Inline PDF / audio preview.
- Hard-delete UI (the API supports it; deliberately not exposed).
- AI analysis.

## 7. Common gotchas during QA

- **Upload completes but file shows as 0 bytes / corrupted** → check the bucket CORS includes `ExposeHeaders: ["ETag"]`. Without it the helper sends empty etags.
- **403 mid-upload, repeatedly** → the presigned part URL is expired. The helper auto-refreshes; if it doesn't, check that the Go `/parts/{n}/url` route is reachable (CORS / auth cookie attached).
- **`/clients/{id}` is 404 for an admin** → the URL is the *organization id*, not a vessel id; check the URL.
- **A client user sees no ships at all** → no grants for them. Go to `/users/{id}` as admin and tick some.
