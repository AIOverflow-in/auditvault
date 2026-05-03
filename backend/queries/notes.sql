-- name: ListNotesForProject :many
SELECT n.id, n.project_id, n.body, n.author_id, n.created_at, u.name AS author_name
FROM project_notes n
JOIN users u ON u.id = n.author_id
WHERE n.project_id = $1
ORDER BY n.created_at DESC;

-- name: CreateNote :one
INSERT INTO project_notes (project_id, body, author_id)
VALUES ($1, $2, $3)
RETURNING id, project_id, body, author_id, created_at;
