package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
	"github.com/nivyash/auditvault-backend/internal/httpx"
)

// ListUserVessels returns the vessels the user has been granted access to.
// Admin-only.
func (a *API) ListUserVessels(w http.ResponseWriter, r *http.Request) {
	uid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	rows, err := a.DB.Queries.ListAccessibleVesselsForUser(r.Context(), uid)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	out := make([]vesselDTO, 0, len(rows))
	for _, v := range rows {
		out = append(out, vesselDTO{
			ID:               db.UUIDString(v.ID),
			Name:             v.Name,
			IMONumber:        db.PtrString(v.ImoNumber),
			Flag:             db.PtrString(v.Flag),
			VesselType:       db.PtrString(v.VesselType),
			OrganizationID:   db.UUIDString(v.OrganizationID),
			OrganizationName: v.OrganizationName,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"vessels": out})
}

type setUserVesselsReq struct {
	VesselIDs []string `json:"vesselIds"`
}

// SetUserVessels replaces the user's grant set with the given vessel ids.
// Admin-only. This is the simplest UX: send the full list, server diffs.
func (a *API) SetUserVessels(w http.ResponseWriter, r *http.Request) {
	uid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req setUserVesselsReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}

	c, _ := auth.FromContext(r.Context())

	// Replace-set semantics: clear, then re-grant.
	if err := a.DB.Queries.RevokeAllVesselAccessForUser(r.Context(), uid); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "revoke failed")
		return
	}
	for _, vidStr := range req.VesselIDs {
		vid, err := db.UUIDFromString(vidStr)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid vessel id: "+vidStr)
			return
		}
		if err := a.DB.Queries.GrantVesselAccess(r.Context(), sqlc.GrantVesselAccessParams{
			UserID:      uid,
			VesselID:    vid,
			GrantedByID: db.UUID(c.UserID),
		}); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "grant failed")
			return
		}
	}

	uidU, _ := uuidFromPg(uid)
	a.Audit.Log(r.Context(), c.UserID, "user.vessels.set", "user", uidU, nil, map[string]any{
		"vessel_count": len(req.VesselIDs),
	})

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"vesselIds": req.VesselIDs})
}
