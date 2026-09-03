-- Nexauren Marketplace dedicated D1: nexauren-marketplace
-- Catalog only. Orders, payments, entitlements and secure delivery are added in later phases.

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

INSERT OR IGNORE INTO store_products
  (id,name,slug,category_id,description,format,price_minor,currency,rating,icon,tag,featured,enabled,sort_order,created_at,updated_at)
VALUES
  ('cv','Modern CV Template','modern-cv-template','documents','Clean, professional CV template for modern applications.','DOCX',499,'USD',4.9,'📄','Featured',1,1,1,strftime('%s','now'),strftime('%s','now')),
  ('invoice','Invoice & Quote Pack','invoice-quote-pack','business-kits','Ready-to-edit invoice, quote and receipt templates.','DOCX',699,'USD',4.8,'🧾','New',0,1,2,strftime('%s','now'),strftime('%s','now')),
  ('budget','Personal Budget Dashboard','personal-budget-dashboard','spreadsheets','Track income, expenses, goals and monthly progress.','XLSX',399,'USD',4.7,'📊','Popular',0,1,3,strftime('%s','now'),strftime('%s','now')),
  ('content','30-Day Content Calendar','30-day-content-calendar','social-media','Plan a month of consistent social content with ease.','Canva',799,'USD',4.9,'📱','Featured',1,1,4,strftime('%s','now'),strftime('%s','now')),
  ('prompts','Creator AI Prompt Pack','creator-ai-prompt-pack','ai-prompts','Practical prompts for writing, marketing and content creation.','TXT',299,'USD',4.6,'🤖','New',0,1,5,strftime('%s','now'),strftime('%s','now')),
  ('landing','SaaS Landing Page Kit','saas-landing-page-kit','website-assets','Responsive landing page sections ready for your next project.','HTML',1299,'USD',4.9,'🖥️','Premium',1,1,6,strftime('%s','now'),strftime('%s','now')),
  ('icons','Minimal UI Icon Set','minimal-ui-icon-set','design-assets','A versatile collection of clean interface icons.','PNG/SVG',899,'USD',4.8,'🎨','Popular',0,1,7,strftime('%s','now'),strftime('%s','now')),
  ('study','Study Planner Starter','study-planner-starter','education','Simple printable planner for study sessions and revision.','PDF',0,'USD',4.8,'📚','Free',0,1,8,strftime('%s','now'),strftime('%s','now')),
  ('email','Professional Email Pack','professional-email-pack','email-templates','Reusable welcome, support, launch and promotional emails.','TXT',449,'USD',4.7,'✉️','New',0,1,9,strftime('%s','now'),strftime('%s','now')),
  ('freelance','Freelancer Starter Bundle','freelancer-starter-bundle','bundles','A practical collection for proposals, invoices and planning.','DOCX',1999,'USD',4.9,'📦','Bundle',1,1,10,strftime('%s','now'),strftime('%s','now')),
  ('planner','Complete Productivity Planner','complete-productivity-planner','planners','Daily, weekly, monthly and goal planning in one pack.','PDF',999,'USD',4.8,'📅','Featured',1,1,11,strftime('%s','now'),strftime('%s','now')),
  ('code','Responsive Components Pack','responsive-components-pack','code','Reusable navigation, cards, modals and UI components.','JS',1499,'USD',4.9,'👨‍💻','Premium',1,1,12,strftime('%s','now'),strftime('%s','now'));
