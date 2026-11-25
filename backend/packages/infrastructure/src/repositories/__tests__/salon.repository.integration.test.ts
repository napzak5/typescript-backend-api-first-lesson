import { openingHours, salons } from '@beauty-salon-backend/database'
import {
  type SalonListCriteria,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { SalonRepository } from '../salon.repository.impl'
import {
  CANCELLED,
  COMPLETED,
  insertBooking,
  insertCustomer,
  insertSalon,
  insertStaffMember,
  newOpeningHours,
  newSalon,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new SalonRepository(databases.database())

/** A search of every salon that is not deleted, a page of 20 at a time. */
const everySalon: SalonListCriteria = {
  limit: 20,
  after: null,
  keyword: null,
  prefecture: null,
  city: null,
  isActive: null,
  minRating: null,
  features: [],
}

/** The names of the salons of a list, in its order. */
const namesOf = (list: { salons: { salon: { name: string } }[] }) =>
  list.salons.map(({ salon }) => salon.name)

/** A salon that the table holds, as a repository is given its ID. */
const storedSalon = async (
  overrides: Parameters<typeof insertSalon>[1] = {},
) => {
  const salon = await insertSalon(databases.database(), overrides)
  return { ...salon, id: salonIdSchema.parse(salon.id) }
}

describe('SalonRepository.create', () => {
  it('should store a salon with its opening hours, and answer with them in the order of their days', async () => {
    // Arrange
    const salon = newSalon({ name: 'Hair Studio Aoyama' })
    const hours = [
      newOpeningHours({ dayOfWeek: 'tuesday', date: '2026-12-08' }),
      newOpeningHours({ dayOfWeek: 'monday', date: '2026-12-07' }),
    ]

    // Act
    const created = await repository().create(salon, hours)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        salon: { ...salon, rating: null, reviewCount: 0, deletedAt: null },
        openingHours: [{ date: '2026-12-07' }, { date: '2026-12-08' }],
      },
    })
    const id = created.type === 'success' ? created.data.salon.id : ''
    expect(await repository().findById(salonIdSchema.parse(id))).toEqual(
      created,
    )
  })

  it('should store a salon without opening hours', async () => {
    // Act
    const created = await repository().create(newSalon(), [])

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { openingHours: [] },
    })
  })

  it('should refuse a salon with the email of another salon', async () => {
    // Arrange
    const other = await storedSalon()

    // Act
    const created = await repository().create(
      newSalon({ email: other.email }),
      [newOpeningHours()],
    )

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'alreadyExists',
        entity: entityMessages.salon,
        field: 'email',
        value: other.email,
      },
    })
    expect(await databases.database().select().from(openingHours)).toHaveLength(
      0,
    )
  })

  it('should take the email of a salon that was deleted', async () => {
    // Arrange
    const deleted = await storedSalon({ deletedAt: '2026-11-20T09:00:00Z' })

    // Act
    const created = await repository().create(
      newSalon({ email: deleted.email }),
      [],
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { salon: { email: deleted.email } },
    })
  })

  it('should answer a database error when the insert writes no row', async () => {
    // Arrange
    await databases.skipWrites('salons', 'INSERT')

    // Act
    const created = await repository().create(newSalon(), [newOpeningHours()])

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of salon returned no row',
        cause: null,
      },
    })
  })
})

describe('SalonRepository.findById and exists', () => {
  it('should find a salon that is there', async () => {
    // Arrange
    const salon = await storedSalon()

    // Act
    const found = await repository().findById(salon.id)
    const exists = await repository().exists(salon.id)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { salon: { id: salon.id }, openingHours: [] },
    })
    expect(exists).toEqual({ type: 'success', data: true })
  })

  it.each([
    ['a salon that was deleted', { deletedAt: '2026-11-20T09:00:00Z' }],
    ['a salon that is not there', null],
  ])('should not find %s', async (_case, deletion) => {
    // Arrange
    const id =
      deletion === null
        ? salonIdSchema.parse('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b')
        : (await storedSalon(deletion)).id

    // Act
    const found = await repository().findById(id)
    const exists = await repository().exists(id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
    expect(exists).toEqual({ type: 'success', data: false })
  })
})

