package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	TokenLifetime = 7 * 24 * time.Hour
)

// Roles
const (
	RoleAdmin        = "ADMIN"
	RoleStaff        = "STAFF"
	RoleClientAdmin  = "CLIENT_ADMIN"
	RoleClientViewer = "CLIENT_VIEWER"
)

func IsNivyashRole(role string) bool {
	return role == RoleAdmin || role == RoleStaff
}

func IsClientRole(role string) bool {
	return role == RoleClientAdmin || role == RoleClientViewer
}

type Claims struct {
	UserID         uuid.UUID `json:"sub"`
	Role           string    `json:"role"`
	OrganizationID uuid.UUID `json:"org_id"`
	jwt.RegisteredClaims
}

func IssueToken(secret []byte, userID, orgID uuid.UUID, role string) (string, time.Time, error) {
	expiresAt := time.Now().Add(TokenLifetime)
	claims := &Claims{
		UserID:         userID,
		Role:           role,
		OrganizationID: orgID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(secret)
	return signed, expiresAt, err
}

func ParseToken(secret []byte, tokenString string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
