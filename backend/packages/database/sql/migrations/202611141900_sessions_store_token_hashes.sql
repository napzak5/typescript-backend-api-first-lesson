-- ====================================================================
-- Migration: 202611141900_sessions_store_token_hashes.sql
-- Date: 2026-11-14 19:00
-- Purpose: Shape sessions and users for the session-based authentication.
--
--          sessions
--          - token / refreshToken become tokenHash / refreshTokenHash:
--            the server keeps the SHA-256 hash of a token, never the
--            token. Nothing issued sessions before, so the rows that
--            exist hold values that were never checked and are removed.
--          - Every session has a refresh token and an absolute expiry:
--            refreshTokenHash and refreshExpiresAt become NOT NULL.
--          - ipAddress and userAgent become nullable: a request may
--            come without a User-Agent, and the address of a connection
--            that is already gone is unknown.
--          - authenticationState is dropped: a session row exists only
--            for a user who has authenticated, so the column could hold
--            one value. deviceId is dropped: no request carries it.
--          - idx_sessions_token / idx_sessions_refresh_token repeated
--            the indexes of the unique constraints and are dropped.
--
--          users
--          - twoFactorStatus and permissions had a default but accepted
--            NULL; they become NOT NULL.
--            202611181300_users_without_permissions.sql drops
--            permissions, so its step is skipped where the column is
--            gone (a database created from setup.sql).
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'sessions'
          AND column_name = 'token'
    ) THEN
        DELETE FROM sessions;

        DROP INDEX IF EXISTS idx_sessions_token;
        DROP INDEX IF EXISTS idx_sessions_refresh_token;

        ALTER TABLE sessions RENAME COLUMN token TO "tokenHash";
        ALTER TABLE sessions RENAME COLUMN "refreshToken" TO "refreshTokenHash";
        ALTER TABLE sessions
            RENAME CONSTRAINT sessions_token_unique TO sessions_token_hash_unique;
        ALTER TABLE sessions
            RENAME CONSTRAINT sessions_refresh_token_unique TO sessions_refresh_token_hash_unique;

        ALTER TABLE sessions ALTER COLUMN "refreshTokenHash" SET NOT NULL;
        ALTER TABLE sessions ALTER COLUMN "refreshExpiresAt" SET NOT NULL;
    END IF;
END $$;

ALTER TABLE sessions ALTER COLUMN "ipAddress" DROP NOT NULL;
ALTER TABLE sessions ALTER COLUMN "userAgent" DROP NOT NULL;

ALTER TABLE sessions DROP COLUMN IF EXISTS "authenticationState";
ALTER TABLE sessions DROP COLUMN IF EXISTS "deviceId";
DROP TYPE IF EXISTS authentication_state;

UPDATE users SET "twoFactorStatus" = 'disabled' WHERE "twoFactorStatus" IS NULL;
ALTER TABLE users ALTER COLUMN "twoFactorStatus" SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'permissions'
    ) THEN
        UPDATE users SET permissions = '[]'::jsonb WHERE permissions IS NULL;
        ALTER TABLE users ALTER COLUMN permissions SET NOT NULL;
    END IF;
END $$;
