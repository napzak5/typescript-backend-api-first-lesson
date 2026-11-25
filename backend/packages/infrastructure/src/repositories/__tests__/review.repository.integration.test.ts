import {
  customers,
  reviewHelpfulVotes,
  reviewReports,
  reviews,
  salons,
  staff,
} from '@beauty-salon-backend/database'
import {
  type BookingId,
  bookingIdSchema,
  type CustomerId,
  customerIdSchema,
  type RequestedReview,
  type RequestedReviewChange,
  type RequestedReviewReport,
  type ReviewId,
  type ReviewListCriteria,
  type ReviewRemover,
  type ReviewReporter,
  type ReviewResponder,
  reviewIdSchema,
  type SalonId,
  type StaffId,
  salonIdSchema,
  staffIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { count, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { ReviewRepository } from '../review.repository.impl'
import {
  COMPLETED,
  insertBooking,
  insertBookingLine,
  insertCustomer,
  insertHelpfulVote,
  insertReview,
  insertReviewReport,
  insertSalon,
  insertService,
  insertStaffMember,
  insertUser,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new ReviewRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** A completed visit in the table, by the IDs a repository is given. */
type Visit = {
  salonId: SalonId
  customerId: CustomerId
  staffId: StaffId
  bookingId: BookingId
}

/** A salon of its own, a customer, and their booking with a stylist of the salon, completed. */
const storedVisit = async (
  salon: Partial<typeof salons.$inferInsert> = {},
): Promise<Visit> => {
  const db = databases.database()
  const salonRow = await insertSalon(db, salon)
  const customer = await insertCustomer(db)
  const member = await insertStaffMember(db, salonRow.id)
  const booking = await insertBooking(
    db,
    { salonId: salonRow.id, customerId: customer.id, staffId: member.id },
    COMPLETED,
  )
  return {
    salonId: salonIdSchema.parse(salonRow.id),
    customerId: customerIdSchema.parse(customer.id),
    staffId: staffIdSchema.parse(member.id),
    bookingId: bookingIdSchema.parse(booking.id),
  }
}

/** Another booking of the customer of the visit at its salon, completed unless the test says otherwise. */
const storedBooking = async (
  visit: Visit,
  overrides: Partial<Parameters<typeof insertBooking>[2]> = {},
): Promise<BookingId> =>
  bookingIdSchema.parse(
    (
      await insertBooking(
        databases.database(),
        {
          salonId: visit.salonId,
          customerId: visit.customerId,
          staffId: visit.staffId,
        },
        { ...COMPLETED, ...overrides },
      )
    ).id,
  )

/** The review of the booking of the visit, in the table. */
const storedReview = async (
  visit: Visit,
  overrides: Partial<typeof reviews.$inferInsert> = {},
) => {
  const row = await insertReview(
    databases.database(),
    {
      bookingId: visit.bookingId,
      salonId: visit.salonId,
      customerId: visit.customerId,
    },
    overrides,
  )
  return { ...row, id: reviewIdSchema.parse(row.id) }
}

/**
 * A review in the table of a completed booking of its own at the salon of
 * the visit: of a customer of its own unless the test names one.
 */
const reviewAt = async (
  visit: Visit,
  overrides: Partial<typeof reviews.$inferInsert> = {},
) => {
  const db = databases.database()
  const customerId = overrides.customerId ?? (await insertCustomer(db)).id
  const booking = await insertBooking(
    db,
    { salonId: visit.salonId, customerId, staffId: visit.staffId },
    COMPLETED,
  )
  const row = await insertReview(
    db,
    { bookingId: booking.id, salonId: visit.salonId, customerId },
    overrides,
  )
  return { ...row, id: reviewIdSchema.parse(row.id) }
}

/** A review of four stars of the booking of the visit, which names no staff member. */
const requestOf = (
  visit: Visit,
  overrides: Partial<RequestedReview> = {},
): RequestedReview => ({
  salonId: visit.salonId,
  customerId: visit.customerId,
  bookingId: visit.bookingId,
  staffId: null,
  overallRating: 4,
  serviceRating: 5,
  staffRating: null,
  atmosphereRating: null,
  cleanlinessRating: null,
  valueRating: null,
  title: '丁寧な仕上がり',
  comment: '希望どおりの長さにしてもらえました。',
  imageUrls: [],
  ...overrides,
})

/** Another customer in the table, by the ID a repository is given. */
const storedCustomer = async (): Promise<CustomerId> =>
  customerIdSchema.parse((await insertCustomer(databases.database())).id)

const deleteCustomer = async (id: string) => {
  await databases
    .database()
    .update(customers)
    .set({ deletedAt: DELETED_AT })
    .where(eq(customers.id, id))
}

const deleteSalon = async (id: string) => {
  await databases
    .database()
    .update(salons)
    .set({ deletedAt: DELETED_AT })
    .where(eq(salons.id, id))
}

const deleteStaffMember = async (id: string) => {
  await databases
    .database()
    .update(staff)
    .set({ deletedAt: DELETED_AT })
    .where(eq(staff.id, id))
}

const storedOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(reviews)
    .where(eq(reviews.id, id))
  return row
}

/** The rating and the review count the salon has in the table. */
const salonFiguresOf = async (id: string) => {
  const [salon] = await databases
    .database()
    .select({ rating: salons.rating, reviewCount: salons.reviewCount })
    .from(salons)
    .where(eq(salons.id, id))
  return salon
}

const NOT_COUNTED = { rating: null, reviewCount: 0 }

const salonUpdatedAtOf = async (id: string) => {
  const [salon] = await databases
    .database()
    .select({ updatedAt: salons.updatedAt })
    .from(salons)
    .where(eq(salons.id, id))
  return salon?.updatedAt
}

const marksOf = async (reviewId: string) => {
  const [counted] = await databases
    .database()
    .select({ total: count() })
    .from(reviewHelpfulVotes)
    .where(eq(reviewHelpfulVotes.reviewId, reviewId))
  return counted?.total
}

const reportsOf = async (reviewId: string) =>
  databases
    .database()
    .select()
    .from(reviewReports)
    .where(eq(reviewReports.reviewId, reviewId))

describe('ReviewRepository.list', () => {
  const criteriaOf = (
    overrides: Partial<ReviewListCriteria> = {},
  ): ReviewListCriteria => ({
    limit: 20,
    after: null,
    sortBy: 'recent',
    salonId: null,
    staffId: null,
    customerId: null,
    bookingId: null,
    isVerified: null,
    minRating: null,
    maxRating: null,
    ...overrides,
  })

  const idsOf = (listed: Awaited<ReturnType<ReviewRepository['list']>>) =>
    listed.type === 'success' && listed.data !== null
      ? listed.data.reviews.map(({ id }) => id)
      : []

  /**
   * Three reviews of live salons, by the order they were written in: a
   * verified five that names the stylist of the first salon, a three of
   * another customer of that salon that names no staff member, and a
   * verified one of the customer of the first at another salon. A review
   * of a deleted salon is listed under no filter.
   */
  const storedShelf = async () => {
    const visit = await storedVisit()
    const first = await reviewAt(visit, {
      customerId: visit.customerId,
      staffId: visit.staffId,
      overallRating: 5,
      isVerified: true,
      createdAt: '2026-12-01T00:00:00Z',
    })
    const second = await reviewAt(visit, {
      overallRating: 3,
      createdAt: '2026-12-02T00:00:00Z',
    })
    const third = await reviewAt(await storedVisit(), {
      customerId: visit.customerId,
      overallRating: 1,
      isVerified: true,
      createdAt: '2026-12-03T00:00:00Z',
    })
    await reviewAt(await storedVisit({ deletedAt: DELETED_AT }), {
      overallRating: 4,
    })
    return { visit, first, second, third }
  }

  it('should list the reviews of live salons, the latest first, and count them', async () => {
    // Arrange
    const { first, second, third } = await storedShelf()

    // Act
    const listed = await repository().list(criteriaOf())

    // Assert
    expect(idsOf(listed)).toEqual([third.id, second.id, first.id])
    expect(listed).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: false, reviews: [third, second, first] },
    })
  })

  it.each<
    [
      string,
      (
        stored: Awaited<ReturnType<typeof storedShelf>>,
      ) => Partial<ReviewListCriteria>,
      ('first' | 'second' | 'third')[],
    ]
  >([
    [
      'the salon',
      ({ visit }) => ({ salonId: visit.salonId }),
      ['second', 'first'],
    ],
    [
      'the staff member',
      ({ visit }) => ({ staffId: visit.staffId }),
      ['first'],
    ],
    [
      'the customer',
      ({ visit }) => ({ customerId: visit.customerId }),
      ['third', 'first'],
    ],
    [
      'the booking',
      ({ second }) => ({ bookingId: bookingIdSchema.parse(second.bookingId) }),
      ['second'],
    ],
    ['being verified', () => ({ isVerified: false }), ['second']],
    ['the lowest rating', () => ({ minRating: 3 }), ['second', 'first']],
    ['the highest rating', () => ({ maxRating: 3 }), ['third', 'second']],
    [
      'the lowest and the highest rating at once',
      () => ({ minRating: 2, maxRating: 4 }),
      ['second'],
    ],
  ])(
    'should list the reviews by %s, and count them',
    async (_case, filtersOf, names) => {
      // Arrange
      const stored = await storedShelf()

      // Act
      const listed = await repository().list(criteriaOf(filtersOf(stored)))

      // Assert
      expect(idsOf(listed)).toEqual(names.map((name) => stored[name].id))
      expect(listed).toMatchObject({
        type: 'success',
        data: { total: names.length },
      })
    },
  )

  /**
   * Four reviews of one salon whose IDs go against the times they were
   * written at: A is the earliest and has the greatest ID, and B, C and D
   * were written at one moment. A and B give five stars, C and D three;
   * A and C helped two customers, B and D none.
   */
  const storedTies = async () => {
    const visit = await storedVisit()
    const at = '2026-12-02T00:00:00Z'
    return {
      visit,
      A: await reviewAt(visit, {
        id: '00000000-0000-4000-8000-000000000005',
        overallRating: 5,
        helpfulCount: 2,
        createdAt: '2026-12-01T00:00:00Z',
      }),
      B: await reviewAt(visit, {
        id: '00000000-0000-4000-8000-000000000002',
        overallRating: 5,
        createdAt: at,
      }),
      C: await reviewAt(visit, {
        id: '00000000-0000-4000-8000-000000000003',
        overallRating: 3,
        helpfulCount: 2,
        createdAt: at,
      }),
      D: await reviewAt(visit, {
        id: '00000000-0000-4000-8000-000000000004',
        overallRating: 3,
        createdAt: at,
      }),
    }
  }

  it.each<[ReviewListCriteria['sortBy'], ('A' | 'B' | 'C' | 'D')[]]>([
    ['recent', ['D', 'C', 'B', 'A']],
    ['rating', ['B', 'A', 'D', 'C']],
    ['helpful', ['C', 'A', 'D', 'B']],
  ])(
    'should list by %s, then the latest and the greatest ID first, a page at a time',
    async (sortBy, order) => {
      // Arrange
      const stored = await storedTies()
      const ids = order.map((name) => stored[name].id)

      // Act
      const all = await repository().list(criteriaOf({ sortBy }))
      const pages = await Promise.all(
        [null, ...ids.slice(0, -1)].map((after) =>
          repository().list(criteriaOf({ sortBy, limit: 1, after })),
        ),
      )

      // Assert
      expect(idsOf(all)).toEqual(ids)
      expect(pages.map(idsOf)).toEqual(ids.map((id) => [id]))
      expect(pages).toMatchObject([
        { data: { total: 4, hasMore: true } },
        { data: { total: 4, hasMore: true } },
        { data: { total: 4, hasMore: true } },
        { data: { total: 4, hasMore: false } },
      ])
    },
  )

  it.each<[string, () => Promise<string>]>([
    [
      'a review of a deleted salon',
      async () =>
        (await reviewAt(await storedVisit({ deletedAt: DELETED_AT }))).id,
    ],
    ['an ID that names none', async () => UNKNOWN_ID],
  ])('should find no page after %s', async (_case, idOf) => {
    // Arrange
    await storedShelf()
    const after = reviewIdSchema.parse(await idOf())

    // Act
    const listed = await repository().list(criteriaOf({ after }))

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

describe('ReviewRepository.findById', () => {
  it('should find the review', async () => {
    // Arrange
    const review = await storedReview(await storedVisit())

    // Act
    const found = await repository().findById(review.id)

    // Assert
    expect(found).toEqual({ type: 'success', data: review })
  })

  it.each<[string, () => Promise<string>]>([
    [
      'review of a deleted salon',
      async () =>
        (await storedReview(await storedVisit({ deletedAt: DELETED_AT }))).id,
    ],
    ['review of an ID that names none', async () => UNKNOWN_ID],
  ])('should find no %s', async (_case, idOf) => {
    // Arrange
    const id = reviewIdSchema.parse(await idOf())

    // Act
    const found = await repository().findById(id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('ReviewRepository.create', () => {
  it('should write a verified review of the completed booking, and count the salon again with the reviews it has', async () => {
    // Arrange
    const visit = await storedVisit()
    await reviewAt(visit, { overallRating: 5 })
    await reviewAt(visit, { overallRating: 4 })
    const elsewhere = await storedVisit()
    await reviewAt(elsewhere, { overallRating: 1 })
    const counted = await salonUpdatedAtOf(visit.salonId)

    // Act
    const created = await repository().create(
      visit.customerId,
      requestOf(visit),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        review: {
          ...requestOf(visit),
          isVerified: true,
          helpfulCount: 0,
          reportCount: 0,
          ownerResponse: null,
          ownerRespondedAt: null,
        },
      },
    })
    expect(await salonFiguresOf(visit.salonId)).toEqual({
      rating: '4.33',
      reviewCount: 3,
    })
    expect(await salonUpdatedAtOf(visit.salonId)).not.toBe(counted)
    expect(await salonFiguresOf(elsewhere.salonId)).toEqual(NOT_COUNTED)
  })

  it.each<[string, (visit: Visit) => Promise<StaffId>]>([
    ['the stylist in charge of the booking', async (visit) => visit.staffId],
    [
      'a stylist of a line of the booking',
      async (visit) => {
        const db = databases.database()
        const member = await insertStaffMember(db, visit.salonId)
        const service = await insertService(db, visit.salonId)
        await insertBookingLine(db, visit.bookingId, service.id, {
          staffId: member.id,
        })
        return staffIdSchema.parse(member.id)
      },
    ],
  ])('should write a review that names %s', async (_case, staffOf) => {
    // Arrange
    const visit = await storedVisit()
    const staffId = await staffOf(visit)

    // Act
    const created = await repository().create(
      visit.customerId,
      requestOf(visit, { staffId, staffRating: 5 }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created', review: { staffId, staffRating: 5 } },
    })
  })

  it.each<
    [string, (visit: Visit) => Promise<[CustomerId, RequestedReview]>, object]
  >([
    [
      'a customer who is deleted',
      async (visit) => {
        await deleteCustomer(visit.customerId)
        return [visit.customerId, requestOf(visit)]
      },
      { type: 'reviewerNotFound' },
    ],
    [
      'a booking that is not there',
      async (visit) => [
        visit.customerId,
        requestOf(visit, { bookingId: bookingIdSchema.parse(UNKNOWN_ID) }),
      ],
      { type: 'invalid', issues: [{ field: 'bookingId' }] },
    ],
    [
      'a booking of another customer',
      async (visit) => [await storedCustomer(), requestOf(visit)],
      { type: 'invalid', issues: [{ field: 'bookingId' }] },
    ],
    [
      'a booking of a deleted salon',
      async (visit) => {
        await deleteSalon(visit.salonId)
        return [visit.customerId, requestOf(visit)]
      },
      { type: 'invalid', issues: [{ field: 'salonId' }] },
    ],
    [
      'a booking at another salon than the one named',
      async (visit) => [
        visit.customerId,
        requestOf(visit, { salonId: (await storedVisit()).salonId }),
      ],
      { type: 'invalid', issues: [{ field: 'salonId' }] },
    ],
    [
      'a staff member who did not take the booking',
      async (visit) => [
        visit.customerId,
        requestOf(visit, {
          staffId: staffIdSchema.parse(
            (await insertStaffMember(databases.database(), visit.salonId)).id,
          ),
        }),
      ],
      { type: 'invalid', issues: [{ field: 'staffId' }] },
    ],
    [
      'the stylist of the booking, deleted since',
      async (visit) => {
        await deleteStaffMember(visit.staffId)
        return [visit.customerId, requestOf(visit, { staffId: visit.staffId })]
      },
      { type: 'invalid', issues: [{ field: 'staffId' }] },
    ],
    [
      'a booking that is not completed',
      async (visit) => [
        visit.customerId,
        requestOf(visit, {
          bookingId: await storedBooking(visit, {
            status: 'confirmed',
            completedAt: null,
          }),
        }),
      ],
      { type: 'bookingNotCompleted' },
    ],
    [
      'a booking that has a review',
      async (visit) => {
        await storedReview(visit)
        return [visit.customerId, requestOf(visit)]
      },
      { type: 'bookingReviewed' },
    ],
  ])('should write no review for %s', async (_case, arrange, answer) => {
    // Arrange
    const visit = await storedVisit()
    const [customerId, request] = await arrange(visit)

    // Act
    const created = await repository().create(customerId, request)

    // Assert
    expect(created).toMatchObject({ type: 'success', data: answer })
    expect(await salonFiguresOf(visit.salonId)).toEqual(NOT_COUNTED)
  })

  it('should answer that the booking was reviewed by the review written while it waited for the salon', async () => {
    // Arrange
    const visit = await storedVisit()

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`select id from salons where id = ${visit.salonId} for no key update`,
      (held) =>
        held`insert into reviews ("salonId", "customerId", "bookingId", "overallRating") values (${visit.salonId}, ${visit.customerId}, ${visit.bookingId}, 2)`,
      () => repository().create(visit.customerId, requestOf(visit)),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'bookingReviewed' },
    })
  })

  it('should write no second review of the booking when its review was written meanwhile without the salon held', async () => {
    // Arrange
    const visit = await storedVisit()

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`insert into reviews ("salonId", "customerId", "bookingId", "overallRating") values (${visit.salonId}, ${visit.customerId}, ${visit.bookingId}, 2)`,
      (held) => held`select 1`,
      () => repository().create(visit.customerId, requestOf(visit)),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'bookingReviewed' },
    })
    expect(await salonFiguresOf(visit.salonId)).toEqual(NOT_COUNTED)
  })

  it('should count the salon again with the review written while it waited for the salon', async () => {
    // Arrange
    const visit = await storedVisit()
    const other = await storedBooking(visit)

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`select id from salons where id = ${visit.salonId} for no key update`,
      (held) =>
        held`insert into reviews ("salonId", "customerId", "bookingId", "overallRating") values (${visit.salonId}, ${visit.customerId}, ${other}, 2)`,
      () => repository().create(visit.customerId, requestOf(visit)),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created' },
    })
    expect(await salonFiguresOf(visit.salonId)).toEqual({
      rating: '3.00',
      reviewCount: 2,
    })
  })

  it('should answer that the booking is not completed when the change it waited for cancelled it', async () => {
    // Arrange
    const visit = await storedVisit()

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`update bookings set status = 'cancelled', "completedAt" = null, "cancelledAt" = '2026-12-07T03:00:00Z' where id = ${visit.bookingId}`,
      (held) => held`select 1`,
      () => repository().create(visit.customerId, requestOf(visit)),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'bookingNotCompleted' },
    })
    expect(await salonFiguresOf(visit.salonId)).toEqual(NOT_COUNTED)
  })
})

