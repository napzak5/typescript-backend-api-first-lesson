import {
  bookings,
  customerAllergies,
  customerPoints,
  customerPreferences,
  customers,
  customerVersions,
  medicalCharts,
  reviewHelpfulVotes,
  reviews,
  sales,
  treatmentRecords,
  users,
} from '@beauty-salon-backend/database'
import {
  type CustomerId,
  type CustomerMergeConflictResolution,
  type CustomerMergeInstruction,
  customerIdSchema,
  type UserId,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq, inArray } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { CustomerRepository } from '../customer.repository.impl'
import {
  CANCELLED,
  COMPLETED,
  insertAllergy,
  insertBooking,
  insertChart,
  insertCustomer,
  insertDeletionRequest,
  insertHelpfulVote,
  insertPoints,
  insertPreferences,
  insertReview,
  insertSale,
  insertSalon,
  insertService,
  insertStaffMember,
  insertTreatmentRecord,
  insertUser,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new CustomerRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** The largest balance a customer may have: the largest integer of PostgreSQL. */
const MAX_INTEGER = 2_147_483_647

/** A member of the staff who merges the customers. */
const storedEditor = async (): Promise<UserId> =>
  userIdSchema.parse(
    (await insertUser(databases.database(), { role: 'staff' })).id,
  )

/** A customer in the table, as a repository is given them. */
const storedCustomer = async (
  overrides: Parameters<typeof insertCustomer>[1] = {},
): Promise<CustomerId> =>
  customerIdSchema.parse(
    (await insertCustomer(databases.database(), overrides)).id,
  )

/** The two customers of a merge, the primary first. */
const storedPair = (
  primary: Parameters<typeof insertCustomer>[1] = {},
  secondary: Parameters<typeof insertCustomer>[1] = {},
): Promise<[CustomerId, CustomerId]> =>
  Promise.all([storedCustomer(primary), storedCustomer(secondary)])

/** The merge of the secondary into the primary. */
const mergeOf = (
  primaryCustomerId: CustomerId,
  secondaryCustomerId: CustomerId,
  conflictResolution: CustomerMergeConflictResolution = 'keep_primary',
): CustomerMergeInstruction => ({
  primaryCustomerId,
  secondaryCustomerId,
  conflictResolution,
})

/** Merges the secondary into the primary, as a member of the staff. */
const merged = async (
  primary: CustomerId,
  secondary: CustomerId,
  conflictResolution?: CustomerMergeConflictResolution,
) =>
  repository().merge(
    mergeOf(primary, secondary, conflictResolution),
    await storedEditor(),
  )

/** The row of the customer as the table holds it. */
const customerOf = async (id: string) => {
  const [customer] = await databases
    .database()
    .select()
    .from(customers)
    .where(eq(customers.id, id))
  return customer
}

/** The operations of the versions of the customer, the first one first. */
const operationsOf = async (customerId: string) =>
  (
    await databases
      .database()
      .select({ operation: customerVersions.operation })
      .from(customerVersions)
      .where(eq(customerVersions.customerId, customerId))
      .orderBy(asc(customerVersions.version))
  ).map(({ operation }) => operation)

/** A salon with a member of the staff and a service. */
const storedSalon = async () => {
  const db = databases.database()
  const { id: salonId } = await insertSalon(db)
  const { id: staffId } = await insertStaffMember(db, salonId)
  const { id: serviceId } = await insertService(db, salonId)
  return { salonId, staffId, serviceId }
}

/** The columns of a completed booking of the day. */
const completedOn = (day: string) => ({
  ...COMPLETED,
  bookingDate: day,
  startTime: `${day}T01:00:00Z`,
  endTime: `${day}T02:00:00Z`,
})

describe('CustomerRepository.merge: the ledger', () => {
  it('should keep the values of the primary, take those only the secondary has, and delete the secondary', async () => {
    // Arrange
    const secondary = await storedCustomer({
      firstName: '春子',
      phoneNumber: '090-2222-2222',
      notes: '静かな席を希望',
      tags: ['常連'],
      referralCode: 'HARUKO01',
    })
    const primary = await storedCustomer({
      firstName: '花子',
      phoneNumber: '090-1111-1111',
      referredBy: secondary,
    })

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toMatchObject({
      type: 'success',
      data: {
        type: 'merged',
        customer: {
          id: primary,
          firstName: '花子',
          phoneNumber: '090-1111-1111',
          notes: '静かな席を希望',
          tags: ['常連'],
          referralCode: 'HARUKO01',
          referredBy: null,
        },
      },
    })
    expect(await customerOf(secondary)).toMatchObject({
      referralCode: null,
      deletedAt: expect.any(String),
    })
    expect(await operationsOf(primary)).toEqual(['merge'])
    expect(await operationsOf(secondary)).toEqual(['merge'])
  })

  it.each<[CustomerMergeConflictResolution, string, string, string | null]>([
    ['keep_primary', '花子', 'HANAKO01', 'HARUKO01'],
    ['keep_secondary', '春子', 'HARUKO01', null],
  ])(
    'should take the values of one side where both have one, with %s',
    async (resolution, firstName, kept, leftWithSecondary) => {
      // Arrange
      const [primary, secondary] = await storedPair(
        { firstName: '花子', referralCode: 'HANAKO01' },
        {
          firstName: '春子',
          email: 'haruko@example.com',
          referralCode: 'HARUKO01',
        },
      )
      const secondaryEmail = (await customerOf(secondary))?.email

      // Act
      const result = await merged(primary, secondary, resolution)

      // Assert
      expect(result).toMatchObject({
        type: 'success',
        data: {
          type: 'merged',
          customer: { firstName, referralCode: kept },
        },
      })
      expect(await customerOf(secondary)).toMatchObject({
        email: secondaryEmail,
        referralCode: leftWithSecondary,
      })
    },
  )

  it('should give the primary the email of the secondary, which is deleted first', async () => {
    // Arrange
    const [primary, secondary] = await storedPair(
      {},
      { email: 'haruko@example.com' },
    )

    // Act
    const result = await merged(primary, secondary, 'keep_secondary')

    // Assert
    expect(result).toMatchObject({
      type: 'success',
      data: {
        type: 'merged',
        customer: { email: 'haruko@example.com' },
      },
    })
  })

  it.each<[string, string, string]>([
    ['the secondary was written later', '2026-11-02T00:00:00Z', '春子'],
    ['both were written at the same moment', '2026-11-01T00:00:00Z', '花子'],
  ])(
    'should take the values of the customer written last, with keep_newest, when %s',
    async (_, secondaryWritten, firstName) => {
      // Arrange
      const [primary, secondary] = await storedPair(
        { firstName: '花子', updatedAt: '2026-11-01T00:00:00Z' },
        { firstName: '春子', updatedAt: secondaryWritten },
      )

      // Act
      const result = await merged(primary, secondary, 'keep_newest')

      // Assert
      expect(result).toMatchObject({
        type: 'success',
        data: { type: 'merged', customer: { firstName } },
      })
    },
  )

  it.each<[string, boolean, boolean]>([
    ['the account of the secondary, when the primary has none', false, true],
    ['its own account, when the secondary has none', true, false],
  ])(
    'should give the primary %s',
    async (_, primaryHasOne, secondaryHasOne) => {
      // Arrange
      const db = databases.database()
      const account = await insertUser(db, { role: 'customer' })
      const [primary, secondary] = await storedPair(
        primaryHasOne ? { userId: account.id } : {},
        secondaryHasOne ? { userId: account.id } : {},
      )
      await db
        .update(users)
        .set({ customerId: primaryHasOne ? primary : secondary })
        .where(eq(users.id, account.id))

      // Act
      const result = await merged(primary, secondary)

      // Assert
      expect(result).toMatchObject({
        type: 'success',
        data: { type: 'merged', customer: { userId: account.id } },
      })
      const [profile] = await db
        .select({ customerId: users.customerId })
        .from(users)
        .where(eq(users.id, account.id))
      expect(profile).toEqual({ customerId: primary })
      expect(await customerOf(secondary)).toMatchObject({
        userId: secondaryHasOne ? account.id : null,
      })
    },
  )

  it('should make the primary the referrer of the customers the secondary referred, but of a deleted one', async () => {
    // Arrange
    const [primary, secondary] = await storedPair()
    const referred = await storedCustomer({ referredBy: secondary })
    const deleted = await storedCustomer({
      referredBy: secondary,
      deletedAt: DELETED_AT,
    })

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toMatchObject({ type: 'success', data: { type: 'merged' } })
    expect(await customerOf(referred)).toMatchObject({ referredBy: primary })
    expect(await operationsOf(referred)).toEqual(['merge'])
    expect(await customerOf(deleted)).toMatchObject({ referredBy: secondary })
  })

  it('should answer a database error when the update of the kept customer writes no row', async () => {
    // Arrange
    const [primary, secondary] = await storedPair()
    const editor = await storedEditor()
    await databases.skipWrites('customers', 'UPDATE')

    // Act
    const result = await repository().merge(mergeOf(primary, secondary), editor)

    // Assert
    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of the kept customer returned no row',
        cause: null,
      },
    })
  })
})

