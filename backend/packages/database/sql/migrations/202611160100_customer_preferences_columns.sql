-- ====================================================================
-- Migration: 202611160100_customer_preferences_columns.sql
-- Date: 2026-11-16 01:00
-- Purpose: Let the database state what the preferences of a customer
--          are.
--
--          - avoidStaffIds was nullable jsonb with a default of '[]', so
--            the list could be NULL, empty, or not a list of IDs at all.
--            It becomes uuid[] NOT NULL without a default: every writer
--            states the list, and no staff member is the empty list.
--          - preferredTimeSlots was nullable with a default of '[]'. It
--            becomes NOT NULL without a default, and a CHECK constraint
--            keeps it an array. What the array holds is checked when it
--            is read.
--          - stylePreferences had a default of '{}', which is not what
--            the API calls a style preference. The default goes: a
--            customer without one has NULL. A CHECK constraint keeps the
--            value an object; what the object holds is checked when it
--            is read.
--          - preferredServices goes. Nothing read or wrote it and what it
--            would hold was never defined; the service categories a
--            customer prefers are in customers.preferences.
--          - The staff member a customer prefers is not one they avoid.
--          - idx_customer_preferences_customer_id goes: the unique
--            constraint on customerId has an index over the same column.
--
--          Rows written before: an avoidStaffIds that is NULL or not a
--          list becomes empty, and an entry that is not a UUID, or that
--          repeats an earlier one, is dropped. A preferredTimeSlots that
--          is NULL or not a list becomes empty; an entry is kept, with
--          its two times alone, if it has a startTime and a later endTime
--          in HH:mm. A stylePreferences that is not an object, or is '{}',
--          becomes NULL; any other object is rebuilt with
--          preferredLength if that is a text that says something, and
--          with the texts of its three lists.
--
--          A row whose preferred staff member is among those it avoids
--          is not repaired: nothing says which of the two was meant. The
--          migration fails and the row has to be corrected first.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    -- Converts a jsonb array to uuid[], keeping the entries that are UUIDs, each once, in their order.
    CREATE OR REPLACE FUNCTION pg_temp.jsonb_to_uuid_array(value jsonb)
    RETURNS uuid[]
    LANGUAGE sql
    IMMUTABLE
    AS $function$
        SELECT CASE
            WHEN jsonb_typeof(value) = 'array'
                THEN ARRAY(
                    SELECT first.id::uuid
                    FROM (
                        SELECT lower(entry.item #>> '{}') AS id, min(entry.ordinal) AS ordinal
                        FROM jsonb_array_elements(value) WITH ORDINALITY AS entry(item, ordinal)
                        WHERE jsonb_typeof(entry.item) = 'string'
                          AND (entry.item #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        GROUP BY 1
                    ) AS first
                    ORDER BY first.ordinal
                )
            ELSE '{}'::uuid[]
        END
    $function$;

    -- Keeps the texts of a jsonb array, in their order; anything else is the empty array.
    CREATE OR REPLACE FUNCTION pg_temp.jsonb_texts(value jsonb)
    RETURNS jsonb
    LANGUAGE sql
    IMMUTABLE
    AS $function$
        SELECT COALESCE(
            (
                SELECT jsonb_agg(entry.item ORDER BY entry.ordinal)
                FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(value) = 'array' THEN value ELSE '[]'::jsonb END
                ) WITH ORDINALITY AS entry(item, ordinal)
                WHERE jsonb_typeof(entry.item) = 'string'
            ),
            '[]'::jsonb
        )
    $function$;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'customer_preferences'
          AND column_name = 'avoidStaffIds'
          AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE customer_preferences ALTER COLUMN "avoidStaffIds" DROP DEFAULT;
        ALTER TABLE customer_preferences
            ALTER COLUMN "avoidStaffIds" TYPE uuid[]
            USING pg_temp.jsonb_to_uuid_array("avoidStaffIds");
        ALTER TABLE customer_preferences ALTER COLUMN "avoidStaffIds" SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_preferences'::regclass
          AND conname = 'customer_preferences_time_slots_is_an_array'
    ) THEN
        ALTER TABLE customer_preferences ALTER COLUMN "preferredTimeSlots" DROP DEFAULT;

        UPDATE customer_preferences
        SET "preferredTimeSlots" = COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'startTime', entry.item -> 'startTime',
                        'endTime', entry.item -> 'endTime'
                    )
                    ORDER BY entry.ordinal
                )
                FROM jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof("preferredTimeSlots") = 'array' THEN "preferredTimeSlots"
                        ELSE '[]'::jsonb
                    END
                ) WITH ORDINALITY AS entry(item, ordinal)
                WHERE jsonb_typeof(entry.item) = 'object'
                  AND jsonb_typeof(entry.item -> 'startTime') = 'string'
                  AND jsonb_typeof(entry.item -> 'endTime') = 'string'
                  AND (entry.item ->> 'startTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                  AND (entry.item ->> 'endTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                  AND (entry.item ->> 'startTime') < (entry.item ->> 'endTime')
            ),
            '[]'::jsonb
        );

        ALTER TABLE customer_preferences ALTER COLUMN "preferredTimeSlots" SET NOT NULL;
        ALTER TABLE customer_preferences
            ADD CONSTRAINT customer_preferences_time_slots_is_an_array
            CHECK (jsonb_typeof("preferredTimeSlots") = 'array');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_preferences'::regclass
          AND conname = 'customer_preferences_style_is_an_object'
    ) THEN
        ALTER TABLE customer_preferences ALTER COLUMN "stylePreferences" DROP DEFAULT;

        UPDATE customer_preferences
        SET "stylePreferences" = NULL
        WHERE jsonb_typeof("stylePreferences") <> 'object' OR "stylePreferences" = '{}'::jsonb;

        UPDATE customer_preferences
        SET "stylePreferences" = jsonb_build_object(
            'preferredLength',
            CASE
                WHEN jsonb_typeof("stylePreferences" -> 'preferredLength') = 'string'
                     AND ("stylePreferences" ->> 'preferredLength') ~ '\S'
                    THEN "stylePreferences" -> 'preferredLength'
                ELSE 'null'::jsonb
            END,
            'preferredColors', pg_temp.jsonb_texts("stylePreferences" -> 'preferredColors'),
            'avoidStyles', pg_temp.jsonb_texts("stylePreferences" -> 'avoidStyles'),
            'inspirationImages', pg_temp.jsonb_texts("stylePreferences" -> 'inspirationImages')
        )
        WHERE "stylePreferences" IS NOT NULL;

        ALTER TABLE customer_preferences
            ADD CONSTRAINT customer_preferences_style_is_an_object
            CHECK (jsonb_typeof("stylePreferences") = 'object');
    END IF;

    ALTER TABLE customer_preferences DROP COLUMN IF EXISTS "preferredServices";

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_preferences'::regclass
          AND conname = 'customer_preferences_preferred_staff_not_avoided'
    ) THEN
        -- No preferred staff member (NULL) passes, as it does a comparison with NULL anywhere.
        ALTER TABLE customer_preferences
            ADD CONSTRAINT customer_preferences_preferred_staff_not_avoided
            CHECK ("preferredStaffId" <> ALL ("avoidStaffIds"));
    END IF;
END $$;

DROP INDEX IF EXISTS idx_customer_preferences_customer_id;
