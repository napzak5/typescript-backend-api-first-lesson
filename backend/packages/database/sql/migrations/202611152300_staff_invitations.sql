-- ====================================================================
-- Migration: 202611152300_staff_invitations.sql
-- Date: 2026-11-15 23:00
-- Purpose: Let a staff member be invited to an account of their own.
--
--          - salon_role: the roles an account has in a salon. user_role
--            also has 'customer' and 'admin', which no invitation gives.
--          - staff_invitations: the invitation a staff member holds. It
--            keeps the address the mail went to, the role the account
--            will have, the hash of the mailed token and until when the
--            token works. A staff member holds at most one: inviting
--            again puts a new row in the place of the one before.
--            Accepting an invitation creates the account and deletes
--            the row, so the table only has invitations that are open.
--          - One staff member, one account. users."staffId" becomes
--            unique among the users that are not deleted, and
--            staff."userId" unique among the staff members that are not
--            deleted. Nothing kept two accounts from naming one staff
--            member before.
--
--          staff_user_unique replaces idx_staff_user_id, which covered
--          the same column. idx_users_staff_id stays next to
--          users_staff_unique: the foreign key of users."staffId" looks
--          for the users of a staff member that is removed, deleted
--          users too, and the partial index does not cover those.
--
--          If two users that are not deleted name the same staff
--          member, or two staff members that are not deleted the same
--          account, the unique index cannot be built and the migration
--          fails: which of the two is right is for a person to decide.
--
--          staff."userId" still gets no foreign key (see
--          202611151800_staff_columns.sql). The two columns are written
--          together, in one transaction, by the code that accepts an
--          invitation.
-- Idempotent: each step changes nothing once it has been applied.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'salon_role') THEN
        CREATE TYPE "public"."salon_role" AS ENUM('owner', 'manager', 'staff');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "staffId" uuid NOT NULL,
    email varchar(255) NOT NULL,
    role salon_role NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_invitations_staff_id_fk
        FOREIGN KEY ("staffId") REFERENCES staff (id) ON DELETE CASCADE,
    CONSTRAINT staff_invitations_staff_unique UNIQUE ("staffId"),
    CONSTRAINT staff_invitations_token_hash_unique UNIQUE ("tokenHash"),
    CONSTRAINT staff_invitations_email_lower_case
        CHECK (email::text = lower(email::text))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_staff_unique
    ON users ("staffId")
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_user_unique
    ON staff ("userId")
    WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS idx_staff_user_id;
