-- name: GetOrganization :one
SELECT id, name, type, created_at
FROM organizations
WHERE id = $1;

-- name: ListClientOrganizations :many
SELECT
  o.id, o.name, o.type, o.created_at,
  (SELECT COUNT(*)::int FROM vessels v WHERE v.organization_id = o.id) AS vessel_count,
  (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) AS user_count
FROM organizations o
WHERE o.type = 'CLIENT'
ORDER BY o.name;

-- name: CreateOrganization :one
INSERT INTO organizations (name, type) VALUES ($1, $2)
RETURNING id, name, type, created_at;

-- name: GetClientOrganizationDetail :one
SELECT id, name, type, created_at
FROM organizations
WHERE id = $1 AND type = 'CLIENT';
