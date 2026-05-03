-- Recipients for email notifications. Kept in their own file so the email
-- triggers can find what they need without going through generic user/vessel
-- queries.

-- name: ListUsersWithVesselAccess :many
-- All users (admin or viewer) who currently have a grant on this vessel.
SELECT u.id, u.email, u.name, u.role
FROM users u
JOIN user_vessel_access uva ON uva.user_id = u.id
WHERE uva.vessel_id = $1
ORDER BY u.email;

-- name: ListNivyashUsers :many
-- Nivyash internal users — admin and staff. Used to alert the office when a
-- client uploads feedback.
SELECT u.id, u.email, u.name, u.role
FROM users u
JOIN organizations o ON o.id = u.organization_id
WHERE o.type = 'NIVYASH'
ORDER BY u.email;
