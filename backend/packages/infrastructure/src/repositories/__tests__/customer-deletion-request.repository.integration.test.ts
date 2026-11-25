import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customerAllergies,
  customerDeletionRequests,
  customerPoints,
  customerPreferences,
  customers,
  customerVersions,
  medicalCharts,
  reviewHelpfulVotes,
  reviews,
  salons,
  sessions,
  treatmentPhotos,
  treatmentRecords,
  users,
} from '@beauty-salon-backend/database'
import {
  type CustomerId,
  customerIdSchema,
  type UserId,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { recordVersions } from '../_shared/customer-version-record'
import { CustomerDeletionRequestRepository } from '../customer-deletion-request.repository.impl'
import {
  COMPLETED,
  insertAllergy,
  insertBooking,
  insertBookingLine,
  insertChart,
  insertCustomer,
  insertDeletionRequest,
  insertHelpfulVote,
  insertPoints,
  insertPreferences,
  insertReview,
  insertSalon,
  insertService,
  insertSession,
  insertStaffMember,
  insertTreatmentPhoto,
  insertTreatmentRecord,
  insertUser,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () =>
  new CustomerDeletionRequestRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** The grace period of a request, in milliseconds: 14 days. */
const GRACE_PERIOD = 14 * 24 * 60 * 60 * 1000

/** The times of a request that is not due before the end of 2099. */
const NOT_DUE: Parameters<typeof insertDeletionRequest>[3] = {
  requestedAt: '2099-12-01T03:00:00Z',
  scheduledAt: '2099-12-15T03:00:00Z',
}

/** The columns of a request that was cancelled. */
const cancelledBy = (
  userId: UserId,
): Parameters<typeof insertDeletionRequest>[3] => ({
  status: 'cancelled',
  cancelledBy: userId,
  cancelledAt: '2026-01-06T03:00:00Z',
})

/** The columns of a request that was carried out. */
const completedBy = (
  userId: UserId,
): Parameters<typeof insertDeletionRequest>[3] => ({
  status: 'completed',
  completedBy: userId,
  completedAt: '2026-01-20T03:00:00Z',
})

/** An account in the table, as a repository is given it: a member of the staff unless the test says otherwise. */
const storedUser = async (
  overrides: Parameters<typeof insertUser>[1] = { role: 'staff' },
): Promise<UserId> =>
  userIdSchema.parse((await insertUser(databases.database(), overrides)).id)

/** A customer in the table, as a repository is given them. */
const storedCustomer = async (
  overrides: Parameters<typeof insertCustomer>[1] = {},
): Promise<CustomerId> =>
  customerIdSchema.parse(
    (await insertCustomer(databases.database(), overrides)).id,
  )

/** The requests of the customer in the table, the first taken first. */
const requestsOf = (customerId: CustomerId) =>
  databases
    .database()
    .select()
    .from(customerDeletionRequests)
    .where(eq(customerDeletionRequests.customerId, customerId))
    .orderBy(asc(customerDeletionRequests.requestedAt))

/** How many milliseconds after it was taken a request falls due. */
const graceOf = ({
  requestedAt,
  scheduledAt,
}: {
  requestedAt: string
  scheduledAt: string
}): number => new Date(scheduledAt).getTime() - new Date(requestedAt).getTime()

describe('CustomerDeletionRequestRepository.request', () => {
  it('should take the request, due the grace period after it was taken', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const requestedBy = await storedUser()

    // Act
    const requested = await repository().request(
      customerId,
      '使わなくなったため',
      requestedBy,
    )

    // Assert
    expect(requested).toMatchObject({
      type: 'success',
      data: {
        type: 'requested',
        request: {
          customerId,
          reason: '使わなくなったため',
          requestedBy,
          status: 'pending',
        },
      },
    })
    expect((await requestsOf(customerId)).map(graceOf)).toEqual([GRACE_PERIOD])
  })

  it('should take no second request while one is pending', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const requestedBy = await storedUser()
    const pending = await insertDeletionRequest(
      databases.database(),
      customerId,
      requestedBy,
      NOT_DUE,
    )

    // Act
    const requested = await repository().request(
      customerId,
      'もう一度',
      requestedBy,
    )

    // Assert
    expect(requested).toEqual({
      type: 'success',
      data: { type: 'alreadyRequested', request: pending },
    })
    expect(await requestsOf(customerId)).toHaveLength(1)
  })

  it('should take a request after one that was cancelled', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const requestedBy = await storedUser()
    await insertDeletionRequest(
      databases.database(),
      customerId,
      requestedBy,
      cancelledBy(requestedBy),
    )

    // Act
    const requested = await repository().request(
      customerId,
      'やはり消してほしい',
      requestedBy,
    )

    // Assert
    expect(requested).toMatchObject({
      type: 'success',
      data: { type: 'requested', request: { status: 'pending' } },
    })
    expect(await requestsOf(customerId)).toHaveLength(2)
  })

  it.each<[string, () => Promise<CustomerId>]>([
    ['who is deleted', () => storedCustomer({ deletedAt: DELETED_AT })],
    [
      'of an ID that names none',
      async () => customerIdSchema.parse(UNKNOWN_ID),
    ],
  ])('should take no request of a customer %s', async (_, arrange) => {
    // Arrange
    const customerId = await arrange()

    // Act
    const requested = await repository().request(
      customerId,
      '使わなくなったため',
      await storedUser(),
    )

    // Assert
    expect(requested).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
    expect(await requestsOf(customerId)).toEqual([])
  })

  it('should answer a database error when the insert writes no row', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const requestedBy = await storedUser()
    await databases.skipWrites('customer_deletion_requests', 'INSERT')

    // Act
    const requested = await repository().request(
      customerId,
      '使わなくなったため',
      requestedBy,
    )

    // Assert
    expect(requested).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of customer deletion request returned no row',
        cause: null,
      },
    })
  })
})

