-- name: GetUserByEmail :one
SELECT id, email, name, password_hash, role, organization_id, created_at
FROM users
WHERE email = $1;

-- name: GetUserByID :one
SELECT id, email, name, password_hash, role, organization_id, created_at
FROM users
WHERE id = $1;

-- name: ListUsers :many
SELECT u.id, u.email, u.name, u.role, u.organization_id, u.created_at, o.name AS organization_name, o.type AS organization_type
FROM users u
JOIN organizations o ON o.id = u.organization_id
ORDER BY o.name, u.name;

-- name: ListUsersByOrg :many
SELECT id, email, name, role, organization_id, created_at
FROM users
WHERE organization_id = $1
ORDER BY name;

-- name: CreateUser :one
INSERT INTO users (email, name, password_hash, role, organization_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, email, name, role, organization_id, created_at;
