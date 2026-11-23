import { Result } from '@beauty-salon-backend/utility'
import { inventoryAlertMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  NOW,
  STAFF_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  dbOpeningHours,
  dbSalon,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  dbAcknowledgement,
  inventoryAlertDependencies,
  productAcknowledgement,
  productStock,
  stockRow,
} from '../../../__tests__/fixtures/inventory-alert-fixtures'
import {
  INVENTORY_ID,
  OTHER_INVENTORY_ID,
} from '../../../__tests__/fixtures/inventory-fixtures'
import { PRODUCT_ID } from '../../../__tests__/fixtures/product-fixtures'
import type { Actor } from '../../../models/auth'
import type { DbInventoryAlertFacts } from '../../../models/inventory-alert'
import type {
  InventoryAlertAcknowledging,
  InventoryAlertFactsAfter,
} from '../../../repositories/inventory-alert.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  AcknowledgeInventoryAlertUseCase,
  GetInventoryAlertSummaryUseCase,
  type InventoryAlertUseCaseDependencies,
  ListInventoryAlertsUseCase,
} from '..'

const OTHER_PRODUCT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f99'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Whether no repository was asked anything. */
const untouched = ({
  inventoryAlertRepository,
  salonRepository,
}: InventoryAlertUseCaseDependencies): boolean =>
  [
    ...Object.values(inventoryAlertRepository),
    ...Object.values(salonRepository),
  ].every((method) => vi.mocked(method).mock.calls.length === 0)

const members: [string, Actor][] = [
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
]

const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

/** A salon repository whose one salon keeps the given clocks. */
const salonIn = (timezone: string) => ({
  findById: vi.fn(async () =>
    Result.success({
      salon: dbSalon({ timezone }),
      openingHours: [dbOpeningHours()],
    }),
  ),
})

const noSalon = {
  findById: vi.fn(async () => Result.success(null)),
}

