import { serviceOptions, services } from '@beauty-salon-backend/database'
import {
  categoryIdSchema,
  type SalonId,
  type ServiceId,
  type ServiceListCriteria,
  salonIdSchema,
  serviceIdSchema,
} from '@beauty-salon-backend/domain'
import { serviceMessages } from '@beauty-salon-shared/i18n/messages/api'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { ServiceRepository } from '../service.repository.impl'
import {
  CANCELLED,
  COMPLETED,
  insertBooking,
  insertBookingLine,
  insertCategory,
  insertCustomer,
  insertSalon,
  insertService,
  insertStaffMember,
  newOption,
  newService,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new ServiceRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED = { deletedAt: '2026-11-20T09:00:00Z' }

/** A salon in the table, as a repository is given its ID. */
const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

/** A service of the salon in the table, as a repository is given its ID. */
const storedService = async (
  salonId: SalonId,
  overrides: Parameters<typeof insertService>[2] = {},
): Promise<ServiceId> =>
  serviceIdSchema.parse(
    (await insertService(databases.database(), salonId, overrides)).id,
  )

/** A package of the salon in the table, of two services of the salon. */
const storedPackage = async (salonId: SalonId) => {
  const members = [await storedService(salonId), await storedService(salonId)]
  const id = await storedService(salonId, {
    isPackage: true,
    packageServiceIds: members,
  })
  return { id, members }
}

/** A service as the table holds it, deleted or not. */
const rowOf = async (id: ServiceId) => {
  const [row] = await databases
    .database()
    .select()
    .from(services)
    .where(eq(services.id, id))
  return row
}

/** Every service of the salon, a page of 20 at a time. */
const everyServiceOf = (salonId: SalonId): ServiceListCriteria => ({
  salonId,
  limit: 20,
  after: null,
  categoryId: null,
  isActive: null,
})

/** The names of the services of a list, in its order; none of no list. */
const namesOf = (list: { services: { service: { name: string } }[] } | null) =>
  list?.services.map(({ service }) => service.name)

describe('ServiceRepository.create', () => {
  it('should store a service with its options, in a category of its salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const categoryId = (await insertCategory(databases.database(), salonId)).id
    const service = newService({ categoryId })
    const options = [
      newOption({ name: 'ヘッドスパ', sortOrder: 2 }),
      newOption({ name: 'トリートメント', sortOrder: 1 }),
    ]

    // Act
    const created = await repository().create(salonId, service, options)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        service: {
          service: { ...service, salonId, deletedAt: null },
          options: [{ name: 'トリートメント' }, { name: 'ヘッドスパ' }],
        },
      },
    })
  })

  it('should store a package of services of its salon, without options', async () => {
    // Arrange
    const salonId = await storedSalon()
    const members = [await storedService(salonId), await storedService(salonId)]

    // Act
    const created = await repository().create(
      salonId,
      newService({ isPackage: true, packageServiceIds: members }),
      [],
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        service: {
          service: { isPackage: true, packageServiceIds: members },
          options: [],
        },
      },
    })
  })

  it.each([
    ['a category of another salon', 'other'],
    ['a category that is not there', 'unknown'],
  ])('should refuse %s', async (_case, whose) => {
    // Arrange
    const salonId = await storedSalon()
    const categoryId =
      whose === 'other'
        ? (await insertCategory(databases.database(), await storedSalon())).id
        : UNKNOWN_ID

    // Act
    const created = await repository().create(
      salonId,
      newService({ categoryId }),
      [newOption()],
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'categoryNotFound' },
    })
  })

  it.each([
    ['a service of another salon', 'packageMemberNotFound', 'other'],
    ['a service that was deleted', 'packageMemberNotFound', 'deleted'],
    ['a package', 'packageMemberIsPackage', 'package'],
  ])('should refuse a package with %s', async (_case, refusal, member) => {
    // Arrange
    const salonId = await storedSalon()
    const refused =
      member === 'other'
        ? await storedService(await storedSalon())
        : member === 'deleted'
          ? await storedService(salonId, DELETED)
          : (await storedPackage(salonId)).id

    // Act
    const created = await repository().create(
      salonId,
      newService({
        isPackage: true,
        packageServiceIds: [await storedService(salonId), refused],
      }),
      [],
    )

    // Assert
    expect(created).toEqual({ type: 'success', data: { type: refusal } })
  })

  it('should answer a database error when the insert writes no row', async () => {
    // Arrange
    const salonId = await storedSalon()
    await databases.skipWrites('services', 'INSERT')

    // Act
    const created = await repository().create(salonId, newService(), [
      newOption(),
    ])

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of service returned no row',
        cause: null,
      },
    })
  })
})

