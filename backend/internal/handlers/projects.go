package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
	"github.com/nivyash/auditvault-backend/internal/email"
	"github.com/nivyash/auditvault-backend/internal/httpx"
)

type projectDTO struct {
	ID               string `json:"id"`
	VesselID         string `json:"vesselId"`
	VesselName       string `json:"vesselName"`
	VesselIMO        string `json:"vesselImo"`
	OrganizationID   string `json:"organizationId"`
	OrganizationName string `json:"organizationName"`
	ProjectType      string `json:"projectType"`
	Region           string `json:"region"`
	ProposedDate     string `json:"proposedDate"`
	ActualDate       string `json:"actualDate"`
	Stage            string `json:"stage"`
	Remarks          string `json:"remarks,omitempty"`
	CreatedByID      string `json:"createdById"`
	CreatedAt        string `json:"createdAt"`
	UpdatedAt        string `json:"updatedAt"`
}

// projectRowDTO is what /clients/[id] expects: a project plus its currently
// "live" report and feedback files (so the table can render Upload-or-Download).
type projectRowDTO struct {
	projectDTO
	FinalReports []fileBriefDTO `json:"finalReports"`
	Feedback     []fileBriefDTO `json:"feedback"`
}

func (a *API) ListProjects(w http.ResponseWriter, r *http.Request) {
	c, err := auth.FromContext(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}

	clientIDQ := r.URL.Query().Get("clientId")
	vesselIDQ := r.URL.Query().Get("vesselId")

	var rows []sqlc.ListAllProjectsRow
	switch {
	case auth.IsClientRole(c.Role):
		// Client users only see projects whose vessel they've been granted.
		if clientIDQ != "" {
			oid, perr := db.UUIDFromString(clientIDQ)
			if perr != nil {
				httpx.WriteError(w, http.StatusBadRequest, "invalid clientId")
				return
			}
			r2, err := a.DB.Queries.ListAccessibleProjectsForUserInOrg(r.Context(), sqlc.ListAccessibleProjectsForUserInOrgParams{
				UserID:         db.UUID(c.UserID),
				OrganizationID: oid,
			})
			if err != nil {
				httpx.WriteError(w, http.StatusInternalServerError, "list failed")
				return
			}
			for _, p := range r2 {
				rows = append(rows, sqlc.ListAllProjectsRow(p))
			}
		} else {
			r2, err := a.DB.Queries.ListAccessibleProjectsForUser(r.Context(), db.UUID(c.UserID))
			if err != nil {
				httpx.WriteError(w, http.StatusInternalServerError, "list failed")
				return
			}
			for _, p := range r2 {
				rows = append(rows, sqlc.ListAllProjectsRow(p))
			}
		}
	case clientIDQ != "":
		oid, err := db.UUIDFromString(clientIDQ)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid clientId")
			return
		}
		r2, err := a.DB.Queries.ListProjectsByOrg(r.Context(), oid)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "list failed")
			return
		}
		for _, p := range r2 {
			rows = append(rows, sqlc.ListAllProjectsRow(p))
		}
	case vesselIDQ != "":
		vid, err := db.UUIDFromString(vesselIDQ)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid vesselId")
			return
		}
		r2, err := a.DB.Queries.ListProjectsByVessel(r.Context(), vid)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "list failed")
			return
		}
		for _, p := range r2 {
			rows = append(rows, sqlc.ListAllProjectsRow(p))
		}
	default:
		rows, err = a.DB.Queries.ListAllProjects(r.Context())
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "list failed")
			return
		}
	}

	// fetch files for the matching project ids in a single query
	pids := make([]pgtype.UUID, 0, len(rows))
	for _, p := range rows {
		pids = append(pids, p.ID)
	}
	files, err := a.DB.Queries.ListFilesForProjects(r.Context(), pids)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "files failed")
		return
	}
	byProject := make(map[string][]sqlc.ListFilesForProjectsRow)
	for _, f := range files {
		byProject[db.UUIDString(f.ProjectID)] = append(byProject[db.UUIDString(f.ProjectID)], f)
	}

	isClient := auth.IsClientRole(c.Role)
	out := make([]projectRowDTO, 0, len(rows))
	for _, p := range rows {
		// Pre-initialise the inline file slices so JSON marshals them as []
		// (not null) when a project has no reports / no feedback yet. The
		// frontend already defends with `?? []`, but consistent shapes save
		// future surprises.
		row := projectRowDTO{
			projectDTO:   dtoFromAllProjectsRow(p, isClient),
			FinalReports: []fileBriefDTO{},
			Feedback:     []fileBriefDTO{},
		}
		for _, f := range byProject[db.UUIDString(p.ID)] {
			brief := fileBriefDTO{
				ID:        db.UUIDString(f.ID),
				FileName:  f.FileName,
				FileType:  db.PtrString(f.FileType),
				FileSize:  ptrInt64(f.FileSize),
				Category:  f.Category,
				CreatedAt: db.Time(f.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
			}
			switch f.Category {
			case "FINAL_REPORT":
				row.FinalReports = append(row.FinalReports, brief)
			case "FEEDBACK":
				row.Feedback = append(row.Feedback, brief)
			}
		}
		out = append(out, row)
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"projects": out})
}

