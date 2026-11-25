import { reviewReports, reviews } from '@beauty-salon-backend/database'
import { and, count, eq, ne } from 'drizzle-orm'
import { totalOf } from '../../database/count'
import type { DatabaseExecutor } from '../../database/index'

/**
 * What the writers of a report share: the report count of a review is the
 * number of its pending reports.
 */

/**
 * Counts the report count of a review again from its pending reports, as
 * they are after the report just written or dismissed. The caller holds
 * the review, so that the count is made by a statement that begins once
 * the report written before it is committed. The review is written only
 * when the count changes, and its `updatedAt` stays: what the review says
 * did not change.
 */
export const countReportsOf = async (
  tx: DatabaseExecutor,
  reviewId: string,
): Promise<void> => {
  const reports = totalOf(
    await tx
      .select({ total: count() })
      .from(reviewReports)
      .where(
        and(
          eq(reviewReports.reviewId, reviewId),
          eq(reviewReports.status, 'pending'),
        ),
      ),
  )

  await tx
    .update(reviews)
    .set({ reportCount: reports })
    .where(and(eq(reviews.id, reviewId), ne(reviews.reportCount, reports)))
}
