# AuditVault — data model & visibility flow

The whole platform sits on one chain: **Client → Ship → Project → File**. Visibility is gated at the **Ship** layer.

---

## The chain

```
   CLIENT (organisation)             1 client  = many ships
       │
       │  owns
       ▼
   SHIP (vessel)                     1 ship    = many projects
       │
       │  has audits run on it
       ▼
   PROJECT (audit job)               1 project = exactly 1 ship,
       │                                         1 client (via that ship)
       │  contains
       ▼
   FILES + NOTES + STAGE
```

Schema lives in [`backend/migrations/20260503100000_init.up.sql`](../backend/migrations/20260503100000_init.up.sql); the relationships are foreign keys (`vessels.organization_id`, `projects.vessel_id`, `project_files.project_id`).

---

## Each level, concretely

### Client (organisation)
A shipping company. e.g. *Pacific Tankers Pte Ltd*, *Nordic Bulk Carriers AS*. Has a name and a `type` enum (`NIVYASH` for the Nivyash internal org, `CLIENT` for everyone else). Created by Nivyash admin from `/clients/new`.

### Ship (vessel)
A specific vessel owned by exactly one client. Holds metadata: name, IMO, flag, vessel type. Add a ship and you must pick its owning client — there's no such thing as an orphan ship in the system. Created from `/vessels/new` (or via "+ Add ship" on a client's page, which pre-fills the client).

### Project (audit job)
One inspection assignment on one ship. Carries the audit type (5 enum values: `INTERNAL_AUDIT`, `REMOTE_NAV_AUDIT`, `INCIDENT_INVESTIGATION`, `PRE_PURCHASE_INSPECTION`, `SHIP_RECYCLING_AUDIT`), a region, proposed/actual dates, current stage in the 8-stage lifecycle, and Nivyash's internal remarks. The same ship can have many projects over its lifetime.

### Files / notes
Project-scoped, not ship-scoped. Every file is linked to a single project via `project_files.project_id`. Files have a category (`RAW_DATA`, `DRAFT_REPORT`, `FINAL_REPORT`, `FEEDBACK`, `OTHER`); clients only ever see `FINAL_REPORT` and `FEEDBACK`. Internal notes are admin/staff-only.

---

## Worked example

```
PACIFIC TANKERS PTE LTD  ──┬── Pacific Star  ──── Project: Remote Nav Audit (Jun)
                           │                  ┕── Project: Ship Recycling Audit (Aug)
                           └── Ocean Glory   ──── Project: Pre-Purchase Inspection (Jul)
```

That's one client, two ships, three projects total. The headline `/clients/[id]` page flattens this back into a single Excel-style table with one row per project, ordered by ship then date.

---

## Why files live under projects (not ships)

A "Final Report" is meaningful only in the context of *which audit it's for*. A recycling-audit final report and an internal-audit final report are different artefacts even on the same ship. Hanging files off the project keeps the report bundle, the raw data that produced it, and the client's feedback all in one tight scope. Ship-level documents (e.g. certificates of registry that travel with a vessel for years) aren't a v1 use case — if they become one, we'd add a separate `vessel_files` table rather than overload `project_files`.

---

## How visibility is gated — the **per-ship** grant

The grant table sits between **users** and **ships**:

```sql
CREATE TABLE user_vessel_access (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vessel_id  UUID NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by_id UUID REFERENCES users(id),
    PRIMARY KEY (user_id, vessel_id)
);
```

Nivyash admin manages this table from `/users/[id]` ("Manage access" → tick ships → Save).

**Visibility rules** in plain language:

| Role | What they see |
|---|---|
| `ADMIN`, `STAFF` (Nivyash) | Every ship of every client. Bypass `user_vessel_access` entirely. |
| `CLIENT_ADMIN`, `CLIENT_VIEWER` | Only ships they have a row for in `user_vessel_access`. No row → see nothing. |

Project visibility is **derived from ship visibility** (a project is visible iff the user can see its ship). File visibility is **derived from project visibility** plus the category filter (clients only see `FINAL_REPORT` + `FEEDBACK`).

### Example of partial grant

```
Client:  Pacific Tankers Pte Ltd
Ships:   Pacific Star, Ocean Glory

David  (CLIENT_ADMIN,  granted: Pacific Star + Ocean Glory)
   sees: all 3 projects on both ships, every final report, every feedback file
Mei    (CLIENT_VIEWER, granted: Pacific Star only)
   sees: Remote Nav Audit + Ship Recycling Audit (both on Pacific Star)
   NOT : Pre-Purchase Inspection (it's on Ocean Glory) — even though same client
Aman   (ADMIN at Nivyash, no grants needed)
   sees: everything across every client
```

Same company, two client users, different access — driven by the ship layer, not the company layer. That's the whole point of putting the gate at the ship.

---

## Email recipients flow through the same model

When stage advances to `REPORT_SUBMITTED` / `COMPLETED`, or a `FINAL_REPORT` file is uploaded, the backend resolves "who should know" by:

1. Looking up the project's ship.
2. Querying `user_vessel_access` for users with grants on that ship.
3. Sending one email to that recipient list.

So if Mei isn't granted Ocean Glory, she won't even get notified about Ocean Glory's reports. RBAC and notifications are answered by the same query — there's no second source of truth. See [`backend/queries/recipients.sql`](../backend/queries/recipients.sql) and [`backend/internal/handlers/notify.go`](../backend/internal/handlers/notify.go).

---

## Object storage layout (R2 / S3)

Bucket keys mirror the chain so files are easy to navigate from the bucket browser too:

```
{orgId}/{vesselId}/{projectId}/{fileId}/{filename}
```

Each segment is a UUID; the original filename is preserved as the last segment. The fileId in the path means same-named uploads (`report.pdf` × 3) never collide. Soft-deleted files keep their object in the bucket — only the DB row is flagged.

---

## TL;DR

- **One direction**: Client owns Ships; Ships have Projects; Projects hold Files.
- **One gate**: per-ship grants (`user_vessel_access`) decide what client users see.
- **No shortcuts**: project, file, and email visibility all derive from ship visibility.
- **Excel parity**: the headline `/clients/[id]` page collapses Client → Ships → Projects back into one flat table with the columns from `docs/IM-NIVYASH AUDIT VAULT DASHBOARD.xlsx` so the captain works in the layout he already knows.
