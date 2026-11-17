-- ====================================================================
-- Migration: 202611171700_inventory_alert_acknowledgements.sql
-- Date: 2026-11-17 17:00
-- Purpose: Record who acknowledged an alert of the stock of a salon.
--
--          The alerts themselves are not stored: they are worked out of
--          the products, the stock rows and the stock movements whenever
--          they are read. An acknowledgement holds while what it was
--          about lasts, so it keeps what it was given for.
--
--          - inventory_alert_type: what an alert is about. The stock of
--            a product at a salon is at or below its minimum (low_stock)
--            or above its maximum (overstock); a stock row expires soon
--            (expiring) or has expired (expired).
--          - inventory_alert_severity: how soon an alert asks to be seen
--            to (info, warning, critical).
--          - inventory_alert_acknowledgements: one row for each time an
--            alert was acknowledged, never changed. An alert of a
--            product names no stock row and no expiry date, and keeps
--            the threshold it was acknowledged at; an alert of a stock
--            row names the row and the expiry date it had, and no
--            threshold. Each kind of alert has the severities it can
--            have. The staff member who acknowledged an alert is named
--            by the ID without a foreign key, as the staff member who
--            recorded a stock movement is; an administrator is null.
--            The acknowledgements go with the salon, the product and the
--            stock row they are about. The latest acknowledgement of an
--            alert is read by the product and the time.
--
--          The stock movements of a product are read from a time on
--          (those after an acknowledgement), so their index of the
--          product takes the time as well; the index of the product
--          alone is part of it and is dropped.
--
--          The versions before this one never read the table, so the
--          migration can be applied before or after the version that
--          serves the alerts.
-- Idempotent: the types, the table and the indexes are created once,
-- and the index of the product alone is dropped if it is there.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_alert_type') THEN
        CREATE TYPE "public"."inventory_alert_type" AS ENUM(
            'low_stock',
            'expiring',
            'expired',
            'overstock'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_alert_severity') THEN
        CREATE TYPE "public"."inventory_alert_severity" AS ENUM(
            'info',
            'warning',
            'critical'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS inventory_alert_acknowledgements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "salonId" uuid NOT NULL,
    "productId" uuid NOT NULL,
    "inventoryId" uuid,
    alert inventory_alert_type NOT NULL,
    severity inventory_alert_severity NOT NULL,
    threshold numeric(10, 2),
    "expiryDate" date,
    notes text,
    "acknowledgedBy" uuid,
    "acknowledgedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_alert_acknowledgements_salon_id_fk
        FOREIGN KEY ("salonId") REFERENCES salons (id) ON DELETE CASCADE,
    CONSTRAINT inventory_alert_acknowledgements_product_id_fk
        FOREIGN KEY ("productId") REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT inventory_alert_acknowledgements_inventory_id_fk
        FOREIGN KEY ("inventoryId") REFERENCES inventory (id) ON DELETE CASCADE,
    CONSTRAINT inventory_alert_acknowledgements_subject CHECK (
        (
            alert IN ('low_stock', 'overstock')
            AND "inventoryId" IS NULL
            AND "expiryDate" IS NULL
            AND threshold IS NOT NULL
            AND threshold >= 0
        )
        OR (
            alert IN ('expiring', 'expired')
            AND "inventoryId" IS NOT NULL
            AND "expiryDate" IS NOT NULL
            AND threshold IS NULL
        )
    ),
    CONSTRAINT inventory_alert_acknowledgements_severity CHECK (
        (alert <> 'low_stock' OR severity IN ('warning', 'critical'))
        AND (alert <> 'overstock' OR severity = 'info')
        AND (alert <> 'expiring' OR severity = 'warning')
        AND (alert <> 'expired' OR severity = 'critical')
    )
);

CREATE INDEX IF NOT EXISTS idx_inventory_alert_acknowledgements_product_time
    ON inventory_alert_acknowledgements USING btree ("productId", "acknowledgedAt");

CREATE INDEX IF NOT EXISTS idx_inventory_alert_acknowledgements_inventory_id
    ON inventory_alert_acknowledgements USING btree ("inventoryId");

CREATE INDEX IF NOT EXISTS idx_inventory_alert_acknowledgements_salon_id
    ON inventory_alert_acknowledgements USING btree ("salonId");

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_time
    ON inventory_transactions USING btree ("productId", "createdAt");

DROP INDEX IF EXISTS idx_inventory_transactions_product_id;
