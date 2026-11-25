import { paymentTransactions, sales } from '@beauty-salon-backend/database'
import {
  type LedgerReach,
  type PaymentOrigin,
  paymentIdSchema,
  paymentMethodIdSchema,
  type RequestedPayment,
  saleIdSchema,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { PaymentRepository } from '../payment.repository.impl'
import {
  insertPayment,
  insertPaymentMethod,
  insertSale,
  insertSalon,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new PaymentRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const ofSalon = (salonId: string): LedgerReach => ({
  type: 'salon',
  salonId: salonIdSchema.parse(salonId),
})

/** A sale of 6,600 yen that is not paid yet, with the cash of its salon. */
const storedSale = async (
  overrides: Partial<typeof sales.$inferInsert> = {},
) => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const sale = await insertSale(
    db,
    { salonId: salon.id, customerId: null },
    overrides,
  )
  const cash = await insertPaymentMethod(db, salon.id)
  return {
    salonId: salon.id,
    saleId: saleIdSchema.parse(sale.id),
    cashId: paymentMethodIdSchema.parse(cash.id),
  }
}

type StoredSale = Awaited<ReturnType<typeof storedSale>>

/** A payment in cash of the amount. */
const paymentOf = (
  { cashId }: StoredSale,
  amount: number,
): RequestedPayment => ({
  paymentMethodId: cashId,
  amount,
  cardLastFour: null,
  cardBrand: null,
})

let issued = 0

const originOf = (transactionNumber?: string): PaymentOrigin => {
  issued += 1
  return {
    transactionNumber:
      transactionNumber ?? `TX-REPO-${String(issued).padStart(4, '0')}`,
  }
}

const paymentStatusOf = async (saleId: string) => {
  const [sale] = await databases
    .database()
    .select({ paymentStatus: sales.paymentStatus })
    .from(sales)
    .where(eq(sales.id, saleId))
  return sale?.paymentStatus
}

const paymentsOf = (saleId: string) =>
  databases
    .database()
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.saleId, saleId))