func dtoFromAllProjectsRow(p sqlc.ListAllProjectsRow, hideRemarks bool) projectDTO {
	d := projectDTO{
		ID:               db.UUIDString(p.ID),
		VesselID:         db.UUIDString(p.VesselID),
		VesselName:       p.VesselName,
		VesselIMO:        db.PtrString(p.VesselImo),
		OrganizationID:   db.UUIDString(p.OrganizationID),
		OrganizationName: p.OrganizationName,
		ProjectType:      p.ProjectType,
		Region:           db.PtrString(p.Region),
		ProposedDate:     db.Date(p.ProposedDate),
		ActualDate:       db.Date(p.ActualDate),
		Stage:            p.Stage,
		CreatedByID:      db.UUIDString(p.CreatedByID),
		CreatedAt:        db.Time(p.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:        db.Time(p.UpdatedAt).Format("2006-01-02T15:04:05Z07:00"),
	}
	if !hideRemarks {
		d.Remarks = db.PtrString(p.Remarks)
	}
	return d
}

type createProjectReq struct {
	VesselID     string `json:"vesselId"`
	ProjectType  string `json:"projectType"`
	Region       string `json:"region"`
	ProposedDate string `json:"proposedDate"`
	Remarks      string `json:"remarks"`
}

func (a *API) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req createProjectReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	vid, err := db.UUIDFromString(req.VesselID)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "vesselId is required")
		return
	}
	if !validProjectType(req.ProjectType) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid projectType")
		return
	}
	pd, err := db.DateFromString(req.ProposedDate)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "proposedDate must be YYYY-MM-DD")
		return
	}

	c, _ := auth.FromContext(r.Context())
	p, err := a.DB.Queries.CreateProject(r.Context(), sqlc.CreateProjectParams{
		VesselID:     vid,
		ProjectType:  req.ProjectType,
		Region:       db.StringPtr(strings.TrimSpace(req.Region)),
		ProposedDate: pd,
		Column5:      nil, // sqlc-named slot for stage; nil triggers COALESCE default 'ENQUIRY'
		Remarks:      db.StringPtr(strings.TrimSpace(req.Remarks)),
		CreatedByID:  db.UUID(c.UserID),
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "create failed")
		return
	}
	id, _ := uuidFromPg(p.ID)
	a.Audit.Log(r.Context(), c.UserID, "project.create", "project", id, &id, nil)

	// Notify granted client users that a new audit has been opened for this ship.
	a.notify("project.create", func(ctx context.Context) {
		full, err := a.DB.Queries.GetProject(ctx, p.ID)
		if err != nil {
			return
		}
		to := a.recipientsForVessel(ctx, p.VesselID)
		t := email.NewProject(full.VesselName, ProjectTypeLabels[full.ProjectType], db.PtrString(full.Region), db.Date(full.ProposedDate))
		a.send(ctx, "project.create", to, t)
	})

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{"project": dtoFromProject(p, false)})
}

