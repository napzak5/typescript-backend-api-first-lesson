-- ====================================================================
-- Migration: 202611160600_opening_hours_one_row_per_date.sql
-- Date: 2026-11-16 06:00
-- Purpose: The calendar of a salon has one row for a date. The request
--          rules have said so since the calendar is written, but the
--          table did not: nothing kept two rows for one date out.
--
--          The available slots of a day are worked out from the row of
--          that date, which decides alone when the salon is open then.
--          With two rows for a date there is no saying which decides.
--
--          Of the rows a salon has for one date, the one that was
--          written last stays (by "updatedAt", then by id), and a
--          unique index keeps the rule from then on.
-- Idempotent: nothing is deleted where a date has one row, and the
--             index is created once.
-- ====================================================================

DELETE FROM opening_hours AS earlier
USING opening_hours AS later
WHERE earlier."salonId" = later."salonId"
  AND earlier.date = later.date
  AND (earlier."updatedAt", earlier.id) < (later."updatedAt", later.id);

CREATE UNIQUE INDEX IF NOT EXISTS opening_hours_salon_date_unique
  ON opening_hours ("salonId", date);
