package main

import (
	"database/sql"
	"log"
)

func seed(db *sql.DB) {
	if db == nil {
		log.Println("seed: db is nil")
		return
	}

	adminHash, err := hashPassword("admin123")
	if err != nil {
		log.Println("hash admin password error:", err)
		return
	}

	userHash, err := hashPassword("user123")
	if err != nil {
		log.Println("hash user password error:", err)
		return
	}

	if _, err := db.Exec(`
		INSERT OR IGNORE INTO users(username,password,role)
		VALUES(?,?,?)
	`, "admin", adminHash, "admin"); err != nil {
		log.Println("seed admin error:", err)
	}

	if _, err := db.Exec(`
		INSERT OR IGNORE INTO users(username,password,role)
		VALUES(?,?,?)
	`, "user", userHash, "user"); err != nil {
		log.Println("seed user error:", err)
	}

	if _, err := db.Exec(`
		INSERT OR IGNORE INTO player_stats(user_id, score, streak_wins)
		SELECT id, 0, 0 FROM users WHERE username IN ('admin','user')
	`); err != nil {
		log.Println("seed player_stats error:", err)
	}

	if _, err := db.Exec(`
		INSERT OR IGNORE INTO oauth_clients(client_id, client_secret, redirect_uri)
		VALUES('web-next','', 'http://localhost:3000/oauth/callback')
	`); err != nil {
		log.Println("seed oauth_clients error:", err)
	}
}
