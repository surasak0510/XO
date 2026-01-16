package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type Move struct {
	P string `json:"p"`
	I int    `json:"i"`
}

type SubmitGameRequest struct {
	Result string   `json:"result"` // WIN/LOSE/DRAW
	Board  []string `json:"board"`  // len=9
	Moves  []Move   `json:"moves"`
}

type MatchItem struct {
	ID        int64  `json:"id"`
	Result    string `json:"result"`     // WIN/LOSE/DRAW
	BoardJSON string `json:"board_json"` // string JSON
	CreatedAt string `json:"created_at"`
}

func meHistoryHandler(db *sql.DB) http.HandlerFunc {
	return requireAccessToken(func(w http.ResponseWriter, r *http.Request, userID int64, role string) {
		limit := 20

		rows, err := db.Query(`
			SELECT id, result, board_json, created_at
			FROM matches
			WHERE user_id = ?
			ORDER BY datetime(created_at) DESC, id DESC
			LIMIT ?
		`, userID, limit)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		defer rows.Close()

		out := []MatchItem{}
		for rows.Next() {
			var it MatchItem
			if err := rows.Scan(&it.ID, &it.Result, &it.BoardJSON, &it.CreatedAt); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			out = append(out, it)
		}

		writeJSON(w, out)
	})
}

func ensureStats(db *sql.DB, userID int64) {
	_, _ = db.Exec(`INSERT OR IGNORE INTO player_stats(user_id, score, streak_wins) VALUES(?,0,0)`, userID)
}

func updateScoreTx(db *sql.DB, userID int64, result string) (score int64, streak int64, err error) {
	tx, err := db.Begin()
	if err != nil {
		return 0, 0, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var curScore, curStreak int64
	row := tx.QueryRow(`SELECT score, streak_wins FROM player_stats WHERE user_id = ?`, userID)
	if err = row.Scan(&curScore, &curStreak); err != nil {
		return 0, 0, err
	}

	switch result {
	case "WIN":
		curStreak++
		if curStreak == 3 {
			curScore += 2
			curStreak = 0
		} else {
			curScore += 1
		}
	case "LOSE":
		curScore -= 1
		curStreak = 0
	case "DRAW":
		curStreak = 0
	default:
		return 0, 0, http.ErrNotSupported
	}

	_, err = tx.Exec(`UPDATE player_stats SET score=?, streak_wins=?, updated_at=datetime('now') WHERE user_id=?`,
		curScore, curStreak, userID)
	if err != nil {
		return 0, 0, err
	}

	err = tx.Commit()
	if err != nil {
		return 0, 0, err
	}
	return curScore, curStreak, nil
}

func saveMatch(db *sql.DB, userID int64, result string, board []string, moves []Move) {
	b1, _ := json.Marshal(board)
	b2, _ := json.Marshal(moves)
	b3, _ := json.Marshal(map[string]any{"bot": "basic"})
	_, _ = db.Exec(`INSERT INTO matches(user_id,result,board_json,moves_json,meta_json) VALUES(?,?,?,?,?)`,
		userID, result, string(b1), string(b2), string(b3))
}

func meStatsHandler(db *sql.DB) http.HandlerFunc {
	return requireAccessToken(func(w http.ResponseWriter, r *http.Request, userID int64, role string) {
		ensureStats(db, userID)

		var score, streak int64
		_ = db.QueryRow(`SELECT score, streak_wins FROM player_stats WHERE user_id=?`, userID).Scan(&score, &streak)
		writeJSON(w, map[string]any{"score": score, "streakWins": streak})
	})
}

func submitGameHandler(db *sql.DB) http.HandlerFunc {
	return requireAccessToken(func(w http.ResponseWriter, r *http.Request, userID int64, role string) {
		ensureStats(db, userID)

		var req SubmitGameRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad json", 400)
			return
		}

		score, streak, err := updateScoreTx(db, userID, req.Result)
		if err != nil {
			http.Error(w, "invalid result", 400)
			return
		}
		saveMatch(db, userID, req.Result, req.Board, req.Moves)

		writeJSON(w, map[string]any{
			"ok": true, "newScore": score, "streakWins": streak,
		})
	})
}

func adminUserHistoryHandler(db *sql.DB) http.HandlerFunc {
	return requireAccessToken(func(w http.ResponseWriter, r *http.Request, authedUserID int64, role string) {
		if role != "admin" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		idStr := chi.URLParam(r, "id")
		targetID, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || targetID <= 0 {
			http.Error(w, "bad user id", 400)
			return
		}

		rows, err := db.Query(`
			SELECT id, result, board_json, created_at
			FROM matches
			WHERE user_id = ?
			ORDER BY datetime(created_at) DESC, id DESC
			LIMIT 50
		`, targetID)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		defer rows.Close()

		out := []map[string]any{}
		for rows.Next() {
			var id int64
			var result, boardJSON, createdAt string
			if err := rows.Scan(&id, &result, &boardJSON, &createdAt); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			out = append(out, map[string]any{
				"id":         id,
				"result":     result,
				"board_json": boardJSON,
				"created_at": createdAt,
			})
		}

		writeJSON(w, out)
	})
}

func adminScoresHandler(db *sql.DB) http.HandlerFunc {
	return requireAccessToken(func(w http.ResponseWriter, r *http.Request, userID int64, role string) {
		if role != "admin" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		rows, err := db.Query(`
			SELECT u.id, u.username, u.role, ps.score, ps.streak_wins, ps.updated_at
			FROM users u
			JOIN player_stats ps ON ps.user_id = u.id
			ORDER BY ps.score DESC, ps.updated_at DESC
		`)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		defer rows.Close()

		out := []map[string]any{}
		for rows.Next() {
			var id int64
			var username, urole string
			var score, streak int64
			var updatedAt string
			if err := rows.Scan(&id, &username, &urole, &score, &streak, &updatedAt); err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			out = append(out, map[string]any{
				"id":         id,
				"username":   username,
				"role":       urole,
				"score":      score,
				"streakWins": streak,
				"updatedAt":  updatedAt,
			})
		}

		writeJSON(w, out)
	})
}
