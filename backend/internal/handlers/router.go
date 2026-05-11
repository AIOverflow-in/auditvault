package handlers

import (
	"github.com/go-chi/chi/v5"

	"github.com/nivyash/auditvault-backend/internal/audit"
	"github.com/nivyash/auditvault-backend/internal/auth"
	"github.com/nivyash/auditvault-backend/internal/config"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/email"
	"github.com/nivyash/auditvault-backend/internal/storage"
)

// API holds the singletons handlers reach into.
type API struct {
	Cfg     *config.Config
	DB      *db.DB
	Audit   *audit.Logger
	Mailer  email.Mailer
	Storage storage.Storage
}

func NewAPI(cfg *config.Config, d *db.DB, mailer email.Mailer, st storage.Storage) *API {
	return &API{
		Cfg:     cfg,
		DB:      d,
		Audit:   audit.New(d.Queries),
		Mailer:  mailer,
		Storage: st,
	}
}

// Mount registers all routes on r. Public routes are added directly; protected
// routes go inside a Group with the auth middleware.
func (a *API) Mount(r chi.Router) {
	r.Get("/healthz", Health)

	// Public auth route
	r.Post("/auth/login", a.Login)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(auth.Middleware(a.Cfg.JWTSecret))

		r.Post("/auth/logout", a.Logout)
		r.Get("/auth/me", a.Me)

		r.Route("/clients", func(r chi.Router) {
			// Listing all clients and creating new ones stays Nivyash-only.
			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).Get("/", a.ListClients)
			r.With(auth.RequireAnyRole(auth.RoleAdmin)).Post("/", a.CreateClient)
			// Client roles need this endpoint to land on their own company's
			// page after the dashboard redirect. The handler enforces the
			// per-tenant scope (404 cross-tenant) and filters vessels to
			// only the user's granted ships.
			r.Get("/{id}", a.GetClient)
			// Inline "Add ship" flow on /clients/[id] — admin/staff only.
			// Creates the vessel (or reuses by name) and the project in one go.
			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).
				Post("/{id}/audit-rows", a.CreateClientAuditRow)
		})

		r.Route("/vessels", func(r chi.Router) {
			r.Get("/", a.ListVessels)
			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).Post("/", a.CreateVessel)
			r.Get("/{id}", a.GetVessel)
		})

		r.Route("/projects", func(r chi.Router) {
			r.Get("/", a.ListProjects)
			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).Post("/", a.CreateProject)
			r.Get("/{id}", a.GetProject)
			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).Patch("/{id}", a.PatchProject)
			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).Patch("/{id}/stage", a.PatchProjectStage)
			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).Patch("/{id}/remarks", a.PatchProjectRemarks)

			r.Get("/{id}/files", a.ListProjectFiles)
			r.Post("/{id}/files/upload-init", a.CreateUploadSession)
			r.Get("/{id}/files/{fileId}/parts/{partNumber}/url", a.PresignPart)
			r.Post("/{id}/files/{fileId}/complete", a.CompleteUpload)
			r.Post("/{id}/files/{fileId}/abort", a.AbortUpload)
			r.Get("/{id}/files/{fileId}/download", a.DownloadFile)
			r.With(auth.RequireAnyRole(auth.RoleAdmin)).Delete("/{id}/files/{fileId}", a.SoftDeleteFile)

			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).Get("/{id}/notes", a.ListNotes)
			r.With(auth.RequireAnyRole(auth.RoleAdmin, auth.RoleStaff)).Post("/{id}/notes", a.CreateNote)
		})

		r.Route("/users", func(r chi.Router) {
			r.Use(auth.RequireAnyRole(auth.RoleAdmin))
			r.Get("/", a.ListUsers)
			r.Post("/", a.CreateUserHandler)
			r.Get("/{id}/vessels", a.ListUserVessels)
			r.Put("/{id}/vessels", a.SetUserVessels)
		})

		r.Route("/audit-logs", func(r chi.Router) {
			r.Use(auth.RequireAnyRole(auth.RoleAdmin))
			r.Get("/", a.ListAuditLogs)
		})
	})
}
