-- name: ListVessels :many
SELECT v.id, v.name, v.imo_number, v.flag, v.vessel_type, v.organization_id, v.created_at,
       o.name AS organization_name
FROM vessels v
JOIN organizations o ON o.id = v.organization_id
ORDER BY v.name;

-- name: ListVesselsByOrg :many
SELECT v.id, v.name, v.imo_number, v.flag, v.vessel_type, v.organization_id, v.created_at,
       o.name AS organization_name
FROM vessels v
JOIN organizations o ON o.id = v.organization_id
WHERE v.organization_id = $1
ORDER BY v.name;

-- name: GetVessel :one
SELECT v.id, v.name, v.imo_number, v.flag, v.vessel_type, v.organization_id, v.created_at,
       o.name AS organization_name
FROM vessels v
JOIN organizations o ON o.id = v.organization_id
WHERE v.id = $1;

-- name: CreateVessel :one
INSERT INTO vessels (name, imo_number, flag, vessel_type, organization_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, imo_number, flag, vessel_type, organization_id, created_at;