describe('SalonRepository.list', () => {
  it('should list the newest salons first, a page at a time, the next page after the salon of the cursor', async () => {
    // Arrange
    const oldest = await storedSalon({
      name: 'Oldest',
      createdAt: '2026-11-01T00:00:00Z',
    })
    const middle = await storedSalon({
      name: 'Middle',
      createdAt: '2026-11-02T00:00:00Z',
    })
    await storedSalon({ name: 'Newest', createdAt: '2026-11-03T00:00:00Z' })
    await databases
      .database()
      .insert(openingHours)
      .values({ ...newOpeningHours(), salonId: oldest.id })

    // Act
    const first = await repository().list({ ...everySalon, limit: 2 })
    const second = await repository().list({
      ...everySalon,
      limit: 2,
      after: middle.id,
    })

    // Assert
    expect(first).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: true },
    })
    expect(first.type === 'success' && namesOf(first.data)).toEqual([
      'Newest',
      'Middle',
    ])
    expect(second).toMatchObject({
      type: 'success',
      data: {
        salons: [{ salon: { name: 'Oldest' }, openingHours: [{}] }],
        total: 3,
        hasMore: false,
      },
    })
  })

  it('should start the page after a salon of the cursor that was deleted meanwhile', async () => {
    // Arrange
    await storedSalon({ name: 'Older', createdAt: '2026-11-01T00:00:00Z' })
    const cursor = await storedSalon({
      name: 'Cursor',
      createdAt: '2026-11-02T00:00:00Z',
    })
    await databases
      .database()
      .update(salons)
      .set({ deletedAt: '2026-11-20T09:00:00Z' })
      .where(eq(salons.id, cursor.id))

    // Act
    const page = await repository().list({ ...everySalon, after: cursor.id })

    // Assert
    expect(page.type === 'success' && namesOf(page.data)).toEqual(['Older'])
  })

  it('should leave out the salons that were deleted', async () => {
    // Arrange
    await storedSalon({ name: 'Open' })
    await storedSalon({ name: 'Gone', deletedAt: '2026-11-20T09:00:00Z' })

    // Act
    const page = await repository().list(everySalon)

    // Assert
    expect(page).toMatchObject({ type: 'success', data: { total: 1 } })
    expect(page.type === 'success' && namesOf(page.data)).toEqual(['Open'])
  })

  it.each<[string, Partial<SalonListCriteria>, string[]]>([
    ['a keyword in the name', { keyword: 'aoyama' }, ['Aoyama']],
    ['a keyword in the description', { keyword: '駅から' }, ['Shibuya']],
    ['a keyword with a wildcard, taken literally', { keyword: '50%' }, []],
    ['the prefecture', { prefecture: '大阪府' }, ['Umeda']],
    ['the city', { city: '渋谷区' }, ['Shibuya']],
    ['whether the salon is active', { isActive: false }, ['Umeda']],
    ['the lowest rating', { minRating: 4 }, ['Aoyama']],
    [
      'every one of the features',
      { features: ['parking', 'kids'] },
      ['Shibuya'],
    ],
  ])('should find the salons by %s', async (_case, criteria, expected) => {
    // Arrange
    await storedSalon({
      name: 'Aoyama',
      description: '50 % off for students',
      rating: '4.50',
      reviewCount: 2,
      features: ['parking'],
      createdAt: '2026-11-03T00:00:00Z',
    })
    await storedSalon({
      name: 'Shibuya',
      description: '駅から 1 分',
      city: '渋谷区',
      rating: '3.50',
      reviewCount: 4,
      features: ['parking', 'kids', 'wifi'],
      createdAt: '2026-11-02T00:00:00Z',
    })
    await storedSalon({
      name: 'Umeda',
      prefecture: '大阪府',
      city: '大阪市',
      isActive: false,
      createdAt: '2026-11-01T00:00:00Z',
    })

    // Act
    const page = await repository().list({ ...everySalon, ...criteria })

    // Assert
    expect(page).toMatchObject({
      type: 'success',
      data: { total: expected.length, hasMore: false },
    })
    expect(page.type === 'success' && namesOf(page.data)).toEqual(expected)
  })
})

