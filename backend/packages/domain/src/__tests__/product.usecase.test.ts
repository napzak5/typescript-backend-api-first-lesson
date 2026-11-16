import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  type ProductUseCaseDependencies,
  type StockLevelOrder,
  UpdateProductUseCase,
} from '../business-logic/product'
import type { Actor } from '../models/auth'
import type {
  IProductRepository,
  ProductRemoval,
  ProductUpdate,
} from '../repositories/product.repository'
import { type DomainError, DomainErrors } from '../shared'
import { actors } from './auth-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import {
  dbProduct,
  OTHER_PRODUCT_ID,
  PRODUCT_ID,
  productCreateRequest,
  productDependencies,
} from './product-fixtures'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const salonNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
}
const productNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Product', id: PRODUCT_ID },
}
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

/** The product of the fixtures as the API presents it. */
const apiProduct = {
  id: PRODUCT_ID,
  salonId: SALON_ID,
  productCode: 'SHMP001',
  name: 'プロフェッショナル シャンプー 500ml',
  description: null,
  category: 'Hair Care',
  brand: 'Salon Pro',
  purchasePrice: 1500,
  retailPrice: null,
  salonPrice: 3000,
  unit: '本',
  minimumStock: 5,
  maximumStock: 50.25,
  reorderPoint: null,
  supplier: 'Tokyo Beauty Supply',
  supplierProductCode: null,
  leadTimeDays: 7,
  imageUrl: null,
  barcode: '4901234567890',
  isForSale: true,
  isForTreatment: false,
  requiresLotTracking: true,
  expiryMonths: 36,
  storageConditions: null,
  safetyDataSheet: null,
  isActive: true,
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
}

/** The request of the fixtures as the repository is given it. */
const newProduct = {
  ...productCreateRequest(),
  minimumStock: '5',
  maximumStock: '50',
  reorderPoint: '10.5',
}

/** A row whose timestamp cannot be read: it cannot be turned into a response. */
const corruptProduct = dbProduct({ createdAt: 'yesterday' })

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** What a refused request is told, by `field`. */
const messagesOf = (
  result: Result<unknown, DomainError>,
): Record<string, string> =>
  result.type === 'error' && result.error.type === 'validation'
    ? Object.fromEntries(
        result.error.issues.map(({ field, message }) => [field, message]),
      )
    : {}

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/**
 * The methods of the two repositories that were called, in the order of the
 * calls: `salons.exists`, `products.create`, …
 */
const repositoryCalls = ({
  salonRepository,
  productRepository,
}: ProductUseCaseDependencies): string[] =>
  [
    ...Object.entries(salonRepository).map(([name, method]) => ({
      name: `salons.${name}`,
      orders: callOrdersOf(method),
    })),
    ...Object.entries(productRepository).map(([name, method]) => ({
      name: `products.${name}`,
      orders: callOrdersOf(method),
    })),
  ]
    .flatMap(({ name, orders }) => orders.map((order) => ({ name, order })))
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** Dependencies in which there is no such salon. */
const withoutSalon = (): ProductUseCaseDependencies =>
  productDependencies({}, { exists: vi.fn(async () => Result.success(false)) })

/** Dependencies in which looking for the salon fails. */
const withFailingSalonLookup = (): ProductUseCaseDependencies =>
  productDependencies({}, { exists: vi.fn(async () => databaseDown) })

/** Salon and product IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['an empty ID', ''],
  ['a UUID with a character too many', `${SALON_ID}0`],
  ['a UUID with a space in front', ` ${SALON_ID}`],
  ['a UUID without its hyphens', SALON_ID.replaceAll('-', '')],
]

/** Who reads the products of the salon of the fixtures. */
const readers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['a manager of the salon', actors.ofSalon('manager')],
  ['a staff member of the salon', actors.ofSalon('staff')],
]

/** Who does not. */
const notReaders: [string, Actor][] = [
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
  ['a staff member of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account without a scope', actors.withoutScope],
]

/** Who keeps the products of the salon of the fixtures. */
const keepers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['a manager of the salon', actors.ofSalon('manager')],
]

/** Who does not: a staff member of the salon reads them and no more. */
const notKeepers: [string, Actor][] = [
  ['a staff member of the salon', actors.ofSalon('staff')],
  ...notReaders,
]

