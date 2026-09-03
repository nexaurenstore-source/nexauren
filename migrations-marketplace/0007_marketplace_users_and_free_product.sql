-- Marketplace identity mirror and first complete free product.
-- User credentials remain exclusively in nexauren-db; this D1 stores only marketplace profile data.
CREATE TABLE IF NOT EXISTS store_users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_store_users_email ON store_users(email);

-- First public Nexauren product: complete, free, and immediately claimable.
INSERT OR IGNORE INTO store_products (
  id,name,slug,category_id,description,short_description,long_description,format,price_minor,currency,
  rating,icon,tag,featured,enabled,sort_order,cover_image_url,gallery_json,video_url,features_json,included_json,
  requirements,license_type,license_text,version,file_size,preview_url,tags_json,seo_title,seo_description,metadata_json,created_at,updated_at
)
SELECT
  'nexauren-creator-starter-kit',
  'Nexauren Creator Starter Kit',
  'nexauren-creator-starter-kit',
  'productivity',
  'A free starter system for creators who want to plan, publish and organize digital work with Nexauren.',
  'A complete free creator starter kit with planning, content and publishing resources.',
  'Start creating with a practical, reusable digital workflow. This free starter kit is designed as the first official Nexauren Marketplace product and gives creators a structured foundation for planning ideas, preparing content, tracking publishing and organizing reusable assets.',
  'DIGITAL KIT',
  0,'USD',4.8,'🚀','FREE',1,1,0,'','[]','',
  '["Creator workflow checklist","Content planning system","Publishing checklist","Digital asset organization guide","Reusable AI prompt starter set"]',
  '["Creator Workflow Checklist","30-Day Content Planner","Publishing Checklist","Digital Asset Organizer","AI Prompt Starter Pack","Quick-start guide"]',
  'No special software is required. Use any modern browser and common document/spreadsheet apps.',
  'personal',
  'Free for personal and commercial creator use. You may adapt the included templates for your own projects. Do not resell or redistribute the original kit as a standalone product.',
  '1.0',
  '',
  '',
  '["free","creator","productivity","content","templates","nexauren"]',
  'Nexauren Creator Starter Kit — Free Digital Product',
  'Get the first complete free Nexauren Marketplace creator starter kit with planning, publishing and digital organization resources.',
  '{"productType":"starter-kit","access":"free","delivery":"digital","official":true,"contents":["Creator Workflow Checklist","30-Day Content Planner","Publishing Checklist","Digital Asset Organizer","AI Prompt Starter Pack","Quick-start guide"]}',
  strftime('%s','now'),strftime('%s','now')
WHERE EXISTS (SELECT 1 FROM store_categories WHERE id='productivity');

CREATE INDEX IF NOT EXISTS idx_store_products_free_featured ON store_products(price_minor,featured,enabled,sort_order);