describe('SalonRepository.update', () => {
  it('should change a salon and keep its opening hours', async () => {
    // Arrange
    const created = await repository().create(newSalon(), [newOpeningHours()])
    const id = salonIdSchema.parse(
      created.type === 'success' ? created.data.salon.id : '',
    )

    // Act
    const updated = await repository().update(
      id,
      { name: 'Hair Studio Omotesando', description: null },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        salon: { id, name: 'Hair Studio Omotesando' },
        openingHours: [{ date: '2026-12-07' }],
      },
    })
    const salon = updated.type === 'success' ? updated.data?.salon : undefined
    expect(salon?.updatedAt).not.toBe(salon?.createdAt)
  })

  it.each([
    ['other opening hours', [newOpeningHours({ date: '2026-12-14' })]],
    ['no opening hours', []],
  ])(
    'should replace the opening hours of a salon with %s',
    async (_case, hours) => {
      // Arrange
      const created = await repository().create(newSalon(), [newOpeningHours()])
      const id = salonIdSchema.parse(
        created.type === 'success' ? created.data.salon.id : '',
      )

      // Act
      const updated = await repository().update(
        id,
        { isActive: false },
        { type: 'replace', openingHours: hours },
      )

      // Assert
      expect(updated).toMatchObject({
        type: 'success',
        data: {
          salon: { isActive: false },
          openingHours: hours.map(({ date }) => ({ date })),
        },
      })
      expect(
        await databases.database().select().from(openingHours),
      ).toHaveLength(hours.length)
    },
  )

  it('should refuse the email of another salon, and change nothing', async () => {
    // Arrange
    const other = await storedSalon()
    const salon = await storedSalon()

    // Act
    const updated = await repository().update(
      salon.id,
      { email: other.email, name: 'Renamed' },
      { type: 'replace', openingHours: [] },
    )

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'alreadyExists',
        entity: entityMessages.salon,
        field: 'email',
        value: other.email,
      },
    })
    expect(await repository().findById(salon.id)).toMatchObject({
      type: 'success',
      data: { salon: { name: salon.name } },
    })
  })

  it.each([
    ['a salon that was deleted', { deletedAt: '2026-11-20T09:00:00Z' }],
    ['a salon that is not there', null],
  ])('should answer nothing for %s', async (_case, deletion) => {
    // Arrange
    const id =
      deletion === null
        ? salonIdSchema.parse('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b')
        : (await storedSalon(deletion)).id

    // Act
    const updated = await repository().update(
      id,
      { name: 'Renamed' },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({ type: 'success', data: null })
  })
})

describe('SalonRepository.delete', () => {
  it('should mark a salon whose bookings are all finished as deleted', async () => {
    // Arrange
    const db = databases.database()
    const salon = await storedSalon()
    const parties = {
      salonId: salon.id,
      customerId: (await insertCustomer(db)).id,
      staffId: (await insertStaffMember(db, salon.id)).id,
    }
    await insertBooking(db, parties, COMPLETED)
    await insertBooking(db, parties, CANCELLED)

    // Act
    const deleted = await repository().delete(salon.id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    const [row] = await db.select().from(salons).where(eq(salons.id, salon.id))
    expect(row?.deletedAt).not.toBeNull()
    expect(await repository().exists(salon.id)).toEqual({
      type: 'success',
      data: false,
    })
  })

  it('should keep a salon that a booking which is not finished is of', async () => {
    // Arrange
    const db = databases.database()
    const salon = await storedSalon()
    await insertBooking(
      db,
      {
        salonId: salon.id,
        customerId: (await insertCustomer(db)).id,
        staffId: (await insertStaffMember(db, salon.id)).id,
      },
      { status: 'confirmed' },
    )

    // Act
    const deleted = await repository().delete(salon.id)

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'bookingsUnfinished' },
    })
    expect(await repository().exists(salon.id)).toEqual({
      type: 'success',
      data: true,
    })
  })

  it.each([
    ['a salon that was deleted', { deletedAt: '2026-11-20T09:00:00Z' }],
    ['a salon that is not there', null],
  ])('should not find %s', async (_case, deletion) => {
    // Arrange
    const id =
      deletion === null
        ? salonIdSchema.parse('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b')
        : (await storedSalon(deletion)).id

    // Act
    const deleted = await repository().delete(id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'notFound' } })
  })
})

describe('SalonRepository on a database that is gone', () => {
  const id = salonIdSchema.parse('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b')

  it.each<[string, (repository: SalonRepository) => Promise<unknown>]>([
    ['Failed to create salon', (gone) => gone.create(newSalon(), [])],
    ['Failed to find salon', (gone) => gone.findById(id)],
    ['Failed to look for salon', (gone) => gone.exists(id)],
    ['Failed to list salons', (gone) => gone.list(everySalon)],
    [
      'Failed to update salon',
      (gone) => gone.update(id, { name: 'Renamed' }, { type: 'keep' }),
    ],
    ['Failed to delete salon', (gone) => gone.delete(id)],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new SalonRepository(await databases.gone())

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
