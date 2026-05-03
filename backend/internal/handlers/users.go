package handlers

import (
	"net/http"
	"strings"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
	"github.com/nivyash/auditvault-backend/internal/httpx"
)

type userDTO struct {
	ID               string `json:"id"`
	Email            string `json:"email"`
	Name             string `json:"name"`
	Role             string `json:"role"`
	OrganizationID   string `json:"organizationId"`
	OrganizationName string `json:"organizationName"`
	OrganizationType string `json:"organizationType"`
	CreatedAt        string `json:"createdAt"`
}

func (a *API) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Queries.ListUsers(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	out := make([]userDTO, 0, len(rows))
	for _, u := range rows {
		out = append(out, userDTO{
			ID:               db.UUIDString(u.ID),
			Email:            u.Email,
			Name:             u.Name,
			Role:             u.Role,
			OrganizationID:   db.UUIDString(u.OrganizationID),
			OrganizationName: u.OrganizationName,
			OrganizationType: u.OrganizationType,
			CreatedAt:        db.Time(u.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"users": out})
}

type createUserReq struct {
	Email          string   `json:"email"`
	Name           string   `json:"name"`
	Password       string   `json:"password"`
	Role           string   `json:"role"`
	OrganizationID string   `json:"organizationId"`
	VesselIDs      []string `json:"vesselIds"` // optional initial grants for client users
}

func (a *API) CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	var req createUserReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Name == "" || req.Password == "" {
		httpx.WriteError(w, http.StatusBadRequest, "email, name and password are required")
		return
	}
	if len(req.Password) < 8 {
		httpx.WriteError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	switch req.Role {
	case auth.RoleAdmin, auth.RoleStaff, auth.RoleClientAdmin, auth.RoleClientViewer:
	default:
		httpx.WriteError(w, http.StatusBadRequest, "invalid role")
		return
	}
	orgID, err := db.UUIDFromString(req.OrganizationID)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "organizationId is required")
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "hash failed")
		return
	}
	u, err := a.DB.Queries.CreateUser(r.Context(), sqlc.CreateUserParams{
		Email:          req.Email,
		Name:           req.Name,
		PasswordHash:   hash,
		Role:           req.Role,
		OrganizationID: orgID,
	})
	if err != nil {
		// duplicate email surfaces here; surface a friendlier message
		httpx.WriteError(w, http.StatusBadRequest, "could not create user (email may already exist)")
		return
	}
	c, _ := auth.FromContext(r.Context())
	id, _ := uuidFromPg(u.ID)

	// Apply initial vessel grants for client users, if any.
	if len(req.VesselIDs) > 0 && auth.IsClientRole(u.Role) {
		for _, vidStr := range req.VesselIDs {
			vid, err := db.UUIDFromString(vidStr)
			if err != nil {
				continue
			}
			_ = a.DB.Queries.GrantVesselAccess(r.Context(), sqlc.GrantVesselAccessParams{
				UserID:      u.ID,
				VesselID:    vid,
				GrantedByID: db.UUID(c.UserID),
			})
		}
	}

	a.Audit.Log(r.Context(), c.UserID, "user.create", "user", id, nil, map[string]any{
		"role": u.Role, "vesselGrants": len(req.VesselIDs),
	})
	httpx.WriteJSON(w, http.StatusCreated, map[string]any{"user": userDTO{
		ID:             db.UUIDString(u.ID),
		Email:          u.Email,
		Name:           u.Name,
		Role:           u.Role,
		OrganizationID: db.UUIDString(u.OrganizationID),
		CreatedAt:      db.Time(u.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
	}})
}
