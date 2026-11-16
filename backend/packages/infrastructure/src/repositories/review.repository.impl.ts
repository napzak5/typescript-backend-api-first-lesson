import {
  bookingServices,
  bookings,
  customers,
  reviews,
  salons,
  staff,
} from '@beauty-salon-backend/database'
import {
  type CustomerId,
  type DbReview,
  type DomainError,
  type IReviewRepository,
  planReview,
  type ReviewCreateRequest,
  type ReviewCreation,
  type ReviewedBooking,
  type ReviewId,
  type ReviewList,
  type ReviewListCriteria,
  type ReviewPlanContext,
  type ReviewTally,
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
 * Counts the rating and the review count of a salon again from its
 * reviews, the review just written included: the average of the overall
 * ratings rounded to two decimals, and no rating without reviews.
 */
const countReviewsOf = async (
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
    .where(eq(salons.id, salonId))
}

/**
 * What a review meets: whether the customer of the account is deleted,
 * and the booking it names, held.
 */
const contextOf = async (
  tx: DatabaseExecutor,
  customerId: string,
  bookingId: string,
): Promise<ReviewPlanContext> => {
  const [reviewer] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
  return {
    reviewerDeleted: reviewer === undefined,
    booking: await heldBookingOf(tx, bookingId),
  }
}

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
      this.db.transaction(
        async (tx): Promise<ReviewCreation> => {
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
        },
        // Each statement sees what was committed before it began: a
        // review that waited for the salon sees the review it waited for.
        { isolationLevel: 'read committed' },
      ),
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
