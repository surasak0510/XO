package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"
)

// createSession: เก็บ userID ลง cookie (simple session)
func createSession(w http.ResponseWriter, db *sql.DB, userID int64) {
	http.SetCookie(w, &http.Cookie{
		Name:     "login_uid",
		Value:    strconv.FormatInt(userID, 10),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(10 * time.Minute),
	})
}
