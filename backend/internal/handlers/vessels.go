package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
	"github.com/nivyash/auditvault-backend/internal/httpx"
)

type vesselDTO struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	IMONumber        string `json:"imoNumber"`
	Flag             string `json:"flag"`
	VesselType       string `json:"vesselType"`
	OrganizationID   string `json:"organizationId"`
	OrganizationName string `json:"organizationName"`
}

func (a *API) ListVessels(w http.ResponseWriter, r *http.Request) {
	c, err := auth.FromContext(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	var rows []sqlc.ListVesselsRow
	if auth.IsClientRole(c.Role) {
		// Client users only see vessels Nivyash explicitly granted them.
		clientRows, err := a.DB.Queries.ListAccessibleVesselsForUser(r.Context(), db.UUID(c.UserID))
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "list failed")
			return
		}
		for _, v := range clientRows {
			rows = append(rows, sqlc.ListVesselsRow(v))
		}
	} else {
		rows, err = a.DB.Queries.ListVessels(r.Context())
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "list failed")
			return
		}
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

type createVesselReq struct {
	Name           string `json:"name"`
	IMONumber      string `json:"imoNumber"`
	Flag           string `json:"flag"`
	VesselType     string `json:"vesselType"`
	OrganizationID string `json:"organizationId"`
}

func (a *API) CreateVessel(w http.ResponseWriter, r *http.Request) {
	var req createVesselReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "name is required")
		return
	}
	orgID, err := db.UUIDFromString(req.OrganizationID)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "organizationId is required")
		return
	}
	v, err := a.DB.Queries.CreateVessel(r.Context(), sqlc.CreateVesselParams{
		Name:           req.Name,
		ImoNumber:      db.StringPtr(strings.TrimSpace(req.IMONumber)),
		Flag:           db.StringPtr(strings.TrimSpace(req.Flag)),
		VesselType:     db.StringPtr(strings.TrimSpace(req.VesselType)),
		OrganizationID: orgID,
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "create failed")
		return
	}
	c, _ := auth.FromContext(r.Context())
	id, _ := uuidFromPg(v.ID)
	a.Audit.Log(r.Context(), c.UserID, "vessel.create", "vessel", id, nil, map[string]any{"name": v.Name})
	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"vessel": vesselDTO{
			ID:             db.UUIDString(v.ID),
			Name:           v.Name,
			IMONumber:      db.PtrString(v.ImoNumber),
			Flag:           db.PtrString(v.Flag),
			VesselType:     db.PtrString(v.VesselType),
			OrganizationID: db.UUIDString(v.OrganizationID),
		},
	})
}

func (a *API) GetVessel(w http.ResponseWriter, r *http.Request) {
	id, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	v, err := a.DB.Queries.GetVessel(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "lookup failed")
		return
	}

	c, _ := auth.FromContext(r.Context())
	if auth.IsClientRole(c.Role) {
		ok, err := a.DB.Queries.UserHasVesselAccess(r.Context(), sqlc.UserHasVesselAccessParams{
			UserID:   db.UUID(c.UserID),
			VesselID: id,
		})
		if err != nil || !ok {
			httpx.WriteError(w, http.StatusNotFound, "not found")
			return
		}
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"vessel": vesselDTO{
			ID:               db.UUIDString(v.ID),
			Name:             v.Name,
			IMONumber:        db.PtrString(v.ImoNumber),
			Flag:             db.PtrString(v.Flag),
			VesselType:       db.PtrString(v.VesselType),
			OrganizationID:   db.UUIDString(v.OrganizationID),
			OrganizationName: v.OrganizationName,
		},
	})
}
