-- ====================================================================
-- Migration: 202611181100_customer_allergy_rules.sql
-- Date: 2026-11-18 11:00
-- Purpose: Let the database state what an allergy of a customer can be,
--          before the API writes one.
--
--          customer_allergies had two severities: severity, a number
--          with a default of 3, and severityType, one of the levels of
--          allergy_severity, which 202509202132_align_enums_with_typespec
--          worked out from the number and which accepted NULL. Two places
--          for one fact would disagree, so the level stays:
--          - severityType is filled in from severity where it is NULL,
--            as 202509202132 did (2 or less mild, 3 moderate, 4 severe,
--            above that life_threatening), and becomes NOT NULL.
--          - severity goes.
--
--          A customer has one row for an allergen: allergenName is unique
--          for a customer. The unique constraint leads with customerId,
--          so it also finds the allergies of a customer, and the index on
--          customerId alone goes.
--
--          Rows that break the unique constraint are not repaired:
--          nothing says which of them should stay. The migration fails
--          and they have to be corrected first.
--
--          The versions before this one only look for a row of a customer
--          (the list of the medical charts filters by it), so they go on
--          working once the migration is applied.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'customer_allergies'
          AND column_name = 'severity'
    ) THEN
        UPDATE customer_allergies
            SET "severityType" = CASE
                WHEN severity <= 2 THEN 'mild'::allergy_severity
                WHEN severity <= 3 THEN 'moderate'::allergy_severity
                WHEN severity <= 4 THEN 'severe'::allergy_severity
                ELSE 'life_threatening'::allergy_severity
            END
            WHERE "severityType" IS NULL;
        ALTER TABLE customer_allergies DROP COLUMN severity;
    END IF;

    ALTER TABLE customer_allergies ALTER COLUMN "severityType" SET NOT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_allergies'::regclass
          AND conname = 'customer_allergies_customer_allergen_unique'
    ) THEN
        ALTER TABLE customer_allergies
            ADD CONSTRAINT customer_allergies_customer_allergen_unique
            UNIQUE ("customerId", "allergenName");
    END IF;
END $$;

DROP INDEX IF EXISTS idx_customer_allergies_customer_id;