describe('ReviewRepository.update', () => {
  it('should write the change and the time of the change, and count the salon again', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit, { staffId: visit.staffId })

    // Act
    const updated = await repository().update(review.id, visit.customerId, {
      overallRating: 3,
      staffRating: 4,
      comment: '仕上がりは良かったが、待ち時間が長かった。',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        review: {
          id: review.id,
          overallRating: 3,
          staffRating: 4,
          comment: '仕上がりは良かったが、待ち時間が長かった。',
          title: review.title,
        },
      },
    })
    expect((await storedOf(review.id))?.updatedAt).not.toBe(review.updatedAt)
    expect(await salonFiguresOf(visit.salonId)).toEqual({
      rating: '3.00',
      reviewCount: 1,
    })
  })

  it('should leave the salon as it is when its figures stay', async () => {
    // Arrange
    const visit = await storedVisit({ rating: '5.00', reviewCount: 1 })
    const review = await storedReview(visit)
    const counted = await salonUpdatedAtOf(visit.salonId)

    // Act
    const updated = await repository().update(review.id, visit.customerId, {
      comment: '次回もお願いしたい。',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', review: { comment: '次回もお願いしたい。' } },
    })
    expect(await salonUpdatedAtOf(visit.salonId)).toBe(counted)
  })

  it('should count the salon again with the review written while it waited for the salon', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    const other = await storedBooking(visit)

    // Act
    const updated = await databases.whileHeld(
      (held) =>
        held`select id from salons where id = ${visit.salonId} for no key update`,
      (held) =>
        held`insert into reviews ("salonId", "customerId", "bookingId", "overallRating") values (${visit.salonId}, ${visit.customerId}, ${other}, 1)`,
      () =>
        repository().update(review.id, visit.customerId, { overallRating: 3 }),
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated' },
    })
    expect(await salonFiguresOf(visit.salonId)).toEqual({
      rating: '2.00',
      reviewCount: 2,
    })
  })

  it.each<
    [
      string,
      (
        visit: Visit,
        review: ReviewId,
      ) => Promise<[ReviewId, CustomerId, RequestedReviewChange]>,
      object,
    ]
  >([
    [
      'a customer who is deleted',
      async (visit, review) => {
        await deleteCustomer(visit.customerId)
        return [review, visit.customerId, { overallRating: 3 }]
      },
      { type: 'reviewerNotFound' },
    ],
    [
      'a review that is not there',
      async (visit) => [
        reviewIdSchema.parse(UNKNOWN_ID),
        visit.customerId,
        { overallRating: 3 },
      ],
      { type: 'reviewNotFound' },
    ],
    [
      'a review of a deleted salon',
      async (visit, review) => {
        await deleteSalon(visit.salonId)
        return [review, visit.customerId, { overallRating: 3 }]
      },
      { type: 'reviewNotFound' },
    ],
    [
      'a review of another customer',
      async (_visit, review) => [
        review,
        await storedCustomer(),
        { overallRating: 3 },
      ],
      { type: 'notTheAuthor' },
    ],
    [
      'a staff rating of a review that names no staff member',
      async (visit, review) => [review, visit.customerId, { staffRating: 4 }],
      { type: 'invalid', issues: [{ field: 'staffRating' }] },
    ],
  ])('should change nothing for %s', async (_case, arrange, answer) => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    const [id, customerId, request] = await arrange(visit, review.id)

    // Act
    const updated = await repository().update(id, customerId, request)

    // Assert
    expect(updated).toMatchObject({ type: 'success', data: answer })
    expect(await storedOf(review.id)).toEqual(review)
  })

  it('should find no review that the removal it waited for took away', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)

    // Act
    const updated = await databases.whileHeld(
      (held) => held`select id from reviews where id = ${review.id} for update`,
      (held) => held`delete from reviews where id = ${review.id}`,
      () =>
        repository().update(review.id, visit.customerId, { overallRating: 3 }),
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'reviewNotFound' },
    })
  })

  it('should answer that the update returned no row when a trigger skips it', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    await databases.skipWrites('reviews', 'UPDATE')

    // Act
    const updated = await repository().update(review.id, visit.customerId, {
      overallRating: 3,
    })

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of review returned no row',
        cause: null,
      },
    })
  })
})

