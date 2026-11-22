import { describe, expect, it } from 'vitest'
import { STAFF_ID } from '../../__tests__/fixtures/auth-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  ACKNOWLEDGEMENT_ID,
  dbAcknowledgement,
} from '../../__tests__/fixtures/inventory-alert-fixtures'
import {
  INVENTORY_ID,
  OTHER_INVENTORY_ID,
} from '../../__tests__/fixtures/inventory-fixtures'
import {
  OTHER_PRODUCT_ID,
  PRODUCT_ID,
} from '../../__tests__/fixtures/product-fixtures'
import type { InventoryAlert } from '../../business-logic/inventory-alert'
import {
  inventoryAlertSearchRequestSchema,
  inventoryAlertSummaryRequestSchema,
} from '../../schemas/inventory-alert.schema'
import { InventoryAlertReadMapper } from '../read/inventory-alert.mapper'
import { InventoryAlertWriteMapper } from '../write/inventory-alert.mapper'

/** An alert of a stock row that has expired, acknowledged by a staff member. */
const expiredRow = (
  overrides: Partial<InventoryAlert> = {},
): InventoryAlert => ({
  alert: 'expired',
  severity: 'critical',
  salonId: SALON_ID,
  productId: PRODUCT_ID,
  productCode: 'SHMP001',
  productName: 'モイストシャンプー',
  unit: '本',
  inventoryId: INVENTORY_ID,
  lotNumber: 'LOT-2026-001',
  expiryDate: '2026-11-01',
  currentStock: '0.25',
  threshold: null,
  acknowledgement: dbAcknowledgement({
    inventoryId: INVENTORY_ID,
    alert: 'expired',
    severity: 'critical',
    threshold: null,
    expiryDate: '2026-11-01',
    notes: null,
  }),
  position: { place: 4, inventoryId: INVENTORY_ID, expiryDate: '2026-11-01' },
  ...overrides,
})

