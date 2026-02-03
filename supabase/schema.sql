-- ShelfArc Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE title_type AS ENUM ('light_novel', 'manga', 'other');
CREATE TYPE ownership_status AS ENUM ('owned', 'wishlist', 'reading', 'dropped', 'completed');
CREATE TYPE reading_status AS ENUM ('unread', 'reading', 'completed', 'on_hold', 'dropped');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

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

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE volumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for series
CREATE POLICY "Users can view their own series"
  ON series FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own series"
  ON series FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own series"
  ON series FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own series"
  ON series FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for volumes
CREATE POLICY "Users can view their own volumes"
  ON volumes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own volumes"
  ON volumes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own volumes"
  ON volumes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own volumes"
  ON volumes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for tags
CREATE POLICY "Users can view their own tags"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_series_updated_at
  BEFORE UPDATE ON series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volumes_updated_at
  BEFORE UPDATE ON volumes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
