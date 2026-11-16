-- ====================================================================
-- Migration: 202611160700_sales_rules.sql
-- Date: 2026-11-16 07:00
-- Purpose: Let the database state what a sale and its lines can be,
--          before anything writes them.
--
--          - The nullable points of a sale (pointsUsed, pointsEarned)
--            had a default of 0: a column that a writer left out said
--            "none" in another way than NULL. The defaults go, and NULL
--            is what points that were not noted are.
--          - CHECK constraints for what a row can be checked for by
--            itself. No amount of a sale is negative, its discount is
--            not more than its subtotal, and its total is the subtotal
--            less the discount plus the tax. A sale is void exactly
--            when it has the time it was voided at, and only a void
--            sale has a reason. A sale without a customer has no
--            points, which are a customer's.
--          - The same for a line: at least one of what is sold, no
--            negative amount, a discount that is not more than the
--            quantity times the unit price, and a total that is the
--            quantity times the unit price less the discount plus the
--            tax (worked out as bigint: the product of two integers
--            need not be one). A commission rate is a percentage. Only
--            a line of a service or of a product names a record, since
--            nothing says which table the ID of another line is of.
--          - The lines of a sale have an order: no two of them share a
--            sortOrder, and none is negative.
--          - A booking has one sale that is not void: a sale is the
--            bill of one visit. A partial unique index says so.
--          - The index on the salon of a sale also holds the time of the
--            sale and the ID, the order in which the sales of a salon
--            are listed. It replaces the index on the salon alone.
--
--          No operation has written these tables so far. Rows that were
--          written by hand and break a rule are not repaired: nothing
--          says which of two amounts is wrong. The migration fails and
--          they have to be corrected first.
-- Idempotent: each step is skipped once it has been applied.
-- ====================================================================

DO $$
BEGIN
    ALTER TABLE sales ALTER COLUMN "pointsUsed" DROP DEFAULT;
    ALTER TABLE sales ALTER COLUMN "pointsEarned" DROP DEFAULT;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales'::regclass
          AND conname = 'sales_amounts_not_negative'
    ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT sales_amounts_not_negative
            CHECK (
                subtotal >= 0
                AND "discountAmount" >= 0
                AND "taxAmount" >= 0
                AND "totalAmount" >= 0
                AND ("pointsUsed" IS NULL OR "pointsUsed" >= 0)
                AND ("pointsEarned" IS NULL OR "pointsEarned" >= 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales'::regclass
          AND conname = 'sales_discount_within_subtotal'
    ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT sales_discount_within_subtotal
            CHECK ("discountAmount" <= subtotal);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales'::regclass
          AND conname = 'sales_total_is_the_sum'
    ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT sales_total_is_the_sum
            CHECK ("totalAmount" = subtotal - "discountAmount" + "taxAmount");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales'::regclass
          AND conname = 'sales_void_has_time'
    ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT sales_void_has_time
            CHECK ("isVoid" = ("voidedAt" IS NOT NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales'::regclass
          AND conname = 'sales_void_reason_of_void'
    ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT sales_void_reason_of_void
            CHECK ("voidReason" IS NULL OR "isVoid");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales'::regclass
          AND conname = 'sales_points_need_customer'
    ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT sales_points_need_customer
            CHECK (
                "customerId" IS NOT NULL
                OR ("pointsUsed" IS NULL AND "pointsEarned" IS NULL)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales_details'::regclass
          AND conname = 'sales_details_quantity_positive'
    ) THEN
        ALTER TABLE sales_details
            ADD CONSTRAINT sales_details_quantity_positive
            CHECK (quantity >= 1);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales_details'::regclass
          AND conname = 'sales_details_amounts_not_negative'
    ) THEN
        ALTER TABLE sales_details
            ADD CONSTRAINT sales_details_amounts_not_negative
            CHECK (
                "unitPrice" >= 0
                AND "discountAmount" >= 0
                AND "taxAmount" >= 0
                AND "totalAmount" >= 0
                AND ("commissionAmount" IS NULL OR "commissionAmount" >= 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales_details'::regclass
          AND conname = 'sales_details_discount_within_price'
    ) THEN
        ALTER TABLE sales_details
            ADD CONSTRAINT sales_details_discount_within_price
            CHECK ("discountAmount" <= quantity::bigint * "unitPrice");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales_details'::regclass
          AND conname = 'sales_details_total_is_the_sum'
    ) THEN
        ALTER TABLE sales_details
            ADD CONSTRAINT sales_details_total_is_the_sum
            CHECK (
                "totalAmount"
                = quantity::bigint * "unitPrice" - "discountAmount" + "taxAmount"
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales_details'::regclass
          AND conname = 'sales_details_commission_rate_is_a_percentage'
    ) THEN
        ALTER TABLE sales_details
            ADD CONSTRAINT sales_details_commission_rate_is_a_percentage
            CHECK (
                "commissionRate" IS NULL
                OR ("commissionRate" >= 0 AND "commissionRate" <= 100)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales_details'::regclass
          AND conname = 'sales_details_item_of_a_known_type'
    ) THEN
        ALTER TABLE sales_details
            ADD CONSTRAINT sales_details_item_of_a_known_type
            CHECK (
                "itemId" IS NULL
                OR "itemType"::text IN ('service', 'product')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales_details'::regclass
          AND conname = 'sales_details_order_unique'
    ) THEN
        ALTER TABLE sales_details
            ADD CONSTRAINT sales_details_order_unique
            UNIQUE ("saleId", "sortOrder");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'sales_details'::regclass
          AND conname = 'sales_details_sort_order_not_negative'
    ) THEN
        ALTER TABLE sales_details
            ADD CONSTRAINT sales_details_sort_order_not_negative
            CHECK ("sortOrder" >= 0);
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS sales_booking_live_unique
        ON sales ("bookingId")
        WHERE NOT "isVoid";

    CREATE INDEX IF NOT EXISTS idx_sales_salon_time
        ON sales ("salonId", "saleTime", id);
    DROP INDEX IF EXISTS idx_sales_salon_id;
END $$;
