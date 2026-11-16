-- ====================================================================
-- Migration: 202611171100_review_helpful_votes.sql
-- Date: 2026-11-17 11:00
-- Purpose: Record who found a review helpful, and make the helpful
--          count of every review the number of those who did.
--
--          - review_helpful_votes: one row for each customer who marked
--            a review as helpful. A customer marks a review once: the
--            review and the customer are unique together, the review
--            first, so that the marks of a review are read from the
--            index. The rows of a review go with it when it is removed;
--            customers are only ever deleted by marking them, so their
--            rows stay.
--          - The helpful count of a review is the number of its rows.
--            Until now nothing recorded who marked a review and no
--            operation added to the count, so the counts that were
--            stored were written by the seed or by hand. Every review
--            is counted again, to 0 where it has no rows.
--
--          The versions before this one never read the table and never
--          write the helpful count, so the migration can be applied
--          before or after the version that serves the marks.
-- Idempotent: the table is created once, and a review is written only
--             where its count differs from its rows.
-- ====================================================================

CREATE TABLE IF NOT EXISTS review_helpful_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reviewId" uuid NOT NULL,
    "customerId" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_helpful_votes_review_customer_unique
        UNIQUE ("reviewId", "customerId"),
    CONSTRAINT review_helpful_votes_review_id_fk
        FOREIGN KEY ("reviewId") REFERENCES reviews (id) ON DELETE CASCADE,
    CONSTRAINT review_helpful_votes_customer_id_fk
        FOREIGN KEY ("customerId") REFERENCES customers (id) ON DELETE CASCADE
);

UPDATE reviews
SET "helpfulCount" = counted.votes
FROM (
    SELECT r.id, count(v."reviewId")::integer AS votes
    FROM reviews r
    LEFT JOIN review_helpful_votes v ON v."reviewId" = r.id
    GROUP BY r.id
) counted
WHERE reviews.id = counted.id
  AND reviews."helpfulCount" IS DISTINCT FROM counted.votes;