describe('PaymentRepository.record', () => {
  it('should write the payment, received at the moment it is written, and the payment status it leaves the sale with', async () => {
    // Arrange
    const sale = await storedSale()
    const other = await storedSale()
    await insertPayment(databases.database(), other.saleId, other.cashId)

    // Act
    const recorded = await repository().record(
      sale.saleId,
      EVERY_SALON,
      paymentOf(sale, 2600),
      originOf('TX-REPO-CASH'),
    )

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: {
        type: 'recorded',
        payment: {
          saleId: sale.saleId,
          paymentMethodId: sale.cashId,
          transactionNumber: 'TX-REPO-CASH',
          amount: 2600,
          status: 'completed',
          refundAmount: null,
        },
      },
    })
    const [payment] = await paymentsOf(sale.saleId)
    expect(payment?.processedAt).toBe(payment?.createdAt)
    expect(payment?.updatedAt).toBe(payment?.createdAt)
    expect(await paymentStatusOf(sale.saleId)).toBe('processing')
    expect(await paymentStatusOf(other.saleId)).toBe('pending')
  })

  it('should leave the sale paid when the payment makes up its total', async () => {
    // Arrange
    const sale = await storedSale()
    await insertPayment(databases.database(), sale.saleId, sale.cashId, {
      amount: 4000,
    })

    // Act
    const recorded = await repository().record(
      sale.saleId,
      ofSalon(sale.salonId),
      paymentOf(sale, 2600),
      originOf(),
    )

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: { type: 'recorded' },
    })
    expect(await paymentStatusOf(sale.saleId)).toBe('completed')
  })

  it('should count what was received from the payments, not from the payment status the sale shows', async () => {
    // Arrange
    const sale = await storedSale({ paymentStatus: 'completed' })

    // Act
    const recorded = await repository().record(
      sale.saleId,
      EVERY_SALON,
      paymentOf(sale, 6600),
      originOf(),
    )

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: { type: 'recorded' },
    })
    expect(await paymentsOf(sale.saleId)).toHaveLength(1)
  })

  it('should write no payment of more than is left to pay', async () => {
    // Arrange
    const sale = await storedSale()
    await insertPayment(databases.database(), sale.saleId, sale.cashId, {
      amount: 4000,
    })

    // Act
    const recorded = await repository().record(
      sale.saleId,
      EVERY_SALON,
      paymentOf(sale, 2601),
      originOf(),
    )

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'amount' }] },
    })
    expect(await paymentsOf(sale.saleId)).toHaveLength(1)
  })

  it.each<[string, (sale: StoredSale) => Promise<string>]>([
    [
      'a payment method of another salon',
      async () =>
        (
          await insertPaymentMethod(
            databases.database(),
            (
              await insertSalon(databases.database())
            ).id,
          )
        ).id,
    ],
    [
      'a payment method that is not active',
      async ({ salonId }) =>
        (
          await insertPaymentMethod(databases.database(), salonId, {
            isActive: false,
          })
        ).id,
    ],
    ['an ID that names no payment method', async () => UNKNOWN_ID],
  ])('should write no payment with %s', async (_case, methodOf) => {
    // Arrange
    const sale = await storedSale()
    const paymentMethodId = paymentMethodIdSchema.parse(await methodOf(sale))

    // Act
    const recorded = await repository().record(
      sale.saleId,
      EVERY_SALON,
      { ...paymentOf(sale, 1000), paymentMethodId },
      originOf(),
    )

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'paymentMethodId' }] },
    })
  })

  it('should write no payment of a sale that is void', async () => {
    // Arrange
    const sale = await storedSale({
      isVoid: true,
      voidedAt: '2026-12-07T03:00:00Z',
    })

    // Act
    const recorded = await repository().record(
      sale.saleId,
      EVERY_SALON,
      paymentOf(sale, 1000),
      originOf(),
    )

    // Assert
    expect(recorded).toEqual({ type: 'success', data: { type: 'void' } })
  })

  it('should write no payment of a sale whose payment was refunded', async () => {
    // Arrange
    const sale = await storedSale()
    await insertPayment(databases.database(), sale.saleId, sale.cashId, {
      amount: 2000,
      status: 'partial_refund',
      refundAmount: 500,
      refundedAt: '2026-12-07T03:00:00Z',
    })

    // Act
    const recorded = await repository().record(
      sale.saleId,
      EVERY_SALON,
      paymentOf(sale, 1000),
      originOf(),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'refundMade' },
    })
  })

  it('should read the payment another request recorded while this one waited for the sale', async () => {
    // Arrange
    const sale = await storedSale()

    // Act
    const recorded = await databases.whileHeld(
      (held) => held`select id from sales where id = ${sale.saleId} for update`,
      (held) =>
        held`insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber", amount, status, "processedAt") values (${sale.saleId}, ${sale.cashId}, 'TX-REPO-HELD', 6600, 'completed', '2026-12-07T02:00:00Z')`,
      () =>
        repository().record(
          sale.saleId,
          EVERY_SALON,
          paymentOf(sale, 1000),
          originOf(),
        ),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'nothingLeft' },
    })
  })

  it('should write nothing when another payment has the transaction number', async () => {
    // Arrange
    const sale = await storedSale()
    await insertPayment(databases.database(), sale.saleId, sale.cashId, {
      amount: 1000,
      transactionNumber: 'TX-REPO-TAKEN',
    })

    // Act
    const recorded = await repository().record(
      sale.saleId,
      EVERY_SALON,
      paymentOf(sale, 1000),
      originOf('TX-REPO-TAKEN'),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'transactionNumberTaken' },
    })
    expect(await paymentStatusOf(sale.saleId)).toBe('pending')
  })

  it.each<
    [string, (sale: StoredSale) => { saleId: string; reach: LedgerReach }]
  >([
    [
      'a reader of another salon',
      ({ saleId }) => ({ saleId, reach: ofSalon(UNKNOWN_ID) }),
    ],
    [
      'an ID that names no sale',
      () => ({ saleId: UNKNOWN_ID, reach: EVERY_SALON }),
    ],
  ])('should find no sale for %s', async (_case, targetOf) => {
    // Arrange
    const sale = await storedSale()
    const { saleId, reach } = targetOf(sale)

    // Act
    const recorded = await repository().record(
      saleIdSchema.parse(saleId),
      reach,
      paymentOf(sale, 1000),
      originOf(),
    )

    // Assert
    expect(recorded).toEqual({ type: 'success', data: { type: 'notFound' } })
    expect(await paymentsOf(sale.saleId)).toEqual([])
  })
})

