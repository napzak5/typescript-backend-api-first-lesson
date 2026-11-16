-- ====================================================================
-- Migration: 202611171000_review_rules.sql
-- Date: 2026-11-17 10:00
-- Purpose: Let the database state what a review can be, and make the
--          rating and the review count of every salon those of its
--          reviews.
--
--          - CHECK constraints for what a review can be checked for by
--            itself. Every rating is from 1 to 5; the overall rating is
--            required, the others may be missing. The helpful and the
--            report counts are not negative. A response of the salon
--            is a text and the time it was given together, or neither.
--          - The image URLs of a review are a JSON array, never NULL:
--            a review without images has an empty array. Reviews whose
--            imageUrls are NULL (or the JSON null) get an empty array.
--          - The rating of a salon is the average of the overall
--            ratings of its reviews, rounded to two decimals, and its
--            review count is the number of its reviews. Until now
--            nothing counted them, and the seed wrote figures of its
--            own. Every salon is counted again; a salon without reviews
--            has no rating and a count of 0. CHECK constraints say that
--            the count is not negative, that a rating is from 1 to 5,
--            and that a salon has a rating exactly when it has reviews.
--
--          Rows that were written by hand and break a rule of a review
--          are not repaired: nothing says what the right value is. The
--          migration fails and they have to be corrected first.
--
--          The versions before this one write no review and never
--          write the rating or the review count of a salon, so the
--          migration can be applied before or after the version that
--          serves the reviews.
-- Idempotent: each step is skipped once it has been applied, and a
--             salon is written only where a figure differs.
-- ====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'reviews'::regclass
          AND conname = 'reviews_ratings_in_range'
    ) THEN
        ALTER TABLE reviews
            ADD CONSTRAINT reviews_ratings_in_range
            CHECK (
                "overallRating" >= 1 AND "overallRating" <= 5
                AND ("serviceRating" IS NULL
                    OR ("serviceRating" >= 1 AND "serviceRating" <= 5))
                AND ("staffRating" IS NULL
                    OR ("staffRating" >= 1 AND "staffRating" <= 5))
                AND ("atmosphereRating" IS NULL
                    OR ("atmosphereRating" >= 1 AND "atmosphereRating" <= 5))
                AND ("cleanlinessRating" IS NULL
                    OR ("cleanlinessRating" >= 1 AND "cleanlinessRating" <= 5))
                AND ("valueRating" IS NULL
                    OR ("valueRating" >= 1 AND "valueRating" <= 5))
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'reviews'::regclass
          AND conname = 'reviews_counts_not_negative'
    ) THEN
        ALTER TABLE reviews
            ADD CONSTRAINT reviews_counts_not_negative
            CHECK ("helpfulCount" >= 0 AND "reportCount" >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'reviews'::regclass
          AND conname = 'reviews_owner_response_pair'
    ) THEN
        ALTER TABLE reviews
            ADD CONSTRAINT reviews_owner_response_pair
            CHECK (("ownerResponse" IS NULL) = ("ownerRespondedAt" IS NULL));
    END IF;

    UPDATE reviews
    SET "imageUrls" = '[]'::jsonb
    WHERE "imageUrls" IS NULL OR jsonb_typeof("imageUrls") = 'null';
    ALTER TABLE reviews ALTER COLUMN "imageUrls" SET NOT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'reviews'::regclass
          AND conname = 'reviews_image_urls_array'
    ) THEN
        ALTER TABLE reviews
            ADD CONSTRAINT reviews_image_urls_array
            CHECK (jsonb_typeof("imageUrls") = 'array');
    END IF;

    UPDATE salons s
    SET rating = counted.rating, "reviewCount" = counted.reviews
    FROM (
        SELECT
            salon.id,
            round(avg(review."overallRating"), 2) AS rating,
            count(review.id)::integer AS reviews
        FROM salons salon
        LEFT JOIN reviews review ON review."salonId" = salon.id
        GROUP BY salon.id
    ) counted
    WHERE s.id = counted.id
      AND (s.rating IS DISTINCT FROM counted.rating
          OR s."reviewCount" IS DISTINCT FROM counted.reviews);

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'salons'::regclass
          AND conname = 'salons_review_count_not_negative'
    ) THEN
        ALTER TABLE salons
            ADD CONSTRAINT salons_review_count_not_negative
            CHECK ("reviewCount" >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'salons'::regclass
          AND conname = 'salons_rating_in_range'
    ) THEN
        ALTER TABLE salons
            ADD CONSTRAINT salons_rating_in_range
            CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'salons'::regclass
          AND conname = 'salons_rating_of_reviews'
    ) THEN
        ALTER TABLE salons
            ADD CONSTRAINT salons_rating_of_reviews
            CHECK (("reviewCount" = 0) = (rating IS NULL));
    END IF;
END $$;
