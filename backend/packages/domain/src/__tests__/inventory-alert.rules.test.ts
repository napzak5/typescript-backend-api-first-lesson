import { describe, expect, it } from 'vitest'
import {
  type AlertAcknowledgement,
  alertDaysOf,
  alertsOf,
  comparePositions,
  decideAcknowledgement,
  type InventoryAlert,
  type InventoryAlertFilter,
  matchesFilter,
  pageOfAlerts,
  productAcknowledgementHolds,
  productAlertOf,
  stockRowAcknowledgementHolds,
  stockRowAlertOf,
  subjectIdOf,
  subjectOf,
} from '../business-logic/inventory-alert/_shared/alerts'
import type {
  DbAcknowledgementOfAlert,
  DbInventoryAlertFacts,
  DbProductStockOfAlert,
  DbStockRowOfAlert,
  InventoryAlertSeverity,
  InventoryAlertType,
} from '../models/inventory-alert'
import { NOW, STAFF_ID } from './auth-fixtures'
import { SALON_ID } from './fixtures'
import {
  DAYS,
  dbAcknowledgement,
  productAcknowledgement,
  productStock,
  stockRow,
  stockRowAcknowledgement,
} from './inventory-alert-fixtures'
import { INVENTORY_ID, OTHER_INVENTORY_ID } from './inventory-fixtures'
import { PRODUCT_ID } from './product-fixtures'

const OTHER_PRODUCT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f99'

type ProductAlert = Parameters<typeof productAcknowledgementHolds>[0]

const lowStock: ProductAlert = {
  alert: 'low_stock',
  severity: 'warning',
  threshold: '5.00',
}
const overstock: ProductAlert = {
  alert: 'overstock',
  severity: 'info',
  threshold: '20.00',
}

const product = (fact: DbAcknowledgementOfAlert) =>
  fact.type === 'product' ? fact : null
const row = (fact: DbAcknowledgementOfAlert) =>
  fact.type === 'stockRow' ? fact : null

describe('alertDaysOf', () => {
  it('should count today and the last day that expires soon by the clocks of the salon', () => {
    expect(alertDaysOf(NOW, 'Asia/Tokyo')).toEqual(DAYS)
  })

  it('should take the next day once it is midnight at the salon', () => {
    const midnightInTokyo = new Date('2026-11-14T15:00:00.000Z')

    expect(alertDaysOf(midnightInTokyo, 'Asia/Tokyo')).toEqual({
      today: '2026-11-15',
      lastExpiringDay: '2026-12-15',
    })
    expect(alertDaysOf(midnightInTokyo, 'UTC')).toEqual({
      today: '2026-11-14',
      lastExpiringDay: '2026-12-14',
    })
  })

  it('should know no days of a time zone the runtime does not know', () => {
    expect(alertDaysOf(NOW, 'Mars/Olympus_Mons')).toBeNull()
  })
})

describe('subjectOf', () => {
  it.each<[InventoryAlertType, ReturnType<typeof subjectOf>]>([
    ['low_stock', 'product'],
    ['overstock', 'product'],
    ['expiring', 'stockRow'],
    ['expired', 'stockRow'],
  ])('should tell that %s is about a %s', (alert, subject) => {
    expect(subjectOf(alert)).toBe(subject)
  })
})

describe('productAlertOf', () => {
  it.each<[string, Partial<DbProductStockOfAlert>, ProductAlert]>([
    ['below its minimum', { stock: '3.00' }, lowStock],
    ['just below its minimum', { stock: '4.99' }, lowStock],
    ['at its minimum', { stock: '5.00' }, lowStock],
    ['with one left', { stock: '1.00' }, lowStock],
    ['with a hundredth left', { stock: '0.01' }, lowStock],
    ['without stock', { stock: '0.00' }, { ...lowStock, severity: 'critical' }],
    [
      'without stock at a minimum of 0',
      { stock: '0.00', minimumStock: '0.00' },
      { alert: 'low_stock', severity: 'critical', threshold: '0.00' },
    ],
    ['above its maximum', { stock: '20.01' }, overstock],
    [
      'at a minimum that is its maximum',
      { stock: '5.00', maximumStock: '5.00' },
      lowStock,
    ],
  ])('should tell the alert of a product %s', (_, stock, alert) => {
    expect(productAlertOf(productStock(stock))).toEqual(alert)
  })

  it.each<[string, Partial<DbProductStockOfAlert>]>([
    ['just above its minimum', { stock: '5.01' }],
    ['at its maximum', { stock: '20.00' }],
    [
      'far above its minimum without a maximum',
      { stock: '999.00', maximumStock: null },
    ],
  ])('should give a product %s no alert', (_, stock) => {
    expect(productAlertOf(productStock(stock))).toBeNull()
  })
})

