package auth

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

type ctxKey struct{}

var claimsCtxKey = ctxKey{}

func ContextWithClaims(ctx context.Context, c *Claims) context.Context {
	return context.WithValue(ctx, claimsCtxKey, c)
}

// FromContext returns the auth claims attached to ctx by the middleware,
// or an error if there is none.
func FromContext(ctx context.Context) (*Claims, error) {
	c, ok := ctx.Value(claimsCtxKey).(*Claims)
	if !ok || c == nil {
		return nil, errors.New("no auth claims in context")
	}
	return c, nil
}

// MustUserID extracts the user ID from ctx and panics if absent. Use only
// inside handlers that are protected by the auth middleware.
func MustUserID(ctx context.Context) uuid.UUID {
	c, err := FromContext(ctx)
	if err != nil {
		panic(err)
	}
	return c.UserID
}
