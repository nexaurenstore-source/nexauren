-- One-time Marketplace commerce records.
-- Payment records remain in nexauren-db; this database stores the product-side order lifecycle.

CREATE TABLE IF NOT EXISTS store_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_store_orders_user_created
  ON store_orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_orders_payment
  ON store_orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_status
  ON store_orders(status,created_at DESC);

CREATE TABLE IF NOT EXISTS store_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(order_id,product_id),
  FOREIGN KEY(order_id) REFERENCES store_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_store_order_items_order
  ON store_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_product
  ON store_order_items(product_id);

CREATE TABLE IF NOT EXISTS store_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER,
  UNIQUE(user_id,product_id,order_id),
  FOREIGN KEY(order_id) REFERENCES store_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_store_entitlements_user
  ON store_entitlements(user_id,status,granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_entitlements_product
  ON store_entitlements(product_id,status);
