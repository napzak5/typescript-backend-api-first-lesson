-- ====================================================================
-- Migration: 202611142300_users_two_factor.sql
-- Date: 2026-11-14 23:00
-- Purpose: Shape users for two-factor authentication with TOTP.
--
--          - twoFactorEnabled is dropped: twoFactorStatus says the same
--            ('enabled') and also knows a setup that is under way
--            ('pending').
--          - twoFactorLastUsedStep is added: the time step of the last
--            code that was accepted. A code is accepted once, so only a
--            later step is accepted after it.
--          - Nothing issued secrets or backup codes before, and login
--            refused every account with two-factor authentication. What
--            is stored was therefore never usable and is not in the
--            form the server now keeps (an encrypted secret, hashed
--            backup codes): every account is set back to 'disabled'.
--          - Constraints tie the columns together: a disabled account
--            holds no secret, no backup codes and no step; any other
--            holds a secret and a list of backup codes.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

ALTER TABLE users DROP COLUMN IF EXISTS "twoFactorEnabled";
ALTER TABLE users ADD COLUMN IF NOT EXISTS "twoFactorLastUsedStep" integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_two_factor_secret_matches_status'
    ) THEN
        UPDATE users
        SET "twoFactorStatus" = 'disabled',
            "twoFactorSecret" = NULL,
            "backupCodes" = NULL,
            "twoFactorLastUsedStep" = NULL;

        ALTER TABLE users
            ADD CONSTRAINT users_two_factor_secret_matches_status
            CHECK (("twoFactorStatus" = 'disabled') = ("twoFactorSecret" IS NULL));
        ALTER TABLE users
            ADD CONSTRAINT users_backup_codes_match_status
            CHECK (("twoFactorStatus" = 'disabled') = ("backupCodes" IS NULL));
        ALTER TABLE users
            ADD CONSTRAINT users_backup_codes_are_a_list
            CHECK (jsonb_typeof("backupCodes") = 'array');
        ALTER TABLE users
            ADD CONSTRAINT users_two_factor_step_needs_secret
            CHECK ("twoFactorLastUsedStep" IS NULL OR "twoFactorSecret" IS NOT NULL);
    END IF;
END $$;
