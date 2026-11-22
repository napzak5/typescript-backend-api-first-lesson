import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import { INVENTORY_ID } from '../../__tests__/fixtures/inventory-fixtures'
import { PRODUCT_ID } from '../../__tests__/fixtures/product-fixtures'
import {
  inventoryAlertAcknowledgeRequestSchema,
  inventoryAlertSearchRequestSchema,
  inventoryAlertSummaryRequestSchema,
} from '../inventory-alert.schema'

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

describe('inventoryAlertSearchRequestSchema', () => {
  it('takes a salon alone, and every filter with a page', () => {
    expect(
      brokenBy(inventoryAlertSearchRequestSchema, { salonId: SALON_ID }),
    ).toEqual([])
    expect(
      brokenBy(inventoryAlertSearchRequestSchema, {
        salonId: SALON_ID,
        limit: 100,
        cursor: INVENTORY_ID,
        alert: 'expired',
        severity: 'critical',
        acknowledged: false,
      }),
    ).toEqual([])
  })

  it.each([
    ['no salon', {}, ['salonId:invalid_type']],
    ['a limit of none', { salonId: SALON_ID, limit: 0 }, ['limit:too_small']],
    [
      'a limit of more than 100',
      { salonId: SALON_ID, limit: 101 },
      ['limit:too_big'],
    ],
    [
      'a limit that is not whole',
      { salonId: SALON_ID, limit: 1.5 },
      ['limit:invalid_type'],
    ],
    [
      'a cursor that is not an ID',
      { salonId: SALON_ID, cursor: '3' },
      ['cursor:invalid_format'],
    ],
    [
      'a type that is no alert',
      { salonId: SALON_ID, alert: 'low' },
      ['alert:invalid_value'],
    ],
    [
      'a severity there is not',
      { salonId: SALON_ID, severity: 'high' },
      ['severity:invalid_value'],
    ],
    [
      'an acknowledgement that is text',
      { salonId: SALON_ID, acknowledged: 'yes' },
      ['acknowledged:invalid_type'],
    ],
    [
      'a filter it does not know',
      { salonId: SALON_ID, type: 'expired' },
      [':unrecognized_keys'],
    ],
  ])('refuses a search with %s', (_case, value, rules) => {
    expect(brokenBy(inventoryAlertSearchRequestSchema, value)).toEqual(rules)
  })
})

describe('inventoryAlertSummaryRequestSchema', () => {
  it('takes a salon and nothing else', () => {
    expect(
      brokenBy(inventoryAlertSummaryRequestSchema, { salonId: SALON_ID }),
    ).toEqual([])
    expect(
      brokenBy(inventoryAlertSummaryRequestSchema, {
        salonId: SALON_ID,
        alert: 'expired',
      }),
    ).toEqual([':unrecognized_keys'])
    expect(
      brokenBy(inventoryAlertSummaryRequestSchema, { salonId: 'salon' }),
    ).toEqual(['salonId:invalid_format'])
  })
})

describe('inventoryAlertAcknowledgeRequestSchema', () => {
  const ofProduct = {
    alert: 'low_stock',
    productId: PRODUCT_ID,
    inventoryId: null,
    notes: '発注済み',
  }
  const ofRow = {
    alert: 'expiring',
    productId: PRODUCT_ID,
    inventoryId: INVENTORY_ID,
    notes: null,
  }

  it.each([
    ['low stock', ofProduct],
    ['too much stock', { ...ofProduct, alert: 'overstock', notes: null }],
    ['a row that expires soon', ofRow],
    [
      'a row that has expired',
      { ...ofRow, alert: 'expired', notes: '廃棄予定' },
    ],
  ])('takes an acknowledgement of %s', (_case, value) => {
    expect(brokenBy(inventoryAlertAcknowledgeRequestSchema, value)).toEqual([])
  })

  it.each([
    [
      'a row named for low stock',
      { ...ofProduct, inventoryId: INVENTORY_ID },
      'low_stock',
    ],
    [
      'a row named for too much stock',
      { ...ofProduct, alert: 'overstock', inventoryId: INVENTORY_ID },
      'overstock',
    ],
  ])('refuses %s at the row, naming the alert', (_case, value, alert) => {
    expect(
      inventoryAlertAcknowledgeRequestSchema.safeParse(value).error?.issues,
    ).toMatchObject([
      {
        code: 'custom',
        path: ['inventoryId'],
        message: `Must be null for an alert of a product (${alert})`,
      },
    ])
  })

  it.each([
    [
      'no row named for a row that expires soon',
      { ...ofRow, inventoryId: null },
      'expiring',
    ],
    [
      'no row named for a row that has expired',
      { ...ofRow, alert: 'expired', inventoryId: null },
      'expired',
    ],
  ])('refuses %s at the row, naming the alert', (_case, value, alert) => {
    expect(
      inventoryAlertAcknowledgeRequestSchema.safeParse(value).error?.issues,
    ).toMatchObject([
      {
        code: 'custom',
        path: ['inventoryId'],
        message: `Must name a stock row for an alert of a stock row (${alert})`,
      },
    ])
  })

  it.each([
    ['no alert', { ...ofProduct, alert: undefined }, ['alert:invalid_value']],
    [
      'no product',
      { ...ofProduct, productId: undefined },
      ['productId:invalid_type'],
    ],
    [
      'a product that is not an ID',
      { ...ofProduct, productId: 'p1' },
      ['productId:invalid_format'],
    ],
    [
      'a row that is not an ID',
      { ...ofRow, inventoryId: 'r1' },
      ['inventoryId:invalid_format'],
    ],
    [
      'the row left out',
      { alert: 'low_stock', productId: PRODUCT_ID, notes: null },
      ['inventoryId:invalid_type'],
    ],
    [
      'the notes left out',
      { alert: 'low_stock', productId: PRODUCT_ID, inventoryId: null },
      ['notes:invalid_type'],
    ],
    ['blank notes', { ...ofProduct, notes: ' ' }, ['notes:invalid_format']],
    [
      'a threshold of its own',
      { ...ofProduct, threshold: 1 },
      [':unrecognized_keys'],
    ],
  ])('refuses an acknowledgement with %s', (_case, value, rules) => {
    expect(brokenBy(inventoryAlertAcknowledgeRequestSchema, value)).toEqual(
      rules,
    )
  })
})
