package handlers

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nivyash/auditvault-backend/internal/email"
)

// notify runs fn in a background goroutine with its own timeout. Failures
// (panics or send errors) are logged but never bubble back to the caller —
// email is supporting cast, never load-bearing on the user's action.
func (a *API) notify(label string, fn func(ctx context.Context)) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("notify.panic", "label", label, "panic", r)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		fn(ctx)
	}()
}

func (a *API) recipientsForVessel(ctx context.Context, vesselID pgtype.UUID) []string {
	users, err := a.DB.Queries.ListUsersWithVesselAccess(ctx, vesselID)
	if err != nil {
		slog.Error("notify.recipients.vessel", "err", err)
		return nil
	}
	emails := make([]string, 0, len(users))
	for _, u := range users {
		emails = append(emails, u.Email)
	}
	return emails
}

func (a *API) recipientsForNivyash(ctx context.Context) []string {
	users, err := a.DB.Queries.ListNivyashUsers(ctx)
	if err != nil {
		slog.Error("notify.recipients.nivyash", "err", err)
		return nil
	}
	emails := make([]string, 0, len(users))
	for _, u := range users {
		emails = append(emails, u.Email)
	}
	return emails
}

// send is the thin wrapper around the configured Mailer that handles the
// "no recipients" no-op and consistent error logging.
func (a *API) send(ctx context.Context, label string, to []string, t email.Template) {
	if len(to) == 0 {
		return
	}
	if err := a.Mailer.Send(ctx, to, t.Subject, t.Body); err != nil {
		slog.Error("notify.send", "label", label, "to_count", len(to), "err", err)
		return
	}
	slog.Info("notify.sent", "label", label, "to_count", len(to), "subject", t.Subject)
}
