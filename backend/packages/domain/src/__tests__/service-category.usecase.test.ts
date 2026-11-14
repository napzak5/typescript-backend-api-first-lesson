import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  CreateServiceCategoryUseCase,
  DeleteServiceCategoryUseCase,
  GetServiceCategoryUseCase,
  ListServiceCategoriesUseCase,
  type ServiceCategoryUseCaseDependencies,
  UpdateServiceCategoryUseCase,
} from '../business-logic/service-category'
import type { Actor } from '../models/auth'
import type {
  IServiceCategoryRepository,
  ServiceCategoryCreation,
  ServiceCategoryUpdate,
} from '../repositories/service-category.repository'
import { type DomainError, DomainErrors } from '../shared'
import { actors } from './auth-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import {
  CATEGORY_ID,
  dbServiceCategory,
  OTHER_CATEGORY_ID,
  serviceCategoryCreateRequest,
  serviceCategoryDependencies,
} from './service-category-fixtures'

/** A category of the salon that is neither of the two of the fixtures. */
const CURSOR_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d03'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const salonNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
}
const categoryNotFound = {
  type: 'error',
  error: expect.objectContaining({ type: 'notFound', id: CATEGORY_ID }),
}
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

/** The category of the fixtures as the API presents it. */
const apiCategory = {
  id: CATEGORY_ID,
  salonId: SALON_ID,
  name: 'カット',
  description: null,
  parentId: null,
  category: 'cut',
  displayOrder: 10,
  iconUrl: null,
  color: '#FF8800',
  isActive: true,
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
}

/** A row whose timestamp cannot be read: it cannot be turned into a response. */
const corruptCategory = dbServiceCategory({ createdAt: 'yesterday' })

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/**
 * The methods of the two repositories that were called, in the order of the
 * calls: `salons.exists`, `categories.create`, …
 */
const repositoryCalls = ({
  salonRepository,
  serviceCategoryRepository,
}: ServiceCategoryUseCaseDependencies): string[] =>
  [
    ...Object.entries(salonRepository).map(([name, method]) => ({
      name: `salons.${name}`,
      orders: callOrdersOf(method),
    })),
    ...Object.entries(serviceCategoryRepository).map(([name, method]) => ({
      name: `categories.${name}`,
      orders: callOrdersOf(method),
    })),
  ]
    .flatMap(({ name, orders }) => orders.map((order) => ({ name, order })))
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** Dependencies in which there is no such salon. */
const withoutSalon = (
  categories: Partial<IServiceCategoryRepository> = {},
): ServiceCategoryUseCaseDependencies =>
  serviceCategoryDependencies(categories, {
    exists: vi.fn(async () => Result.success(false)),
  })

/** Dependencies in which looking for the salon fails. */
const withFailingSalonLookup = (): ServiceCategoryUseCaseDependencies =>
  serviceCategoryDependencies({}, { exists: vi.fn(async () => databaseDown) })

