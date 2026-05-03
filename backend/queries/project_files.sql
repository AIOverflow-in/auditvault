-- name: ListFilesForProjects :many
-- Used by /clients/[id] to render Report/Feedback cells. Live, complete files only.
SELECT id, project_id, file_name, file_type, file_size, category, status,
       r2_key, uploaded_by_id, created_at
FROM project_files
WHERE project_id = ANY(@project_ids::uuid[])
  AND status = 'COMPLETE'
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: ListFilesForProject :many
SELECT pf.id, pf.project_id, pf.file_name, pf.file_type, pf.file_size, pf.category, pf.status,
       pf.r2_key, pf.uploaded_by_id, pf.created_at,
       u.name AS uploaded_by_name
FROM project_files pf
JOIN users u ON u.id = pf.uploaded_by_id
WHERE pf.project_id = $1
  AND pf.status = 'COMPLETE'
  AND pf.deleted_at IS NULL
ORDER BY pf.created_at DESC;

-- name: GetFile :one
-- Returns the file regardless of status / deleted_at. Handlers do their own
-- gating; this is the raw lookup.
SELECT id, project_id, file_name, file_type, file_size, category, status,
       r2_key, r2_upload_id, deleted_at, uploaded_by_id, created_at
FROM project_files
WHERE id = $1;

-- name: CreatePendingFile :one
INSERT INTO project_files (
    project_id, file_name, file_type, file_size, category, status,
    r2_key, r2_upload_id, uploaded_by_id
)
VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, $8)
RETURNING id, project_id, file_name, file_type, file_size, category, status,
          r2_key, r2_upload_id, uploaded_by_id, created_at;

-- name: CompleteFile :one
UPDATE project_files
SET status       = 'COMPLETE',
    r2_upload_id = NULL  -- multipart upload finalised; id is no longer useful
WHERE id = $1
  AND status = 'PENDING'
RETURNING id, project_id, file_name, file_type, file_size, category, status,
          r2_key, uploaded_by_id, created_at;

-- name: AbortPendingFile :exec
DELETE FROM project_files WHERE id = $1 AND status = 'PENDING';

-- name: SetFileR2Identifiers :exec
UPDATE project_files
SET r2_key = $2, r2_upload_id = $3
WHERE id = $1 AND status = 'PENDING';

-- name: SoftDeleteFile :one
UPDATE project_files
SET deleted_at = now(), deleted_by_id = $2
WHERE id = $1 AND deleted_at IS NULL
RETURNING id, project_id, file_name, r2_key, deleted_at;
