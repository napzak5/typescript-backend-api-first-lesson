-- ====================================================================
-- Migration: 202611181000_medical_charts.sql
-- Date: 2026-11-18 10:00
-- Purpose: Keep the medical chart of a customer: what the staff check
--          before a treatment.
--
--          medical_charts: one row for a customer, which goes with the
--          customer. A customer who is deleted keeps the row, as the
--          customer row is kept; neither is shown.
--          - previousTreatments: the treatments the customer had before
--            (at another salon, or before the records began), a list of
--            objects of the API model PreviousTreatment.
--          - medicalConditions: what the staff are to heed of the
--            customer's health, in their words.
--          - preferredProducts and avoidProducts: the names of products
--            and brands the customer likes and those to stay away from.
--          - notes: anything else.
--          An empty list says there is nothing, so the lists are NOT
--          NULL, as the lists of a treatment record are. They have no
--          default: a chart is written with every column stated, as
--          customers.tags is.
--
--          What the chart does not keep is kept elsewhere: the allergies
--          of a customer are the rows of customer_allergies; the usual
--          scalp and hair of a customer are the columns of customers;
--          their state at a treatment is in the treatment record.
--
--          CHECK constraints for what a row can be checked for by itself:
--          previousTreatments is a list, and the lists of names hold no
--          NULL.
--
--          The list of the charts is read latest first, by the time and
--          the ID; a chart is read by its customer through the unique
--          constraint.
--
--          The versions before this one never read the table, so the
--          migration can be applied before or after the version that
--          serves the charts.
-- Idempotent: the table and the index are created once.
-- ====================================================================

CREATE TABLE IF NOT EXISTS medical_charts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customerId" uuid NOT NULL,
    "previousTreatments" jsonb NOT NULL,
    "medicalConditions" text,
    "preferredProducts" text[] NOT NULL,
    "avoidProducts" text[] NOT NULL,
    notes text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT medical_charts_customer_id_fk
        FOREIGN KEY ("customerId") REFERENCES customers (id) ON DELETE CASCADE,
    CONSTRAINT medical_charts_customer_id_unique UNIQUE ("customerId"),
    CONSTRAINT medical_charts_lists CHECK (
        jsonb_typeof("previousTreatments") = 'array'
        AND array_position("preferredProducts", NULL) IS NULL
        AND array_position("avoidProducts", NULL) IS NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_medical_charts_created_at
    ON medical_charts USING btree ("createdAt", id);
