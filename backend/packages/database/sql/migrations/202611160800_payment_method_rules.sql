-- ====================================================================
-- Migration: 202611160800_payment_method_rules.sql
-- Date: 2026-11-16 08:00
-- Purpose: Let the database state what a payment method of a salon can
--          be, before anything writes one.
--
--          - The nullable fee of a payment method had a default of 0: a
--            row whose writer left the fee out said "no fee" where it
--            meant "not noted". The default goes, and NULL is what a
--            fee that was not noted is.
--          - CHECK constraints for what a row can be checked for by
--            itself. A fee is a percentage. A limit of the amount of
--            one payment is at least 1, and the lower limit is not
--            above the upper one. No sortOrder is negative.
--
--          No operation has written this table so far. Rows that were
--          written by hand and break a rule are not repaired: nothing
--          says which of two limits is wrong. The migration fails and
--          they have to be corrected first.
--
--          The versions before this one neither read nor write the
--          table, so the migration can be applied before or after the
--          version that serves the payment methods.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    ALTER TABLE payment_methods ALTER COLUMN fee DROP DEFAULT;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_methods'::regclass
          AND conname = 'payment_methods_fee_is_a_percentage'
    ) THEN
        ALTER TABLE payment_methods
            ADD CONSTRAINT payment_methods_fee_is_a_percentage
            CHECK (fee IS NULL OR (fee >= 0 AND fee <= 100));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_methods'::regclass
          AND conname = 'payment_methods_amount_limits'
    ) THEN
        ALTER TABLE payment_methods
            ADD CONSTRAINT payment_methods_amount_limits
            CHECK (
                ("minimumAmount" IS NULL OR "minimumAmount" >= 1)
                AND ("maximumAmount" IS NULL OR "maximumAmount" >= 1)
                AND (
                    "minimumAmount" IS NULL
                    OR "maximumAmount" IS NULL
                    OR "minimumAmount" <= "maximumAmount"
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_methods'::regclass
          AND conname = 'payment_methods_sort_order_not_negative'
    ) THEN
        ALTER TABLE payment_methods
            ADD CONSTRAINT payment_methods_sort_order_not_negative
            CHECK ("sortOrder" >= 0);
    END IF;
END $$;
