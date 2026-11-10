-- Migration 002 — per-room expiry, so paid plans can outlive the 24h default
--
-- Run against an instance already migrated through 001. New deployments get
-- this from schema.sql and should not run it.
--
-- Rooms used to be pruned purely by `created_at < now - 24h`. Paid plans need
-- longer-lived (or permanent) rooms, and the cleanup job runs on a timer with
-- no request context, so it cannot re-resolve the creator's plan. The lifetime
-- is therefore stamped onto the row at creation.
--
-- Existing rows keep expires_at = NULL, which the cleanup query treats as the
-- original 24h-after-created_at rule. Nothing already live changes behaviour.

BEGIN;

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS expires_at BIGINT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON public.rooms(expires_at);

COMMIT;
