-- ====================================================================
-- Migration: 202611181200_unused_tables_and_columns.sql
-- Date: 2026-11-18 12:00
-- Purpose: Take out the tables and the columns that nothing reads,
--          and leave no column that accepts NULL and has a default
--          (#233).
--
--          - membership_tiers, staff_skills, staff_performances,
--            daily_summaries and notification_logs are read by no
--            operation, and only the seed wrote membership_tiers. They
--            go with their rows, and so do notification_type and
--            notification_channel, the enums that only
--            notification_logs used. membership_tier stays:
--            customers.membershipTier is of that type.
--          - services.requiredProducts, staff.awards, users.metadata,
--            salons.cancellationPolicy, salons.bookingPolicy and
--            booking_services.selectedOptions are jsonb columns
--            without a defined structure, which no response shows and
--            no request writes. They go with what they hold.
--          - staff.yearsOfExperience keeps accepting NULL, which says
--            that the years are not stated, and loses its default of
--            0, which said 0 years of a row written without them.
--            The years that are stored stay as they are: nothing tells
--            a 0 the default gave from a 0 that was written.
--
--          Every statement can run again and changes nothing then.
-- ====================================================================

DROP TABLE IF EXISTS membership_tiers;
DROP TABLE IF EXISTS staff_skills;
DROP TABLE IF EXISTS staff_performances;
DROP TABLE IF EXISTS daily_summaries;
DROP TABLE IF EXISTS notification_logs;

DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS notification_channel;

ALTER TABLE services DROP COLUMN IF EXISTS "requiredProducts";
ALTER TABLE staff DROP COLUMN IF EXISTS awards;
ALTER TABLE users DROP COLUMN IF EXISTS metadata;
ALTER TABLE salons DROP COLUMN IF EXISTS "cancellationPolicy";
ALTER TABLE salons DROP COLUMN IF EXISTS "bookingPolicy";
ALTER TABLE booking_services DROP COLUMN IF EXISTS "selectedOptions";

ALTER TABLE staff ALTER COLUMN "yearsOfExperience" DROP DEFAULT;