/** Three products with low stock, at the first three places of the salon. */
const threeProducts: DbInventoryAlertFacts = {
  products: [1, 2, 3].map((place) =>
    productStock({
      productId: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f0${place}`,
      place,
    }),
  ),
  rows: [],
  acknowledgements: [],
}

describe('ListInventoryAlertsUseCase', () => {
  const list = (
    dependencies: InventoryAlertUseCaseDependencies,
    actor: Actor = actors.admin,
    query: Result<unknown, DomainError> = Result.success({ salonId: SALON_ID }),
  ) => new ListInventoryAlertsUseCase(dependencies).execute(actor, query)

  it.each([['an administrator', actors.admin], ...members])(
    'lists the alerts of the salon for %s as they are now, 20 to a page',
    async (_who, actor) => {
      const dependencies = inventoryAlertDependencies()

      const result = await list(dependencies, actor)

      expect(result).toEqual({
        type: 'success',
        data: {
          data: [
            expect.objectContaining({
              alert: 'low_stock',
              productId: PRODUCT_ID,
              inventoryId: null,
              currentStock: 3,
              threshold: 5,
            }),
            expect.objectContaining({
              alert: 'expiring',
              inventoryId: INVENTORY_ID,
              currentStock: 2.5,
              threshold: null,
            }),
          ],
          meta: {
            total: 2,
            limit: 20,
            hasMore: false,
            cursor: null,
            nextCursor: null,
            prevCursor: null,
          },
        },
      })
      expect(
        dependencies.inventoryAlertRepository.listFacts,
      ).toHaveBeenCalledWith({
        salonId: SALON_ID,
        lastExpiringDay: '2026-12-14',
      })
      expect(dependencies.salonRepository.findById).toHaveBeenCalledWith(
        SALON_ID,
      )
    },
  )

  it('counts the days by the clocks of the salon', async () => {
    const dependencies = inventoryAlertDependencies(
      {},
      salonIn('Pacific/Honolulu'),
    )

    await list(dependencies)

    // At NOW it is still 2026-11-13 in Honolulu.
    expect(
      dependencies.inventoryAlertRepository.listFacts,
    ).toHaveBeenCalledWith({
      salonId: SALON_ID,
      lastExpiringDay: '2026-12-13',
    })
  })

  it('narrows the alerts by type, severity and whether they are acknowledged, and counts those it keeps', async () => {
    const dependencies = inventoryAlertDependencies({
      listFacts: vi.fn(async () =>
        Result.success({
          products: [productStock()],
          rows: [stockRow(), stockRow({ inventoryId: OTHER_INVENTORY_ID })],
          acknowledgements: [productAcknowledgement()],
        }),
      ),
    })
    const listed = async (query: Record<string, unknown>) => {
      const result = await list(
        dependencies,
        actors.admin,
        Result.success({ salonId: SALON_ID, ...query }),
      )
      return result.type === 'success'
        ? result.data.data.map(
            ({ alert, inventoryId }) => `${alert}:${inventoryId}`,
          )
        : result
    }

    expect(await listed({ alert: 'expiring' })).toEqual([
      `expiring:${INVENTORY_ID}`,
      `expiring:${OTHER_INVENTORY_ID}`,
    ])
    expect(await listed({ severity: 'warning', acknowledged: true })).toEqual([
      'low_stock:null',
    ])
    expect(await listed({ acknowledged: false })).toEqual([
      `expiring:${INVENTORY_ID}`,
      `expiring:${OTHER_INVENTORY_ID}`,
    ])
    expect(await listed({ severity: 'critical' })).toEqual([])
    expect(
      await list(
        dependencies,
        actors.admin,
        Result.success({ salonId: SALON_ID, acknowledged: false, limit: 1 }),
      ),
    ).toMatchObject({
      type: 'success',
      data: { meta: { total: 2, hasMore: true, nextCursor: INVENTORY_ID } },
    })
  })

  it('shows the acknowledgement that holds for an alert', async () => {
    const dependencies = inventoryAlertDependencies({
      listFacts: vi.fn(async () =>
        Result.success({
          products: [productStock()],
          rows: [],
          acknowledgements: [productAcknowledgement()],
        }),
      ),
    })

    expect(await list(dependencies)).toMatchObject({
      type: 'success',
      data: {
        data: [
          {
            acknowledgement: {
              id: dbAcknowledgement().id,
              alert: 'low_stock',
              severity: 'warning',
              threshold: 5,
              notes: '発注済み',
              acknowledgedBy: STAFF_ID,
              acknowledgedAt: '2026-11-14T08:00:00.123Z',
            },
          },
        ],
      },
    })
  })

  it('points to the next page from what the last alert of the page is about', async () => {
    const dependencies = inventoryAlertDependencies({
      listFacts: vi.fn(async () => Result.success(threeProducts)),
    })

    expect(
      await list(
        dependencies,
        actors.admin,
        Result.success({ salonId: SALON_ID, limit: 2 }),
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        data: [
          { productId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01' },
          { productId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f02' },
        ],
        meta: {
          total: 3,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f02',
        },
      },
    })
  })

  it('goes on after where the cursor stands, with every alert of the salon counted', async () => {
    const cursor = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f02'
    const dependencies = inventoryAlertDependencies({
      listFactsAfter: vi.fn(async () =>
        Result.success<InventoryAlertFactsAfter>({
          type: 'listed',
          facts: threeProducts,
          after: { place: 2, inventoryId: null, expiryDate: null },
        }),
      ),
    })

    const result = await list(
      dependencies,
      actors.admin,
      Result.success({ salonId: SALON_ID, limit: 2, cursor }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ productId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f03' }],
        meta: { total: 3, hasMore: false, cursor, nextCursor: null },
      },
    })
    expect(
      dependencies.inventoryAlertRepository.listFactsAfter,
    ).toHaveBeenCalledWith(
      { salonId: SALON_ID, lastExpiringDay: '2026-12-14' },
      cursor,
    )
    expect(
      dependencies.inventoryAlertRepository.listFacts,
    ).not.toHaveBeenCalled()
  })

  it('refuses a cursor that names nothing of the salon', async () => {
    const dependencies = inventoryAlertDependencies({
      listFactsAfter: vi.fn(async () =>
        Result.success<InventoryAlertFactsAfter>({ type: 'cursorNotFound' }),
      ),
    })

    expect(
      await list(
        dependencies,
        actors.admin,
        Result.success({ salonId: SALON_ID, cursor: OTHER_PRODUCT_ID }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.validation(
          inventoryAlertMessages.invalidInventoryAlertSearch,
          [
            {
              field: 'cursor',
              rule: 'not_found',
              message: inventoryAlertMessages.aProductOrStockRowOfSalon,
            },
          ],
        ),
      ),
    )
  })

  it.each(outsiders)(
    'refuses %s before the query is looked at',
    async (_who, actor) => {
      const dependencies = inventoryAlertDependencies()

      expect(
        await list(
          dependencies,
          actor,
          Result.error(DomainErrors.validation('Invalid query', [])),
        ),
      ).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('passes on a query the caller could not decode, and refuses one that breaks a rule', async () => {
    const dependencies = inventoryAlertDependencies()
    const undecoded = Result.error(
      DomainErrors.validation(
        inventoryAlertMessages.invalidInventoryAlertSearch,
        [
          {
            field: 'limit',
            rule: 'invalid_format',
            message: MADE_UP_MESSAGE,
          },
        ],
      ),
    )

    expect(await list(dependencies, actors.admin, undecoded)).toEqual(undecoded)
    expect(
      rulesOf(
        await list(
          dependencies,
          actors.admin,
          Result.success({
            alert: 'soon',
            severity: 'high',
            limit: 101,
            cursor: 'next',
            unknown: 1,
          }),
        ),
      ),
    ).toEqual([
      'limit:too_big',
      'cursor:invalid_format',
      'salonId:invalid_type',
      'alert:invalid_value',
      'severity:invalid_value',
      'unknown:unrecognized_keys',
    ])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a member of a salon who names another salon, before the salon is looked up', async () => {
    const dependencies = inventoryAlertDependencies()

    expect(
      await list(
        dependencies,
        actors.ofSalon('staff'),
        Result.success({ salonId: OTHER_SALON_ID }),
      ),
    ).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a salon that is not there, as a property of the query', async () => {
    const dependencies = inventoryAlertDependencies({}, noSalon)

    expect(rulesOf(await list(dependencies))).toEqual(['salonId:not_found'])
    expect(
      dependencies.inventoryAlertRepository.listFacts,
    ).not.toHaveBeenCalled()
  })

  it('fails on a stored salon whose time zone the runtime does not know', async () => {
    const dependencies = inventoryAlertDependencies(
      {},
      salonIn('Mars/Olympus_Mons'),
    )

    expect(await list(dependencies)).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored salon ${SALON_ID} has a time zone the runtime does not know`,
      },
    })
    expect(
      dependencies.inventoryAlertRepository.listFacts,
    ).not.toHaveBeenCalled()
  })

  it('fails on a figure the database told that is not a number', async () => {
    const dependencies = inventoryAlertDependencies({
      listFacts: vi.fn(async () =>
        Result.success({
          products: [],
          rows: [stockRow({ currentStock: 'plenty' })],
          acknowledgements: [],
        }),
      ),
    })

    expect(await list(dependencies)).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Inventory alert expiring of ${INVENTORY_ID} does not match the API model`,
      },
    })
  })

  it.each([
    ['looking up the salon', {}, { findById: vi.fn(async () => databaseDown) }],
    ['reading the facts', { listFacts: vi.fn(async () => databaseDown) }, {}],
  ])('passes on a failure of %s', async (_step, alerts, salons) => {
    expect(await list(inventoryAlertDependencies(alerts, salons))).toEqual(
      databaseDown,
    )
  })
})

describe('GetInventoryAlertSummaryUseCase', () => {
  const summarize = (
    dependencies: InventoryAlertUseCaseDependencies,
    actor: Actor = actors.admin,
    query: unknown = { salonId: SALON_ID },
  ) => new GetInventoryAlertSummaryUseCase(dependencies).execute(actor, query)

  it.each([['an administrator', actors.admin], ...members])(
    'counts the alerts of the salon as they are now for %s',
    async (_who, actor) => {
      const dependencies = inventoryAlertDependencies({
        listFacts: vi.fn(async () =>
          Result.success({
            products: [productStock({ stock: '0.00' })],
            rows: [stockRow(), stockRow({ inventoryId: OTHER_INVENTORY_ID })],
            acknowledgements: [],
          }),
        ),
      })

      expect(await summarize(dependencies, actor)).toEqual(
        Result.success({
          totalAlerts: 3,
          criticalAlerts: 1,
          warningAlerts: 2,
          infoAlerts: 0,
          unacknowledged: 3,
        }),
      )
      expect(
        dependencies.inventoryAlertRepository.listFacts,
      ).toHaveBeenCalledWith({
        salonId: SALON_ID,
        lastExpiringDay: '2026-12-14',
      })
    },
  )

  it('leaves out the alerts an acknowledgement holds for from those to see to', async () => {
    const dependencies = inventoryAlertDependencies({
      listFacts: vi.fn(async () =>
        Result.success({
          products: [productStock()],
          rows: [],
          acknowledgements: [productAcknowledgement()],
        }),
      ),
    })

    expect(await summarize(dependencies)).toMatchObject({
      type: 'success',
      data: { totalAlerts: 1, unacknowledged: 0 },
    })
  })

  it.each(outsiders)(
    'refuses %s before the query is looked at',
    async (_who, actor) => {
      const dependencies = inventoryAlertDependencies()

      expect(await summarize(dependencies, actor, { salonId: 'x' })).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses a query that breaks a rule', async () => {
    const dependencies = inventoryAlertDependencies()

    expect(
      rulesOf(await summarize(dependencies, actors.admin, { limit: '1' })),
    ).toEqual(['salonId:invalid_type', 'limit:unrecognized_keys'])
    expect(
      rulesOf(await summarize(dependencies, actors.admin, { salonId: 'x' })),
    ).toEqual(['salonId:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a member of a salon who names another salon, before the salon is looked up', async () => {
    const dependencies = inventoryAlertDependencies()

    expect(
      await summarize(dependencies, actors.ofSalon('manager'), {
        salonId: OTHER_SALON_ID,
      }),
    ).toEqual(forbidden)
    expect(untouched(dependencies)).toBe(true)
  })

  it('refuses a salon that is not there, as a property of the query', async () => {
    const dependencies = inventoryAlertDependencies({}, noSalon)

    expect(rulesOf(await summarize(dependencies))).toEqual([
      'salonId:not_found',
    ])
    expect(
      dependencies.inventoryAlertRepository.listFacts,
    ).not.toHaveBeenCalled()
  })

  it('fails on a stored salon whose time zone the runtime does not know', async () => {
    expect(
      await summarize(
        inventoryAlertDependencies({}, salonIn('Mars/Olympus_Mons')),
      ),
    ).toMatchObject({ type: 'error', error: { type: 'database' } })
  })

  it.each([
    ['looking up the salon', {}, { findById: vi.fn(async () => databaseDown) }],
    ['reading the facts', { listFacts: vi.fn(async () => databaseDown) }, {}],
  ])('passes on a failure of %s', async (_step, alerts, salons) => {
    expect(await summarize(inventoryAlertDependencies(alerts, salons))).toEqual(
      databaseDown,
    )
  })
})

describe('AcknowledgeInventoryAlertUseCase', () => {
  type Named = { alert: string; productId: string; inventoryId: string | null }

  const ofProduct = {
    alert: 'low_stock',
    productId: PRODUCT_ID,
    inventoryId: null,
    notes: '発注済み',
  }
  const ofRow = {
    alert: 'expired',
    productId: PRODUCT_ID,
    inventoryId: INVENTORY_ID,
    notes: null,
  }

  const acknowledge = (
    dependencies: InventoryAlertUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    input: unknown = ofProduct,
  ) => new AcknowledgeInventoryAlertUseCase(dependencies).execute(actor, input)

  const answering = (outcome: InventoryAlertAcknowledging) =>
    inventoryAlertDependencies({
      acknowledge: vi.fn(async () => Result.success(outcome)),
    })

  const acknowledgedAlert = (): InventoryAlertAcknowledging => ({
    type: 'acknowledged',
    alert: {
      alert: 'low_stock',
      severity: 'warning',
      salonId: SALON_ID,
      productId: PRODUCT_ID,
      productCode: 'SHMP001',
      productName: 'モイストシャンプー',
      unit: '本',
      inventoryId: null,
      lotNumber: null,
      expiryDate: null,
      currentStock: '3.00',
      threshold: '5.00',
      acknowledgement: dbAcknowledgement(),
      position: { place: 1, inventoryId: null, expiryDate: null },
    },
  })

  it.each(members)(
    'acknowledges an alert of a product for %s, as the staff member they are',
    async (_who, actor) => {
      const dependencies = answering(acknowledgedAlert())

      const result = await acknowledge(dependencies, actor)

      expect(result).toEqual({
        type: 'success',
        data: {
          alert: 'low_stock',
          severity: 'warning',
          salonId: SALON_ID,
          productId: PRODUCT_ID,
          productCode: 'SHMP001',
          productName: 'モイストシャンプー',
          unit: '本',
          inventoryId: null,
          lotNumber: null,
          expiryDate: null,
          currentStock: 3,
          threshold: 5,
          acknowledgement: {
            id: dbAcknowledgement().id,
            salonId: SALON_ID,
            productId: PRODUCT_ID,
            inventoryId: null,
            alert: 'low_stock',
            severity: 'warning',
            threshold: 5,
            expiryDate: null,
            notes: '発注済み',
            acknowledgedBy: STAFF_ID,
            acknowledgedAt: '2026-11-14T08:00:00.123Z',
          },
        },
      })
      expect(
        dependencies.inventoryAlertRepository.acknowledge,
      ).toHaveBeenCalledWith(
        { type: 'salon', salonId: SALON_ID },
        { ...ofProduct, acknowledgedBy: STAFF_ID },
        NOW,
      )
    },
  )

  it('acknowledges an alert of a stock row for an administrator, as nobody of a salon', async () => {
    const dependencies = answering(acknowledgedAlert())

    await acknowledge(dependencies, actors.admin, ofRow)

    expect(
      dependencies.inventoryAlertRepository.acknowledge,
    ).toHaveBeenCalledWith(
      { type: 'everySalon' },
      { ...ofRow, acknowledgedBy: null },
      NOW,
    )
  })

  it.each<[string, InventoryAlertAcknowledging, Named]>([
    ['a product or row it does not reach', { type: 'notFound' }, ofProduct],
    ['an alert that is not there now', { type: 'notActive' }, ofRow],
  ])('does not find %s', async (_case, outcome, input) => {
    expect(await acknowledge(answering(outcome), actors.admin, input)).toEqual(
      Result.error(
        DomainErrors.notFound(
          'InventoryAlert',
          `${input.alert}:${input.inventoryId ?? input.productId}`,
        ),
      ),
    )
  })

  it('refuses an alert an acknowledgement still holds for, as a conflict', async () => {
    expect(
      await acknowledge(answering({ type: 'alreadyAcknowledged' })),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Inventory alert low_stock:${PRODUCT_ID} is acknowledged already: an acknowledgement holds while what it was given for lasts`,
        ),
      ),
    )
  })

  it('fails on a stored salon whose time zone the runtime does not know', async () => {
    expect(
      await acknowledge(
        answering({
          type: 'unknownTimeZone',
          salonId: SALON_ID,
          timezone: 'Mars/Olympus_Mons',
        }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.database(
          `Stored salon ${SALON_ID} has a time zone the runtime does not know`,
          'Mars/Olympus_Mons',
        ),
      ),
    )
  })

  it.each(outsiders)(
    'refuses %s before the request is looked at',
    async (_who, actor) => {
      const dependencies = inventoryAlertDependencies()

      expect(await acknowledge(dependencies, actor, {})).toEqual(forbidden)
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it.each([
    ['no body', null, [':invalid_type']],
    [
      'nothing it needs',
      {},
      [
        'alert:invalid_value',
        'productId:invalid_type',
        'inventoryId:invalid_type',
        'notes:invalid_type',
      ],
    ],
    [
      'a row named for an alert of a product',
      { ...ofProduct, inventoryId: INVENTORY_ID },
      ['inventoryId:custom'],
    ],
    [
      'no row named for an alert of a row',
      { ...ofRow, inventoryId: null },
      ['inventoryId:custom'],
    ],
    ['blank notes', { ...ofProduct, notes: '  ' }, ['notes:invalid_format']],
    [
      'a severity, which is the alert’s',
      { ...ofProduct, severity: 'info' },
      ['severity:unrecognized_keys'],
    ],
  ])('refuses a request with %s', async (_case, input, rules) => {
    const dependencies = inventoryAlertDependencies()

    expect(
      rulesOf(await acknowledge(dependencies, actors.admin, input)),
    ).toEqual(rules)
    expect(untouched(dependencies)).toBe(true)
  })

  it('passes on a failure of the repository', async () => {
    expect(
      await acknowledge(
        inventoryAlertDependencies({
          acknowledge: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })

  it('fails on an acknowledgement the database told that does not match the API model', async () => {
    const acknowledged = acknowledgedAlert()
    const broken: InventoryAlertAcknowledging =
      acknowledged.type === 'acknowledged'
        ? {
            ...acknowledged,
            alert: {
              ...acknowledged.alert,
              acknowledgement: dbAcknowledgement({ acknowledgedAt: 'now' }),
            },
          }
        : acknowledged

    expect(await acknowledge(answering(broken))).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })
})
