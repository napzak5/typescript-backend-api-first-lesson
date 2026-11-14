-- ====================================================================
-- Migration: 202611150300_services_columns.sql
-- Date: 2026-11-15 03:00
-- Purpose: Let the database state what a service and a service option
--          always have.
--
--          services
--          - imageUrls / tags / packageServiceIds were nullable jsonb with
--            a default of '[]', so a list could be NULL, empty, or not a
--            list at all, and the application had to guess. imageUrls and
--            tags become text[] NOT NULL and packageServiceIds becomes
--            uuid[] NOT NULL, without a default: every writer states the
--            list. bookingRequirements, an array already, becomes
--            NOT NULL the same way (NULL said the same as an empty list).
--          - pricingStrategy / serviceStatus / availability had a default
--            but still accepted NULL; they become NOT NULL.
--          - CHECK constraints for what a row can be checked for by
--            itself: the duration is positive, the price is not negative,
--            a discounted price lies between 0 and the price, the limit
--            of bookings a day is positive, and only a package has member
--            services, between 2 and 20 of them.
--          service_options
--          - optionType had a default but still accepted NULL; it
--            becomes NOT NULL.
--          - additionalTime and additionalPrice are not negative, and
--            maxQuantity is positive.
--
--          Rows written before: a list that is NULL or not a list becomes
--          empty, an entry of imageUrls or tags that is not a string is
--          dropped, and so is an entry of packageServiceIds that is not a
--          UUID. A row that says it is a package without having 2 to
--          20 members stops being a package, and a row that is not a
--          package loses its members. Rows that break one of the other
--          CHECKs are not repaired: no value can be guessed for a price
--          or a duration, so the migration fails and they have to be
--          corrected first.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
DECLARE
    list_column text;
    enum_column text;
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

    -- Converts a jsonb array to uuid[], keeping the entries that are UUIDs in their order.
    CREATE OR REPLACE FUNCTION pg_temp.jsonb_to_uuid_array(value jsonb)
    RETURNS uuid[]
    LANGUAGE sql
    IMMUTABLE
    AS $function$
        SELECT CASE
            WHEN jsonb_typeof(value) = 'array'
                THEN ARRAY(
                    SELECT entry.item::uuid
                    FROM jsonb_array_elements_text(value) WITH ORDINALITY AS entry(item, ordinal)
                    WHERE entry.item ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    ORDER BY entry.ordinal
                )
            ELSE '{}'::uuid[]
        END
    $function$;

    FOREACH list_column IN ARRAY ARRAY['imageUrls', 'tags']
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'services'
              AND column_name = list_column
              AND data_type = 'jsonb'
        ) THEN
            EXECUTE format('ALTER TABLE services ALTER COLUMN %I DROP DEFAULT', list_column);
            EXECUTE format(
                'ALTER TABLE services ALTER COLUMN %I TYPE text[] USING pg_temp.jsonb_to_text_array(%I)',
                list_column,
                list_column
            );
            EXECUTE format('ALTER TABLE services ALTER COLUMN %I SET NOT NULL', list_column);
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'services'
          AND column_name = 'packageServiceIds'
          AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE services ALTER COLUMN "packageServiceIds" DROP DEFAULT;
        ALTER TABLE services
            ALTER COLUMN "packageServiceIds" TYPE uuid[]
            USING pg_temp.jsonb_to_uuid_array("packageServiceIds");
        ALTER TABLE services ALTER COLUMN "packageServiceIds" SET NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'services'
          AND column_name = 'bookingRequirements'
          AND is_nullable = 'YES'
    ) THEN
        UPDATE services SET "bookingRequirements" = '{}' WHERE "bookingRequirements" IS NULL;
        ALTER TABLE services ALTER COLUMN "bookingRequirements" SET NOT NULL;
    END IF;

    -- The columns keep their defaults ('fixed', 'active', 'always'), which fill the rows without a value.
    FOREACH enum_column IN ARRAY ARRAY['pricingStrategy', 'serviceStatus', 'availability']
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'services'
              AND column_name = enum_column
              AND is_nullable = 'YES'
        ) THEN
            EXECUTE format('UPDATE services SET %I = DEFAULT WHERE %I IS NULL', enum_column, enum_column);
            EXECUTE format('ALTER TABLE services ALTER COLUMN %I SET NOT NULL', enum_column);
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'services'::regclass
          AND conname = 'services_package_members'
    ) THEN
        UPDATE services
        SET "isPackage" = false
        WHERE "isPackage" AND cardinality("packageServiceIds") NOT BETWEEN 2 AND 20;
        UPDATE services
        SET "packageServiceIds" = '{}'
        WHERE NOT "isPackage" AND cardinality("packageServiceIds") > 0;

        ALTER TABLE services
            ADD CONSTRAINT services_duration_positive CHECK (duration > 0);
        ALTER TABLE services
            ADD CONSTRAINT services_price_not_negative CHECK (price >= 0);
        ALTER TABLE services
            ADD CONSTRAINT services_discount_price_within_price
            CHECK ("discountPrice" IS NULL OR ("discountPrice" >= 0 AND "discountPrice" <= price));
        ALTER TABLE services
            ADD CONSTRAINT services_max_bookings_per_day_positive
            CHECK ("maxBookingsPerDay" IS NULL OR "maxBookingsPerDay" > 0);
        ALTER TABLE services
            ADD CONSTRAINT services_package_members
            CHECK (
                ("isPackage" AND cardinality("packageServiceIds") BETWEEN 2 AND 20)
                OR (NOT "isPackage" AND cardinality("packageServiceIds") = 0)
            );
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'service_options'
          AND column_name = 'optionType'
          AND is_nullable = 'YES'
    ) THEN
        UPDATE service_options SET "optionType" = DEFAULT WHERE "optionType" IS NULL;
        ALTER TABLE service_options ALTER COLUMN "optionType" SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'service_options'::regclass
          AND conname = 'service_options_max_quantity_positive'
    ) THEN
        ALTER TABLE service_options
            ADD CONSTRAINT service_options_additional_time_not_negative
            CHECK ("additionalTime" >= 0);
        ALTER TABLE service_options
            ADD CONSTRAINT service_options_additional_price_not_negative
            CHECK ("additionalPrice" >= 0);
        ALTER TABLE service_options
            ADD CONSTRAINT service_options_max_quantity_positive
            CHECK ("maxQuantity" > 0);
    END IF;
END $$;