describe('ServiceRepository.findById', () => {
  it('should find a service of the salon with its options', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedService(salonId)
    await databases
      .database()
      .insert(serviceOptions)
      .values({ ...newOption(), serviceId: id })

    // Act
    const found = await repository().findById(salonId, id)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { service: { id, salonId }, options: [{ serviceId: id }] },
    })
  })

  it.each([
    ['a service of another salon', 'other'],
    ['a service that was deleted', 'deleted'],
  ])('should not find %s', async (_case, which) => {
    // Arrange
    const salonId = await storedSalon()
    const id =
      which === 'other'
        ? await storedService(await storedSalon())
        : await storedService(salonId, DELETED)

    // Act
    const found = await repository().findById(salonId, id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('ServiceRepository.list', () => {
  it('should list the services of the salon in their order, a page at a time, with their options', async () => {
    // Arrange
    const salonId = await storedSalon()
    const third = await storedService(salonId, { name: 'Third', sortOrder: 30 })
    const first = await storedService(salonId, { name: 'First', sortOrder: 10 })
    await storedService(salonId, { name: 'Second', sortOrder: 20 })
    await storedService(salonId, { name: 'Gone', sortOrder: 15, ...DELETED })
    await storedService(await storedSalon(), { name: 'Elsewhere' })
    await databases
      .database()
      .insert(serviceOptions)
      .values({ ...newOption(), serviceId: third })

    // Act
    const firstPage = await repository().list({
      ...everyServiceOf(salonId),
      limit: 1,
    })
    const rest = await repository().list({
      ...everyServiceOf(salonId),
      after: first,
    })

    // Assert
    expect(firstPage).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: true },
    })
    expect(firstPage.type === 'success' && namesOf(firstPage.data)).toEqual([
      'First',
    ])
    expect(rest).toMatchObject({
      type: 'success',
      data: {
        services: [
          { service: { name: 'Second' }, options: [] },
          { service: { name: 'Third' }, options: [{ serviceId: third }] },
        ],
        total: 3,
        hasMore: false,
      },
    })
  })

  it('should start the page after a service of the cursor that was deleted', async () => {
    // Arrange
    const salonId = await storedSalon()
    const gone = await storedService(salonId, { sortOrder: 15, ...DELETED })
    await storedService(salonId, { name: 'Before', sortOrder: 10 })
    await storedService(salonId, { name: 'After', sortOrder: 20 })

    // Act
    const page = await repository().list({
      ...everyServiceOf(salonId),
      after: gone,
    })

    // Assert
    expect(page.type === 'success' && namesOf(page.data)).toEqual(['After'])
  })

  it('should list the services of a category, and those that are active or not', async () => {
    // Arrange
    const salonId = await storedSalon()
    const category = await insertCategory(databases.database(), salonId)
    await storedService(salonId, {
      name: 'Cut',
      categoryId: category.id,
      sortOrder: 10,
    })
    await storedService(salonId, {
      name: 'Resting cut',
      categoryId: category.id,
      isActive: false,
      sortOrder: 20,
    })
    await storedService(salonId, { name: 'Elsewhere' })

    // Act
    const ofCategory = await repository().list({
      ...everyServiceOf(salonId),
      categoryId: categoryIdSchema.parse(category.id),
    })
    const resting = await repository().list({
      ...everyServiceOf(salonId),
      isActive: false,
    })

    // Assert
    expect(ofCategory.type === 'success' && namesOf(ofCategory.data)).toEqual([
      'Cut',
      'Resting cut',
    ])
    expect(resting).toMatchObject({
      type: 'success',
      data: { services: [{ service: { name: 'Resting cut' } }], total: 1 },
    })
  })

  it('should answer an empty page when no service matches', async () => {
    // Act
    const page = await repository().list(everyServiceOf(await storedSalon()))

    // Assert
    expect(page).toEqual({
      type: 'success',
      data: { services: [], total: 0, hasMore: false },
    })
  })

  it.each([
    ['a service of another salon', 'other'],
    ['a service that is not there', 'unknown'],
  ])(
    'should answer no page for a cursor that names %s',
    async (_case, whose) => {
      // Arrange
      const salonId = await storedSalon()
      await storedService(salonId)
      const after =
        whose === 'other'
          ? await storedService(await storedSalon())
          : serviceIdSchema.parse(UNKNOWN_ID)

      // Act
      const page = await repository().list({
        ...everyServiceOf(salonId),
        after,
      })

      // Assert
      expect(page).toEqual({ type: 'success', data: null })
    },
  )
})

