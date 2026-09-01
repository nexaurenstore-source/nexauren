-- Webhook processing recovery metadata.
-- A claimed webhook can be safely reclaimed if a Worker invocation dies before completion.
ALTER TABLE webhook_events ADD COLUMN processing_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing
  ON webhook_events(status,processing_at);
