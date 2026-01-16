package main

import (
	"database/sql"
	"net/http"
)

func DelUser(db *sql.DB) http.HandlerFunc {
	return requireAccessToken(func(w http.ResponseWriter, r *http.Request, userID int64, role string) {

		rows, err := db.Query(`
			Delete FROM users WHERE user_id = ?
		`, userID)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		defer rows.Close()

		writeJSON(w, "Deleted user successfully")
	})
}
