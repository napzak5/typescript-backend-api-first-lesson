import { paymentMethods } from '@beauty-salon-backend/database'
import {
  type DbNewPaymentMethod,
  type PaymentMethodListCriteria,
  paymentMethodIdSchema,
  type SalonId,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { PaymentMethodRepository } from '../payment-method.repository.impl'
import {
  insertPayment,
  insertPaymentMethod,
  insertSale,
  insertSalon,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new PaymentMethodRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** A salon in the table, by the ID a repository is given. */
const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

/** A way of paying in the table, of the salon, by the ID a repository is given. */
const storedMethod = async (
  salonId: SalonId,
  overrides: Partial<typeof paymentMethods.$inferInsert> = {},
) => {
  const row = await insertPaymentMethod(
    databases.database(),
    salonId,
    overrides,
  )
  return { ...row, id: paymentMethodIdSchema.parse(row.id) }
}

/** A card taken at the counter up to 100,000 yen, as a create writes it. */
const CARD: DbNewPaymentMethod = {
  method: 'credit_card',
  displayName: 'クレジットカード',
  description: 'VISA、Mastercard',
  processorName: null,
  fee: '3.25',
  minimumAmount: 100,
  maximumAmount: 100000,
  isOnlineEnabled: false,
  isOfflineEnabled: true,
  sortOrder: 2,
  isActive: true,
}

const storedOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.id, id))
  return row
}

describe('PaymentMethodRepository.create', () => {
  it('should write the payment method of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()

    // Act
    const created = await repository().create(salonId, CARD)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { ...CARD, salonId, processorConfig: null },
    })
    expect(
      await databases
        .database()
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.salonId, salonId)),
    ).toMatchObject([CARD])
  })

  it('should answer that the insert returned no row when a trigger skips it', async () => {
    // Arrange
    const salonId = await storedSalon()
    await databases.skipWrites('payment_methods', 'INSERT')

    // Act
    const created = await repository().create(salonId, CARD)

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of payment method returned no row',
        cause: null,
      },
    })
  })
})

