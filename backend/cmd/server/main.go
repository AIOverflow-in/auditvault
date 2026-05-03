package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/nivyash/auditvault-backend/internal/config"
	"github.com/nivyash/auditvault-backend/internal/db"
	"github.com/nivyash/auditvault-backend/internal/email"
	"github.com/nivyash/auditvault-backend/internal/handlers"
	"github.com/nivyash/auditvault-backend/internal/middleware"
	"github.com/nivyash/auditvault-backend/internal/storage"
)

func main() {
	_ = godotenv.Load(".env", "../.env")

	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	cfg, err := config.Load()
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	database, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("db.open", "err", err)
		os.Exit(1)
	}
	defer database.Close()

	mailer := email.NewResend(cfg.ResendAPIKey, cfg.EmailFrom)

	var store storage.Storage
	switch cfg.StorageProvider {
	case config.StorageProviderS3:
		store, err = storage.NewS3(ctx, cfg.S3)
	default:
		store, err = storage.NewR2(ctx, cfg.R2)
	}
	if err != nil {
		log.Error("storage.init", "provider", cfg.StorageProvider, "err", err)
		os.Exit(1)
	}
	log.Info("storage.ready", "provider", cfg.StorageProvider)

	api := handlers.NewAPI(cfg, database, mailer, store)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.Logger(log))
	r.Use(chimw.Recoverer)
	r.Use(middleware.CORS(cfg.FrontendOrigin))

	api.Mount(r)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	go func() {
		log.Info("server.listen", "addr", srv.Addr, "frontend_origin", cfg.FrontendOrigin)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server.error", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Info("server.shutdown.start")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("server.shutdown.error", "err", err)
	}
	log.Info("server.shutdown.done")
}
