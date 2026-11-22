import { Result } from '@beauty-salon-backend/utility'
import { inventoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors, STAFF_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { brokenRules, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  dbInventoryTransaction,
  INVENTORY_ID,
  INVENTORY_TRANSACTION_ID,
  inventoryDependencies,
  inventoryMovementRequest,
  OTHER_INVENTORY_TRANSACTION_ID,
} from '../../../__tests__/fixtures/inventory-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  InventoryMovementListing,
  InventoryMovementRecording,
} from '../../../repositories/inventory.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  type InventoryUseCaseDependencies,
  ListInventoryMovementsUseCase,
  RecordInventoryMovementUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Whether no repository was asked anything. */
const untouched = ({
  inventoryRepository,
  salonRepository,
}: InventoryUseCaseDependencies): boolean =>
  [
    ...Object.values(inventoryRepository),
    ...Object.values(salonRepository),
  ].every((method) => vi.mocked(method).mock.calls.length === 0)

/** The movement of the fixtures as the API presents it. */
const apiMovement = expect.objectContaining({
  id: INVENTORY_TRANSACTION_ID,
  quantity: 3,
  balanceBefore: 12.5,
  balanceAfter: 15.5,
  createdAt: '2026-11-14T09:00:00.123Z',
})

const owner = actors.ofSalon('owner')
const manager = actors.ofSalon('manager')
const staff = actors.ofSalon('staff')
const salonReach = { type: 'salon', salonId: SALON_ID }

/** Actors who read no stock at all. */
const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