describe('ReviewRepository.delete', () => {
  /** A salon counted with two reviews, of five and three stars. */
  const storedTwoReviews = async () => {
    const visit = await storedVisit({ rating: '4.00', reviewCount: 2 })
    const five = await storedReview(visit, { overallRating: 5 })
    const three = await reviewAt(visit, { overallRating: 3 })
    return { visit, five, three }
  }

  it.each<[string, (customerId: CustomerId) => Promise<ReviewRemover>]>([
    ['its author', async (customerId) => ({ type: 'author', customerId })],
    [
      'an administrator, whatever became of its author',
      async (customerId) => {
        await deleteCustomer(customerId)
        return { type: 'administrator' }
      },
    ],
  ])(
    'should remove the review for %s, and count the salon again',
    async (_case, removerOf) => {
      // Arrange
      const { visit, three } = await storedTwoReviews()
      const remover = await removerOf(customerIdSchema.parse(three.customerId))

      // Act
      const deleted = await repository().delete(three.id, remover)

      // Assert
      expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
      expect(await storedOf(three.id)).toBeUndefined()
      expect(await salonFiguresOf(visit.salonId)).toEqual({
        rating: '5.00',
        reviewCount: 1,
      })
    },
  )

  it.each<
    [
      string,
      (visit: Visit, review: ReviewId) => Promise<[ReviewId, ReviewRemover]>,
      object,
    ]
  >([
    [
      'its author, once their customer is deleted',
      async (visit, review) => {
        await deleteCustomer(visit.customerId)
        return [review, { type: 'author', customerId: visit.customerId }]
      },
      { type: 'reviewerNotFound' },
    ],
    [
      'another customer',
      async (_visit, review) => [
        review,
        { type: 'author', customerId: await storedCustomer() },
      ],
      { type: 'notTheAuthor' },
    ],
    [
      'an administrator, when the salon is deleted',
      async (visit, review) => {
        await deleteSalon(visit.salonId)
        return [review, { type: 'administrator' }]
      },
      { type: 'reviewNotFound' },
    ],
    [
      'an administrator, when there is no such review',
      async () => [reviewIdSchema.parse(UNKNOWN_ID), { type: 'administrator' }],
      { type: 'reviewNotFound' },
    ],
  ])('should remove nothing for %s', async (_case, arrange, answer) => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    const [id, remover] = await arrange(visit, review.id)

    // Act
    const deleted = await repository().delete(id, remover)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: answer })
    expect(await storedOf(review.id)).toEqual(review)
  })

  it('should answer that the delete returned no row when a trigger skips it', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    await databases.skipWrites('reviews', 'DELETE')

    // Act
    const deleted = await repository().delete(review.id, {
      type: 'administrator',
    })

    // Assert
    expect(deleted).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Delete of review returned no row',
        cause: null,
      },
    })
  })
})

