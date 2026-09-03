-- First real free Marketplace product.
-- The downloadable resource is a text/Markdown digital product and requires no cover image.

INSERT OR IGNORE INTO store_products (
  id,name,slug,category_id,description,format,price_minor,currency,rating,icon,tag,featured,enabled,sort_order,metadata_json,created_at,updated_at,
  short_description,cover_image_url,gallery_json,video_url,long_description,features_json,included_json,requirements,license_type,license_text,version,file_size,preview_url,tags_json,seo_title,seo_description
) VALUES (
  'product-social-media-content-starter-pack',
  'Social Media Content Starter Pack',
  'social-media-content-starter-pack',
  'social-media',
  'A practical free content system with a 30-day calendar, ready-to-adapt captions, hooks, calls to action, video ideas, carousel structures and publishing workflows.',
  'MD',
  0,
  'USD',
  0,
  '📱',
  'FREE',
  1,
  1,
  1,
  '{"downloadUrl":"/nexauren-store/downloads/nexauren-social-media-content-starter-pack.md","license":"personal-commercial-content-use"}',
  strftime('%s','now'),
  strftime('%s','now'),
  'A complete free starter pack to plan, write and publish better social media content.',
  '',
  '[]',
  '',
  'Build a consistent social media workflow with a ready-to-use 30-day calendar plus practical content formulas. The pack is designed for creators, freelancers, small businesses, agencies and personal brands. It focuses on useful content, clear hooks, strong calls to action and repeatable publishing systems.',
  '["30-day content calendar","60 ready-to-adapt hooks","40 calls to action","25 short-form video ideas","20 carousel structures","15 promotional formulas","10 educational formulas","10 engagement formulas","Weekly publishing workflow","Pre-publishing quality checklist"]',
  '["30 complete post concepts","Ready-to-adapt captions","Hooks and CTAs","Video and carousel ideas","Content planning workflow","Usage license"]',
  'Markdown reader or any text editor.',
  'personal',
  'Free Nexauren resource. You may adapt the material for personal and commercial content creation and client work. You may not resell, redistribute or publish the pack itself as a competing standalone digital product.',
  '1.0',
  'markdown',
  '/nexauren-store/downloads/nexauren-social-media-content-starter-pack.md',
  '["social media","content calendar","captions","hooks","marketing","creator","business","free resource"]',
  'Free Social Media Content Starter Pack | Nexauren',
  'Download a free Nexauren social media content starter pack with a 30-day calendar, hooks, captions, CTAs, video ideas and content formulas.'
);

INSERT OR IGNORE INTO store_product_files (
  id,product_id,name,storage_key,file_size,mime_type,version,enabled,sort_order,created_at,updated_at
) VALUES (
  'file-social-media-content-starter-pack',
  'product-social-media-content-starter-pack',
  'nexauren-social-media-content-starter-pack.md',
  'frontend/nexauren-store/downloads/nexauren-social-media-content-starter-pack.md',
  0,
  'text/markdown',
  '1.0',
  1,
  1,
  strftime('%s','now'),
  strftime('%s','now')
);
