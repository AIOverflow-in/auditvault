package handlers

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
)

// userMaySeeProject reports whether the authenticated user is allowed to read
// the given project. Nivyash (admin/staff) sees all; client users see only
// projects whose vessel they have been granted access to via the
// user_vessel_access table.
func (a *API) userMaySeeProject(r *http.Request, pidBytes [16]byte) bool {
	c, err := auth.FromContext(r.Context())
	if err != nil {
		return false
	}
	if auth.IsNivyashRole(c.Role) {
		return true
	}
	pid := pgtype.UUID{Bytes: pidBytes, Valid: true}
	p, err := a.DB.Queries.GetProject(r.Context(), pid)
	if err != nil {
		return false
	}
	ok, err := a.DB.Queries.UserHasVesselAccess(r.Context(), sqlc.UserHasVesselAccessParams{
		UserID:   db.UUID(c.UserID),
		VesselID: p.VesselID,
	})
	return err == nil && ok
}

