-- Nexauren Tools D1 schema
-- Database: nexauren-tools
-- Binding: TOOLS_DB
-- This database is isolated from the main billing/users database.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'draft')),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_features (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  access_level TEXT NOT NULL DEFAULT 'free' CHECK (access_level IN ('free', 'starter', 'pro', 'premium')),
  credit_cost INTEGER NOT NULL DEFAULT 0 CHECK (credit_cost >= 0),
  limits_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (tool_id, slug),
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_features_tool_id
  ON tool_features(tool_id);

CREATE TABLE IF NOT EXISTS tool_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  feature_id TEXT,
  request_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  provider TEXT,
  provider_job_id TEXT,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE RESTRICT,
  FOREIGN KEY (feature_id) REFERENCES tool_features(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_jobs_user_created
  ON tool_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_jobs_tool_status
  ON tool_jobs(tool_id, status);

CREATE INDEX IF NOT EXISTS idx_tool_jobs_provider_job
  ON tool_jobs(provider, provider_job_id);

CREATE TABLE IF NOT EXISTS tool_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  feature_id TEXT,
  job_id TEXT,
  request_id TEXT NOT NULL UNIQUE,
  credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('reserved', 'completed', 'failed', 'refunded')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE RESTRICT,
  FOREIGN KEY (feature_id) REFERENCES tool_features(id) ON DELETE SET NULL,
  FOREIGN KEY (job_id) REFERENCES tool_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_user_created
  ON tool_usage(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tool_usage_tool_created
  ON tool_usage(tool_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tool_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

-- Registry metadata for the first AI category.
INSERT OR IGNORE INTO tool_settings (key, value_json, updated_at)
VALUES ('schema_version', '{"version":1}', unixepoch());

INSERT OR IGNORE INTO tool_settings (key, value_json, updated_at)
VALUES ('ai_category_enabled', '{"enabled":true}', unixepoch());
