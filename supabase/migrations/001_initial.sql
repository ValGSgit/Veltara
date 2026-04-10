-- ============================================================
-- Veltara — Initial Schema Migration
-- Run against your Supabase project via: supabase db push
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE plan_tier AS ENUM ('free', 'pro', 'studio');
CREATE TYPE item_type AS ENUM ('cosmetic', 'marker', 'frame', 'emote');
CREATE TYPE item_rarity AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary');
CREATE TYPE api_key_tier AS ENUM ('sandbox', 'indie', 'studio', 'enterprise');

-- ────────────────────────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username          TEXT NOT NULL UNIQUE,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  avatar_url        TEXT,
  bio               TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plan_tier         plan_tier NOT NULL DEFAULT 'free',
  credits           INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  total_playtime    BIGINT NOT NULL DEFAULT 0,
  current_region    TEXT,
  stripe_customer_id        TEXT UNIQUE,
  stripe_subscription_id    TEXT UNIQUE,
  subscription_status       TEXT,
  subscription_period_end   TIMESTAMPTZ,
  stripe_connect_id         TEXT UNIQUE,
  mute_count        INTEGER NOT NULL DEFAULT 0,
  muted_until       TIMESTAMPTZ,
  embedding         vector(384)
);

CREATE INDEX users_username_idx ON users (username);
CREATE INDEX users_email_idx ON users (email);
CREATE INDEX users_plan_tier_idx ON users (plan_tier);
CREATE INDEX users_current_region_idx ON users (current_region);
CREATE INDEX users_embedding_idx ON users USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- ITEMS
-- ────────────────────────────────────────────────────────────

CREATE TABLE items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  type            item_type NOT NULL,
  rarity          item_rarity NOT NULL DEFAULT 'common',
  price_credits   INTEGER NOT NULL DEFAULT 0 CHECK (price_credits >= 0),
  asset_url       TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX items_type_idx ON items (type);
CREATE INDEX items_rarity_idx ON items (rarity);
CREATE INDEX items_active_idx ON items (is_active);

-- ────────────────────────────────────────────────────────────
-- INVENTORY
-- ────────────────────────────────────────────────────────────

CREATE TABLE inventory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  acquired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);

CREATE INDEX inventory_user_id_idx ON inventory (user_id);
CREATE INDEX inventory_item_id_idx ON inventory (item_id);

-- ────────────────────────────────────────────────────────────
-- POSTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (char_length(content) <= 5000),
  media_url       TEXT,
  region_id       TEXT,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted      BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX posts_user_id_idx ON posts (user_id);
CREATE INDEX posts_region_id_idx ON posts (region_id);
CREATE INDEX posts_created_at_idx ON posts (created_at DESC);
CREATE INDEX posts_active_idx ON posts (is_deleted) WHERE is_deleted = false;

-- ────────────────────────────────────────────────────────────
-- LIKES
-- ────────────────────────────────────────────────────────────

CREATE TABLE likes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX likes_user_id_idx ON likes (user_id);
CREATE INDEX likes_post_id_idx ON likes (post_id);

-- Trigger to update posts.likes_count
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER likes_count_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_likes_count();

-- ────────────────────────────────────────────────────────────
-- FOLLOWS
-- ────────────────────────────────────────────────────────────

CREATE TABLE follows (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX follows_follower_id_idx ON follows (follower_id);
CREATE INDEX follows_following_id_idx ON follows (following_id);

-- ────────────────────────────────────────────────────────────
-- COMMENTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX comments_user_id_idx ON comments (user_id);
CREATE INDEX comments_post_id_idx ON comments (post_id);
CREATE INDEX comments_created_at_idx ON comments (created_at);

-- Trigger to update posts.comments_count
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_deleted = true AND OLD.is_deleted = false) THEN
    UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0)
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_count_trigger
  AFTER INSERT OR DELETE OR UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comments_count();

-- ────────────────────────────────────────────────────────────
-- ACHIEVEMENTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE achievements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  achievement_type  TEXT NOT NULL,
  earned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_type)
);

CREATE INDEX achievements_user_id_idx ON achievements (user_id);
CREATE INDEX achievements_type_idx ON achievements (achievement_type);

-- ────────────────────────────────────────────────────────────
-- LEADERBOARD SCORES
-- ────────────────────────────────────────────────────────────

CREATE TABLE leaderboard_scores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  region_id   TEXT,
  score       BIGINT NOT NULL DEFAULT 0,
  period      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, region_id, period)
);

CREATE INDEX lb_user_id_idx ON leaderboard_scores (user_id);
CREATE INDEX lb_region_id_idx ON leaderboard_scores (region_id);
CREATE INDEX lb_period_score_idx ON leaderboard_scores (period, score DESC);

-- ────────────────────────────────────────────────────────────
-- API KEYS
-- ────────────────────────────────────────────────────────────

CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key_hash        TEXT NOT NULL UNIQUE,
  key_prefix      TEXT NOT NULL,
  name            TEXT NOT NULL,
  tier            api_key_tier NOT NULL DEFAULT 'sandbox',
  requests_today  INTEGER NOT NULL DEFAULT 0,
  requests_total  BIGINT NOT NULL DEFAULT 0,
  rate_limit      INTEGER NOT NULL DEFAULT 1000,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX api_keys_user_id_idx ON api_keys (user_id);
