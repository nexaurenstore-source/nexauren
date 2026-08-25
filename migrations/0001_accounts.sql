-- Nexauren V1 account foundation
-- Safe, additive migration. No existing application data is removed.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tool_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  tool_id TEXT NOT NULL,
  tool_name TEXT,
  action TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  tool_id TEXT,
  tool_name TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_tool_usage_user_id_created_at ON tool_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user_id_created_at ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_tool_id_created_at ON activity_log(tool_id, created_at DESC);
