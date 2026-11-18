-- ====================================================================
-- Migration: 202611182100_attachments.sql
-- Date: 2026-11-18 21:00
-- Purpose: Record the attachments: the files a salon keeps, such as
--          the photos of a treatment and its documents (#250).
--
--          attachments: one row for each file. The file itself is in
--          the object storage, under a key that is made of the id; the
--          row holds what is known of it.
--          - salonId: the salon the file belongs to. A file of no
--            salon is the platform's.
--          - filename: the name it was uploaded with, which a download
--            is saved under. It is no part of the key.
--          - contentType: the kind of file. Only kinds that a browser
--            does not run are taken.
--          - size: in bytes, 10 MiB (10485760) at most.
--          - status: pending from when the URL that takes the upload
--            is issued until the upload is completed, which looks at
--            the stored file; then uploaded, with the time (uploadedAt).
--          - uploadedBy: the user the upload URL was issued to.
--          - uploadExpiresAt: when that URL runs out.
--          - deletedAt: when the attachment was deleted. The row stays
--            until the purge removes it, because the upload URL may
--            still work then: what it would take is removed with the
--            row.
--          The uploaded attachments are listed in the order of
--          uploadedAt, of a salon or of all of them. The purge reads
--          the pending and the deleted ones in the order of
--          uploadExpiresAt.
-- Idempotent: the types are added once, the table and its indexes are
--             created once.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attachment_content_type') THEN
        CREATE TYPE "public"."attachment_content_type" AS ENUM(
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attachment_status') THEN
        CREATE TYPE "public"."attachment_status" AS ENUM(
            'pending',
            'uploaded'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "salonId" uuid,
    filename varchar(255) NOT NULL,
    "contentType" attachment_content_type NOT NULL,
    size integer NOT NULL,
    status attachment_status DEFAULT 'pending' NOT NULL,
    "uploadedBy" uuid NOT NULL,
    "uploadExpiresAt" timestamp with time zone NOT NULL,
    "uploadedAt" timestamp with time zone,
    "deletedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attachments_salon_id_fk
        FOREIGN KEY ("salonId") REFERENCES salons (id),
    CONSTRAINT attachments_uploaded_by_fk
        FOREIGN KEY ("uploadedBy") REFERENCES users (id),
    CONSTRAINT attachments_filename_not_empty
        CHECK (char_length(filename) >= 1),
    CONSTRAINT attachments_size_within_limit
        CHECK (size BETWEEN 1 AND 10485760),
    CONSTRAINT attachments_uploaded_when_uploaded
        CHECK ((status = 'uploaded') = ("uploadedAt" IS NOT NULL)),
    CONSTRAINT attachments_upload_expires_after_created
        CHECK ("uploadExpiresAt" > "createdAt")
);

CREATE INDEX IF NOT EXISTS idx_attachments_salon_uploaded
    ON attachments ("salonId", "uploadedAt", id)
    WHERE status = 'uploaded' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_attachments_uploaded
    ON attachments ("uploadedAt", id)
    WHERE status = 'uploaded' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_attachments_purge
    ON attachments ("uploadExpiresAt")
    WHERE status = 'pending' OR "deletedAt" IS NOT NULL;
