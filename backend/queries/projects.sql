-- name: ListProjectsByOrg :many
SELECT
  p.id, p.vessel_id, p.project_type, p.region, p.proposed_date, p.actual_date,
  p.stage, p.remarks, p.created_by_id, p.created_at, p.updated_at,
  v.name AS vessel_name, v.imo_number AS vessel_imo, v.organization_id,
  o.name AS organization_name
FROM projects p
JOIN vessels v ON v.id = p.vessel_id
JOIN organizations o ON o.id = v.organization_id
WHERE v.organization_id = $1
ORDER BY v.name, p.proposed_date NULLS LAST, p.created_at;

-- name: ListAllProjects :many
SELECT
  p.id, p.vessel_id, p.project_type, p.region, p.proposed_date, p.actual_date,
  p.stage, p.remarks, p.created_by_id, p.created_at, p.updated_at,
  v.name AS vessel_name, v.imo_number AS vessel_imo, v.organization_id,
  o.name AS organization_name
FROM projects p
JOIN vessels v ON v.id = p.vessel_id
JOIN organizations o ON o.id = v.organization_id
ORDER BY p.updated_at DESC;

-- name: ListProjectsByVessel :many
SELECT
  p.id, p.vessel_id, p.project_type, p.region, p.proposed_date, p.actual_date,
  p.stage, p.remarks, p.created_by_id, p.created_at, p.updated_at,
  v.name AS vessel_name, v.imo_number AS vessel_imo, v.organization_id,
  o.name AS organization_name
FROM projects p
JOIN vessels v ON v.id = p.vessel_id
JOIN organizations o ON o.id = v.organization_id
WHERE p.vessel_id = $1
ORDER BY p.created_at DESC;

-- name: GetProject :one
SELECT
  p.id, p.vessel_id, p.project_type, p.region, p.proposed_date, p.actual_date,
  p.stage, p.remarks, p.created_by_id, p.created_at, p.updated_at,
  v.name AS vessel_name, v.imo_number AS vessel_imo, v.organization_id,
  o.name AS organization_name
FROM projects p
JOIN vessels v ON v.id = p.vessel_id
JOIN organizations o ON o.id = v.organization_id
WHERE p.id = $1;

-- name: CreateProject :one
INSERT INTO projects (vessel_id, project_type, region, proposed_date, stage, remarks, created_by_id)
VALUES ($1, $2, $3, $4, COALESCE($5, 'ENQUIRY'), $6, $7)
RETURNING id, vessel_id, project_type, region, proposed_date, actual_date, stage, remarks, created_by_id, created_at, updated_at;

-- name: UpdateProjectStage :one
UPDATE projects SET stage = $2, updated_at = now()
WHERE id = $1
RETURNING id, vessel_id, project_type, region, proposed_date, actual_date, stage, remarks, created_by_id, created_at, updated_at;

-- name: UpdateProjectRemarks :one
UPDATE projects SET remarks = $2, updated_at = now()
WHERE id = $1
RETURNING id, vessel_id, project_type, region, proposed_date, actual_date, stage, remarks, created_by_id, created_at, updated_at;

-- name: UpdateProjectMeta :one
UPDATE projects
SET region        = COALESCE($2, region),
    proposed_date = COALESCE($3, proposed_date),
    actual_date   = COALESCE($4, actual_date),
    updated_at    = now()
WHERE id = $1
RETURNING id, vessel_id, project_type, region, proposed_date, actual_date, stage, remarks, created_by_id, created_at, updated_at;

-- name: CountProjectsByStageForOrg :many
SELECT p.stage, COUNT(*)::int AS count
FROM projects p JOIN vessels v ON v.id = p.vessel_id
WHERE v.organization_id = $1
GROUP BY p.stage;

-- name: CountProjectsByStage :many
SELECT stage, COUNT(*)::int AS count FROM projects GROUP BY stage;