const updating = (outcome: ProductUpdate): Partial<IProductRepository> => ({
  update: vi.fn(async () => Result.success(outcome)),
})

const removing = (outcome: ProductRemoval): Partial<IProductRepository> => ({
  delete: vi.fn(async () => Result.success(outcome)),
})

describe('ListProductsUseCase', () => {
  const list = (
    dependencies: ProductUseCaseDependencies,
    query: unknown = {},
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) =>
    new ListProductsUseCase(dependencies).execute(
      actor,
      salon,
      Result.success(query),
    )

  it('lists the products of the salon of the path, 20 to a page and unfiltered unless the query says otherwise, once the salon is known to exist', async () => {
    const dependencies = productDependencies()

    const result = await list(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.productRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      keyword: null,
      category: null,
      barcode: null,
      isActive: null,
      isForSale: null,
      isForTreatment: null,
    })
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'products.list',
    ])
    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiProduct],
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

  it('hands the limit, the cursor and the filters of the query on', async () => {
    const dependencies = productDependencies()

    const result = await list(dependencies, {
      limit: 5,
      cursor: OTHER_PRODUCT_ID,
      keyword: 'シャンプー',
      category: 'Hair Care',
      barcode: '4901234567890',
      isActive: false,
      isForSale: false,
      isForTreatment: false,
    })

    expect(dependencies.productRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 5,
      after: OTHER_PRODUCT_ID,
      keyword: 'シャンプー',
      category: 'Hair Care',
      barcode: '4901234567890',
      isActive: false,
      isForSale: false,
      isForTreatment: false,
    })
    // The page repeats its cursor and names none for the page before it:
    // pages are only walked forwards.
    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: { limit: 5, cursor: OTHER_PRODUCT_ID, prevCursor: null },
      },
    })
  })

  it('hands on a filter for the true value of a flag as that, not as no filter', async () => {
    const dependencies = productDependencies()

    await list(dependencies, {
      isActive: true,
      isForSale: true,
      isForTreatment: true,
    })

    expect(dependencies.productRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        isForSale: true,
        isForTreatment: true,
      }),
    )
  })

  it.each(['isActive', 'isForSale', 'isForTreatment'] as const)(
    'hands on %s as its own filter, and no other flag',
    async (flag) => {
      const dependencies = productDependencies()

      await list(dependencies, { [flag]: false })

      expect(dependencies.productRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: null,
          isForSale: null,
          isForTreatment: null,
          [flag]: false,
        }),
      )
    },
  )

  it('names the last product of a page as the cursor of the next one when more follow', async () => {
    const dependencies = productDependencies({
      list: vi.fn(async () =>
        Result.success({
          products: [dbProduct(), dbProduct({ id: OTHER_PRODUCT_ID })],
          total: 7,
          hasMore: true,
        }),
      ),
    })

    const result = await list(dependencies, { limit: 2 })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: PRODUCT_ID }, { id: OTHER_PRODUCT_ID }],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: OTHER_PRODUCT_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor for the last page, although it has products', async () => {
    const result = await list(productDependencies(), { limit: 1 })

    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { hasMore: false, nextCursor: null } },
    })
  })

  it('returns an empty page for a salon without products', async () => {
    const dependencies = productDependencies({
      list: vi.fn(async () =>
        Result.success({ products: [], total: 0, hasMore: false }),
      ),
    })

    const result = await list(dependencies)

    expect(result).toMatchObject({
      type: 'success',
      data: { data: [], meta: { total: 0, hasMore: false, nextCursor: null } },
    })
  })

  it.each(readers)('lets %s read them', async (_who, actor) => {
    const result = await list(productDependencies(), {}, actor)

    expect(result.type).toBe('success')
  })

  it.each(notReaders)(
    'refuses %s, whatever the query is, without reading anything',
    async (_who, actor) => {
      const dependencies = productDependencies()

      const refused = await list(dependencies, { limit: 0 }, actor)
      const undecodable = await new ListProductsUseCase(dependencies).execute(
        actor,
        SALON_ID,
        Result.error(DomainErrors.validation('Invalid', [])),
      )

      expect(refused).toEqual(forbidden)
      expect(undecodable).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('lets the owner of another salon read the products of that salon', async () => {
    const dependencies = productDependencies()

    const result = await list(
      dependencies,
      {},
      actors.ofSalon('owner', OTHER_SALON_ID),
      OTHER_SALON_ID,
    )

    expect(result.type).toBe('success')
    expect(dependencies.productRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: OTHER_SALON_ID }),
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = productDependencies()

      const result = await list(dependencies, {}, actors.customer, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('passes on a query that could not be decoded to an actor who may read', async () => {
    const dependencies = productDependencies()
    const undecodable = Result.error(
      DomainErrors.validation('Invalid product search', [
        { field: 'limit', rule: 'invalid_type', message: 'Must be a number' },
      ]),
    )

    const result = await new ListProductsUseCase(dependencies).execute(
      actors.admin,
      SALON_ID,
      undecodable,
    )

    expect(result).toEqual(undecodable)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a cursor that is not an ID', { cursor: 'x' }, ['cursor:invalid_format']],
    ['a blank keyword', { keyword: ' ' }, ['keyword:invalid_format']],
    [
      'a keyword of 101 characters',
      { keyword: 'a'.repeat(101) },
      ['keyword:too_big'],
    ],
    ['an empty category', { category: '' }, ['category:invalid_format']],
    [
      'a barcode of 101 characters',
      { barcode: '1'.repeat(101) },
      ['barcode:too_big'],
    ],
    ['a flag that is text', { isForSale: 'yes' }, ['isForSale:invalid_type']],
    ['a parameter that is not known', { page: 2 }, ['page:unrecognized_keys']],
  ])(
    'rejects %s without looking the salon up',
    async (_case, query, expected) => {
      const dependencies = productDependencies()

      const result = await list(dependencies, query)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: 'Invalid product search' },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and lists nothing', async () => {
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

  it('refuses a cursor that names no product of the salon as a broken rule of the cursor', async () => {
    const dependencies = productDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, {
      cursor: OTHER_PRODUCT_ID,
    })

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: 'Invalid product search',
        issues: [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a product of the salon',
          },
        ],
      },
    })
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = productDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored product that cannot be presented as a database error', async () => {
    const dependencies = productDependencies({
      list: vi.fn(async () =>
        Result.success({
          products: [dbProduct(), corruptProduct],
          total: 2,
          hasMore: false,
        }),
      ),
    })

    expect(await list(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('CreateProductUseCase', () => {
  const create = (
    dependencies: ProductUseCaseDependencies,
    input: unknown,
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) => new CreateProductUseCase(dependencies).execute(actor, salon, input)

  it('stores the request in the salon of the path, the stock levels as text, once the salon is known to exist, and returns the stored product as the API presents it', async () => {
    const dependencies = productDependencies()

    const result = await create(dependencies, productCreateRequest())

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.productRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      newProduct,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'products.create',
    ])
    expect(result).toEqual({ type: 'success', data: apiProduct })
  })

  it('hands null on as null for the properties that may be unset', async () => {
    const dependencies = productDependencies()
    const unset = {
      description: null,
      category: null,
      brand: null,
      purchasePrice: null,
      retailPrice: null,
      salonPrice: null,
      maximumStock: null,
      reorderPoint: null,
      supplier: null,
      supplierProductCode: null,
      leadTimeDays: null,
      imageUrl: null,
      barcode: null,
      expiryMonths: null,
      storageConditions: null,
      safetyDataSheet: null,
    }

    await create(dependencies, { ...productCreateRequest(), ...unset })

    expect(dependencies.productRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      { ...newProduct, ...unset },
    )
  })

  it('stores the product in the salon of the path, whichever salon that is', async () => {
    const dependencies = productDependencies()

    await create(
      dependencies,
      productCreateRequest(),
      actors.admin,
      OTHER_SALON_ID,
    )

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(
      OTHER_SALON_ID,
    )
    expect(dependencies.productRepository.create).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      newProduct,
    )
  })

  it.each(keepers)('lets %s add one', async (_who, actor) => {
    const result = await create(
      productDependencies(),
      productCreateRequest(),
      actor,
    )

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s, whatever the request is, without reading or writing anything',
    async (_who, actor) => {
      const dependencies = productDependencies()

      const refused = await create(dependencies, productCreateRequest(), actor)
      const withoutBody = await create(dependencies, undefined, actor)

      expect(refused).toEqual(forbidden)
      expect(withoutBody).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = productDependencies()

      const result = await create(
        dependencies,
        productCreateRequest(),
        actors.customer,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a blank name', { name: ' ' }, ['name:invalid_format']],
    [
      'stock levels out of order',
      { minimumStock: 20, reorderPoint: 10, maximumStock: 15 },
      ['reorderPoint:custom', 'maximumStock:custom'],
    ],
    [
      'a salon in the body',
      { salonId: OTHER_SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'the time it was deleted',
      { deletedAt: null },
      ['deletedAt:unrecognized_keys'],
    ],
    [
      'several broken rules',
      { purchasePrice: -1, leadTimeDays: 1.5, isActive: 'yes' },
      [
        'purchasePrice:too_small',
        'leadTimeDays:invalid_type',
        'isActive:invalid_type',
      ],
    ],
  ])(
    'rejects %s without looking the salon up or storing anything',
    async (_case, change, expected) => {
      const dependencies = productDependencies()

      const result = await create(dependencies, {
        ...productCreateRequest(),
        ...change,
      })

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: 'Invalid product' },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a body that is not an object', 'productCode=SHMP001'],
    ['a list of requests', [productCreateRequest()]],
    ['a missing body', undefined],
  ])('rejects %s', async (_case, input) => {
    const dependencies = productDependencies()

    const result = await create(dependencies, input)

    expect(rulesOf(result)).toEqual([':invalid_type'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a salon that does not exist, or is deleted, as not found and stores nothing', async () => {
    const dependencies = withoutSalon()

    const result = await create(dependencies, productCreateRequest())

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon and stores nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await create(dependencies, productCreateRequest())

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = productDependencies({
      create: vi.fn(async () => databaseDown),
    })

    expect(await create(dependencies, productCreateRequest())).toEqual(
      databaseDown,
    )
  })

  it('reports a stored product that cannot be presented as a database error', async () => {
    const dependencies = productDependencies({
      create: vi.fn(async () => Result.success(corruptProduct)),
    })

    expect(await create(dependencies, productCreateRequest())).toEqual(
      storedRowIsCorrupt,
    )
  })
})

describe('GetProductUseCase', () => {
  const get = (
    dependencies: ProductUseCaseDependencies,
    id: unknown = PRODUCT_ID,
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) => new GetProductUseCase(dependencies).execute(actor, salon, id)

  it('returns the product of the salon as the API presents it, once the salon is known to exist', async () => {
    const dependencies = productDependencies()

    const result = await get(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.productRepository.findById).toHaveBeenCalledWith(
      SALON_ID,
      PRODUCT_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'products.findById',
    ])
    expect(result).toEqual({ type: 'success', data: apiProduct })
  })

  it('returns one that is not active as well', async () => {
    const dependencies = productDependencies({
      findById: vi.fn(async () =>
        Result.success(dbProduct({ isActive: false })),
      ),
    })

    expect(await get(dependencies)).toMatchObject({
      type: 'success',
      data: { isActive: false },
    })
  })

  it('reads an ID written in upper case as the lower-case ID', async () => {
    const dependencies = productDependencies()

    await get(dependencies, PRODUCT_ID.toUpperCase())

    expect(dependencies.productRepository.findById).toHaveBeenCalledWith(
      SALON_ID,
      PRODUCT_ID,
    )
  })

  it.each(readers)('lets %s read one', async (_who, actor) => {
    const result = await get(productDependencies(), PRODUCT_ID, actor)

    expect(result.type).toBe('success')
  })

  it.each(notReaders)(
    'refuses %s, whatever the ID is, without reading anything',
    async (_who, actor) => {
      const dependencies = productDependencies()

      const refused = await get(dependencies, PRODUCT_ID, actor)
      const malformed = await get(dependencies, 'latest', actor)

      expect(refused).toEqual(forbidden)
      expect(malformed).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = productDependencies()

      const result = await get(dependencies, PRODUCT_ID, actors.customer, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the ID without looking anything up',
    async (_case, id) => {
      const dependencies = productDependencies()

      const result = await get(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(result).toMatchObject({
        error: { message: 'Invalid product ID' },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found without looking for the product', async () => {
    const dependencies = withoutSalon()

    const result = await get(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    expect(await get(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('reports a product that the salon does not have as not found', async () => {
    const dependencies = productDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    expect(await get(dependencies)).toEqual(productNotFound)
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = productDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored product that cannot be presented as a database error', async () => {
    const dependencies = productDependencies({
      findById: vi.fn(async () => Result.success(corruptProduct)),
    })

    expect(await get(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateProductUseCase', () => {
  const update = (
    dependencies: ProductUseCaseDependencies,
    input: unknown = { name: 'シャンプー' },
    actor: Actor = actors.admin,
    id: unknown = PRODUCT_ID,
    salon: unknown = SALON_ID,
  ) => new UpdateProductUseCase(dependencies).execute(actor, salon, id, input)

  it('writes the properties of the request to the product of the salon, once the salon is known to exist, and returns it as the API presents it', async () => {
    const dependencies = productDependencies()

    const result = await update(dependencies, {
      name: 'シャンプー',
      isActive: false,
    })

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.productRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      PRODUCT_ID,
      { name: 'シャンプー', isActive: false },
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'products.update',
    ])
    expect(result).toEqual({ type: 'success', data: apiProduct })
  })

  it('writes the stock levels as text, and a level that is taken away as null', async () => {
    const dependencies = productDependencies()

    await update(dependencies, { minimumStock: 2.95 })
    await update(dependencies, { maximumStock: 12.5 })
    await update(dependencies, { reorderPoint: 3 })
    await update(dependencies, { maximumStock: null, reorderPoint: null })

    expect(
      vi
        .mocked(dependencies.productRepository.update)
        .mock.calls.map(([, , changes]) => changes),
    ).toEqual([
      { minimumStock: '2.95' },
      { maximumStock: '12.5' },
      { reorderPoint: '3' },
      { maximumStock: null, reorderPoint: null },
    ])
  })

  it('writes everything a request can name', async () => {
    const dependencies = productDependencies()

    await update(dependencies, productCreateRequest())

    expect(dependencies.productRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      PRODUCT_ID,
      newProduct,
    )
  })

  it.each(keepers)('lets %s change one', async (_who, actor) => {
    const result = await update(
      productDependencies(),
      { isActive: false },
      actor,
    )

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s, whatever the ID and the request are, without reading or writing anything',
    async (_who, actor) => {
      const dependencies = productDependencies()

      const refused = await update(dependencies, { isActive: false }, actor)
      const malformed = await update(dependencies, {}, actor, 'latest')

      expect(refused).toEqual(forbidden)
      expect(malformed).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = productDependencies()

      const result = await update(
        dependencies,
        { isActive: false },
        actors.customer,
        PRODUCT_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the ID before it reads the request',
    async (_case, id) => {
      const dependencies = productDependencies()

      const result = await update(dependencies, {}, actors.admin, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a request that names nothing', {}, [':custom']],
    ['a blank name', { name: ' ' }, ['name:invalid_format']],
    [
      'a product code that is null',
      { productCode: null },
      ['productCode:invalid_type'],
    ],
    ['the salon', { salonId: OTHER_SALON_ID }, ['salonId:unrecognized_keys']],
    [
      'two levels out of order',
      { minimumStock: 20, maximumStock: 19.99 },
      ['maximumStock:custom'],
    ],
    [
      'several broken rules',
      { minimumStock: 100000000, expiryMonths: 0 },
      ['minimumStock:too_big', 'expiryMonths:too_small'],
    ],
  ])(
    'rejects %s without looking the salon up or writing anything',
    async (_case, input, expected) => {
      const dependencies = productDependencies()

      const result = await update(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: 'Invalid product update' },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and writes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await update(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    expect(await update(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('reports a product that the salon does not have as not found', async () => {
    const dependencies = productDependencies(updating({ type: 'notFound' }))

    expect(await update(dependencies)).toEqual(productNotFound)
  })

  it.each<[string, object, StockLevelOrder[], Record<string, string>]>([
    [
      'the minimum, above the stored maximum',
      { minimumStock: 60 },
      [['minimumStock', 'maximumStock']],
      { minimumStock: 'Must not be more than maximumStock' },
    ],
    [
      'the minimum, above the stored reorder point and maximum',
      { minimumStock: 60, isActive: false },
      [
        ['minimumStock', 'reorderPoint'],
        ['minimumStock', 'maximumStock'],
      ],
      { minimumStock: 'Must not be more than maximumStock' },
    ],
    [
      'the maximum, below the stored minimum',
      { maximumStock: 1 },
      [['minimumStock', 'maximumStock']],
      { maximumStock: 'Must not be less than minimumStock' },
    ],
    [
      'the reorder point, below the stored minimum',
      { reorderPoint: 1, name: 'シャンプー' },
      [['minimumStock', 'reorderPoint']],
      { reorderPoint: 'Must not be less than minimumStock' },
    ],
    [
      'the reorder point, above the stored maximum',
      { reorderPoint: 99 },
      [['reorderPoint', 'maximumStock']],
      { reorderPoint: 'Must not be more than maximumStock' },
    ],
    [
      'the minimum and the maximum, around the stored reorder point',
      { minimumStock: 20, maximumStock: 30 },
      [
        ['minimumStock', 'reorderPoint'],
        ['reorderPoint', 'maximumStock'],
      ],
      {
        minimumStock: 'Must not be more than reorderPoint',
        maximumStock: 'Must not be less than reorderPoint',
      },
    ],
  ])(
    'tells a request that names %s that it does not go with the levels that are stored',
    async (_case, input, broken, expected) => {
      const dependencies = productDependencies(
        updating({ type: 'stockLevelsOutOfOrder', broken }),
      )

      const result = await update(dependencies, input)

      expect(messagesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: 'Invalid product update' },
      })
    },
  )

  it('tells a request every level that is out of order, in the order of the orders it breaks', async () => {
    const dependencies = productDependencies(
      updating({
        type: 'stockLevelsOutOfOrder',
        broken: [
          ['minimumStock', 'maximumStock'],
          ['reorderPoint', 'maximumStock'],
        ],
      }),
    )

    const result = await update(dependencies, {
      minimumStock: 20,
      reorderPoint: 30,
    })

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: 'Invalid product update',
        issues: [
          {
            field: 'minimumStock',
            rule: 'custom',
            message: 'Must not be more than maximumStock',
          },
          {
            field: 'reorderPoint',
            rule: 'custom',
            message: 'Must not be more than maximumStock',
          },
        ],
      },
    })
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = productDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored product that cannot be presented as a database error', async () => {
    const dependencies = productDependencies(
      updating({ type: 'updated', product: corruptProduct }),
    )

    expect(await update(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('DeleteProductUseCase', () => {
  const remove = (
    dependencies: ProductUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = PRODUCT_ID,
    salon: unknown = SALON_ID,
  ) => new DeleteProductUseCase(dependencies).execute(actor, salon, id)

  it('marks the product of the salon deleted, once the salon is known to exist, and returns its ID', async () => {
    const dependencies = productDependencies()

    const result = await remove(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.productRepository.delete).toHaveBeenCalledWith(
      SALON_ID,
      PRODUCT_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'products.delete',
    ])
    expect(result).toEqual({ type: 'success', data: PRODUCT_ID })
  })

  it.each(keepers)('lets %s remove one', async (_who, actor) => {
    const result = await remove(productDependencies(), actor)

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s, whatever the ID is, without reading or writing anything',
    async (_who, actor) => {
      const dependencies = productDependencies()

      const refused = await remove(dependencies, actor)
      const malformed = await remove(dependencies, actor, 'latest')

      expect(refused).toEqual(forbidden)
      expect(malformed).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = productDependencies()

      const result = await remove(
        dependencies,
        actors.customer,
        PRODUCT_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the ID without looking anything up',
    async (_case, id) => {
      const dependencies = productDependencies()

      const result = await remove(dependencies, actors.admin, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and removes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await remove(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    expect(await remove(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('reports a product that the salon does not have as not found', async () => {
    const dependencies = productDependencies(removing({ type: 'notFound' }))

    expect(await remove(dependencies)).toEqual(productNotFound)
  })

  it('refuses to remove a product with stock, as a conflict that says what to do instead', async () => {
    const dependencies = productDependencies(removing({ type: 'inStock' }))

    expect(await remove(dependencies)).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'The product cannot be deleted: it has stock; delete its stock first or set isActive to false',
      },
    })
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = productDependencies({
      delete: vi.fn(async () => databaseDown),
    })

    expect(await remove(dependencies)).toEqual(databaseDown)
  })
})