describe('stockRowAlertOf', () => {
  it.each<[string, string, InventoryAlertType, InventoryAlertSeverity]>([
    ['that expired yesterday', '2026-11-13', 'expired', 'critical'],
    ['that expired long ago', '2025-12-31', 'expired', 'critical'],
    ['that expires today', '2026-11-14', 'expiring', 'warning'],
    ['that expires in ten days', '2026-11-24', 'expiring', 'warning'],
    ['that expires on the last day', '2026-12-14', 'expiring', 'warning'],
  ])('should tell the alert of a row %s', (_, expiryDate, alert, severity) => {
    expect(stockRowAlertOf(stockRow({ expiryDate }), DAYS)).toEqual({
      alert,
      severity,
    })
  })

  it('should tell the alert of a row with the least stock there is', () => {
    expect(stockRowAlertOf(stockRow({ currentStock: '0.01' }), DAYS)).toEqual({
      alert: 'expiring',
      severity: 'warning',
    })
  })

  it.each<[string, Partial<DbStockRowOfAlert>]>([
    ['that expires the day after the last', { expiryDate: '2026-12-15' }],
    ['without stock', { currentStock: '0.00' }],
    [
      'without stock that has expired',
      { currentStock: '0.00', expiryDate: '2026-11-01' },
    ],
  ])('should give a row %s no alert', (_, overrides) => {
    expect(stockRowAlertOf(stockRow(overrides), DAYS)).toBeNull()
  })
})

describe('productAcknowledgementHolds', () => {
  const holds = (
    alert: ProductAlert,
    fact: DbAcknowledgementOfAlert,
  ): boolean | null => {
    const ofProduct = product(fact)
    return ofProduct === null
      ? null
      : productAcknowledgementHolds(alert, ofProduct)
  }

  it('should hold for a low stock that stayed low', () => {
    expect(holds(lowStock, productAcknowledgement())).toBe(true)
  })

  it('should hold for a low stock that went up to its minimum and no further', () => {
    expect(
      holds(
        lowStock,
        productAcknowledgement(
          {},
          { lowestStock: '1.00', highestStock: '5.00' },
        ),
      ),
    ).toBe(true)
  })

  it('should not hold once the stock went above the minimum since', () => {
    expect(
      holds(
        lowStock,
        productAcknowledgement(
          {},
          { lowestStock: '3.00', highestStock: '5.01' },
        ),
      ),
    ).toBe(false)
  })

  it('should not hold for a warning once the stock ran out since', () => {
    expect(
      holds(
        lowStock,
        productAcknowledgement(
          {},
          { lowestStock: '0.00', highestStock: '3.00' },
        ),
      ),
    ).toBe(false)
  })

  it('should hold for a stock that ran out when it was acknowledged as critical', () => {
    expect(
      holds(
        { ...lowStock, severity: 'warning' },
        productAcknowledgement(
          { severity: 'critical' },
          { lowestStock: '0.00', highestStock: '2.00' },
        ),
      ),
    ).toBe(true)
  })

  it('should hold for the least stock above none', () => {
    expect(
      holds(
        lowStock,
        productAcknowledgement(
          {},
          { lowestStock: '0.01', highestStock: '3.00' },
        ),
      ),
    ).toBe(true)
  })

  it('should not hold once the minimum changed', () => {
    expect(
      holds({ ...lowStock, threshold: '6.00' }, productAcknowledgement()),
    ).toBe(false)
  })

  it('should take a threshold written otherwise for the same figure', () => {
    expect(
      holds({ ...lowStock, threshold: '5' }, productAcknowledgement()),
    ).toBe(true)
  })

  it('should not hold without the threshold it was given at', () => {
    expect(holds(lowStock, productAcknowledgement({ threshold: null }))).toBe(
      false,
    )
  })

  it('should hold for an overstock that stayed above the maximum', () => {
    expect(
      holds(
        overstock,
        productAcknowledgement(
          { alert: 'overstock', severity: 'info', threshold: '20.00' },
          { lowestStock: '20.01', highestStock: '99.00' },
        ),
      ),
    ).toBe(true)
  })

  it('should not hold for an overstock that came down to the maximum since', () => {
    expect(
      holds(
        overstock,
        productAcknowledgement(
          { alert: 'overstock', severity: 'info', threshold: '20.00' },
          { lowestStock: '20.00', highestStock: '25.00' },
        ),
      ),
    ).toBe(false)
  })
})

