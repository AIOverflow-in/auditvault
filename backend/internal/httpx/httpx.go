// Package httpx contains tiny helpers for JSON request/response handling
// used across handlers. Kept dependency-free to avoid import cycles.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
)

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func WriteError(w http.ResponseWriter, status int, msg string) {
	WriteJSON(w, status, map[string]string{"error": msg})
}

func DecodeJSON[T any](r *http.Request, dst *T) error {
	if r.Body == nil {
		return errors.New("empty body")
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20)) // 1 MB body cap
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}

func BadRequest(w http.ResponseWriter, err error) {
	slog.Debug("bad_request", "err", err)
	WriteError(w, http.StatusBadRequest, "invalid request: "+err.Error())
}