describe('PaymentRepository.refund', () => {
  /** A sale and a payment of it, received unless the test says otherwise. */
  const storedPayment = async (
    overrides: Partial<typeof paymentTransactions.$inferInsert> = {},
  ) => {
    const sale = await storedSale()
    const payment = await insertPayment(
      databases.database(),
      sale.saleId,
      sale.cashId,
      overrides,
    )
    return { ...sale, paymentId: paymentIdSchema.parse(payment.id) }
  }

  const refundOf = (refundAmount: number) => ({
    refundAmount,
    refundReason: null,
  })

  it('should give back part of the payment, and leave the sale refunded in part', async () => {
    // Arrange
    const payment = await storedPayment()
    const other = await storedPayment()

    // Act
    const refunded = await repository().refund(
      payment.paymentId,
      ofSalon(payment.salonId),
      { refundAmount: 1000, refundReason: '仕上がりの不満' },
    )

    // Assert
    expect(refunded).toMatchObject({
      type: 'success',
      data: {
        type: 'refunded',
        payment: {
          id: payment.paymentId,
          status: 'partial_refund',
          refundAmount: 1000,
          refundReason: '仕上がりの不満',
        },
      },
    })
    const [stored] = await paymentsOf(payment.saleId)
    expect(stored?.refundedAt).not.toBeNull()
    expect(await paymentStatusOf(payment.saleId)).toBe('partial_refund')
    expect(await paymentsOf(other.saleId)).toMatchObject([
      { status: 'completed', refundAmount: null },
    ])
    expect(await paymentStatusOf(other.saleId)).toBe('pending')
  })

  it('should give back all of the payment, and leave the sale refunded', async () => {
    // Arrange
    const payment = await storedPayment()

    // Act
    const refunded = await repository().refund(
      payment.paymentId,
      EVERY_SALON,
      refundOf(6600),
    )

    // Assert
    expect(refunded).toMatchObject({
      type: 'success',
      data: { type: 'refunded', payment: { status: 'refunded' } },
    })
    expect(await paymentStatusOf(payment.saleId)).toBe('refunded')
  })

  it('should count the other payments of the sale, also one recorded while the refund waited for the sale', async () => {
    // Arrange
    const payment = await storedPayment({ amount: 3300 })

    // Act
    const refunded = await databases.whileHeld(
      (held) =>
        held`select id from sales where id = ${payment.saleId} for update`,
      (held) =>
        held`insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber", amount, status, "processedAt") values (${payment.saleId}, ${payment.cashId}, 'TX-REPO-HELD', 3300, 'completed', '2026-12-07T02:00:00Z')`,
      () => repository().refund(payment.paymentId, EVERY_SALON, refundOf(3300)),
    )

    // Assert
    expect(refunded).toMatchObject({
      type: 'success',
      data: { type: 'refunded', payment: { status: 'refunded' } },
    })
    expect(await paymentStatusOf(payment.saleId)).toBe('partial_refund')
  })

  it('should read what a refund of the payment committed while this one waited for it', async () => {
    // Arrange
    const payment = await storedPayment()

    // Act
    const refunded = await databases.whileHeld(
      (held) =>
        held`select sales.id from sales join payment_transactions on payment_transactions."saleId" = sales.id where payment_transactions.id = ${payment.paymentId} for update of sales, payment_transactions`,
      (held) =>
        held`update payment_transactions set status = 'refunded', "refundAmount" = amount, "refundedAt" = now() where id = ${payment.paymentId}`,
      () => repository().refund(payment.paymentId, EVERY_SALON, refundOf(1000)),
    )

    // Assert
    expect(refunded).toEqual({
      type: 'success',
      data: { type: 'notCompleted' },
    })
    expect(await paymentsOf(payment.saleId)).toMatchObject([
      { status: 'refunded', refundAmount: 6600 },
    ])
  })

  it.each<[string, Partial<typeof paymentTransactions.$inferInsert>]>([
    ['is pending', { status: 'pending', processedAt: null }],
    [
      'was refunded',
      {
        status: 'refunded',
        refundAmount: 6600,
        refundedAt: '2026-12-07T03:00:00Z',
      },
    ],
  ])(
    'should give back nothing of a payment that %s',
    async (_case, overrides) => {
      // Arrange
      const payment = await storedPayment(overrides)

      // Act
      const refunded = await repository().refund(
        payment.paymentId,
        EVERY_SALON,
        refundOf(1000),
      )

      // Assert
      expect(refunded).toEqual({
        type: 'success',
        data: { type: 'notCompleted' },
      })
    },
  )

  it('should give back no more than the payment received', async () => {
    // Arrange
    const payment = await storedPayment()

    // Act
    const refunded = await repository().refund(
      payment.paymentId,
      EVERY_SALON,
      refundOf(6601),
    )

    // Assert
    expect(refunded).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'refundAmount' }] },
    })
    expect(await paymentsOf(payment.saleId)).toMatchObject([
      { status: 'completed', refundAmount: null },
    ])
  })

  it.each<[string, () => Promise<{ id: string; reach: LedgerReach }>]>([
    [
      'a payment of a sale of another salon',
      async () => ({
        id: (await storedPayment()).paymentId,
        reach: ofSalon(UNKNOWN_ID),
      }),
    ],
    [
      'an ID that names no payment',
      async () => ({ id: UNKNOWN_ID, reach: EVERY_SALON }),
    ],
  ])('should find no payment for %s', async (_case, targetOf) => {
    // Arrange
    const { id, reach } = await targetOf()

    // Act
    const refunded = await repository().refund(
      paymentIdSchema.parse(id),
      reach,
      refundOf(1000),
    )

    // Assert
    expect(refunded).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should answer that the update returned no row when a trigger skips it', async () => {
    // Arrange
    const payment = await storedPayment()
    await databases.skipWrites('payment_transactions', 'UPDATE')

    // Act
    const refunded = await repository().refund(
      payment.paymentId,
      EVERY_SALON,
      refundOf(1000),
    )

    // Assert
    expect(refunded).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of refunded payment returned no row',
        cause: null,
      },
    })
    expect(await paymentStatusOf(payment.saleId)).toBe('pending')
  })
})

describe('PaymentRepository when the database is gone', () => {
  it.each<[string, (gone: PaymentRepository) => Promise<unknown>]>([
    [
      'Failed to record payment',
      (gone) =>
        gone.record(
          saleIdSchema.parse(UNKNOWN_ID),
          EVERY_SALON,
          {
            paymentMethodId: paymentMethodIdSchema.parse(UNKNOWN_ID),
            amount: 1000,
            cardLastFour: null,
            cardBrand: null,
          },
          originOf(),
        ),
    ],
    [
      'Failed to refund payment',
      (gone) =>
        gone.refund(paymentIdSchema.parse(UNKNOWN_ID), EVERY_SALON, {
          refundAmount: 1000,
          refundReason: null,
        }),
    ],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new PaymentRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