describe('stockRowAcknowledgementHolds', () => {
  const holds = (expiryDate: string, fact: DbAcknowledgementOfAlert) => {
    const ofRow = row(fact)
    return ofRow === null
      ? null
      : stockRowAcknowledgementHolds(expiryDate, ofRow)
  }

  it('should hold for a row that expires on the day it was acknowledged for', () => {
    expect(holds('2026-11-24', stockRowAcknowledgement())).toBe(true)
  })

  it('should hold for a row that kept some stock through the movements since', () => {
    expect(holds('2026-11-24', stockRowAcknowledgement({}, '0.01'))).toBe(true)
  })

  it('should not hold once a movement left the row without stock', () => {
    expect(holds('2026-11-24', stockRowAcknowledgement({}, '0.00'))).toBe(false)
  })

  it('should not hold once the expiry date of the row changed', () => {
    expect(holds('2026-11-25', stockRowAcknowledgement())).toBe(false)
  })
})

describe('comparePositions', () => {
  const at = (
    place: number,
    inventoryId: string | null = null,
    expiryDate: string | null = null,
  ) => ({ place, inventoryId, expiryDate })

  it.each([
    ['an earlier product', at(1, INVENTORY_ID, '2026-01-01'), at(2)],
    ['the product before its rows', at(1), at(1, INVENTORY_ID, '2025-01-01')],
    [
      'an earlier expiry date',
      at(1, OTHER_INVENTORY_ID, '2026-11-20'),
      at(1, INVENTORY_ID, '2026-11-21'),
    ],
    [
      'the lower ID at one expiry date',
      at(1, INVENTORY_ID, '2026-11-20'),
      at(1, OTHER_INVENTORY_ID, '2026-11-20'),
    ],
    [
      'a row without an expiry date before those with one',
      at(1, OTHER_INVENTORY_ID, null),
      at(1, INVENTORY_ID, '2026-11-20'),
    ],
  ])('should put %s first', (_, first, second) => {
    expect(comparePositions(first, second)).toBeLessThan(0)
    expect(comparePositions(second, first)).toBeGreaterThan(0)
  })

  it('should find a position equal to itself', () => {
    expect(
      comparePositions(
        at(1, INVENTORY_ID, '2026-11-20'),
        at(1, INVENTORY_ID, '2026-11-20'),
      ),
    ).toBe(0)
  })
})

