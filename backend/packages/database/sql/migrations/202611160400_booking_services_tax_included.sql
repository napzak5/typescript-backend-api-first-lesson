-- ====================================================================
-- Migration: 202611160400_booking_services_tax_included.sql
-- Date: 2026-11-16 04:00
-- Purpose: A service line keeps whether its price includes the
--          consumption tax, as it keeps the price and the duration: a
--          copy of what the service said when the line was entered.
--
--          The tax of a booking is what is added to the lines whose
--          price does not include it. Only the entry of a booking
--          computed it, from the services as they were then. Lines are
--          about to be added and removed afterwards, and the tax of the
--          lines that stay has to be computed again without asking the
--          services, which may say something else by then.
--
--          Rows written before get what their service says now: what it
--          said when the line was entered was not kept.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS "taxIncluded" boolean;

UPDATE booking_services AS line
SET "taxIncluded" = service."taxIncluded"
FROM services AS service
WHERE service.id = line."serviceId"
  AND line."taxIncluded" IS NULL;

ALTER TABLE booking_services ALTER COLUMN "taxIncluded" SET NOT NULL;
