package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/httpx"
)

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type sessionUser struct {
	ID               string `json:"id"`
	Email            string `json:"email"`
	Name             string `json:"name"`
	Role             string `json:"role"`
	OrganizationID   string `json:"organizationId"`
	OrganizationName string `json:"organizationName"`
	OrganizationType string `json:"organizationType"`
}

type loginResp struct {
	Token     string      `json:"token"`
	ExpiresAt time.Time   `json:"expiresAt"`
	User      sessionUser `json:"user"`
}

func (a *API) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		httpx.WriteError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	user, err := a.DB.Queries.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	if !auth.ComparePassword(user.PasswordHash, req.Password) {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	org, err := a.DB.Queries.GetOrganization(r.Context(), user.OrganizationID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "org lookup failed")
		return
	}

	uid, _ := uuid.FromBytes(user.ID.Bytes[:])
	oid, _ := uuid.FromBytes(user.OrganizationID.Bytes[:])

	token, expiresAt, err := auth.IssueToken(a.Cfg.JWTSecret, uid, oid, user.Role)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not sign token")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, loginResp{
		Token:     token,
		ExpiresAt: expiresAt,
		User: sessionUser{
			ID:               db.UUIDString(user.ID),
			Email:            user.Email,
			Name:             user.Name,
			Role:             user.Role,
			OrganizationID:   db.UUIDString(user.OrganizationID),
			OrganizationName: org.Name,
			OrganizationType: org.Type,
		},
	})
}

func (a *API) Logout(w http.ResponseWriter, r *http.Request) {
	// JWT revocation isn't implemented in v1. The frontend's session cookie
	// proxy clears the cookie; this endpoint exists so the frontend has a
	// thing to call and we can audit the action later if we want.
	httpx.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *API) Me(w http.ResponseWriter, r *http.Request) {
	c, err := auth.FromContext(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	u, err := a.DB.Queries.GetUserByID(r.Context(), db.UUID(c.UserID))
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "user not found")
		return
	}
	org, err := a.DB.Queries.GetOrganization(r.Context(), u.OrganizationID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "org lookup failed")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sessionUser{
		ID:               db.UUIDString(u.ID),
		Email:            u.Email,
		Name:             u.Name,
		Role:             u.Role,
		OrganizationID:   db.UUIDString(u.OrganizationID),
		OrganizationName: org.Name,
		OrganizationType: org.Type,
	})
}
