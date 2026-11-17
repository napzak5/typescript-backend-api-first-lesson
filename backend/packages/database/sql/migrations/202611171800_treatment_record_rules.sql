-- ====================================================================
-- Migration: 202611171800_treatment_record_rules.sql
-- Date: 2026-11-17 18:00
-- Purpose: Let the database state what a treatment record of a booking
--          can be, before the API writes one.
--
--          treatment_records had seven jsonb columns without a defined
--          structure. They are given one:
--          - techniques, the techniques the treatment used, and
--            nextRecommendedServices, the services recommended for the
--            next visit, are lists (of names and of service IDs). They
--            had a default of [] but accepted NULL, which said nothing
--            an empty list does not: NULL becomes [] and the columns
--            become NOT NULL.
--          - scalpCondition, hairCondition and colorFormula, the state
--            of the scalp and of the hair at the treatment and the
--            colour formula, are text: what the staff member saw and
--            mixed, in their words. (The usual scalp condition of a
--            customer, customers.scalpCondition, is one of a list; the
--            state at a treatment is not held to one.)
--            A stored JSON string becomes that string; any other JSON
--            value becomes its JSON text.
--          - beforePhotos and afterPhotos go: the photos of a treatment
--            are the rows of treatment_photos, and two places for them
--            would disagree.
--          - CHECK constraints for what a row can be checked for by
--            itself: services is a list of at least one entry, the two
--            other lists are lists, the processing time lies between 0
--            and 1440 minutes and the satisfaction of the customer
--            between 1 and 5.
--          - An index for the list of the records, latest first.
--
--          treatment_materials keeps the materials of a record in the
--          order of the request, as the items of a purchase order are
--          kept: sortOrder, unique within a record. The rows there are
--          numbered by their creation time and ID. A material is used
--          in a quantity above zero.
--
--          Rows that break a CHECK are not repaired: nothing says what
--          they should have been. The migration fails and they have to
--          be corrected first.
--
--          The versions before this one read only the ID of a treatment
--          record (deleting a booking looks for one), so they go on
--          working once the migration is applied.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    UPDATE treatment_records SET techniques = '[]'::jsonb WHERE techniques IS NULL;
    ALTER TABLE treatment_records ALTER COLUMN techniques SET DEFAULT '[]'::jsonb;
    ALTER TABLE treatment_records ALTER COLUMN techniques SET NOT NULL;

    UPDATE treatment_records
        SET "nextRecommendedServices" = '[]'::jsonb
        WHERE "nextRecommendedServices" IS NULL;
    ALTER TABLE treatment_records
        ALTER COLUMN "nextRecommendedServices" SET DEFAULT '[]'::jsonb;
    ALTER TABLE treatment_records
        ALTER COLUMN "nextRecommendedServices" SET NOT NULL;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'treatment_records'
          AND column_name = 'scalpCondition'
          AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE treatment_records
            ALTER COLUMN "scalpCondition" TYPE text
            USING CASE
                WHEN jsonb_typeof("scalpCondition") = 'string'
                    THEN "scalpCondition" #>> '{}'
                ELSE "scalpCondition"::text
            END;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'treatment_records'
          AND column_name = 'hairCondition'
          AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE treatment_records
            ALTER COLUMN "hairCondition" TYPE text
            USING CASE
                WHEN jsonb_typeof("hairCondition") = 'string'
                    THEN "hairCondition" #>> '{}'
                ELSE "hairCondition"::text
            END;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'treatment_records'
          AND column_name = 'colorFormula'
          AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE treatment_records
            ALTER COLUMN "colorFormula" TYPE text
            USING CASE
                WHEN jsonb_typeof("colorFormula") = 'string'
                    THEN "colorFormula" #>> '{}'
                ELSE "colorFormula"::text
            END;
    END IF;

    ALTER TABLE treatment_records DROP COLUMN IF EXISTS "beforePhotos";
    ALTER TABLE treatment_records DROP COLUMN IF EXISTS "afterPhotos";

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'treatment_records'::regclass
          AND conname = 'treatment_records_lists'
    ) THEN
        ALTER TABLE treatment_records
            ADD CONSTRAINT treatment_records_lists
            CHECK (
                jsonb_typeof(services) = 'array'
                AND services <> '[]'::jsonb
                AND jsonb_typeof(techniques) = 'array'
                AND jsonb_typeof("nextRecommendedServices") = 'array'
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'treatment_records'::regclass
          AND conname = 'treatment_records_ranges'
    ) THEN
        ALTER TABLE treatment_records
            ADD CONSTRAINT treatment_records_ranges
            CHECK (
                ("processingTime" IS NULL OR "processingTime" BETWEEN 0 AND 1440)
                AND (
                    "customerSatisfaction" IS NULL
                    OR "customerSatisfaction" BETWEEN 1 AND 5
                )
            );
    END IF;

    ALTER TABLE treatment_materials ADD COLUMN IF NOT EXISTS "sortOrder" integer;
    UPDATE treatment_materials AS material
        SET "sortOrder" = numbered.position
        FROM (
            SELECT
                id,
                row_number() OVER (
                    PARTITION BY "treatmentRecordId"
                    ORDER BY "createdAt", id
                ) - 1 AS position
            FROM treatment_materials
        ) AS numbered
        WHERE material.id = numbered.id
          AND material."sortOrder" IS NULL;
    ALTER TABLE treatment_materials ALTER COLUMN "sortOrder" SET NOT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'treatment_materials'::regclass
          AND conname = 'treatment_materials_record_sort_unique'
    ) THEN
        ALTER TABLE treatment_materials
            ADD CONSTRAINT treatment_materials_record_sort_unique
            UNIQUE ("treatmentRecordId", "sortOrder");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'treatment_materials'::regclass
          AND conname = 'treatment_materials_amounts'
    ) THEN
        ALTER TABLE treatment_materials
            ADD CONSTRAINT treatment_materials_amounts
            CHECK (quantity > 0 AND "sortOrder" >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_treatment_records_created_at
    ON treatment_records USING btree ("createdAt", id);
