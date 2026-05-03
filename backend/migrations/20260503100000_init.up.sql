CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE organizations (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    type        TEXT        NOT NULL CHECK (type IN ('NIVYASH', 'CLIENT')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT      NOT NULL UNIQUE,
    name            TEXT        NOT NULL,
    password_hash   TEXT        NOT NULL,
    role            TEXT        NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'CLIENT_ADMIN', 'CLIENT_VIEWER')),
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_org_idx ON users (organization_id);

CREATE TABLE vessels (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    imo_number      TEXT,
    flag            TEXT,
    vessel_type     TEXT,
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vessels_org_idx ON vessels (organization_id);

CREATE TABLE projects (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id     UUID        NOT NULL REFERENCES vessels(id) ON DELETE RESTRICT,
    project_type  TEXT        NOT NULL CHECK (project_type IN (
                    'INTERNAL_AUDIT',
                    'REMOTE_NAV_AUDIT',
                    'INCIDENT_INVESTIGATION',
                    'PRE_PURCHASE_INSPECTION',
                    'SHIP_RECYCLING_AUDIT')),
    region        TEXT,
    proposed_date DATE,
    actual_date   DATE,
    stage         TEXT        NOT NULL DEFAULT 'ENQUIRY' CHECK (stage IN (
                    'ENQUIRY',
                    'CONFIRMED',
                    'DATA_COLLECTION',
                    'ANALYSIS',
                    'REPORT_DRAFT',
                    'REPORT_SUBMITTED',
                    'AWAITING_FEEDBACK',
                    'COMPLETED')),
    remarks       TEXT,
    created_by_id UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_vessel_idx ON projects (vessel_id);
CREATE INDEX projects_stage_idx  ON projects (stage);

CREATE TABLE project_files (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name       TEXT        NOT NULL,
    file_type       TEXT,
    file_size       BIGINT,
    category        TEXT        NOT NULL DEFAULT 'OTHER' CHECK (category IN (
                      'RAW_DATA',
                      'DRAFT_REPORT',
                      'FINAL_REPORT',
                      'FEEDBACK',
                      'OTHER')),
    status          TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETE')),
    -- R2 (S3-compatible) object key. Set at upload-init, immutable thereafter.
    r2_key          TEXT,
    -- R2 multipart upload id. Populated while status='PENDING'; cleared after complete/abort.
    r2_upload_id    TEXT,
    -- Soft-delete: row stays, R2 object stays. Admin can restore later if needed.
    deleted_at      TIMESTAMPTZ,
    deleted_by_id   UUID            REFERENCES users(id) ON DELETE SET NULL,
    uploaded_by_id  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_files_project_idx     ON project_files (project_id) WHERE deleted_at IS NULL;
CREATE INDEX project_files_category_idx    ON project_files (project_id, category) WHERE deleted_at IS NULL AND status = 'COMPLETE';

CREATE TABLE project_notes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    body       TEXT        NOT NULL,
    author_id  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_notes_project_idx ON project_notes (project_id);

CREATE TABLE audit_logs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action        TEXT        NOT NULL,
    entity_type   TEXT        NOT NULL,
    entity_id     UUID        NOT NULL,
    project_id    UUID            REFERENCES projects(id) ON DELETE SET NULL,
    metadata_json JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_project_idx ON audit_logs (project_id);

CREATE TABLE settings (
    key        TEXT        PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