describe('ServiceRepository.update', () => {
  it('should change a service, move it to a category and keep its options', async () => {
    // Arrange
    const salonId = await storedSalon()
    const created = await repository().create(salonId, newService(), [
      newOption(),
    ])
    const id = serviceIdSchema.parse(
      created.type === 'success' && created.data.type === 'created'
        ? created.data.service.service.id
        : UNKNOWN_ID,
    )
    const categoryId = (await insertCategory(databases.database(), salonId)).id

    // Act
    const updated = await repository().update(
      salonId,
      id,
      { categoryId, price: 7700 },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        service: {
          service: { id, categoryId, price: 7700 },
          options: [{ name: 'トリートメント' }],
        },
      },
    })
    const service =
      updated.type === 'success' && updated.data.type === 'updated'
        ? updated.data.service.service
        : undefined
    expect(service?.updatedAt).not.toBe(service?.createdAt)
  })

  it.each([
    ['other options', [newOption({ name: 'ブロー' })]],
    ['no options', []],
  ])(
    'should replace the options of a service with %s, and take it out of its category',
    async (_case, options) => {
      // Arrange
      const salonId = await storedSalon()
      const category = await insertCategory(databases.database(), salonId)
      const id = await storedService(salonId, { categoryId: category.id })
      await databases
        .database()
        .insert(serviceOptions)
        .values({ ...newOption(), serviceId: id })

      // Act
      const updated = await repository().update(
        salonId,
        id,
        { categoryId: null },
        { type: 'replace', options },
      )

      // Assert
      expect(updated).toMatchObject({
        type: 'success',
        data: {
          type: 'updated',
          service: {
            service: { categoryId: null },
            options: options.map(({ name }) => ({ name })),
          },
        },
      })
    },
  )

  it('should turn a package into a service of its own', async () => {
    // Arrange
    const salonId = await storedSalon()
    const { id } = await storedPackage(salonId)

    // Act
    const updated = await repository().update(
      salonId,
      id,
      { isPackage: false, packageServiceIds: [] },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        service: { service: { isPackage: false, packageServiceIds: [] } },
      },
    })
  })

  it('should change the members of a package', async () => {
    // Arrange
    const salonId = await storedSalon()
    const { id, members } = await storedPackage(salonId)
    const packageServiceIds = [...members, await storedService(salonId)]

    // Act
    const updated = await repository().update(
      salonId,
      id,
      { packageServiceIds },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        service: { service: { packageServiceIds } },
      },
    })
  })

  it('should turn a service that no package contains into a package', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedService(salonId)
    const packageServiceIds = [
      await storedService(salonId),
      await storedService(salonId),
    ]

    // Act
    const updated = await repository().update(
      salonId,
      id,
      { isPackage: true, packageServiceIds },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        service: { service: { isPackage: true, packageServiceIds } },
      },
    })
  })

  it('should not turn a service that a package contains into a package', async () => {
    // Arrange
    const salonId = await storedSalon()
    const {
      members: [member = serviceIdSchema.parse(UNKNOWN_ID)],
    } = await storedPackage(salonId)

    // Act
    const updated = await repository().update(
      salonId,
      member,
      {
        isPackage: true,
        packageServiceIds: [
          await storedService(salonId),
          await storedService(salonId),
        ],
      },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'containedInPackage' },
    })
    expect(await rowOf(member)).toMatchObject({ isPackage: false })
  })

  it('should refuse a change that breaks a rule of the service as it would be stored', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedService(salonId, {
      price: 6600,
      discountPrice: 5500,
    })

    // Act
    const updated = await repository().update(
      salonId,
      id,
      { price: 5000 },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: {
        type: 'invalid',
        issues: [
          {
            field: 'discountPrice',
            rule: 'too_big',
            message: serviceMessages.notGreaterThanPrice,
          },
        ],
      },
    })
    expect(await rowOf(id)).toMatchObject({ price: 6600 })
  })

  it.each([
    ['a category of another salon', 'other'],
    ['a category that is not there', 'unknown'],
  ])('should refuse %s', async (_case, whose) => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedService(salonId)
    const categoryId =
      whose === 'other'
        ? (await insertCategory(databases.database(), await storedSalon())).id
        : UNKNOWN_ID

    // Act
    const updated = await repository().update(
      salonId,
      id,
      { categoryId },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'categoryNotFound' },
    })
  })

  it.each([
    ['a service of another salon', 'other'],
    ['a service that was deleted', 'deleted'],
    ['a service that is not there', 'unknown'],
  ])('should not find %s', async (_case, which) => {
    // Arrange
    const salonId = await storedSalon()
    const id =
      which === 'other'
        ? await storedService(await storedSalon())
        : which === 'deleted'
          ? await storedService(salonId, DELETED)
          : serviceIdSchema.parse(UNKNOWN_ID)

    // Act
    const updated = await repository().update(
      salonId,
      id,
      { name: 'Renamed' },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'notFound', id } })
  })

  it('should answer a database error when the update writes no row', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedService(salonId)
    await databases.skipWrites('services', 'UPDATE')

    // Act
    const updated = await repository().update(
      salonId,
      id,
      { name: 'Renamed' },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of service returned no row',
        cause: null,
      },
    })
  })
})

