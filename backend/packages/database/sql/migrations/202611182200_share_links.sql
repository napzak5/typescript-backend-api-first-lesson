-- ====================================================================
-- Migration: 202611182200_share_links.sql
-- Date: 2026-11-18 22:00
-- Purpose: Record the share links: what lets somebody without an
--          account see one uploaded attachment until a time (#251).
--
--          share_links: one row for each link.
--          - attachmentId: the attachment the link shows. The link goes
--            with its attachment: when the purge removes the row of
--            the attachment, the links are removed with it.
--          - tokenHash: the SHA-256 of the token a viewer presents.
--            The token is in no column: reading the table yields no
--            link that works.
--          - passwordHash: the hash of the password the link asks for;
--            null for a link without one.
--          - expiresAt: until when the link works: after it was
--            created, and 720 hours (30 days) later at most. Hours,
--            because a day is not the same span in every time zone.
--          - maxDownloads: how many download URLs the link issues at
--            most; null for no limit.
--          - downloadCount: how many it has issued.
--          - failedAttempts: the wrong passwords since the last right
--            one.
--          - lockedUntil: until when the link takes no password, after
--            too many wrong ones.
--          - createdBy: the user who created the link.
--          The links of an attachment are listed in the order of
--          createdAt.
-- Idempotent: the table and its index are created once.
-- ====================================================================

CREATE TABLE IF NOT EXISTS share_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "attachmentId" uuid NOT NULL,
    "tokenHash" text NOT NULL,
    "passwordHash" text,
    "expiresAt" timestamp with time zone NOT NULL,
    "maxDownloads" integer,
    "downloadCount" integer DEFAULT 0 NOT NULL,
    "failedAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp with time zone,
    "createdBy" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT share_links_attachment_id_fk
        FOREIGN KEY ("attachmentId") REFERENCES attachments (id)
        ON DELETE CASCADE,
    CONSTRAINT share_links_created_by_fk
        FOREIGN KEY ("createdBy") REFERENCES users (id),
    CONSTRAINT share_links_token_hash_unique UNIQUE ("tokenHash"),
    CONSTRAINT share_links_expires_within_limit
        CHECK (
            "expiresAt" > "createdAt"
            AND "expiresAt" <= "createdAt" + interval '720 hours'
        ),
    CONSTRAINT share_links_max_downloads_positive
        CHECK ("maxDownloads" IS NULL OR "maxDownloads" >= 1),
    CONSTRAINT share_links_download_count_within_limit
        CHECK (
            "downloadCount" >= 0
            AND ("maxDownloads" IS NULL OR "downloadCount" <= "maxDownloads")
        ),
    CONSTRAINT share_links_failed_attempts_not_negative
        CHECK ("failedAttempts" >= 0)
);

CREATE INDEX IF NOT EXISTS idx_share_links_attachment_created
    ON share_links ("attachmentId", "createdAt", id);