describe('RecordInventoryMovementUseCase', () => {
  const record = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    input: unknown = inventoryMovementRequest(),
  ) => new RecordInventoryMovementUseCase(dependencies).execute(actor, input)

  it('records the movement of an administrator on any salon, by no staff member', async () => {
    const dependencies = inventoryDependencies()

    const result = await record(dependencies)

    expect(result).toEqual({ type: 'success', data: apiMovement })
    expect(
      dependencies.inventoryRepository.recordMovement,
    ).toHaveBeenCalledWith({ type: 'everySalon' }, INVENTORY_ID, {
      transactionType: 'purchase',
      quantity: '3.00',
      unitCost: 1200,
      totalCost: 3600,
      referenceType: 'purchase_order',
      referenceId: OTHER_INVENTORY_TRANSACTION_ID,
      reason: null,
      performedBy: null,
    })
  })

  /** A movement of each kind that satisfies the rules of its own. */
  const ofKind = {
    purchase: inventoryMovementRequest(),
    sale: inventoryMovementRequest({ transactionType: 'sale', quantity: -1 }),
    use: inventoryMovementRequest({ transactionType: 'use', quantity: -0.5 }),
    return: inventoryMovementRequest({
      transactionType: 'return',
      quantity: 1,
    }),
    adjustment: inventoryMovementRequest({
      transactionType: 'adjustment',
      quantity: -2,
      reason: '棚卸の差異',
    }),
    disposal: inventoryMovementRequest({
      transactionType: 'disposal',
      quantity: -1,
      reason: '破損',
    }),
    transfer: inventoryMovementRequest({
      transactionType: 'transfer',
      quantity: -4,
    }),
  }

  it.each<[string, Actor, keyof typeof ofKind]>([
    ['an owner', owner, 'adjustment'],
    ['an owner', owner, 'transfer'],
    ['a manager', manager, 'disposal'],
    ['a manager', manager, 'sale'],
    ['a staff member', staff, 'purchase'],
    ['a staff member', staff, 'sale'],
    ['a staff member', staff, 'use'],
    ['a staff member', staff, 'return'],
  ])(
    'records the movement of %s of a %s within their salon, by them, with the reason it states',
    async (_case, actor, kind) => {
      const dependencies = inventoryDependencies()

      const result = await record(dependencies, actor, ofKind[kind])

      expect(result).toEqual({ type: 'success', data: apiMovement })
      expect(
        dependencies.inventoryRepository.recordMovement,
      ).toHaveBeenCalledWith(
        salonReach,
        INVENTORY_ID,
        expect.objectContaining({
          transactionType: kind,
          reason: ofKind[kind].reason,
          performedBy: STAFF_ID,
        }),
      )
    },
  )

  it.each(outsiders)(
    'refuses %s before it looks at the request',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      const result = await record(dependencies, actor, { quantity: 'many' })

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it.each<keyof typeof ofKind>(['adjustment', 'disposal', 'transfer'])(
    'refuses a staff member a %s',
    async (kind) => {
      const dependencies = inventoryDependencies()

      const result = await record(dependencies, staff, ofKind[kind])

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('tells a staff member what is wrong with a request before whether the kind is theirs', async () => {
    const dependencies = inventoryDependencies()

    const result = await record(dependencies, staff, {
      ...ofKind.adjustment,
      reason: null,
    })

    expect(rulesOf(result)).toEqual(['reason:custom'])
    expect(untouched(dependencies)).toBe(true)
  })

  it.each([
    ['a request that is no object', 'purchase 3', [':invalid_type']],
    [
      'a purchase out',
      inventoryMovementRequest({ quantity: -3 }),
      ['quantity:custom'],
    ],
    [
      'a total cost above an integer',
      inventoryMovementRequest({ unitCost: 1_000_000_000 }),
      ['unitCost:too_big'],
    ],
    [
      'a stock row that is no UUID',
      inventoryMovementRequest({ inventoryId: 'row-1' }),
      ['inventoryId:invalid_format'],
    ],
  ])('refuses %s without writing', async (_case, input, rules) => {
    const dependencies = inventoryDependencies()

    const result = await record(dependencies, owner, input)

    expect(rulesOf(result)).toEqual(rules)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a stock row that is not there, or not within the reach, as a property of the request', async () => {
    const dependencies = inventoryDependencies({
      recordMovement: vi.fn(async () =>
        Result.success<InventoryMovementRecording>({ type: 'notFound' }),
      ),
    })

    const result = await record(dependencies, owner)

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(inventoryMessages.invalidStockMovement, [
          {
            field: 'inventoryId',
            rule: 'not_found',
            message: 'Must name a stock row',
          },
        ]),
      ),
    )
  })

  it.each<[InventoryMovementRecording, string]>([
    [
      { type: 'belowReserved' },
      'The stock of the row would fall below its reserved stock',
    ],
    [{ type: 'overLimit' }, 'The stock of the row would go above 99999999.99'],
  ])(
    'refuses a movement the stock cannot take: %j',
    async (refusal, message) => {
      const dependencies = inventoryDependencies({
        recordMovement: vi.fn(async () => Result.success(refusal)),
      })

      const result = await record(dependencies, owner)

      expect(result).toEqual(Result.error(DomainErrors.conflict(message)))
    },
  )

  it('passes on a failure of the database', async () => {
    const dependencies = inventoryDependencies({
      recordMovement: vi.fn(async () => databaseDown),
    })

    expect(await record(dependencies)).toEqual(databaseDown)
  })

  it('tells the database is wrong of a movement it cannot show', async () => {
    const dependencies = inventoryDependencies({
      recordMovement: vi.fn(async () =>
        Result.success<InventoryMovementRecording>({
          type: 'recorded',
          transaction: dbInventoryTransaction({ createdAt: 'yesterday' }),
        }),
      ),
    })

    expect(await record(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })
})

describe('ListInventoryMovementsUseCase', () => {
  const list = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = INVENTORY_ID,
    query: Result<unknown, DomainError> = Result.success({}),
  ) => new ListInventoryMovementsUseCase(dependencies).execute(actor, id, query)

  it('lists the movements of a row of any salon for an administrator, with the defaults of a page', async () => {
    const dependencies = inventoryDependencies()

    const result = await list(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiMovement],
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
    expect(dependencies.inventoryRepository.listMovements).toHaveBeenCalledWith(
      { type: 'everySalon' },
      {
        inventoryId: INVENTORY_ID,
        limit: 20,
        after: null,
        transactionType: null,
        startDate: null,
        endDate: null,
      },
    )
  })

  it.each<[string, Actor]>([
    ['an owner', owner],
    ['a manager', manager],
    ['a staff member', staff],
  ])(
    'lists a row of the salon of %s, and hands on every filter',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      await list(
        dependencies,
        actor,
        INVENTORY_ID,
        Result.success({
          limit: 5,
          cursor: INVENTORY_TRANSACTION_ID,
          transactionType: 'use',
          startDate: '2026-11-01T00:00:00Z',
          endDate: '2026-11-30T23:59:59.999Z',
        }),
      )

      expect(
        dependencies.inventoryRepository.listMovements,
      ).toHaveBeenCalledWith(salonReach, {
        inventoryId: INVENTORY_ID,
        limit: 5,
        after: INVENTORY_TRANSACTION_ID,
        transactionType: 'use',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-30T23:59:59.999Z',
      })
    },
  )

  it('names the cursor it was given, and the last movement as the cursor of the next page when more follow', async () => {
    const dependencies = inventoryDependencies({
      listMovements: vi.fn(async () =>
        Result.success<InventoryMovementListing>({
          type: 'listed',
          transactions: [
            dbInventoryTransaction(),
            dbInventoryTransaction({ id: OTHER_INVENTORY_TRANSACTION_ID }),
          ],
          total: 7,
          hasMore: true,
        }),
      ),
    })

    const result = await list(
      dependencies,
      owner,
      INVENTORY_ID,
      Result.success({ limit: 2, cursor: INVENTORY_TRANSACTION_ID }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: INVENTORY_TRANSACTION_ID,
          nextCursor: OTHER_INVENTORY_TRANSACTION_ID,
          prevCursor: null,
        },
      },
    })
  })

  it.each(outsiders)(
    'refuses %s before it looks at the request',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      const result = await list(
        dependencies,
        actor,
        'row-1',
        Result.success({ limit: 0 }),
      )

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID before it looks at the query', async () => {
    const dependencies = inventoryDependencies()

    const result = await list(
      dependencies,
      owner,
      'row-1',
      Result.success({ limit: 0 }),
    )

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('passes on a query the API could not decode', async () => {
    const dependencies = inventoryDependencies()
    const undecodable = Result.error(
      DomainErrors.validation(inventoryMessages.invalidStockMovementSearch, [
        { field: 'limit', rule: 'invalid_format', message: 'Must be a number' },
      ]),
    )

    expect(await list(dependencies, owner, INVENTORY_ID, undecodable)).toEqual(
      undecodable,
    )
    expect(untouched(dependencies)).toBe(true)
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    [
      'an unknown kind',
      { transactionType: 'loss' },
      ['transactionType:invalid_value'],
    ],
    [
      'an end before the start',
      { startDate: '2026-11-02T00:00:00Z', endDate: '2026-11-01T00:00:00Z' },
      ['endDate:custom'],
    ],
    [
      'a moment out of range',
      { endDate: '3000-01-01T00:00:00Z' },
      ['endDate:too_big'],
    ],
    [
      'a filter it does not know',
      { salonId: SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
  ])('refuses %s without reading', async (_case, query, rules) => {
    const dependencies = inventoryDependencies()

    const result = await list(
      dependencies,
      owner,
      INVENTORY_ID,
      Result.success(query),
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(untouched(dependencies)).toBe(true)
  })

  it('answers a stock row that is not there, or not within the reach, as not found', async () => {
    const dependencies = inventoryDependencies({
      listMovements: vi.fn(async () =>
        Result.success<InventoryMovementListing>({ type: 'inventoryNotFound' }),
      ),
    })

    expect(await list(dependencies, staff)).toEqual(
      Result.error(DomainErrors.notFound('Inventory', INVENTORY_ID)),
    )
  })

  it('refuses a cursor that names no movement of the row', async () => {
    const dependencies = inventoryDependencies({
      listMovements: vi.fn(async () =>
        Result.success<InventoryMovementListing>({ type: 'cursorNotFound' }),
      ),
    })

    const result = await list(
      dependencies,
      staff,
      INVENTORY_ID,
      Result.success({ cursor: OTHER_INVENTORY_TRANSACTION_ID }),
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(inventoryMessages.invalidStockMovementSearch, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a stock movement of the stock row',
          },
        ]),
      ),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = inventoryDependencies({
      listMovements: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('tells the database is wrong of a movement it cannot show', async () => {
    const dependencies = inventoryDependencies({
      listMovements: vi.fn(async () =>
        Result.success<InventoryMovementListing>({
          type: 'listed',
          transactions: [dbInventoryTransaction({ quantity: 'some' })],
          total: 1,
          hasMore: false,
        }),
      ),
    })

    expect(await list(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })
})
