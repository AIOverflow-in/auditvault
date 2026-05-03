package storage

import (
	"context"
	"errors"
	"fmt"
)

// R2Config holds Cloudflare R2 connection details.
//
// R2 is S3-compatible but addressed via a per-account endpoint
//
//	https://{AccountID}.r2.cloudflarestorage.com
//
// rather than AWS-style regional URLs.
type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	// Region is optional. R2 ignores it for routing but the SDK requires
	// *something*; "auto" is the conventional value.
	Region string
}

// NewR2 builds a Storage backed by Cloudflare R2.
func NewR2(ctx context.Context, c R2Config) (Storage, error) {
	if c.AccountID == "" {
		return nil, errors.New("storage.r2: R2_ACCOUNT_ID is required")
	}
	return newClient(ctx, clientParams{
		provider:        providerR2,
		bucket:          c.Bucket,
		region:          firstNonEmpty(c.Region, "auto"),
		endpoint:        fmt.Sprintf("https://%s.r2.cloudflarestorage.com", c.AccountID),
		usePathStyle:    false,
		accessKeyID:     c.AccessKeyID,
		secretAccessKey: c.SecretAccessKey,
	})
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
