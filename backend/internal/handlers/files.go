package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
	"github.com/nivyash/auditvault-backend/internal/email"
	"github.com/nivyash/auditvault-backend/internal/httpx"
	"github.com/nivyash/auditvault-backend/internal/storage"
)

// fileBriefDTO is the small shape included alongside projects on the Excel
// table screen. Just enough to render the download chip.
type fileBriefDTO struct {
	ID        string `json:"id"`
	FileName  string `json:"fileName"`
	FileType  string `json:"fileType"`
	FileSize  int64  `json:"fileSize"`
	Category  string `json:"category"`
	CreatedAt string `json:"createdAt"`
}

type fileDTO struct {
	fileBriefDTO
	UploadedByName string `json:"uploadedByName"`
}

func (a *API) ListProjectFiles(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if !a.userMaySeeProject(r, pid.Bytes) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}

	files, err := a.DB.Queries.ListFilesForProject(r.Context(), pid)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "list failed")
		return
	}
	c, _ := auth.FromContext(r.Context())
	isClient := auth.IsClientRole(c.Role)

	out := make([]fileDTO, 0, len(files))
	for _, f := range files {
		// Clients only see FINAL_REPORT and FEEDBACK.
		if isClient && f.Category != "FINAL_REPORT" && f.Category != "FEEDBACK" {
			continue
		}
		out = append(out, fileDTO{
			fileBriefDTO: fileBriefDTO{
				ID:        db.UUIDString(f.ID),
				FileName:  f.FileName,
				FileType:  db.PtrString(f.FileType),
				FileSize:  ptrInt64(f.FileSize),
				Category:  f.Category,
				CreatedAt: db.Time(f.CreatedAt).Format(time.RFC3339),
			},
			UploadedByName: f.UploadedByName,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"files": out})
}

// ----- Multipart upload flow ---------------------------------------------------

type uploadInitReq struct {
	FileName string `json:"fileName"`
	FileType string `json:"fileType"`
	FileSize int64  `json:"fileSize"`
	Category string `json:"category"`
}

type partURL struct {
	PartNumber int32  `json:"partNumber"`
	URL        string `json:"url"`
}

type uploadInitResp struct {
	FileID   string    `json:"fileId"`
	UploadID string    `json:"uploadId"`
	Key      string    `json:"key"`
	PartSize int64     `json:"partSize"`
	Parts    []partURL `json:"parts"`
}

// CreateUploadSession starts a multipart upload: validates permissions,
// inserts a PENDING file row, calls R2 to create the upload + presign part
// URLs, and returns the descriptor the client uploads against.
func (a *API) CreateUploadSession(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	c, err := auth.FromContext(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	var req uploadInitReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	req.FileName = strings.TrimSpace(req.FileName)
	if req.FileName == "" {
		httpx.WriteError(w, http.StatusBadRequest, "fileName is required")
		return
	}
	if req.FileSize <= 0 {
		httpx.WriteError(w, http.StatusBadRequest, "fileSize must be positive")
		return
	}
	if req.FileSize > a.Storage.MaxFileSize() {
		httpx.WriteError(w, http.StatusRequestEntityTooLarge,
			fmt.Sprintf("file too large (max %d bytes)", a.Storage.MaxFileSize()))
		return
	}
	if req.Category == "" {
		req.Category = "OTHER"
	}
	if !validFileCategory(req.Category) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid category")
		return
	}
	// Clients can only upload FEEDBACK.
	if auth.IsClientRole(c.Role) && req.Category != "FEEDBACK" {
		httpx.WriteError(w, http.StatusForbidden, "client users can only upload feedback files")
		return
	}
	if !a.userMaySeeProject(r, pid.Bytes) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}

	proj, err := a.DB.Queries.GetProject(r.Context(), pid)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "project lookup failed")
		return
	}

	// Insert the PENDING row first so we have a stable file id we can use
	// inside the R2 key. Easier than two-phase id generation.
	pf, err := a.DB.Queries.CreatePendingFile(r.Context(), sqlc.CreatePendingFileParams{
		ProjectID:    pid,
		FileName:     req.FileName,
		FileType:     db.StringPtr(req.FileType),
		FileSize:     int64Ptr(req.FileSize),
		Category:     req.Category,
		R2Key:        nil, // filled in below
		R2UploadID:   nil,
		UploadedByID: db.UUID(c.UserID),
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "create file row failed")
		return
	}

	key := buildR2Key(proj, pf.ID.Bytes, req.FileName)
	mp, err := a.Storage.StartMultipart(r.Context(), key, req.FileType, req.FileSize)
	if err != nil {
		// Clean up the orphaned DB row so the client can retry without
		// accumulating zombie pending rows.
		_ = a.DB.Queries.AbortPendingFile(r.Context(), pf.ID)
		httpx.WriteError(w, http.StatusBadGateway, "could not start upload: "+err.Error())
		return
	}

	// Persist key + uploadId so future "refresh part URL" and "complete"
	// calls can find them.
	if err := a.DB.Queries.SetFileR2Identifiers(r.Context(), sqlc.SetFileR2IdentifiersParams{
		ID:         pf.ID,
		R2Key:      &mp.Key,
		R2UploadID: &mp.UploadID,
	}); err != nil {
		_ = a.Storage.AbortMultipart(r.Context(), mp.Key, mp.UploadID)
		_ = a.DB.Queries.AbortPendingFile(r.Context(), pf.ID)
		httpx.WriteError(w, http.StatusInternalServerError, "could not persist upload session")
		return
	}

	parts := make([]partURL, len(mp.PartURLs))
	for i, p := range mp.PartURLs {
		parts[i] = partURL{PartNumber: p.PartNumber, URL: p.URL}
	}
	httpx.WriteJSON(w, http.StatusCreated, uploadInitResp{
		FileID:   db.UUIDString(pf.ID),
		UploadID: mp.UploadID,
		Key:      mp.Key,
		PartSize: mp.PartSize,
		Parts:    parts,
	})
}

