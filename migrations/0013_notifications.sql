-- Move notification schema creation out of request-time code.
-- Notifications are now provisioned by the normal D1 migration process.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'information',
  priority TEXT NOT NULL DEFAULT 'LOW',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  archived_at INTEGER
);

CREATE TABLE IF NOT EXISTS notification_recipients (
  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(notification_id,user_id)
);

CREATE TABLE IF NOT EXISTS notification_audit_logs (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  admin_id TEXT,
  action TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_status
  ON notifications(status,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_user
  ON notification_recipients(user_id,read_at,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_audit_notification
  ON notification_audit_logs(notification_id,created_at DESC);
