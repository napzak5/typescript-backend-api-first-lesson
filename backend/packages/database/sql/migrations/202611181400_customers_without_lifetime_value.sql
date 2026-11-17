-- ====================================================================
-- Migration: 202611181400_customers_without_lifetime_value.sql
-- Date: 2026-11-18 14:00
-- Purpose: Count what a customer spent from the sales ledger, instead of
--          keeping a sum that nothing kept up to date (#236).
--
--          customers.lifetimeValue was said to follow from the sales,
--          but no sale, payment, refund or void changed it: it held what
--          the seed or a migration of old data wrote. The statistics of
--          a customer (GET /api/v1/customers/{id}/statistics) count what
--          the customer spent at a salon from the sales whenever they are
--          asked for. The column goes with what it holds, which no sale
--          tells the origin of.
--
--          The statement can run again and changes nothing then.
-- ====================================================================

ALTER TABLE customers DROP COLUMN IF EXISTS "lifetimeValue";
