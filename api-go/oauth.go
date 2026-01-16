package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type LoginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AccessClaims struct {
	UID  int64  `json:"uid"`
	Role string `json:"role"`
	jwt.RegisteredClaims
}

func sha256b64url(s string) string {
	sum := sha256.Sum256([]byte(s))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func getSessionUserID(db *sql.DB, r *http.Request) (int64, error) {
	c, err := r.Cookie("sid")
	if err != nil {
		return 0, errors.New("no session")
	}
	var userID int64
	var expires string
	row := db.QueryRow(`SELECT user_id, expires_at FROM sessions WHERE id = ?`, c.Value)
	if err := row.Scan(&userID, &expires); err != nil {
		return 0, errors.New("invalid session")
	}
	return userID, nil
}

func registerHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req LoginReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}

		req.Username = strings.TrimSpace(req.Username)
		if req.Username == "" || req.Password == "" {
			http.Error(w, "username/password required", http.StatusBadRequest)
			return
		}

		// ✅ hash password ก่อนเก็บ
		pwHash, err := hashPassword(req.Password)
		if err != nil {
			http.Error(w, "hash password failed", http.StatusInternalServerError)
			return
		}

		// ✅ insert user
		res, err := db.Exec(`
			INSERT INTO users(username,password,role)
			VALUES(?,?,?)
		`, req.Username, pwHash, "user")
		if err != nil {
			// ส่วนใหญ่คือ UNIQUE constraint (username ซ้ำ)
			http.Error(w, "username already exists", http.StatusBadRequest)
			return
		}

		// ✅ สร้าง player_stats ให้ user ใหม่เลย (score=0, streak=0)
		newID, _ := res.LastInsertId()
		_, _ = db.Exec(`
			INSERT OR IGNORE INTO player_stats(user_id, score, streak_wins)
			VALUES(?,?,?)
		`, newID, 0, 0)

		writeJSON(w, map[string]any{"ok": true})
	}
}

func loginHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req LoginReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad json", 400)
			return
		}

		var (
			userID int64
			hash   string
		)

		err := db.QueryRow(`
			SELECT id, password
			FROM users
			WHERE username = ?
		`, req.Username).Scan(&userID, &hash)

		if err != nil || !checkPassword(hash, req.Password) {
			http.Error(w, "invalid username or password", 401)
			return
		}

		createSession(w, db, userID)
		writeJSON(w, map[string]any{"ok": true})
	}
}

func authorizeHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie("login_uid")
		if err != nil {
			http.Error(w, "not logged in", 401)
			return
		}

		userID, _ := strconv.ParseInt(c.Value, 10, 64)

		q := r.URL.Query()
		if q.Get("response_type") != "code" {
			http.Error(w, "response_type must be code", 400)
			return
		}
		clientID := q.Get("client_id")
		redirectURI := q.Get("redirect_uri")
		state := q.Get("state")
		codeChallenge := q.Get("code_challenge")
		method := q.Get("code_challenge_method")

		if clientID == "" || redirectURI == "" || state == "" || codeChallenge == "" || method != "S256" {
			http.Error(w, "missing/invalid params", 400)
			return
		}

		var allowedRedirect string
		row := db.QueryRow(`SELECT redirect_uri FROM oauth_clients WHERE client_id = ?`, clientID)
		if err := row.Scan(&allowedRedirect); err != nil {
			http.Error(w, "invalid client_id", 400)
			return
		}
		if redirectURI != allowedRedirect {
			http.Error(w, "redirect_uri mismatch", 400)
			return
		}

		code := randURLSafe(32)
		expires := time.Now().Add(2 * time.Minute).Format(time.RFC3339)

		_, err = db.Exec(`
      INSERT INTO oauth_codes(code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at)
      VALUES(?,?,?,?,?,?,?)
    `, code, clientID, userID, redirectURI, codeChallenge, method, expires)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		u, _ := url.Parse(redirectURI)
		qq := u.Query()
		qq.Set("code", code)
		qq.Set("state", state)
		u.RawQuery = qq.Encode()

		http.Redirect(w, r, u.String(), http.StatusFound)
	}
}

func tokenHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad form", 400)
			return
		}
		if r.PostForm.Get("grant_type") != "authorization_code" {
			http.Error(w, "grant_type must be authorization_code", 400)
			return
		}

		code := r.PostForm.Get("code")
		clientID := r.PostForm.Get("client_id")
		redirectURI := r.PostForm.Get("redirect_uri")
		verifier := r.PostForm.Get("code_verifier")

		if code == "" || clientID == "" || redirectURI == "" || verifier == "" {
			http.Error(w, "missing params", 400)
			return
		}

		var userID int64
		var savedRedirect, challenge, method, expires string
		row := db.QueryRow(`
			SELECT user_id, redirect_uri, code_challenge, code_challenge_method, expires_at
			FROM oauth_codes
			WHERE code = ? AND client_id = ?
		`, code, clientID)
		if err := row.Scan(&userID, &savedRedirect, &challenge, &method, &expires); err != nil {
			http.Error(w, "invalid code", 400)
			return
		}
		if savedRedirect != redirectURI {
			http.Error(w, "redirect_uri mismatch", 400)
			return
		}
		if method != "S256" {
			http.Error(w, "unsupported code_challenge_method", 400)
			return
		}
		if sha256b64url(verifier) != challenge {
			http.Error(w, "pkce verification failed", 400)
			return
		}

		// one-time use
		_, _ = db.Exec(`DELETE FROM oauth_codes WHERE code = ?`, code)

		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			http.Error(w, "missing JWT_SECRET", 500)
			return
		}

		// fetch role
		role := "user"
		_ = db.QueryRow(`SELECT role FROM users WHERE id = ?`, userID).Scan(&role)
		if role == "" {
			role = "user"
		}

		now := time.Now()

		// ✅ แนะนำ: ใช้ MapClaims จะง่ายและชัด
		claims := jwt.MapClaims{
			"iss":  "ticox-auth",
			"sub":  int64ToString(userID), // มาตรฐาน: string
			"aud":  clientID,
			"iat":  now.Unix(),
			"exp":  now.Add(30 * time.Minute).Unix(),
			"uid":  userID, // ✅ สำคัญ: userID เป็นตัวเลข
			"role": role,   // ✅ สำคัญ: role
			// "jti": randomString(24), // ถ้าคุณมีฟังก์ชันสุ่ม จะใส่ก็ได้
		}

		t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		accessToken, err := t.SignedString([]byte(jwtSecret))
		if err != nil {
			http.Error(w, "sign token failed", 500)
			return
		}

		writeJSON(w, map[string]any{
			"access_token": accessToken,
			"token_type":   "Bearer",
			"expires_in":   1800,
		})
	}
}

func int64ToString(v int64) string {
	// ไม่ใช้ fmt เพื่อให้เร็ว/สั้น
	s := ""
	if v == 0 {
		return "0"
	}
	n := v
	buf := make([]byte, 0, 20)
	for n > 0 {
		d := byte(n % 10)
		buf = append([]byte{'0' + d}, buf...)
		n /= 10
	}
	s = string(buf)
	return s
}

func parseBearer(r *http.Request) (string, error) {
	h := r.Header.Get("Authorization")
	if h == "" || !strings.HasPrefix(h, "Bearer ") {
		return "", errors.New("missing bearer")
	}
	return strings.TrimPrefix(h, "Bearer "), nil
}

func requireAccessToken(next func(w http.ResponseWriter, r *http.Request, userID int64, role string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, err := parseBearer(r)
		if err != nil {
			http.Error(w, "unauthorized", 401)
			return
		}
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			http.Error(w, "missing JWT_SECRET", 500)
			return
		}

		tok, err := jwt.ParseWithClaims(raw, &AccessClaims{}, func(token *jwt.Token) (any, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !tok.Valid {
			http.Error(w, "invalid token", 401)
			return
		}
		claims := tok.Claims.(*AccessClaims)
		userID := stringToInt64(claims.Subject)
		next(w, r, userID, claims.Role)
	}
}

func stringToInt64(s string) int64 {
	var n int64
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < '0' || c > '9' {
			break
		}
		n = n*10 + int64(c-'0')
	}
	return n
}

func meHandler(db *sql.DB) http.HandlerFunc {
	return requireAccessToken(func(w http.ResponseWriter, r *http.Request, userID int64, role string) {
		var username string
		_ = db.QueryRow(`SELECT username FROM users WHERE id = ?`, userID).Scan(&username)

		writeJSON(w, map[string]any{
			"userID":   userID,
			"role":     role,
			"username": username,
		})
	})
}
