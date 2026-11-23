import { Result } from '@beauty-salon-backend/utility'
import { inventoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  dbSalon,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  dbInventory,
  INVENTORY_ID,
  inventoryCreateRequest,
  inventoryDependencies,
  listedRow,
  OTHER_INVENTORY_ID,
} from '../../../__tests__/fixtures/inventory-fixtures'
import { PRODUCT_ID } from '../../../__tests__/fixtures/product-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  InventoryCreation,
  InventoryRemoval,
  InventoryUpdate,
} from '../../../repositories/inventory.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import {
  CreateInventoryUseCase,
  DeleteInventoryUseCase,
  GetInventoryUseCase,
  type InventoryUseCaseDependencies,
  ListExpiringInventoryUseCase,
  ListInventoryUseCase,
  ListLowStockInventoryUseCase,
  UpdateInventoryUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

/** The row of the fixtures as the API presents it. */
const apiRow = expect.objectContaining({
  id: INVENTORY_ID,
  currentStock: 12.5,
  availableStock: 10.5,
  reservedStock: 2,
})

/** A row whose timestamp cannot be read: it cannot be turned into a response. */
const corruptRow = dbInventory({ createdAt: 'yesterday' })

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** What a refused request is told, by `field`. */
const messagesOf = (
  result: Result<unknown, DomainError>,
): Record<string, string> =>
  result.type === 'error' && result.error.type === 'validation'
    ? Object.fromEntries(
        result.error.issues.map(({ field, message }) => [
          field,
          toldIn(message, 'en'),
        ]),
      )
    : {}

/** Whether no repository was asked anything. */
const untouched = ({
  inventoryRepository,
  salonRepository,
}: InventoryUseCaseDependencies): boolean =>
  [
    ...Object.values(inventoryRepository),
    ...Object.values(salonRepository),
  ].every((method) => vi.mocked(method).mock.calls.length === 0)

/** A query as the API decodes it. */
const query = (value: Record<string, unknown> = {}) => Result.success(value)

/** A query the API could not decode. */
const undecodable = Result.error(
  DomainErrors.validation(inventoryMessages.invalidInventorySearch, [
    { field: 'limit', rule: 'invalid_format', message: 'Must be a number' },
  ]),
)

const owner = actors.ofSalon('owner')
const staff = actors.ofSalon('staff')
const salonReach = { type: 'salon', salonId: SALON_ID }

/** Actors who read no stock at all. */
const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

/** Actors who read stock and keep none. */
const notKeepers: [string, Actor][] = [['a staff member', staff], ...outsiders]