describe('CustomerDeletionRequestRepository.latestOf', () => {
  it('should find the request taken last, of a deleted customer too', async () => {
    // Arrange
    const customerId = await storedCustomer({ deletedAt: DELETED_AT })
    const requestedBy = await storedUser()
    const db = databases.database()
    await insertDeletionRequest(db, customerId, requestedBy, {
      ...cancelledBy(requestedBy),
      requestedAt: '2025-12-01T03:00:00Z',
      scheduledAt: '2025-12-15T03:00:00Z',
    })
    const latest = await insertDeletionRequest(db, customerId, requestedBy)

    // Act
    const found = await repository().latestOf(customerId)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: { type: 'found', request: latest },
    })
  })

  it('should find the request of the greater ID of two taken at the same moment', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const requestedBy = await storedUser()
    const db = databases.database()
    const first = await insertDeletionRequest(
      db,
      customerId,
      requestedBy,
      cancelledBy(requestedBy),
    )
    const second = await insertDeletionRequest(
      db,
      customerId,
      requestedBy,
      cancelledBy(requestedBy),
    )

    // Act
    const found = await repository().latestOf(customerId)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: {
        type: 'found',
        request: { id: [first.id, second.id].toSorted().at(-1) },
      },
    })
  })

  it('should find no request of a customer who made none', async () => {
    // Arrange
    const customerId = await storedCustomer()

    // Act
    const found = await repository().latestOf(customerId)

    // Assert
    expect(found).toEqual({ type: 'success', data: { type: 'noRequest' } })
  })

  it('should find no customer of an ID that names none', async () => {
    // Act
    const found = await repository().latestOf(
      customerIdSchema.parse(UNKNOWN_ID),
    )

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
  })
})

describe('CustomerDeletionRequestRepository.cancel', () => {
  it.each<[string, Parameters<typeof insertCustomer>[1]]>([
    ['a customer', {}],
    ['a deleted customer', { deletedAt: DELETED_AT }],
  ])('should cancel the pending request of %s', async (_, customer) => {
    // Arrange
    const customerId = await storedCustomer(customer)
    const requestedBy = await storedUser()
    await insertDeletionRequest(
      databases.database(),
      customerId,
      requestedBy,
      NOT_DUE,
    )
    const cancelling = await storedUser({ role: 'admin' })

    // Act
    const cancelled = await repository().cancel(customerId, cancelling)

    // Assert
    expect(cancelled).toMatchObject({
      type: 'success',
      data: {
        type: 'cancelled',
        request: { status: 'cancelled', cancelledBy: cancelling },
      },
    })
    expect(await requestsOf(customerId)).toMatchObject([
      { status: 'cancelled', cancelledBy: cancelling },
    ])
  })

  it('should cancel nothing of a customer whose requests are all done with', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const requestedBy = await storedUser()
    const db = databases.database()
    await insertDeletionRequest(
      db,
      customerId,
      requestedBy,
      cancelledBy(requestedBy),
    )
    await insertDeletionRequest(
      db,
      customerId,
      requestedBy,
      completedBy(requestedBy),
    )

    // Act
    const cancelled = await repository().cancel(customerId, requestedBy)

    // Assert
    expect(cancelled).toEqual({
      type: 'success',
      data: { type: 'noPendingRequest' },
    })
  })

  it('should find no customer of an ID that names none', async () => {
    // Act
    const cancelled = await repository().cancel(
      customerIdSchema.parse(UNKNOWN_ID),
      await storedUser(),
    )

    // Assert
    expect(cancelled).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
  })
})

