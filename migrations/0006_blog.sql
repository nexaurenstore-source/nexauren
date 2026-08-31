-- Nexauren Blog schema
-- Dedicated D1 database: nexauren-blog

CREATE TABLE IF NOT EXISTS blog_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT 'Nexauren',
  category_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  seo_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  og_image TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS blog_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published
  ON blog_posts(status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON blog_posts(category_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_featured
  ON blog_posts(featured, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag
  ON blog_post_tags(tag_id, post_id);

-- Initial Nexauren Blog categories.
INSERT OR IGNORE INTO blog_categories (id, name, slug, description, created_at, updated_at)
VALUES
  ('cat-ai-technology', 'IA & Tecnologia', 'ia-tecnologia', 'Inteligência artificial, tecnologia e inovação.', unixepoch(), unixepoch()),
  ('cat-design-creativity', 'Design & Criatividade', 'design-criatividade', 'Design, criatividade e criação digital.', unixepoch(), unixepoch()),
  ('cat-audio-voice', 'Áudio & Voz', 'audio-voz', 'Áudio, voz, produção e experiências sonoras.', unixepoch(), unixepoch()),
  ('cat-tools', 'Ferramentas', 'ferramentas', 'Dicas e conteúdos sobre ferramentas digitais.', unixepoch(), unixepoch()),
  ('cat-tutorials', 'Tutoriais', 'tutoriais', 'Guias práticos para aprender e criar.', unixepoch(), unixepoch()),
  ('cat-nexauren-news', 'Nexauren News', 'nexauren-news', 'Novidades, lançamentos e atualizações do Nexauren.', unixepoch(), unixepoch()),
  ('cat-guides', 'Guias', 'guias', 'Guias completos e conteúdos de referência.', unixepoch(), unixepoch());
