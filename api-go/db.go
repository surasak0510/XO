package main

import (
	"database/sql"
	"os"

	_ "modernc.org/sqlite"
)

func openDB() (*sql.DB, error) {
	path := os.Getenv("SQLITE_PATH")
	if path == "" {
		path = "app.db"
	}
	return sql.Open("sqlite", "file:"+path+"?_pragma=busy_timeout(5000)")
}

func runMigrations(db *sql.DB) error {
	b, err := os.ReadFile("schema.sql")
	if err != nil {
		return err
	}
	_, err = db.Exec(string(b))
	return err
}
