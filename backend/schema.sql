-- Stash Database Schema for Supabase PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_protected BOOLEAN DEFAULT FALSE,
    stack_key TEXT DEFAULT NULL,
    stack_key_expires_at BIGINT DEFAULT NULL,
    accept_only BOOLEAN DEFAULT FALSE,
    creator_socket_id TEXT DEFAULT 'system',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 2. Files Table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    password_hash TEXT DEFAULT NULL,
    salt TEXT DEFAULT NULL,
    expires_at BIGINT NOT NULL,
    max_downloads INT DEFAULT NULL,
    download_count INT DEFAULT 0,
    uploaded_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    description TEXT DEFAULT NULL
);

-- 3. Performance & Indexing
CREATE INDEX IF NOT EXISTS idx_files_room_id ON public.files(room_id);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON public.files(expires_at);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_creator_socket_id ON public.rooms(creator_socket_id);

-- 4. Atomic Download Counter Function
CREATE OR REPLACE FUNCTION increment_download_count(target_file_id UUID)
RETURNS TABLE (
    id UUID,
    new_count INT,
    max_limit INT,
    file_path TEXT,
    room_id TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE public.files
    SET download_count = download_count + 1
    WHERE public.files.id = target_file_id
    RETURNING public.files.id, public.files.download_count, public.files.max_downloads, public.files.file_path, public.files.room_id;
END;
$$;

-- 5. Row Level Security (RLS) - Server-only via Service Role default deny for public
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Allow read/write strictly through backend service role key
CREATE POLICY "Service role full access on rooms" ON public.rooms
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on files" ON public.files
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
