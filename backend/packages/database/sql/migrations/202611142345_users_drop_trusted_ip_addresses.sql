-- ====================================================================
-- Migration: 202611142345_users_drop_trusted_ip_addresses.sql
-- Date: 2026-11-14 23:45
-- Purpose: Drop users.trustedIpAddresses.
--
--          Nothing decided anything by the list, and what a trusted
--          address would change was never defined. A list of "trusted"
--          addresses that changes no behaviour suggests a protection
--          that is not there.
-- Idempotent: skipped once the column is gone.
-- ====================================================================

ALTER TABLE users DROP COLUMN IF EXISTS "trustedIpAddresses";
