-- Additional Marketplace categories. Existing category IDs remain stable.
INSERT OR IGNORE INTO store_categories (id,name,description,icon,enabled,sort_order,created_at,updated_at)
VALUES
  ('cv-resume','CV & Resume Templates','Professional CVs, resumes and job application templates','🧑‍💼',1,13,strftime('%s','now'),strftime('%s','now')),
  ('presentations','Presentation Templates','Slides, pitch decks and presentation systems','🎞️',1,14,strftime('%s','now'),strftime('%s','now')),
  ('marketing-kits','Marketing Kits','Campaign, branding and marketing resources','📣',1,15,strftime('%s','now'),strftime('%s','now')),
  ('notion-templates','Notion Templates','Ready-to-use workspaces and productivity systems','🗂️',1,16,strftime('%s','now'),strftime('%s','now')),
  ('fonts-typography','Fonts & Typography','Typography resources and font products','🔤',1,17,strftime('%s','now'),strftime('%s','now')),
  ('productivity','Productivity','Systems, checklists and productivity resources','⚡',1,18,strftime('%s','now'),strftime('%s','now'));
