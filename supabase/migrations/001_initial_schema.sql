-- ============================================================================
-- ShubhVivah Studio — Supabase PostgreSQL Schema & Storage Buckets
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Video Templates Table
CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  bg_color TEXT NOT NULL,
  default_music_id TEXT NOT NULL,
  preview_badge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Approved Royalty-Free Music Tracks Table
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_sec NUMERIC NOT NULL,
  url TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Wedding Invitation Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  template_id TEXT NOT NULL REFERENCES public.templates(id),
  language TEXT NOT NULL DEFAULT 'english',
  bride_name TEXT NOT NULL,
  groom_name TEXT NOT NULL,
  bride_parents TEXT,
  groom_parents TEXT,
  family_message TEXT,
  hashtag TEXT,
  contact_phone TEXT,
  wedding_date TEXT NOT NULL,
  wedding_time TEXT NOT NULL,
  wedding_venue TEXT NOT NULL,
  wedding_address TEXT NOT NULL,
  maps_url TEXT,
  rsvp_details TEXT,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '{}'::jsonb,
  music JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_accepted BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  latest_job_id UUID,
  rendered_video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Video Rendering Jobs Queue Table
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  stage_message TEXT NOT NULL DEFAULT 'Queued for rendering',
  output_path TEXT,
  output_size_bytes BIGINT,
  duration_sec NUMERIC,
  resolution TEXT NOT NULL DEFAULT '1080x1920',
  fps INTEGER NOT NULL DEFAULT 30,
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 5. Global System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  resolution_width INTEGER NOT NULL DEFAULT 1080,
  resolution_height INTEGER NOT NULL DEFAULT 1920,
  fps INTEGER NOT NULL DEFAULT 30,
  link_expiry_hours INTEGER NOT NULL DEFAULT 72,
  auto_delete_temp_hours INTEGER NOT NULL DEFAULT 24,
  max_renders_per_ip_hour INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast polling & admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);
CREATE INDEX IF NOT EXISTS idx_render_jobs_project_id ON public.render_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON public.render_jobs(status);

-- Storage Buckets Setup (Private photos & expiring rendered videos)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('private-photos', 'private-photos', false),
  ('custom-audio', 'custom-audio', false),
  ('rendered-videos', 'rendered-videos', false)
ON CONFLICT (id) DO NOTHING;
