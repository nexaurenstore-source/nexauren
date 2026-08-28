-- Authentication hardening: metadata for login throttling.
-- The application may keep this table empty when no throttling events exist.
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_time
  ON auth_login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_time
  ON auth_login_attempts(ip_hash, created_at DESC);
