import { serviceCategories } from '@beauty-salon-backend/database'
import {
  type CategoryId,
  categoryIdSchema,
  type SalonId,
  type ServiceCategoryListCriteria,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { ServiceCategoryRepository } from '../service-category.repository.impl'
import { insertCategory, insertSalon, newCategory } from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new ServiceCategoryRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** A salon in the table, as a repository is given its ID. */
const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

/** A category of the salon in the table, as a repository is given its ID. */
const storedCategory = async (
  salonId: SalonId,
  overrides: Parameters<typeof insertCategory>[2] = {},
): Promise<CategoryId> =>
  categoryIdSchema.parse(
    (await insertCategory(databases.database(), salonId, overrides)).id,
  )

/** The parent of a category, as the table holds it. */
const parentOf = async (id: CategoryId) => {
  const [row] = await databases
    .database()
    .select({ parentId: serviceCategories.parentId })
    .from(serviceCategories)
    .where(eq(serviceCategories.id, id))
  return row?.parentId
}

/** Every category of the salon, a page of 20 at a time. */
const everyCategoryOf = (salonId: SalonId): ServiceCategoryListCriteria => ({
  salonId,
  limit: 20,
  after: null,
  isActive: null,
})

describe('ServiceCategoryRepository.create', () => {
  it('should store a category at the top of the hierarchy of its salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const category = newCategory({ name: 'カラー', category: 'color' })

    // Act
    const created = await repository().create(salonId, category)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created', category: { ...category, salonId } },
    })
  })

  it('should store a category below a category of its salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const parentId = await storedCategory(salonId)

    // Act
    const created = await repository().create(
      salonId,
      newCategory({ parentId }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created', category: { parentId } },
    })
  })

  it.each([
    ['a category of another salon', 'other'],
    ['a category that is not there', 'unknown'],
  ])('should refuse a parent that is %s', async (_case, whose) => {
    // Arrange
    const salonId = await storedSalon()
    const parentId =
      whose === 'other'
        ? await storedCategory(await storedSalon())
        : categoryIdSchema.parse(UNKNOWN_ID)

    // Act
    const created = await repository().create(
      salonId,
      newCategory({ parentId }),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'parentNotFound' },
    })
    expect(await repository().list(everyCategoryOf(salonId))).toMatchObject({
      type: 'success',
      data: { total: 0 },
    })
  })

  it('should answer a database error when the insert writes no row', async () => {
    // Arrange
    const salonId = await storedSalon()
    await databases.skipWrites('service_categories', 'INSERT')

    // Act
    const created = await repository().create(salonId, newCategory())

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of service category returned no row',
        cause: null,
      },
    })
  })
})

