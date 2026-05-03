package handlers

import (
	"net/http"
	"strconv"

	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
	"github.com/nivyash/auditvault-backend/internal/httpx"
)

type auditLogDTO struct {
	ID         string `json:"id"`
	UserID     string `json:"userId"`
	UserName   string `json:"userName"`
	UserEmail  string `json:"userEmail"`
	Action     string `json:"action"`
	EntityType string `json:"entityType"`
	EntityID   string `json:"entityId"`
	ProjectID  string `json:"projectId,omitempty"`
	Metadata   string `json:"metadata,omitempty"`
	CreatedAt  string `json:"createdAt"`
}

func (a *API) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	limit := parseIntDefault(r.URL.Query().Get("limit"), 100)
	offset := parseIntDefault(r.URL.Query().Get("offset"), 0)
	if limit > 500 {
		limit = 500
	}
	rows, err := a.DB.Queries.ListAuditLogs(r.Context(), sqlc.ListAuditLogsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	out := make([]auditLogDTO, 0, len(rows))
	for _, l := range rows {
		out = append(out, auditLogDTO{
			ID:         db.UUIDString(l.ID),
			UserID:     db.UUIDString(l.UserID),
			UserName:   l.UserName,
			UserEmail:  l.UserEmail,
			Action:     l.Action,
			EntityType: l.EntityType,
			EntityID:   db.UUIDString(l.EntityID),
			ProjectID:  db.UUIDString(l.ProjectID),
			Metadata:   string(l.MetadataJson),
			CreatedAt:  db.Time(l.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"logs": out})
}

func parseIntDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 0 {
		return def
	}
	return n
}
