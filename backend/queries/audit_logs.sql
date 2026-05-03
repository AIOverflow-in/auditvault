-- name: CreateAuditLog :exec
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, metadata_json)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: ListAuditLogs :many
SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.project_id,
       a.metadata_json, a.created_at, u.name AS user_name, u.email AS user_email
FROM audit_logs a
JOIN users u ON u.id = a.user_id
ORDER BY a.created_at DESC
LIMIT $1 OFFSET $2;
