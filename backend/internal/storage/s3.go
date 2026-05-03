package storage

import (
	"context"
	"errors"
)

// S3Config holds AWS S3 (or any S3-compatible service like MinIO, Wasabi,
// Backblaze B2 with S3 API) connection details.
//
//   - For real AWS S3: leave Endpoint empty; the SDK constructs the regional URL.
//   - For self-hosted / S3-compatible: set Endpoint and usually leave UsePathStyle
//     true (which we do by default for S3 to be safe with self-hosted gateways).
type S3Config struct {
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	Region          string
	// Endpoint is optional. Leave empty for real AWS S3; set to e.g.
	// http://localhost:9000 for MinIO.
	Endpoint string
	// UsePathStyle: empty/false for AWS S3 (virtual-hosted style is default and
	// recommended); true for MinIO and most other S3-compatible servers.
	UsePathStyle bool
}

// NewS3 builds a Storage backed by AWS S3 (or any S3-compatible API).
func NewS3(ctx context.Context, c S3Config) (Storage, error) {
	if c.Region == "" {
		return nil, errors.New("storage.s3: S3_REGION is required (e.g. ap-south-1)")
	}
	return newClient(ctx, clientParams{
		provider:        providerS3,
		bucket:          c.Bucket,
		region:          c.Region,
		endpoint:        c.Endpoint, // empty → SDK uses AWS regional defaults
		usePathStyle:    c.UsePathStyle,
		accessKeyID:     c.AccessKeyID,
		secretAccessKey: c.SecretAccessKey,
	})
}