func dtoFromProject(p sqlc.Project, hideRemarks bool) projectDTO {
	d := projectDTO{
		ID:           db.UUIDString(p.ID),
		VesselID:     db.UUIDString(p.VesselID),
		ProjectType:  p.ProjectType,
		Region:       db.PtrString(p.Region),
		ProposedDate: db.Date(p.ProposedDate),
		ActualDate:   db.Date(p.ActualDate),
		Stage:        p.Stage,
		CreatedByID:  db.UUIDString(p.CreatedByID),
		CreatedAt:    db.Time(p.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    db.Time(p.UpdatedAt).Format("2006-01-02T15:04:05Z07:00"),
	}
	if !hideRemarks {
		d.Remarks = db.PtrString(p.Remarks)
	}
	return d
}

func (a *API) GetProject(w http.ResponseWriter, r *http.Request) {
	id, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	p, err := a.DB.Queries.GetProject(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	c, _ := auth.FromContext(r.Context())
	// SECURITY: client users must have an explicit per-vessel grant. Old code
	// here checked organisation-level scoping only — that let a CLIENT_VIEWER
	// on a multi-ship company read projects on ships the admin had not
	// granted them. Use the same per-vessel access check used by the file
	// and list endpoints.
	if auth.IsClientRole(c.Role) {
		ok, err := a.DB.Queries.UserHasVesselAccess(r.Context(), sqlc.UserHasVesselAccessParams{
			UserID:   db.UUID(c.UserID),
			VesselID: p.VesselID,
		})
		if err != nil || !ok {
			httpx.WriteError(w, http.StatusNotFound, "not found")
			return
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"project": dtoFromGetProjectRow(p, auth.IsClientRole(c.Role)),
	})
}

func dtoFromGetProjectRow(p sqlc.GetProjectRow, hideRemarks bool) projectDTO {
	d := projectDTO{
		ID:               db.UUIDString(p.ID),
		VesselID:         db.UUIDString(p.VesselID),
		VesselName:       p.VesselName,
		VesselIMO:        db.PtrString(p.VesselImo),
		OrganizationID:   db.UUIDString(p.OrganizationID),
		OrganizationName: p.OrganizationName,
		ProjectType:      p.ProjectType,
		Region:           db.PtrString(p.Region),
		ProposedDate:     db.Date(p.ProposedDate),
		ActualDate:       db.Date(p.ActualDate),
		Stage:            p.Stage,
		CreatedByID:      db.UUIDString(p.CreatedByID),
		CreatedAt:        db.Time(p.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:        db.Time(p.UpdatedAt).Format("2006-01-02T15:04:05Z07:00"),
	}
	if !hideRemarks {
		d.Remarks = db.PtrString(p.Remarks)
	}
	return d
}

type patchProjectReq struct {
	Region       *string `json:"region"`
	ProposedDate *string `json:"proposedDate"`
	ActualDate   *string `json:"actualDate"`
}

func (a *API) PatchProject(w http.ResponseWriter, r *http.Request) {
	id, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req patchProjectReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	var region *string
	if req.Region != nil {
		v := strings.TrimSpace(*req.Region)
		region = &v
	}
	var proposed pgtype.Date
	if req.ProposedDate != nil {
		proposed, err = db.DateFromString(*req.ProposedDate)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "proposedDate must be YYYY-MM-DD")
			return
		}
	}
	var actual pgtype.Date
	if req.ActualDate != nil {
		actual, err = db.DateFromString(*req.ActualDate)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "actualDate must be YYYY-MM-DD")
			return
		}
	}
	p, err := a.DB.Queries.UpdateProjectMeta(r.Context(), sqlc.UpdateProjectMetaParams{
		ID:           id,
		Region:       region,
		ProposedDate: proposed,
		ActualDate:   actual,
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "update failed")
		return
	}
	c, _ := auth.FromContext(r.Context())
	pid, _ := uuidFromPg(p.ID)
	a.Audit.Log(r.Context(), c.UserID, "project.update_meta", "project", pid, &pid, nil)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"project": dtoFromProject(p, false)})
}

type stageReq struct {
	Stage string `json:"stage"`
}

func (a *API) PatchProjectStage(w http.ResponseWriter, r *http.Request) {
	id, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req stageReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	if !validStage(req.Stage) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid stage")
		return
	}
	p, err := a.DB.Queries.UpdateProjectStage(r.Context(), sqlc.UpdateProjectStageParams{
		ID:    id,
		Stage: req.Stage,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "update failed")
		return
	}
	c, _ := auth.FromContext(r.Context())
	pid, _ := uuidFromPg(p.ID)
	a.Audit.Log(r.Context(), c.UserID, "project.stage", "project", pid, &pid, map[string]string{"stage": p.Stage})

	// Email recipients on the milestone stages.
	if p.Stage == "REPORT_SUBMITTED" || p.Stage == "COMPLETED" {
		a.notify("project.stage", func(ctx context.Context) {
			full, err := a.DB.Queries.GetProject(ctx, p.ID)
			if err != nil {
				return
			}
			to := a.recipientsForVessel(ctx, p.VesselID)
			label := ProjectTypeLabels[full.ProjectType]
			var t email.Template
			if p.Stage == "REPORT_SUBMITTED" {
				t = email.ReportSubmitted(full.VesselName, label)
			} else {
				t = email.ProjectCompleted(full.VesselName, label)
			}
			a.send(ctx, "project.stage."+p.Stage, to, t)
		})
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"project": dtoFromProject(p, false)})
}

type remarksReq struct {
	Remarks string `json:"remarks"`
}

func (a *API) PatchProjectRemarks(w http.ResponseWriter, r *http.Request) {
	id, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req remarksReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	p, err := a.DB.Queries.UpdateProjectRemarks(r.Context(), sqlc.UpdateProjectRemarksParams{
		ID:      id,
		Remarks: db.StringPtr(strings.TrimSpace(req.Remarks)),
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "update failed")
		return
	}
	c, _ := auth.FromContext(r.Context())
	pid, _ := uuidFromPg(p.ID)
	a.Audit.Log(r.Context(), c.UserID, "project.remarks", "project", pid, &pid, nil)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"project": dtoFromProject(p, false)})
}

// Compile-time guard against accidental unused imports in dev.
var _ = uuid.Nil
