-- ====================================================================
-- Migration: 202611151800_staff_columns.sql
-- Date: 2026-11-15 18:00
-- Purpose: Let the database state what a staff member always has.
--
--          - specialties / certifications were nullable jsonb with a
--            default of '[]', so a list could be NULL, empty, or not a
--            list at all. They become text[] NOT NULL without a default:
--            every writer states the list.
--          - bufferTimeBefore / bufferTimeAfter had a default of 0 but
--            still accepted NULL, which said the same as 0. They become
--            NOT NULL.
--          - email is stored in lower case, as the email of a user and of
--            a customer is, and a CHECK constraint keeps it so. The
--            unique constraint covered every staff member of every salon,
--            deleted ones too: a salon was refused an address because
--            another salon had it, and the address of a staff member who
--            was deleted could never be registered again. It becomes a
--            unique index over the staff members of one salon that are
--            not deleted.
--          - CHECK constraints for what a row can be checked for by
--            itself: the buffer times, the years of experience and the
--            base salary are not negative, a staff member takes at least
--            one booking at a time, and the commission rate is a
--            percentage.
--
--          Rows written before: a list that is NULL or not a list becomes
--          empty, and an entry that is not a string is dropped. A buffer
--          time of NULL becomes 0. An email is put in lower case. Rows
--          that break one of the CHECKs are not repaired: no value can be
--          guessed for a salary or a rate, so the migration fails and
--          they have to be corrected first.
--
--          If putting the emails in lower case leaves two staff members
--          of one salon who are not deleted with the same address, the
--          unique index cannot be built and the migration fails: which
--          of the two stays is for a person to decide.
--
--          staff."userId" gets no foreign key: users."staffId" refers to
--          staff, and two tables that refer to each other lose their
--          types in the generated schema.ts.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
DECLARE
    list_column text;
    buffer_column text;
BEGIN
    -- Converts a jsonb array to text[], keeping the entries that are strings in their order.
    CREATE OR REPLACE FUNCTION pg_temp.jsonb_to_text_array(value jsonb)
    RETURNS text[]
    LANGUAGE sql
    IMMUTABLE
    AS $function$
        SELECT CASE
            WHEN jsonb_typeof(value) = 'array'
                THEN ARRAY(
                    SELECT entry.item #>> '{}'
                    FROM jsonb_array_elements(value) WITH ORDINALITY AS entry(item, ordinal)
                    WHERE jsonb_typeof(entry.item) = 'string'
                    ORDER BY entry.ordinal
                )
            ELSE '{}'::text[]
        END
    $function$;

    FOREACH list_column IN ARRAY ARRAY['specialties', 'certifications'] LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'staff'
              AND column_name = list_column
              AND data_type = 'jsonb'
        ) THEN
            EXECUTE format('ALTER TABLE staff ALTER COLUMN %I DROP DEFAULT', list_column);
            EXECUTE format(
                'ALTER TABLE staff ALTER COLUMN %I TYPE text[] USING pg_temp.jsonb_to_text_array(%I)',
                list_column,
                list_column
            );
            EXECUTE format('ALTER TABLE staff ALTER COLUMN %I SET NOT NULL', list_column);
        END IF;
    END LOOP;

    -- The columns keep their default (0), which fills the rows without a value.
    FOREACH buffer_column IN ARRAY ARRAY['bufferTimeBefore', 'bufferTimeAfter'] LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'staff'
              AND column_name = buffer_column
              AND is_nullable = 'YES'
        ) THEN
            EXECUTE format('UPDATE staff SET %I = DEFAULT WHERE %I IS NULL', buffer_column, buffer_column);
            EXECUTE format('ALTER TABLE staff ALTER COLUMN %I SET NOT NULL', buffer_column);
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff'::regclass
          AND conname = 'staff_email_lower_case'
    ) THEN
        -- The old constraint goes first: it would refuse an address that, in
        -- lower case, equals the address of a staff member of another salon.
        ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_email_unique;
        UPDATE staff SET email = lower(email) WHERE email <> lower(email);
        CREATE UNIQUE INDEX IF NOT EXISTS staff_email_salon_unique
            ON staff ("salonId", email)
            WHERE "deletedAt" IS NULL;
        ALTER TABLE staff
            ADD CONSTRAINT staff_email_lower_case
            CHECK (email = lower(email));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff'::regclass
          AND conname = 'staff_buffer_times_not_negative'
    ) THEN
        ALTER TABLE staff
            ADD CONSTRAINT staff_buffer_times_not_negative
            CHECK ("bufferTimeBefore" >= 0 AND "bufferTimeAfter" >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff'::regclass
          AND conname = 'staff_max_concurrent_bookings_positive'
    ) THEN
        ALTER TABLE staff
            ADD CONSTRAINT staff_max_concurrent_bookings_positive
            CHECK ("maxConcurrentBookings" >= 1);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff'::regclass
          AND conname = 'staff_years_of_experience_not_negative'
    ) THEN
        ALTER TABLE staff
            ADD CONSTRAINT staff_years_of_experience_not_negative
            CHECK ("yearsOfExperience" >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff'::regclass
          AND conname = 'staff_base_salary_not_negative'
    ) THEN
        ALTER TABLE staff
            ADD CONSTRAINT staff_base_salary_not_negative
            CHECK ("baseSalary" >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'staff'::regclass
          AND conname = 'staff_commission_rate_is_a_percentage'
    ) THEN
        ALTER TABLE staff
            ADD CONSTRAINT staff_commission_rate_is_a_percentage
            CHECK ("commissionRate" >= 0 AND "commissionRate" <= 100);
    END IF;
END $$;
