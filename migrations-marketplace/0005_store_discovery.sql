-- Marketplace discovery and merchandising data.
CREATE TABLE IF NOT EXISTS store_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_store_collections_enabled ON store_collections(enabled,sort_order);

CREATE TABLE IF NOT EXISTS store_collection_products (
  collection_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(collection_id,product_id),
  FOREIGN KEY(collection_id) REFERENCES store_collections(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES store_products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_store_collection_products_product ON store_collection_products(product_id);

CREATE TABLE IF NOT EXISTS store_product_views (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT,
  session_key TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(product_id) REFERENCES store_products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_store_product_views_product ON store_product_views(product_id,created_at DESC);

CREATE TABLE IF NOT EXISTS store_product_questions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  answered_at INTEGER,
  FOREIGN KEY(product_id) REFERENCES store_products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_store_product_questions_product ON store_product_questions(product_id,status,created_at DESC);
