-- name: GrantVesselAccess :exec
INSERT INTO user_vessel_access (user_id, vessel_id, granted_by_id)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, vessel_id) DO NOTHING;

-- name: RevokeVesselAccess :exec
DELETE FROM user_vessel_access WHERE user_id = $1 AND vessel_id = $2;

-- name: RevokeAllVesselAccessForUser :exec
DELETE FROM user_vessel_access WHERE user_id = $1;

-- name: ListAccessibleVesselIDsForUser :many
SELECT vessel_id FROM user_vessel_access WHERE user_id = $1;

-- name: ListAccessibleVesselsForUser :many
SELECT v.id, v.name, v.imo_number, v.flag, v.vessel_type, v.organization_id, v.created_at,
       o.name AS organization_name
FROM user_vessel_access uva
JOIN vessels v        ON v.id = uva.vessel_id
JOIN organizations o  ON o.id = v.organization_id
WHERE uva.user_id = $1
ORDER BY o.name, v.name;

-- name: ListAccessibleProjectsForUser :many
SELECT
  p.id, p.vessel_id, p.project_type, p.region, p.proposed_date, p.actual_date,
  p.stage, p.remarks, p.created_by_id, p.created_at, p.updated_at,
  v.name AS vessel_name, v.imo_number AS vessel_imo, v.organization_id,
  o.name AS organization_name
FROM user_vessel_access uva
JOIN projects p ON p.vessel_id = uva.vessel_id
JOIN vessels v  ON v.id = p.vessel_id
JOIN organizations o ON o.id = v.organization_id
WHERE uva.user_id = $1
ORDER BY v.name, p.proposed_date NULLS LAST, p.created_at;

-- name: ListAccessibleProjectsForUserInOrg :many
SELECT
  p.id, p.vessel_id, p.project_type, p.region, p.proposed_date, p.actual_date,
  p.stage, p.remarks, p.created_by_id, p.created_at, p.updated_at,
  v.name AS vessel_name, v.imo_number AS vessel_imo, v.organization_id,
  o.name AS organization_name
FROM user_vessel_access uva
JOIN projects p ON p.vessel_id = uva.vessel_id
JOIN vessels v  ON v.id = p.vessel_id
JOIN organizations o ON o.id = v.organization_id
WHERE uva.user_id = $1 AND v.organization_id = $2
ORDER BY v.name, p.proposed_date NULLS LAST, p.created_at;

-- name: UserHasVesselAccess :one
SELECT EXISTS (
  SELECT 1 FROM user_vessel_access WHERE user_id = $1 AND vessel_id = $2
) AS has_access;
