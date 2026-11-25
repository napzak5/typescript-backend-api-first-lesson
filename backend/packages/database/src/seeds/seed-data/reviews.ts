import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import type { SeededVisits, VisitKey } from './bookings'
import type { CustomerKey, SeededCustomers } from './customers'
import type { SeededUsers } from './users'

/** A report of a review, by the account that made it and the one that handled it. */
type SeededReport = Pick<
  typeof schema.reviewReports.$inferInsert,
  'reason' | 'details' | 'status'
> & {
  readonly reportedBy: keyof SeededUsers
  readonly resolvedBy: keyof SeededUsers | null
}

/** A review of a visit, by the customer of the visit. */
type SeededReview = {
  readonly visit: VisitKey
  readonly title: string
  readonly comment: string
  /** The other customers who found it helpful. */
  readonly helpfulVoters: readonly CustomerKey[]
  readonly ratings: {
    readonly overall: number
    readonly service: number
    readonly staff: number
    readonly atmosphere: number
    readonly cleanliness: number
    readonly value: number
  }
  readonly ownerResponse: string | null
  readonly reports: readonly SeededReport[]
}

/**
 * The reviews of the first five visits. The first was answered by the
 * salon. The VIP customer reported the first as an advertisement, which the
 * administrator dismissed, and the second as untrue, which is still
 * pending.
 */
const REVIEWS: readonly SeededReview[] = [
  {
    visit: 'firstCutAndTreatment',
    title: 'Excellent service!',
    comment:
      'The staff was very professional and friendly. My hair looks amazing!',
    helpfulVoters: ['second', 'third', 'vip'],
    ratings: {
      overall: 5,
      service: 5,
      staff: 5,
      atmosphere: 5,
      cleanliness: 5,
      value: 5,
    },
    ownerResponse:
      'Thank you for your wonderful review! We look forward to seeing you again.',
    reports: [
      {
        reason: 'spam',
        details: null,
        reportedBy: 'vipCustomer',
        status: 'dismissed',
        resolvedBy: 'admin',
      },
    ],
  },
  {
    visit: 'secondSignatureCut',
    title: 'Great experience',
    comment:
      'Really enjoyed my visit. The stylist understood exactly what I wanted.',
    helpfulVoters: ['first', 'third'],
    ratings: {
      overall: 5,
      service: 5,
      staff: 5,
      atmosphere: 4,
      cleanliness: 5,
      value: 4,
    },
    ownerResponse: null,
    reports: [
      {
        reason: 'false_information',
        details: '担当したスタッフの名前が違います。',
        reportedBy: 'vipCustomer',
        status: 'pending',
        resolvedBy: null,
      },
    ],
  },
  {
    visit: 'thirdMensCut',
    title: 'Good but could be better',
    comment: 'Service was good but had to wait despite having a reservation.',
    helpfulVoters: [],
    ratings: {
      overall: 3,
      service: 4,
      staff: 4,
      atmosphere: 3,
      cleanliness: 4,
      value: 3,
    },
    ownerResponse: null,
    reports: [],
  },
  {
    visit: 'vipColorAndCut',
    title: 'Satisfied with the result',
    comment:
      'The color turned out exactly as I hoped. Will definitely come back!',
    helpfulVoters: ['first'],
    ratings: {
      overall: 4,
      service: 4,
      staff: 4,
      atmosphere: 4,
      cleanliness: 5,
      value: 4,
    },
    ownerResponse: null,
    reports: [],
  },
  {
    visit: 'firstPremiumHeadSpa',
    title: 'Amazing head spa',
    comment:
      "The most relaxing head spa experience I've ever had. Highly recommend!",
    helpfulVoters: ['second', 'third', 'vip'],
    ratings: {
      overall: 5,
      service: 5,
      staff: 5,
      atmosphere: 5,
      cleanliness: 5,
      value: 5,
    },
    ownerResponse: null,
    reports: [],
  },
]

/** The rows of the seed that a review names. */
export interface ReviewSeedData {
  readonly visits: SeededVisits
  readonly customers: SeededCustomers
  readonly users: SeededUsers
}

/**
 * Reviews of visits that took place, each by the customer of the visit,
 * for its salon and the staff member who was in charge of it, the marks of
 * the other customers who found them helpful, and their reports. The
 * helpful count and the report count of each review are then counted from
 * its marks and its pending reports, and the rating and the review count
 * of each salon from its reviews, as the API leaves them.
 */
export async function seedReviews(
  db: PostgresJsDatabase<typeof schema>,
  { visits, customers, users }: ReviewSeedData,
): Promise<void> {
  const now = new Date().toISOString()
  const reviews = REVIEWS.map((review) => ({ ...review, id: randomUUID() }))

  await db.insert(schema.reviews).values(
    reviews.map(({ id, visit, title, comment, ratings, ownerResponse }) => {
      const booking = visits[visit]
      return {
        id,
        salonId: booking.salonId,
        customerId: booking.customerId,
        bookingId: booking.id,
        staffId: booking.staffId,
        overallRating: ratings.overall,
        serviceRating: ratings.service,
        staffRating: ratings.staff,
        atmosphereRating: ratings.atmosphere,
        cleanlinessRating: ratings.cleanliness,
        valueRating: ratings.value,
        title,
        comment,
        isVerified: true,
        reportCount: 0,
        ownerResponse,
        ownerRespondedAt: ownerResponse === null ? null : now,
      }
    }),
  )

  await db.insert(schema.reviewHelpfulVotes).values(
    reviews.flatMap(({ id, helpfulVoters }) =>
      helpfulVoters.map((voter) => ({
        reviewId: id,
        customerId: customers[voter],
      })),
    ),
  )
  await db.execute(sql`
    UPDATE reviews
    SET "helpfulCount" = counted.votes
    FROM (
      SELECT "reviewId", count(*)::integer AS votes
      FROM review_helpful_votes
      GROUP BY "reviewId"
    ) counted
    WHERE reviews.id = counted."reviewId"
  `)

  await db.insert(schema.reviewReports).values(
    reviews.flatMap(({ id, reports }) =>
      reports.map(({ reportedBy, resolvedBy, ...report }) => ({
        ...report,
        reviewId: id,
        reportedBy: users[reportedBy],
        resolvedBy: resolvedBy === null ? null : users[resolvedBy],
        resolvedAt: resolvedBy === null ? null : now,
      })),
    ),
  )
  await db.execute(sql`
    UPDATE reviews
    SET "reportCount" = counted.reports
    FROM (
      SELECT "reviewId", count(*)::integer AS reports
      FROM review_reports
      WHERE status = 'pending'
      GROUP BY "reviewId"
    ) counted
    WHERE reviews.id = counted."reviewId"
  `)

  await db.execute(sql`
    UPDATE salons
    SET rating = counted.rating, "reviewCount" = counted.reviews
    FROM (
      SELECT
        "salonId",
        round(avg("overallRating"), 2) AS rating,
        count(*)::integer AS reviews
      FROM reviews
      GROUP BY "salonId"
    ) counted
    WHERE salons.id = counted."salonId"
  `)
}
