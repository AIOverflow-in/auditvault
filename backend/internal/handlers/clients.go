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

	// Per-tenant scoping for client users. Cross-tenant lookups return 404
	// rather than 403 so they can't probe whether other client orgs exist.
	c, _ := auth.FromContext(r.Context())
	isClient := auth.IsClientRole(c.Role)
	if isClient && c.OrganizationID.String() != db.UUIDString(id) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
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

	// For Nivyash users: every vessel in the client. For client users: only
	// the vessels they have a grant on — listing ships they can't actually
	// open is confusing and leaks slightly more topology than they need.
	var vesselsList []sqlc.ListVesselsRow
	if isClient {
		rows, err := a.DB.Queries.ListAccessibleVesselsForUser(r.Context(), db.UUID(c.UserID))
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "vessels failed")
			return
		}
		// Filter to this client's org (the access query returns vessels
		// across all orgs the user has grants on; for clients that's just
		// their own, but be defensive).
		for _, v := range rows {
			if db.UUIDString(v.OrganizationID) == db.UUIDString(id) {
				vesselsList = append(vesselsList, sqlc.ListVesselsRow(v))
			}
		}
	} else {
		rows, err := a.DB.Queries.ListVesselsByOrg(r.Context(), id)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "vessels failed")
			return
		}
		for _, v := range rows {
			vesselsList = append(vesselsList, sqlc.ListVesselsRow(v))
		}
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
			VesselCount: len(vesselsList),
			UserCount:   len(users),
		},
	}
	for _, v := range vesselsList {
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
