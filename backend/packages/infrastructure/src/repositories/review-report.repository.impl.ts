import { reviewReports, reviews, salons } from '@beauty-salon-backend/database'
import {
  type DomainError,
  type IReviewReportRepository,
  planReportDismissal,
  type ReportDismissal,
  type ReviewReportId,
  type ReviewReportList,
  type ReviewReportListCriteria,
  type UserId,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, asc, count, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import { totalOf } from '../database/count'
import type { Database, DatabaseExecutor } from '../database/index'
import { AT_ONE_MOMENT } from '../database/snapshot'
import { written } from '../database/written'
import { countReportsOf } from './_shared/review-report-count'

/**
 * Each statement sees what was committed before it began: a dismissal
 * that waited for the review of the report sees what the report, the mark,
 * the change, the removal or the dismissal it waited for wrote.
 */
const WRITE: PgTransactionConfig = { isolationLevel: 'read committed' }

/** The review of a report. */
const ofReport = eq(reviews.id, reviewReports.reviewId)

/** A report is read while the salon of its review is not deleted. */
const ofLiveSalon = and(
  eq(salons.id, reviews.salonId),
  isNull(salons.deletedAt),
)

const reportColumns = getTableColumns(reviewReports)

/**
 * The report a dismissal names, read once its review is held
 * `FOR NO KEY UPDATE` until the reports of the review are counted again,
 * as a report or a mark of the review holds it: a dismissal waits for a
 * report, a mark, a change, a removal or a dismissal of the review under
 * way, and what it reads of the report afterwards is what that one left.
 * The report itself is not held: nothing writes it without holding its
 * review first. Null when there is no report with the ID, or the salon of
 * its review is deleted.
 */
const heldReportOf = async (
  tx: DatabaseExecutor,
  id: string,
): Promise<Pick<
  typeof reviewReports.$inferSelect,
  'reviewId' | 'status'
> | null> => {
  await tx
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      eq(
        reviews.id,
        tx
          .select({ reviewId: reviewReports.reviewId })
          .from(reviewReports)
          .where(eq(reviewReports.id, id)),
      ),
    )
    .for('no key update')

  const [report] = await tx
    .select({ reviewId: reviewReports.reviewId, status: reviewReports.status })
    .from(reviewReports)
    .innerJoin(reviews, ofReport)
    .innerJoin(salons, ofLiveSalon)
    .where(eq(reviewReports.id, id))
  return report ?? null
}

export class ReviewReportRepository implements IReviewReportRepository {
  constructor(private readonly db: Database) {}

  async list({
    limit,
    after,
    status,
    reviewId,
    salonId,
  }: ReviewReportListCriteria): Promise<
    Result<ReviewReportList | null, DomainError>
  > {
    const filters = and(
      status === null ? undefined : eq(reviewReports.status, status),
      reviewId === null ? undefined : eq(reviewReports.reviewId, reviewId),
      salonId === null ? undefined : eq(reviews.salonId, salonId),
    )

    return attempt('Failed to list review reports', () =>
      this.db.transaction(async (tx): Promise<ReviewReportList | null> => {
        // Keyset pagination on the order, upwards: the page starts after
        // the report the cursor names, which has to be one that is listed.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({
                  createdAt: reviewReports.createdAt,
                  id: reviewReports.id,
                })
                .from(reviewReports)
                .innerJoin(reviews, ofReport)
                .innerJoin(salons, ofLiveSalon)
                .where(eq(reviewReports.id, after))
        if (after !== null && cursor === undefined) {
          return null
        }
        const afterCursor =
          cursor === undefined
            ? undefined
            : sql`(${reviewReports.createdAt}, ${reviewReports.id}) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`

        const page = await tx
          .select(reportColumns)
          .from(reviewReports)
          .innerJoin(reviews, ofReport)
          .innerJoin(salons, ofLiveSalon)
          .where(and(filters, afterCursor))
          .orderBy(asc(reviewReports.createdAt), asc(reviewReports.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1)
        const counted = await tx
          .select({ total: count() })
          .from(reviewReports)
          .innerJoin(reviews, ofReport)
          .innerJoin(salons, ofLiveSalon)
          .where(filters)

        return {
          reports: page.slice(0, limit),
          total: totalOf(counted),
          hasMore: page.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  async dismiss(
    id: ReviewReportId,
    administrator: UserId,
  ): Promise<Result<ReportDismissal, DomainError>> {
    const dismissal = await attempt('Failed to dismiss review report', () =>
      this.db.transaction(async (tx): Promise<ReportDismissal | null> => {
        const plan = planReportDismissal({
          report: await heldReportOf(tx, id),
        })
        if (plan.type !== 'planned') {
          return plan
        }

        const [report] = await tx
          .update(reviewReports)
          .set({
            status: 'dismissed',
            resolvedBy: administrator,
            resolvedAt: CLOCK,
            updatedAt: CLOCK,
          })
          .where(eq(reviewReports.id, id))
          .returning()
        // The review of the report is held, and nothing writes a report
        // without holding its review: only a trigger that skips the write
        // leaves it unwritten.
        if (report === undefined) {
          return null
        }
        await countReportsOf(tx, report.reviewId)

        return { type: 'dismissed', report }
      }, WRITE),
    )

    return Result.flatMap(dismissal, written('Update of dismissed report'))
  }
}
