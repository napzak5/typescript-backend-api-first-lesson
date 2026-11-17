-- ====================================================================
-- Migration: 202611171400_inventory_rules.sql
-- Date: 2026-11-17 14:00
-- Purpose: Let the database state what a stock row of a salon can be,
--          before the API writes one.
--
--          - A stock row is one lot of one product of a salon, and the
--            salon, the product and the lot number are unique among the
--            rows. The unique constraint inventory_unique counts two rows
--            without a lot number as different, so a product that is not
--            kept by lots could have any number of rows. A unique index
--            over the rows without a lot number allows one a product.
--            (NULLS NOT DISTINCT on the constraint would say the same,
--            but drizzle-kit 0.31 reads every unique constraint back as
--            NULLS DISTINCT, so setup.sql, generated from what it reads,
--            would lose it.)
--          - A CHECK constraint for the stock of a row: none of it is
--            negative, no more is reserved than there is, and what is
--            available is what there is less what is reserved.
--
--          Rows that break the rules are not repaired: nothing says
--          which of two rows of a product, or which of the stock figures,
--          is wrong. The migration fails and they have to be corrected
--          first.
--
--          The versions before this one do not write stock rows, so
--          they go on working once the migration is applied.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'inventory'::regclass
          AND conname = 'inventory_stock'
    ) THEN
        ALTER TABLE inventory
            ADD CONSTRAINT inventory_stock
            CHECK (
                "currentStock" >= 0
                AND "reservedStock" >= 0
                AND "reservedStock" <= "currentStock"
                AND "availableStock" = "currentStock" - "reservedStock"
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_unique_without_lot
    ON inventory ("salonId", "productId")
    WHERE "lotNumber" IS NULL;
