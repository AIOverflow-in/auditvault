package audit

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/db/sqlc"
)

type Logger struct {
	q *sqlc.Queries
}

func New(q *sqlc.Queries) *Logger {
	return &Logger{q: q}
}

// Log writes a row to audit_logs. Failures are logged but never bubbled to
// the caller — audit logging must not break the action being audited.
func (l *Logger) Log(ctx context.Context, userID uuid.UUID, action, entityType string, entityID uuid.UUID, projectID *uuid.UUID, metadata any) {
	var meta []byte
	if metadata != nil {
		b, err := json.Marshal(metadata)
		if err == nil {
			meta = b
		}
	}
	var pid pgtype.UUID
	if projectID != nil {
		pid = db.UUID(*projectID)
	}
	if err := l.q.CreateAuditLog(ctx, sqlc.CreateAuditLogParams{
		UserID:       db.UUID(userID),
		Action:       action,
		EntityType:   entityType,
		EntityID:     db.UUID(entityID),
		ProjectID:    pid,
		MetadataJson: meta,
	}); err != nil {
		slog.Error("audit.write", "err", err, "action", action, "entity", entityType)
	}
}
