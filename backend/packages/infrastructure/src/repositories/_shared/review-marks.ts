import { reviewHelpfulVotes, reviews } from '@beauty-salon-backend/database'
import { and, eq, sql } from 'drizzle-orm'
import type { DatabaseExecutor } from '../../database/index'

/**
 * Counts the helpful count of a review again from its marks, as they are
 * after the mark just written, and returns it. The review is written only
 * when the count changes, and its `updatedAt` stays: what the review says
 * did not change.
 */
export const countMarksOf = async (
  tx: DatabaseExecutor,
  id: string,
): Promise<number> => {
  const counted = tx
    .select({
      marks: sql<number>`count(*)::integer`.as('marks'),
    })
    .from(reviewHelpfulVotes)
    .where(eq(reviewHelpfulVotes.reviewId, id))
    .as('counted')

  await tx
    .update(reviews)
    .set({ helpfulCount: sql`${counted.marks}` })
    .from(counted)
    .where(
      and(
        eq(reviews.id, id),
        sql`${reviews.helpfulCount} is distinct from ${counted.marks}`,
      ),
    )
  const [review] = await tx
    .select({ helpfulCount: reviews.helpfulCount })
    .from(reviews)
    .where(eq(reviews.id, id))
  return review?.helpfulCount ?? 0
}
