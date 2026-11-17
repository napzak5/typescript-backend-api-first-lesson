-- ====================================================================
-- Migration: 202611181300_users_without_permissions.sql
-- Date: 2026-11-18 13:00
-- Purpose: Let the fixed roles alone decide what an account may do
--          (#234).
--
--          users.permissions held a list of permission names that no
--          check read: what an account may do follows from users.role
--          and, for the account of a staff member, the salon of that
--          staff member. The response showed the list, which invited
--          clients to decide by it. The column goes with what it holds.
--
--          The statement can run again and changes nothing then.
-- ====================================================================

ALTER TABLE users DROP COLUMN IF EXISTS permissions;