describe('PaymentMethodRepository.findById', () => {
  it('should find the payment method of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const method = await storedMethod(salonId)

    // Act
    const found = await repository().findById(salonId, method.id)

    // Assert
    expect(found).toEqual({ type: 'success', data: method })
  })

  it('should find no payment method of another salon', async () => {
    // Arrange
    const method = await storedMethod(await storedSalon())

    // Act
    const found = await repository().findById(await storedSalon(), method.id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })

  it('should find no payment method of an ID that names none', async () => {
    // Arrange
    const salonId = await storedSalon()

    // Act
    const found = await repository().findById(
      salonId,
      paymentMethodIdSchema.parse(UNKNOWN_ID),
    )

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('PaymentMethodRepository.list', () => {
  const criteriaOf = (
    salonId: SalonId,
    overrides: Partial<PaymentMethodListCriteria> = {},
  ): PaymentMethodListCriteria => ({
    salonId,
    limit: 20,
    after: null,
    method: null,
    isActive: null,
    ...overrides,
  })

  const idsOf = (
    listed: Awaited<ReturnType<PaymentMethodRepository['list']>>,
  ): string[] =>
    listed.type === 'success' && listed.data !== null
      ? listed.data.paymentMethods.map(({ id }) => id)
      : []

  it('should list the payment methods of the salon in their order, and those of one order by their IDs', async () => {
    // Arrange
    const salonId = await storedSalon()
    const last = await storedMethod(salonId, { sortOrder: 2 })
    const both = [
      await storedMethod(salonId, { sortOrder: 1, method: 'e_money' }),
      await storedMethod(salonId, { sortOrder: 1, method: 'qr_payment' }),
    ].toSorted((a, b) => a.id.localeCompare(b.id))
    const first = await storedMethod(salonId, { sortOrder: 0 })
    await storedMethod(await storedSalon())

    // Act
    const listed = await repository().list(criteriaOf(salonId))

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { total: 4, hasMore: false },
    })
    expect(idsOf(listed)).toEqual([
      first.id,
      ...both.map(({ id }) => id),
      last.id,
    ])
  })

  it('should list a page at a time, the next one after the payment method of the cursor', async () => {
    // Arrange
    const salonId = await storedSalon()
    const first = await storedMethod(salonId, { sortOrder: 0 })
    const second = await storedMethod(salonId, { sortOrder: 1 })
    const third = await storedMethod(salonId, { sortOrder: 2 })

    // Act
    const page = await repository().list(criteriaOf(salonId, { limit: 2 }))
    const next = await repository().list(
      criteriaOf(salonId, { limit: 2, after: second.id }),
    )

    // Assert
    expect(page).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: true },
    })
    expect(idsOf(page)).toEqual([first.id, second.id])
    expect(next).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: false },
    })
    expect(idsOf(next)).toEqual([third.id])
  })

  it('should say that no page follows a page that is just full', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedMethod(salonId, { sortOrder: 0 })
    await storedMethod(salonId, { sortOrder: 1 })

    // Act
    const listed = await repository().list(criteriaOf(salonId, { limit: 2 }))

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { total: 2, hasMore: false },
    })
  })

  it('should list the payment methods of the method and of the state the filters name, and count them', async () => {
    // Arrange
    const salonId = await storedSalon()
    const taken = await storedMethod(salonId, { method: 'e_money' })
    await storedMethod(salonId, { method: 'e_money', isActive: false })
    await storedMethod(salonId, { method: 'cash' })

    // Act
    const listed = await repository().list(
      criteriaOf(salonId, { method: 'e_money', isActive: true }),
    )

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { total: 1, hasMore: false },
    })
    expect(idsOf(listed)).toEqual([taken.id])
  })

  it('should list the payment methods that are not active when the filter asks for them', async () => {
    // Arrange
    const salonId = await storedSalon()
    const inactive = await storedMethod(salonId, { isActive: false })
    await storedMethod(salonId)

    // Act
    const listed = await repository().list(
      criteriaOf(salonId, { isActive: false }),
    )

    // Assert
    expect(idsOf(listed)).toEqual([inactive.id])
  })

  it.each<[string, () => Promise<string>]>([
    [
      'a payment method of another salon',
      async () => (await storedMethod(await storedSalon())).id,
    ],
    ['an ID that names none', async () => UNKNOWN_ID],
  ])('should find no page after %s', async (_case, cursorOf) => {
    // Arrange
    const salonId = await storedSalon()
    await storedMethod(salonId)
    const after = paymentMethodIdSchema.parse(await cursorOf())

    // Act
    const listed = await repository().list(criteriaOf(salonId, { after }))

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

describe('PaymentMethodRepository.update', () => {
  it('should write the changes, and keep what they do not name', async () => {
    // Arrange
    const salonId = await storedSalon()
    const method = await storedMethod(salonId, {
      minimumAmount: 100,
      maximumAmount: 50000,
      updatedAt: '2020-01-01T00:00:00Z',
    })

    // Act
    const updated = await repository().update(salonId, method.id, {
      displayName: '現金（釣り銭あり）',
      maximumAmount: 80000,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        paymentMethod: {
          id: method.id,
          displayName: '現金（釣り銭あり）',
          minimumAmount: 100,
          maximumAmount: 80000,
        },
      },
    })
    expect((await storedOf(method.id))?.updatedAt).not.toBe(
      '2020-01-01 00:00:00+00',
    )
  })

  it('should write a lower limit with no upper limit', async () => {
    // Arrange
    const salonId = await storedSalon()
    const method = await storedMethod(salonId, { maximumAmount: 1000 })

    // Act
    const updated = await repository().update(salonId, method.id, {
      minimumAmount: 5000,
      maximumAmount: null,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        paymentMethod: { minimumAmount: 5000, maximumAmount: null },
      },
    })
  })

  it('should write no lower limit above the upper limit the payment method keeps', async () => {
    // Arrange
    const salonId = await storedSalon()
    const method = await storedMethod(salonId, { maximumAmount: 1000 })

    // Act
    const updated = await repository().update(salonId, method.id, {
      minimumAmount: 5000,
    })

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'limitsOutOfOrder' },
    })
    expect(await storedOf(method.id)).toMatchObject({ minimumAmount: null })
  })

  it('should write a lower limit below the upper limit the payment method keeps', async () => {
    // Arrange
    const salonId = await storedSalon()
    const method = await storedMethod(salonId, { maximumAmount: 1000 })

    // Act
    const updated = await repository().update(salonId, method.id, {
      minimumAmount: 500,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        paymentMethod: { minimumAmount: 500, maximumAmount: 1000 },
      },
    })
  })

  it('should read the upper limit another change committed while this one waited', async () => {
    // Arrange
    const salonId = await storedSalon()
    const method = await storedMethod(salonId)

    // Act
    const updated = await databases.whileHeld(
      (held) =>
        held`select id from payment_methods where id = ${method.id} for update`,
      (held) =>
        held`update payment_methods set "maximumAmount" = 1000 where id = ${method.id}`,
      () => repository().update(salonId, method.id, { minimumAmount: 5000 }),
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'limitsOutOfOrder' },
    })
  })

  it('should change no payment method of another salon', async () => {
    // Arrange
    const method = await storedMethod(await storedSalon())

    // Act
    const updated = await repository().update(await storedSalon(), method.id, {
      displayName: '現金（釣り銭あり）',
    })

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should answer that the update returned no row when a trigger skips it', async () => {
    // Arrange
    const salonId = await storedSalon()
    const method = await storedMethod(salonId)
    await databases.skipWrites('payment_methods', 'UPDATE')

    // Act
    const updated = await repository().update(salonId, method.id, {
      displayName: '現金（釣り銭あり）',
    })

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of payment method returned no row',
        cause: null,
      },
    })
  })
})

