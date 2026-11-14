-- ====================================================================
-- Migration: 202611142100_users_registration_columns.sql
-- Date: 2026-11-14 21:00
-- Purpose: Shape users for registration, email verification and
--          password reset.
--
--          - emailVerificationToken / passwordResetToken become
--            emailVerificationTokenHash / passwordResetTokenHash: the
--            server keeps the SHA-256 hash of a token it mails, never
--            the token. Nothing issued these tokens before, so the
--            values that exist were never checked and are cleared. Each
--            hash is unique, and a hash and its expiry are set or
--            cleared together.
--          - email holds lower case only, which is how it is compared.
--          - The unique constraint on email covered deleted users too,
--            so the address of a deleted account could never register
--            again. It becomes a unique index over the users that are
--            not deleted, as for salons. The index keeps the name of
--            the constraint. idx_users_email repeated it and is dropped.
--          - passwordHistory is dropped: no rule reads it. A password
--            change is refused only when it repeats the current one.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
          AND column_name = 'emailVerificationToken'
    ) THEN
        UPDATE users
        SET "emailVerificationToken" = NULL,
            "emailVerificationExpiry" = NULL,
            "passwordResetToken" = NULL,
            "passwordResetExpiry" = NULL;

        ALTER TABLE users
            RENAME COLUMN "emailVerificationToken" TO "emailVerificationTokenHash";
        ALTER TABLE users
            RENAME COLUMN "passwordResetToken" TO "passwordResetTokenHash";
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_verification_token_hash_unique
    ON users ("emailVerificationTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS users_password_reset_token_hash_unique
    ON users ("passwordResetTokenHash");

UPDATE users SET email = lower(email) WHERE email <> lower(email);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_email_lower_case'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_email_lower_case CHECK (email = lower(email));
        ALTER TABLE users
            ADD CONSTRAINT users_email_verification_token_complete
            CHECK (("emailVerificationTokenHash" IS NULL) = ("emailVerificationExpiry" IS NULL));
        ALTER TABLE users
            ADD CONSTRAINT users_password_reset_token_complete
            CHECK (("passwordResetTokenHash" IS NULL) = ("passwordResetExpiry" IS NULL));
    END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
DROP INDEX IF EXISTS idx_users_email;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
    ON users (email)
    WHERE "deletedAt" IS NULL;

ALTER TABLE users DROP COLUMN IF EXISTS "passwordHistory";
