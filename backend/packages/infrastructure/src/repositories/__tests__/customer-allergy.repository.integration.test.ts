import { customerAllergies } from '@beauty-salon-backend/database'
import {
  type CustomerId,
  customerAllergyIdSchema,
  customerIdSchema,
  type DbNewCustomerAllergy,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { CustomerAllergyRepository } from '../customer-allergy.repository.impl'
import { insertAllergy, insertCustomer } from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new CustomerAllergyRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** A fixed ID, so that a test decides which of two allergies comes first. */
const idOf = (place: number): string =>
  `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`

/** The columns of a customer who was deleted on 9 December 2026. */
const DELETED = { deletedAt: '2026-12-09T05:00:00Z' }

const storedCustomer = async (
  overrides: Parameters<typeof insertCustomer>[1] = {},
): Promise<CustomerId> =>
  customerIdSchema.parse(
    (await insertCustomer(databases.database(), overrides)).id,
  )

const storedAllergy = (
  customerId: CustomerId,
  overrides: Parameters<typeof insertAllergy>[2] = {},
) => insertAllergy(databases.database(), customerId, overrides)

const allergyIdOf = (allergy: { id: string }) =>
  customerAllergyIdSchema.parse(allergy.id)

/** The rows of the allergies of the customer in the table. */
const allergiesOf = (customerId: string) =>
  databases
    .database()
    .select()
    .from(customerAllergies)
    .where(eq(customerAllergies.customerId, customerId))

/** The row of the allergy in the table, or undefined when there is none. */
const rowOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(customerAllergies)
    .where(eq(customerAllergies.id, id))
  return row
}

const NEW_ALLERGY: DbNewCustomerAllergy = {
  allergyType: 'metal',
  allergenName: 'ニッケル',
  severityType: 'severe',
  symptoms: '耳の周りのかぶれ',
  notes: 'ピンを使わない',
  confirmedDate: '2026-11-20',
}

