-- Migration 001 — hash room access keys, atomic download claims
--
-- Run this against an existing Stash database that was created with the
-- original schema (plaintext `rooms.stack_key`, `increment_download_count`).
-- New deployments can just run schema.sql instead.
--
-- Existing plaintext keys CANNOT be converted to bcrypt hashes without the
-- original values, and they are a credential leak, so this drops them. Rooms
-- that had a key become unprotected; hosts must rotate to set a new one.
-- Rooms expire after 24h anyway, so this affects almost nothing in practice.

BEGIN;

-- 1. Replace plaintext stack_key with a bcrypt hash column
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS stack_key_hash TEXT DEFAULT NULL;

-- Any room still holding a plaintext key is reset to unprotected.
UPDATE public.rooms
SET is_protected = FALSE,
    stack_key_expires_at = NULL
WHERE stack_key IS NOT NULL;

ALTER TABLE public.rooms DROP COLUMN IF EXISTS stack_key;

-- 2. Atomic download slot claim (replaces increment_download_count)
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

DROP FUNCTION IF EXISTS increment_download_count(UUID);

COMMIT;
