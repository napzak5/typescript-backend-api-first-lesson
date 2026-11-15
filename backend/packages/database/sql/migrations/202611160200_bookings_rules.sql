-- ====================================================================
-- Migration: 202611160200_bookings_rules.sql
-- Date: 2026-11-16 02:00
-- Purpose: Let the database state what a booking and its service lines
--          can be, before anything but the seed writes them.
--
--          - The nullable amounts of a booking (depositAmount,
--            pointsUsed, pointsEarned, cancellationFee) had a default of
--            0, and selectedOptions of a line one of '[]': a column that
--            a writer left out said "none" in another way than NULL. The
--            defaults go, and NULL is what an amount that was not set
--            is.
--          - CHECK constraints for what a row can be checked for by
--            itself. A booking and a line end after they begin, and their
--            duration is the minutes from the start to the end. No amount
--            is negative. The discount of a booking is not more than its
--            subtotal, and its total is the subtotal less the discount
--            plus the tax. The discount of a line is not negative and
--            not more than its price, so the price is not negative
--            either, and its final price is the price less the discount.
--            A line is completed exactly when it has the time of its
--            completion.
--          - The lines of a booking have an order: no two of them share
--            a sortOrder, and none is negative.
--          - The index on the staff member of a line also holds the start
--            time, because whether a staff member is free is asked for a
--            staff member and a time. The index on the salon of a booking
--            also holds the start time and the ID, the order in which the
--            bookings of a salon are listed. Each replaces the index on
--            the first column alone.
--
--          Rows written before: what follows from other columns is set
--          to what they say. The duration of a booking and of a line
--          becomes the minutes from the start to the end, the total of
--          a booking the subtotal less the discount plus the tax, the
--          final price of a line its price less its discount, and the
--          lines of a booking are numbered from 0 in the order they
--          had.
--
--          Rows that break another rule are not repaired: nothing says
--          which of two times is wrong, what a negative amount was
--          meant to be, or when a line without a time was completed.
--          The migration fails and they have to be corrected first.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    ALTER TABLE bookings ALTER COLUMN "depositAmount" DROP DEFAULT;
    ALTER TABLE bookings ALTER COLUMN "pointsUsed" DROP DEFAULT;
    ALTER TABLE bookings ALTER COLUMN "pointsEarned" DROP DEFAULT;
    ALTER TABLE bookings ALTER COLUMN "cancellationFee" DROP DEFAULT;
    ALTER TABLE booking_services ALTER COLUMN "selectedOptions" DROP DEFAULT;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_end_after_start'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_end_after_start
            CHECK ("startTime" < "endTime");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_duration_is_the_span'
    ) THEN
        UPDATE bookings
        SET duration = EXTRACT(EPOCH FROM ("endTime" - "startTime")) / 60
        WHERE duration * 60 <> EXTRACT(EPOCH FROM ("endTime" - "startTime"));
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_duration_is_the_span
            CHECK (duration * 60 = EXTRACT(EPOCH FROM ("endTime" - "startTime")));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_amounts_not_negative'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_amounts_not_negative
            CHECK (
                subtotal >= 0
                AND "discountAmount" >= 0
                AND "taxAmount" >= 0
                AND "totalAmount" >= 0
                AND ("depositAmount" IS NULL OR "depositAmount" >= 0)
                AND ("pointsUsed" IS NULL OR "pointsUsed" >= 0)
                AND ("pointsEarned" IS NULL OR "pointsEarned" >= 0)
                AND ("cancellationFee" IS NULL OR "cancellationFee" >= 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_discount_within_subtotal'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_discount_within_subtotal
            CHECK ("discountAmount" <= subtotal);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass
          AND conname = 'bookings_total_is_the_sum'
    ) THEN
        UPDATE bookings
        SET "totalAmount" = subtotal - "discountAmount" + "taxAmount"
        WHERE "totalAmount" <> subtotal - "discountAmount" + "taxAmount";
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_total_is_the_sum
            CHECK ("totalAmount" = subtotal - "discountAmount" + "taxAmount");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'booking_services'::regclass
          AND conname = 'booking_services_end_after_start'
    ) THEN
        ALTER TABLE booking_services
            ADD CONSTRAINT booking_services_end_after_start
            CHECK ("startTime" < "endTime");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'booking_services'::regclass
          AND conname = 'booking_services_duration_is_the_span'
    ) THEN
        UPDATE booking_services
        SET duration = EXTRACT(EPOCH FROM ("endTime" - "startTime")) / 60
        WHERE duration * 60 <> EXTRACT(EPOCH FROM ("endTime" - "startTime"));
        ALTER TABLE booking_services
            ADD CONSTRAINT booking_services_duration_is_the_span
            CHECK (duration * 60 = EXTRACT(EPOCH FROM ("endTime" - "startTime")));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'booking_services'::regclass
          AND conname = 'booking_services_discount_within_price'
    ) THEN
        ALTER TABLE booking_services
            ADD CONSTRAINT booking_services_discount_within_price
            CHECK ("discountAmount" >= 0 AND "discountAmount" <= price);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'booking_services'::regclass
          AND conname = 'booking_services_final_price_is_the_difference'
    ) THEN
        UPDATE booking_services
        SET "finalPrice" = price - "discountAmount"
        WHERE "finalPrice" <> price - "discountAmount";
        ALTER TABLE booking_services
            ADD CONSTRAINT booking_services_final_price_is_the_difference
            CHECK ("finalPrice" = price - "discountAmount");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'booking_services'::regclass
          AND conname = 'booking_services_completed_has_time'
    ) THEN
        ALTER TABLE booking_services
            ADD CONSTRAINT booking_services_completed_has_time
            CHECK ("isCompleted" = ("completedAt" IS NOT NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'booking_services'::regclass
          AND conname = 'booking_services_order_unique'
    ) THEN
        UPDATE booking_services
        SET "sortOrder" = numbered.position
        FROM (
            SELECT id,
                   row_number() OVER (
                       PARTITION BY "bookingId"
                       ORDER BY "sortOrder", "createdAt", id
                   ) - 1 AS position
            FROM booking_services
        ) AS numbered
        WHERE booking_services.id = numbered.id
          AND booking_services."sortOrder" <> numbered.position;
        ALTER TABLE booking_services
            ADD CONSTRAINT booking_services_order_unique
            UNIQUE ("bookingId", "sortOrder");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'booking_services'::regclass
          AND conname = 'booking_services_sort_order_not_negative'
    ) THEN
        ALTER TABLE booking_services
            ADD CONSTRAINT booking_services_sort_order_not_negative
            CHECK ("sortOrder" >= 0);
    END IF;

    CREATE INDEX IF NOT EXISTS idx_booking_services_staff_start
        ON booking_services ("staffId", "startTime");
    DROP INDEX IF EXISTS idx_booking_services_staff_id;

    CREATE INDEX IF NOT EXISTS idx_bookings_salon_start
        ON bookings ("salonId", "startTime", id);
    DROP INDEX IF EXISTS idx_bookings_salon_id;
END $$;
