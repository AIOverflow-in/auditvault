# AuditVault.ai — Developer Blueprint

## Context

Nivyash is a maritime consultancy that conducts audits and inspections across vessel types globally. Today, all project coordination happens via email and WeTransfer — files arrive in multiple formats (audio VDR recordings, video, scanned PDFs, Word reports), there is no centralised view of what is active, and clients have no self-service access to their data. AuditVault.ai replaces this with a web platform that gives Nivyash staff full operational visibility and gives each client company controlled access to only their vessels and projects.

---

## 1. What the Platform Must Do

| Priority | Capability |
|---|---|
| Must | Register vessels and link them to client companies |
| Must | Create and track audit projects through a defined lifecycle |
| Must | Upload and organise documents per project (PDF, DOCX, MP3/MP4, images) |
| Must | Store all files in the company's existing OneDrive via Microsoft Graph API |
| Must | Role-based access: Nivyash admin full access, client sees only their vessels |
| Must | Dashboard: current/upcoming/past projects at a glance |
| Should | Email notifications on key stage changes |
| Should | Full history view per vessel |
| Later | AI analysis (explicitly excluded from v1) |

---

## 2. Core Data Model

### Entities

```
Organization
  id, name, type ENUM('nivyash','client'), created_at

Vessel
  id, name, imo_number, flag, vessel_type, organization_id, created_at

User
  id, email, name, password_hash, role ENUM('admin','staff','client_admin','client_viewer')
  organization_id, created_at

Project
  id, vessel_id, project_type ENUM(see below), region, proposed_date, actual_date
  stage ENUM(see below), created_by_user_id, remarks, created_at, updated_at

ProjectFile
  id, project_id, file_name, file_type, category ENUM('raw_data','draft_report','final_report','feedback','other')
  onedrive_item_id, onedrive_download_url, uploaded_by_user_id, created_at

ProjectNote
  id, project_id, body, author_user_id, created_at

AuditLog
  id, user_id, action, entity_type, entity_id, metadata_json, created_at
```

### Project Types (project_type enum)
- `internal_audit` — Internal Audit & Training
- `remote_nav_audit` — Remote Navigation Audit (VDR-based)
- `incident_investigation` — Maritime Incident Investigation
- `pre_purchase_inspection` — Pre-Purchase Inspection
- `ship_recycling_audit` — Ship Recycling Audit

### Project Lifecycle Stages (stage enum)
```
enquiry → confirmed → data_collection → analysis → report_draft → report_submitted → awaiting_feedback → completed
```

---

## 3. User Roles & Permissions

| Role | Access |
|---|---|
| `admin` (Nivyash) | Everything — all orgs, all vessels, all projects, user management |
| `staff` (Nivyash) | Assigned projects only; can upload files and change stages |
| `client_admin` | All vessels & projects for their org; can invite client_viewer users |
| `client_viewer` | Read-only; download reports; cannot see internal notes |

Rules:
- Client users **never** see vessels or projects belonging to other client orgs
- Internal remarks/notes fields are hidden from all client roles
- Audit log is admin-only

---

## 4. OneDrive Integration

Use **Microsoft Graph API** with OAuth2 (delegated or app permissions).

**Folder structure created automatically on file upload:**
```
/AuditVault/{ClientOrgName}/{VesselName}/{ProjectID}_{ProjectType}/
```

**Flow:**
1. User picks a file in the browser
2. Browser POSTs file to the backend API
3. Backend authenticates with MS Graph using stored refresh token
4. Backend uploads the file to the correct OneDrive folder via Graph API
5. Backend saves `onedrive_item_id` and a time-limited download URL to the `ProjectFile` DB record
6. When a user requests a download, backend generates a fresh short-lived direct download URL via Graph API

**Credentials to configure:**
- Azure App Registration → Client ID, Client Secret, Tenant ID
- OneDrive root folder ID (configurable via env var)

---

## 5. Application Pages & Routes

```
/                         → redirect to /dashboard
/login                    → email + password login (+ optional Microsoft SSO)

/dashboard                → main overview (role-aware)
/vessels                  → vessel list with search/filter
/vessels/new              → create vessel (admin/staff only)
/vessels/[id]             → vessel detail: metadata + full project history timeline
/projects                 → all projects; filterable by type, stage, client, date
/projects/new             → create project (select vessel, type, region, dates)
/projects/[id]            → project detail: stage tracker, files, notes, activity log
/clients                  → client company list (admin only)
/clients/new              → create client org
/clients/[id]             → client detail + their vessels + user list
/users                    → user management (admin only)
/settings                 → OneDrive connection, email config, profile
```

---

