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
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, count, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { countReportsOf } from './review-report-count'

/**
 * A read of a page of reports in one snapshot: the cursor, the page and
 * the count of what matches are of one moment.
 */
const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

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
        const [matching] = await tx
          .select({ total: count() })
          .from(reviewReports)
          .innerJoin(reviews, ofReport)
          .innerJoin(salons, ofLiveSalon)
          .where(filters)

        return {
          reports: page.slice(0, limit),
          total: matching?.total ?? 0,
          hasMore: page.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  async dismiss(
    id: ReviewReportId,
    administrator: UserId,
  ): Promise<Result<ReportDismissal, DomainError>> {
    return attempt('Failed to dismiss review report', () =>
      this.db.transaction(async (tx): Promise<ReportDismissal> => {
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
        // The review of the report is held: the report is there until the
        // transaction ends.
        if (report === undefined) {
          return { type: 'reportNotFound' }
        }
        await countReportsOf(tx, report.reviewId)

        return { type: 'dismissed', report }
      }, WRITE),
    )
  }
}
