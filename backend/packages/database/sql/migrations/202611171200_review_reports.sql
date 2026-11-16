-- ====================================================================
-- Migration: 202611171200_review_reports.sql
-- Date: 2026-11-17 12:00
-- Purpose: Record the reports of reviews, and make the report count of
--          every review the number of its reports that are still open.
--
--          - review_report_reason: why a review is reported.
--          - review_report_status: whether a report is still open
--            (pending) or the administrators found nothing wrong with
--            the review (dismissed).
--          - review_reports: one row for each account that reported a
--            review. An account reports a review once: the review and
--            the account are unique together, the review first, so that
--            the reports of a review are read from the index. The rows
--            of a review go with it when it is removed. The account is
--            named by its user ID without a foreign key, as the user
--            who changed or cancelled a booking is.
--            CHECK constraints: a report that is dismissed says who
--            dismissed it and when, a pending one says neither; a
--            report for another reason says what it is about.
--            The administrators read the reports oldest first.
--          - The report count of a review is the number of its pending
--            reports. Until now nothing recorded a report and no
--            operation added to the count, so the counts that were
--            stored were written by the seed or by hand. Every review
--            is counted again, to 0 where it has no pending reports.
--
--          The versions before this one never read the table and never
--          write the report count, so the migration can be applied
--          before or after the version that serves the reports.
-- Idempotent: the types, the table and the index are created once, and
--             a review is written only where its count differs from
--             its pending reports.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_report_reason') THEN
        CREATE TYPE "public"."review_report_reason" AS ENUM(
            'inappropriate',
            'false_information',
            'personal_information',
            'spam',
            'other'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_report_status') THEN
        CREATE TYPE "public"."review_report_status" AS ENUM(
            'pending',
            'dismissed'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS review_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reviewId" uuid NOT NULL,
    "reportedBy" uuid NOT NULL,
    reason review_report_reason NOT NULL,
    details varchar(2000),
    status review_report_status DEFAULT 'pending' NOT NULL,
    "resolvedBy" uuid,
    "resolvedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_reports_review_reporter_unique
        UNIQUE ("reviewId", "reportedBy"),
    CONSTRAINT review_reports_review_id_fk
        FOREIGN KEY ("reviewId") REFERENCES reviews (id) ON DELETE CASCADE,
    CONSTRAINT review_reports_resolved_when_dismissed CHECK (
        (status = 'pending' AND "resolvedBy" IS NULL AND "resolvedAt" IS NULL)
        OR (status = 'dismissed' AND "resolvedBy" IS NOT NULL AND "resolvedAt" IS NOT NULL)
    ),
    CONSTRAINT review_reports_other_has_details CHECK (
        reason <> 'other' OR details IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_review_reports_created_at
    ON review_reports USING btree ("createdAt", id);

UPDATE reviews
SET "reportCount" = counted.reports
FROM (
    SELECT r.id, count(p.id)::integer AS reports
    FROM reviews r
    LEFT JOIN review_reports p
        ON p."reviewId" = r.id AND p.status = 'pending'
    GROUP BY r.id
) counted
WHERE reviews.id = counted.id
  AND reviews."reportCount" IS DISTINCT FROM counted.reports;
