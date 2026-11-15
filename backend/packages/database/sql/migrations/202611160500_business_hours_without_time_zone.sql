-- ====================================================================
-- Migration: 202611160500_business_hours_without_time_zone.sql
-- Date: 2026-11-16 05:00
-- Purpose: The weekly hours of a salon (salons."businessHours", a JSON
--          list with an entry per day of the week) had a time zone of
--          their own in every entry, next to the time zone of the
--          salon. Nothing read it, and the two could disagree. The
--          hours of a salon are times in the time zone of the salon,
--          so the entries lose the key.
--
--          Stored hours are checked against the shape of the API model
--          whenever a salon is read, and that shape no longer has the
--          key: a salon that kept it could not be read.
--
--          Only lists are touched, and in them only the entries that
--          are objects. A value of another shape stays as it is: it
--          did not match the model before either. "updatedAt" stays,
--          because nobody changed the salon.
-- Idempotent: a salon whose hours have no such key is not written.
-- ====================================================================

UPDATE salons
SET "businessHours" = (
  SELECT jsonb_agg(
    CASE jsonb_typeof(entry)
      WHEN 'object' THEN entry - 'timezone'
      ELSE entry
    END
    ORDER BY position
  )
  FROM jsonb_array_elements("businessHours")
    WITH ORDINALITY AS hours (entry, position)
)
WHERE CASE jsonb_typeof("businessHours")
  WHEN 'array' THEN EXISTS (
    SELECT 1
    FROM jsonb_array_elements("businessHours") AS hours (entry)
    WHERE jsonb_typeof(entry) = 'object' AND entry ? 'timezone'
  )
  ELSE false
END;