describe('PaymentMethodRepository.delete', () => {
  it('should delete the payment method, whatever was taken with the others', async () => {
    // Arrange
    const db = databases.database()
    const salonId = await storedSalon()
    const method = await storedMethod(salonId)
    const used = await storedMethod(salonId)
    const sale = await insertSale(db, { salonId, customerId: null })
    await insertPayment(db, sale.id, used.id)

    // Act
    const deleted = await repository().delete(salonId, method.id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    expect(await storedOf(method.id)).toBeUndefined()
    expect(await storedOf(used.id)).toBeDefined()
  })

  it('should delete no payment method that a payment was taken with', async () => {
    // Arrange
    const db = databases.database()
    const salonId = await storedSalon()
    const method = await storedMethod(salonId)
    const sale = await insertSale(db, { salonId, customerId: null })
    await insertPayment(db, sale.id, method.id)

    // Act
    const deleted = await repository().delete(salonId, method.id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'inUse' } })
    expect(await storedOf(method.id)).toBeDefined()
  })

  it('should delete no payment method that a payment is being taken with', async () => {
    // Arrange
    const db = databases.database()
    const salonId = await storedSalon()
    const method = await storedMethod(salonId)
    const sale = await insertSale(db, { salonId, customerId: null })

    // Act
    const deleted = await databases.whileHeld(
      (held) =>
        held`select id from payment_methods where id = ${method.id} for key share`,
      (held) =>
        held`insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber", amount, status, "processedAt") values (${sale.id}, ${method.id}, 'TX-REPO-HELD', 6600, 'completed', '2026-12-07T02:00:00Z')`,
      () => repository().delete(salonId, method.id),
    )

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'inUse' } })
  })

  it('should delete no payment method of another salon', async () => {
    // Arrange
    const method = await storedMethod(await storedSalon())

    // Act
    const deleted = await repository().delete(await storedSalon(), method.id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'notFound' } })
    expect(await storedOf(method.id)).toBeDefined()
  })
})

describe('PaymentMethodRepository when the database is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const id = paymentMethodIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (gone: PaymentMethodRepository) => Promise<unknown>]>([
    ['Failed to create payment method', (gone) => gone.create(salonId, CARD)],
    ['Failed to find payment method', (gone) => gone.findById(salonId, id)],
    [
      'Failed to list payment methods',
      (gone) =>
        gone.list({
          salonId,
          limit: 20,
          after: null,
          method: null,
          isActive: null,
        }),
    ],
    [
      'Failed to update payment method',
      (gone) => gone.update(salonId, id, { displayName: '現金' }),
    ],
    ['Failed to delete payment method', (gone) => gone.delete(salonId, id)],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new PaymentMethodRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
