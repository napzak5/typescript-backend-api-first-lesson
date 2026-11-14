-- ====================================================================
-- Migration: 202611150900_customers_columns.sql
-- Date: 2026-11-15 09:00
-- Purpose: Let the database state what a customer always has.
--
--          - tags was nullable jsonb with a default of '[]', so the list
--            could be NULL, empty, or not a list at all. It becomes
--            text[] NOT NULL without a default: every writer states the
--            list.
--          - customerStatus had a default but still accepted NULL; it
--            becomes NOT NULL.
--          - preferences had a default of '{}', which is not what the API
--            calls preferences ({ preferredServices, notes }). The
--            default goes: a customer without preferences has NULL. A
--            CHECK constraint keeps the value an object; what the object
--            holds is checked when it is read.
--          - email is stored in lower case, as the email of a user is,
--            so that one address is one customer however it was typed. A
--            CHECK constraint keeps it so. The unique constraint covered
--            deleted customers too, so the address of a customer who was
--            deleted could never be registered again; it becomes a
--            unique index over the customers that are not deleted. The
--            index keeps the name of the constraint, which is what a
--            violation reports.
--          - gender is free text in the database and one of four values
--            in the API. A CHECK constraint keeps it one of them.
--          - A customer is not the one who referred them.
--
--          Rows written before: tags that are NULL or not a list become
--          empty, and an entry that is not a string is dropped. A status
--          of NULL becomes 'active'. Preferences that are not an object,
--          or are '{}', become NULL; any other object is rebuilt with
--          the entries of preferredServices that name a service category
--          and with notes if that is a text that says something. An
--          email and a gender are put in lower case; a gender that is
--          then not one of the four values becomes NULL. A reference of
--          a customer to themselves becomes NULL.
--
--          If putting the emails in lower case leaves two customers who
--          are not deleted with the same address, the unique index
--          cannot be built and the migration fails: which of the two
--          stays is for a person to decide.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
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

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'customers'
          AND column_name = 'tags'
          AND data_type = 'jsonb'
    ) THEN
        ALTER TABLE customers ALTER COLUMN tags DROP DEFAULT;
        ALTER TABLE customers
            ALTER COLUMN tags TYPE text[]
            USING pg_temp.jsonb_to_text_array(tags);
        ALTER TABLE customers ALTER COLUMN tags SET NOT NULL;
    END IF;

    -- The column keeps its default ('active'), which fills the rows without a value.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'customers'
          AND column_name = 'customerStatus'
          AND is_nullable = 'YES'
    ) THEN
        UPDATE customers SET "customerStatus" = DEFAULT WHERE "customerStatus" IS NULL;
        ALTER TABLE customers ALTER COLUMN "customerStatus" SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customers'::regclass
          AND conname = 'customers_preferences_is_an_object'
    ) THEN
        ALTER TABLE customers ALTER COLUMN preferences DROP DEFAULT;

        UPDATE customers
        SET preferences = NULL
        WHERE jsonb_typeof(preferences) <> 'object' OR preferences = '{}'::jsonb;

        UPDATE customers
        SET preferences = jsonb_build_object(
            'preferredServices',
            COALESCE(
                (
                    SELECT jsonb_agg(entry.item ORDER BY entry.ordinal)
                    FROM jsonb_array_elements(
                        CASE
                            WHEN jsonb_typeof(preferences -> 'preferredServices') = 'array'
                                THEN preferences -> 'preferredServices'
                            ELSE '[]'::jsonb
                        END
                    ) WITH ORDINALITY AS entry(item, ordinal)
                    WHERE jsonb_typeof(entry.item) = 'string'
                      AND (entry.item #>> '{}') = ANY (enum_range(NULL::service_category)::text[])
                ),
                '[]'::jsonb
            ),
            'notes',
            CASE
                WHEN jsonb_typeof(preferences -> 'notes') = 'string'
                     AND (preferences ->> 'notes') ~ '\S'
                    THEN preferences -> 'notes'
                ELSE 'null'::jsonb
            END
        )
        WHERE preferences IS NOT NULL;

        ALTER TABLE customers
            ADD CONSTRAINT customers_preferences_is_an_object
            CHECK (jsonb_typeof(preferences) = 'object');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customers'::regclass
          AND conname = 'customers_email_lower_case'
    ) THEN
        -- The old constraint goes first: it would refuse an address that, in
        -- lower case, equals the address of a deleted customer.
        ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_unique;
        UPDATE customers SET email = lower(email) WHERE email <> lower(email);
        CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
            ON customers (email)
            WHERE "deletedAt" IS NULL;
        ALTER TABLE customers
            ADD CONSTRAINT customers_email_lower_case
            CHECK (email = lower(email));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customers'::regclass
          AND conname = 'customers_gender_known'
    ) THEN
        UPDATE customers SET gender = lower(gender) WHERE gender <> lower(gender);
        UPDATE customers
        SET gender = NULL
        WHERE gender NOT IN ('male', 'female', 'other', 'prefer_not_to_say');
        -- Compared as text: PostgreSQL then writes the constraint back in a
        -- form that reads the same when it is applied again (sql/setup.sql).
        ALTER TABLE customers
            ADD CONSTRAINT customers_gender_known
            CHECK (gender::text IN ('male', 'female', 'other', 'prefer_not_to_say'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customers'::regclass
          AND conname = 'customers_not_referred_by_itself'
    ) THEN
        UPDATE customers SET "referredBy" = NULL WHERE "referredBy" = id;
        ALTER TABLE customers
            ADD CONSTRAINT customers_not_referred_by_itself
            CHECK ("referredBy" <> id);
    END IF;
END $$;