describe('CustomerDeletionRequestRepository.dueRequests', () => {
  it('should list the pending requests that are due, the one due first first', async () => {
    // Arrange
    const db = databases.database()
    const requestedBy = await storedUser()
    const requestOf = async (
      overrides: Parameters<typeof insertDeletionRequest>[3],
    ) =>
      (
        await insertDeletionRequest(
          db,
          await storedCustomer(),
          requestedBy,
          overrides,
        )
      ).id
    const later = await requestOf({})
    const sameMoment = await requestOf({})
    const earliest = await requestOf({
      requestedAt: '2025-12-27T03:00:00Z',
      scheduledAt: '2026-01-10T03:00:00Z',
    })
    await requestOf(NOT_DUE)
    await requestOf(cancelledBy(requestedBy))
    await requestOf(completedBy(requestedBy))

    // Act
    const due = await repository().dueRequests()

    // Assert
    expect(due).toEqual({
      type: 'success',
      data: [earliest, ...[later, sameMoment].toSorted()],
    })
  })
})

describe('CustomerDeletionRequestRepository.erase', () => {
  /** A salon with a member of the staff and a service, where the customers of a test have been. */
  const storedSalon = async () => {
    const db = databases.database()
    const salon = await insertSalon(db)
    const member = await insertStaffMember(db, salon.id)
    const service = await insertService(db, salon.id)
    return { salonId: salon.id, staffId: member.id, serviceId: service.id }
  }

  /** The row of the customer as the table holds it. */
  const customerOf = async (id: string) => {
    const [customer] = await databases
      .database()
      .select()
      .from(customers)
      .where(eq(customers.id, id))
    return customer
  }

  /** The row of the account as the table holds it. */
  const accountOf = async (id: string) => {
    const [account] = await databases
      .database()
      .select()
      .from(users)
      .where(eq(users.id, id))
    return account
  }

  it('should erase what says who the customer was, and keep what the books need', async () => {
    // Arrange
    const db = databases.database()
    const { salonId, staffId, serviceId } = await storedSalon()
    const admin = await storedUser({ role: 'admin' })
    const account = await storedUser({ role: 'customer' })
    const customer = await insertCustomer(db, {
      userId: account,
      loyaltyPoints: 300,
      notes: '静かな席を希望',
      tags: ['常連'],
      visitCount: 1,
      firstVisitDate: '2026-12-07',
      lastVisitDate: '2026-12-07',
      membershipTier: 'gold',
    })
    const customerId = customerIdSchema.parse(customer.id)
    await db.update(users).set({ customerId }).where(eq(users.id, account))
    await insertSession(db, account)
    await recordVersions(db, [customer], 'create', admin)
    await insertPreferences(db, customerId, {
      specialRequests: '香りの弱いものを',
    })
    await insertChart(db, customerId, { notes: '頭皮が乾燥しやすい' })
    await insertAllergy(db, customerId)
    const booking = await insertBooking(
      db,
      { salonId, customerId, staffId },
      {
        ...COMPLETED,
        customerRequest: '短めに',
        internalNotes: '前回は遅れて来店',
        ipAddress: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
      },
    )
    const line = await insertBookingLine(db, booking.id, serviceId, {
      notes: '前髪は眉の上',
    })
    await db.insert(bookingStatusHistories).values({
      bookingId: booking.id,
      fromStatus: 'confirmed',
      toStatus: 'completed',
      reason: 'ご本人の希望で早めに終了',
    })
    const record = await insertTreatmentRecord(
      db,
      { bookingId: booking.id, customerId, staffId, serviceId },
      { consultationNotes: '根元の白髪が気になる', customerSatisfaction: 5 },
    )
    await insertTreatmentPhoto(db, record.id)
    const ownReview = await insertReview(db, {
      bookingId: booking.id,
      salonId,
      customerId,
    })
    const other = await insertCustomer(db)
    const othersBooking = await insertBooking(
      db,
      { salonId, customerId: other.id, staffId },
      COMPLETED,
    )
    const othersReview = await insertReview(
      db,
      { bookingId: othersBooking.id, salonId, customerId: other.id },
      { overallRating: 3, helpfulCount: 1 },
    )
    await insertHelpfulVote(db, othersReview.id, customerId)
    await insertHelpfulVote(db, ownReview.id, other.id)
    await db
      .update(salons)
      .set({ rating: '4.00', reviewCount: 2 })
      .where(eq(salons.id, salonId))
    await insertPoints(db, customerId, {
      points: 300,
      balance: 300,
      description: 'ご来店ポイント',
      referenceType: 'booking',
      referenceId: booking.id,
    })
    const request = await insertDeletionRequest(db, customerId, account)

    // Act
    const erased = await repository().erase(request.id, admin)

    // Assert
    expect(erased).toMatchObject({
      type: 'success',
      data: {
        type: 'erased',
        request: { id: request.id, status: 'completed', completedBy: admin },
      },
    })
    expect(await customerOf(customerId)).toMatchObject({
      userId: null,
      firstName: '顧客',
      lastName: '消去済み',
      email: `${customerId}@erased.invalid`,
      phoneNumber: '0000000000',
      notes: null,
      tags: [],
      loyaltyPoints: 0,
      isActive: false,
      allowEmail: false,
      membershipTier: 'gold',
      visitCount: 1,
      deletedAt: expect.any(String),
    })
    expect(await accountOf(account)).toMatchObject({
      email: `${account}@erased.invalid`,
      passwordHash: 'erased',
      status: 'deleted',
      customerId: null,
      deletedAt: expect.any(String),
    })
    expect(
      await db.select().from(sessions).where(eq(sessions.userId, account)),
    ).toEqual([])
    for (const table of [
      customerPreferences,
      medicalCharts,
      customerAllergies,
    ]) {
      expect(
        await db.select().from(table).where(eq(table.customerId, customerId)),
      ).toEqual([])
    }
    expect(
      await db.select().from(bookings).where(eq(bookings.id, booking.id)),
    ).toMatchObject([
      {
        customerRequest: null,
        internalNotes: null,
        ipAddress: null,
        userAgent: null,
        totalAmount: booking.totalAmount,
      },
    ])
    expect(
      await db
        .select({ notes: bookingServices.notes })
        .from(bookingServices)
        .where(eq(bookingServices.id, line.id)),
    ).toEqual([{ notes: null }])
    expect(
      await db
        .select({ reason: bookingStatusHistories.reason })
        .from(bookingStatusHistories)
        .where(eq(bookingStatusHistories.bookingId, booking.id)),
    ).toEqual([{ reason: null }])
    expect(
      await db
        .select()
        .from(treatmentRecords)
        .where(eq(treatmentRecords.id, record.id)),
    ).toMatchObject([{ consultationNotes: null, customerSatisfaction: null }])
    expect(
      await db
        .select()
        .from(treatmentPhotos)
        .where(eq(treatmentPhotos.treatmentRecordId, record.id)),
    ).toEqual([])
    expect(
      await db
        .select({ id: reviews.id, helpfulCount: reviews.helpfulCount })
        .from(reviews)
        .where(eq(reviews.salonId, salonId)),
    ).toEqual([{ id: othersReview.id, helpfulCount: 0 }])
    expect(
      await db
        .select()
        .from(reviewHelpfulVotes)
        .where(eq(reviewHelpfulVotes.customerId, other.id)),
    ).toEqual([])
    expect(
      await db
        .select({ rating: salons.rating, reviewCount: salons.reviewCount })
        .from(salons)
        .where(eq(salons.id, salonId)),
    ).toEqual([{ rating: '3.00', reviewCount: 1 }])
    expect(
      await db
        .select({
          transactionType: customerPoints.transactionType,
          points: customerPoints.points,
          balance: customerPoints.balance,
          description: customerPoints.description,
        })
        .from(customerPoints)
        .where(eq(customerPoints.customerId, customerId))
        .orderBy(asc(customerPoints.createdAt)),
    ).toEqual([
      {
        transactionType: 'earned',
        points: 300,
        balance: 300,
        description: null,
      },
      {
        transactionType: 'expired',
        points: -300,
        balance: 0,
        description: 'データの消去による失効',
      },
    ])
    expect(
      await db
        .select({
          operation: customerVersions.operation,
          version: customerVersions.version,
          firstName: customerVersions.firstName,
        })
        .from(customerVersions)
        .where(eq(customerVersions.customerId, customerId)),
    ).toEqual([{ operation: 'erase', version: 1, firstName: '顧客' }])
  })

  it('should keep the time a customer was deleted at, and erase the account they still name, unless it has a profile again', async () => {
    // Arrange
    const db = databases.database()
    const admin = await storedUser({ role: 'admin' })
    const named = await storedUser({ role: 'customer' })
    const withProfile = await storedUser({ role: 'customer' })
    const customerId = await storedCustomer({
      userId: named,
      deletedAt: DELETED_AT,
    })
    const again = await storedCustomer({ userId: withProfile })
    await db
      .update(users)
      .set({ customerId: again })
      .where(eq(users.id, withProfile))
    const request = await insertDeletionRequest(db, customerId, admin)
    const otherRequest = await insertDeletionRequest(
      db,
      await storedCustomer({ userId: withProfile, deletedAt: DELETED_AT }),
      admin,
    )

    // Act
    const erased = await repository().erase(request.id, admin)
    const erasedOther = await repository().erase(otherRequest.id, admin)

    // Assert
    expect(erased).toMatchObject({
      type: 'success',
      data: { type: 'erased' },
    })
    expect(erasedOther).toMatchObject({
      type: 'success',
      data: { type: 'erased' },
    })
    expect(await customerOf(customerId)).toMatchObject({
      deletedAt: '2026-12-01 00:00:00+00',
    })
    expect(await accountOf(named)).toMatchObject({ status: 'deleted' })
    expect(await accountOf(withProfile)).toMatchObject({
      status: 'active',
      customerId: again,
    })
  })

  it('should erase a customer without an account or points, and forfeit nothing', async () => {
    // Arrange
    const admin = await storedUser({ role: 'admin' })
    const customerId = await storedCustomer()
    const request = await insertDeletionRequest(
      databases.database(),
      customerId,
      admin,
    )

    // Act
    const erased = await repository().erase(request.id, admin)

    // Assert
    expect(erased).toMatchObject({
      type: 'success',
      data: { type: 'erased' },
    })
    expect(
      await databases
        .database()
        .select()
        .from(customerPoints)
        .where(eq(customerPoints.customerId, customerId)),
    ).toEqual([])
  })

  it.each<
    [string, (userId: UserId) => Parameters<typeof insertDeletionRequest>[3]]
  >([
    ['that is not due yet', () => NOT_DUE],
    ['that was cancelled', cancelledBy],
    ['that was carried out', completedBy],
  ])('should erase nothing of a request %s', async (_, columnsOf) => {
    // Arrange
    const admin = await storedUser({ role: 'admin' })
    const customerId = await storedCustomer({ notes: '静かな席を希望' })
    const request = await insertDeletionRequest(
      databases.database(),
      customerId,
      admin,
      columnsOf(admin),
    )

    // Act
    const erased = await repository().erase(request.id, admin)

    // Assert
    expect(erased).toEqual({ type: 'success', data: { type: 'notDue' } })
    expect(await customerOf(customerId)).toMatchObject({
      notes: '静かな席を希望',
      deletedAt: null,
    })
  })

  it('should erase nothing of an ID that names no request', async () => {
    // Act
    const erased = await repository().erase(UNKNOWN_ID, await storedUser())

    // Assert
    expect(erased).toEqual({ type: 'success', data: { type: 'notDue' } })
  })

  it.each<[string, string]>([
    ['customers', 'Update of erased customer returned no row'],
    [
      'customer_deletion_requests',
      'Update of completed deletion request returned no row',
    ],
  ])(
    'should answer a database error when the update of %s writes no row',
    async (table, message) => {
      // Arrange
      const admin = await storedUser({ role: 'admin' })
      const request = await insertDeletionRequest(
        databases.database(),
        await storedCustomer(),
        admin,
      )
      await databases.skipWrites(table, 'UPDATE')

      // Act
      const erased = await repository().erase(request.id, admin)

      // Assert
      expect(erased).toEqual({
        type: 'error',
        error: { type: 'database', message, cause: null },
      })
    },
  )
})

describe('CustomerDeletionRequestRepository on a database that is gone', () => {
  const customerId = customerIdSchema.parse(UNKNOWN_ID)
  const userId = userIdSchema.parse(UNKNOWN_ID)

  it.each<
    [
      string,
      (repository: CustomerDeletionRequestRepository) => Promise<unknown>,
    ]
  >([
    [
      'Failed to take the deletion request',
      (gone) => gone.request(customerId, '使わなくなったため', userId),
    ],
    [
      'Failed to read the deletion request',
      (gone) => gone.latestOf(customerId),
    ],
    [
      'Failed to cancel the deletion request',
      (gone) => gone.cancel(customerId, userId),
    ],
    [
      'Failed to find the deletion requests that are due',
      (gone) => gone.dueRequests(),
    ],
    [
      'Failed to erase the data of the customer',
      (gone) => gone.erase(UNKNOWN_ID, userId),
    ],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new CustomerDeletionRequestRepository(await databases.gone())

    // Act
    const result = await call(gone)

    // Assert
    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message,
        cause: expect.objectContaining({ code: 'CONNECTION_ENDED' }),
      },
    })
  })
})
