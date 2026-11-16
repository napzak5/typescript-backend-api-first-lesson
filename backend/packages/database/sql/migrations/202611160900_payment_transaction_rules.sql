-- ====================================================================
-- Migration: 202611160900_payment_transaction_rules.sql
-- Date: 2026-11-16 09:00
-- Purpose: Let the database state what a payment of a sale can be,
--          before anything writes one.
--
--          CHECK constraints for what a row can be checked for by
--          itself:
--          - The amount of a payment is at least 1.
--          - A payment that was received (completed, or refunded in
--            full or in part) has the time it was received at, and no
--            other payment has one.
--          - A payment that failed has the time it failed at, and no
--            other payment has one; only a failed payment has an error
--            code or an error message.
--          - A payment that was refunded has the time and the amount
--            of the refund, and no other payment has them; only a
--            refunded payment has a reason. A refund in full is of the
--            whole amount, a refund in part of at least 1 and of less.
--          - The last four digits of a card are four digits.
--
--          What the payments of a sale say together (no more is
--          received than the sale charges, and the payment status of
--          the sale follows from them) spans rows and tables: the
--          transactions that write a payment hold the sale and
--          guarantee it.
--
--          No operation has written this table so far. Rows that were
--          written by hand and break a rule are not repaired: nothing
--          says which of two columns is wrong. The migration fails and
--          they have to be corrected first.
--
--          The versions before this one write no payment, so the
--          migration can be applied before or after the version that
--          records payments.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_transactions'::regclass
          AND conname = 'payment_transactions_amount_positive'
    ) THEN
        ALTER TABLE payment_transactions
            ADD CONSTRAINT payment_transactions_amount_positive
            CHECK (amount >= 1);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_transactions'::regclass
          AND conname = 'payment_transactions_received_has_time'
    ) THEN
        ALTER TABLE payment_transactions
            ADD CONSTRAINT payment_transactions_received_has_time
            CHECK (
                (status IN ('completed', 'refunded', 'partial_refund'))
                = ("processedAt" IS NOT NULL)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_transactions'::regclass
          AND conname = 'payment_transactions_failure_of_failed'
    ) THEN
        ALTER TABLE payment_transactions
            ADD CONSTRAINT payment_transactions_failure_of_failed
            CHECK (
                ((status = 'failed') = ("failedAt" IS NOT NULL))
                AND (
                    status = 'failed'
                    OR ("errorCode" IS NULL AND "errorMessage" IS NULL)
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_transactions'::regclass
          AND conname = 'payment_transactions_refund_of_refunded'
    ) THEN
        ALTER TABLE payment_transactions
            ADD CONSTRAINT payment_transactions_refund_of_refunded
            CHECK (
                ((status IN ('refunded', 'partial_refund'))
                    = ("refundedAt" IS NOT NULL))
                AND ((status IN ('refunded', 'partial_refund'))
                    = ("refundAmount" IS NOT NULL))
                AND (
                    status IN ('refunded', 'partial_refund')
                    OR "refundReason" IS NULL
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_transactions'::regclass
          AND conname = 'payment_transactions_refund_amount'
    ) THEN
        ALTER TABLE payment_transactions
            ADD CONSTRAINT payment_transactions_refund_amount
            CHECK (
                (status <> 'refunded' OR "refundAmount" = amount)
                AND (
                    status <> 'partial_refund'
                    OR ("refundAmount" >= 1 AND "refundAmount" < amount)
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'payment_transactions'::regclass
          AND conname = 'payment_transactions_card_last_four_digits'
    ) THEN
        ALTER TABLE payment_transactions
            ADD CONSTRAINT payment_transactions_card_last_four_digits
            CHECK (
                "cardLastFour" IS NULL
                OR "cardLastFour"::text ~ '^[0-9]{4}$'
            );
    END IF;
END $$;