describe('ReviewRepository.markHelpful', () => {
  it('should mark the review, and answer how many marked it, counted from the marks', async () => {
    // Arrange
    const review = await storedReview(await storedVisit(), {
      helpfulCount: 7,
    })
    await insertHelpfulVote(
      databases.database(),
      review.id,
      await storedCustomer(),
    )
    const other = await storedReview(await storedVisit())
    await insertHelpfulVote(
      databases.database(),
      other.id,
      await storedCustomer(),
    )
    const marker = await storedCustomer()

    // Act
    const marked = await repository().markHelpful(review.id, marker)

    // Assert
    expect(marked).toEqual({
      type: 'success',
      data: { type: 'marked', helpfulCount: 2 },
    })
    expect(await storedOf(review.id)).toEqual({ ...review, helpfulCount: 2 })
    expect(await storedOf(other.id)).toEqual(other)
  })

  it('should count a second mark of the customer once', async () => {
    // Arrange
    const review = await storedReview(await storedVisit(), {
      helpfulCount: 1,
    })
    const marker = await storedCustomer()
    await insertHelpfulVote(databases.database(), review.id, marker)

    // Act
    const marked = await repository().markHelpful(review.id, marker)

    // Assert
    expect(marked).toEqual({
      type: 'success',
      data: { type: 'marked', helpfulCount: 1 },
    })
    expect(await marksOf(review.id)).toBe(1)
  })

  it.each<
    [
      string,
      (visit: Visit, review: ReviewId) => Promise<[ReviewId, CustomerId]>,
      object,
    ]
  >([
    [
      'the author of the review',
      async (visit, review) => [review, visit.customerId],
      { type: 'ownReview' },
    ],
    [
      'a customer who is deleted',
      async (_visit, review) => {
        const marker = await storedCustomer()
        await deleteCustomer(marker)
        return [review, marker]
      },
      { type: 'reviewerNotFound' },
    ],
    [
      'a review of a deleted salon',
      async (visit, review) => {
        await deleteSalon(visit.salonId)
        return [review, await storedCustomer()]
      },
      { type: 'reviewNotFound' },
    ],
    [
      'a review that is not there',
      async () => [reviewIdSchema.parse(UNKNOWN_ID), await storedCustomer()],
      { type: 'reviewNotFound' },
    ],
  ])('should write no mark for %s', async (_case, arrange, answer) => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    const [id, marker] = await arrange(visit, review.id)

    // Act
    const marked = await repository().markHelpful(id, marker)

    // Assert
    expect(marked).toEqual({ type: 'success', data: answer })
    expect(await marksOf(review.id)).toBe(0)
  })

  it('should count the mark written while it waited for the review', async () => {
    // Arrange
    const review = await storedReview(await storedVisit())
    const [other, marker] = [await storedCustomer(), await storedCustomer()]

    // Act
    const marked = await databases.whileHeld(
      (held) =>
        held`select id from reviews where id = ${review.id} for no key update`,
      (held) =>
        held`insert into review_helpful_votes ("reviewId", "customerId") values (${review.id}, ${other})`,
      () => repository().markHelpful(review.id, marker),
    )

    // Assert
    expect(marked).toEqual({
      type: 'success',
      data: { type: 'marked', helpfulCount: 2 },
    })
  })
})

