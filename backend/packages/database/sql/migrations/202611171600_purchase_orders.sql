-- ====================================================================
-- Migration: 202611171600_purchase_orders.sql
-- Date: 2026-11-17 16:00
-- Purpose: Record what a salon orders from its suppliers.
--
--          - order_status: where a purchase order stands. A draft is
--            sent for approval (pending), approved, placed with the
--            supplier (ordered), shipped and delivered; it can be
--            cancelled until it is delivered.
--          - purchase_orders: one row for each order of a salon. The
--            order number is unique. The amounts are yen: the subtotal
--            is the sum of the items, and the total is the subtotal,
--            the tax and the shipping cost (none when it is null).
--            CHECK constraints: no amount below zero and the total of
--            its parts; an order that was approved says when, and an
--            order that is not approved yet does not; a cancelled order
--            says when and why, and no other order does; a delivered
--            order says when it was delivered, and no other order does.
--            The staff members who created and approved an order are
--            named by their IDs without a foreign key, as the staff
--            member who recorded a stock movement is. The orders of a
--            salon go with it when it is removed. A salon reads its
--            orders latest first.
--          - purchase_order_items: what is ordered, in the order of the
--            request. The code, the name and the unit of the product
--            are copied when the order is created, so that an order
--            says what was ordered after the product changes. A stock
--            row is ordered once in an order; when the row is removed
--            the item stays, without it. The total of an item is its
--            quantity times its unit price, rounded to the yen. The
--            items go with their order.
--
--          The versions before this one never read the tables, so the
--          migration can be applied before or after the version that
--          serves the purchase orders.
-- Idempotent: the type, the tables and the indexes are created once.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE "public"."order_status" AS ENUM(
            'draft',
            'pending',
            'approved',
            'ordered',
            'shipped',
            'delivered',
            'cancelled'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "salonId" uuid NOT NULL,
    "orderNumber" varchar(50) NOT NULL,
    supplier varchar(255) NOT NULL,
    status order_status DEFAULT 'draft' NOT NULL,
    subtotal integer NOT NULL,
    "taxAmount" integer NOT NULL,
    "shippingCost" integer,
    "totalAmount" integer NOT NULL,
    "orderDate" timestamp with time zone DEFAULT now() NOT NULL,
    "expectedDelivery" timestamp with time zone,
    "actualDelivery" timestamp with time zone,
    "deliveryNotes" text,
    "paymentTerms" text,
    notes text,
    "approvedBy" uuid,
    "approvedAt" timestamp with time zone,
    "cancelledAt" timestamp with time zone,
    "cancellationReason" text,
    "createdBy" uuid,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_orders_order_number_unique UNIQUE ("orderNumber"),
    CONSTRAINT purchase_orders_salon_id_fk
        FOREIGN KEY ("salonId") REFERENCES salons (id) ON DELETE CASCADE,
    CONSTRAINT purchase_orders_amounts CHECK (
        subtotal >= 0
        AND "taxAmount" >= 0
        AND ("shippingCost" IS NULL OR "shippingCost" >= 0)
        AND "totalAmount"::bigint = subtotal::bigint + "taxAmount"::bigint + coalesce("shippingCost", 0)::bigint
    ),
    CONSTRAINT purchase_orders_approval CHECK (
        ("approvedBy" IS NULL OR "approvedAt" IS NOT NULL)
        AND (status NOT IN ('draft', 'pending') OR "approvedAt" IS NULL)
        AND (status NOT IN ('approved', 'ordered', 'shipped', 'delivered') OR "approvedAt" IS NOT NULL)
    ),
    CONSTRAINT purchase_orders_cancellation CHECK (
        (status = 'cancelled') = ("cancelledAt" IS NOT NULL)
        AND ("cancelledAt" IS NULL) = ("cancellationReason" IS NULL)
    ),
    CONSTRAINT purchase_orders_delivery CHECK (
        (status = 'delivered') = ("actualDelivery" IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_salon_order_date
    ON purchase_orders USING btree ("salonId", "orderDate", id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "purchaseOrderId" uuid NOT NULL,
    "inventoryId" uuid,
    "productCode" varchar(100) NOT NULL,
    "productName" varchar(255) NOT NULL,
    quantity numeric(10, 2) NOT NULL,
    unit varchar(20) NOT NULL,
    "unitPrice" integer NOT NULL,
    "totalPrice" integer NOT NULL,
    notes text,
    "sortOrder" integer NOT NULL,
    CONSTRAINT purchase_order_items_order_inventory_unique
        UNIQUE ("purchaseOrderId", "inventoryId"),
    CONSTRAINT purchase_order_items_order_sort_unique
        UNIQUE ("purchaseOrderId", "sortOrder"),
    CONSTRAINT purchase_order_items_purchase_order_id_fk
        FOREIGN KEY ("purchaseOrderId") REFERENCES purchase_orders (id) ON DELETE CASCADE,
    CONSTRAINT purchase_order_items_inventory_id_fk
        FOREIGN KEY ("inventoryId") REFERENCES inventory (id) ON DELETE SET NULL,
    CONSTRAINT purchase_order_items_amounts CHECK (
        quantity > 0
        AND "unitPrice" >= 0
        AND "sortOrder" >= 0
        AND "totalPrice"::numeric = round("unitPrice"::numeric * quantity)
    )
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_inventory_id
    ON purchase_order_items USING btree ("inventoryId");
