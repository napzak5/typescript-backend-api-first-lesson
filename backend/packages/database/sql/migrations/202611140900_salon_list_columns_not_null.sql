-- ====================================================================
-- Migration: 202611140900_salon_list_columns_not_null.sql
-- Date: 2026-11-14 09:00
-- Purpose: Give the list columns of salons a real element type and make
--          them, and reviewCount, NOT NULL.
--
--          imageUrls / features / amenities were nullable jsonb with a
--          default of '[]', so a list could be NULL, empty, or not a list
--          at all, and the application had to guess. They become
--          text[] NOT NULL without a default: every writer states the
--          list explicitly. reviewCount had DEFAULT 0 but still accepted
--          NULL; it becomes NOT NULL.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
DECLARE
    list_column text;
BEGIN
    -- Converts a jsonb array of strings to text[]; anything else becomes an empty list.
    CREATE OR REPLACE FUNCTION pg_temp.jsonb_to_text_array(value jsonb)
    RETURNS text[]
    LANGUAGE sql
    IMMUTABLE
    AS $function$
        SELECT CASE
            WHEN jsonb_typeof(value) = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(value))
            ELSE '{}'::text[]
        END
    $function$;

    FOREACH list_column IN ARRAY ARRAY['imageUrls', 'features', 'amenities']
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'salons'
              AND column_name = list_column
              AND data_type = 'jsonb'
        ) THEN
            EXECUTE format('ALTER TABLE salons ALTER COLUMN %I DROP DEFAULT', list_column);
            EXECUTE format(
                'ALTER TABLE salons ALTER COLUMN %I TYPE text[] USING pg_temp.jsonb_to_text_array(%I)',
                list_column,
                list_column
            );
            EXECUTE format('ALTER TABLE salons ALTER COLUMN %I SET NOT NULL', list_column);
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'salons'
          AND column_name = 'reviewCount'
          AND is_nullable = 'YES'
    ) THEN
        UPDATE salons SET "reviewCount" = 0 WHERE "reviewCount" IS NULL;
        ALTER TABLE salons ALTER COLUMN "reviewCount" SET NOT NULL;
    END IF;
END $$;