describe('ReviewRepository.report', () => {
  const customerReporter = async (
    customerId: CustomerId,
  ): Promise<ReviewReporter> => ({
    type: 'customer',
    userId: userIdSchema.parse((await insertUser(databases.database())).id),
    customerId,
  })

  const salonReporter = async (salonId: SalonId): Promise<ReviewReporter> => ({
    type: 'salon',
    userId: userIdSchema.parse(
      (await insertUser(databases.database(), { role: 'owner' })).id,
    ),
    salonId,
  })

  const REPEATED: RequestedReviewReport = {
    reason: 'other',
    details: '同じ文の投稿が続いている',
  }

  it.each<[string, (visit: Visit) => Promise<ReviewReporter>]>([
    ['a customer', async () => customerReporter(await storedCustomer())],
    ['the salon of the review', (visit) => salonReporter(visit.salonId)],
  ])(
    'should write the report of %s, and count the pending reports of the review',
    async (_case, reporterOf) => {
      // Arrange
      const visit = await storedVisit()
      const review = await storedReview(visit)
      await insertReviewReport(
        databases.database(),
        review.id,
        (await insertUser(databases.database())).id,
        {
          status: 'dismissed',
          resolvedBy: UNKNOWN_ID,
          resolvedAt: '2026-12-05T00:00:00Z',
        },
      )
      const reporter = await reporterOf(visit)

      // Act
      const reported = await repository().report(review.id, reporter, REPEATED)

      // Assert
      expect(reported).toMatchObject({
        type: 'success',
        data: {
          type: 'reported',
          report: {
            reviewId: review.id,
            reportedBy: reporter.userId,
            ...REPEATED,
            status: 'pending',
            resolvedBy: null,
          },
        },
      })
      expect(await storedOf(review.id)).toEqual({ ...review, reportCount: 1 })
    },
  )

  it.each<
    [
      string,
      (visit: Visit, review: ReviewId) => Promise<[ReviewId, ReviewReporter]>,
      object,
    ]
  >([
    [
      'a customer who is deleted',
      async (_visit, review) => {
        const customerId = await storedCustomer()
        await deleteCustomer(customerId)
        return [review, await customerReporter(customerId)]
      },
      { type: 'reporterNotFound' },
    ],
    [
      'the author of the review',
      async (visit, review) => [
        review,
        await customerReporter(visit.customerId),
      ],
      { type: 'ownReview' },
    ],
    [
      'another salon',
      async (_visit, review) => [
        review,
        await salonReporter((await storedVisit()).salonId),
      ],
      { type: 'otherSalon' },
    ],
    [
      'a review of a deleted salon',
      async (visit, review) => {
        await deleteSalon(visit.salonId)
        return [review, await salonReporter(visit.salonId)]
      },
      { type: 'reviewNotFound' },
    ],
    [
      'a review that is not there',
      async (visit) => [
        reviewIdSchema.parse(UNKNOWN_ID),
        await salonReporter(visit.salonId),
      ],
      { type: 'reviewNotFound' },
    ],
  ])('should write no report for %s', async (_case, arrange, answer) => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    const [id, reporter] = await arrange(visit, review.id)

    // Act
    const reported = await repository().report(id, reporter, REPEATED)

    // Assert
    expect(reported).toEqual({ type: 'success', data: answer })
    expect(await reportsOf(review.id)).toEqual([])
  })

  it('should write no second report of an account, also once the first was dismissed', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    const reporter = await salonReporter(visit.salonId)
    const first = await insertReviewReport(
      databases.database(),
      review.id,
      reporter.userId,
      {
        status: 'dismissed',
        resolvedBy: UNKNOWN_ID,
        resolvedAt: '2026-12-05T00:00:00Z',
      },
    )

    // Act
    const reported = await repository().report(review.id, reporter, REPEATED)

    // Assert
    expect(reported).toEqual({
      type: 'success',
      data: { type: 'reportedAlready' },
    })
    expect(await reportsOf(review.id)).toEqual([first])
  })

  it('should count the report written while it waited for the review', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    const other = await insertUser(databases.database())
    const reporter = await salonReporter(visit.salonId)

    // Act
    const reported = await databases.whileHeld(
      (held) =>
        held`select id from reviews where id = ${review.id} for no key update`,
      (held) =>
        held`insert into review_reports ("reviewId", "reportedBy", reason) values (${review.id}, ${other.id}, 'spam')`,
      () => repository().report(review.id, reporter, REPEATED),
    )

    // Assert
    expect(reported).toMatchObject({
      type: 'success',
      data: { type: 'reported' },
    })
    expect((await storedOf(review.id))?.reportCount).toBe(2)
  })
})