describe('ServiceRepository.updateMany', () => {
  it('should change every one of the services, and replace the options of each', async () => {
    // Arrange
    const salonId = await storedSalon()
    const ids = [await storedService(salonId), await storedService(salonId)]

    // Act
    const updated = await repository().updateMany(
      salonId,
      ids,
      { isActive: false },
      { type: 'replace', options: [newOption()] },
    )

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'updated' } })
    for (const id of ids) {
      expect(await rowOf(id)).toMatchObject({ isActive: false })
    }
    expect(
      await databases.database().select().from(serviceOptions),
    ).toHaveLength(2)
  })

  it('should change none of the services when one of them is not there', async () => {
    // Arrange
    const salonId = await storedSalon()
    const kept = await storedService(salonId)
    const gone = await storedService(salonId, DELETED)

    // Act
    const updated = await repository().updateMany(
      salonId,
      [kept, gone],
      { isActive: false },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'notFound', id: gone },
    })
    expect(await rowOf(kept)).toMatchObject({ isActive: true })
  })

  it("should not make packages of services that are each other's members", async () => {
    // Arrange
    const salonId = await storedSalon()
    const ids = [await storedService(salonId), await storedService(salonId)]

    // Act
    const updated = await repository().updateMany(
      salonId,
      ids,
      {
        isPackage: true,
        packageServiceIds: [ids[0] ?? UNKNOWN_ID, await storedService(salonId)],
      },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'packageMemberIsPackage' },
    })
  })
})

