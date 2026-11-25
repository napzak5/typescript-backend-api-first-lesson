import { reviewReports, reviews } from '@beauty-salon-backend/database'
import {
  type ReviewReportListCriteria,
  reviewIdSchema,
  reviewReportIdSchema,
  salonIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { ReviewReportRepository } from '../review-report.repository.impl'
import {
  COMPLETED,
  insertBooking,
  insertCustomer,
  insertReview,
  insertReviewReport,
  insertSalon,
  insertStaffMember,
  insertUser,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new ReviewReportRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** A review in the table, of a completed visit to a salon of its own, deleted when the test says so. */
const storedReview = async (
  salonDeletedAt: string | null = null,
  overrides: Partial<typeof reviews.$inferInsert> = {},
) => {
  const db = databases.database()
  const salon = await insertSalon(db, { deletedAt: salonDeletedAt })
  const customer = await insertCustomer(db)
  const member = await insertStaffMember(db, salon.id)
  const booking = await insertBooking(
    db,
    { salonId: salon.id, customerId: customer.id, staffId: member.id },
    COMPLETED,
  )
  const review = await insertReview(
    db,
    { bookingId: booking.id, salonId: salon.id, customerId: customer.id },
    overrides,
  )
  return { ...review, id: reviewIdSchema.parse(review.id) }
}

/** A report of the review in the table by an account of its own, pending unless the test says otherwise. */
const storedReport = async (
  reviewId: string,
  overrides: Partial<typeof reviewReports.$inferInsert> = {},
) => {
  const db = databases.database()
  const row = await insertReviewReport(
    db,
    reviewId,
    (await insertUser(db)).id,
    overrides,
  )
  return { ...row, id: reviewReportIdSchema.parse(row.id) }
}

/** A user who handles the reports, by the ID a repository is given. */
const storedAdministrator = async () =>
  userIdSchema.parse(
    (await insertUser(databases.database(), { role: 'admin' })).id,
  )

const DISMISSED: Partial<typeof reviewReports.$inferInsert> = {
  status: 'dismissed',
  resolvedBy: UNKNOWN_ID,
  resolvedAt: '2026-12-05T00:00:00Z',
}

const reportCountOf = async (reviewId: string) => {
  const [review] = await databases
    .database()
    .select({ reportCount: reviews.reportCount })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
  return review?.reportCount
}

const storedOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(reviewReports)
    .where(eq(reviewReports.id, id))
  return row
}

describe('ReviewReportRepository.list', () => {
  const criteriaOf = (
    overrides: Partial<ReviewReportListCriteria> = {},
  ): ReviewReportListCriteria => ({
    limit: 20,
    after: null,
    status: null,
    reviewId: null,
    salonId: null,
    ...overrides,
  })

  const idsOf = (
    listed: Awaited<ReturnType<ReviewReportRepository['list']>>,
  ) =>
    listed.type === 'success' && listed.data !== null
      ? listed.data.reports.map(({ id }) => id)
      : []

  /**
   * Three reports of two reviews of live salons, by the order they were
   * made in: the first two of one review, the last dismissed. A report of
   * a review of a deleted salon is listed under no filter.
   */
  const storedReports = async () => {
    const review = await storedReview()
    const other = await storedReview()
    const first = await storedReport(review.id, {
      createdAt: '2026-12-01T00:00:00Z',
    })
    const second = await storedReport(review.id, {
      createdAt: '2026-12-02T00:00:00Z',
    })
    const third = await storedReport(other.id, {
      ...DISMISSED,
      createdAt: '2026-12-03T00:00:00Z',
    })
    await storedReport((await storedReview(DELETED_AT)).id)
    return { review, other, first, second, third }
  }

  it('should list the reports of reviews of live salons, the oldest first, and count them', async () => {
    // Arrange
    const { first, second, third } = await storedReports()

    // Act
    const listed = await repository().list(criteriaOf())

    // Assert
    expect(idsOf(listed)).toEqual([first.id, second.id, third.id])
    expect(listed).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: false, reports: [first, second, third] },
    })
  })

  it.each<
    [
      string,
      (
        stored: Awaited<ReturnType<typeof storedReports>>,
      ) => Partial<ReviewReportListCriteria>,
      ('first' | 'second' | 'third')[],
    ]
  >([
    ['the status', () => ({ status: 'pending' }), ['first', 'second']],
    ['the review', ({ other }) => ({ reviewId: other.id }), ['third']],
    [
      'the salon of the review',
      ({ review }) => ({ salonId: salonIdSchema.parse(review.salonId) }),
      ['first', 'second'],
    ],
    [
      'two filters at once',
      ({ review }) => ({ reviewId: review.id, status: 'dismissed' }),
      [],
    ],
  ])(
    'should list the reports by %s, and count them',
    async (_case, filtersOf, names) => {
      // Arrange
      const stored = await storedReports()

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

  it('should list a page at a time, the reports of one moment by their IDs', async () => {
    // Arrange
    const review = await storedReview()
    const earlier = await storedReport(review.id, {
      id: '00000000-0000-4000-8000-000000000005',
      createdAt: '2026-12-01T00:00:00Z',
    })
    const lower = await storedReport(review.id, {
      id: '00000000-0000-4000-8000-000000000002',
      createdAt: '2026-12-02T00:00:00Z',
    })
    const higher = await storedReport(review.id, {
      id: '00000000-0000-4000-8000-000000000003',
      createdAt: '2026-12-02T00:00:00Z',
    })

    // Act
    const pages = [
      await repository().list(criteriaOf({ limit: 1 })),
      await repository().list(criteriaOf({ limit: 1, after: earlier.id })),
      await repository().list(criteriaOf({ limit: 1, after: lower.id })),
    ]

    // Assert
    expect(pages.map(idsOf)).toEqual([[earlier.id], [lower.id], [higher.id]])
    expect(pages).toMatchObject([
      { data: { total: 3, hasMore: true } },
      { data: { total: 3, hasMore: true } },
      { data: { total: 3, hasMore: false } },
    ])
  })

  it.each<[string, () => Promise<string>]>([
    [
      'a report of a review of a deleted salon',
      async () => (await storedReport((await storedReview(DELETED_AT)).id)).id,
    ],
    ['an ID that names none', async () => UNKNOWN_ID],
  ])('should find no page after %s', async (_case, idOf) => {
    // Arrange
    await storedReports()
    const after = reviewReportIdSchema.parse(await idOf())

    // Act
    const listed = await repository().list(criteriaOf({ after }))

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

describe('ReviewReportRepository.dismiss', () => {
  it('should dismiss the pending report, with who and when, and count the pending reports of the review again', async () => {
    // Arrange
    const review = await storedReview(null, { reportCount: 2 })
    const report = await storedReport(review.id)
    await storedReport(review.id)
    const other = await storedReview()
    await storedReport(other.id)
    const administrator = await storedAdministrator()

    // Act
    const dismissed = await repository().dismiss(report.id, administrator)

    // Assert
    expect(dismissed).toMatchObject({
      type: 'success',
      data: {
        type: 'dismissed',
        report: {
          id: report.id,
          status: 'dismissed',
          resolvedBy: administrator,
        },
      },
    })
    const stored = await storedOf(report.id)
    expect(stored?.resolvedAt).not.toBeNull()
    expect(stored?.updatedAt).not.toBe(report.updatedAt)
    expect(await reportCountOf(review.id)).toBe(1)
    expect(await reportCountOf(other.id)).toBe(0)
  })

  it('should dismiss no report that was dismissed already, and keep who dismissed it', async () => {
    // Arrange
    const review = await storedReview()
    const report = await storedReport(review.id, DISMISSED)

    // Act
    const dismissed = await repository().dismiss(
      report.id,
      await storedAdministrator(),
    )

    // Assert
    expect(dismissed).toEqual({
      type: 'success',
      data: { type: 'dismissedAlready' },
    })
    expect(await storedOf(report.id)).toEqual(report)
  })

  it.each<[string, () => Promise<string>]>([
    [
      'report of a review of a deleted salon',
      async () => (await storedReport((await storedReview(DELETED_AT)).id)).id,
    ],
    ['report of an ID that names none', async () => UNKNOWN_ID],
  ])('should find no %s', async (_case, idOf) => {
    // Arrange
    const id = reviewReportIdSchema.parse(await idOf())

    // Act
    const dismissed = await repository().dismiss(
      id,
      await storedAdministrator(),
    )

    // Assert
    expect(dismissed).toEqual({
      type: 'success',
      data: { type: 'reportNotFound' },
    })
  })

  it('should find the report dismissed by the dismissal it waited for', async () => {
    // Arrange
    const review = await storedReview()
    const report = await storedReport(review.id)
    const administrator = await storedAdministrator()

    // Act
    const dismissed = await databases.whileHeld(
      (held) =>
        held`select id from reviews where id = ${review.id} for no key update`,
      (held) =>
        held`update review_reports set status = 'dismissed', "resolvedBy" = ${UNKNOWN_ID}, "resolvedAt" = now() where id = ${report.id}`,
      () => repository().dismiss(report.id, administrator),
    )

    // Assert
    expect(dismissed).toEqual({
      type: 'success',
      data: { type: 'dismissedAlready' },
    })
    expect((await storedOf(report.id))?.resolvedBy).toBe(UNKNOWN_ID)
  })

  it('should count the reports written while it waited for the review', async () => {
    // Arrange
    const db = databases.database()
    const review = await storedReview(null, { reportCount: 1 })
    const report = await storedReport(review.id)
    const [one, another] = [await insertUser(db), await insertUser(db)]
    const administrator = await storedAdministrator()

    // Act
    const dismissed = await databases.whileHeld(
      (held) =>
        held`select id from reviews where id = ${review.id} for no key update`,
      (held) =>
        held`insert into review_reports ("reviewId", "reportedBy", reason) values (${review.id}, ${one.id}, 'spam'), (${review.id}, ${another.id}, 'spam')`,
      () => repository().dismiss(report.id, administrator),
    )

    // Assert
    expect(dismissed).toMatchObject({
      type: 'success',
      data: { type: 'dismissed' },
    })
    expect(await reportCountOf(review.id)).toBe(2)
  })

  it('should answer that the update returned no row when a trigger skips it', async () => {
    // Arrange
    const review = await storedReview()
    const report = await storedReport(review.id)
    await databases.skipWrites('review_reports', 'UPDATE')

    // Act
    const dismissed = await repository().dismiss(
      report.id,
      await storedAdministrator(),
    )

    // Assert
    expect(dismissed).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of dismissed report returned no row',
        cause: null,
      },
    })
  })
})

describe('ReviewReportRepository when the database is gone', () => {
  const id = reviewReportIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (gone: ReviewReportRepository) => Promise<unknown>]>([
    [
      'Failed to list review reports',
      (gone) =>
        gone.list({
          limit: 20,
          after: null,
          status: null,
          reviewId: null,
          salonId: null,
        }),
    ],
    [
      'Failed to dismiss review report',
      (gone) => gone.dismiss(id, userIdSchema.parse(UNKNOWN_ID)),
    ],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new ReviewReportRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
