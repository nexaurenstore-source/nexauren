-- Complete product detail model for the Nexauren Marketplace.
-- Product pages are generated from these records; no product information is hardcoded in the frontend.

ALTER TABLE store_products ADD COLUMN short_description TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN cover_image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN gallery_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE store_products ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN long_description TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN features_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE store_products ADD COLUMN included_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE store_products ADD COLUMN requirements TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN license_type TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE store_products ADD COLUMN license_text TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN version TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN file_size TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN preview_url TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE store_products ADD COLUMN seo_title TEXT NOT NULL DEFAULT '';
ALTER TABLE store_products ADD COLUMN seo_description TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_store_products_slug ON store_products(slug);
CREATE INDEX IF NOT EXISTS idx_store_products_featured ON store_products(featured,enabled,sort_order);

-- Customer reviews are kept separate from the product aggregate rating.
CREATE TABLE IF NOT EXISTS store_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(product_id,user_id),
  FOREIGN KEY(product_id) REFERENCES store_products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_store_reviews_product ON store_reviews(product_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_reviews_user ON store_reviews(user_id,created_at DESC);

-- Persistent favorites are tied to the shared Nexauren identity.
CREATE TABLE IF NOT EXISTS store_wishlist (
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,product_id),
  FOREIGN KEY(product_id) REFERENCES store_products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_store_wishlist_user ON store_wishlist(user_id,created_at DESC);

-- Product files are metadata only. Actual private files should live in object storage;
-- the download endpoint must authorize against store_entitlements before serving them.
CREATE TABLE IF NOT EXISTS store_product_files (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  version TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(product_id) REFERENCES store_products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_store_product_files_product ON store_product_files(product_id,enabled,sort_order);
