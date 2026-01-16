package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	db, err := openDB()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := runMigrations(db); err != nil {
		log.Fatal(err)
	}

	seed(db)

	r := chi.NewRouter()

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	r.Post("/register", registerHandler(db))

	r.Post("/login", loginHandler(db))
	r.Get("/oauth/authorize", authorizeHandler(db))
	r.Post("/oauth/token", tokenHandler(db))
	r.Get("/oauth/me", meHandler(db))

	r.Get("/me/stats", meStatsHandler(db))
	r.Get("/me/history", meHistoryHandler(db))
	r.Post("/game/submit", submitGameHandler(db))
	r.Get("/admin/scores", adminScoresHandler(db))
	r.Get("/admin/users/{id}/history", adminUserHistoryHandler(db))

	r.Post("/users/{id}", DelUser(db))

	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	log.Println("API listening on", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}
