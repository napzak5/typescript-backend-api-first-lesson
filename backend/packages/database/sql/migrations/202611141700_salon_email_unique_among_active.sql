-- ====================================================================
-- Migration: 202611141700_salon_email_unique_among_active.sql
-- Date: 2026-11-14 17:00
-- Purpose: Let the email of a deleted salon be used again.
--
--          Deleting a salon marks the row as deleted and keeps it. The
--          unique constraint on email covered those rows too, so the
--          email of a salon that no longer exists could never be
--          registered again. The constraint becomes a unique index over
--          the rows that are not deleted. The index keeps the name of
--          the constraint, which is what a violation reports.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_email_unique;

CREATE UNIQUE INDEX IF NOT EXISTS salons_email_unique
    ON salons (email)
    WHERE "deletedAt" IS NULL;