describe('ReviewRepository.respond', () => {
  const THANKS = 'ご来店ありがとうございました。'

  const ofSalon = (salonId: SalonId): ReviewResponder => ({
    type: 'salon',
    salonId,
  })

  it('should write the response of the salon with its time, and leave the time of the review', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)

    // Act
    const responded = await repository().respond(
      review.id,
      ofSalon(visit.salonId),
      { ownerResponse: THANKS },
    )

    // Assert
    const stored = await storedOf(review.id)
    expect(stored).toMatchObject({
      ownerResponse: THANKS,
      updatedAt: review.updatedAt,
    })
    expect(stored?.ownerRespondedAt).not.toBeNull()
    expect(responded).toEqual({
      type: 'success',
      data: { type: 'responded', review: stored },
    })
  })

  it('should keep the time of a response that is written again as it is', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit, {
      ownerResponse: THANKS,
      ownerRespondedAt: '2026-12-05T00:00:00Z',
    })

    // Act
    const responded = await repository().respond(
      review.id,
      ofSalon(visit.salonId),
      { ownerResponse: THANKS },
    )

    // Assert
    expect(responded).toEqual({
      type: 'success',
      data: { type: 'responded', review },
    })
    expect(await storedOf(review.id)).toEqual(review)
  })

  it('should take the response down for an administrator', async () => {
    // Arrange
    const review = await storedReview(await storedVisit(), {
      ownerResponse: THANKS,
      ownerRespondedAt: '2026-12-05T00:00:00Z',
    })

    // Act
    const responded = await repository().respond(
      review.id,
      { type: 'administrator' },
      { ownerResponse: null },
    )

    // Assert
    expect(responded).toEqual({
      type: 'success',
      data: {
        type: 'responded',
        review: { ...review, ownerResponse: null, ownerRespondedAt: null },
      },
    })
  })

  it('should answer with the response written while it waited for the review, and keep its time', async () => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)

    // Act
    const responded = await databases.whileHeld(
      (held) =>
        held`select id from reviews where id = ${review.id} for no key update`,
      (held) =>
        held`update reviews set "ownerResponse" = ${THANKS}, "ownerRespondedAt" = '2026-12-05T00:00:00Z' where id = ${review.id}`,
      () =>
        repository().respond(review.id, ofSalon(visit.salonId), {
          ownerResponse: THANKS,
        }),
    )

    // Assert
    const stored = await storedOf(review.id)
    expect(stored?.ownerRespondedAt).toMatch(/^2026-12-05/)
    expect(responded).toEqual({
      type: 'success',
      data: { type: 'responded', review: stored },
    })
  })

  it.each<
    [
      string,
      (visit: Visit, review: ReviewId) => Promise<[ReviewId, ReviewResponder]>,
      object,
    ]
  >([
    [
      'another salon',
      async (_visit, review) => [
        review,
        ofSalon((await storedVisit()).salonId),
      ],
      { type: 'otherSalon' },
    ],
    [
      'a review of a deleted salon',
      async (visit, review) => {
        await deleteSalon(visit.salonId)
        return [review, ofSalon(visit.salonId)]
      },
      { type: 'reviewNotFound' },
    ],
    [
      'a review that is not there',
      async () => [reviewIdSchema.parse(UNKNOWN_ID), { type: 'administrator' }],
      { type: 'reviewNotFound' },
    ],
  ])('should write no response for %s', async (_case, arrange, answer) => {
    // Arrange
    const visit = await storedVisit()
    const review = await storedReview(visit)
    const [id, responder] = await arrange(visit, review.id)

    // Act
    const responded = await repository().respond(id, responder, {
      ownerResponse: THANKS,
    })

    // Assert
    expect(responded).toEqual({ type: 'success', data: answer })
    expect(await storedOf(review.id)).toEqual(review)
  })
})