## 6. Dashboard Design

### Nivyash Admin Dashboard
- **Summary cards (top row):** Active Projects | Pending Reports | Completed This Month | Total Vessels Tracked
- **Pipeline view:** Kanban-style columns per project stage — drag to update stage
- **Upcoming calendar:** Next 30 days of proposed/confirmed audits
- **Recent activity feed:** Last 10 state changes + file uploads across all projects
- **Quick filters:** By project type / client / region / date range

### Client Dashboard
- Only their vessels and projects visible
- Status cards per vessel: latest project stage + any reports ready to download
- No Kanban — simple list view with stage badges
- Download button on completed reports

---

## 7. Notifications (Email)

Send emails via Resend (or SendGrid) for these triggers:

| Event | Recipients |
|---|---|
| New project created for a vessel | client_admin of that org |
| Stage changes to `report_submitted` | client_admin + client_viewer users for that vessel |
| Stage changes to `completed` | Same as above |
| New file uploaded in category `final_report` | Same as above |
| Client uploads feedback file | Nivyash admin + assigned staff |

Use simple transactional templates — no marketing footers needed.

---

## 8. Recommended Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR, API routes in one repo, strong ecosystem |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible, unstyled components to customise |
| Database | PostgreSQL | Relational, handles the data model cleanly |
| ORM | Prisma | Type-safe DB access, migrations, works great with PostgreSQL |
| Auth | NextAuth.js v5 | Handles credentials + Microsoft OAuth (needed for Graph API) |
| File Storage | Microsoft OneDrive via MS Graph API | User's existing cloud storage |
| Email | Resend | Simple API, generous free tier |
| Hosting | Vercel (app) + Supabase or Railway (DB) | Vercel = zero-config Next.js deploys; both DB options have managed PostgreSQL |
| Charts | Recharts | Lightweight, works well with React |

---

## 9. Build Phases

### Phase 1 — Core Platform (target: working internal tool)
- [ ] Auth: login, sessions, role middleware
- [ ] DB schema + Prisma migrations
- [ ] Vessel CRUD
- [ ] Client org CRUD + user invite flow
- [ ] Project CRUD with stage management
- [ ] File upload (local storage first, OneDrive in Phase 2)
- [ ] Admin dashboard (basic list views + stage cards)
- [ ] Project detail page with file list and internal notes

### Phase 2 — Client Portal + OneDrive (target: shareable with first client)
- [ ] OneDrive integration: Azure app registration, Graph API upload/download
- [ ] Migrate file storage to OneDrive; replace local storage
- [ ] Client-facing dashboard (restricted views)
- [ ] Email notifications (Resend integration)
- [ ] Vessel history timeline view

### Phase 3 — Polish & Scale
- [ ] Kanban pipeline drag-and-drop
- [ ] Advanced dashboard filters and date range pickers
- [ ] Audit log viewer for admin
- [ ] Mobile-responsive pass
- [ ] Bulk CSV import for existing vessel/project data
- [ ] PDF preview inline (PDF.js)
- [ ] Audio/video player inline for VDR recordings

---

## 10. Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://auditvault.ai

# Microsoft / OneDrive
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
ONEDRIVE_ROOT_FOLDER_ID=...

# Email
RESEND_API_KEY=...
EMAIL_FROM=noreply@auditvault.ai
```

---

## 11. Key Design Decisions

1. **Single Next.js repo**: Keeps the client portal and admin portal in one codebase, differentiated by role checks — avoids maintaining two separate apps.
2. **OneDrive as the single source of truth for files**: Files are never stored on the app server. The database only holds metadata (item ID + download URL). This satisfies compliance expectations and uses the existing subscription.
3. **Stage transitions are logged**: Every stage change writes to `AuditLog` with the user ID and timestamp — gives Nivyash a defensible audit trail for their own audits.
4. **Client users cannot see project remarks**: The `remarks` field on `Project` and all `ProjectNote` records are filtered server-side for client roles — never sent to the browser.
5. **No AI in v1**: The platform's value is organised access to data, not analysis. Keep scope tight.

---

## 12. Verification Checklist (for developer QA)

- [ ] Admin can create a client org, add a vessel, create a project, upload a file — verify file appears in OneDrive under correct folder path
- [ ] Client user logs in and sees only their own vessels; cannot navigate to another org's vessel URL directly
- [ ] Stage change from `report_submitted` triggers email to client
- [ ] Project history on vessel detail page shows all past projects in chronological order
- [ ] File download generates a working link (not expired)
- [ ] Audit log records the correct user + action for each stage change
- [ ] Mobile layout renders dashboard and project detail correctly at 375px width
