package auth

import (
	"net/http"
	"strings"

	"github.com/nivyash/auditvault-backend/internal/httpx"
)

// Middleware enforces presence of a valid JWT in either the Authorization
// header (Bearer) or the av_session cookie set by the frontend.
func Middleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString := extractToken(r)
			if tokenString == "" {
				httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
				return
			}
			claims, err := ParseToken(secret, tokenString)
			if err != nil {
				httpx.WriteError(w, http.StatusUnauthorized, "invalid or expired session")
				return
			}
			ctx := ContextWithClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	if c, err := r.Cookie("av_session"); err == nil {
		return c.Value
	}
	return ""
}

// RequireAnyRole returns a middleware that 403s if the caller's role is not in roles.
func RequireAnyRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := FromContext(r.Context())
			if err != nil {
				httpx.WriteError(w, http.StatusUnauthorized, "unauthenticated")
				return
			}
			if _, ok := allowed[c.Role]; !ok {
				httpx.WriteError(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