// PresignPart returns a fresh presigned PUT URL for a single part. Used when
// the original URL has expired during a long upload.
func (a *API) PresignPart(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	fid, err := db.UUIDFromString(chi.URLParam(r, "fileId"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid fileId")
		return
	}
	partN, err := strconv.Atoi(chi.URLParam(r, "partNumber"))
	if err != nil || partN < 1 {
		httpx.WriteError(w, http.StatusBadRequest, "invalid partNumber")
		return
	}
	if !a.userMaySeeProject(r, pid.Bytes) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}

	f, err := a.DB.Queries.GetFile(r.Context(), fid)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	if f.Status != "PENDING" || db.PtrString(f.R2Key) == "" || db.PtrString(f.R2UploadID) == "" {
		httpx.WriteError(w, http.StatusConflict, "upload is not in progress")
		return
	}

	urlStr, err := a.Storage.PresignPart(r.Context(), db.PtrString(f.R2Key), db.PtrString(f.R2UploadID), int32(partN))
	if err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "could not refresh part url")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, partURL{PartNumber: int32(partN), URL: urlStr})
}

type completePart struct {
	PartNumber int32  `json:"partNumber"`
	ETag       string `json:"etag"`
}

type completeReq struct {
	Parts []completePart `json:"parts"`
}

// CompleteUpload finalises a multipart upload. The client supplies the
// (partNumber, etag) list collected from each part PUT response.
func (a *API) CompleteUpload(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	fid, err := db.UUIDFromString(chi.URLParam(r, "fileId"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid fileId")
		return
	}
	if !a.userMaySeeProject(r, pid.Bytes) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}

	var req completeReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	if len(req.Parts) == 0 {
		httpx.WriteError(w, http.StatusBadRequest, "no parts provided")
		return
	}

	f, err := a.DB.Queries.GetFile(r.Context(), fid)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	if f.Status != "PENDING" || db.PtrString(f.R2Key) == "" || db.PtrString(f.R2UploadID) == "" {
		httpx.WriteError(w, http.StatusConflict, "upload is not in progress")
		return
	}

	parts := make([]storage.Part, len(req.Parts))
	for i, p := range req.Parts {
		parts[i] = storage.Part{PartNumber: p.PartNumber, ETag: p.ETag}
	}
	if err := a.Storage.CompleteMultipart(r.Context(), db.PtrString(f.R2Key), db.PtrString(f.R2UploadID), parts); err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "complete failed: "+err.Error())
		return
	}

	updated, err := a.DB.Queries.CompleteFile(r.Context(), fid)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not mark file complete")
		return
	}

	c, _ := auth.FromContext(r.Context())
	id, _ := uuidFromPg(updated.ID)
	pidU, _ := uuidFromPg(updated.ProjectID)
	a.Audit.Log(r.Context(), c.UserID, "file.upload", "project_file", id, &pidU, map[string]any{
		"category": updated.Category, "fileName": updated.FileName,
	})

	// Email notifications for the two categories that have an outside audience.
	switch updated.Category {
	case "FINAL_REPORT":
		a.notify("file.final_report", func(ctx context.Context) {
			full, err := a.DB.Queries.GetProject(ctx, updated.ProjectID)
			if err != nil {
				return
			}
			to := a.recipientsForVessel(ctx, full.VesselID)
			t := email.FinalReportUploaded(full.VesselName, ProjectTypeLabels[full.ProjectType], updated.FileName)
			a.send(ctx, "file.final_report", to, t)
		})
	case "FEEDBACK":
		a.notify("file.feedback", func(ctx context.Context) {
			full, err := a.DB.Queries.GetProject(ctx, updated.ProjectID)
			if err != nil {
				return
			}
			to := a.recipientsForNivyash(ctx)
			t := email.FeedbackReceived(full.VesselName, ProjectTypeLabels[full.ProjectType], updated.FileName, full.OrganizationName)
			a.send(ctx, "file.feedback", to, t)
		})
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"file": fileBriefDTO{
		ID:        db.UUIDString(updated.ID),
		FileName:  updated.FileName,
		FileType:  db.PtrString(updated.FileType),
		FileSize:  ptrInt64(updated.FileSize),
		Category:  updated.Category,
		CreatedAt: db.Time(updated.CreatedAt).Format(time.RFC3339),
	}})
}

