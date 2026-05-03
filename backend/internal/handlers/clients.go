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

type clientDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	VesselCount int    `json:"vesselCount"`
	UserCount   int    `json:"userCount"`
}

func (a *API) ListClients(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Queries.ListClientOrganizations(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	out := make([]clientDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, clientDTO{
			ID:          db.UUIDString(row.ID),
			Name:        row.Name,
			Type:        row.Type,
			VesselCount: int(row.VesselCount),
			UserCount:   int(row.UserCount),
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"clients": out})
}

type createClientReq struct {
	Name string `json:"name"`
}

func (a *API) CreateClient(w http.ResponseWriter, r *http.Request) {
	var req createClientReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "name is required")
		return
	}
	org, err := a.DB.Queries.CreateOrganization(r.Context(), sqlc.CreateOrganizationParams{
		Name: req.Name,
		Type: "CLIENT",
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "create failed")
		return
	}
	c, _ := auth.FromContext(r.Context())
	id, _ := uuidFromPg(org.ID)
	a.Audit.Log(r.Context(), c.UserID, "client.create", "organization", id, nil, map[string]any{"name": org.Name})
	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"client": clientDTO{ID: db.UUIDString(org.ID), Name: org.Name, Type: org.Type},
	})
}

type clientDetailDTO struct {
	clientDTO
	Vessels []vesselDTO `json:"vessels"`
	Users   []userBrief `json:"users"`
}

type userBrief struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

func (a *API) GetClient(w http.ResponseWriter, r *http.Request) {
	id, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	org, err := a.DB.Queries.GetClientOrganizationDetail(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "lookup failed")
		return
	}

	vessels, err := a.DB.Queries.ListVesselsByOrg(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "vessels failed")
		return
	}
	users, err := a.DB.Queries.ListUsersByOrg(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "users failed")
		return
	}

	resp := clientDetailDTO{
		clientDTO: clientDTO{
			ID:          db.UUIDString(org.ID),
			Name:        org.Name,
			Type:        org.Type,
			VesselCount: len(vessels),
			UserCount:   len(users),
		},
	}
	for _, v := range vessels {
		resp.Vessels = append(resp.Vessels, vesselDTO{
			ID:               db.UUIDString(v.ID),
			Name:             v.Name,
			IMONumber:        db.PtrString(v.ImoNumber),
			Flag:             db.PtrString(v.Flag),
			VesselType:       db.PtrString(v.VesselType),
			OrganizationID:   db.UUIDString(v.OrganizationID),
			OrganizationName: v.OrganizationName,
		})
	}
	for _, u := range users {
		resp.Users = append(resp.Users, userBrief{
			ID:    db.UUIDString(u.ID),
			Name:  u.Name,
			Email: u.Email,
			Role:  u.Role,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"client": resp})
}