describe('ListInventoryUseCase', () => {
  const list = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    request: Result<unknown, DomainError> = query(),
  ) => new ListInventoryUseCase(dependencies).execute(actor, request)

  it('lists every salon for an administrator, with the defaults of a page', async () => {
    const dependencies = inventoryDependencies()

    const result = await list(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiRow],
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
    expect(dependencies.inventoryRepository.list).toHaveBeenCalledWith({
      reach: { type: 'everySalon' },
      limit: 20,
      after: null,
      salonId: null,
      productId: null,
      lotNumber: null,
    })
  })

  it('lists the salon of a member, and hands on every filter', async () => {
    const dependencies = inventoryDependencies()

    await list(
      dependencies,
      staff,
      query({
        limit: 5,
        cursor: OTHER_INVENTORY_ID,
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        lotNumber: 'A',
      }),
    )

    expect(dependencies.inventoryRepository.list).toHaveBeenCalledWith({
      reach: salonReach,
      limit: 5,
      after: OTHER_INVENTORY_ID,
      salonId: SALON_ID,
      productId: PRODUCT_ID,
      lotNumber: 'A',
    })
  })

  it('names the cursor it was given, and the last row as the cursor of the next page when more follow', async () => {
    const dependencies = inventoryDependencies({
      list: vi.fn(async () =>
        Result.success({
          rows: [dbInventory(), dbInventory({ id: OTHER_INVENTORY_ID })],
          total: 5,
          hasMore: true,
        }),
      ),
    })

    const result = await list(
      dependencies,
      owner,
      query({ limit: 2, cursor: INVENTORY_ID }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          limit: 2,
          hasMore: true,
          cursor: INVENTORY_ID,
          nextCursor: OTHER_INVENTORY_ID,
        },
      },
    })
  })

  it('refuses a cursor the list cannot start from', async () => {
    const dependencies = inventoryDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(
      dependencies,
      owner,
      query({ cursor: INVENTORY_ID }),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: inventoryMessages.invalidInventorySearch,
      },
    })
    expect(rulesOf(result)).toEqual(['cursor:not_found'])
    expect(messagesOf(result)).toEqual({
      cursor: 'Must name a stock row of the list',
    })
  })

  it.each(outsiders)(
    'refuses %s before it looks at the query',
    async (_who, actor) => {
      const dependencies = inventoryDependencies()

      expect(await list(dependencies, actor, undecodable)).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a member the stock of another salon, and asks nothing', async () => {
    const dependencies = inventoryDependencies()

    const result = await list(
      dependencies,
      staff,
      query({ salonId: OTHER_SALON_ID }),
    )

    expect(result).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('answers a query that could not be decoded with what was wrong with it', async () => {
    expect(await list(inventoryDependencies(), owner, undecodable)).toEqual(
      undecodable,
    )
  })

  it('refuses a query that breaks a rule, and asks nothing', async () => {
    const dependencies = inventoryDependencies()

    const result = await list(
      dependencies,
      owner,
      query({ limit: 0, sort: 'id' }),
    )

    expect(rulesOf(result)).toEqual([
      'limit:too_small',
      'sort:unrecognized_keys',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('hands on what the repository could not do, and a row it cannot show', async () => {
    const failing = inventoryDependencies({
      list: vi.fn(async () => databaseDown),
    })
    const corrupt = inventoryDependencies({
      list: vi.fn(async () =>
        Result.success({ rows: [corruptRow], total: 1, hasMore: false }),
      ),
    })

    expect(await list(failing)).toEqual(databaseDown)
    expect(await list(corrupt)).toEqual(storedRowIsCorrupt)
  })
})

describe('CreateInventoryUseCase', () => {
  const create = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    request: unknown = inventoryCreateRequest(),
  ) => new CreateInventoryUseCase(dependencies).execute(actor, request)

  /** Dependencies whose repository answers a create with this outcome. */
  const creating = (outcome: InventoryCreation) =>
    inventoryDependencies({
      create: vi.fn(async () => Result.success(outcome)),
    })

  it('adds the row of the request after it found the salon, and answers with it', async () => {
    const dependencies = inventoryDependencies()

    const result = await create(dependencies, owner)

    expect(result).toEqual({ type: 'success', data: apiRow })
    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.inventoryRepository.create).toHaveBeenCalledWith(
      inventoryCreateRequest(),
    )
  })

  it.each(notKeepers)(
    'refuses %s before it looks at the request',
    async (_who, actor) => {
      const dependencies = inventoryDependencies()

      expect(await create(dependencies, actor, 'not a request')).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a request that breaks a rule, and asks nothing', async () => {
    const dependencies = inventoryDependencies()

    const result = await create(dependencies, owner, {
      ...inventoryCreateRequest(),
      shelf: '',
      currentStock: 3,
    })

    expect(rulesOf(result)).toEqual([
      'shelf:invalid_format',
      'currentStock:unrecognized_keys',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a member a row of another salon before it looks for the salon', async () => {
    const dependencies = inventoryDependencies()

    const result = await create(dependencies, owner, {
      ...inventoryCreateRequest(),
      salonId: OTHER_SALON_ID,
    })

    expect(result).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a salon that is not there, and writes nothing', async () => {
    const dependencies = inventoryDependencies(
      {},
      { exists: vi.fn(async () => Result.success(false)) },
    )

    const result = await create(dependencies)

    expect(rulesOf(result)).toEqual(['salonId:not_found'])
    expect(dependencies.inventoryRepository.create).not.toHaveBeenCalled()
  })

  it.each<[string, InventoryCreation, Record<string, string>, string[]]>([
    [
      'a product the salon does not have',
      { type: 'productNotFound' },
      { productId: 'Must name a product of the salon' },
      ['productId:not_found'],
    ],
    [
      'a lot number that does not fit the product',
      {
        type: 'lotNumberRefused',
        message: 'Must be null: the product is not kept by lots',
      },
      { lotNumber: 'Must be null: the product is not kept by lots' },
      ['lotNumber:custom'],
    ],
  ])('refuses %s', async (_case, outcome, messages, rules) => {
    const result = await create(creating(outcome))

    expect(rulesOf(result)).toEqual(rules)
    expect(messagesOf(result)).toEqual(messages)
  })

  it('hands on a lot that is there already, what could not be done, and a row it cannot show', async () => {
    const taken = Result.error(
      DomainErrors.alreadyExists('Inventory', 'lotNumber', 'LOT-2026-001'),
    )

    expect(
      await create(inventoryDependencies({ create: vi.fn(async () => taken) })),
    ).toEqual(taken)
    expect(
      await create(
        inventoryDependencies({}, { exists: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
    expect(
      await create(creating({ type: 'created', row: corruptRow })),
    ).toEqual(storedRowIsCorrupt)
  })
})

describe('GetInventoryUseCase', () => {
  const get = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    id: string = INVENTORY_ID,
  ) => new GetInventoryUseCase(dependencies).execute(actor, id)

  it('finds the row within the reach of the actor', async () => {
    const dependencies = inventoryDependencies()

    expect(await get(dependencies, staff)).toEqual({
      type: 'success',
      data: apiRow,
    })
    expect(dependencies.inventoryRepository.findById).toHaveBeenCalledWith(
      salonReach,
      INVENTORY_ID,
    )
  })

  it('answers that a row it does not find is not found', async () => {
    const result = await get(
      inventoryDependencies({
        findById: vi.fn(async () => Result.success(null)),
      }),
    )

    expect(result).toEqual({
      type: 'error',
      error: { type: 'notFound', entity: 'Inventory', id: INVENTORY_ID },
    })
  })

  it.each(outsiders)(
    'refuses %s before it looks at the ID',
    async (_who, actor) => {
      const dependencies = inventoryDependencies()

      expect(await get(dependencies, actor, 'latest')).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is not a UUID, and asks nothing', async () => {
    const dependencies = inventoryDependencies()

    const result = await get(dependencies, owner, 'latest')

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: inventoryMessages.invalidInventoryId,
      },
    })
    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('hands on what the repository could not do, and a row it cannot show', async () => {
    expect(
      await get(
        inventoryDependencies({ findById: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
    expect(
      await get(
        inventoryDependencies({
          findById: vi.fn(async () => Result.success(corruptRow)),
        }),
      ),
    ).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateInventoryUseCase', () => {
  const update = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    id: string = INVENTORY_ID,
    request: unknown = { shelf: 'B-2' },
  ) => new UpdateInventoryUseCase(dependencies).execute(actor, id, request)

  /** Dependencies whose repository answers a change with this outcome. */
  const updating = (outcome: InventoryUpdate) =>
    inventoryDependencies({
      update: vi.fn(async () => Result.success(outcome)),
    })

  it('writes what the request names within the reach of the actor, and answers with the row', async () => {
    const dependencies = inventoryDependencies()

    const result = await update(dependencies, owner, INVENTORY_ID, {
      shelf: 'B-2',
      notes: null,
    })

    expect(result).toEqual({ type: 'success', data: apiRow })
    expect(dependencies.inventoryRepository.update).toHaveBeenCalledWith(
      salonReach,
      INVENTORY_ID,
      { shelf: 'B-2', notes: null },
    )
  })

  it.each(notKeepers)(
    'refuses %s before it looks at the ID or the request',
    async (_who, actor) => {
      const dependencies = inventoryDependencies()

      expect(await update(dependencies, actor, 'latest', {})).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('looks at the ID before the request', async () => {
    const result = await update(inventoryDependencies(), owner, 'latest', {})

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
  })

  it.each<[string, unknown, string[]]>([
    ['nothing', {}, [':custom']],
    [
      'the product of the row',
      { productId: PRODUCT_ID },
      ['productId:unrecognized_keys'],
    ],
    ['a blank lot number', { lotNumber: ' ' }, ['lotNumber:invalid_format']],
  ])(
    'refuses a request of %s, and asks nothing',
    async (_case, request, rules) => {
      const dependencies = inventoryDependencies()

      const result = await update(dependencies, owner, INVENTORY_ID, request)

      expect(result).toMatchObject({
        type: 'error',
        error: { message: inventoryMessages.invalidStockRow },
      })
      expect(rulesOf(result)).toEqual(rules)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('answers that a row it does not find is not found', async () => {
    expect(await update(updating({ type: 'notFound' }))).toEqual({
      type: 'error',
      error: { type: 'notFound', entity: 'Inventory', id: INVENTORY_ID },
    })
  })

  it('refuses a lot number that does not fit the product', async () => {
    const result = await update(
      updating({
        type: 'lotNumberRefused',
        message: 'Must name the lot: the product is kept by lots',
      }),
      actors.admin,
      INVENTORY_ID,
      { lotNumber: null },
    )

    expect(rulesOf(result)).toEqual(['lotNumber:custom'])
    expect(messagesOf(result)).toEqual({
      lotNumber: 'Must name the lot: the product is kept by lots',
    })
  })

  it('hands on what the repository could not do, and a row it cannot show', async () => {
    expect(
      await update(
        inventoryDependencies({ update: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
    expect(
      await update(updating({ type: 'updated', row: corruptRow })),
    ).toEqual(storedRowIsCorrupt)
  })
})

describe('DeleteInventoryUseCase', () => {
  const remove = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    id: string = INVENTORY_ID,
  ) => new DeleteInventoryUseCase(dependencies).execute(actor, id)

  const removing = (outcome: InventoryRemoval) =>
    inventoryDependencies({
      delete: vi.fn(async () => Result.success(outcome)),
    })

  it('deletes the row within the reach of the actor', async () => {
    const dependencies = inventoryDependencies()

    expect(await remove(dependencies, owner)).toEqual({
      type: 'success',
      data: INVENTORY_ID,
    })
    expect(dependencies.inventoryRepository.delete).toHaveBeenCalledWith(
      salonReach,
      INVENTORY_ID,
    )
  })

  it.each(notKeepers)(
    'refuses %s before it looks at the ID',
    async (_who, actor) => {
      const dependencies = inventoryDependencies()

      expect(await remove(dependencies, actor, 'latest')).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is not a UUID', async () => {
    expect(rulesOf(await remove(inventoryDependencies(), owner, '42'))).toEqual(
      ['id:invalid_format'],
    )
  })

  it('answers that a row it does not find is not found', async () => {
    expect(await remove(removing({ type: 'notFound' }))).toEqual({
      type: 'error',
      error: { type: 'notFound', entity: 'Inventory', id: INVENTORY_ID },
    })
  })

  it('refuses a row that counts stock, and says how to bring it to zero', async () => {
    expect(await remove(removing({ type: 'inStock' }))).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'The stock row cannot be deleted: it counts stock; bring it to zero with a stock movement first',
      },
    })
  })

  it('hands on what the repository could not do', async () => {
    expect(
      await remove(
        inventoryDependencies({ delete: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
  })
})

describe('ListLowStockInventoryUseCase', () => {
  const lowStock = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    request: Result<unknown, DomainError> = query({ salonId: SALON_ID }),
  ) => new ListLowStockInventoryUseCase(dependencies).execute(actor, request)

  it('lists against the minimum of each product unless a threshold is given', async () => {
    const dependencies = inventoryDependencies()

    const result = await lowStock(dependencies, staff)
    await lowStock(
      dependencies,
      staff,
      query({
        salonId: SALON_ID,
        threshold: 2.5,
        limit: 3,
        cursor: INVENTORY_ID,
      }),
    )

    expect(result).toMatchObject({ type: 'success', data: { data: [apiRow] } })
    expect(
      vi.mocked(dependencies.inventoryRepository.listLowStock).mock.calls,
    ).toEqual([
      [{ salonId: SALON_ID, limit: 20, after: null, threshold: null }],
      [{ salonId: SALON_ID, limit: 3, after: INVENTORY_ID, threshold: 2.5 }],
    ])
  })

  it.each(outsiders)(
    'refuses %s before it looks at the query',
    async (_who, actor) => {
      const dependencies = inventoryDependencies()

      expect(await lowStock(dependencies, actor, undecodable)).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a member another salon before it looks for the salon', async () => {
    const dependencies = inventoryDependencies()

    const result = await lowStock(
      dependencies,
      owner,
      query({ salonId: OTHER_SALON_ID }),
    )

    expect(result).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a query without a salon, and a salon that is not there', async () => {
    const missing = inventoryDependencies(
      {},
      { exists: vi.fn(async () => Result.success(false)) },
    )

    expect(
      rulesOf(await lowStock(inventoryDependencies(), actors.admin, query())),
    ).toEqual(['salonId:invalid_type'])
    expect(rulesOf(await lowStock(missing))).toEqual(['salonId:not_found'])
    expect(missing.inventoryRepository.listLowStock).not.toHaveBeenCalled()
  })

  it('names the cursor it was given, and the last row as the cursor of the next page when more follow', async () => {
    const dependencies = inventoryDependencies({
      listLowStock: vi.fn(async () =>
        Result.success({
          rows: [dbInventory(), dbInventory({ id: OTHER_INVENTORY_ID })],
          total: 5,
          hasMore: true,
        }),
      ),
    })

    const result = await lowStock(
      dependencies,
      owner,
      query({ salonId: SALON_ID, limit: 2, cursor: INVENTORY_ID }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: INVENTORY_ID,
          nextCursor: OTHER_INVENTORY_ID,
        },
      },
    })
  })

  it('refuses a cursor the list cannot start from, and hands on what could not be done', async () => {
    const refused = await lowStock(
      inventoryDependencies({
        listLowStock: vi.fn(async () => Result.success(null)),
      }),
    )

    expect(refused).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: inventoryMessages.invalidLowStockSearch,
      },
    })
    expect(rulesOf(refused)).toEqual(['cursor:not_found'])
    expect(messagesOf(refused)).toEqual({
      cursor: 'Must name a stock row of the list',
    })
    expect(
      await lowStock(
        inventoryDependencies({
          listLowStock: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })
})

describe('ListExpiringInventoryUseCase', () => {
  const expiring = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    request: Result<unknown, DomainError> = query({ salonId: SALON_ID }),
  ) => new ListExpiringInventoryUseCase(dependencies).execute(actor, request)

  /** Dependencies whose salon keeps the clocks of a time zone, at a moment. */
  const at = (moment: string, timezone = 'Asia/Tokyo') =>
    inventoryDependencies(
      {},
      {
        findById: vi.fn(async () =>
          Result.success({ salon: dbSalon({ timezone }), openingHours: [] }),
        ),
      },
      () => new Date(moment),
    )

  it('lists what expires within 30 days of today at the salon unless the query says how many', async () => {
    const dependencies = at('2026-11-14T09:00:00.000Z')

    const result = await expiring(dependencies, staff)
    await expiring(
      dependencies,
      staff,
      query({ salonId: SALON_ID, days: 0, limit: 2 }),
    )

    expect(result).toMatchObject({ type: 'success', data: { data: [apiRow] } })
    expect(
      vi.mocked(dependencies.inventoryRepository.listExpiring).mock.calls,
    ).toEqual([
      [{ salonId: SALON_ID, limit: 20, after: null, until: '2026-12-14' }],
      [{ salonId: SALON_ID, limit: 2, after: null, until: '2026-11-14' }],
    ])
  })

  it.each([
    [
      'in Tokyo after midnight there',
      '2026-11-14T15:00:00.000Z',
      'Asia/Tokyo',
      '2026-11-15',
    ],
    [
      'in Honolulu, where it is still the day before',
      '2026-11-14T09:00:00.000Z',
      'Pacific/Honolulu',
      '2026-11-13',
    ],
  ])(
    'counts from today as the clocks of the salon tell it: %s',
    async (_case, moment, timezone, until) => {
      const dependencies = at(moment, timezone)

      await expiring(
        dependencies,
        actors.admin,
        query({ salonId: SALON_ID, days: 0 }),
      )

      expect(
        dependencies.inventoryRepository.listExpiring,
      ).toHaveBeenCalledWith(expect.objectContaining({ until }))
    },
  )

  it('resolves a salon of a time zone the runtime does not know to a database error, and lists nothing', async () => {
    const dependencies = at('2026-11-14T09:00:00.000Z', 'Mars/Olympus_Mons')

    expect(await expiring(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database', cause: 'Mars/Olympus_Mons' },
    })
    expect(dependencies.inventoryRepository.listExpiring).not.toHaveBeenCalled()
  })

  it.each(outsiders)(
    'refuses %s before it looks at the query',
    async (_who, actor) => {
      const dependencies = inventoryDependencies()

      expect(await expiring(dependencies, actor, undecodable)).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a member another salon before it looks for the salon', async () => {
    const dependencies = inventoryDependencies()

    const result = await expiring(
      dependencies,
      owner,
      query({ salonId: OTHER_SALON_ID }),
    )

    expect(result).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a salon that is not there, and hands on a salon it could not look for', async () => {
    const missing = inventoryDependencies(
      {},
      { findById: vi.fn(async () => Result.success(null)) },
    )

    expect(rulesOf(await expiring(missing))).toEqual(['salonId:not_found'])
    expect(
      await expiring(
        inventoryDependencies(
          {},
          { findById: vi.fn(async () => databaseDown) },
        ),
      ),
    ).toEqual(databaseDown)
  })

  it('refuses a cursor the list cannot start from', async () => {
    const dependencies = inventoryDependencies({
      listExpiring: vi.fn(async () => Result.success(null)),
    })

    const refused = await expiring(dependencies)

    expect(refused).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: inventoryMessages.invalidExpiringSearch,
      },
    })
    expect(rulesOf(refused)).toEqual(['cursor:not_found'])
    expect(messagesOf(refused)).toEqual({
      cursor: 'Must name a stock row of the list',
    })
  })

  it('starts the page after the cursor it was given, and names it and the last row as the cursor of the next page when more follow', async () => {
    const dependencies = inventoryDependencies(
      {
        listExpiring: vi.fn(async () =>
          Result.success({
            rows: [dbInventory(), dbInventory({ id: OTHER_INVENTORY_ID })],
            total: 5,
            hasMore: true,
          }),
        ),
      },
      {},
      () => new Date('2026-11-14T09:00:00.000Z'),
    )

    const result = await expiring(
      dependencies,
      owner,
      query({ salonId: SALON_ID, limit: 2, cursor: INVENTORY_ID }),
    )

    expect(
      vi.mocked(dependencies.inventoryRepository.listExpiring).mock.calls,
    ).toEqual([
      [
        {
          salonId: SALON_ID,
          limit: 2,
          after: INVENTORY_ID,
          until: '2026-12-14',
        },
      ],
    ])
    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: INVENTORY_ID,
          nextCursor: OTHER_INVENTORY_ID,
        },
      },
    })
  })

  it('takes the page the repository gives as it is', async () => {
    const dependencies = inventoryDependencies({
      listExpiring: vi.fn(async () => Result.success(listedRow())),
    })

    expect(await expiring(dependencies)).toMatchObject({
      type: 'success',
      data: { meta: { total: 1, hasMore: false, nextCursor: null } },
    })
  })
})
