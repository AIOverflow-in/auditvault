package handlers

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func uuidFromPg(u pgtype.UUID) (uuid.UUID, bool) {
	if !u.Valid {
		return uuid.UUID{}, false
	}
	return uuid.UUID(u.Bytes), true
}
