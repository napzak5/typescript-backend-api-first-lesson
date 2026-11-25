import { reviewHelpfulVotes, reviews } from '@beauty-salon-backend/database'
import { and, count, eq, ne } from 'drizzle-orm'
import { totalOf } from '../../database/count'
import type { DatabaseExecutor } from '../../database/index'

/**
 * Counts the helpful count of a review again from its marks, as they are
 * after the mark just written or removed, and returns it. The caller holds
 * the review, so that the count is made by a statement that begins once
 * the mark written before it is committed. The review is written only when
 * the count changes, and its `updatedAt` stays: what the review says did
 * not change.
 */
export const countMarksOf = async (
  tx: DatabaseExecutor,
  id: string,
): Promise<number> => {
  const marks = totalOf(
    await tx
      .select({ total: count() })
      .from(reviewHelpfulVotes)
      .where(eq(reviewHelpfulVotes.reviewId, id)),
  )

  await tx
    .update(reviews)
    .set({ helpfulCount: marks })
    .where(and(eq(reviews.id, id), ne(reviews.helpfulCount, marks)))
  return marks
}
