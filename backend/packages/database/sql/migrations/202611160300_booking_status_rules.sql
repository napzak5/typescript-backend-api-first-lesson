-- ====================================================================
-- Migration: 202611160300_booking_status_rules.sql
-- Date: 2026-11-16 03:00
-- Purpose: Let the database state what goes with the status of a
--          booking and what the counts of a customer are, before the
--          status actions write them.
--
--          - A booking has the time it was cancelled exactly when it is
--            cancelled, and only then who cancelled it, why, and for
--            what fee. It has the time it was completed exactly when it
--            is completed. A booking in progress has the time it
--            actually began, and an actual end is after the actual
--            start.
--          - The visits, no-shows and cancellations of a customer are
--            the numbers of their completed, no_show and cancelled
--            bookings, and the first and the last visit are the
--            earliest and the latest day of a completed one. None of
--            the numbers is negative, the customer has the two days
--            exactly when they have a visit, and the first is not after
--            the last.
--
--          Rows written before: a cancellation fee of 0 on a booking
--          that is not cancelled was the default the column had, not a
--          fee anyone set, and becomes NULL. The five columns of every
--          customer are set to what their bookings say: nothing but the
--          seed wrote them, and it wrote numbers that no booking stood
--          for.
--
--          Rows that break another rule are not repaired: nothing says
--          when a booking without the time was cancelled or completed,
--          or which of a status and what was noted for another status
--          is wrong. The migration fails and they have to be corrected
--          first.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_cancelled_has_time'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_cancelled_has_time
            CHECK ((status = 'cancelled') = ("cancelledAt" IS NOT NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_cancellation_only_when_cancelled'
    ) THEN
        UPDATE bookings
        SET "cancellationFee" = NULL
        WHERE status <> 'cancelled' AND "cancellationFee" = 0;
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_cancellation_only_when_cancelled
            CHECK (
                status = 'cancelled'
                OR (
                    "cancelledBy" IS NULL
                    AND "cancellationReason" IS NULL
                    AND "cancellationFee" IS NULL
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_completed_has_time'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_completed_has_time
            CHECK ((status = 'completed') = ("completedAt" IS NOT NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_in_progress_has_start'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_in_progress_has_start
            CHECK (status <> 'in_progress' OR "actualStartTime" IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_actual_end_after_start'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_actual_end_after_start
            CHECK (
                "actualStartTime" IS NULL
                OR "actualEndTime" IS NULL
                OR "actualStartTime" < "actualEndTime"
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customers'::regclass
          AND conname = 'customers_visit_days_go_with_visits'
    ) THEN
        UPDATE customers
        SET "visitCount" = counted.visits,
            "noShowCount" = counted.no_shows,
            "cancellationCount" = counted.cancellations,
            "firstVisitDate" = counted.first_visit,
            "lastVisitDate" = counted.last_visit
        FROM (
            SELECT customers.id,
                   count(*) FILTER (WHERE bookings.status = 'completed') AS visits,
                   count(*) FILTER (WHERE bookings.status = 'no_show') AS no_shows,
                   count(*) FILTER (WHERE bookings.status = 'cancelled') AS cancellations,
                   min(bookings."bookingDate") FILTER (WHERE bookings.status = 'completed') AS first_visit,
                   max(bookings."bookingDate") FILTER (WHERE bookings.status = 'completed') AS last_visit
            FROM customers
            LEFT JOIN bookings ON bookings."customerId" = customers.id
            GROUP BY customers.id
        ) AS counted
        WHERE customers.id = counted.id
          AND (
              customers."visitCount",
              customers."noShowCount",
              customers."cancellationCount",
              customers."firstVisitDate",
              customers."lastVisitDate"
          ) IS DISTINCT FROM (
              counted.visits,
              counted.no_shows,
              counted.cancellations,
              counted.first_visit,
              counted.last_visit
          );
        ALTER TABLE customers
            ADD CONSTRAINT customers_visit_days_go_with_visits
            CHECK (
                ("visitCount" = 0) = ("firstVisitDate" IS NULL)
                AND ("firstVisitDate" IS NULL) = ("lastVisitDate" IS NULL)
                AND ("firstVisitDate" IS NULL OR "firstVisitDate" <= "lastVisitDate")
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customers'::regclass
          AND conname = 'customers_counts_not_negative'
    ) THEN
        ALTER TABLE customers
            ADD CONSTRAINT customers_counts_not_negative
            CHECK (
                "visitCount" >= 0
                AND "noShowCount" >= 0
                AND "cancellationCount" >= 0
            );
    END IF;
END $$;
