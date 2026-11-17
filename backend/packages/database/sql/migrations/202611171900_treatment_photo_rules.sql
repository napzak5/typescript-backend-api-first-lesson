-- ====================================================================
-- Migration: 202611171900_treatment_photo_rules.sql
-- Date: 2026-11-17 19:00
-- Purpose: Let the database state what a photo of a treatment record
--          can be, before the API adds one.
--
--          - photoType, any text of up to 20 characters, becomes the
--            enum treatment_photo_type (before, during, after, other):
--            the photos before and after a treatment are put side by
--            side, which a free text does not allow.
--          - A photo shown outside the salon (isPublic) is one the
--            customer consented to (customerConsent), and the order of
--            a photo (sortOrder) is not below zero.
--          - A record holds one photo of an address: a request sent
--            twice does not add its photos twice.
--          - The index on photoType goes: nothing looks photos up by
--            their kind across records. The index on the record goes
--            too: the unique constraint begins with the record.
--
--          Rows that break the new rules are not repaired: nothing says
--          what they should have been. The migration fails and they have
--          to be corrected first.
--
--          The versions before this one write no photo and read the
--          photos as text, which an enum value is read as, so they go on
--          working once the migration is applied.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DROP INDEX IF EXISTS idx_treatment_photos_photo_type;
DROP INDEX IF EXISTS idx_treatment_photos_treatment_record_id;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatment_photo_type') THEN
        CREATE TYPE "public"."treatment_photo_type" AS ENUM(
            'before',
            'during',
            'after',
            'other'
        );
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'treatment_photos'
          AND column_name = 'photoType'
          AND data_type = 'character varying'
    ) THEN
        ALTER TABLE treatment_photos
            ALTER COLUMN "photoType" TYPE "public"."treatment_photo_type"
            USING "photoType"::text::"public"."treatment_photo_type";
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'treatment_photos'::regclass
          AND conname = 'treatment_photos_consent'
    ) THEN
        ALTER TABLE treatment_photos
            ADD CONSTRAINT treatment_photos_consent
            CHECK (NOT "isPublic" OR "customerConsent");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'treatment_photos'::regclass
          AND conname = 'treatment_photos_sort_order'
    ) THEN
        ALTER TABLE treatment_photos
            ADD CONSTRAINT treatment_photos_sort_order
            CHECK ("sortOrder" >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'treatment_photos'::regclass
          AND conname = 'treatment_photos_record_url_unique'
    ) THEN
        ALTER TABLE treatment_photos
            ADD CONSTRAINT treatment_photos_record_url_unique
            UNIQUE ("treatmentRecordId", "photoUrl");
    END IF;
END $$;
