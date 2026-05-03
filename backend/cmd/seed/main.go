// Seed populates a fresh database with a small set of demo data so that QA
// can log in, click around, and exercise the role-aware features. Idempotent:
// re-running uses the same fixed UUIDs and updates passwords in place.
//
// Usage: DATABASE_URL=... go run ./cmd/seed
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/nivyash/auditvault-backend/internal/auth"
)

const (
	nivyashOrgID    = "00000000-0000-0000-0000-000000000001"
	pacificID       = "00000000-0000-0000-0000-000000000010"
	nordicID        = "00000000-0000-0000-0000-000000000011"
	adminUserID     = "00000000-0000-0000-0000-0000000000a1"
	staffUserID     = "00000000-0000-0000-0000-0000000000a2"
	pacificMgrID    = "00000000-0000-0000-0000-0000000000b1"
	nordicMgrID     = "00000000-0000-0000-0000-0000000000b2"
	pacificViewerID = "00000000-0000-0000-0000-0000000000b3"
	pacificStarID   = "00000000-0000-0000-0000-000000000110"
	oceanGloryID    = "00000000-0000-0000-0000-000000000111"
	nordicEagleID   = "00000000-0000-0000-0000-000000000112"
	fjordSpiritID   = "00000000-0000-0000-0000-000000000113"
)

