-- ====================================================================
-- Migration: 202611152100_staff_schedules_rules.sql
-- Date: 2026-11-15 21:00
-- Purpose: Let the database state what a row of a staff member's
--          schedule can be.
--
--          A row is a weekly one ("isRecurring", for a day of the week)
--          or one for a single day (for a date), and it says that the
--          staff member works ("isAvailable", from "startTime" to
--          "endTime") or does not. None of this was checked: a row could
--          name both a day of the week and a date, end before it began,
--          and come twice for the same day.
--
--          - startTime / endTime were NOT NULL, so a day off had to carry
--            working hours that meant nothing. They become nullable, and
--            a CHECK constraint makes them present on a working day and
--            absent, with the break, on a day off.
--          - CHECK constraints for what a row can be checked for by
--            itself: a weekly row has a day of the week and no date, a
--            row for a single day a date and no day of the week; the
--            working hours end after they begin; a break has both its
--            times or neither; and a break lies inside the working hours.
--          - Unique indexes: a staff member has one weekly row per day of
--            the week and one row per date, so at most one row applies to
--            any day.
--
--          Rows written before: a day off loses its times, because that
--          is the only form the rule leaves it. Rows that break another
--          rule are not repaired: nothing says whether a row with both a
--          day of the week and a date was meant weekly, which of two
--          rows for the same day stays, or which of two times is wrong.
--          The migration fails and they have to be corrected first.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff_schedules'::regclass
          AND conname = 'staff_schedules_times_when_available'
    ) THEN
        ALTER TABLE staff_schedules ALTER COLUMN "startTime" DROP NOT NULL;
        ALTER TABLE staff_schedules ALTER COLUMN "endTime" DROP NOT NULL;
        UPDATE staff_schedules
        SET "startTime" = NULL,
            "endTime" = NULL,
            "breakStartTime" = NULL,
            "breakEndTime" = NULL
        WHERE NOT "isAvailable";
        ALTER TABLE staff_schedules
            ADD CONSTRAINT staff_schedules_times_when_available
            CHECK (
                (
                    "isAvailable"
                    AND "startTime" IS NOT NULL
                    AND "endTime" IS NOT NULL
                )
                OR (
                    NOT "isAvailable"
                    AND "startTime" IS NULL
                    AND "endTime" IS NULL
                    AND "breakStartTime" IS NULL
                    AND "breakEndTime" IS NULL
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff_schedules'::regclass
          AND conname = 'staff_schedules_weekly_or_single_day'
    ) THEN
        ALTER TABLE staff_schedules
            ADD CONSTRAINT staff_schedules_weekly_or_single_day
            CHECK (
                (
                    "isRecurring"
                    AND "dayOfWeek" IS NOT NULL
                    AND "date" IS NULL
                )
                OR (
                    NOT "isRecurring"
                    AND "dayOfWeek" IS NULL
                    AND "date" IS NOT NULL
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff_schedules'::regclass
          AND conname = 'staff_schedules_end_after_start'
    ) THEN
        ALTER TABLE staff_schedules
            ADD CONSTRAINT staff_schedules_end_after_start
            CHECK ("startTime" < "endTime");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff_schedules'::regclass
          AND conname = 'staff_schedules_break_has_both_times'
    ) THEN
        ALTER TABLE staff_schedules
            ADD CONSTRAINT staff_schedules_break_has_both_times
            CHECK (("breakStartTime" IS NULL) = ("breakEndTime" IS NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff_schedules'::regclass
          AND conname = 'staff_schedules_break_inside_working_hours'
    ) THEN
        ALTER TABLE staff_schedules
            ADD CONSTRAINT staff_schedules_break_inside_working_hours
            CHECK (
                "startTime" < "breakStartTime"
                AND "breakStartTime" < "breakEndTime"
                AND "breakEndTime" < "endTime"
            );
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS staff_schedules_weekly_unique
        ON staff_schedules ("staffId", "dayOfWeek")
        WHERE "isRecurring";

    CREATE UNIQUE INDEX IF NOT EXISTS staff_schedules_single_day_unique
        ON staff_schedules ("staffId", "date")
        WHERE NOT "isRecurring";
END $$;
