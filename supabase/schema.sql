-- ShelfArc Database Schema
-- Run this in your Supabase SQL Editor

-- WARNING: This script drops and recreates objects. Data will be lost.

-- Clean up auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop tables (policies, indexes, and triggers are dropped automatically)
DROP TABLE IF EXISTS shelf_items CASCADE;
DROP TABLE IF EXISTS bookshelves CASCADE;
DROP TABLE IF EXISTS volumes CASCADE;
DROP TABLE IF EXISTS series CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- Drop functions (after tables to remove trigger dependencies)
DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS public.backup_list_tables();

-- Drop custom types
DROP TYPE IF EXISTS title_type CASCADE;
DROP TYPE IF EXISTS ownership_status CASCADE;
DROP TYPE IF EXISTS reading_status CASCADE;
DROP TYPE IF EXISTS book_orientation CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE title_type AS ENUM ('light_novel', 'manga', 'other');
CREATE TYPE ownership_status AS ENUM ('owned', 'wishlist');
CREATE TYPE reading_status AS ENUM ('unread', 'reading', 'completed', 'on_hold', 'dropped');
CREATE TYPE book_orientation AS ENUM ('vertical', 'horizontal');

-- Profiles table (extends Supabase auth.users)
-- CREATE TABLE profiles (
--   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   email TEXT NOT NULL,
--   display_name TEXT,
--   avatar_url TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
--   updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
-- );

-- Series table (groups volumes together)
CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_title TEXT,
  description TEXT,
  author TEXT,
  artist TEXT,
  publisher TEXT,
  cover_image_url TEXT,
  type title_type DEFAULT 'manga' NOT NULL,
  total_volumes INTEGER,
  status TEXT, -- 'ongoing', 'completed', 'hiatus', etc.
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Volumes table (individual books/volumes)
CREATE TABLE volumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  series_id UUID REFERENCES series(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  volume_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  isbn TEXT,
  cover_image_url TEXT,
  edition TEXT, -- 'first_edition', 'collectors', 'omnibus', etc.
  format TEXT, -- 'paperback', 'hardcover', 'digital', etc.
  page_count INTEGER,
  publish_date DATE,
  purchase_date DATE,
  purchase_price DECIMAL(10, 2),
  ownership_status ownership_status DEFAULT 'owned' NOT NULL,
  reading_status reading_status DEFAULT 'unread' NOT NULL,
  current_page INTEGER,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(series_id, volume_number, edition)
);

-- Tags table (user-defined tags)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id, name)
);

-- Bookshelves table (virtual bookshelves for visual organization)
CREATE TABLE bookshelves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  row_count INTEGER DEFAULT 3 NOT NULL CHECK (row_count > 0),
  row_height INTEGER DEFAULT 200 NOT NULL CHECK (row_height > 0), -- pixels
  row_width INTEGER DEFAULT 800 NOT NULL CHECK (row_width > 0), -- pixels
  shelf_color TEXT, -- for theming
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Shelf items table (books placed on shelves)
CREATE TABLE shelf_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bookshelf_id UUID NOT NULL REFERENCES bookshelves(id) ON DELETE CASCADE,
  volume_id UUID NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL CHECK (row_index >= 0), -- 0-based shelf row
  position_x INTEGER NOT NULL CHECK (position_x >= 0), -- pixel offset from left
  orientation book_orientation DEFAULT 'vertical' NOT NULL,
  z_index INTEGER DEFAULT 0, -- for stacking order
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(bookshelf_id, volume_id)
);

-- Indexes for performance
CREATE INDEX idx_series_user_id ON series(user_id);
CREATE INDEX idx_series_title ON series(title);
CREATE INDEX idx_series_type ON series(type);
CREATE INDEX idx_series_tags ON series USING GIN(tags);

CREATE INDEX idx_volumes_series_id ON volumes(series_id);
CREATE INDEX idx_volumes_user_id ON volumes(user_id);
CREATE INDEX idx_volumes_ownership_status ON volumes(ownership_status);
CREATE INDEX idx_volumes_reading_status ON volumes(reading_status);
CREATE INDEX idx_volumes_isbn ON volumes(isbn);

CREATE INDEX idx_tags_user_id ON tags(user_id);

CREATE INDEX idx_bookshelves_user_id ON bookshelves(user_id);