func main() {
	_ = godotenv.Load(".env", "../.env")
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "connect:", err)
		os.Exit(1)
	}
	defer pool.Close()

	adminHash, _ := auth.HashPassword("admin12345")
	staffHash, _ := auth.HashPassword("staff12345")
	clientHash, _ := auth.HashPassword("client12345")

	stmts := []struct {
		sql  string
		args []any
	}{
		{
			`INSERT INTO organizations (id, name, type) VALUES ($1, $2, 'NIVYASH')
			 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
			[]any{u(nivyashOrgID), "Nivyash Maritime Consultancy"},
		},
		{
			`INSERT INTO organizations (id, name, type) VALUES ($1, $2, 'CLIENT')
			 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
			[]any{u(pacificID), "Pacific Tankers Pte Ltd"},
		},
		{
			`INSERT INTO organizations (id, name, type) VALUES ($1, $2, 'CLIENT')
			 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
			[]any{u(nordicID), "Nordic Bulk Carriers AS"},
		},
		{
			`INSERT INTO users (id, email, name, password_hash, role, organization_id)
			 VALUES ($1, $2, $3, $4, 'ADMIN', $5)
			 ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
			[]any{u(adminUserID), "admin@nivyash.com", "Yatendra Singh", adminHash, u(nivyashOrgID)},
		},
		{
			`INSERT INTO users (id, email, name, password_hash, role, organization_id)
			 VALUES ($1, $2, $3, $4, 'STAFF', $5)
			 ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
			[]any{u(staffUserID), "staff@nivyash.com", "Marine Surveyor", staffHash, u(nivyashOrgID)},
		},
		{
			`INSERT INTO users (id, email, name, password_hash, role, organization_id)
			 VALUES ($1, $2, $3, $4, 'CLIENT_ADMIN', $5)
			 ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
			[]any{u(pacificMgrID), "manager@pacifictankers.com", "David Chen", clientHash, u(pacificID)},
		},
		{
			`INSERT INTO users (id, email, name, password_hash, role, organization_id)
			 VALUES ($1, $2, $3, $4, 'CLIENT_VIEWER', $5)
			 ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
			[]any{u(pacificViewerID), "viewer@pacifictankers.com", "Mei Lin", clientHash, u(pacificID)},
		},
		{
			`INSERT INTO users (id, email, name, password_hash, role, organization_id)
			 VALUES ($1, $2, $3, $4, 'CLIENT_ADMIN', $5)
			 ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
			[]any{u(nordicMgrID), "ops@nordicbulk.com", "Lars Eriksson", clientHash, u(nordicID)},
		},
		{
			`INSERT INTO vessels (id, name, imo_number, flag, vessel_type, organization_id)
			 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
			[]any{u(pacificStarID), "Pacific Star", "9876543", "Singapore", "VLCC Tanker", u(pacificID)},
		},
		{
			`INSERT INTO vessels (id, name, imo_number, flag, vessel_type, organization_id)
			 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
			[]any{u(oceanGloryID), "Ocean Glory", "9123456", "Panama", "Aframax Tanker", u(pacificID)},
		},
		{
			`INSERT INTO vessels (id, name, imo_number, flag, vessel_type, organization_id)
			 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
			[]any{u(nordicEagleID), "Nordic Eagle", "9654321", "Norway", "Bulk Carrier", u(nordicID)},
		},
		{
			`INSERT INTO vessels (id, name, imo_number, flag, vessel_type, organization_id)
			 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
			[]any{u(fjordSpiritID), "Fjord Spirit", "9789012", "Norway", "Bulk Carrier", u(nordicID)},
		},
		// Projects (one per vessel + a couple extras)
		{
			`INSERT INTO projects (vessel_id, project_type, region, proposed_date, stage, created_by_id)
			 VALUES ($1, 'REMOTE_NAV_AUDIT', 'Singapore Strait — Eastbound', '2026-06-25', 'DATA_COLLECTION', $2)
			 ON CONFLICT DO NOTHING`,
			[]any{u(pacificStarID), u(staffUserID)},
		},
		{
			`INSERT INTO projects (vessel_id, project_type, region, proposed_date, stage, created_by_id)
			 VALUES ($1, 'PRE_PURCHASE_INSPECTION', 'Dubai Drydock', '2026-07-10', 'CONFIRMED', $2)
			 ON CONFLICT DO NOTHING`,
			[]any{u(oceanGloryID), u(staffUserID)},
		},
		{
			`INSERT INTO projects (vessel_id, project_type, region, proposed_date, stage, created_by_id)
			 VALUES ($1, 'INTERNAL_AUDIT', 'Port of Rotterdam', '2026-05-15', 'REPORT_SUBMITTED', $2)
			 ON CONFLICT DO NOTHING`,
			[]any{u(nordicEagleID), u(staffUserID)},
		},
		{
			`INSERT INTO projects (vessel_id, project_type, region, proposed_date, stage, created_by_id)
			 VALUES ($1, 'INCIDENT_INVESTIGATION', 'Malacca Strait', '2026-04-20', 'COMPLETED', $2)
			 ON CONFLICT DO NOTHING`,
			[]any{u(fjordSpiritID), u(staffUserID)},
		},
		// Vessel grants:
		// CLIENT_ADMIN of Pacific Tankers → both their ships
		{`INSERT INTO user_vessel_access (user_id, vessel_id, granted_by_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			[]any{u(pacificMgrID), u(pacificStarID), u(adminUserID)}},
		{`INSERT INTO user_vessel_access (user_id, vessel_id, granted_by_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			[]any{u(pacificMgrID), u(oceanGloryID), u(adminUserID)}},
		// VIEWER of Pacific Tankers → only Pacific Star (deliberately partial — this is the RBAC demo)
		{`INSERT INTO user_vessel_access (user_id, vessel_id, granted_by_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			[]any{u(pacificViewerID), u(pacificStarID), u(adminUserID)}},
		// CLIENT_ADMIN of Nordic → both their ships
		{`INSERT INTO user_vessel_access (user_id, vessel_id, granted_by_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			[]any{u(nordicMgrID), u(nordicEagleID), u(adminUserID)}},
		{`INSERT INTO user_vessel_access (user_id, vessel_id, granted_by_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			[]any{u(nordicMgrID), u(fjordSpiritID), u(adminUserID)}},
	}

	for _, s := range stmts {
		if _, err := pool.Exec(ctx, s.sql, s.args...); err != nil {
			fmt.Fprintln(os.Stderr, "seed:", err)
			os.Exit(1)
		}
	}

	slog.Info("seed.done")
	fmt.Println()
	fmt.Println("Seed complete. Login credentials:")
	fmt.Println("  Nivyash admin    admin@nivyash.com           admin12345")
	fmt.Println("  Nivyash staff    staff@nivyash.com           staff12345")
	fmt.Println("  Pacific manager  manager@pacifictankers.com  client12345  (sees both Pacific ships)")
	fmt.Println("  Pacific viewer   viewer@pacifictankers.com   client12345  (sees Pacific Star only)")
	fmt.Println("  Nordic manager   ops@nordicbulk.com          client12345  (sees both Nordic ships)")
}

func u(s string) pgtype.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		panic(err)
	}
	return pgtype.UUID{Bytes: id, Valid: true}
}
