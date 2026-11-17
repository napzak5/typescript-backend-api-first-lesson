-- ====================================================================
-- Migration: 202611171500_inventory_transaction_rules.sql
-- Date: 2026-11-17 15:00
-- Purpose: Let the database state what a stock movement can be, before
--          the API writes one, and make the stock of every stock row
--          the balance of its latest movement.
--
--          - CHECK constraints for what a movement can be checked for
--            by itself. It moves some stock: a purchase brings stock
--            in, a sale, a use in a treatment and a disposal take it
--            out, and an adjustment, a return and a transfer go either
--            way. The balance after it is the balance before it and the
--            quantity, and neither is negative. A unit cost comes with
--            the total cost, the unit cost times the quantity moved,
--            rounded; neither is negative. A reference is a kind and an
--            ID together, or neither. An adjustment and a disposal
--            state why.
--          - The index on the stock row of a movement also holds the
--            time and the ID, the order in which the movements of a
--            row are listed. It replaces the index on the row alone.
--          - Every stock row whose stock differs from the balance after
--            its latest movement (0 when it has none) gets an
--            adjustment by the difference, stated as the stock at which
--            the movements began to be recorded. Until now nothing
--            wrote a movement, and the stock was written by the seed.
--
--          Movements that break a rule are not repaired: nothing says
--          which of their columns is wrong. The migration fails and
--          they have to be corrected first.
--
--          The versions before this one write no movement and do not
--          change the stock of a row, so the migration can be applied
--          before or after the version that records movements.
-- Idempotent: each step is skipped once it has been applied, and the
--             adjustments are made only where the stock differs.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'inventory_transactions'::regclass
          AND conname = 'inventory_transactions_quantity_of_type'
    ) THEN
        ALTER TABLE inventory_transactions
            ADD CONSTRAINT inventory_transactions_quantity_of_type
            CHECK (
                quantity <> 0
                AND ("transactionType" <> 'purchase' OR quantity > 0)
                AND ("transactionType" NOT IN ('sale', 'use', 'disposal')
                    OR quantity < 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'inventory_transactions'::regclass
          AND conname = 'inventory_transactions_balance'
    ) THEN
        ALTER TABLE inventory_transactions
            ADD CONSTRAINT inventory_transactions_balance
            CHECK (
                "balanceBefore" >= 0
                AND "balanceAfter" >= 0
                AND "balanceAfter" = "balanceBefore" + quantity
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'inventory_transactions'::regclass
          AND conname = 'inventory_transactions_cost'
    ) THEN
        ALTER TABLE inventory_transactions
            ADD CONSTRAINT inventory_transactions_cost
            CHECK (
                ("unitCost" IS NULL AND "totalCost" IS NULL)
                OR (
                    "unitCost" IS NOT NULL
                    AND "totalCost" IS NOT NULL
                    AND "unitCost" >= 0
                    AND "totalCost" = round("unitCost" * abs(quantity))
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'inventory_transactions'::regclass
          AND conname = 'inventory_transactions_reference_pair'
    ) THEN
        ALTER TABLE inventory_transactions
            ADD CONSTRAINT inventory_transactions_reference_pair
            CHECK (("referenceType" IS NULL) = ("referenceId" IS NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'inventory_transactions'::regclass
          AND conname = 'inventory_transactions_reason_of_type'
    ) THEN
        ALTER TABLE inventory_transactions
            ADD CONSTRAINT inventory_transactions_reason_of_type
            CHECK (
                "transactionType" NOT IN ('adjustment', 'disposal')
                OR reason IS NOT NULL
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_time
    ON inventory_transactions ("inventoryId", "createdAt", id);
DROP INDEX IF EXISTS idx_inventory_transactions_inventory_id;

INSERT INTO inventory_transactions (
    "salonId", "productId", "inventoryId", "transactionType", quantity,
    "balanceBefore", "balanceAfter", "lotNumber", "expiryDate", reason,
    "createdAt"
)
SELECT
    i."salonId",
    i."productId",
    i.id,
    'adjustment',
    i."currentStock" - COALESCE(latest."balanceAfter", 0),
    COALESCE(latest."balanceAfter", 0),
    i."currentStock",
    i."lotNumber",
    i."expiryDate",
    '在庫移動の記録を始めた時点の在庫数',
    clock_timestamp()
FROM inventory i
LEFT JOIN LATERAL (
    SELECT t."balanceAfter"
    FROM inventory_transactions t
    WHERE t."inventoryId" = i.id
    ORDER BY t."createdAt" DESC, t.id DESC
    LIMIT 1
) latest ON true
WHERE i."currentStock" <> COALESCE(latest."balanceAfter", 0);
