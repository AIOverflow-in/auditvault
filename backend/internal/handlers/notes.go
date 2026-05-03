package handlers

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
	"github.com/nivyash/auditvault-backend/internal/httpx"
)

type noteDTO struct {
	ID         string `json:"id"`
	Body       string `json:"body"`
	AuthorID   string `json:"authorId"`
	AuthorName string `json:"authorName"`
	CreatedAt  string `json:"createdAt"`
}

func (a *API) ListNotes(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	rows, err := a.DB.Queries.ListNotesForProject(r.Context(), pid)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	out := make([]noteDTO, 0, len(rows))
	for _, n := range rows {
		out = append(out, noteDTO{
			ID:         db.UUIDString(n.ID),
			Body:       n.Body,
			AuthorID:   db.UUIDString(n.AuthorID),
			AuthorName: n.AuthorName,
			CreatedAt:  db.Time(n.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"notes": out})
}

type createNoteReq struct {
	Body string `json:"body"`
}

func (a *API) CreateNote(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req createNoteReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" {
		httpx.WriteError(w, http.StatusBadRequest, "body is required")
		return
	}

	c, _ := auth.FromContext(r.Context())
	n, err := a.DB.Queries.CreateNote(r.Context(), sqlc.CreateNoteParams{
		ProjectID: pid,
		Body:      body,
		AuthorID:  db.UUID(c.UserID),
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "create failed")
		return
	}
	id, _ := uuidFromPg(n.ID)
	pidU, _ := uuidFromPg(n.ProjectID)
	a.Audit.Log(r.Context(), c.UserID, "note.create", "project_note", id, &pidU, nil)
	httpx.WriteJSON(w, http.StatusCreated, map[string]any{"note": noteDTO{
		ID:        db.UUIDString(n.ID),
		Body:      n.Body,
		AuthorID:  db.UUIDString(n.AuthorID),
		CreatedAt: db.Time(n.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
	}})
}
