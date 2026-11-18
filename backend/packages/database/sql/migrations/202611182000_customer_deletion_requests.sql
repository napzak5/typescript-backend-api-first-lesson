-- ====================================================================
-- Migration: 202611182000_customer_deletion_requests.sql
-- Date: 2026-11-18 20:00
-- Purpose: Record the requests to delete the data of a customer, and
--          let their erasure be recorded (#248).
--
--          customer_deletion_requests: one row for each request that a
--          salon takes from a customer to erase their data (the Act on
--          the Protection of Personal Information, article 35).
--          - status: pending until it is cancelled or carried out.
--            A customer has at most one pending request.
--          - requestedAt, requestedBy: when the request was taken, and
--            the user who took it.
--          - scheduledAt: from when the data may be erased, 14 days
--            after the request, so that a request made by mistake or
--            taken back can be cancelled. 14 days of 24 hours (336
--            hours), which no time zone of a session changes.
--          - cancelledAt and cancelledBy, completedAt and completedBy:
--            when and by whom it was cancelled or carried out, only
--            when it was.
--          The rows are kept when the data is erased: they tell that it
--          was, when, and at whose request. They go with the customer
--          when its row is removed, which the application never does.
--          The pending requests are read in the order of scheduledAt.
--
--          customer_version_operation gets erase: the one version an
--          erasure leaves of the customer, with the values the ledger
--          keeps after it. The versions before it are removed, as they
--          hold the personal data that is erased.
-- Idempotent: the value and the type are added once, the table and
--             its indexes are created once.
-- ====================================================================

ALTER TYPE customer_version_operation ADD VALUE IF NOT EXISTS 'erase';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_deletion_request_status') THEN
        CREATE TYPE "public"."customer_deletion_request_status" AS ENUM(
            'pending',
            'cancelled',
            'completed'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS customer_deletion_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customerId" uuid NOT NULL,
    reason text NOT NULL,
    status customer_deletion_request_status DEFAULT 'pending' NOT NULL,
    "requestedBy" uuid NOT NULL,
    "requestedAt" timestamp with time zone NOT NULL,
    "scheduledAt" timestamp with time zone NOT NULL,
    "cancelledBy" uuid,
    "cancelledAt" timestamp with time zone,
    "completedBy" uuid,
    "completedAt" timestamp with time zone,
    CONSTRAINT customer_deletion_requests_customer_id_fk
        FOREIGN KEY ("customerId") REFERENCES customers (id) ON DELETE CASCADE,
    CONSTRAINT customer_deletion_requests_requested_by_fk
        FOREIGN KEY ("requestedBy") REFERENCES users (id),
    CONSTRAINT customer_deletion_requests_cancelled_by_fk
        FOREIGN KEY ("cancelledBy") REFERENCES users (id),
    CONSTRAINT customer_deletion_requests_completed_by_fk
        FOREIGN KEY ("completedBy") REFERENCES users (id),
    CONSTRAINT customer_deletion_requests_reason_length
        CHECK (char_length(reason) BETWEEN 1 AND 1000),
    CONSTRAINT customer_deletion_requests_scheduled_after_grace
        CHECK ("scheduledAt" = "requestedAt" + interval '336 hours'),
    CONSTRAINT customer_deletion_requests_cancelled_when_cancelled
        CHECK (
            (status = 'cancelled') = ("cancelledAt" IS NOT NULL)
            AND ("cancelledAt" IS NULL) = ("cancelledBy" IS NULL)
        ),
    CONSTRAINT customer_deletion_requests_completed_when_completed
        CHECK (
            (status = 'completed') = ("completedAt" IS NOT NULL)
            AND ("completedAt" IS NULL) = ("completedBy" IS NULL)
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_deletion_requests_one_pending
    ON customer_deletion_requests ("customerId")
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_customer_deletion_requests_due
    ON customer_deletion_requests ("scheduledAt")
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_customer_deletion_requests_customer
    ON customer_deletion_requests ("customerId", "requestedAt");
