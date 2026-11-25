import { users } from '@beauty-salon-backend/database'
import {
  type CustomerId,
  customerIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { recordVersions } from '../_shared/customer-version-record'
import { CustomerRepository } from '../customer.repository.impl'
import {
  COMPLETED,
  insertAllergy,
  insertBooking,
  insertBookingLine,
  insertChart,
  insertCustomer,
  insertHelpfulVote,
  insertPayment,
  insertPaymentMethod,
  insertPoints,
  insertPreferences,
  insertProduct,
  insertReview,
  insertSale,
  insertSaleLine,
  insertSalon,
  insertService,
  insertStaffMember,
  insertTreatmentMaterial,
  insertTreatmentPhoto,
  insertTreatmentRecord,
  insertUser,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new CustomerRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** The moment of the day of November, at which a row was written. */
const onNovember = (day: number) =>
  `2026-11-${String(day).padStart(2, '0')}T03:00:00Z`

describe('CustomerRepository.dataOf', () => {
  it('should hold everything held of the customer, each list in the order its rows were written', async () => {
    // Arrange
    const db = databases.database()
    const { id: salonId } = await insertSalon(db)
    const { id: staffId } = await insertStaffMember(db, salonId)
    const { id: serviceId } = await insertService(db, salonId)
    const account = await insertUser(db, { role: 'customer' })
    const customer = await insertCustomer(db, { userId: account.id })
    const customerId = customerIdSchema.parse(customer.id)
    await db.update(users).set({ customerId }).where(eq(users.id, account.id))
    const other = await insertCustomer(db)
    const parties = { salonId, customerId, staffId }

    await insertPreferences(db, customerId, {
      specialRequests: '香りの弱いものを',
    })
    const chart = await insertChart(db, customerId, {
      notes: '頭皮が乾燥しやすい',
    })
    const laterAllergy = await insertAllergy(db, customerId, {
      allergenName: 'パラベン',
      createdAt: onNovember(2),
    })
    const earlierAllergy = await insertAllergy(db, customerId, {
      createdAt: onNovember(1),
    })
    await insertAllergy(db, other.id)

    const laterBooking = await insertBooking(db, parties, {
      ...COMPLETED,
      createdAt: onNovember(2),
    })
    const secondLine = await insertBookingLine(db, laterBooking.id, serviceId, {
      sortOrder: 1,
    })
    const firstLine = await insertBookingLine(db, laterBooking.id, serviceId)
    const earlierBooking = await insertBooking(db, parties, {
      ...COMPLETED,
      createdAt: onNovember(1),
    })
    await insertBooking(db, { ...parties, customerId: other.id })

    const { id: methodId } = await insertPaymentMethod(db, salonId)
    const laterSale = await insertSale(
      db,
      { salonId, customerId },
      { createdAt: onNovember(2) },
    )
    const saleLine = await insertSaleLine(db, laterSale.id)
    const payment = await insertPayment(db, laterSale.id, methodId)
    const earlierSale = await insertSale(
      db,
      { salonId, customerId },
      { createdAt: onNovember(1) },
    )
    await insertSale(db, { salonId, customerId: other.id })

    const earned = await insertPoints(db, customerId, {
      createdAt: onNovember(1),
    })
    const used = await insertPoints(db, customerId, {
      transactionType: 'used',
      points: -40,
      balance: 60,
      createdAt: onNovember(2),
    })

    const review = await insertReview(db, {
      bookingId: earlierBooking.id,
      salonId,
      customerId,
    })
    const reviewOfOther = async () => {
      const booking = await insertBooking(
        db,
        { ...parties, customerId: other.id },
        COMPLETED,
      )
      return (
        await insertReview(db, {
          bookingId: booking.id,
          salonId,
          customerId: other.id,
        })
      ).id
    }
    const markedLater = await reviewOfOther()
    const markedEarlier = await reviewOfOther()
    await insertHelpfulVote(db, markedLater, customerId, {
      createdAt: onNovember(2),
    })
    await insertHelpfulVote(db, markedEarlier, customerId, {
      createdAt: onNovember(1),
    })
    await insertHelpfulVote(db, review.id, other.id)

    const laterRecord = await insertTreatmentRecord(
      db,
      { bookingId: laterBooking.id, customerId, staffId, serviceId },
      { createdAt: onNovember(2) },
    )
    const { id: productId } = await insertProduct(db, salonId)
    const material = await insertTreatmentMaterial(
      db,
      laterRecord.id,
      productId,
    )
    const photo = await insertTreatmentPhoto(db, laterRecord.id)
    const earlierRecord = await insertTreatmentRecord(
      db,
      { bookingId: earlierBooking.id, customerId, staffId, serviceId },
      { createdAt: onNovember(1) },
    )

    const editor = userIdSchema.parse(
      (await insertUser(db, { role: 'staff' })).id,
    )
    await recordVersions(db, [customer], 'create', editor)
    await recordVersions(db, [customer], 'update', editor)

    // Act
    const found = await repository().dataOf(customerId)

    // Assert
    // toMatchObject matches an array whole: each list has the length written here.
    expect(found).toMatchObject({
      type: 'success',
      data: {
        customer: { id: customerId },
        account: { id: account.id },
        preferences: { specialRequests: '香りの弱いものを' },
        medicalChart: { id: chart.id },
        allergies: [{ id: earlierAllergy.id }, { id: laterAllergy.id }],
        bookings: [
          { booking: { id: earlierBooking.id }, services: [] },
          {
            booking: { id: laterBooking.id },
            services: [{ id: firstLine.id }, { id: secondLine.id }],
          },
        ],
        sales: [
          { sale: { id: earlierSale.id }, details: [], payments: [] },
          {
            sale: { id: laterSale.id },
            details: [{ id: saleLine.id }],
            payments: [{ id: payment.id }],
          },
        ],
        pointTransactions: [{ id: earned.id }, { id: used.id }],
        reviews: [{ id: review.id }],
        helpfulReviewIds: [markedEarlier, markedLater],
        treatmentRecords: [
          { record: { id: earlierRecord.id }, materials: [], photos: [] },
          {
            record: { id: laterRecord.id },
            materials: [{ id: material.id }],
            photos: [{ id: photo.id }],
          },
        ],
        versions: [
          { version: 1, operation: 'create' },
          { version: 2, operation: 'update' },
        ],
      },
    })
  })

  it('should hold no account, preferences or chart of a customer who has none', async () => {
    // Arrange
    const customerId = customerIdSchema.parse(
      (await insertCustomer(databases.database())).id,
    )

    // Act
    const found = await repository().dataOf(customerId)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: {
        account: null,
        preferences: null,
        medicalChart: null,
        allergies: [],
        bookings: [],
        sales: [],
        pointTransactions: [],
        reviews: [],
        helpfulReviewIds: [],
        treatmentRecords: [],
        versions: [],
      },
    })
  })

  it('should hold no account when the account the customer names is none', async () => {
    // Arrange
    const customerId = customerIdSchema.parse(
      (
        await insertCustomer(databases.database(), {
          userId: UNKNOWN_ID,
        })
      ).id,
    )

    // Act
    const found = await repository().dataOf(customerId)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { customer: { userId: UNKNOWN_ID }, account: null },
    })
  })

  it.each<[string, () => Promise<CustomerId>]>([
    [
      'who is deleted',
      async () =>
        customerIdSchema.parse(
          (
            await insertCustomer(databases.database(), {
              deletedAt: DELETED_AT,
            })
          ).id,
        ),
    ],
    [
      'of an ID that names none',
      async () => customerIdSchema.parse(UNKNOWN_ID),
    ],
  ])('should hold nothing of a customer %s', async (_, arrange) => {
    // Arrange
    const customerId = await arrange()

    // Act
    const found = await repository().dataOf(customerId)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})