describe('alertsOf', () => {
  const facts = (
    overrides: Partial<DbInventoryAlertFacts> = {},
  ): DbInventoryAlertFacts => ({
    products: [],
    rows: [],
    acknowledgements: [],
    ...overrides,
  })

  it('should tell the alert of a product with what it is about', () => {
    expect(alertsOf(facts({ products: [productStock()] }), DAYS)).toEqual([
      {
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
        acknowledgement: null,
        position: { place: 1, inventoryId: null, expiryDate: null },
      },
    ])
  })

  it('should tell the alert of a stock row with what it is about', () => {
    expect(alertsOf(facts({ rows: [stockRow()] }), DAYS)).toEqual([
      {
        alert: 'expiring',
        severity: 'warning',
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        productCode: 'SHMP001',
        productName: 'モイストシャンプー',
        unit: '本',
        inventoryId: INVENTORY_ID,
        lotNumber: 'LOT-2026-001',
        expiryDate: '2026-11-24',
        currentStock: '2.50',
        threshold: null,
        acknowledgement: null,
        position: {
          place: 1,
          inventoryId: INVENTORY_ID,
          expiryDate: '2026-11-24',
        },
      },
    ])
  })

  it('should leave out a product and a row that have no alert', () => {
    expect(
      alertsOf(
        facts({
          products: [productStock({ stock: '10.00' })],
          rows: [stockRow({ expiryDate: '2027-01-01' })],
        }),
        DAYS,
      ),
    ).toEqual([])
  })

  it('should put the alerts in the order of their positions', () => {
    const alerts = alertsOf(
      facts({
        products: [
          productStock({ productId: OTHER_PRODUCT_ID, place: 2 }),
          productStock({ place: 1 }),
        ],
        rows: [
          stockRow({
            inventoryId: OTHER_INVENTORY_ID,
            expiryDate: '2026-11-30',
          }),
          stockRow({
            productId: OTHER_PRODUCT_ID,
            place: 2,
            inventoryId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e03',
          }),
          stockRow({ expiryDate: '2026-11-01' }),
        ],
      }),
      DAYS,
    )

    expect(
      alerts.map((alert) => `${alert.alert}:${subjectIdOf(alert)}`),
    ).toEqual([
      `low_stock:${PRODUCT_ID}`,
      `expired:${INVENTORY_ID}`,
      `expiring:${OTHER_INVENTORY_ID}`,
      `low_stock:${OTHER_PRODUCT_ID}`,
      'expiring:0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e03',
    ])
  })

  it('should give an alert the acknowledgement of it that still holds', () => {
    const [ofProduct, ofRow] = alertsOf(
      facts({
        products: [productStock()],
        rows: [stockRow()],
        acknowledgements: [productAcknowledgement(), stockRowAcknowledgement()],
      }),
      DAYS,
    )

    expect(ofProduct?.acknowledgement).toEqual(dbAcknowledgement())
    expect(ofRow?.acknowledgement).toEqual(
      dbAcknowledgement({
        inventoryId: INVENTORY_ID,
        alert: 'expiring',
        threshold: null,
        expiryDate: '2026-11-24',
      }),
    )
  })

  it('should give an alert no acknowledgement that no longer holds', () => {
    const alerts = alertsOf(
      facts({
        products: [productStock()],
        rows: [stockRow()],
        acknowledgements: [
          productAcknowledgement(
            {},
            { lowestStock: '3.00', highestStock: '6.00' },
          ),
          stockRowAcknowledgement({}, '0.00'),
        ],
      }),
      DAYS,
    )

    expect(alerts.map(({ acknowledgement }) => acknowledgement)).toEqual([
      null,
      null,
    ])
  })

  it('should give an alert no acknowledgement of another alert of what it is about', () => {
    const alerts = alertsOf(
      facts({
        products: [productStock({ stock: '25.00' })],
        rows: [stockRow({ expiryDate: '2026-11-13' })],
        acknowledgements: [
          productAcknowledgement(),
          stockRowAcknowledgement({ expiryDate: '2026-11-13' }),
        ],
      }),
      DAYS,
    )

    expect(
      alerts.map(({ alert, acknowledgement }) => [alert, acknowledgement]),
    ).toEqual([
      ['overstock', null],
      ['expired', null],
    ])
  })

  it('should give an alert no acknowledgement of what another product or row is about', () => {
    const alerts = alertsOf(
      facts({
        products: [productStock()],
        rows: [stockRow()],
        acknowledgements: [
          productAcknowledgement({ productId: OTHER_PRODUCT_ID }),
          stockRowAcknowledgement({ inventoryId: OTHER_INVENTORY_ID }),
        ],
      }),
      DAYS,
    )

    expect(alerts.map(({ acknowledgement }) => acknowledgement)).toEqual([
      null,
      null,
    ])
  })
})

describe('matchesFilter', () => {
  const [low, expiring] = alertsOf(
    {
      products: [productStock()],
      rows: [stockRow()],
      acknowledgements: [productAcknowledgement()],
    },
    DAYS,
  )
  const none: InventoryAlertFilter = {
    alert: null,
    severity: null,
    acknowledged: null,
  }

  it.each<[string, InventoryAlertFilter, boolean[]]>([
    ['no filter', none, [true, true]],
    ['a type', { ...none, alert: 'expiring' }, [false, true]],
    ['a severity', { ...none, severity: 'warning' }, [true, true]],
    ['another severity', { ...none, severity: 'critical' }, [false, false]],
    ['the acknowledged ones', { ...none, acknowledged: true }, [true, false]],
    ['the others', { ...none, acknowledged: false }, [false, true]],
    [
      'a type and whether acknowledged',
      { ...none, alert: 'low_stock', acknowledged: false },
      [false, false],
    ],
  ])('should keep the alerts of %s', (_, filter, kept) => {
    const alerts: InventoryAlert[] = [low, expiring].flatMap((alert) =>
      alert === undefined ? [] : [alert],
    )

    expect(alerts.map((alert) => matchesFilter(alert, filter))).toEqual(kept)
  })
})

