import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import { actors, STAFF_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  dbInventoryTransaction,
  INVENTORY_ID,
  inventoryDependencies,
  OTHER_INVENTORY_ID,
} from '../../../__tests__/fixtures/inventory-fixtures'
import type { Actor } from '../../../models/auth'
import type { InventoryStockCount } from '../../../repositories/inventory.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  GetInventoryValueReportUseCase,
  type InventoryUseCaseDependencies,
  PerformStockCountUseCase,
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

const missingSalon = { exists: vi.fn(async () => Result.success(false)) }

/** Actors who keep the stock of the salon of the fixtures. */
const keepers: [string, Actor][] = [
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
]

/** Actors who keep no stock at all. */
const outsiders: [string, Actor][] = [
  ['a staff member', actors.ofSalon('staff')],
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

describe('PerformStockCountUseCase', () => {
  const stockCount = (overrides: Record<string, unknown> = {}) => ({
    salonId: SALON_ID,
    items: [
      { inventoryId: INVENTORY_ID, countedQuantity: 10 },
      { inventoryId: OTHER_INVENTORY_ID, countedQuantity: 4 },
    ],
    reason: null,
    ...overrides,
  })

  const count = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    input: unknown = stockCount(),
  ) => new PerformStockCountUseCase(dependencies).execute(actor, input)

  it('counts the stock of any salon for an administrator, by no staff member', async () => {
    const dependencies = inventoryDependencies()

    const result = await count(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        adjustments: [
          expect.objectContaining({
            transactionType: 'adjustment',
            quantity: -2.5,
            balanceAfter: 10,
          }),
        ],
        discrepancies: [
          {
            inventoryId: INVENTORY_ID,
            expected: 12.5,
            counted: 10,
            difference: -2.5,
          },
        ],
      },
    })
    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(
      dependencies.inventoryRepository.performStockCount,
    ).toHaveBeenCalledWith({
      salonId: SALON_ID,
      items: [
        { inventoryId: INVENTORY_ID, countedQuantity: '10.00' },
        { inventoryId: OTHER_INVENTORY_ID, countedQuantity: '4.00' },
      ],
      reason: '棚卸しの差異',
      performedBy: null,
    })
  })

  it.each(keepers)(
    'counts the stock of their salon for %s, by them and for the reason given',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      const result = await count(
        dependencies,
        actor,
        stockCount({ reason: '月末の棚卸し' }),
      )

      expect(result.type).toBe('success')
      expect(
        dependencies.inventoryRepository.performStockCount,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: '月末の棚卸し',
          performedBy: STAFF_ID,
        }),
      )
    },
  )

  it.each(outsiders)(
    'refuses %s before it looks at the request',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      const result = await count(dependencies, actor, { items: 'all' })

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('tells a keeper what is wrong with a request before anything is looked up', async () => {
    const dependencies = inventoryDependencies()

    const result = await count(
      dependencies,
      actors.ofSalon('owner'),
      stockCount({
        salonId: OTHER_SALON_ID,
        items: [{ inventoryId: INVENTORY_ID, countedQuantity: -1 }],
      }),
    )

    expect(rulesOf(result)).toEqual(['items.0.countedQuantity:too_small'])
    expect(untouched(dependencies)).toBe(true)
  })

  it.each(keepers)(
    'refuses %s the stock of another salon before the salon is looked up',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      const result = await count(
        dependencies,
        actor,
        stockCount({ salonId: OTHER_SALON_ID }),
      )

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a salon that is not there as a property of the request, and counts nothing', async () => {
    const dependencies = inventoryDependencies({}, missingSalon)

    const result = await count(dependencies)

    expect(rulesOf(result)).toEqual(['salonId:not_found'])
    expect(
      dependencies.inventoryRepository.performStockCount,
    ).not.toHaveBeenCalled()
  })

  it('refuses every row that is not of the salon, where the count names it', async () => {
    const dependencies = inventoryDependencies({
      performStockCount: vi.fn(async () =>
        Result.success<InventoryStockCount>({
          type: 'rowsNotFound',
          indexes: [0, 2],
        }),
      ),
    })

    const result = await count(dependencies)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid stock count' },
    })
    expect(rulesOf(result)).toEqual([
      'items.0.inventoryId:not_found',
      'items.2.inventoryId:not_found',
    ])
  })

  it('refuses a count below what is reserved of a row as a conflict', async () => {
    const dependencies = inventoryDependencies({
      performStockCount: vi.fn(async () =>
        Result.success<InventoryStockCount>({
          type: 'belowReserved',
          inventoryId: OTHER_INVENTORY_ID,
        }),
      ),
    })

    expect(await count(dependencies)).toEqual(
      Result.error(
        DomainErrors.conflict(
          `What was counted of stock row ${OTHER_INVENTORY_ID} is below its reserved stock`,
        ),
      ),
    )
  })

  it('passes on a failure of the database', async () => {
    expect(
      await count(
        inventoryDependencies({}, { exists: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
    expect(
      await count(
        inventoryDependencies({
          performStockCount: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })

  it('tells the database is wrong of an adjustment it cannot show', async () => {
    const dependencies = inventoryDependencies({
      performStockCount: vi.fn(async () =>
        Result.success<InventoryStockCount>({
          type: 'counted',
          adjustments: [dbInventoryTransaction({ balanceAfter: 'ten' })],
          discrepancies: [],
        }),
      ),
    })

    expect(await count(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })
})

describe('GetInventoryValueReportUseCase', () => {
  const report = (
    dependencies: InventoryUseCaseDependencies,
    actor: Actor = actors.admin,
    query: unknown = { salonId: SALON_ID },
  ) => new GetInventoryValueReportUseCase(dependencies).execute(actor, query)

  it('reports the value of the stock of any salon to an administrator', async () => {
    const dependencies = inventoryDependencies()

    const result = await report(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        totalValue: 15_000,
        totalItems: 1,
        categories: [{ category: 'ヘアケア', value: 15_000, itemCount: 1 }],
      },
    })
    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.inventoryRepository.valueReport).toHaveBeenCalledWith(
      SALON_ID,
      null,
    )
  })

  it.each(keepers)(
    'reports the value of the stock of their salon to %s, of the category asked',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      const result = await report(dependencies, actor, {
        salonId: SALON_ID,
        category: 'ヘアケア',
      })

      expect(result.type).toBe('success')
      expect(dependencies.inventoryRepository.valueReport).toHaveBeenCalledWith(
        SALON_ID,
        'ヘアケア',
      )
    },
  )

  it.each(outsiders)(
    'refuses %s before it looks at the query',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      const result = await report(dependencies, actor, { category: '' })

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('tells a keeper what is wrong with a query before anything is looked up', async () => {
    const dependencies = inventoryDependencies()

    const result = await report(dependencies, actors.ofSalon('manager'), {
      salonId: OTHER_SALON_ID,
      category: ' ',
    })

    expect(rulesOf(result)).toEqual(['category:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it.each(keepers)(
    'refuses %s the stock of another salon before the salon is looked up',
    async (_case, actor) => {
      const dependencies = inventoryDependencies()

      const result = await report(dependencies, actor, {
        salonId: OTHER_SALON_ID,
      })

      expect(result).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a salon that is not there as a property of the query', async () => {
    const dependencies = inventoryDependencies({}, missingSalon)

    const result = await report(dependencies)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid inventory value report' },
    })
    expect(rulesOf(result)).toEqual(['salonId:not_found'])
    expect(dependencies.inventoryRepository.valueReport).not.toHaveBeenCalled()
  })

  it('passes on a failure of the database', async () => {
    expect(
      await report(
        inventoryDependencies({}, { exists: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
    expect(
      await report(
        inventoryDependencies({ valueReport: vi.fn(async () => databaseDown) }),
      ),
    ).toEqual(databaseDown)
  })

  it('tells the database is wrong of a value it cannot show', async () => {
    const dependencies = inventoryDependencies({
      valueReport: vi.fn(async () =>
        Result.success([{ category: null, value: '1.5', itemCount: 1 }]),
      ),
    })

    expect(await report(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })
})
