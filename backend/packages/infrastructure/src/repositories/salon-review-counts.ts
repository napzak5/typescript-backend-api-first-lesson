import { reviews, salons } from '@beauty-salon-backend/database'
import { and, eq, sql } from 'drizzle-orm'
import { CLOCK } from '../database/clock'
import type { DatabaseExecutor } from '../database/index'

/**
 * Counts the rating and the review count of a salon again from its
 * reviews, as they are after the review just written, changed or removed:
 * the average of the overall ratings rounded to two decimals, and no
 * rating without reviews. The salon is written only when a figure
 * changes.
 */
export const countReviewsOf = async (
  tx: DatabaseExecutor,
  salonId: string,
): Promise<void> => {
  const counted = tx
    .select({
      // Not `rating`: the name would be that of the column of the salon.
      averageRating: sql<
        string | null
      >`round(avg(${reviews.overallRating}), 2)`.as('average_rating'),
      reviewCount: sql<number>`count(*)::integer`.as('review_count'),
    })
    .from(reviews)
    .where(eq(reviews.salonId, salonId))
    .as('counted')

  await tx
    .update(salons)
    .set({
      rating: sql`${counted.averageRating}`,
      reviewCount: sql`${counted.reviewCount}`,
      updatedAt: CLOCK,
    })
    .from(counted)
    .where(
      and(
        eq(salons.id, salonId),
        sql`(${salons.rating}, ${salons.reviewCount}) is distinct from (${counted.averageRating}, ${counted.reviewCount})`,
      ),
    )
}
