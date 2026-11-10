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
    -- bcrypt hash of the room access code. The plaintext code is returned to the
    -- creator exactly once, at creation/rotation, and is never stored.
    stack_key_hash TEXT DEFAULT NULL,
    stack_key_expires_at BIGINT DEFAULT NULL,
    accept_only BOOLEAN DEFAULT FALSE,
    creator_socket_id TEXT DEFAULT 'system',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    -- When this room should be pruned. Stamped at creation from the creator's
    -- plan, because cleanup runs on a timer with no request to resolve a plan
    -- from. NULL means "fall back to the default 24h after created_at"; on
    -- plans with no room lifetime limit the room is simply never auto-pruned.
    expires_at BIGINT DEFAULT NULL
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
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON public.rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_rooms_creator_socket_id ON public.rooms(creator_socket_id);

-- 4. Atomic download slot claim.
-- Increments only when the file is under its download limit, in a single
-- statement, so concurrent requests cannot both pass a separate limit check.
-- `allowed = false` means the caller must not be served the file.
CREATE OR REPLACE FUNCTION claim_download(target_file_id UUID)
RETURNS TABLE (
    allowed BOOLEAN,
    new_count INT,
    max_limit INT,
    file_path TEXT,
    room_id TEXT
) LANGUAGE plpgsql AS $$
DECLARE
    updated_row public.files;
BEGIN
    UPDATE public.files f
    SET download_count = f.download_count + 1
    WHERE f.id = target_file_id
      AND (f.max_downloads IS NULL OR f.download_count < f.max_downloads)
    RETURNING f.* INTO updated_row;

    IF updated_row.id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::INT, NULL::INT, NULL::TEXT, NULL::TEXT;
    ELSE
        RETURN QUERY SELECT
            TRUE,
            updated_row.download_count,
            updated_row.max_downloads,
            updated_row.file_path,
            updated_row.room_id;
    END IF;
END;
$$;

-- Superseded by claim_download(); dropped so it cannot be called by mistake.
DROP FUNCTION IF EXISTS increment_download_count(UUID);

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