CREATE INDEX idx_shelf_items_bookshelf_id ON shelf_items(bookshelf_id);
CREATE INDEX idx_shelf_items_volume_id ON shelf_items(volume_id);
CREATE INDEX idx_shelf_items_user_id ON shelf_items(user_id);

-- Supabase recommended indexes
CREATE INDEX ON public.volumes USING btree (volume_number);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE volumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookshelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelf_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
-- CREATE POLICY "Users can view their own profile"
--   ON profiles FOR SELECT
--   USING ((select auth.uid()) = id);

-- CREATE POLICY "Users can update their own profile"
--   ON profiles FOR UPDATE
--   USING ((select auth.uid()) = id);

-- RLS Policies for series
CREATE POLICY "Users can view their own series"
  ON series FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own series"
  ON series FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own series"
  ON series FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own series"
  ON series FOR DELETE
  USING ((select auth.uid()) = user_id);

-- RLS Policies for volumes
CREATE POLICY "Users can view their own volumes"
  ON volumes FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own volumes"
  ON volumes FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own volumes"
  ON volumes FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own volumes"
  ON volumes FOR DELETE
  USING ((select auth.uid()) = user_id);

-- RLS Policies for tags
CREATE POLICY "Users can view their own tags"
  ON tags FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own tags"
  ON tags FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own tags"
  ON tags FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own tags"
  ON tags FOR DELETE
  USING ((select auth.uid()) = user_id);

-- RLS Policies for bookshelves
CREATE POLICY "Users can view their own bookshelves"
  ON bookshelves FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own bookshelves"
  ON bookshelves FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own bookshelves"
  ON bookshelves FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own bookshelves"
  ON bookshelves FOR DELETE
  USING ((select auth.uid()) = user_id);

-- RLS Policies for shelf_items
CREATE POLICY "Users can view their own shelf_items"
  ON shelf_items FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own shelf_items"
  ON shelf_items FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM bookshelves b
      WHERE b.id = bookshelf_id
        AND b.user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM volumes v
      WHERE v.id = volume_id
        AND v.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update their own shelf_items"
  ON shelf_items FOR UPDATE
  USING (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM bookshelves b
      WHERE b.id = bookshelf_id
        AND b.user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM volumes v
      WHERE v.id = volume_id
        AND v.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM bookshelves b
      WHERE b.id = bookshelf_id
        AND b.user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM volumes v
      WHERE v.id = volume_id
        AND v.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete their own shelf_items"
  ON shelf_items FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Trigger to call function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

-- Function to validate shelf item user matches bookshelf owner
CREATE OR REPLACE FUNCTION validate_shelf_item_user_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  bookshelf_user_id UUID;
  bookshelf_row_count INTEGER;
  volume_user_id UUID;
BEGIN
  SELECT user_id, row_count INTO bookshelf_user_id, bookshelf_row_count
  FROM public.bookshelves
  WHERE id = NEW.bookshelf_id;

  IF bookshelf_user_id IS NULL THEN
    RAISE EXCEPTION 'Bookshelf % not found for shelf item', NEW.bookshelf_id;
  END IF;

  IF bookshelf_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Shelf item user_id does not match bookshelf owner';
  END IF;

  IF NEW.row_index >= bookshelf_row_count THEN
    RAISE EXCEPTION 'Shelf item row_index % is out of range for bookshelf %', NEW.row_index, NEW.bookshelf_id;
  END IF;

  SELECT user_id INTO volume_user_id
  FROM public.volumes
  WHERE id = NEW.volume_id;

  IF volume_user_id IS NULL THEN
    RAISE EXCEPTION 'Volume % not found for shelf item', NEW.volume_id;
  END IF;

  IF volume_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Shelf item user_id does not match volume owner';
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers for updated_at
-- CREATE TRIGGER update_profiles_updated_at
--   BEFORE UPDATE ON profiles
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_series_updated_at
  BEFORE UPDATE ON series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volumes_updated_at
  BEFORE UPDATE ON volumes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookshelves_updated_at
  BEFORE UPDATE ON bookshelves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER validate_shelf_item_user_match
  BEFORE INSERT OR UPDATE ON shelf_items
  FOR EACH ROW EXECUTE FUNCTION validate_shelf_item_user_match();

CREATE TRIGGER update_shelf_items_updated_at
  BEFORE UPDATE ON shelf_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
