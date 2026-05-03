package config

import (
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/nivyash/auditvault-backend/internal/storage"
)

const (
	StorageProviderR2 = "r2"
	StorageProviderS3 = "s3"
)

type Config struct {
	Port           string
	LogLevel       string
	DatabaseURL    string
	FrontendOrigin string

	JWTSecret []byte

	// StorageProvider picks which file backend to wire up at boot.
	// Either "r2" (default — Cloudflare R2) or "s3" (AWS S3 / S3-compatible).
	StorageProvider string

	R2 storage.R2Config
	S3 storage.S3Config

	ResendAPIKey string
	EmailFrom    string
}

// Load reads configuration from environment variables. Required values are
// validated up-front so we fail fast rather than at first use.
func Load() (*Config, error) {
	cfg := &Config{
		Port:            getEnv("PORT", "8080"),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		FrontendOrigin:  getEnv("FRONTEND_ORIGIN", "http://localhost:3000"),
		StorageProvider: strings.ToLower(getEnv("STORAGE_PROVIDER", StorageProviderR2)),

		R2: storage.R2Config{
			AccountID:       os.Getenv("R2_ACCOUNT_ID"),
			AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
			SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
			Bucket:          os.Getenv("R2_BUCKET"),
			Region:          getEnv("R2_REGION", "auto"),
		},

		S3: storage.S3Config{
			AccessKeyID:     os.Getenv("S3_ACCESS_KEY_ID"),
			SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"),
			Bucket:          os.Getenv("S3_BUCKET"),
			Region:          os.Getenv("S3_REGION"),
			Endpoint:        os.Getenv("S3_ENDPOINT"),
			UsePathStyle:    os.Getenv("S3_USE_PATH_STYLE") == "true",
		},

		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		EmailFrom:    getEnv("EMAIL_FROM", "noreply@auditvault.local"),
	}

	if cfg.DatabaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		return nil, errors.New("JWT_SECRET must be at least 32 bytes")
	}
	cfg.JWTSecret = []byte(jwtSecret)

	switch cfg.StorageProvider {
	case StorageProviderR2:
		if cfg.R2.AccountID == "" || cfg.R2.AccessKeyID == "" ||
			cfg.R2.SecretAccessKey == "" || cfg.R2.Bucket == "" {
			return nil, errors.New("STORAGE_PROVIDER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET")
		}
	case StorageProviderS3:
		if cfg.S3.AccessKeyID == "" || cfg.S3.SecretAccessKey == "" ||
			cfg.S3.Bucket == "" || cfg.S3.Region == "" {
			return nil, errors.New("STORAGE_PROVIDER=s3 requires S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION")
		}
	default:
		return nil, errors.New("STORAGE_PROVIDER must be either 'r2' or 's3'")
	}

	return cfg, nil
}

func (c *Config) PortInt() int {
	n, _ := strconv.Atoi(c.Port)
	return n
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
