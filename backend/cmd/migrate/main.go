package main

import (
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load(".env", "../.env")

	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: migrate <up|down|version>")
		os.Exit(2)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
		os.Exit(1)
	}

	m, err := migrate.New("file://migrations", dbURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "migrate.new:", err)
		os.Exit(1)
	}
	defer m.Close()

	switch os.Args[1] {
	case "up":
		if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			fmt.Fprintln(os.Stderr, "up:", err)
			os.Exit(1)
		}
		slog.Info("migrate.up.done")
	case "down":
		if err := m.Steps(-1); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			fmt.Fprintln(os.Stderr, "down:", err)
			os.Exit(1)
		}
		slog.Info("migrate.down.done")
	case "version":
		v, dirty, err := m.Version()
		if err != nil {
			fmt.Fprintln(os.Stderr, "version:", err)
			os.Exit(1)
		}
		fmt.Printf("version=%d dirty=%v\n", v, dirty)
	default:
		fmt.Fprintln(os.Stderr, "unknown command:", os.Args[1])
		os.Exit(2)
	}
}
