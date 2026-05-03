package storage

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// Tunables shared between providers. Cloudflare R2 and AWS S3 enforce the
// same multipart limits (5 MB minimum part except the last; 5 GB max single
// PUT; 10,000 parts max).
const (
	defaultPartSize    int64 = 50 * 1024 * 1024
	defaultMaxFileSize int64 = 10 * 1024 * 1024 * 1024
	uploadTTL                = 6 * time.Hour
	downloadTTL              = 5 * time.Minute
)

// providerName labels a backing store in logs and errors.
type providerName string

const (
	providerR2 providerName = "r2"
	providerS3 providerName = "s3"
)

// clientParams is the set of values needed to wire up the AWS SDK against
// either R2 or S3. R2 supplies a custom BaseEndpoint; S3 leaves it empty.
type clientParams struct {
	provider        providerName
	bucket          string
	region          string
	endpoint        string // optional explicit override (R2 sets this; S3-compatible fakes can use it too)
	usePathStyle    bool   // S3-compatible self-hosted services (e.g. MinIO) usually need true
	accessKeyID     string
	secretAccessKey string
}

// s3Client implements Storage against any S3-compatible service. Both NewR2
// and NewS3 build one of these; the only differences live in clientParams.
type s3Client struct {
	provider providerName
	bucket   string
	api      *s3.Client
	presign  *s3.PresignClient
}

func newClient(ctx context.Context, p clientParams) (*s3Client, error) {
	if p.bucket == "" {
		return nil, fmt.Errorf("storage.%s: bucket is required", p.provider)
	}
	if p.accessKeyID == "" || p.secretAccessKey == "" {
		return nil, fmt.Errorf("storage.%s: access key id and secret are required", p.provider)
	}
	region := p.region
	if region == "" {
		// R2 ignores region for routing but the SDK still requires one.
		region = "auto"
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			p.accessKeyID, p.secretAccessKey, "",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("storage.%s: load aws config: %w", p.provider, err)
	}

	api := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if p.endpoint != "" {
			o.BaseEndpoint = aws.String(p.endpoint)
		}
		o.UsePathStyle = p.usePathStyle
	})

	return &s3Client{
		provider: p.provider,
		bucket:   p.bucket,
		api:      api,
		presign:  s3.NewPresignClient(api),
	}, nil
}

func (c *s3Client) PartSize() int64    { return defaultPartSize }
func (c *s3Client) MaxFileSize() int64 { return defaultMaxFileSize }

func (c *s3Client) StartMultipart(ctx context.Context, key, contentType string, fileSize int64) (*Multipart, error) {
	if fileSize <= 0 {
		return nil, errors.New("storage: fileSize must be > 0")
	}
	if fileSize > defaultMaxFileSize {
		return nil, fmt.Errorf("storage: file size %d exceeds limit %d", fileSize, defaultMaxFileSize)
	}

	create, err := c.api.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		ContentType: nullableString(contentType),
	})
	if err != nil {
		return nil, fmt.Errorf("storage.%s: create multipart: %w", c.provider, err)
	}
	uploadID := aws.ToString(create.UploadId)

	partCount := numberOfParts(fileSize, defaultPartSize)
	parts := make([]PresignedPart, 0, partCount)
	for i := int32(1); i <= partCount; i++ {
		urlStr, err := c.PresignPart(ctx, key, uploadID, i)
		if err != nil {
			_ = c.AbortMultipart(ctx, key, uploadID)
			return nil, err
		}
		parts = append(parts, PresignedPart{PartNumber: i, URL: urlStr})
	}

	return &Multipart{
		Key:      key,
		UploadID: uploadID,
		PartSize: defaultPartSize,
		PartURLs: parts,
	}, nil
}

func (c *s3Client) PresignPart(ctx context.Context, key, uploadID string, partNumber int32) (string, error) {
	out, err := c.presign.PresignUploadPart(ctx, &s3.UploadPartInput{
		Bucket:     aws.String(c.bucket),
		Key:        aws.String(key),
		UploadId:   aws.String(uploadID),
		PartNumber: aws.Int32(partNumber),
	}, s3.WithPresignExpires(uploadTTL))
	if err != nil {
		return "", fmt.Errorf("storage.%s: presign part %d: %w", c.provider, partNumber, err)
	}
	return out.URL, nil
}

func (c *s3Client) CompleteMultipart(ctx context.Context, key, uploadID string, parts []Part) error {
	if len(parts) == 0 {
		return errors.New("storage: no parts to complete")
	}
	completed := make([]types.CompletedPart, len(parts))
	for i, p := range parts {
		completed[i] = types.CompletedPart{
			PartNumber: aws.Int32(p.PartNumber),
			ETag:       aws.String(p.ETag),
		}
	}
	_, err := c.api.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket:          aws.String(c.bucket),
		Key:             aws.String(key),
		UploadId:        aws.String(uploadID),
		MultipartUpload: &types.CompletedMultipartUpload{Parts: completed},
	})
	if err != nil {
		return fmt.Errorf("storage.%s: complete multipart: %w", c.provider, err)
	}
	return nil
}

func (c *s3Client) AbortMultipart(ctx context.Context, key, uploadID string) error {
	_, err := c.api.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{
		Bucket:   aws.String(c.bucket),
		Key:      aws.String(key),
		UploadId: aws.String(uploadID),
	})
	if err != nil {
		return fmt.Errorf("storage.%s: abort multipart: %w", c.provider, err)
	}
	return nil
}

func (c *s3Client) PresignGet(ctx context.Context, key, displayName string, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		ttl = downloadTTL
	}
	in := &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	}
	if displayName != "" {
		in.ResponseContentDisposition = aws.String(
			fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`,
				asciiSafe(displayName), url.PathEscape(displayName)),
		)
	}
	out, err := c.presign.PresignGetObject(ctx, in, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("storage.%s: presign get: %w", c.provider, err)
	}
	return out.URL, nil
}

func (c *s3Client) Delete(ctx context.Context, key string) error {
	_, err := c.api.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("storage.%s: delete: %w", c.provider, err)
	}
	return nil
}

// numberOfParts returns the chunk count for fileSize at partSize. Always
// at least 1; rounds up to cover the last partial chunk.
func numberOfParts(fileSize, partSize int64) int32 {
	if fileSize <= 0 {
		return 0
	}
	n := fileSize / partSize
	if fileSize%partSize > 0 {
		n++
	}
	return int32(n)
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// asciiSafe replaces non-printable / quote bytes with '_'. Used in the
// fallback filename of Content-Disposition; the RFC-5987 filename* extension
// carries the proper UTF-8 version.
func asciiSafe(s string) string {
	out := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < 0x20 || c > 0x7E || c == '"' || c == '\\' {
			out[i] = '_'
		} else {
			out[i] = c
		}
	}
	return string(out)
}