// AbortUpload cancels an in-progress multipart upload. Clients call this on
// dialog dismissal or fatal upload errors so we don't accumulate zombies.
func (a *API) AbortUpload(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	fid, err := db.UUIDFromString(chi.URLParam(r, "fileId"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid fileId")
		return
	}
	if !a.userMaySeeProject(r, pid.Bytes) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}

	f, err := a.DB.Queries.GetFile(r.Context(), fid)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	if f.Status != "PENDING" {
		httpx.WriteError(w, http.StatusConflict, "upload is not in progress")
		return
	}

	if k, u := db.PtrString(f.R2Key), db.PtrString(f.R2UploadID); k != "" && u != "" {
		_ = a.Storage.AbortMultipart(r.Context(), k, u)
	}
	_ = a.DB.Queries.AbortPendingFile(r.Context(), fid)
	httpx.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// DownloadFile redirects to a fresh short-lived presigned R2 URL.
func (a *API) DownloadFile(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	fid, err := db.UUIDFromString(chi.URLParam(r, "fileId"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid fileId")
		return
	}
	if !a.userMaySeeProject(r, pid.Bytes) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}

	f, err := a.DB.Queries.GetFile(r.Context(), fid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	if f.DeletedAt.Valid {
		httpx.WriteError(w, http.StatusGone, "file has been deleted")
		return
	}
	if f.Status != "COMPLETE" || db.PtrString(f.R2Key) == "" {
		httpx.WriteError(w, http.StatusFailedDependency, "file upload not completed")
		return
	}

	c, _ := auth.FromContext(r.Context())
	if auth.IsClientRole(c.Role) && f.Category != "FINAL_REPORT" && f.Category != "FEEDBACK" {
		httpx.WriteError(w, http.StatusForbidden, "forbidden")
		return
	}

	url, err := a.Storage.PresignGet(r.Context(), db.PtrString(f.R2Key), f.FileName, 5*time.Minute)
	if err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "could not sign download url")
		return
	}

	id, _ := uuidFromPg(f.ID)
	pidU, _ := uuidFromPg(f.ProjectID)
	a.Audit.Log(r.Context(), c.UserID, "file.download", "project_file", id, &pidU, nil)

	http.Redirect(w, r, url, http.StatusFound)
}

// SoftDeleteFile flips deleted_at on the row. The R2 object is intentionally
// retained — admins might want to restore later, and storage is cheap.
// Admin-only.
func (a *API) SoftDeleteFile(w http.ResponseWriter, r *http.Request) {
	pid, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	fid, err := db.UUIDFromString(chi.URLParam(r, "fileId"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid fileId")
		return
	}
	if !a.userMaySeeProject(r, pid.Bytes) {
		httpx.WriteError(w, http.StatusNotFound, "not found")
		return
	}

	c, _ := auth.FromContext(r.Context())
	row, err := a.DB.Queries.SoftDeleteFile(r.Context(), sqlc.SoftDeleteFileParams{
		ID:          fid,
		DeletedByID: db.UUID(c.UserID),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "delete failed")
		return
	}
	id, _ := uuidFromPg(row.ID)
	pidU, _ := uuidFromPg(row.ProjectID)
	a.Audit.Log(r.Context(), c.UserID, "file.soft_delete", "project_file", id, &pidU, map[string]any{
		"fileName": row.FileName,
	})
	httpx.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ----- Helpers -----------------------------------------------------------------

// buildR2Key returns the canonical object key for a file. Layout:
//
//	{orgId}/{vesselId}/{projectId}/{fileId}/{filename}
//
// Putting the file id in the path means same-named files don't collide; the
// trailing filename keeps the path readable when an admin browses the bucket.
func buildR2Key(p sqlc.GetProjectRow, fileID [16]byte, fileName string) string {
	return strings.Join([]string{
		formatUUIDBytes(p.OrganizationID.Bytes),
		formatUUIDBytes(p.VesselID.Bytes),
		formatUUIDBytes(p.ID.Bytes),
		formatUUIDBytes(fileID),
		safeFileName(fileName),
	}, "/")
}

// safeFileName strips characters that confuse filesystems / Content-Disposition.
func safeFileName(s string) string {
	bad := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|", "#", "%"}
	for _, b := range bad {
		s = strings.ReplaceAll(s, b, "_")
	}
	return strings.TrimSpace(s)
}

func formatUUIDBytes(b [16]byte) string {
	const hex = "0123456789abcdef"
	out := make([]byte, 36)
	for i, j := 0, 0; i < 16; i++ {
		switch i {
		case 4, 6, 8, 10:
			out[j] = '-'
			j++
		}
		out[j] = hex[b[i]>>4]
		out[j+1] = hex[b[i]&0x0f]
		j += 2
	}
	return string(out)
}

func int64Ptr(n int64) *int64 {
	if n == 0 {
		return nil
	}
	return &n
}

func ptrInt64(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}