describe('ReviewRepository.salonTally', () => {
  it('should count the reviews of the salon by their overall ratings', async () => {
    // Arrange
    const visit = await storedVisit()
    await storedReview(visit, { overallRating: 5 })
    await reviewAt(visit, { overallRating: 5 })
    await reviewAt(visit, { overallRating: 3 })
    await reviewAt(await storedVisit(), { overallRating: 1 })

    // Act
    const tally = await repository().salonTally(visit.salonId)

    // Assert
    expect(tally).toEqual({
      type: 'success',
      data: {
        averageRating: '4.33',
        totalReviews: 3,
        ratingCounts: [0, 0, 1, 0, 2],
      },
    })
  })

  it('should count no reviews of a salon that has none', async () => {
    // Arrange
    const visit = await storedVisit()

    // Act
    const tally = await repository().salonTally(visit.salonId)

    // Assert
    expect(tally).toEqual({
      type: 'success',
      data: {
        averageRating: null,
        totalReviews: 0,
        ratingCounts: [0, 0, 0, 0, 0],
      },
    })
  })

  it.each<[string, () => Promise<string>]>([
    [
      'a deleted salon',
      async () => (await storedVisit({ deletedAt: DELETED_AT })).salonId,
    ],
    ['an ID that names none', async () => UNKNOWN_ID],
  ])('should count nothing for %s', async (_case, idOf) => {
    // Arrange
    const salonId = salonIdSchema.parse(await idOf())

    // Act
    const tally = await repository().salonTally(salonId)

    // Assert
    expect(tally).toEqual({ type: 'success', data: null })
  })
})

