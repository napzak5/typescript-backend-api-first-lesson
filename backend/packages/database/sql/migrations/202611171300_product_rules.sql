-- ====================================================================
-- Migration: 202611171300_product_rules.sql
-- Date: 2026-11-17 13:00
-- Purpose: Let the database state what a product of a salon can be,
--          before the API writes one.
--
--          - minimumStock had a default of 0 but accepted NULL, which
--            said nothing a stock level of 0 does not. NULL becomes 0
--            and the column becomes NOT NULL; the default stays.
--          - supplierId named a supplier without a foreign key, and
--            there is no table of suppliers for it to name, so nothing
--            could check or show it. The purchase orders of the
--            contract name a supplier by its name. The column goes and
--            supplier, the name of the supplier, takes its place. The
--            IDs that were stored named nothing and are dropped.
--          - The product code was unique among all the products of a
--            salon, deleted ones too, so the code of a product that was
--            deleted could not be given to another. The constraint
--            becomes a unique index over the rows that are not
--            deleted. The index keeps the name of the constraint,
--            which is what a violation reports.
--          - CHECK constraints for what a row can be checked for by
--            itself: no price is negative; the stock levels are not
--            negative and lie in order, the minimum not above the
--            reorder point and the reorder point not above the
--            maximum, of those that are there; the lead time is not
--            negative; the months to expiry are at least 1.
--
--          Rows that break a CHECK are not repaired: nothing says which
--          of two stock levels is wrong. The migration fails and they
--          have to be corrected first.
--
--          The versions before this one read only the ID of a product
--          (a sale looks up the products it names), so they go on
--          working once the migration is applied. The version that
--          serves the products reads supplier, which this migration
--          adds: it starts after the migration, as every release does.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    UPDATE products SET "minimumStock" = 0 WHERE "minimumStock" IS NULL;
    ALTER TABLE products ALTER COLUMN "minimumStock" SET NOT NULL;

    ALTER TABLE products DROP COLUMN IF EXISTS "supplierId";
    ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier varchar(255);

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'products'::regclass
          AND conname = 'products_code_salon_unique'
    ) THEN
        ALTER TABLE products DROP CONSTRAINT products_code_salon_unique;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'products'::regclass
          AND conname = 'products_prices_not_negative'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_prices_not_negative
            CHECK (
                ("purchasePrice" IS NULL OR "purchasePrice" >= 0)
                AND ("retailPrice" IS NULL OR "retailPrice" >= 0)
                AND ("salonPrice" IS NULL OR "salonPrice" >= 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'products'::regclass
          AND conname = 'products_stock_levels'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_stock_levels
            CHECK (
                "minimumStock" >= 0
                AND ("reorderPoint" IS NULL OR "reorderPoint" >= "minimumStock")
                AND ("maximumStock" IS NULL OR "maximumStock" >= "minimumStock")
                AND (
                    "reorderPoint" IS NULL
                    OR "maximumStock" IS NULL
                    OR "reorderPoint" <= "maximumStock"
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'products'::regclass
          AND conname = 'products_lead_time_not_negative'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_lead_time_not_negative
            CHECK ("leadTimeDays" IS NULL OR "leadTimeDays" >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'products'::regclass
          AND conname = 'products_expiry_months_positive'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_expiry_months_positive
            CHECK ("expiryMonths" IS NULL OR "expiryMonths" >= 1);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS products_code_salon_unique
    ON products ("salonId", "productCode")
    WHERE "deletedAt" IS NULL;
