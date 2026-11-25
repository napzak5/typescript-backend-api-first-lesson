import { customerPreferences } from '@beauty-salon-backend/database'
import { type CustomerId, customerIdSchema } from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { CustomerPreferencesRepository } from '../customer-preferences.repository.impl'
import {
  insertCustomer,
  insertPreferences,
  insertSalon,
  insertStaffMember,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new CustomerPreferencesRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** The mornings and the evenings, as a customer chooses them. */
const TIME_SLOTS = [
  { startTime: '10:00', endTime: '12:00' },
  { startTime: '18:00', endTime: '21:00' },
]

/** A customer in the table, as a repository is given them. */
const storedCustomer = async (
  overrides: Parameters<typeof insertCustomer>[1] = {},
): Promise<CustomerId> =>
  customerIdSchema.parse(
    (await insertCustomer(databases.database(), overrides)).id,
  )

/** A member of the staff of a new salon, of a salon deleted when the test says so. */
const storedStaffMember = async (
  overrides: Parameters<typeof insertStaffMember>[2] = {},
  salon: Parameters<typeof insertSalon>[1] = {},
): Promise<string> => {
  const db = databases.database()
  const { id: salonId } = await insertSalon(db, salon)
  return (await insertStaffMember(db, salonId, overrides)).id
}

/** The rows of the preferences of the customer in the table. */
const rowsOf = (customerId: CustomerId) =>
  databases
    .database()
    .select()
    .from(customerPreferences)
    .where(eq(customerPreferences.customerId, customerId))

describe('CustomerPreferencesRepository.findByCustomerId', () => {
  it('should find the preferences stored for the customer', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const preferred = await storedStaffMember()
    await insertPreferences(databases.database(), customerId, {
      preferredStaffId: preferred,
      preferredTimeSlots: TIME_SLOTS,
      stylePreferences: { length: 'short' },
      communicationStyle: '静かに過ごしたい',
      specialRequests: '香りの弱いものを',
    })

    // Act
    const found = await repository().findByCustomerId(customerId)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: {
        type: 'found',
        preferences: {
          preferredStaffId: preferred,
          preferredTimeSlots: TIME_SLOTS,
          avoidStaffIds: [],
          stylePreferences: { length: 'short' },
          communicationStyle: '静かに過ごしたい',
          specialRequests: '香りの弱いものを',
        },
      },
    })
  })

  it('should find the empty preferences of a customer who has no row', async () => {
    // Arrange
    const customerId = await storedCustomer()
    await insertPreferences(databases.database(), await storedCustomer(), {
      specialRequests: '香りの弱いものを',
    })

    // Act
    const found = await repository().findByCustomerId(customerId)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: {
        type: 'found',
        preferences: {
          preferredStaffId: null,
          preferredTimeSlots: [],
          avoidStaffIds: [],
          stylePreferences: null,
          communicationStyle: null,
          specialRequests: null,
        },
      },
    })
  })

  it.each<[string, () => Promise<CustomerId>]>([
    ['who is deleted', () => storedCustomer({ deletedAt: DELETED_AT })],
    [
      'of an ID that names none',
      async () => customerIdSchema.parse(UNKNOWN_ID),
    ],
  ])('should find no customer %s', async (_, arrange) => {
    // Arrange
    const customerId = await arrange()

    // Act
    const found = await repository().findByCustomerId(customerId)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
  })
})

describe('CustomerPreferencesRepository.update', () => {
  it('should create the row of the first change, with every other column empty', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const avoided = await storedStaffMember()

    // Act
    const updated = await repository().update(customerId, {
      avoidStaffIds: [avoided],
      specialRequests: '香りの弱いものを',
    })

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: {
        type: 'updated',
        preferences: {
          preferredStaffId: null,
          preferredTimeSlots: [],
          avoidStaffIds: [avoided],
          stylePreferences: null,
          communicationStyle: null,
          specialRequests: '香りの弱いものを',
        },
      },
    })
    expect(await rowsOf(customerId)).toHaveLength(1)
  })

  it('should write the columns a later change names and keep the others', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const preferred = await storedStaffMember()
    await insertPreferences(databases.database(), customerId, {
      preferredStaffId: preferred,
      communicationStyle: '静かに過ごしたい',
    })

    // Act
    const updated = await repository().update(customerId, {
      preferredTimeSlots: TIME_SLOTS,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        preferences: {
          preferredStaffId: preferred,
          preferredTimeSlots: TIME_SLOTS,
          communicationStyle: '静かに過ごしたい',
        },
      },
    })
    expect(await rowsOf(customerId)).toHaveLength(1)
  })

  it('should clear the staff member the customer preferred', async () => {
    // Arrange
    const customerId = await storedCustomer()
    await insertPreferences(databases.database(), customerId, {
      preferredStaffId: await storedStaffMember(),
    })

    // Act
    const updated = await repository().update(customerId, {
      preferredStaffId: null,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', preferences: { preferredStaffId: null } },
    })
  })

  it('should name every staff member of the change who is not one, the preferred one first', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const deleted = await storedStaffMember({ deletedAt: DELETED_AT })
    const ofDeletedSalon = await storedStaffMember(
      {},
      { deletedAt: DELETED_AT },
    )
    const working = await storedStaffMember()

    // Act
    const updated = await repository().update(customerId, {
      preferredStaffId: UNKNOWN_ID,
      avoidStaffIds: [deleted, working, ofDeletedSalon],
    })

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: {
        type: 'staffNotFound',
        staffIds: [UNKNOWN_ID, deleted, ofDeletedSalon],
      },
    })
    expect(await rowsOf(customerId)).toEqual([])
  })

  it('should refuse to prefer a staff member the stored preferences avoid', async () => {
    // Arrange
    const customerId = await storedCustomer()
    const avoided = await storedStaffMember()
    await insertPreferences(databases.database(), customerId, {
      avoidStaffIds: [avoided],
    })

    // Act
    const updated = await repository().update(customerId, {
      preferredStaffId: avoided,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'invalid',
        issues: [{ field: 'preferredStaffId', rule: 'avoided' }],
      },
    })
    expect(await rowsOf(customerId)).toMatchObject([{ preferredStaffId: null }])
  })

  it.each<[string, () => Promise<CustomerId>]>([
    ['who is deleted', () => storedCustomer({ deletedAt: DELETED_AT })],
    [
      'of an ID that names none',
      async () => customerIdSchema.parse(UNKNOWN_ID),
    ],
  ])('should change nothing of a customer %s', async (_, arrange) => {
    // Arrange
    const customerId = await arrange()

    // Act
    const updated = await repository().update(customerId, {
      specialRequests: '香りの弱いものを',
    })

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
    expect(await rowsOf(customerId)).toEqual([])
  })

  it('should answer a database error when the write returns no row', async () => {
    // Arrange
    const customerId = await storedCustomer()
    await databases.skipWrites('customer_preferences', 'INSERT')

    // Act
    const updated = await repository().update(customerId, {
      specialRequests: '香りの弱いものを',
    })

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Write of customer preferences returned no row',
        cause: null,
      },
    })
  })
})

describe('CustomerPreferencesRepository on a database that is gone', () => {
  const customerId = customerIdSchema.parse(UNKNOWN_ID)

  it.each<
    [string, (repository: CustomerPreferencesRepository) => Promise<unknown>]
  >([
    [
      'Failed to find customer preferences',
      (gone) => gone.findByCustomerId(customerId),
    ],
    [
      'Failed to update customer preferences',
      (gone) => gone.update(customerId, { specialRequests: null }),
    ],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new CustomerPreferencesRepository(await databases.gone())

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
