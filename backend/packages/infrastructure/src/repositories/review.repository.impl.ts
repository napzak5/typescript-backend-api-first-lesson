import {
  bookingServices,
  bookings,
  customers,
  reviewHelpfulVotes,
  reviewReports,
  reviews,
  salons,
  staff,
} from '@beauty-salon-backend/database'
import {
  type CustomerId,
  type DbReview,
  type DomainError,
  type HeldReview,
  type IReviewRepository,
  planHelpfulMark,
  planReview,
  planReviewChange,
  planReviewRemoval,
  planReviewReport,
  planReviewResponse,
  type ReportedReview,
  type ReviewChange,
  type ReviewCreateRequest,
  type ReviewCreation,
  type ReviewedBooking,
  type ReviewId,
  type ReviewList,
  type ReviewListCriteria,
  type ReviewMark,
  type ReviewPlanContext,
  type ReviewRemoval,
  type ReviewRemover,
  type ReviewReporter,
  type ReviewReporting,
  type ReviewReportRequest,
  type ReviewResponder,
  type ReviewResponding,
  type ReviewRespondRequest,
  type ReviewTally,
  type ReviewUpdateRequest,
  type SalonId,
  type StaffId,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { countMarksOf } from './review-marks'
import { countReportsOf } from './review-report-count'
import { countReviewsOf } from './salon-review-counts'

/**
 * A read of a page of reviews in one snapshot: the cursor, the page and
 * the count of what matches are of one moment.
 */
const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

/** A review is read while its salon is not deleted. */
const ofLiveSalon = and(
  eq(salons.id, reviews.salonId),
  isNull(salons.deletedAt),
)

const reviewColumns = getTableColumns(reviews)

/**
 * What the reviews of a group come to, counted from a left join: a group
 * without reviews has one row whose review columns are NULL, which
 * `count(reviews.id)` and `avg` leave out.
 */
const ratingCountOf = (rating: number) =>
  sql<number>`(count(${reviews.id}) filter (where ${reviews.overallRating} = ${rating}))::integer`

const tallyColumns = {
  averageRating: sql<string | null>`round(avg(${reviews.overallRating}), 2)`,
  totalReviews: sql<number>`count(${reviews.id})::integer`,
  ones: ratingCountOf(1),
  twos: ratingCountOf(2),
  threes: ratingCountOf(3),
  fours: ratingCountOf(4),
  fives: ratingCountOf(5),
}

type TallyRow = {
  averageRating: string | null
  totalReviews: number
  ones: number
  twos: number
  threes: number
  fours: number
  fives: number
}

const toTally = ({
  averageRating,
  totalReviews,
  ones,
  twos,
  threes,
  fours,
  fives,
}: TallyRow): ReviewTally => ({
  averageRating,
  totalReviews,
  ratingCounts: [ones, twos, threes, fours, fives],
})

/**
 * The booking a review names, held `FOR SHARE` until the review is
 * written: a change of its status or its deletion that is under way has
 * been made when the row is returned, and the next one waits. The salon of
 * the booking is held next, `FOR NO KEY UPDATE`, which is what keeps the
 * reviews of one salon one after the other: the review the salon is
 * counted again with, and a second review of the same booking, see what
 * the one before them wrote. Null when there is no booking with the ID.
 */
const heldBookingOf = async (
  tx: DatabaseExecutor,
  bookingId: string,
): Promise<ReviewedBooking | null> => {
  const [booking] = await tx
    .select({
      customerId: bookings.customerId,
      salonId: bookings.salonId,
      staffId: bookings.staffId,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .for('share')
  if (booking === undefined) {
    return null
  }

  const [salon] = await tx
    .select({ deletedAt: salons.deletedAt })
    .from(salons)
    .where(eq(salons.id, booking.salonId))
    .for('no key update')
  const staffOfLines = tx
    .select({ staffId: bookingServices.staffId })
    .from(bookingServices)
    .where(eq(bookingServices.bookingId, bookingId))
  const serving = await tx
    .select({ id: staff.id })
    .from(staff)
    .where(
      and(
        isNull(staff.deletedAt),
        or(eq(staff.id, booking.staffId), inArray(staff.id, staffOfLines)),
      ),
    )
  const [review] = await tx
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.bookingId, bookingId))
    .limit(1)

  return {
    customerId: booking.customerId,
    salonId: booking.salonId,
    salonDeleted: salon?.deletedAt !== null,
    status: booking.status,
    staffIds: serving.map(({ id }) => id),
    reviewed: review !== undefined,
  }
}

/**
 * The review a change or a removal names, held `FOR UPDATE` until it is
 * written, and its salon held next, `FOR NO KEY UPDATE`, as a review that
 * is written holds it: the reviews of one salon are written, changed and
 * removed one after the other. Null when there is no review with the ID,
 * or its salon is deleted.
 */
const heldReviewOf = async (
  tx: DatabaseExecutor,
  id: string,
): Promise<HeldReview | null> => {
  const [review] = await tx
    .select({
      customerId: reviews.customerId,
      staffId: reviews.staffId,
      salonId: reviews.salonId,
    })
    .from(reviews)
    .where(eq(reviews.id, id))
    .for('update')
  if (review === undefined) {
    return null
  }

  const [salon] = await tx
    .select({ deletedAt: salons.deletedAt })
    .from(salons)
    .where(eq(salons.id, review.salonId))
    .for('no key update')
  return salon?.deletedAt === null
    ? { customerId: review.customerId, staffId: review.staffId }
    : null
}

/**
 * The review a mark, a report or a response names, held `FOR NO KEY
 * UPDATE` until its marks or its reports are counted again, or the
 * response is written: the marks, the reports and the responses of one
 * review are written one after the other, each by a statement that begins
 * once the one before it is committed, and a change or a removal of the
 * review under way (`FOR UPDATE`) has been made when the row is returned.
 * Its salon is read, not held: none of them writes anything of the salon.
 * Null when there is no review with the ID, or its salon is deleted.
 */
const notedReviewOf = async (
  tx: DatabaseExecutor,
  id: string,
): Promise<(HeldReview & ReportedReview) | null> => {
  const [review] = await tx
    .select({
      customerId: reviews.customerId,
      staffId: reviews.staffId,
      salonId: reviews.salonId,
    })
    .from(reviews)
    .where(eq(reviews.id, id))
    .for('no key update')
  if (review === undefined) {
    return null
  }

  const [salon] = await tx
    .select({ deletedAt: salons.deletedAt })
    .from(salons)
    .where(eq(salons.id, review.salonId))
  return salon?.deletedAt === null ? review : null
}

/** Whether the customer an account is linked to is deleted. */
const isReviewerDeleted = async (
  tx: DatabaseExecutor,
  customerId: string,
): Promise<boolean> => {
  const [reviewer] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
  return reviewer === undefined
}

/**
 * What a review meets: whether the customer of the account is deleted,
 * and the booking it names, held.
 */
const contextOf = async (
  tx: DatabaseExecutor,
  customerId: string,
  bookingId: string,
): Promise<ReviewPlanContext> => ({
  reviewerDeleted: await isReviewerDeleted(tx, customerId),
  booking: await heldBookingOf(tx, bookingId),
})

/**
 * Each statement sees what was committed before it began: a review that
 * waited for the salon, a change or a removal that waited for the review
 * or the salon, or a mark, a report or a response that waited for the
 * review, sees what the one it waited for wrote.
 */
const WRITE: PgTransactionConfig = { isolationLevel: 'read committed' }

export class ReviewRepository implements IReviewRepository {
  constructor(private readonly db: Database) {}

  async list({
    limit,
    after,
    sortBy,
    salonId,
    staffId,
    customerId,
    bookingId,
    isVerified,
    minRating,
    maxRating,
  }: ReviewListCriteria): Promise<Result<ReviewList | null, DomainError>> {
    const filters = and(
      salonId === null ? undefined : eq(reviews.salonId, salonId),
      staffId === null ? undefined : eq(reviews.staffId, staffId),
      customerId === null ? undefined : eq(reviews.customerId, customerId),
      bookingId === null ? undefined : eq(reviews.bookingId, bookingId),
      isVerified === null ? undefined : eq(reviews.isVerified, isVerified),
      minRating === null ? undefined : gte(reviews.overallRating, minRating),
      maxRating === null ? undefined : lte(reviews.overallRating, maxRating),
    )
    const order = match(sortBy)
      .with('recent', () => [desc(reviews.createdAt), desc(reviews.id)])
      .with('rating', () => [
        desc(reviews.overallRating),
        desc(reviews.createdAt),
        desc(reviews.id),
      ])
      .with('helpful', () => [
        desc(reviews.helpfulCount),
        desc(reviews.createdAt),
        desc(reviews.id),
      ])
      .exhaustive()

    return attempt('Failed to list reviews', () =>
      this.db.transaction(async (tx): Promise<ReviewList | null> => {
        // Keyset pagination on the order, downwards: the page starts after
        // the review the cursor names, which has to be one that is listed;
        // otherwise the answer would tell that a review of a deleted salon
        // is there.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({
                  overallRating: reviews.overallRating,
                  helpfulCount: reviews.helpfulCount,
                  createdAt: reviews.createdAt,
                  id: reviews.id,
                })
                .from(reviews)
                .innerJoin(salons, ofLiveSalon)
                .where(eq(reviews.id, after))
        if (after !== null && cursor === undefined) {
          return null
        }
        const afterCursor =
          cursor === undefined
            ? undefined
            : match(sortBy)
                .with(
                  'recent',
                  () =>
                    sql`(${reviews.createdAt}, ${reviews.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`,
                )
                .with(
                  'rating',
                  () =>
                    sql`(${reviews.overallRating}, ${reviews.createdAt}, ${reviews.id}) < (${cursor.overallRating}::integer, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`,
                )
                .with(
                  'helpful',
                  () =>
                    sql`(${reviews.helpfulCount}, ${reviews.createdAt}, ${reviews.id}) < (${cursor.helpfulCount}::integer, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`,
                )
                .exhaustive()

        const page = await tx
          .select(reviewColumns)
          .from(reviews)
          .innerJoin(salons, ofLiveSalon)
          .where(and(filters, afterCursor))
          .orderBy(...order)
          // One extra row tells whether another page follows.
          .limit(limit + 1)
        const [matching] = await tx
          .select({ total: count() })
          .from(reviews)
          .innerJoin(salons, ofLiveSalon)
          .where(filters)

        return {
          reviews: page.slice(0, limit),
          total: matching?.total ?? 0,
          hasMore: page.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  async findById(id: ReviewId): Promise<Result<DbReview | null, DomainError>> {
    return attempt('Failed to find review', async () => {
      const [review] = await this.db
        .select(reviewColumns)
        .from(reviews)
        .innerJoin(salons, ofLiveSalon)
        .where(eq(reviews.id, id))
      return review ?? null
    })
  }

  async create(
    customerId: CustomerId,
    request: ReviewCreateRequest,
  ): Promise<Result<ReviewCreation, DomainError>> {
    return attempt('Failed to create review', () =>
      this.db.transaction(async (tx): Promise<ReviewCreation> => {
        const plan = planReview(
          customerId,
          request,
          await contextOf(tx, customerId, request.bookingId),
        )
        if (plan.type !== 'planned') {
          return plan
        }

        // The time is read when the row is written, not when the
        // transaction began: a review that waited for the salon is
        // later than the one it waited for.
        const [review] = await tx
          .insert(reviews)
          .values({ ...plan.write, createdAt: CLOCK, updatedAt: CLOCK })
          .onConflictDoNothing({ target: reviews.bookingId })
          .returning()
        if (review === undefined) {
          return { type: 'bookingReviewed' }
        }
        await countReviewsOf(tx, plan.write.salonId)

        return { type: 'created', review }
      }, WRITE),
    )
  }

  async update(
    id: ReviewId,
    customerId: CustomerId,
    request: ReviewUpdateRequest,
  ): Promise<Result<ReviewChange, DomainError>> {
    return attempt('Failed to update review', () =>
      this.db.transaction(async (tx): Promise<ReviewChange> => {
        const plan = planReviewChange(customerId, request, {
          reviewerDeleted: await isReviewerDeleted(tx, customerId),
          review: await heldReviewOf(tx, id),
        })
        if (plan.type !== 'planned') {
          return plan
        }

        const [review] = await tx
          .update(reviews)
          .set({ ...plan.write, updatedAt: CLOCK })
          .where(eq(reviews.id, id))
          .returning()
        // The review is held: it is there until the transaction ends.
        if (review === undefined) {
          return { type: 'reviewNotFound' }
        }
        await countReviewsOf(tx, review.salonId)

        return { type: 'updated', review }
      }, WRITE),
    )
  }

  async delete(
    id: ReviewId,
    remover: ReviewRemover,
  ): Promise<Result<ReviewRemoval, DomainError>> {
    return attempt('Failed to delete review', () =>
      this.db.transaction(async (tx): Promise<ReviewRemoval> => {
        const plan = planReviewRemoval(remover, {
          // An administrator removes a review whatever became of its author.
          reviewerDeleted:
            remover.type === 'author' &&
            (await isReviewerDeleted(tx, remover.customerId)),
          review: await heldReviewOf(tx, id),
        })
        if (plan.type !== 'planned') {
          return plan
        }

        const [removed] = await tx
          .delete(reviews)
          .where(eq(reviews.id, id))
          .returning({ salonId: reviews.salonId })
        // The review is held: it is there until the transaction ends.
        if (removed === undefined) {
          return { type: 'reviewNotFound' }
        }
        await countReviewsOf(tx, removed.salonId)

        return { type: 'deleted' }
      }, WRITE),
    )
  }

  async markHelpful(
    id: ReviewId,
    customerId: CustomerId,
  ): Promise<Result<ReviewMark, DomainError>> {
    return attempt('Failed to mark review as helpful', () =>
      this.db.transaction(async (tx): Promise<ReviewMark> => {
        const plan = planHelpfulMark(customerId, {
          reviewerDeleted: await isReviewerDeleted(tx, customerId),
          review: await notedReviewOf(tx, id),
        })
        if (plan.type !== 'planned') {
          return plan
        }

        // A second mark of the customer is not written, and not counted.
        await tx
          .insert(reviewHelpfulVotes)
          .values({ reviewId: id, customerId, createdAt: CLOCK })
          .onConflictDoNothing({
            target: [
              reviewHelpfulVotes.reviewId,
              reviewHelpfulVotes.customerId,
            ],
          })

        return { type: 'marked', helpfulCount: await countMarksOf(tx, id) }
      }, WRITE),
    )
  }

  async report(
    id: ReviewId,
    reporter: ReviewReporter,
    request: ReviewReportRequest,
  ): Promise<Result<ReviewReporting, DomainError>> {
    return attempt('Failed to report review', () =>
      this.db.transaction(async (tx): Promise<ReviewReporting> => {
        const plan = planReviewReport(reporter, {
          reporterDeleted: await match(reporter)
            .with({ type: 'customer' }, ({ customerId }) =>
              isReviewerDeleted(tx, customerId),
            )
            .with({ type: 'salon' }, async () => false)
            .exhaustive(),
          review: await notedReviewOf(tx, id),
        })
        if (plan.type !== 'planned') {
          return plan
        }

        // A second report of the account is not written, and not counted.
        const [report] = await tx
          .insert(reviewReports)
          .values({
            reviewId: id,
            reportedBy: reporter.userId,
            reason: request.reason,
            details: request.details,
            createdAt: CLOCK,
            updatedAt: CLOCK,
          })
          .onConflictDoNothing({
            target: [reviewReports.reviewId, reviewReports.reportedBy],
          })
          .returning()
        if (report === undefined) {
          return { type: 'reportedAlready' }
        }

        await countReportsOf(tx, id)
        return { type: 'reported', report }
      }, WRITE),
    )
  }

  async respond(
    id: ReviewId,
    responder: ReviewResponder,
    { ownerResponse }: ReviewRespondRequest,
  ): Promise<Result<ReviewResponding, DomainError>> {
    return attempt('Failed to respond to review', () =>
      this.db.transaction(async (tx): Promise<ReviewResponding> => {
        const plan = planReviewResponse(responder, await notedReviewOf(tx, id))
        if (plan.type !== 'planned') {
          return plan
        }

        // A response that is stored already is not written again, and
        // the time it was written stays. What the review says did not
        // change, so its `updatedAt` stays too.
        await tx
          .update(reviews)
          .set({
            ownerResponse,
            ownerRespondedAt: ownerResponse === null ? null : CLOCK,
          })
          .where(
            and(
              eq(reviews.id, id),
              sql`${reviews.ownerResponse} is distinct from ${ownerResponse}`,
            ),
          )
        const [review] = await tx
          .select()
          .from(reviews)
          .where(eq(reviews.id, id))
        // The review is held: it is there until the transaction ends.
        if (review === undefined) {
          return { type: 'reviewNotFound' }
        }

        return { type: 'responded', review }
      }, WRITE),
    )
  }

  async salonTally(
    salonId: SalonId,
  ): Promise<Result<ReviewTally | null, DomainError>> {
    return attempt('Failed to count the reviews of a salon', async () => {
      const [tally] = await this.db
        .select(tallyColumns)
        .from(salons)
        .leftJoin(reviews, eq(reviews.salonId, salons.id))
        .where(and(eq(salons.id, salonId), isNull(salons.deletedAt)))
        .groupBy(salons.id)
      return tally === undefined ? null : toTally(tally)
    })
  }

  async staffTally(
    staffId: StaffId,
  ): Promise<Result<ReviewTally | null, DomainError>> {
    return attempt(
      'Failed to count the reviews of a staff member',
      async () => {
        const [tally] = await this.db
          .select(tallyColumns)
          .from(staff)
          .innerJoin(
            salons,
            and(eq(salons.id, staff.salonId), isNull(salons.deletedAt)),
          )
          .leftJoin(reviews, eq(reviews.staffId, staff.id))
          .where(and(eq(staff.id, staffId), isNull(staff.deletedAt)))
          .groupBy(staff.id)
        return tally === undefined ? null : toTally(tally)
      },
    )
  }
}
