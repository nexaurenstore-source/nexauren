-- Nexauren Marketplace dedicated D1: nexauren-marketplace
-- Catalog structure only. Real products are created through Marketplace administration.

CREATE TABLE IF NOT EXISTS store_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '📦',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'DIGITAL',
  price_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  rating REAL NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '📦',
  tag TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (category_id) REFERENCES store_categories(id)
);

CREATE INDEX IF NOT EXISTS idx_store_categories_enabled_order
  ON store_categories(enabled,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_store_products_enabled_order
  ON store_products(enabled,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_store_products_category
  ON store_products(category_id,enabled,sort_order);
CREATE INDEX IF NOT EXISTS idx_store_products_price
  ON store_products(price_minor,enabled);
CREATE INDEX IF NOT EXISTS idx_store_products_rating
  ON store_products(rating DESC,enabled);

INSERT OR IGNORE INTO store_categories
  (id,name,description,icon,enabled,sort_order,created_at,updated_at)
VALUES
  ('documents','Documents','CVs, forms & files','📄',1,1,strftime('%s','now'),strftime('%s','now')),
  ('social-media','Social Media','Content & campaigns','📱',1,2,strftime('%s','now'),strftime('%s','now')),
  ('business-kits','Business Kits','Ready-to-use business','💼',1,3,strftime('%s','now'),strftime('%s','now')),
  ('spreadsheets','Spreadsheets','Track & manage','📊',1,4,strftime('%s','now'),strftime('%s','now')),
  ('planners','Planners','Plan your work','📅',1,5,strftime('%s','now'),strftime('%s','now')),
  ('education','Education','Study & teaching','📚',1,6,strftime('%s','now'),strftime('%s','now')),
  ('ai-prompts','AI Prompts','Prompt collections','🤖',1,7,strftime('%s','now'),strftime('%s','now')),
  ('design-assets','Design Assets','Graphics & icons','🎨',1,8,strftime('%s','now'),strftime('%s','now')),
  ('website-assets','Website Assets','Web-ready UI','🖥️',1,9,strftime('%s','now'),strftime('%s','now')),
  ('code','Code','Code products','👨‍💻',1,10,strftime('%s','now'),strftime('%s','now')),
  ('email-templates','Email Templates','Professional emails','✉️',1,11,strftime('%s','now'),strftime('%s','now')),
  ('bundles','Bundles','Complete collections','📦',1,12,strftime('%s','now'),strftime('%s','now'));
