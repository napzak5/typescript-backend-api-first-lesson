-- ====================================================================
-- Migration: 202611181900_customer_merge.sql
-- Date: 2026-11-18 19:00
-- Purpose: Let a merge of two customers be recorded (#242).
--
--          customer_version_operation gets merge: the version a merge
--          keeps of each of the two customers, the one kept (its values
--          after the merge) and the one merged into it and deleted (its
--          values when it was deleted).
--
--          customer_points: a merge moves the balance of the customer it
--          deletes to the customer it keeps, as transfers. The customer
--          deleted gets one transfer that takes its balance to 0, the
--          customer kept one transfer for what is left of each increase
--          of the other's balance, with the expiry date of that increase,
--          so that the points expire as they would have. So:
--          - customer_points_expiry_of_earned: a transfer that adds
--            points may have an expiry date too.
--          - customer_points_reference_type_known: the reference of a
--            transfer is the other customer, as customer.
--          - customer_points_transfer_names_customer: a transfer, and
--            only a transfer, names a customer; no transfer was written
--            before, and no reference names one.
-- Idempotent: the value is added once, and the constraints are dropped
--             and added again with these conditions.
-- ====================================================================

ALTER TYPE customer_version_operation ADD VALUE IF NOT EXISTS 'merge';

ALTER TABLE customer_points
    DROP CONSTRAINT IF EXISTS customer_points_expiry_of_earned;
ALTER TABLE customer_points
    ADD CONSTRAINT customer_points_expiry_of_earned
    CHECK (
        "expiryDate" IS NULL
        OR "transactionType" = 'earned'
        OR ("transactionType" = 'transferred' AND points > 0)
    );

ALTER TABLE customer_points
    DROP CONSTRAINT IF EXISTS customer_points_reference_type_known;
ALTER TABLE customer_points
    ADD CONSTRAINT customer_points_reference_type_known
    CHECK (
        "referenceType" IS NULL
        OR "referenceType"::text IN ('sale', 'booking', 'customer')
    );

ALTER TABLE customer_points
    DROP CONSTRAINT IF EXISTS customer_points_transfer_names_customer;
ALTER TABLE customer_points
    ADD CONSTRAINT customer_points_transfer_names_customer
    CHECK (
        ("transactionType" = 'transferred')
        = ("referenceType" IS NOT DISTINCT FROM 'customer')
    );
