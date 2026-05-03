package db

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// UUID converts a uuid.UUID into a pgtype.UUID for sqlc args.
func UUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

// UUIDFromString parses a string and returns a valid pgtype.UUID, or an error.
func UUIDFromString(s string) (pgtype.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}, err
	}
	return UUID(id), nil
}

// UUIDString renders a pgtype.UUID as canonical lowercase string.
// Returns "" if the UUID is null.
func UUIDString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return uuid.UUID(u.Bytes).String()
}

// Time renders a pgtype.Timestamptz, or zero time if null.
func Time(t pgtype.Timestamptz) time.Time {
	if !t.Valid {
		return time.Time{}
	}
	return t.Time
}

// Date renders a pgtype.Date as YYYY-MM-DD or "" if null.
func Date(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format("2006-01-02")
}

// DateFromString parses YYYY-MM-DD into a pgtype.Date. Empty string -> null.
func DateFromString(s string) (pgtype.Date, error) {
	if s == "" {
		return pgtype.Date{}, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

// StringPtr returns nil if s is empty, else &s. Useful for sqlc nullable args.
func StringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// PtrString dereferences a *string, returning "" if nil.
func PtrString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