describe('ServiceCategoryRepository.findById', () => {
  it('should find a category of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedCategory(salonId)

    // Act
    const found = await repository().findById(salonId, id)

    // Assert
    expect(found).toMatchObject({ type: 'success', data: { id, salonId } })
  })

  it('should not find a category of another salon', async () => {
    // Arrange
    const id = await storedCategory(await storedSalon())

    // Act
    const found = await repository().findById(await storedSalon(), id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('ServiceCategoryRepository.list', () => {
  it('should list the categories of the salon in their order, a page at a time, the next page after the category of the cursor', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedCategory(salonId, { name: 'Third', displayOrder: 30 })
    const first = await storedCategory(salonId, {
      name: 'First',
      displayOrder: 10,
    })
    await storedCategory(salonId, { name: 'Second', displayOrder: 20 })
    await storedCategory(await storedSalon(), { name: 'Elsewhere' })

    // Act
    const firstPage = await repository().list({
      ...everyCategoryOf(salonId),
      limit: 1,
    })
    const nextPage = await repository().list({
      ...everyCategoryOf(salonId),
      limit: 1,
      after: first,
    })
    const lastPage = await repository().list({
      ...everyCategoryOf(salonId),
      limit: 5,
      after: first,
    })

    // Assert
    expect(firstPage).toMatchObject({
      type: 'success',
      data: { categories: [{ name: 'First' }], total: 3, hasMore: true },
    })
    expect(nextPage).toMatchObject({
      type: 'success',
      data: { categories: [{ name: 'Second' }], total: 3, hasMore: true },
    })
    expect(lastPage).toMatchObject({
      type: 'success',
      data: {
        categories: [{ name: 'Second' }, { name: 'Third' }],
        total: 3,
        hasMore: false,
      },
    })
  })

  it('should list the categories that are active, or those that are not', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedCategory(salonId, { name: 'Active' })
    await storedCategory(salonId, { name: 'Resting', isActive: false })

    // Act
    const resting = await repository().list({
      ...everyCategoryOf(salonId),
      isActive: false,
    })

    // Assert
    expect(resting).toMatchObject({
      type: 'success',
      data: { categories: [{ name: 'Resting' }], total: 1 },
    })
  })

  it.each([
    ['a category of another salon', 'other'],
    ['a category that is not there', 'unknown'],
  ])(
    'should answer no page for a cursor that names %s',
    async (_case, whose) => {
      // Arrange
      const salonId = await storedSalon()
      await storedCategory(salonId)
      const after =
        whose === 'other'
          ? await storedCategory(await storedSalon())
          : categoryIdSchema.parse(UNKNOWN_ID)

      // Act
      const page = await repository().list({
        ...everyCategoryOf(salonId),
        after,
      })

      // Assert
      expect(page).toEqual({ type: 'success', data: null })
    },
  )
})

describe('ServiceCategoryRepository.update', () => {
  it('should change a category and leave its place in the hierarchy', async () => {
    // Arrange
    const salonId = await storedSalon()
    const parentId = await storedCategory(salonId)
    const id = await storedCategory(salonId, { parentId })

    // Act
    const updated = await repository().update(salonId, id, {
      name: 'メンズカット',
      isActive: false,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        category: { id, parentId, name: 'メンズカット', isActive: false },
      },
    })
    const category =
      updated.type === 'success' && updated.data.type === 'updated'
        ? updated.data.category
        : undefined
    expect(category?.updatedAt).not.toBe(category?.createdAt)
  })

  it('should move a category to the top of the hierarchy', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedCategory(salonId, {
      parentId: await storedCategory(salonId),
    })

    // Act
    const updated = await repository().update(salonId, id, { parentId: null })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', category: { id, parentId: null } },
    })
  })

  it('should move a category below another category of its salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const parentId = await storedCategory(salonId)
    const id = await storedCategory(salonId)

    // Act
    const updated = await repository().update(salonId, id, { parentId })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', category: { id, parentId } },
    })
  })

  it.each([
    ['itself', 'itself'],
    ['a category below it', 'below'],
  ])('should not move a category below %s', async (_case, where) => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedCategory(salonId)
    const child = await storedCategory(salonId, { parentId: id })
    const grandchild = await storedCategory(salonId, { parentId: child })
    const parentId = where === 'itself' ? id : grandchild

    // Act
    const updated = await repository().update(salonId, id, { parentId })

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'parentWithinSubtree' },
    })
    expect(await parentOf(id)).toBeNull()
  })

  it.each([
    ['a category of another salon', 'other'],
    ['a category that is not there', 'unknown'],
  ])('should refuse a parent that is %s', async (_case, whose) => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedCategory(salonId)
    const parentId =
      whose === 'other'
        ? await storedCategory(await storedSalon())
        : categoryIdSchema.parse(UNKNOWN_ID)

    // Act
    const updated = await repository().update(salonId, id, { parentId })

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'parentNotFound' },
    })
  })

  it.each([
    ['a new parent', true],
    ['no new parent', false],
  ])(
    'should not find a category of another salon, given %s',
    async (_case, withParent) => {
      // Arrange
      const salonId = await storedSalon()
      const parentId = await storedCategory(salonId)
      const id = await storedCategory(await storedSalon())

      // Act
      const updated = await repository().update(
        salonId,
        id,
        withParent ? { parentId } : { name: 'Renamed' },
      )

      // Assert
      expect(updated).toEqual({ type: 'success', data: { type: 'notFound' } })
    },
  )
})

describe('ServiceCategoryRepository.delete', () => {
  it('should delete a category and move its subcategories to the top', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedCategory(salonId)
    const child = await storedCategory(salonId, { parentId: id })

    // Act
    const deleted = await repository().delete(salonId, id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: true })
    expect(await repository().findById(salonId, id)).toEqual({
      type: 'success',
      data: null,
    })
    expect(await parentOf(child)).toBeNull()
  })

  it('should not delete a category of another salon', async () => {
    // Arrange
    const id = await storedCategory(await storedSalon())

    // Act
    const deleted = await repository().delete(await storedSalon(), id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: false })
    expect(await parentOf(id)).toBeNull()
  })
})

describe('ServiceCategoryRepository on a database that is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const id = categoryIdSchema.parse(UNKNOWN_ID)

  it.each<
    [string, (repository: ServiceCategoryRepository) => Promise<unknown>]
  >([
    [
      'Failed to create service category',
      (gone) => gone.create(salonId, newCategory()),
    ],
    ['Failed to find service category', (gone) => gone.findById(salonId, id)],
    [
      'Failed to list service categories',
      (gone) => gone.list(everyCategoryOf(salonId)),
    ],
    [
      'Failed to update service category',
      (gone) => gone.update(salonId, id, { name: 'Renamed' }),
    ],
    ['Failed to delete service category', (gone) => gone.delete(salonId, id)],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new ServiceCategoryRepository(await databases.gone())

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
