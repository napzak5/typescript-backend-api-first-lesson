-- ====================================================================
-- Migration: 202611151500_customers_user_unique.sql
-- Date: 2026-11-15 15:00
-- Purpose: One account, one customer.
--
--          A signed-in customer reaches their own customer record
--          through users."customerId"; customers."userId" points back.
--          Nothing kept two customers from naming one account.
--
--          - customers."userId" becomes unique among the customers that
--            are not deleted. The index replaces idx_customers_user_id,
--            which covered the same column.
--          - An account does not stay linked to a deleted customer.
--            Deleting a customer clears users."customerId" from now on;
--            the accounts linked to customers deleted before are cleared
--            here.
--
--          If two customers that are not deleted name the same account,
--          the unique index cannot be built and the migration fails:
--          which of the two is the account's is for a person to decide.
--
--          customers."userId" gets no foreign key. users."customerId"
--          has one, and two tables that refer to each other leave the
--          Drizzle schema that is generated from the database without
--          types (TS7022). The two columns are written together, in one
--          transaction, by the code that links and unlinks them.
-- Idempotent: each step changes nothing once it has been applied.
-- ====================================================================

UPDATE users
SET "customerId" = NULL
WHERE "customerId" IN (
    SELECT id FROM customers WHERE "deletedAt" IS NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_user_unique
    ON customers ("userId")
    WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS idx_customers_user_id;
