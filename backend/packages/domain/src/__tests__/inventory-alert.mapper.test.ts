import { describe, expect, it } from 'vitest'
import type { InventoryAlert } from '../business-logic/inventory-alert'
import { InventoryAlertReadMapper } from '../mappers/read/inventory-alert.mapper'
import { STAFF_ID } from './auth-fixtures'
import { SALON_ID } from './fixtures'
import {
  ACKNOWLEDGEMENT_ID,
  dbAcknowledgement,
} from './inventory-alert-fixtures'
import { INVENTORY_ID, OTHER_INVENTORY_ID } from './inventory-fixtures'
import { PRODUCT_ID } from './product-fixtures'

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
