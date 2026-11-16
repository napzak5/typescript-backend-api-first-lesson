-- ====================================================================
-- Migration: 202611161000_customer_points_rules.sql
-- Date: 2026-11-16 10:00
-- Purpose: Let the database state what a point transaction of a
--          customer can be, and make the balance of every customer
--          the balance of their latest point transaction.
--
--          - The balance of a customer (customers.loyaltyPoints) is
--            not negative.
--          - CHECK constraints for what a point transaction can be
--            checked for by itself. Points that are earned are more
--            than none, points that are used or expire are less than
--            none, and an adjustment or a transfer moves some. The
--            balance after it is not negative. Only earned points
--            have an expiry date. A reference is a kind and an ID
--            together, or neither, and its kind is a sale or a
--            booking.
--          - One record is earned on once and used for once: a
--            partial unique index says so, so that a request sent
--            twice does not earn twice.
--          - The index on the customer of a point transaction also
--            holds the time and the ID, the order in which the
--            history of a customer is listed. It replaces the index
--            on the customer alone.
--          - Every customer whose loyaltyPoints differ from the
--            balance of their latest point transaction (0 when they
--            have none) gets an adjustment by the difference, described
--            as the opening balance of the ledger. Until now nothing
--            wrote a point transaction, and loyaltyPoints were written
--            by hand or by the seed.
--
--          Rows that were written by hand and break a rule are not
--          repaired: nothing says which of two columns is wrong. The
--          migration fails and they have to be corrected first.
--
--          The versions before this one write no point transaction
--          and never write loyaltyPoints, so the migration can be
--          applied before or after the version that serves the points
--          ledger.
-- Idempotent: each step is skipped once it has been applied, and the
--             adjustments are made only where a balance differs.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customers'::regclass
          AND conname = 'customers_loyalty_points_not_negative'
    ) THEN
        ALTER TABLE customers
            ADD CONSTRAINT customers_loyalty_points_not_negative
            CHECK ("loyaltyPoints" >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_points'::regclass
          AND conname = 'customer_points_points_of_type'
    ) THEN
        ALTER TABLE customer_points
            ADD CONSTRAINT customer_points_points_of_type
            CHECK (
                ("transactionType" <> 'earned' OR points >= 1)
                AND ("transactionType" NOT IN ('used', 'expired')
                    OR points <= -1)
                AND ("transactionType" NOT IN ('adjusted', 'transferred')
                    OR points <> 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_points'::regclass
          AND conname = 'customer_points_balance_not_negative'
    ) THEN
        ALTER TABLE customer_points
            ADD CONSTRAINT customer_points_balance_not_negative
            CHECK (balance >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_points'::regclass
          AND conname = 'customer_points_expiry_of_earned'
    ) THEN
        ALTER TABLE customer_points
            ADD CONSTRAINT customer_points_expiry_of_earned
            CHECK ("expiryDate" IS NULL OR "transactionType" = 'earned');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_points'::regclass
          AND conname = 'customer_points_reference_pair'
    ) THEN
        ALTER TABLE customer_points
            ADD CONSTRAINT customer_points_reference_pair
            CHECK (("referenceType" IS NULL) = ("referenceId" IS NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'customer_points'::regclass
          AND conname = 'customer_points_reference_type_known'
    ) THEN
        ALTER TABLE customer_points
            ADD CONSTRAINT customer_points_reference_type_known
            CHECK (
                "referenceType" IS NULL
                OR "referenceType"::text IN ('sale', 'booking')
            );
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS customer_points_reference_unique
        ON customer_points ("referenceType", "referenceId", "transactionType")
        WHERE "transactionType" IN ('earned', 'used')
          AND "referenceId" IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_customer_points_customer_time
        ON customer_points ("customerId", "createdAt", id);
    DROP INDEX IF EXISTS idx_customer_points_customer_id;

    INSERT INTO customer_points (
        "customerId", "transactionType", points, balance, description,
        "createdAt"
    )
    SELECT
        c.id,
        'adjusted',
        c."loyaltyPoints" - COALESCE(latest.balance, 0),
        c."loyaltyPoints",
        'ポイント台帳の開始残高',
        clock_timestamp()
    FROM customers c
    LEFT JOIN LATERAL (
        SELECT p.balance
        FROM customer_points p
        WHERE p."customerId" = c.id
        ORDER BY p."createdAt" DESC, p.id DESC
        LIMIT 1
    ) latest ON true
    WHERE c."loyaltyPoints" <> COALESCE(latest.balance, 0);
END $$;