describe('CustomerAllergyRepository', () => {
  describe('add', () => {
    it('should write the allergy of the customer, stamped once at the moment', async () => {
      // Arrange
      const customerId = await storedCustomer()
      const other = await storedCustomer()
      await storedAllergy(other, { allergenName: 'ニッケル' })

      // Act
      const added = await repository().add(customerId, NEW_ALLERGY)

      // Assert
      const [row] = await allergiesOf(customerId)
      expect(added).toEqual({
        type: 'success',
        data: { type: 'added', allergy: row },
      })
      expect(row).toMatchObject({ ...NEW_ALLERGY, customerId })
      expect(row?.updatedAt).toBe(row?.createdAt)
    })

    it.each<[string, () => Promise<CustomerId>]>([
      ['who was deleted', () => storedCustomer(DELETED)],
      [
        'of an ID that names none',
        async () => customerIdSchema.parse(UNKNOWN_ID),
      ],
    ])(
      'should write no allergy of a customer %s',
      async (_case, customerOf) => {
        // Arrange
        const customerId = await customerOf()

        // Act
        const added = await repository().add(customerId, NEW_ALLERGY)

        // Assert
        expect(added).toEqual({
          type: 'success',
          data: { type: 'customerNotFound' },
        })
        expect(await allergiesOf(customerId)).toEqual([])
      },
    )

    it('should write no second allergy of an allergen of the customer', async () => {
      // Arrange
      const customerId = await storedCustomer()
      const allergy = await storedAllergy(customerId, {
        allergenName: 'ニッケル',
      })

      // Act
      const added = await repository().add(customerId, NEW_ALLERGY)

      // Assert
      expect(added).toEqual({
        type: 'success',
        data: { type: 'allergenExists' },
      })
      expect(await allergiesOf(customerId)).toEqual([allergy])
    })

    it('should write no allergy of a customer whose deletion it waited for', async () => {
      // Arrange
      const customerId = await storedCustomer()

      // Act
      const added = await databases.whileHeld(
        (held) =>
          held`select id from customers where id = ${customerId} for update`,
        (held) =>
          held`update customers set "deletedAt" = '2026-12-09T05:00:00Z' where id = ${customerId}`,
        () => repository().add(customerId, NEW_ALLERGY),
      )

      // Assert
      expect(added).toEqual({
        type: 'success',
        data: { type: 'customerNotFound' },
      })
      expect(await allergiesOf(customerId)).toEqual([])
    })
  })

  describe('update', () => {
    it('should write the columns the changes name, with the time, and leave the rest', async () => {
      // Arrange
      const customerId = await storedCustomer()
      const allergy = await storedAllergy(customerId, {
        updatedAt: '2026-12-01T00:00:00Z',
      })
      const other = await storedAllergy(customerId, {
        allergenName: 'ラテックス',
      })

      // Act
      const changed = await repository().update(
        customerId,
        allergyIdOf(allergy),
        { severityType: 'severe', notes: null },
      )

      // Assert
      const row = await rowOf(allergy.id)
      expect(changed).toEqual({
        type: 'success',
        data: { type: 'changed', allergy: row },
      })
      expect(row).toEqual({
        ...allergy,
        severityType: 'severe',
        notes: null,
        updatedAt: row?.updatedAt,
      })
      expect(row?.updatedAt).not.toBe(allergy.updatedAt)
      expect(await rowOf(other.id)).toEqual(other)
    })

    it('should change no allergy to the allergen of another allergy of the customer', async () => {
      // Arrange
      const customerId = await storedCustomer()
      const allergy = await storedAllergy(customerId)
      await storedAllergy(customerId, { allergenName: 'ラテックス' })

      // Act
      const changed = await repository().update(
        customerId,
        allergyIdOf(allergy),
        { allergenName: 'ラテックス' },
      )

      // Assert
      expect(changed).toEqual({
        type: 'success',
        data: { type: 'allergenExists' },
      })
      expect(await rowOf(allergy.id)).toEqual(allergy)
    })

    it.each<
      [string, () => Promise<{ customerId: CustomerId; id: string }>, string]
    >([
      [
        'of another customer',
        async () => ({
          customerId: await storedCustomer(),
          id: (await storedAllergy(await storedCustomer())).id,
        }),
        'allergyNotFound',
      ],
      [
        'of an ID that names none',
        async () => ({ customerId: await storedCustomer(), id: UNKNOWN_ID }),
        'allergyNotFound',
      ],
      [
        'of a customer who was deleted',
        async () => {
          const customerId = await storedCustomer(DELETED)
          return { customerId, id: (await storedAllergy(customerId)).id }
        },
        'customerNotFound',
      ],
      [
        'of a customer of an ID that names none',
        async () => ({
          customerId: customerIdSchema.parse(UNKNOWN_ID),
          id: UNKNOWN_ID,
        }),
        'customerNotFound',
      ],
    ])('should change no allergy %s', async (_case, arrange, type) => {
      // Arrange
      const { customerId, id } = await arrange()
      const before = await rowOf(id)

      // Act
      const changed = await repository().update(
        customerId,
        customerAllergyIdSchema.parse(id),
        { notes: '変えたメモ' },
      )

      // Assert
      expect(changed).toEqual({ type: 'success', data: { type } })
      expect(await rowOf(id)).toEqual(before)
    })
  })

  describe('remove', () => {
    it('should remove the allergy, and leave the others', async () => {
      // Arrange
      const customerId = await storedCustomer()
      const allergy = await storedAllergy(customerId)
      const other = await storedAllergy(customerId, {
        allergenName: 'ラテックス',
      })

      // Act
      const removed = await repository().remove(
        customerId,
        allergyIdOf(allergy),
      )

      // Assert
      expect(removed).toEqual({ type: 'success', data: { type: 'removed' } })
      expect(await allergiesOf(customerId)).toEqual([other])
    })

    it.each<
      [string, () => Promise<{ customerId: CustomerId; id: string }>, string]
    >([
      [
        'of another customer',
        async () => ({
          customerId: await storedCustomer(),
          id: (await storedAllergy(await storedCustomer())).id,
        }),
        'allergyNotFound',
      ],
      [
        'of a customer who was deleted',
        async () => {
          const customerId = await storedCustomer(DELETED)
          return { customerId, id: (await storedAllergy(customerId)).id }
        },
        'customerNotFound',
      ],
      [
        'of a customer of an ID that names none',
        async () => ({
          customerId: customerIdSchema.parse(UNKNOWN_ID),
          id: UNKNOWN_ID,
        }),
        'customerNotFound',
      ],
    ])('should remove no allergy %s', async (_case, arrange, type) => {
      // Arrange
      const { customerId, id } = await arrange()
      const before = await rowOf(id)

      // Act
      const removed = await repository().remove(
        customerId,
        customerAllergyIdSchema.parse(id),
      )

      // Assert
      expect(removed).toEqual({ type: 'success', data: { type } })
      expect(await rowOf(id)).toEqual(before)
    })
  })

  describe('list', () => {
    /**
     * A customer with six allergies: one that is life threatening, two
     * severe ones recorded on two days, two moderate ones recorded at one
     * moment, of which the one with the lesser ID comes first, and a mild
     * one. Another customer has an allergy of their own.
     */
    const storedAllergies = async () => {
      const customerId = await storedCustomer()
      const mild = await storedAllergy(customerId, {
        id: idOf(1),
        allergenName: '香料',
        severityType: 'mild',
        createdAt: '2026-12-01T03:00:00Z',
      })
      const severeLater = await storedAllergy(customerId, {
        id: idOf(5),
        allergenName: 'ニッケル',
        severityType: 'severe',
        createdAt: '2026-12-03T03:00:00Z',
      })
      const severeEarlier = await storedAllergy(customerId, {
        id: idOf(6),
        allergenName: 'ラテックス',
        severityType: 'severe',
        createdAt: '2026-12-02T03:00:00Z',
      })
      const moderateGreater = await storedAllergy(customerId, {
        id: idOf(3),
        allergenName: 'パラベン',
        createdAt: '2026-12-02T03:00:00Z',
      })
      const moderateLesser = await storedAllergy(customerId, {
        id: idOf(2),
        allergenName: 'ジアミン',
        createdAt: '2026-12-02T03:00:00Z',
      })
      const lifeThreatening = await storedAllergy(customerId, {
        id: idOf(4),
        allergenName: 'チオグリコール酸',
        severityType: 'life_threatening',
        createdAt: '2026-12-04T03:00:00Z',
      })
      const other = await storedAllergy(await storedCustomer())
      return {
        customerId,
        order: [
          lifeThreatening,
          severeEarlier,
          severeLater,
          moderateLesser,
          moderateGreater,
          mild,
        ],
        other,
      }
    }

    it('should list the allergies of the customer, the severest first and then in the order they were recorded', async () => {
      // Arrange
      const { customerId, order } = await storedAllergies()

      // Act
      const listed = await repository().list({
        customerId,
        limit: 20,
        after: null,
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: { type: 'listed', allergies: order, total: 6, hasMore: false },
      })
    })

    it.each<[string, number, number]>([
      ['the severity of the cursor, recorded later', 1, 2],
      ['a lesser severity', 2, 3],
      ['the moment of the cursor, of a greater ID', 3, 4],
    ])(
      'should list a page at a time, from the allergy after the cursor, through %s',
      async (_through, cursorAt, firstAt) => {
        // Arrange
        const { customerId, order } = await storedAllergies()

        // Act
        const listed = await repository().list({
          customerId,
          limit: 2,
          after: allergyIdOf(order[cursorAt] ?? { id: UNKNOWN_ID }),
        })

        // Assert
        expect(listed).toEqual({
          type: 'success',
          data: {
            type: 'listed',
            allergies: order.slice(firstAt, firstAt + 2),
            total: 6,
            hasMore: firstAt + 2 < order.length,
          },
        })
      },
    )

    it.each<[string, (other: { id: string }) => string]>([
      ['an allergy of another customer', (other) => other.id],
      ['an ID that names no allergy', () => UNKNOWN_ID],
    ])('should list no page after %s', async (_cursor, cursorOf) => {
      // Arrange
      const { customerId, other } = await storedAllergies()

      // Act
      const listed = await repository().list({
        customerId,
        limit: 20,
        after: customerAllergyIdSchema.parse(cursorOf(other)),
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: { type: 'cursorNotFound' },
      })
    })

    it.each<[string, () => Promise<CustomerId>]>([
      [
        'who was deleted',
        async () => {
          const customerId = await storedCustomer(DELETED)
          await storedAllergy(customerId)
          return customerId
        },
      ],
      [
        'of an ID that names none',
        async () => customerIdSchema.parse(UNKNOWN_ID),
      ],
    ])('should list no allergy of a customer %s', async (_case, customerOf) => {
      // Arrange
      const customerId = await customerOf()

      // Act
      const listed = await repository().list({
        customerId,
        limit: 20,
        after: null,
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: { type: 'customerNotFound' },
      })
    })
  })
})

describe('CustomerAllergyRepository when the database is gone', () => {
  const customerId = customerIdSchema.parse(UNKNOWN_ID)
  const id = customerAllergyIdSchema.parse(UNKNOWN_ID)

  it.each<
    [string, string, (gone: CustomerAllergyRepository) => Promise<unknown>]
  >([
    [
      'an addition',
      'Failed to add customer allergy',
      (gone) => gone.add(customerId, NEW_ALLERGY),
    ],
    [
      'a change',
      'Failed to update customer allergy',
      (gone) => gone.update(customerId, id, { notes: null }),
    ],
    [
      'a removal',
      'Failed to remove customer allergy',
      (gone) => gone.remove(customerId, id),
    ],
    [
      'the allergies of a customer',
      'Failed to list customer allergies',
      (gone) => gone.list({ customerId, limit: 20, after: null }),
    ],
  ])('should answer for %s: %s', async (_subject, message, call) => {
    // Arrange
    const gone = new CustomerAllergyRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