describe('ServiceRepository.updateMany and the packages it changes', () => {
  it('should turn a member of a package into a package when that package gets other members in the same change', async () => {
    // Arrange
    const salonId = await storedSalon()
    const {
      id: packageId,
      members: [member = serviceIdSchema.parse(UNKNOWN_ID)],
    } = await storedPackage(salonId)
    const packageServiceIds = [
      await storedService(salonId),
      await storedService(salonId),
    ]

    // Act
    const updated = await repository().updateMany(
      salonId,
      [packageId, member],
      { isPackage: true, packageServiceIds },
      { type: 'keep' },
    )

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'updated' } })
    expect(await rowOf(member)).toMatchObject({
      isPackage: true,
      packageServiceIds,
    })
    expect(await rowOf(packageId)).toMatchObject({ packageServiceIds })
  })
})

describe('ServiceRepository.delete', () => {
  it('should mark a service whose bookings are all finished as deleted', async () => {
    // Arrange
    const db = databases.database()
    const salonId = await storedSalon()
    const id = await storedService(salonId)
    const parties = {
      salonId,
      customerId: (await insertCustomer(db)).id,
      staffId: (await insertStaffMember(db, salonId)).id,
    }
    for (const finished of [COMPLETED, CANCELLED]) {
      const booking = await insertBooking(db, parties, finished)
      await insertBookingLine(db, booking.id, id)
    }

    // Act
    const deleted = await repository().delete(salonId, id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    expect((await rowOf(id))?.deletedAt).not.toBeNull()
  })

  it('should keep a service that a booking which is not finished has a line of', async () => {
    // Arrange
    const db = databases.database()
    const salonId = await storedSalon()
    const id = await storedService(salonId)
    const booking = await insertBooking(
      db,
      {
        salonId,
        customerId: (await insertCustomer(db)).id,
        staffId: (await insertStaffMember(db, salonId)).id,
      },
      { status: 'in_progress', actualStartTime: '2026-12-07T01:05:00Z' },
    )
    await insertBookingLine(db, booking.id, id)

    // Act
    const deleted = await repository().delete(salonId, id)

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'bookingsUnfinished' },
    })
    expect((await rowOf(id))?.deletedAt).toBeNull()
  })

  it('should keep a service that a package contains', async () => {
    // Arrange
    const salonId = await storedSalon()
    const {
      members: [member = serviceIdSchema.parse(UNKNOWN_ID)],
    } = await storedPackage(salonId)

    // Act
    const deleted = await repository().delete(salonId, member)

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'containedInPackage' },
    })
  })

  it('should delete a service that only a deleted package contains', async () => {
    // Arrange
    const salonId = await storedSalon()
    const member = await storedService(salonId)
    await storedService(salonId, {
      isPackage: true,
      packageServiceIds: [member, await storedService(salonId)],
      ...DELETED,
    })

    // Act
    const deleted = await repository().delete(salonId, member)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
  })

  it.each([
    ['a service of another salon', 'other'],
    ['a service that was deleted', 'deleted'],
    ['a service that is not there', 'unknown'],
  ])('should not find %s', async (_case, which) => {
    // Arrange
    const salonId = await storedSalon()
    const id =
      which === 'other'
        ? await storedService(await storedSalon())
        : which === 'deleted'
          ? await storedService(salonId, DELETED)
          : serviceIdSchema.parse(UNKNOWN_ID)

    // Act
    const deleted = await repository().delete(salonId, id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'notFound' } })
  })
})

describe('ServiceRepository on a database that is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const id = serviceIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (repository: ServiceRepository) => Promise<unknown>]>([
    [
      'Failed to create service',
      (gone) => gone.create(salonId, newService(), []),
    ],
    ['Failed to find service', (gone) => gone.findById(salonId, id)],
    ['Failed to list services', (gone) => gone.list(everyServiceOf(salonId))],
    [
      'Failed to update service',
      (gone) => gone.update(salonId, id, { name: 'Renamed' }, { type: 'keep' }),
    ],
    [
      'Failed to update services',
      (gone) =>
        gone.updateMany(salonId, [id], { name: 'Renamed' }, { type: 'keep' }),
    ],
    ['Failed to delete service', (gone) => gone.delete(salonId, id)],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new ServiceRepository(await databases.gone())

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