describe('pageOfAlerts', () => {
  const alerts = alertsOf(
    {
      products: [1, 2, 3].map((place) =>
        productStock({
          productId: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f0${place}`,
          place,
        }),
      ),
      rows: [],
      acknowledgements: [],
    },
    DAYS,
  )
  const places = (page: { alerts: InventoryAlert[] }) =>
    page.alerts.map(({ position }) => position.place)

  it('should give the first alerts up to the limit, and say how many there are and that more follow', () => {
    const page = pageOfAlerts(alerts, null, 2)

    expect(places(page)).toEqual([1, 2])
    expect(page.total).toBe(3)
    expect(page.hasMore).toBe(true)
  })

  it('should give a page that is exactly full without more', () => {
    expect(pageOfAlerts(alerts, null, 3).hasMore).toBe(false)
  })

  it('should go on after the position of the cursor', () => {
    const page = pageOfAlerts(
      alerts,
      { place: 1, inventoryId: null, expiryDate: null },
      2,
    )

    expect(places(page)).toEqual([2, 3])
    expect(page.total).toBe(3)
    expect(page.hasMore).toBe(false)
  })

  it('should go on after a position no alert has any more', () => {
    const page = pageOfAlerts(
      alerts,
      { place: 2, inventoryId: INVENTORY_ID, expiryDate: '2026-11-20' },
      5,
    )

    expect(places(page)).toEqual([3])
  })

  it('should give nothing after the last alert', () => {
    const page = pageOfAlerts(
      alerts,
      { place: 3, inventoryId: null, expiryDate: null },
      5,
    )

    expect(page).toStrictEqual({ alerts: [], total: 3, hasMore: false })
  })
})

describe('decideAcknowledgement', () => {
  const request: AlertAcknowledgement = {
    alert: 'low_stock',
    productId: PRODUCT_ID,
    inventoryId: null,
    notes: '発注済み',
    acknowledgedBy: STAFF_ID,
  }
  const ofProduct: DbInventoryAlertFacts = {
    products: [productStock()],
    rows: [],
    acknowledgements: [],
  }

  it('should acknowledge the alert of a product as it is now', () => {
    const decision = decideAcknowledgement(ofProduct, DAYS, request)

    expect(decision).toMatchObject({
      type: 'acknowledge',
      alert: {
        alert: 'low_stock',
        productId: PRODUCT_ID,
        acknowledgement: null,
      },
    })
    expect(decision.type === 'acknowledge' && decision.acknowledgement).toEqual(
      {
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        inventoryId: null,
        alert: 'low_stock',
        severity: 'warning',
        threshold: '5.00',
        expiryDate: null,
        notes: '発注済み',
        acknowledgedBy: STAFF_ID,
      },
    )
  })

  it('should acknowledge the alert of a stock row as it is now, by an administrator', () => {
    const decision = decideAcknowledgement(
      {
        products: [],
        rows: [stockRow({ expiryDate: '2026-11-01' })],
        acknowledgements: [],
      },
      DAYS,
      {
        ...request,
        alert: 'expired',
        inventoryId: INVENTORY_ID,
        notes: null,
        acknowledgedBy: null,
      },
    )

    expect(decision.type === 'acknowledge' && decision.acknowledgement).toEqual(
      {
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        inventoryId: INVENTORY_ID,
        alert: 'expired',
        severity: 'critical',
        threshold: null,
        expiryDate: '2026-11-01',
        notes: null,
        acknowledgedBy: null,
      },
    )
  })

  it.each<[string, DbInventoryAlertFacts, AlertAcknowledgement]>([
    [
      'a product without the alert',
      { ...ofProduct, products: [productStock({ stock: '10.00' })] },
      request,
    ],
    ['an alert of another type', ofProduct, { ...request, alert: 'overstock' }],
    ['another product', ofProduct, { ...request, productId: OTHER_PRODUCT_ID }],
    [
      'a row of another product',
      { products: [], rows: [stockRow()], acknowledgements: [] },
      {
        ...request,
        alert: 'expiring',
        productId: OTHER_PRODUCT_ID,
        inventoryId: INVENTORY_ID,
      },
    ],
    [
      'another row',
      { products: [], rows: [stockRow()], acknowledgements: [] },
      { ...request, alert: 'expiring', inventoryId: OTHER_INVENTORY_ID },
    ],
    [
      'the product of a row for its alert',
      { products: [], rows: [stockRow()], acknowledgements: [] },
      { ...request, alert: 'expiring' },
    ],
  ])('should find no alert to acknowledge of %s', (_, facts, asked) => {
    expect(decideAcknowledgement(facts, DAYS, asked)).toEqual({
      type: 'notActive',
    })
  })

  it('should not acknowledge an alert an acknowledgement still holds for', () => {
    expect(
      decideAcknowledgement(
        { ...ofProduct, acknowledgements: [productAcknowledgement()] },
        DAYS,
        request,
      ),
    ).toEqual({ type: 'alreadyAcknowledged' })
  })

  it('should acknowledge again an alert whose acknowledgement no longer holds', () => {
    expect(
      decideAcknowledgement(
        {
          ...ofProduct,
          acknowledgements: [
            productAcknowledgement(
              {},
              { lowestStock: '3.00', highestStock: '8.00' },
            ),
          ],
        },
        DAYS,
        request,
      ).type,
    ).toBe('acknowledge')
  })
})
