-- Studio/Experience ratings and private favorites.
-- Ratings are public; favorites are scoped to the authenticated user.
-- Keep the legacy tables intact until the Worker/API migration is deployed.

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('studio','experience')),
  studio_id TEXT NOT NULL,
  experience_id TEXT,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (target_type = 'studio' AND experience_id IS NULL) OR
    (target_type = 'experience' AND experience_id IS NOT NULL)
  ),
  UNIQUE(target_type, studio_id, experience_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_target
  ON ratings(target_type, studio_id, experience_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ratings_user
  ON ratings(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('studio','experience')),
  studio_id TEXT NOT NULL,
  experience_id TEXT,
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (
    (target_type = 'studio' AND experience_id IS NULL) OR
    (target_type = 'experience' AND experience_id IS NOT NULL)
  ),
  PRIMARY KEY (user_id, target_type, studio_id, experience_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON favorites(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_favorites_target
  ON favorites(target_type, studio_id, experience_id);
