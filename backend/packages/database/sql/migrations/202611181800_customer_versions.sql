-- ====================================================================
-- Migration: 202611181800_customer_versions.sql
-- Date: 2026-11-18 18:00
-- Purpose: Keep every version of what the customer ledger writes of a
--          customer: who wrote it, when, and the values after the write
--          (#240).
--
--          customer_versions: one row for each write of a customer
--          through the ledger or the customer's own profile. The rows
--          are only added, never changed.
--          - version: counted from 1 for each customer; the write that
--            makes a version holds the row of the customer, so the next
--            number is taken after the one before is committed.
--          - operation: what the write did. baseline is the version of a
--            customer who was there before versions were kept: the values
--            the customer had when they began to be kept.
--          - changedBy: the user who wrote it. Only a baseline has none.
--          - changedAt: when it was written.
--          - the thirty columns of the ledger, with the types of the
--            columns of customers they copy: the values a create or an
--            update of the ledger writes. What bookings and the points
--            change (loyaltyPoints, the visits) is not a value of the
--            ledger, and the link to an account is not either.
--          The copies have no default and no constraint of their own:
--          each is written from the row of the customer after the write,
--          which holds to the constraints of customers. referredBy is not
--          a foreign key, so that a version keeps the referrer it had.
--
--          The versions go with the customer when its row is removed;
--          the application never removes one, but the personal data of a
--          customer is in the versions too, and must go with it when it
--          is erased. A user who changed a customer keeps the row of the
--          user (users are deleted by marking them).
--
--          The history of a customer is read newest first, through the
--          unique constraint on the customer and the version.
--
--          Every customer who is there gets the baseline version, once.
-- Idempotent: the type, the table and the baselines are created once.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_version_operation') THEN
        CREATE TYPE "public"."customer_version_operation" AS ENUM(
            'baseline',
            'create',
            'update',
            'delete',
            'restore'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS customer_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customerId" uuid NOT NULL,
    version integer NOT NULL,
    operation customer_version_operation NOT NULL,
    "changedBy" uuid,
    "changedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "firstName" varchar(100) NOT NULL,
    "lastName" varchar(100) NOT NULL,
    "firstNameKana" varchar(100),
    "lastNameKana" varchar(100),
    email varchar(255) NOT NULL,
    "phoneNumber" varchar(20) NOT NULL,
    "alternativePhone" varchar(20),
    "postalCode" varchar(10),
    prefecture varchar(50),
    city varchar(100),
    address varchar(255),
    building varchar(255),
    "birthDate" date,
    gender varchar(20),
    occupation varchar(100),
    "membershipTier" membership_tier NOT NULL,
    preferences jsonb,
    notes text,
    "internalNotes" text,
    tags text[] NOT NULL,
    "referredBy" uuid,
    "referralCode" varchar(50),
    "allowMarketing" boolean NOT NULL,
    "allowSms" boolean NOT NULL,
    "allowEmail" boolean NOT NULL,
    "isActive" boolean NOT NULL,
    "hairType" hair_type,
    "hairThickness" hair_thickness,
    "scalpCondition" scalp_condition,
    "customerStatus" customer_status NOT NULL,
    CONSTRAINT customer_versions_customer_id_fk
        FOREIGN KEY ("customerId") REFERENCES customers (id) ON DELETE CASCADE,
    CONSTRAINT customer_versions_changed_by_fk
        FOREIGN KEY ("changedBy") REFERENCES users (id),
    CONSTRAINT customer_versions_customer_version_unique
        UNIQUE ("customerId", version),
    CONSTRAINT customer_versions_version_positive CHECK (version > 0),
    CONSTRAINT customer_versions_changed_by_unless_baseline
        CHECK ((operation = 'baseline') = ("changedBy" IS NULL))
);

INSERT INTO customer_versions (
    "customerId", version, operation, "changedBy",
    "firstName", "lastName", "firstNameKana", "lastNameKana", email,
    "phoneNumber", "alternativePhone", "postalCode", prefecture, city,
    address, building, "birthDate", gender, occupation, "membershipTier",
    preferences, notes, "internalNotes", tags, "referredBy", "referralCode",
    "allowMarketing", "allowSms", "allowEmail", "isActive", "hairType",
    "hairThickness", "scalpCondition", "customerStatus"
)
SELECT
    c.id, 1, 'baseline', NULL,
    c."firstName", c."lastName", c."firstNameKana", c."lastNameKana", c.email,
    c."phoneNumber", c."alternativePhone", c."postalCode", c.prefecture, c.city,
    c.address, c.building, c."birthDate", c.gender, c.occupation,
    c."membershipTier", c.preferences, c.notes, c."internalNotes", c.tags,
    c."referredBy", c."referralCode", c."allowMarketing", c."allowSms",
    c."allowEmail", c."isActive", c."hairType", c."hairThickness",
    c."scalpCondition", c."customerStatus"
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM customer_versions v WHERE v."customerId" = c.id
);