/** Salon and category IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['an empty ID', ''],
  ['a UUID with a character too many', `${SALON_ID}0`],
  ['a UUID with a space in front', ` ${SALON_ID}`],
  ['a UUID without its hyphens', SALON_ID.replaceAll('-', '')],
]

const creating = (
  outcome: ServiceCategoryCreation,
): Partial<IServiceCategoryRepository> => ({
  create: vi.fn(async () => Result.success(outcome)),
})

const updating = (
  outcome: ServiceCategoryUpdate,
): Partial<IServiceCategoryRepository> => ({
  update: vi.fn(async () => Result.success(outcome)),
})

describe('CreateServiceCategoryUseCase', () => {
  const create = (
    dependencies: ServiceCategoryUseCaseDependencies,
    input: unknown,
    salon: unknown = SALON_ID,
  ) =>
    new CreateServiceCategoryUseCase(dependencies).execute(
      actors.admin,
      salon,
      input,
    )

  it('stores the request as it is in the salon of the path, once the salon is known to exist, and returns the stored category as the API presents it', async () => {
    const dependencies = serviceCategoryDependencies()
    const request = {
      ...serviceCategoryCreateRequest(),
      parentId: OTHER_CATEGORY_ID,
    }

    const result = await create(dependencies, request)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceCategoryRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      request,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'categories.create',
    ])
    expect(result).toEqual({ type: 'success', data: apiCategory })
  })

  it('hands null on as null for the properties that may be unset', async () => {
    const dependencies = serviceCategoryDependencies()
    const request = {
      ...serviceCategoryCreateRequest(),
      description: null,
      parentId: null,
      iconUrl: null,
      color: null,
    }

    await create(dependencies, request)

    expect(dependencies.serviceCategoryRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      request,
    )
  })

  it('stores the category in the salon of the path, whichever salon that is', async () => {
    const dependencies = serviceCategoryDependencies()

    await create(dependencies, serviceCategoryCreateRequest(), OTHER_SALON_ID)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(
      OTHER_SALON_ID,
    )
    expect(dependencies.serviceCategoryRepository.create).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      serviceCategoryCreateRequest(),
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading or writing anything',
    async (_case, salon) => {
      const dependencies = serviceCategoryDependencies()

      const result = await create(
        dependencies,
        serviceCategoryCreateRequest(),
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a blank name', { name: ' ' }, ['name:invalid_format']],
    [
      'a category that is not one of the kinds of service',
      { category: 'nails' },
      ['category:invalid_value'],
    ],
    [
      'a parent that is not an ID',
      { parentId: 'top' },
      ['parentId:invalid_format'],
    ],
    [
      'a salon in the body',
      { salonId: OTHER_SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'several broken rules',
      { displayOrder: -1, color: 'red', isActive: 'yes' },
      [
        'displayOrder:too_small',
        'color:invalid_format',
        'isActive:invalid_type',
      ],
    ],
  ])(
    'rejects %s without looking the salon up or storing anything',
    async (_case, change, expected) => {
      const dependencies = serviceCategoryDependencies()

      const result = await create(dependencies, {
        ...serviceCategoryCreateRequest(),
        ...change,
      })

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a body that is not an object', 'name=Cut'],
    ['a list of requests', [serviceCategoryCreateRequest()]],
    ['a missing body', undefined],
  ])('rejects %s', async (_case, input) => {
    const dependencies = serviceCategoryDependencies()

    const result = await create(dependencies, input)

    expect(rulesOf(result)).toEqual([':invalid_type'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a salon that does not exist, or is deleted, as not found and stores nothing', async () => {
    const dependencies = withoutSalon()

    const result = await create(dependencies, serviceCategoryCreateRequest())

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon and stores nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await create(dependencies, serviceCategoryCreateRequest())

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('refuses a parent that the repository finds to be no category of the salon as a broken rule of parentId', async () => {
    const dependencies = serviceCategoryDependencies(
      creating({ type: 'parentNotFound' }),
    )

    const result = await create(dependencies, {
      ...serviceCategoryCreateRequest(),
      parentId: OTHER_CATEGORY_ID,
    })

    expect(rulesOf(result)).toEqual(['parentId:not_found'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceCategoryDependencies({
      create: vi.fn(async () => databaseDown),
    })

    const result = await create(dependencies, serviceCategoryCreateRequest())

    expect(result).toEqual(databaseDown)
  })

  it('reports a stored category that cannot be presented as a database error', async () => {
    const dependencies = serviceCategoryDependencies(
      creating({ type: 'created', category: corruptCategory }),
    )

    const result = await create(dependencies, serviceCategoryCreateRequest())

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('GetServiceCategoryUseCase', () => {
  const get = (
    dependencies: ServiceCategoryUseCaseDependencies,
    id: unknown = CATEGORY_ID,
    salon: unknown = SALON_ID,
  ) => new GetServiceCategoryUseCase(dependencies).execute(salon, id)

  it('returns the category of the salon as the API presents it', async () => {
    const dependencies = serviceCategoryDependencies()

    const result = await get(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(
      dependencies.serviceCategoryRepository.findById,
    ).toHaveBeenCalledWith(SALON_ID, CATEGORY_ID)
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'categories.findById',
    ])
    expect(result).toEqual({ type: 'success', data: apiCategory })
  })

  it('looks for the category in the salon of the path only', async () => {
    const dependencies = serviceCategoryDependencies()

    await get(dependencies, CATEGORY_ID, OTHER_SALON_ID)

    expect(
      dependencies.serviceCategoryRepository.findById,
    ).toHaveBeenCalledWith(OTHER_SALON_ID, CATEGORY_ID)
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading anything',
    async (_case, salon) => {
      const dependencies = serviceCategoryDependencies()

      const result = await get(dependencies, CATEGORY_ID, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the category ID without reading anything',
    async (_case, id) => {
      const dependencies = serviceCategoryDependencies()

      const result = await get(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found without looking for the category', async () => {
    const dependencies = withoutSalon()

    const result = await get(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('reports a category the salon does not have as not found', async () => {
    const dependencies = serviceCategoryDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await get(dependencies)

    expect(result).toEqual(categoryNotFound)
  })

  it('passes on a failure to look for the salon', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await get(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceCategoryDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    const result = await get(dependencies)

    expect(result).toEqual(databaseDown)
  })

  it('reports a stored category that cannot be presented as a database error', async () => {
    const dependencies = serviceCategoryDependencies({
      findById: vi.fn(async () => Result.success(corruptCategory)),
    })

    const result = await get(dependencies)

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('ListServiceCategoriesUseCase', () => {
  const list = (
    dependencies: ServiceCategoryUseCaseDependencies,
    input: unknown = {},
    salon: unknown = SALON_ID,
  ) => new ListServiceCategoriesUseCase(dependencies).execute(salon, input)

  const listing = (
    categories = [dbServiceCategory()],
    total = categories.length,
    hasMore = false,
  ): Partial<IServiceCategoryRepository> => ({
    list: vi.fn(async () => Result.success({ categories, total, hasMore })),
  })

  it('lists the first 20 categories of the salon, active or not, by default', async () => {
    const dependencies = serviceCategoryDependencies()

    const result = await list(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceCategoryRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      isActive: null,
    })
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'categories.list',
    ])
    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiCategory],
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it.each([true, false])(
    'asks for a page of the given size after the category the cursor names, with isActive %s',
    async (isActive) => {
      const dependencies = serviceCategoryDependencies()

      await list(
        dependencies,
        { limit: 5, cursor: OTHER_CATEGORY_ID, isActive },
        OTHER_SALON_ID,
      )

      expect(dependencies.serviceCategoryRepository.list).toHaveBeenCalledWith({
        salonId: OTHER_SALON_ID,
        limit: 5,
        after: OTHER_CATEGORY_ID,
        isActive,
      })
    },
  )

  it('returns the categories in the order of the repository and names the last one as the next cursor when more follow', async () => {
    const dependencies = serviceCategoryDependencies(
      listing(
        [
          dbServiceCategory({ id: OTHER_CATEGORY_ID, displayOrder: 1 }),
          dbServiceCategory({ displayOrder: 2 }),
        ],
        7,
        true,
      ),
    )

    const result = await list(dependencies, { limit: 2, cursor: CURSOR_ID })

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [
          { ...apiCategory, id: OTHER_CATEGORY_ID, displayOrder: 1 },
          { ...apiCategory, displayOrder: 2 },
        ],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: CURSOR_ID,
          nextCursor: CATEGORY_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor for the last page, and repeats the cursor of the request', async () => {
    const dependencies = serviceCategoryDependencies(listing(undefined, 3))

    const result = await list(dependencies, { cursor: OTHER_CATEGORY_ID })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 3,
          hasMore: false,
          cursor: OTHER_CATEGORY_ID,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('returns an empty page when the salon has no category that matches', async () => {
    const dependencies = serviceCategoryDependencies(listing([]))

    const result = await list(dependencies, { isActive: false })

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [],
        meta: {
          total: 0,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('refuses a cursor that the repository finds to name no category of the salon as a broken rule of the cursor', async () => {
    const dependencies = serviceCategoryDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, { cursor: OTHER_CATEGORY_ID })

    expect(rulesOf(result)).toEqual(['cursor:not_found'])
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading anything',
    async (_case, salon) => {
      const dependencies = serviceCategoryDependencies()

      const result = await list(dependencies, {}, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    [
      'a cursor that is not an ID',
      { cursor: 'page-2' },
      ['cursor:invalid_format'],
    ],
    [
      'the salon as a parameter of the search',
      { salonId: OTHER_SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'several broken rules',
      { limit: 1000, sort: 'name' },
      ['limit:too_big', 'sort:unrecognized_keys'],
    ],
  ])('rejects %s without reading anything', async (_case, input, expected) => {
    const dependencies = serviceCategoryDependencies()

    const result = await list(dependencies, input)

    expect(rulesOf(result)).toEqual(expected)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a salon that does not exist, or is deleted, as not found without listing anything', async () => {
    const dependencies = withoutSalon()

    const result = await list(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await list(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceCategoryDependencies({
      list: vi.fn(async () => databaseDown),
    })

    const result = await list(dependencies)

    expect(result).toEqual(databaseDown)
  })

  it('reports a page with a stored category that cannot be presented as a database error', async () => {
    const dependencies = serviceCategoryDependencies(
      listing([dbServiceCategory(), corruptCategory]),
    )

    const result = await list(dependencies)

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateServiceCategoryUseCase', () => {
  const update = (
    dependencies: ServiceCategoryUseCaseDependencies,
    input: unknown,
    id: unknown = CATEGORY_ID,
    salon: unknown = SALON_ID,
  ) =>
    new UpdateServiceCategoryUseCase(dependencies).execute(
      actors.admin,
      salon,
      id,
      input,
    )

  it('hands only the properties of the request to the repository, once the salon is known to exist, and returns the category as it is afterwards', async () => {
    const dependencies = serviceCategoryDependencies()

    const result = await update(dependencies, {
      name: 'Renamed',
      description: null,
    })

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceCategoryRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      CATEGORY_ID,
      {
        name: 'Renamed',
        description: null,
      },
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'categories.update',
    ])
    expect(result).toEqual({ type: 'success', data: apiCategory })
  })

  it.each([
    ['a new parent', { parentId: OTHER_CATEGORY_ID }],
    ['no parent', { parentId: null }],
    ['every property at once', serviceCategoryCreateRequest()],
  ])('hands %s on as it is given', async (_case, input) => {
    const dependencies = serviceCategoryDependencies()

    const result = await update(dependencies, input)

    expect(dependencies.serviceCategoryRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      CATEGORY_ID,
      input,
    )
    expect(result.type).toBe('success')
  })

  it('changes the category of the salon in the path, whichever salon that is', async () => {
    const dependencies = serviceCategoryDependencies()

    await update(
      dependencies,
      { name: 'Renamed' },
      OTHER_CATEGORY_ID,
      OTHER_SALON_ID,
    )

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(
      OTHER_SALON_ID,
    )
    expect(dependencies.serviceCategoryRepository.update).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      OTHER_CATEGORY_ID,
      {
        name: 'Renamed',
      },
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading or writing anything',
    async (_case, salon) => {
      const dependencies = serviceCategoryDependencies()

      const result = await update(
        dependencies,
        { name: 'Renamed' },
        CATEGORY_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the category ID without reading or writing anything',
    async (_case, id) => {
      const dependencies = serviceCategoryDependencies()

      const result = await update(dependencies, { name: 'Renamed' }, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['an empty request', {}, [':custom']],
    [
      'null for a property that is never unset',
      { name: null },
      ['name:invalid_type'],
    ],
    [
      'a value that breaks the rule of its property',
      { color: '#FFF' },
      ['color:invalid_format'],
    ],
    [
      'a parent that is not an ID',
      { parentId: 'top' },
      ['parentId:invalid_format'],
    ],
    [
      'another salon for the category',
      { salonId: OTHER_SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'a property the client may not set',
      { name: 'Renamed', createdAt: '2026-11-14T09:00:00.000Z' },
      ['createdAt:unrecognized_keys'],
    ],
    ['a body that is not an object', 'name=Renamed', [':invalid_type']],
    ['a missing body', undefined, [':invalid_type']],
  ])(
    'rejects %s without looking the salon up or changing anything',
    async (_case, input, expected) => {
      const dependencies = serviceCategoryDependencies()

      const result = await update(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and changes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await update(dependencies, { name: 'Renamed' })

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon and changes nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await update(dependencies, { name: 'Renamed' })

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('reports a category that the repository does not find in the salon as not found', async () => {
    const dependencies = serviceCategoryDependencies(
      updating({ type: 'notFound' }),
    )

    const result = await update(dependencies, { parentId: OTHER_CATEGORY_ID })

    expect(result).toEqual(categoryNotFound)
  })

  it('refuses a parent that the repository finds to be no category of the salon as a broken rule of parentId', async () => {
    const dependencies = serviceCategoryDependencies(
      updating({ type: 'parentNotFound' }),
    )

    const result = await update(dependencies, { parentId: OTHER_CATEGORY_ID })

    expect(rulesOf(result)).toEqual(['parentId:not_found'])
  })

  it('refuses a parent that the repository finds to be the category itself or one below it as a circular parentId', async () => {
    const dependencies = serviceCategoryDependencies(
      updating({ type: 'parentWithinSubtree' }),
    )

    const result = await update(dependencies, { parentId: CATEGORY_ID })

    expect(rulesOf(result)).toEqual(['parentId:circular'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceCategoryDependencies({
      update: vi.fn(async () => databaseDown),
    })

    const result = await update(dependencies, { name: 'Renamed' })

    expect(result).toEqual(databaseDown)
  })

  it('reports a changed category that cannot be presented as a database error', async () => {
    const dependencies = serviceCategoryDependencies(
      updating({ type: 'updated', category: corruptCategory }),
    )

    const result = await update(dependencies, { name: 'Renamed' })

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('DeleteServiceCategoryUseCase', () => {
  const remove = (
    dependencies: ServiceCategoryUseCaseDependencies,
    id: unknown = CATEGORY_ID,
    salon: unknown = SALON_ID,
  ) =>
    new DeleteServiceCategoryUseCase(dependencies).execute(
      actors.admin,
      salon,
      id,
    )

  it('deletes the category of the salon, once the salon is known to exist, and returns its ID', async () => {
    const dependencies = serviceCategoryDependencies()

    const result = await remove(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.serviceCategoryRepository.delete).toHaveBeenCalledWith(
      SALON_ID,
      CATEGORY_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'categories.delete',
    ])
    expect(result).toEqual({ type: 'success', data: CATEGORY_ID })
  })

  it('deletes from the salon of the path only, whichever salon that is', async () => {
    const dependencies = serviceCategoryDependencies()

    await remove(dependencies, CATEGORY_ID, OTHER_SALON_ID)

    expect(dependencies.serviceCategoryRepository.delete).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      CATEGORY_ID,
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID without reading or deleting anything',
    async (_case, salon) => {
      const dependencies = serviceCategoryDependencies()

      const result = await remove(dependencies, CATEGORY_ID, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the category ID without reading or deleting anything',
    async (_case, id) => {
      const dependencies = serviceCategoryDependencies()

      const result = await remove(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and deletes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await remove(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('reports a category the salon does not have, or no longer has, as not found', async () => {
    const dependencies = serviceCategoryDependencies({
      delete: vi.fn(async () => Result.success(false)),
    })

    const result = await remove(dependencies)

    expect(result).toEqual(categoryNotFound)
  })

  it('passes on a failure to look for the salon and deletes nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await remove(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = serviceCategoryDependencies({
      delete: vi.fn(async () => databaseDown),
    })

    const result = await remove(dependencies)

    expect(result).toEqual(databaseDown)
  })
})

describe('who may manage the service categories of a salon', () => {
  /** What a request says; whatever a test leaves out is valid. */
  type Request = { salon?: unknown; id?: unknown; input?: unknown }

  type Operation = (
    dependencies: ServiceCategoryUseCaseDependencies,
    actor: Actor,
    request?: Request,
  ) => Promise<Result<unknown, DomainError>>

  /** A request in which everything but the salon ID is wrong. */
  const wrongAfterTheSalon: Request = { id: 'latest', input: { name: '' } }

  /** Repositories in which the salon is not there and no write would succeed. */
  const nothingThere = (): ServiceCategoryUseCaseDependencies =>
    withoutSalon({
      ...creating({ type: 'parentNotFound' }),
      ...updating({ type: 'notFound' }),
      delete: vi.fn(async () => Result.success(false)),
    })

  const allowed: [string, Actor][] = [
    ['an admin', actors.admin],
    ['the owner of the salon', actors.ofSalon('owner', SALON_ID)],
    ['a manager of the salon', actors.ofSalon('manager', SALON_ID)],
  ]

  const refused: [string, Actor][] = [
    ['a staff member of the salon', actors.ofSalon('staff', SALON_ID)],
    ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
    [
      'a staff member of another salon',
      actors.ofSalon('staff', OTHER_SALON_ID),
    ],
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ]

  describe.each<[string, Operation, string]>([
    [
      'create a category',
      (
        dependencies,
        actor,
        { salon = SALON_ID, input = serviceCategoryCreateRequest() } = {},
      ) =>
        new CreateServiceCategoryUseCase(dependencies).execute(
          actor,
          salon,
          input,
        ),
      'categories.create',
    ],
    [
      'change a category',
      (
        dependencies,
        actor,
        {
          salon = SALON_ID,
          id = CATEGORY_ID,
          input = { name: 'Renamed' },
        } = {},
      ) =>
        new UpdateServiceCategoryUseCase(dependencies).execute(
          actor,
          salon,
          id,
          input,
        ),
      'categories.update',
    ],
    [
      'delete a category',
      (dependencies, actor, { salon = SALON_ID, id = CATEGORY_ID } = {}) =>
        new DeleteServiceCategoryUseCase(dependencies).execute(
          actor,
          salon,
          id,
        ),
      'categories.delete',
    ],
  ])('to %s', (_operation, execute, write) => {
    it.each(allowed)('lets %s do it', async (_case, actor) => {
      const dependencies = serviceCategoryDependencies()

      const result = await execute(dependencies, actor)

      expect(result.type).toBe('success')
      expect(repositoryCalls(dependencies)).toEqual(['salons.exists', write])
    })

    it.each(refused)(
      'forbids %s, and reads and writes nothing',
      async (_case, actor) => {
        const dependencies = serviceCategoryDependencies()

        const result = await execute(dependencies, actor)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(refused)(
      'forbids %s before looking at the category ID or the body, and before looking for the salon or the category',
      async (_case, actor) => {
        const dependencies = nothingThere()

        const result = await execute(dependencies, actor, wrongAfterTheSalon)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it('decides from the salon of the path: the owner of another salon may do it there, and the owner of this salon may not', async () => {
      const there = serviceCategoryDependencies()
      const here = serviceCategoryDependencies()

      const inTheirSalon = await execute(
        there,
        actors.ofSalon('owner', OTHER_SALON_ID),
        { salon: OTHER_SALON_ID },
      )
      const inAnotherSalon = await execute(
        here,
        actors.ofSalon('owner', SALON_ID),
        { salon: OTHER_SALON_ID },
      )

      expect(inTheirSalon.type).toBe('success')
      expect(there.salonRepository.exists).toHaveBeenCalledWith(OTHER_SALON_ID)
      expect(inAnotherSalon).toEqual(forbidden)
      expect(repositoryCalls(here)).toEqual([])
    })

    it.each([...allowed, ...refused])(
      'rejects a salon ID that is not a UUID from %s as invalid, whatever else is wrong',
      async (_case, actor) => {
        const dependencies = nothingThere()

        const result = await execute(dependencies, actor, {
          ...wrongAfterTheSalon,
          salon: 'latest',
        })

        expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(allowed)(
      'tells %s that the salon is not found only once the rest of the request is valid',
      async (_case, actor) => {
        const invalid = nothingThere()
        const valid = nothingThere()

        const withInvalidRequest = await execute(
          invalid,
          actor,
          wrongAfterTheSalon,
        )
        const withValidRequest = await execute(valid, actor)

        expect(withInvalidRequest).toMatchObject({
          type: 'error',
          error: { type: 'validation' },
        })
        expect(repositoryCalls(invalid)).toEqual([])
        expect(withValidRequest).toEqual(salonNotFound)
        expect(repositoryCalls(valid)).toEqual(['salons.exists'])
      },
    )
  })

  describe('the order of the checks', () => {
    const change = (
      dependencies: ServiceCategoryUseCaseDependencies,
      {
        salon = SALON_ID,
        id = CATEGORY_ID,
        input = { name: 'Renamed' },
      }: Request,
    ) =>
      new UpdateServiceCategoryUseCase(dependencies).execute(
        actors.admin,
        salon,
        id,
        input,
      )

    it('looks at the category ID before the body', async () => {
      const dependencies = nothingThere()

      const result = await change(dependencies, {
        id: 'latest',
        input: { name: '' },
      })

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('looks at the body before looking for the salon', async () => {
      const dependencies = nothingThere()

      const result = await change(dependencies, { input: { name: '' } })

      expect(rulesOf(result)).toEqual(['name:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('looks for the salon before the category and its parent', async () => {
      const dependencies = nothingThere()

      const result = await change(dependencies, {
        input: { parentId: OTHER_CATEGORY_ID },
      })

      expect(result).toEqual(salonNotFound)
      expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
    })

    it('looks at the body of a creation before looking for the salon, and for the salon before the parent', async () => {
      const invalid = nothingThere()
      const valid = nothingThere()
      const create = (
        dependencies: ServiceCategoryUseCaseDependencies,
        input: unknown,
      ) =>
        new CreateServiceCategoryUseCase(dependencies).execute(
          actors.admin,
          SALON_ID,
          input,
        )

      const withInvalidBody = await create(invalid, {
        ...serviceCategoryCreateRequest(),
        parentId: 'top',
      })
      const withValidBody = await create(valid, {
        ...serviceCategoryCreateRequest(),
        parentId: OTHER_CATEGORY_ID,
      })

      expect(rulesOf(withInvalidBody)).toEqual(['parentId:invalid_format'])
      expect(repositoryCalls(invalid)).toEqual([])
      expect(withValidBody).toEqual(salonNotFound)
      expect(repositoryCalls(valid)).toEqual(['salons.exists'])
    })

    it('looks at the category ID of a deletion before looking for the salon', async () => {
      const dependencies = nothingThere()

      const result = await new DeleteServiceCategoryUseCase(
        dependencies,
      ).execute(actors.admin, SALON_ID, 'latest')

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })
  })
})
