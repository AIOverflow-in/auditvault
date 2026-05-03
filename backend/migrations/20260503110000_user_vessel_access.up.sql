-- Per-user, per-vessel access grants. Admin (Nivyash) controls which ships
-- each client user can see. ADMIN/STAFF roles bypass this table and always
-- see everything; CLIENT_ADMIN and CLIENT_VIEWER are filtered by it.
CREATE TABLE user_vessel_access (
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vessel_id      UUID        NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
    granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by_id  UUID            REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, vessel_id)
);
CREATE INDEX user_vessel_access_vessel_idx ON user_vessel_access (vessel_id);