CREATE INDEX api_keys_hash_idx ON api_keys (key_hash);
CREATE INDEX api_keys_active_idx ON api_keys (is_active);

-- ────────────────────────────────────────────────────────────
-- MARKETPLACE LISTINGS
-- ────────────────────────────────────────────────────────────

CREATE TABLE marketplace_listings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id           UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  price_credits       INTEGER NOT NULL CHECK (price_credits > 0),
  stripe_product_id   TEXT,
  stripe_price_id     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX listings_seller_id_idx ON marketplace_listings (seller_id);
CREATE INDEX listings_item_id_idx ON marketplace_listings (item_id);
CREATE INDEX listings_active_idx ON marketplace_listings (is_active);

-- ────────────────────────────────────────────────────────────
-- REFRESH TOKENS
-- (Stored in Workers KV too, this is the source of truth)
-- ────────────────────────────────────────────────────────────

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_hash_idx ON refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

-- Enable RLS on all user-facing tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Users: public profiles are readable by all authenticated users;
--        only the owner can update their own record.
--        Service role bypasses RLS (used by Workers).
CREATE POLICY "users_select_public" ON users
  FOR SELECT USING (true);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::TEXT = id::TEXT);

-- Posts: visible if not deleted; only author can update/delete
CREATE POLICY "posts_select_active" ON posts
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "posts_insert_own" ON posts
  FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE USING (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY "posts_delete_own" ON posts
  FOR DELETE USING (auth.uid()::TEXT = user_id::TEXT);

-- Likes: users can see all likes; can only manage their own
CREATE POLICY "likes_select" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_own" ON likes
  FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id::TEXT);
CREATE POLICY "likes_delete_own" ON likes
  FOR DELETE USING (auth.uid()::TEXT = user_id::TEXT);

-- Follows: readable by all; manage own
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON follows
  FOR INSERT WITH CHECK (auth.uid()::TEXT = follower_id::TEXT);
CREATE POLICY "follows_delete_own" ON follows
  FOR DELETE USING (auth.uid()::TEXT = follower_id::TEXT);

-- Comments: readable if not deleted; author can manage
CREATE POLICY "comments_select" ON comments
  FOR SELECT USING (is_deleted = false);
CREATE POLICY "comments_insert_own" ON comments
  FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id::TEXT);
CREATE POLICY "comments_update_own" ON comments
  FOR UPDATE USING (auth.uid()::TEXT = user_id::TEXT);

-- Inventory: only owner sees their inventory
CREATE POLICY "inventory_select_own" ON inventory
  FOR SELECT USING (auth.uid()::TEXT = user_id::TEXT);

-- Items: public read
CREATE POLICY "items_select" ON items FOR SELECT USING (is_active = true);

-- Achievements: owner sees own; others see none via client
CREATE POLICY "achievements_select_own" ON achievements
  FOR SELECT USING (auth.uid()::TEXT = user_id::TEXT);

-- Leaderboard: public
CREATE POLICY "lb_select" ON leaderboard_scores FOR SELECT USING (true);

-- API Keys: only owner sees their own keys
CREATE POLICY "api_keys_select_own" ON api_keys
  FOR SELECT USING (auth.uid()::TEXT = user_id::TEXT);
CREATE POLICY "api_keys_insert_own" ON api_keys
  FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id::TEXT);
CREATE POLICY "api_keys_update_own" ON api_keys
  FOR UPDATE USING (auth.uid()::TEXT = user_id::TEXT);

-- Marketplace: active listings are public; seller manages their own
CREATE POLICY "listings_select_active" ON marketplace_listings
  FOR SELECT USING (is_active = true);
CREATE POLICY "listings_insert_own" ON marketplace_listings
  FOR INSERT WITH CHECK (auth.uid()::TEXT = seller_id::TEXT);
CREATE POLICY "listings_update_own" ON marketplace_listings
  FOR UPDATE USING (auth.uid()::TEXT = seller_id::TEXT);

-- Refresh tokens: only owner
CREATE POLICY "refresh_tokens_select_own" ON refresh_tokens
  FOR SELECT USING (auth.uid()::TEXT = user_id::TEXT);

-- ────────────────────────────────────────────────────────────
-- SEED DATA — Default Items
-- ────────────────────────────────────────────────────────────

INSERT INTO items (name, type, rarity, price_credits, asset_url, description) VALUES
  ('Starlight Skin', 'cosmetic', 'rare', 250, '/assets/items/starlight-skin.glb', 'A shimmering celestial avatar skin'),
  ('Aurora Marker', 'marker', 'uncommon', 100, '/assets/items/aurora-marker.glb', 'A glowing aurora borealis region marker'),
  ('Void Frame', 'frame', 'epic', 500, '/assets/items/void-frame.png', 'A dark void-themed profile frame'),
  ('Wave Emote', 'emote', 'common', 50, '/assets/items/wave-emote.json', 'A friendly wave animation'),
  ('Phoenix Skin', 'cosmetic', 'legendary', 1000, '/assets/items/phoenix-skin.glb', 'Legendary fiery phoenix avatar'),
  ('Crystal Marker', 'marker', 'rare', 200, '/assets/items/crystal-marker.glb', 'Crystalline region marker'),
  ('Neon Frame', 'frame', 'uncommon', 150, '/assets/items/neon-frame.png', 'Retro neon profile frame'),
  ('Dance Emote', 'emote', 'uncommon', 75, '/assets/items/dance-emote.json', 'Show off your dance moves');
