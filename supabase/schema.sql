-- ShelfArc Database Schema

-- This script is intended to be re-runnable (idempotent) on an already-correct database.
--
-- DESTRUCTIVE: the block below is intentionally commented out.  Uncomment ONLY when
-- you want to drop and fully recreate the schema (order respects dependencies).
--
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
-- DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
-- DROP TRIGGER IF EXISTS update_series_updated_at ON public.series;
-- DROP TRIGGER IF EXISTS update_volumes_updated_at ON public.volumes;
-- DROP TRIGGER IF EXISTS update_price_alerts_updated_at ON public.price_alerts;
--
-- DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can view their own series" ON public.series;
-- DROP POLICY IF EXISTS "Users can insert their own series" ON public.series;
-- DROP POLICY IF EXISTS "Users can update their own series" ON public.series;
-- DROP POLICY IF EXISTS "Users can delete their own series" ON public.series;
-- DROP POLICY IF EXISTS "Users can view their own volumes" ON public.volumes;
-- DROP POLICY IF EXISTS "Users can insert their own volumes" ON public.volumes;
-- DROP POLICY IF EXISTS "Users can update their own volumes" ON public.volumes;
-- DROP POLICY IF EXISTS "Users can delete their own volumes" ON public.volumes;
-- DROP POLICY IF EXISTS "Users can view their own tags" ON public.tags;
-- DROP POLICY IF EXISTS "Users can insert their own tags" ON public.tags;
-- DROP POLICY IF EXISTS "Users can update their own tags" ON public.tags;
-- DROP POLICY IF EXISTS "Users can delete their own tags" ON public.tags;
-- DROP POLICY IF EXISTS "Users can view their own price history" ON public.price_history;
-- DROP POLICY IF EXISTS "Users can insert their own price history" ON public.price_history;
-- DROP POLICY IF EXISTS "Users can view their own price alerts" ON public.price_alerts;
-- DROP POLICY IF EXISTS "Users can insert their own price alerts" ON public.price_alerts;
-- DROP POLICY IF EXISTS "Users can update their own price alerts" ON public.price_alerts;
-- DROP POLICY IF EXISTS "Users can delete their own price alerts" ON public.price_alerts;
-- DROP POLICY IF EXISTS "Users can view their own activity events" ON public.activity_events;
-- DROP POLICY IF EXISTS "Users can insert their own activity events" ON public.activity_events;
--
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP FUNCTION IF EXISTS public.sync_profile_email();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP FUNCTION IF EXISTS public.backup_list_tables();
-- DROP FUNCTION IF EXISTS public.delete_series_atomic(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.rate_limit_consume(text, integer, integer, integer);
-- DROP FUNCTION IF EXISTS public.rate_limit_cleanup(integer);
-- DROP FUNCTION IF EXISTS public.activity_events_cleanup(integer);
--
-- DROP TABLE IF EXISTS public.activity_events CASCADE;
-- DROP TABLE IF EXISTS public.price_alerts CASCADE;
-- DROP TABLE IF EXISTS public.price_history CASCADE;
-- DROP TABLE IF EXISTS public.rate_limit_buckets CASCADE;
-- DROP TABLE IF EXISTS public.tags CASCADE;
-- DROP TABLE IF EXISTS public.volumes CASCADE;
-- DROP TABLE IF EXISTS public.series CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
--
-- DROP TYPE IF EXISTS public.activity_event_type CASCADE;
-- DROP TYPE IF EXISTS public.volume_format CASCADE;
-- DROP TYPE IF EXISTS public.volume_edition CASCADE;
-- DROP TYPE IF EXISTS public.series_status CASCADE;
-- DROP TYPE IF EXISTS public.reading_status CASCADE;
-- DROP TYPE IF EXISTS public.ownership_status CASCADE;
-- DROP TYPE IF EXISTS public.title_type CASCADE;
--
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Custom types
-- (kept idempotent using to_regtype checks)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regtype('public.activity_event_type') IS NULL THEN
    CREATE TYPE public.activity_event_type AS ENUM (
      'volume_added',
      'volume_updated',
      'volume_deleted',
      'series_created',
      'series_updated',
      'series_deleted',
      'price_alert_triggered',
      'import_completed',
      'scrape_completed',
      'automation_executed',
      'api_token_created',
      'api_token_revoked'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'import_complete',
      'scrape_complete',
      'price_alert',
      'release_reminder',
      'info'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('public.ownership_status') IS NULL THEN
    CREATE TYPE public.ownership_status AS ENUM ('owned', 'wishlist');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('public.reading_status') IS NULL THEN
    CREATE TYPE public.reading_status AS ENUM ('unread', 'reading', 'completed', 'on_hold', 'dropped');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('public.series_status') IS NULL THEN
    CREATE TYPE public.series_status AS ENUM ('ongoing', 'completed', 'hiatus', 'cancelled', 'announced');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('public.title_type') IS NULL THEN
    CREATE TYPE public.title_type AS ENUM ('light_novel', 'manga', 'other');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('public.volume_edition') IS NULL THEN
    CREATE TYPE public.volume_edition AS ENUM ('standard', 'first_edition', 'collectors', 'omnibus', 'box_set', 'limited', 'deluxe');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('public.volume_format') IS NULL THEN
    CREATE TYPE public.volume_format AS ENUM ('paperback', 'hardcover', 'digital', 'audiobook');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tables (grouped and ordered by dependency)
-- -----------------------------------------------------------------------------

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id INT GENERATED BY DEFAULT AS IDENTITY UNIQUE NOT NULL,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}' NOT NULL,
  is_public BOOLEAN DEFAULT FALSE NOT NULL,
  public_bio TEXT,
  public_stats BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles (LOWER(username));
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'chk_username_format'
         AND conrelid = to_regclass('public.profiles')
     ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT chk_username_format
      CHECK (username ~ '^\w{3,20}$');
  END IF;
END $$;

-- Backfill profiles from existing auth.users
INSERT INTO public.profiles (id, email, username, avatar_url, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) AS username,
  u.raw_user_meta_data->>'avatar_url' AS avatar_url,
  COALESCE(u.created_at, NOW()) AS created_at,
  COALESCE(u.updated_at, u.created_at, NOW()) AS updated_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Series table (groups volumes together)
CREATE TABLE IF NOT EXISTS series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_title TEXT,
  description TEXT,
  notes TEXT,
  author TEXT,
  artist TEXT,
  publisher TEXT,
  cover_image_url TEXT,
  type title_type DEFAULT 'manga' NOT NULL,
  total_volumes INTEGER,
  status series_status,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Series indexes
CREATE INDEX IF NOT EXISTS idx_series_author_trgm ON series USING gin (author gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_series_publisher_trgm ON series USING GIN (publisher gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_series_tags ON series USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_series_title_trgm ON series USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_series_user_title ON series(user_id, title);
CREATE INDEX IF NOT EXISTS idx_series_user_type ON series(user_id, type);
CREATE INDEX IF NOT EXISTS idx_series_user_updated ON series(user_id, updated_at DESC);

-- Volumes table (individual books/volumes)
CREATE TABLE IF NOT EXISTS volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES series(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  volume_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  isbn TEXT,
  cover_image_url TEXT,
  edition volume_edition,
  format volume_format,
  page_count INTEGER,
  publish_date DATE,
  purchase_date DATE,
  purchase_price DECIMAL(10, 2),
  purchase_currency TEXT NOT NULL DEFAULT 'USD',
  ownership_status ownership_status DEFAULT 'owned' NOT NULL,
  reading_status reading_status DEFAULT 'unread' NOT NULL,
  current_page INTEGER,
  amazon_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  notes TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  release_reminder BOOLEAN DEFAULT FALSE NOT NULL,
  
  UNIQUE(series_id, volume_number, edition)
);

-- Volumes indexes
CREATE INDEX IF NOT EXISTS idx_volumes_release_reminder
  ON volumes(user_id, publish_date)
  WHERE publish_date IS NOT NULL AND release_reminder = TRUE;
CREATE INDEX IF NOT EXISTS idx_volumes_series_id ON volumes(series_id);
CREATE INDEX IF NOT EXISTS idx_volumes_series_number ON volumes(series_id, volume_number);
CREATE INDEX IF NOT EXISTS idx_volumes_user_id ON volumes(user_id);
CREATE INDEX IF NOT EXISTS idx_volumes_user_isbn ON volumes(user_id, isbn);
CREATE INDEX IF NOT EXISTS idx_volumes_user_ownership ON volumes(user_id, ownership_status);
CREATE INDEX IF NOT EXISTS idx_volumes_user_publish_date ON volumes(user_id, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_volumes_user_purchase_date ON volumes(user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_volumes_user_reading ON volumes(user_id, reading_status);
CREATE INDEX IF NOT EXISTS idx_volumes_user_series ON volumes(user_id, series_id);
CREATE INDEX IF NOT EXISTS idx_volumes_user_updated ON volumes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_volumes_volume_number ON public.volumes USING btree (volume_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_volumes_unique_null_edition
  ON volumes(series_id, volume_number)
  WHERE edition IS NULL;

-- Tags table (user-defined tags)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- Distributed rate-limit buckets (shared across instances)
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ NOT NULL DEFAULT TO_TIMESTAMP(0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_blocked_until
  ON rate_limit_buckets(blocked_until);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_updated_at
  ON rate_limit_buckets(updated_at);

-- Lock down internal table: rate_limit_buckets
REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC;
DO $$
BEGIN
  IF to_regrole('anon') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.rate_limit_buckets FROM anon';
  END IF;

  IF to_regrole('authenticated') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.rate_limit_buckets FROM authenticated';
  END IF;
END $$;

-- Price history table (append-only, no updates)
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id UUID NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT NOT NULL DEFAULT 'amazon',
  product_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_user_id ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_user_scraped
  ON price_history(user_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_volume_id ON price_history(volume_id);
CREATE INDEX IF NOT EXISTS idx_price_history_volume_scraped
  ON price_history(volume_id, scraped_at DESC);

-- Price alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id UUID NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_price DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  enabled BOOLEAN DEFAULT true NOT NULL,
  triggered_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(volume_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user_enabled ON price_alerts(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_volume_id ON price_alerts(volume_id);

-- Activity events table (append-only timeline)
CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type activity_event_type NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_events_entity
  ON activity_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_created
  ON activity_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_event_type
  ON activity_events(user_id, event_type);


-- Notifications table (server-synced user notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id) WHERE NOT read;

-- Collections (persisted user/system shelves)
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4682b4',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_volumes (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  volume_id UUID NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (collection_id, volume_id)
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_volumes_collection ON collection_volumes(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_volumes_user ON collection_volumes(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_volumes_volume ON collection_volumes(volume_id);

CREATE TABLE IF NOT EXISTS import_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  format      TEXT        NOT NULL CHECK (format IN ('json','csv-isbn','csv-shelfarc','mal','anilist','goodreads','barcode')),
  series_added INT        NOT NULL DEFAULT 0,
  volumes_added INT       NOT NULL DEFAULT 0,
  errors      INT         NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_events_user_id ON import_events(user_id, imported_at DESC);

-- -----------------------------------------------------------------------------
-- Row Level Security (enable + policies grouped per-table)
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view their own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((select auth.uid()) = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update their own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id)';
  END IF;
END $$;

-- Public profile access policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Anyone can view public profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can view public profiles" ON public.profiles FOR SELECT USING (is_public = TRUE)';
  END IF;
END $$;

ALTER TABLE series ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'series'
      AND policyname = 'Users can view their own series'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own series" ON public.series FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'series'
      AND policyname = 'Users can insert their own series'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own series" ON public.series FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'series'
      AND policyname = 'Users can update their own series'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own series" ON public.series FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'series'
      AND policyname = 'Users can delete their own series'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own series" ON public.series FOR DELETE USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

-- Public series access policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'series' AND policyname = 'Anyone can view public series'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can view public series" ON public.series FOR SELECT USING (is_public = TRUE)';
  END IF;
END $$;

ALTER TABLE volumes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volumes'
      AND policyname = 'Users can view their own volumes'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own volumes" ON public.volumes FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volumes'
      AND policyname = 'Users can insert their own volumes'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own volumes" ON public.volumes FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volumes'
      AND policyname = 'Users can update their own volumes'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own volumes" ON public.volumes FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'volumes'
      AND policyname = 'Users can delete their own volumes'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own volumes" ON public.volumes FOR DELETE USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

-- Public volumes access policy (volumes belonging to public series)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'volumes' AND policyname = 'Anyone can view volumes of public series'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can view volumes of public series" ON public.volumes FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.series s WHERE s.id = series_id AND s.is_public = TRUE)
    )';
  END IF;
END $$;

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tags'
      AND policyname = 'Users can view their own tags'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own tags" ON public.tags FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tags'
      AND policyname = 'Users can insert their own tags'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own tags" ON public.tags FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tags'
      AND policyname = 'Users can update their own tags'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own tags" ON public.tags FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tags'
      AND policyname = 'Users can delete their own tags'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own tags" ON public.tags FOR DELETE USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'price_history'
      AND policyname = 'Users can view their own price history'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own price history" ON public.price_history FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'price_history'
      AND policyname = 'Users can insert their own price history'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own price history" ON public.price_history FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;
END $$;

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'price_alerts'
      AND policyname = 'Users can view their own price alerts'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own price alerts" ON public.price_alerts FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'price_alerts'
      AND policyname = 'Users can insert their own price alerts'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own price alerts" ON public.price_alerts FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'price_alerts'
      AND policyname = 'Users can update their own price alerts'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own price alerts" ON public.price_alerts FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'price_alerts'
      AND policyname = 'Users can delete their own price alerts'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own price alerts" ON public.price_alerts FOR DELETE USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activity_events'
      AND policyname = 'Users can view their own activity events'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own activity events" ON public.activity_events FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activity_events'
      AND policyname = 'Users can insert their own activity events'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own activity events" ON public.activity_events FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;
END $$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can view their own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can insert their own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own notifications" ON public.notifications FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can update their own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can delete their own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collections'
      AND policyname = 'Users can view their own collections'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own collections" ON public.collections FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collections'
      AND policyname = 'Users can insert their own collections'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own collections" ON public.collections FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collections'
      AND policyname = 'Users can update their own collections'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own collections" ON public.collections FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collections'
      AND policyname = 'Users can delete their own collections'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own collections" ON public.collections FOR DELETE USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

ALTER TABLE collection_volumes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_volumes'
      AND policyname = 'Users can view their own collection_volumes'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own collection_volumes" ON public.collection_volumes FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_volumes'
      AND policyname = 'Users can insert their own collection_volumes'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own collection_volumes" ON public.collection_volumes FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'collection_volumes'
      AND policyname = 'Users can delete their own collection_volumes'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own collection_volumes" ON public.collection_volumes FOR DELETE USING ((select auth.uid()) = user_id)';
  END IF;
END $$;

ALTER TABLE import_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'import_events'
      AND policyname = 'Users can view their own import events'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own import events" ON public.import_events FOR SELECT USING ((select auth.uid()) = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'import_events'
      AND policyname = 'Users can insert their own import events'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own import events" ON public.import_events FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

-- Cleanup helper to prevent unbounded growth of activity_events
-- Schedule this (daily/hourly) using pg_cron or a scheduled Supabase task.
CREATE OR REPLACE FUNCTION public.activity_events_cleanup(p_max_age_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz := v_now - make_interval(days => GREATEST(p_max_age_days, 1));
  v_deleted integer;
BEGIN
  DELETE FROM public.activity_events
  WHERE created_at < v_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.activity_events_cleanup(integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activity_events_cleanup(integer)
  TO service_role;

-- Helper function to list all public tables for backups
CREATE OR REPLACE FUNCTION public.backup_list_tables()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT tablename::text
  FROM pg_catalog.pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'sql_%'
  ORDER BY tablename;
$$;

REVOKE ALL ON FUNCTION public.backup_list_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backup_list_tables() TO service_role;

-- Atomic delete helper to clean up series + volumes in one transaction with proper permission checks
CREATE OR REPLACE FUNCTION public.delete_series_atomic(p_series_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.series WHERE id = p_series_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'series_not_found';
  END IF;

  DELETE FROM public.volumes WHERE series_id = p_series_id AND user_id = p_user_id;

  DELETE FROM public.series WHERE id = p_series_id AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_series_atomic(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_series_atomic(UUID, UUID)
  TO authenticated;

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  raw_username TEXT;
  final_username TEXT;
BEGIN
  raw_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  -- Strip non-word characters
  final_username := regexp_replace(raw_username, '[^\w]', '_', 'g');

  -- Pad short usernames
  IF length(final_username) < 3 THEN
    final_username := final_username || repeat('_', 3 - length(final_username));
  END IF;

  -- Truncate long usernames
  final_username := left(final_username, 20);

  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, final_username);
  RETURN NEW;
END;
$$;

-- Cleanup helper to prevent unbounded growth of notifications
CREATE OR REPLACE FUNCTION public.notifications_cleanup(p_max_age_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz := v_now - make_interval(days => GREATEST(p_max_age_days, 1));
  v_deleted integer;
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < v_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.notifications_cleanup(integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notifications_cleanup(integer)
  TO service_role;

-- Atomic distributed rate-limit consume helper
CREATE OR REPLACE FUNCTION public.rate_limit_consume(
  p_key text,
  p_max_hits integer,
  p_window_ms integer,
  p_cooldown_ms integer DEFAULT 0
)
RETURNS TABLE(allowed boolean, retry_after_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_row public.rate_limit_buckets%ROWTYPE;
  v_window interval;
  v_cooldown interval;
  v_remaining interval;
BEGIN
  IF p_key IS NULL
     OR btrim(p_key) = ''
     OR p_max_hits <= 0
     OR p_window_ms <= 0
     OR p_cooldown_ms < 0 THEN
    allowed := false;
    retry_after_ms := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  v_window := make_interval(secs => p_window_ms::numeric / 1000.0);
  v_cooldown := make_interval(secs => p_cooldown_ms::numeric / 1000.0);

  INSERT INTO public.rate_limit_buckets AS b (
    key,
    hits,
    window_started_at,
    blocked_until,
    updated_at
  )
  VALUES (p_key, 0, v_now, to_timestamp(0), v_now)
  ON CONFLICT (key) DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.rate_limit_buckets
  WHERE key = p_key
  FOR UPDATE;

  IF v_row.blocked_until > v_now THEN
    v_remaining := v_row.blocked_until - v_now;
    allowed := false;
    retry_after_ms := GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM v_remaining) * 1000)
    )::integer;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.window_started_at + v_window <= v_now THEN
    v_row.hits := 0;
    v_row.window_started_at := v_now;
    v_row.blocked_until := to_timestamp(0);
  END IF;

  v_row.hits := v_row.hits + 1;

  IF v_row.hits > p_max_hits THEN
    IF p_cooldown_ms > 0 THEN
      v_row.blocked_until := v_now + v_cooldown;
    ELSE
      v_row.blocked_until := v_row.window_started_at + v_window;
    END IF;

    UPDATE public.rate_limit_buckets
    SET hits = v_row.hits,
        window_started_at = v_row.window_started_at,
        blocked_until = v_row.blocked_until,
        updated_at = v_now
    WHERE key = p_key;

    v_remaining := v_row.blocked_until - v_now;
    allowed := false;
    retry_after_ms := GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM v_remaining) * 1000)
    )::integer;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.rate_limit_buckets
  SET hits = v_row.hits,
      window_started_at = v_row.window_started_at,
      blocked_until = v_row.blocked_until,
      updated_at = v_now
  WHERE key = p_key;

  allowed := true;
  retry_after_ms := 0;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_consume(text, integer, integer, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_consume(text, integer, integer, integer)
  TO service_role;

-- Cleanup helper to prevent unbounded growth of rate_limit_buckets
-- Schedule this (daily/hourly) using pg_cron or a scheduled Supabase task.
CREATE OR REPLACE FUNCTION public.rate_limit_cleanup(p_max_age_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz := v_now - make_interval(days => GREATEST(p_max_age_days, 1));
  v_deleted integer;
BEGIN
  DELETE FROM public.rate_limit_buckets
  WHERE updated_at < v_cutoff
    AND blocked_until <= v_now;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_cleanup(integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_cleanup(integer)
  TO service_role;

-- Function to sync profile email when auth.users email changes
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Triggers (created after functions exist)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'on_auth_user_created'
         AND tgrelid = to_regclass('auth.users')
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'on_auth_user_email_change'
         AND tgrelid = to_regclass('auth.users')
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER on_auth_user_email_change
      AFTER UPDATE OF email ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.price_alerts') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'update_price_alerts_updated_at'
         AND tgrelid = to_regclass('public.price_alerts')
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER update_price_alerts_updated_at
      BEFORE UPDATE ON public.price_alerts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'update_profiles_updated_at'
         AND tgrelid = to_regclass('public.profiles')
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.series') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'update_series_updated_at'
         AND tgrelid = to_regclass('public.series')
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER update_series_updated_at
      BEFORE UPDATE ON public.series
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.volumes') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_trigger
       WHERE tgname = 'update_volumes_updated_at'
         AND tgrelid = to_regclass('public.volumes')
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER update_volumes_updated_at
      BEFORE UPDATE ON public.volumes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
