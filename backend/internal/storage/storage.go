// Package storage abstracts the underlying object store. The current
// implementation is Cloudflare R2 (S3-compatible). The interface lets us swap
// in a different provider — or a fake for tests — without touching handler
// code.
package storage

import (
	"context"
	"errors"
	"time"
)

var (
	// ErrNotFound is returned by GetItem-style operations when the underlying
	// object doesn't exist (e.g. someone deleted it directly in the bucket).
	ErrNotFound = errors.New("storage: object not found")
)

// Part represents an uploaded multipart chunk that the client confirmed
// successfully PUT to R2. The ETag is what R2 returned on the part response;
// it's required to call CompleteMultipart.
type Part struct {
	PartNumber int32  // 1-based, sequential
	ETag       string // exactly the value R2 returned, with or without quotes
}

// PresignedPart is a presigned URL the browser can PUT a chunk to directly.
type PresignedPart struct {
	PartNumber int32
	URL        string
}

// Multipart is the descriptor handed back to the client when they ask to start
// an upload. The client uses the PartURLs in order, captures the ETag on each
// PUT response, then calls CompleteMultipart with the (partNumber, etag) list.
type Multipart struct {
	Key      string
	UploadID string
	PartSize int64
	PartURLs []PresignedPart
}

// Storage is everything the backend needs from the underlying object store.
type Storage interface {
	// PartSize returns the chunk size used for multipart uploads.
	PartSize() int64

	// MaxFileSize returns the largest single-file upload the server will allow.
	MaxFileSize() int64

	// StartMultipart creates a multipart upload at key and presigns N part
	// URLs covering fileSize bytes. URLs expire after roughly partExpiry.
	StartMultipart(ctx context.Context, key, contentType string, fileSize int64) (*Multipart, error)

	// PresignPart issues a fresh presigned PUT URL for a single part — used
	// when the client retries after the original URL has expired.
	PresignPart(ctx context.Context, key, uploadID string, partNumber int32) (string, error)

	// CompleteMultipart finalises the upload. Parts must be ordered by
	// PartNumber and contain the ETag values R2 returned on each PUT.
	CompleteMultipart(ctx context.Context, key, uploadID string, parts []Part) error

	// AbortMultipart cancels an in-progress multipart upload. R2 will discard
	// any uploaded parts.
	AbortMultipart(ctx context.Context, key, uploadID string) error

	// PresignGet returns a short-lived presigned download URL for an object.
	// Set displayName for the suggested filename in Content-Disposition.
	PresignGet(ctx context.Context, key, displayName string, ttl time.Duration) (string, error)

	// Delete removes the object from the bucket. Used by hard-delete flows
	// only; the project's "soft delete" path leaves the object intact.
	Delete(ctx context.Context, key string) error
}