describe('ReviewRepository.staffTally', () => {
  it('should count the reviews that name the staff member by their overall ratings', async () => {
    // Arrange
    const visit = await storedVisit()
    await storedReview(visit, { staffId: visit.staffId, overallRating: 4 })
    await reviewAt(visit, { staffId: visit.staffId, overallRating: 2 })
    await reviewAt(visit, { overallRating: 5 })

    // Act
    const tally = await repository().staffTally(visit.staffId)

    // Assert
    expect(tally).toEqual({
      type: 'success',
      data: {
        averageRating: '3.00',
        totalReviews: 2,
        ratingCounts: [0, 1, 0, 1, 0],
      },
    })
  })

  it('should count no reviews of a staff member whom none names', async () => {
    // Arrange
    const visit = await storedVisit()
    await storedReview(visit)

    // Act
    const tally = await repository().staffTally(visit.staffId)

    // Assert
    expect(tally).toEqual({
      type: 'success',
      data: {
        averageRating: null,
        totalReviews: 0,
        ratingCounts: [0, 0, 0, 0, 0],
      },
    })
  })

  it.each<[string, () => Promise<string>]>([
    [
      'a staff member who is deleted',
      async () => {
        const { staffId } = await storedVisit()
        await deleteStaffMember(staffId)
        return staffId
      },
    ],
    [
      'a staff member of a deleted salon',
      async () => (await storedVisit({ deletedAt: DELETED_AT })).staffId,
    ],
    ['an ID that names none', async () => UNKNOWN_ID],
  ])('should count nothing for %s', async (_case, idOf) => {
    // Arrange
    const staffId = staffIdSchema.parse(await idOf())

    // Act
    const tally = await repository().staffTally(staffId)

    // Assert
    expect(tally).toEqual({ type: 'success', data: null })
  })
})

describe('ReviewRepository when the database is gone', () => {
  const id = reviewIdSchema.parse(UNKNOWN_ID)
  const customerId = customerIdSchema.parse(UNKNOWN_ID)
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const visit: Visit = {
    salonId,
    customerId,
    staffId: staffIdSchema.parse(UNKNOWN_ID),
    bookingId: bookingIdSchema.parse(UNKNOWN_ID),
  }

  it.each<[string, (gone: ReviewRepository) => Promise<unknown>]>([
    [
      'Failed to list reviews',
      (gone) =>
        gone.list({
          limit: 20,
          after: null,
          sortBy: 'recent',
          salonId: null,
          staffId: null,
          customerId: null,
          bookingId: null,
          isVerified: null,
          minRating: null,
          maxRating: null,
        }),
    ],
    ['Failed to find review', (gone) => gone.findById(id)],
    [
      'Failed to create review',
      (gone) => gone.create(customerId, requestOf(visit)),
    ],
    [
      'Failed to update review',
      (gone) => gone.update(id, customerId, { overallRating: 3 }),
    ],
    [
      'Failed to delete review',
      (gone) => gone.delete(id, { type: 'administrator' }),
    ],
    [
      'Failed to mark review as helpful',
      (gone) => gone.markHelpful(id, customerId),
    ],
    [
      'Failed to report review',
      (gone) =>
        gone.report(
          id,
          { type: 'salon', userId: userIdSchema.parse(UNKNOWN_ID), salonId },
          { reason: 'spam', details: null },
        ),
    ],
    [
      'Failed to respond to review',
      (gone) =>
        gone.respond(id, { type: 'administrator' }, { ownerResponse: null }),
    ],
    [
      'Failed to count the reviews of a salon',
      (gone) => gone.salonTally(salonId),
    ],
    [
      'Failed to count the reviews of a staff member',
      (gone) => gone.staffTally(visit.staffId),
    ],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new ReviewRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