describe('InventoryAlertReadMapper', () => {
  it('shows an alert with its figures as numbers and the acknowledgement as its row, in ISO 8601', () => {
    expect(InventoryAlertReadMapper.toApiInventoryAlert(expiredRow())).toEqual({
      type: 'success',
      data: {
        alert: 'expired',
        severity: 'critical',
        salonId: SALON_ID,
        productId: PRODUCT_ID,
        productCode: 'SHMP001',
        productName: 'モイストシャンプー',
        unit: '本',
        inventoryId: INVENTORY_ID,
        lotNumber: 'LOT-2026-001',
        expiryDate: '2026-11-01',
        currentStock: 0.25,
        threshold: null,
        acknowledgement: {
          id: ACKNOWLEDGEMENT_ID,
          salonId: SALON_ID,
          productId: PRODUCT_ID,
          inventoryId: INVENTORY_ID,
          alert: 'expired',
          severity: 'critical',
          threshold: null,
          expiryDate: '2026-11-01',
          notes: null,
          acknowledgedBy: STAFF_ID,
          acknowledgedAt: '2026-11-14T08:00:00.123Z',
        },
      },
    })
  })

  it('shows an alert of a product with its threshold, and no acknowledgement when none holds', () => {
    const mapped = InventoryAlertReadMapper.toApiInventoryAlert(
      expiredRow({
        alert: 'overstock',
        severity: 'info',
        inventoryId: null,
        lotNumber: null,
        expiryDate: null,
        currentStock: '20.50',
        threshold: '20.00',
        acknowledgement: null,
      }),
    )

    expect(mapped).toMatchObject({
      type: 'success',
      data: { currentStock: 20.5, threshold: 20, acknowledgement: null },
    })
  })

  it('shows no more than the properties of the API model', () => {
    const mapped = InventoryAlertReadMapper.toApiInventoryAlert(expiredRow())

    expect(mapped.type === 'success' && Object.keys(mapped.data)).not.toContain(
      'position',
    )
  })

  it.each([
    ['a stock figure that is not a number', { currentStock: 'some' }],
    ['a threshold that is not a number', { threshold: 'low' }],
    [
      'an acknowledgement at a time that is not a time',
      { acknowledgement: dbAcknowledgement({ acknowledgedAt: 'earlier' }) },
    ],
    [
      'an acknowledgement at a threshold that is not a number',
      { acknowledgement: dbAcknowledgement({ threshold: 'five' }) },
    ],
  ])(
    'resolves an alert with %s to a database error that names the alert',
    (_case, overrides) => {
      expect(
        InventoryAlertReadMapper.toApiInventoryAlert(expiredRow(overrides)),
      ).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Inventory alert expired of ${INVENTORY_ID} does not match the API model`,
        },
      })
    },
  )

  it('maps every alert of a list in order, and fails the list on the first it cannot map', () => {
    const alerts = [
      expiredRow(),
      expiredRow({ inventoryId: OTHER_INVENTORY_ID }),
    ]

    const mapped = InventoryAlertReadMapper.toApiInventoryAlerts(alerts)
    const failed = InventoryAlertReadMapper.toApiInventoryAlerts([
      ...alerts,
      expiredRow({ inventoryId: OTHER_INVENTORY_ID, currentStock: 'none' }),
    ])

    expect(
      mapped.type === 'success' &&
        mapped.data.map(({ inventoryId }) => inventoryId),
    ).toEqual([INVENTORY_ID, OTHER_INVENTORY_ID])
    expect(failed).toMatchObject({
      type: 'error',
      error: { message: expect.stringContaining(OTHER_INVENTORY_ID) },
    })
  })
})

describe('InventoryAlertReadMapper.toApiInventoryAlertPage', () => {
  const paging = { limit: 2, after: PRODUCT_ID }

  it('answers with the alerts, the counts of the list and the place of the page, which goes on after the stock row of its last alert', () => {
    expect(
      InventoryAlertReadMapper.toApiInventoryAlertPage(
        {
          alerts: [
            expiredRow(),
            expiredRow({ inventoryId: OTHER_INVENTORY_ID }),
          ],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        data: [
          { inventoryId: INVENTORY_ID },
          { inventoryId: OTHER_INVENTORY_ID },
        ],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: PRODUCT_ID,
          nextCursor: OTHER_INVENTORY_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('goes on after the product of a last alert that is about no stock row', () => {
    expect(
      InventoryAlertReadMapper.toApiInventoryAlertPage(
        {
          alerts: [
            expiredRow(),
            expiredRow({
              alert: 'low_stock',
              severity: 'warning',
              productId: OTHER_PRODUCT_ID,
              inventoryId: null,
              lotNumber: null,
              expiryDate: null,
              threshold: '5.00',
              acknowledgement: null,
            }),
          ],
          total: 3,
          hasMore: true,
        },
        { limit: 2, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: { meta: { cursor: null, nextCursor: OTHER_PRODUCT_ID } },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      InventoryAlertReadMapper.toApiInventoryAlertPage(
        { alerts: [expiredRow()], total: 1, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
  })

  it('answers with an empty page of a salon without alerts', () => {
    expect(
      InventoryAlertReadMapper.toApiInventoryAlertPage(
        { alerts: [], total: 0, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toStrictEqual({
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

  it('fails on the first alert that does not match the API model', () => {
    expect(
      InventoryAlertReadMapper.toApiInventoryAlertPage(
        {
          alerts: [
            expiredRow(),
            expiredRow({
              inventoryId: OTHER_INVENTORY_ID,
              currentStock: 'some',
            }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'error',
      error: { message: expect.stringContaining(OTHER_INVENTORY_ID) },
    })
  })
})

describe('InventoryAlertReadMapper.toApiInventoryAlertSummary', () => {
  it('counts the alerts, those of each severity and those not acknowledged', () => {
    expect(
      InventoryAlertReadMapper.toApiInventoryAlertSummary([
        expiredRow(),
        expiredRow({ acknowledgement: null }),
        expiredRow({ severity: 'warning' }),
        expiredRow({ severity: 'warning', acknowledgement: null }),
        expiredRow({ severity: 'info', acknowledgement: null }),
      ]),
    ).toStrictEqual({
      totalAlerts: 5,
      criticalAlerts: 2,
      warningAlerts: 2,
      infoAlerts: 1,
      unacknowledged: 3,
    })
  })

  it.each<['critical' | 'warning' | 'info', number, number, number]>([
    ['critical', 1, 0, 0],
    ['warning', 0, 1, 0],
    ['info', 0, 0, 1],
  ])(
    'counts an alert of the severity %s under it alone',
    (severity, criticalAlerts, warningAlerts, infoAlerts) => {
      expect(
        InventoryAlertReadMapper.toApiInventoryAlertSummary([
          expiredRow({ severity }),
        ]),
      ).toStrictEqual({
        totalAlerts: 1,
        criticalAlerts,
        warningAlerts,
        infoAlerts,
        unacknowledged: 0,
      })
    },
  )

  it('counts nothing of a salon without alerts', () => {
    expect(
      InventoryAlertReadMapper.toApiInventoryAlertSummary([]),
    ).toStrictEqual({
      totalAlerts: 0,
      criticalAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
      unacknowledged: 0,
    })
  })
})

describe('InventoryAlertWriteMapper.fromSearchRequest', () => {
  const unfiltered = { alert: null, severity: null, acknowledged: null }

  it('lists the first 20 alerts of the salon, whatever they are, when the request names no more than the salon', () => {
    expect(
      InventoryAlertWriteMapper.fromSearchRequest(
        inventoryAlertSearchRequestSchema.parse({ salonId: SALON_ID }),
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      filter: unfiltered,
    })
  })

  it('takes the place of the page and every filter the request names', () => {
    expect(
      InventoryAlertWriteMapper.fromSearchRequest(
        inventoryAlertSearchRequestSchema.parse({
          salonId: SALON_ID,
          limit: 5,
          cursor: INVENTORY_ID,
          alert: 'expired',
          severity: 'critical',
          acknowledged: false,
        }),
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      limit: 5,
      after: INVENTORY_ID,
      filter: { alert: 'expired', severity: 'critical', acknowledged: false },
    })
  })

  it.each<[string, Record<string, string | boolean>]>([
    ['the type of alert', { alert: 'low_stock' }],
    ['the severity', { severity: 'warning' }],
    ['whether an acknowledgement holds', { acknowledged: true }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      InventoryAlertWriteMapper.fromSearchRequest(
        inventoryAlertSearchRequestSchema.parse({
          salonId: SALON_ID,
          ...filter,
        }),
      ).filter,
    ).toStrictEqual({ ...unfiltered, ...filter })
  })
})

describe('InventoryAlertWriteMapper', () => {
  it('counts the alerts of the salon the request names', () => {
    expect(
      InventoryAlertWriteMapper.fromSummaryRequest(
        inventoryAlertSummaryRequestSchema.parse({ salonId: SALON_ID }),
      ),
    ).toStrictEqual({ salonId: SALON_ID })
  })

  it('acknowledges the alert the request names, by the staff member', () => {
    expect(
      InventoryAlertWriteMapper.fromAcknowledgeRequest(
        {
          alert: 'expired',
          productId: PRODUCT_ID,
          inventoryId: INVENTORY_ID,
          notes: '廃棄の手配をした',
        },
        STAFF_ID,
      ),
    ).toStrictEqual({
      alert: 'expired',
      productId: PRODUCT_ID,
      inventoryId: INVENTORY_ID,
      notes: '廃棄の手配をした',
      acknowledgedBy: STAFF_ID,
    })
  })

  it('acknowledges an alert of a product without a note, by no staff member', () => {
    expect(
      InventoryAlertWriteMapper.fromAcknowledgeRequest(
        {
          alert: 'low_stock',
          productId: OTHER_PRODUCT_ID,
          inventoryId: null,
          notes: null,
        },
        null,
      ),
    ).toStrictEqual({
      alert: 'low_stock',
      productId: OTHER_PRODUCT_ID,
      inventoryId: null,
      notes: null,
      acknowledgedBy: null,
    })
  })
})