describe('CustomerRepository.merge: what names the secondary', () => {
  it('should move the bookings, the sales, the treatment records and the reviews, and count the visits of both again', async () => {
    // Arrange
    const db = databases.database()
    const { salonId, staffId, serviceId } = await storedSalon()
    const [primary, secondary] = await storedPair(
      {
        visitCount: 1,
        firstVisitDate: '2026-12-07',
        lastVisitDate: '2026-12-07',
      },
      {
        visitCount: 1,
        cancellationCount: 1,
        firstVisitDate: '2026-12-01',
        lastVisitDate: '2026-12-01',
      },
    )
    await insertBooking(
      db,
      { salonId, customerId: primary, staffId },
      completedOn('2026-12-07'),
    )
    const visit = await insertBooking(
      db,
      { salonId, customerId: secondary, staffId },
      completedOn('2026-12-01'),
    )
    await insertBooking(
      db,
      { salonId, customerId: secondary, staffId },
      CANCELLED,
    )
    const sale = await insertSale(
      db,
      { salonId, customerId: secondary },
      { bookingId: visit.id },
    )
    const record = await insertTreatmentRecord(db, {
      bookingId: visit.id,
      customerId: secondary,
      staffId,
      serviceId,
    })
    const review = await insertReview(db, {
      bookingId: visit.id,
      salonId,
      customerId: secondary,
    })

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toMatchObject({
      type: 'success',
      data: {
        type: 'merged',
        customer: {
          visitCount: 2,
          cancellationCount: 1,
          firstVisitDate: '2026-12-01',
          lastVisitDate: '2026-12-07',
        },
      },
    })
    expect(await customerOf(secondary)).toMatchObject({
      visitCount: 0,
      cancellationCount: 0,
      firstVisitDate: null,
      lastVisitDate: null,
    })
    expect(
      await db
        .select({ customerId: bookings.customerId })
        .from(bookings)
        .where(eq(bookings.salonId, salonId)),
    ).toEqual(Array.from({ length: 3 }, () => ({ customerId: primary })))
    expect(
      await db
        .select({ customerId: sales.customerId })
        .from(sales)
        .where(eq(sales.id, sale.id)),
    ).toEqual([{ customerId: primary }])
    expect(
      await db
        .select({ customerId: treatmentRecords.customerId })
        .from(treatmentRecords)
        .where(eq(treatmentRecords.id, record.id)),
    ).toEqual([{ customerId: primary }])
    expect(
      await db
        .select({ customerId: reviews.customerId })
        .from(reviews)
        .where(eq(reviews.id, review.id)),
    ).toEqual([{ customerId: primary }])
  })

  it('should keep one mark of a review, none on a review of their own, and count the marks again', async () => {
    // Arrange
    const db = databases.database()
    const { salonId, staffId } = await storedSalon()
    const [primary, secondary] = await storedPair()
    const other = await storedCustomer()
    const reviewOf = async (customerId: string, helpfulCount: number) => {
      const booking = await insertBooking(
        db,
        { salonId, customerId, staffId },
        COMPLETED,
      )
      return (
        await insertReview(
          db,
          { bookingId: booking.id, salonId, customerId },
          { helpfulCount },
        )
      ).id
    }
    const primarysOwn = await reviewOf(primary, 1)
    const secondarysOwn = await reviewOf(secondary, 1)
    const markedByBoth = await reviewOf(other, 2)
    const markedBySecondary = await reviewOf(other, 1)
    await insertHelpfulVote(db, primarysOwn, secondary)
    await insertHelpfulVote(db, secondarysOwn, primary)
    await insertHelpfulVote(db, markedByBoth, primary)
    await insertHelpfulVote(db, markedByBoth, secondary)
    await insertHelpfulVote(db, markedBySecondary, secondary)

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toMatchObject({ type: 'success', data: { type: 'merged' } })
    expect(
      (
        await db
          .select({ id: reviews.id, helpfulCount: reviews.helpfulCount })
          .from(reviews)
          .where(eq(reviews.salonId, salonId))
      ).toSorted((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(
      [
        { id: primarysOwn, helpfulCount: 0 },
        { id: secondarysOwn, helpfulCount: 0 },
        { id: markedByBoth, helpfulCount: 1 },
        { id: markedBySecondary, helpfulCount: 1 },
      ].toSorted((a, b) => a.id.localeCompare(b.id)),
    )
    expect(
      (
        await db
          .select({ reviewId: reviewHelpfulVotes.reviewId })
          .from(reviewHelpfulVotes)
          .where(inArray(reviewHelpfulVotes.customerId, [primary, secondary]))
      )
        .map(({ reviewId }) => reviewId)
        .toSorted(),
    ).toEqual([markedByBoth, markedBySecondary].toSorted())
  })
})

describe('CustomerRepository.merge: the points', () => {
  /** The point transactions of the customer, the first written first. */
  const transactionsOf = (customerId: string) =>
    databases
      .database()
      .select({
        transactionType: customerPoints.transactionType,
        points: customerPoints.points,
        balance: customerPoints.balance,
        referenceId: customerPoints.referenceId,
        expiryDate: customerPoints.expiryDate,
      })
      .from(customerPoints)
      .where(eq(customerPoints.customerId, customerId))
      .orderBy(asc(customerPoints.createdAt), asc(customerPoints.id))

  it('should transfer what is left of each earning of the secondary, with its expiry date', async () => {
    // Arrange
    const db = databases.database()
    const [primary, secondary] = await storedPair(
      { loyaltyPoints: 30 },
      { loyaltyPoints: 120 },
    )
    await insertPoints(db, primary, { points: 30, balance: 30 })
    await insertPoints(db, secondary, { expiryDate: '2027-06-30' })
    await insertPoints(db, secondary, {
      points: 50,
      balance: 150,
      expiryDate: '2027-12-31',
    })
    await insertPoints(db, secondary, {
      transactionType: 'used',
      points: -30,
      balance: 120,
    })

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toMatchObject({
      type: 'success',
      data: { type: 'merged', customer: { loyaltyPoints: 150 } },
    })
    expect(await customerOf(secondary)).toMatchObject({ loyaltyPoints: 0 })
    expect(await transactionsOf(primary)).toEqual([
      {
        transactionType: 'earned',
        points: 30,
        balance: 30,
        referenceId: null,
        expiryDate: null,
      },
      {
        transactionType: 'transferred',
        points: 70,
        balance: 100,
        referenceId: secondary,
        expiryDate: '2027-06-30',
      },
      {
        transactionType: 'transferred',
        points: 50,
        balance: 150,
        referenceId: secondary,
        expiryDate: '2027-12-31',
      },
    ])
    expect((await transactionsOf(secondary)).at(-1)).toEqual({
      transactionType: 'transferred',
      points: -120,
      balance: 0,
      referenceId: primary,
      expiryDate: null,
    })
  })

  it('should merge none when the primary would have more points than a balance holds', async () => {
    // Arrange
    const [primary, secondary] = await storedPair(
      { loyaltyPoints: MAX_INTEGER },
      { loyaltyPoints: 1 },
    )
    await insertPoints(databases.database(), secondary, {
      points: 1,
      balance: 1,
    })

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toEqual({
      type: 'success',
      data: { type: 'pointsBeyondLimit' },
    })
    expect(await customerOf(secondary)).toMatchObject({ deletedAt: null })
  })
})

describe('CustomerRepository.merge: the preferences, the chart and the allergies', () => {
  /** What the preferences of the customer ask for, and how many rows they have. */
  const requestsOf = async (customerId: string) =>
    (
      await databases
        .database()
        .select({ specialRequests: customerPreferences.specialRequests })
        .from(customerPreferences)
        .where(eq(customerPreferences.customerId, customerId))
    ).map(({ specialRequests }) => specialRequests)

  it.each<
    [
      string,
      CustomerMergeConflictResolution,
      string | null,
      string | null,
      string,
      string[],
    ]
  >([
    [
      'only the primary has them',
      'keep_secondary',
      '香りの弱いものを',
      null,
      '2026-11-01T00:00:00Z',
      ['香りの弱いものを'],
    ],
    [
      'only the secondary has them',
      'keep_primary',
      null,
      '短めに',
      '2026-11-01T00:00:00Z',
      ['短めに'],
    ],
    [
      'both have them, with keep_primary',
      'keep_primary',
      '香りの弱いものを',
      '短めに',
      '2026-11-02T00:00:00Z',
      ['香りの弱いものを'],
    ],
    [
      'both have them, with keep_secondary',
      'keep_secondary',
      '香りの弱いものを',
      '短めに',
      '2026-11-01T00:00:00Z',
      ['短めに'],
    ],
    [
      'the secondary wrote them later, with keep_newest',
      'keep_newest',
      '香りの弱いものを',
      '短めに',
      '2026-11-02T00:00:00Z',
      ['短めに'],
    ],
    [
      'both wrote them at the same moment, with keep_newest',
      'keep_newest',
      '香りの弱いものを',
      '短めに',
      '2026-11-01T00:00:00Z',
      ['香りの弱いものを'],
    ],
  ])(
    'should give the primary one row of preferences when %s',
    async (_, resolution, ofPrimary, ofSecondary, secondaryWritten, kept) => {
      // Arrange
      const db = databases.database()
      const [primary, secondary] = await storedPair()
      if (ofPrimary !== null) {
        await insertPreferences(db, primary, {
          specialRequests: ofPrimary,
          updatedAt: '2026-11-01T00:00:00Z',
        })
      }
      if (ofSecondary !== null) {
        await insertPreferences(db, secondary, {
          specialRequests: ofSecondary,
          updatedAt: secondaryWritten,
        })
      }

      // Act
      const result = await merged(primary, secondary, resolution)

      // Assert
      expect(result).toMatchObject({
        type: 'success',
        data: { type: 'merged' },
      })
      expect(await requestsOf(primary)).toEqual(kept)
    },
  )

  it.each<[string, boolean]>([
    ['the primary', true],
    ['the secondary', false],
  ])(
    'should give the primary the chart when only %s has one',
    async (_, ofPrimary) => {
      // Arrange
      const [primary, secondary] = await storedPair()
      const chart = await insertChart(
        databases.database(),
        ofPrimary ? primary : secondary,
        { notes: '頭皮が乾燥しやすい' },
      )

      // Act
      const result = await merged(primary, secondary)

      // Assert
      expect(result).toMatchObject({
        type: 'success',
        data: { type: 'merged' },
      })
      expect(
        await databases
          .database()
          .select({ id: medicalCharts.id, notes: medicalCharts.notes })
          .from(medicalCharts)
          .where(eq(medicalCharts.customerId, primary)),
      ).toEqual([{ id: chart.id, notes: '頭皮が乾燥しやすい' }])
    },
  )

  it('should put the two charts together, the primary first, and drop nothing', async () => {
    // Arrange
    const db = databases.database()
    const [primary, secondary] = await storedPair()
    const cut = {
      treatment: 'cut',
      date: '2026-10-01',
      salonName: null,
      notes: null,
    }
    const color = {
      treatment: 'color',
      date: '2026-09-01',
      salonName: '別のサロン',
      notes: '明るめ',
    }
    await insertChart(db, primary, {
      previousTreatments: [cut],
      preferredProducts: ['オイル'],
      medicalConditions: '頭皮が乾燥しやすい',
      notes: '静かな席を希望',
    })
    await insertChart(db, secondary, {
      previousTreatments: [cut, color],
      preferredProducts: ['オイル', 'ミスト'],
      avoidProducts: ['スプレー'],
      medicalConditions: '敏感肌',
      notes: '静かな席を希望',
    })

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toMatchObject({ type: 'success', data: { type: 'merged' } })
    expect(
      await db
        .select({
          previousTreatments: medicalCharts.previousTreatments,
          preferredProducts: medicalCharts.preferredProducts,
          avoidProducts: medicalCharts.avoidProducts,
          medicalConditions: medicalCharts.medicalConditions,
          notes: medicalCharts.notes,
        })
        .from(medicalCharts)
        .where(eq(medicalCharts.customerId, primary)),
    ).toEqual([
      {
        previousTreatments: [cut, color],
        preferredProducts: ['オイル', 'ミスト'],
        avoidProducts: ['スプレー'],
        medicalConditions: '頭皮が乾燥しやすい\n\n敏感肌',
        notes: '静かな席を希望',
      },
    ])
  })

  it('should merge none when the two charts list more treatments together than a chart holds', async () => {
    // Arrange
    const db = databases.database()
    const [primary, secondary] = await storedPair()
    const treatmentsOn = (month: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        treatment: 'cut',
        date: `2026-${month}-${String(index + 1).padStart(2, '0')}`,
        salonName: null,
        notes: null,
      }))
    await insertChart(db, primary, {
      previousTreatments: treatmentsOn('07', 26),
    })
    await insertChart(db, secondary, {
      previousTreatments: treatmentsOn('08', 25),
    })

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toEqual({
      type: 'success',
      data: { type: 'chartTooLong', list: 'previousTreatments' },
    })
    expect(await customerOf(secondary)).toMatchObject({ deletedAt: null })
  })

  it('should answer a database error when a stored chart does not match the API model', async () => {
    // Arrange
    const db = databases.database()
    const [primary, secondary] = await storedPair()
    const chart = await insertChart(db, primary, {
      previousTreatments: [{ treatment: 'massage' }],
    })
    await insertChart(db, secondary)

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored medical chart ${chart.id} does not match the API model`,
      },
    })
  })

  it('should keep the severer record of an allergen both have, and move the others', async () => {
    // Arrange
    const db = databases.database()
    const [primary, secondary] = await storedPair()
    const diamine = await insertAllergy(db, primary, {
      allergenName: 'ジアミン',
      severityType: 'moderate',
    })
    const paraben = await insertAllergy(db, primary, {
      allergenName: 'パラベン',
      severityType: 'severe',
      symptoms: 'かゆみ',
    })
    await insertAllergy(db, secondary, {
      allergenName: 'ジアミン',
      severityType: 'severe',
      symptoms: '腫れ',
    })
    await insertAllergy(db, secondary, {
      allergenName: 'パラベン',
      severityType: 'mild',
    })
    const latex = await insertAllergy(db, secondary, {
      allergyType: 'other',
      allergenName: 'ラテックス',
      severityType: 'mild',
    })

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toMatchObject({ type: 'success', data: { type: 'merged' } })
    expect(
      (
        await db
          .select({
            id: customerAllergies.id,
            allergenName: customerAllergies.allergenName,
            severityType: customerAllergies.severityType,
            symptoms: customerAllergies.symptoms,
          })
          .from(customerAllergies)
          .where(eq(customerAllergies.customerId, primary))
      ).toSorted((a, b) => a.allergenName.localeCompare(b.allergenName)),
    ).toEqual(
      [
        {
          id: diamine.id,
          allergenName: 'ジアミン',
          severityType: 'severe',
          symptoms: '腫れ',
        },
        {
          id: paraben.id,
          allergenName: 'パラベン',
          severityType: 'severe',
          symptoms: 'かゆみ',
        },
        {
          id: latex.id,
          allergenName: 'ラテックス',
          severityType: 'mild',
          symptoms: null,
        },
      ].toSorted((a, b) => a.allergenName.localeCompare(b.allergenName)),
    )
  })
})

describe('CustomerRepository.merge: the refusals', () => {
  it.each<[string, () => Promise<[CustomerId, CustomerId]>, string[]]>([
    [
      'the primary is deleted',
      async () => [
        await storedCustomer({ deletedAt: DELETED_AT }),
        await storedCustomer(),
      ],
      ['primaryCustomerId'],
    ],
    [
      'the secondary is none',
      async () => [await storedCustomer(), customerIdSchema.parse(UNKNOWN_ID)],
      ['secondaryCustomerId'],
    ],
    [
      'neither is a customer',
      async () => [
        customerIdSchema.parse(UNKNOWN_ID),
        await storedCustomer({ deletedAt: DELETED_AT }),
      ],
      ['primaryCustomerId', 'secondaryCustomerId'],
    ],
  ])('should merge none when %s', async (_, arrange, missing) => {
    // Arrange
    const [primary, secondary] = await arrange()

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toEqual({
      type: 'success',
      data: { type: 'customersNotFound', missing },
    })
  })

  it('should merge no two customers who each have an account', async () => {
    // Arrange
    const db = databases.database()
    const [primary, secondary] = await storedPair(
      { userId: (await insertUser(db, { role: 'customer' })).id },
      { userId: (await insertUser(db, { role: 'customer' })).id },
    )

    // Act
    const result = await merged(primary, secondary)

    // Assert
    expect(result).toEqual({
      type: 'success',
      data: { type: 'accountsDiffer' },
    })
    expect(await customerOf(secondary)).toMatchObject({ deletedAt: null })
  })

  it.each<[string, boolean, boolean]>([
    ['the primary', true, false],
    ['the secondary', false, true],
    ['both', true, true],
  ])(
    'should merge none when %s asked to have their data erased',
    async (_, ofPrimary, ofSecondary) => {
      // Arrange
      const db = databases.database()
      const editor = await storedEditor()
      const [primary, secondary] = await storedPair()
      const pending = [
        ...(ofPrimary ? [primary] : []),
        ...(ofSecondary ? [secondary] : []),
      ]
      for (const customerId of pending.toReversed()) {
        await insertDeletionRequest(db, customerId, editor)
      }
      await insertDeletionRequest(db, secondary, editor, {
        requestedAt: '2025-12-01T03:00:00Z',
        scheduledAt: '2025-12-15T03:00:00Z',
        status: 'cancelled',
        cancelledBy: editor,
        cancelledAt: '2025-12-02T03:00:00Z',
      })

      // Act
      const result = await repository().merge(
        mergeOf(primary, secondary),
        editor,
      )

      // Assert
      expect(result).toEqual({
        type: 'success',
        data: { type: 'deletionRequested', customers: pending },
      })
    },
  )

  it('should merge in spite of a request to erase the data that was cancelled', async () => {
    // Arrange
    const editor = await storedEditor()
    const [primary, secondary] = await storedPair()
    await insertDeletionRequest(databases.database(), secondary, editor, {
      status: 'cancelled',
      cancelledBy: editor,
      cancelledAt: '2026-01-06T03:00:00Z',
    })

    // Act
    const result = await repository().merge(mergeOf(primary, secondary), editor)

    // Assert
    expect(result).toMatchObject({ type: 'success', data: { type: 'merged' } })
  })
})
