package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
	"github.com/nivyash/auditvault-backend/internal/email"
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

// auditRowReq powers the inline "Add ship" flow on /clients/[id]. The captain
// fills a single table row with ship name + project metadata; we create the
// vessel (if a case-insensitive name match doesn't already exist in this
// client) and then create the project in one atomic-feeling request.
type auditRowReq struct {
	ShipName     string `json:"shipName"`
	ProjectType  string `json:"projectType"`
	Region       string `json:"region"`
	ProposedDate string `json:"proposedDate"`
	Remarks      string `json:"remarks"`
}

func (a *API) CreateClientAuditRow(w http.ResponseWriter, r *http.Request) {
	clientID, err := db.UUIDFromString(chi.URLParam(r, "id"))
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid client id")
		return
	}
	// Confirm the client org actually exists (and is a CLIENT, not Nivyash).
	org, err := a.DB.Queries.GetClientOrganizationDetail(r.Context(), clientID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.WriteError(w, http.StatusNotFound, "client not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "client lookup failed")
		return
	}

	var req auditRowReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.BadRequest(w, err)
		return
	}
	req.ShipName = strings.TrimSpace(req.ShipName)
	if req.ShipName == "" {
		httpx.WriteError(w, http.StatusBadRequest, "ship name is required")
		return
	}
	if !validProjectType(req.ProjectType) {
		httpx.WriteError(w, http.StatusBadRequest, "invalid project type")
		return
	}
	pd, err := db.DateFromString(req.ProposedDate)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "proposedDate must be YYYY-MM-DD")
		return
	}

	c, _ := auth.FromContext(r.Context())

	// Look up the vessel by name (case-insensitive) within this client; reuse
	// if found, otherwise create. This mirrors how Excel autocompletes from
	// values already in the column.
	vesselRow, lookupErr := a.DB.Queries.GetVesselByNameInOrg(r.Context(), sqlc.GetVesselByNameInOrgParams{
		OrganizationID: clientID,
		Lower:          req.ShipName,
	})

	var (
		vesselID      pgtype.UUID
		vesselName    string
		vesselImo     *string
		vesselFlag    *string
		vesselType    *string
		createdVessel bool
	)

	if lookupErr == nil {
		vesselID = vesselRow.ID
		vesselName = vesselRow.Name
		vesselImo = vesselRow.ImoNumber
		vesselFlag = vesselRow.Flag
		vesselType = vesselRow.VesselType
	} else if errors.Is(lookupErr, pgx.ErrNoRows) {
		v, err := a.DB.Queries.CreateVessel(r.Context(), sqlc.CreateVesselParams{
			Name:           req.ShipName,
			OrganizationID: clientID,
		})
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "vessel create failed")
			return
		}
		vesselID = v.ID
		vesselName = v.Name
		vesselImo = v.ImoNumber
		vesselFlag = v.Flag
		vesselType = v.VesselType
		createdVessel = true
		vid, _ := uuidFromPg(v.ID)
		a.Audit.Log(r.Context(), c.UserID, "vessel.create_inline", "vessel", vid, nil, map[string]any{
			"name": v.Name, "clientId": db.UUIDString(clientID),
		})
	} else {
		httpx.WriteError(w, http.StatusInternalServerError, "vessel lookup failed")
		return
	}

	// Now create the project on that vessel.
	p, err := a.DB.Queries.CreateProject(r.Context(), sqlc.CreateProjectParams{
		VesselID:     vesselID,
		ProjectType:  req.ProjectType,
		Region:       db.StringPtr(strings.TrimSpace(req.Region)),
		ProposedDate: pd,
		Column5:      nil, // stage defaults to ENQUIRY via the COALESCE in SQL
		Remarks:      db.StringPtr(strings.TrimSpace(req.Remarks)),
		CreatedByID:  db.UUID(c.UserID),
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "project create failed")
		return
	}
	pid, _ := uuidFromPg(p.ID)
	a.Audit.Log(r.Context(), c.UserID, "project.create", "project", pid, &pid, map[string]any{
		"vesselId": db.UUIDString(vesselID),
		"vesselCreatedInline": createdVessel,
	})

	// Fire the new-project email notification (granted client users for this vessel).
	a.notify("project.create", func(ctx context.Context) {
		full, err := a.DB.Queries.GetProject(ctx, p.ID)
		if err != nil {
			return
		}
		to := a.recipientsForVessel(ctx, p.VesselID)
		t := email.NewProject(full.VesselName, ProjectTypeLabels[full.ProjectType], db.PtrString(full.Region), db.Date(full.ProposedDate))
		a.send(ctx, "project.create", to, t)
	})

	// Build the response. The project shape mirrors projectRowDTO (what the
	// table on /clients/[id] consumes) so the frontend can splice this row
	// straight into its state without an extra round-trip.
	projDTO := projectRowDTO{
		projectDTO: projectDTO{
			ID:               db.UUIDString(p.ID),
			VesselID:         db.UUIDString(vesselID),
			VesselName:       vesselName,
			OrganizationID:   db.UUIDString(clientID),
			OrganizationName: org.Name,
			ProjectType:      p.ProjectType,
			Region:           db.PtrString(p.Region),
			ProposedDate:     db.Date(p.ProposedDate),
			ActualDate:       db.Date(p.ActualDate),
			Stage:            p.Stage,
			Remarks:          db.PtrString(p.Remarks),
			CreatedByID:      db.UUIDString(p.CreatedByID),
			CreatedAt:        db.Time(p.CreatedAt).Format("2006-01-02T15:04:05Z07:00"),
			UpdatedAt:        db.Time(p.UpdatedAt).Format("2006-01-02T15:04:05Z07:00"),
		},
		FinalReports: []fileBriefDTO{},
		Feedback:     []fileBriefDTO{},
	}
	vesselDTOResp := vesselDTO{
		ID:               db.UUIDString(vesselID),
		Name:             vesselName,
		IMONumber:        db.PtrString(vesselImo),
		Flag:             db.PtrString(vesselFlag),
		VesselType:       db.PtrString(vesselType),
		OrganizationID:   db.UUIDString(clientID),
		OrganizationName: org.Name,
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"project":       projDTO,
		"vessel":        vesselDTOResp,
		"createdVessel": createdVessel,
	})
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

	// Build the slices with make() so empty results serialise as [] rather
	// than null. A brand-new client has no vessels and no users; if the
	// fields end up nil here, JSON marshalling emits `null` and the
	// frontend's client.vessels.length crashes the /clients/[id] page.
	// (This is exactly what bricked the customer's "Add client" flow.)
	vessels := make([]vesselDTO, 0, len(vesselsList))
	for _, v := range vesselsList {
		vessels = append(vessels, vesselDTO{
			ID:               db.UUIDString(v.ID),
			Name:             v.Name,
			IMONumber:        db.PtrString(v.ImoNumber),
			Flag:             db.PtrString(v.Flag),
			VesselType:       db.PtrString(v.VesselType),
			OrganizationID:   db.UUIDString(v.OrganizationID),
			OrganizationName: v.OrganizationName,
		})
	}
	clientUsers := make([]userBrief, 0, len(users))
	for _, u := range users {
		clientUsers = append(clientUsers, userBrief{
			ID:    db.UUIDString(u.ID),
			Name:  u.Name,
			Email: u.Email,
			Role:  u.Role,
		})
	}
	resp := clientDetailDTO{
		clientDTO: clientDTO{
			ID:          db.UUIDString(org.ID),
			Name:        org.Name,
			Type:        org.Type,
			VesselCount: len(vesselsList),
			UserCount:   len(users),
		},
		Vessels: vessels,
		Users:   clientUsers,
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"client": resp})
}
