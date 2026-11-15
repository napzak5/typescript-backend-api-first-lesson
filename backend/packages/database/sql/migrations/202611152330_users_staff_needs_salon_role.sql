-- ====================================================================
-- Migration: 202611152330_users_staff_needs_salon_role.sql
-- Date: 2026-11-15 23:30
-- Purpose: An account that names a staff member has a role of a salon.
--
--          users."staffId" is what gives an account its salon, and only
--          the roles 'owner', 'manager' and 'staff' are roles in a
--          salon. Nothing kept the account of a customer or of an
--          administrator from naming a staff member before. The code
--          that links an account to a staff member (accepting an
--          invitation, joining one with an account that exists) writes
--          the role and the staff member together, and the code that
--          changes the role of such an account only gives these three.
--
--          An account without a staff member keeps whichever role it
--          has: an account that was unlinked still has its role, and
--          reaches no salon.
--
--          If a user that names a staff member has another role, the
--          constraint cannot be added and the migration fails: whether
--          the role or the staff member is wrong is for a person to
--          decide.
-- Idempotent: the constraint is added once.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_staff_needs_salon_role'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_staff_needs_salon_role
            CHECK (
                "staffId" IS NULL
                OR role IN ('owner', 'manager', 'staff')
            );
    END IF;
END $$;
