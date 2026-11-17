import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  inventoryCreateRequestSchema,
  inventoryExpiringSearchRequestSchema,
  inventoryLowStockSearchRequestSchema,
  inventorySearchRequestSchema,
  inventoryUpdateRequestSchema,
} from '../schemas/inventory.schema'
import { SALON_ID } from './fixtures'
import { INVENTORY_ID, inventoryCreateRequest } from './inventory-fixtures'
import { PRODUCT_ID } from './product-fixtures'

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

describe('inventoryCreateRequestSchema', () => {
  it('takes a request that names everything, and gives it back as it is', () => {
    expect(
      inventoryCreateRequestSchema.parse(inventoryCreateRequest()),
    ).toEqual(inventoryCreateRequest())
  })

  it('takes null for everything but the salon and the product', () => {
    const request = {
      salonId: SALON_ID,
      productId: PRODUCT_ID,
      lotNumber: null,
      expiryDate: null,
      location: null,
      shelf: null,
      notes: null,
    }

    expect(brokenBy(inventoryCreateRequestSchema, request)).toEqual([])
  })

  it.each([
    ['a lot number of 100 characters', { lotNumber: 'L'.repeat(100) }],
    ['a location of 100 characters', { location: '棚'.repeat(100) }],
    ['a shelf of 50 characters', { shelf: 'S'.repeat(50) }],
    ['notes of any length', { notes: 'メモ'.repeat(5_000) }],
  ])('takes %s', (_case, overrides) => {
    expect(
      brokenBy(inventoryCreateRequestSchema, {
        ...inventoryCreateRequest(),
        ...overrides,
      }),
    ).toEqual([])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no salon', { salonId: null }, ['salonId:invalid_type']],
    ['no product', { productId: null }, ['productId:invalid_type']],
    [
      'a lot number of 101 characters',
      { lotNumber: 'L'.repeat(101) },
      ['lotNumber:too_big'],
    ],
    [
      'a lot number of blanks',
      { lotNumber: ' 　' },
      ['lotNumber:invalid_format'],
    ],
    [
      'a location of 101 characters',
      { location: 'L'.repeat(101) },
      ['location:too_big'],
    ],
    ['a shelf of 51 characters', { shelf: 'S'.repeat(51) }, ['shelf:too_big']],
    ['empty notes', { notes: '' }, ['notes:invalid_format']],
    [
      'an expiry date of the year 0',
      { expiryDate: '0000-06-30' },
      ['expiryDate:too_small'],
    ],
    [
      'an expiry date of no day',
      { expiryDate: '2026-04-31' },
      ['expiryDate:invalid_format'],
    ],
    [
      'stock figures',
      { currentStock: 1, reservedStock: 0 },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, overrides, broken) => {
    expect(
      brokenBy(inventoryCreateRequestSchema, {
        ...inventoryCreateRequest(),
        ...overrides,
      }),
    ).toEqual(broken)
  })

  it('refuses a request without one of its keys: every key is required', () => {
    const { notes: _notes, ...withoutNotes } = inventoryCreateRequest()

    expect(brokenBy(inventoryCreateRequestSchema, withoutNotes)).toEqual([
      'notes:invalid_type',
    ])
  })
})

describe('inventoryUpdateRequestSchema', () => {
  it.each<[string, Record<string, unknown>]>([
    ['one property', { shelf: 'B-2' }],
    ['null for a lot number', { lotNumber: null }],
    [
      'every property',
      {
        lotNumber: 'A',
        expiryDate: null,
        location: null,
        shelf: null,
        notes: null,
      },
    ],
  ])('takes %s', (_case, request) => {
    expect(inventoryUpdateRequestSchema.parse(request)).toEqual(request)
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['nothing', {}, [':custom']],
    [
      'a property that is there without a value',
      { shelf: undefined },
      ['shelf:invalid_type'],
    ],
    ['the salon of the row', { salonId: SALON_ID }, [':unrecognized_keys']],
    [
      'the product of the row',
      { productId: PRODUCT_ID, shelf: 'S' },
      [':unrecognized_keys'],
    ],
    [
      'a figure only movements write',
      { availableStock: 1 },
      [':unrecognized_keys'],
    ],
    ['a blank shelf', { shelf: '' }, ['shelf:invalid_format']],
  ])('refuses %s', (_case, request, broken) => {
    expect(brokenBy(inventoryUpdateRequestSchema, request)).toEqual(broken)
  })
})

describe('inventorySearchRequestSchema', () => {
  it('takes no filter at all, and every filter', () => {
    const everything = {
      limit: 100,
      cursor: INVENTORY_ID,
      salonId: SALON_ID,
      productId: PRODUCT_ID,
      lotNumber: 'LOT-1',
    }

    expect(inventorySearchRequestSchema.parse({})).toEqual({})
    expect(inventorySearchRequestSchema.parse(everything)).toEqual(everything)
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a limit with a fraction', { limit: 2.5 }, ['limit:invalid_type']],
    [
      'a cursor that is not an ID',
      { cursor: 'next' },
      ['cursor:invalid_format'],
    ],
    ['an empty lot number', { lotNumber: '' }, ['lotNumber:invalid_format']],
    [
      'a lot number of 101 characters',
      { lotNumber: 'L'.repeat(101) },
      ['lotNumber:too_big'],
    ],
    [
      'a filter the list does not have',
      { expiryDate: '2027-01-01' },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, query, broken) => {
    expect(brokenBy(inventorySearchRequestSchema, query)).toEqual(broken)
  })
})

describe('inventoryLowStockSearchRequestSchema', () => {
  it.each([0, 0.01, 2.5, 99_999_999.99])(
    'takes a threshold of %d',
    (threshold) => {
      expect(
        brokenBy(inventoryLowStockSearchRequestSchema, {
          salonId: SALON_ID,
          threshold,
        }),
      ).toEqual([])
    },
  )

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no salon', {}, ['salonId:invalid_type']],
    [
      'a negative threshold',
      { salonId: SALON_ID, threshold: -0.01 },
      ['threshold:too_small'],
    ],
    [
      'a threshold no row holds',
      { salonId: SALON_ID, threshold: 100_000_000 },
      ['threshold:too_big'],
    ],
    [
      'a filter of the list',
      { salonId: SALON_ID, productId: PRODUCT_ID },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, query, broken) => {
    expect(brokenBy(inventoryLowStockSearchRequestSchema, query)).toEqual(
      broken,
    )
  })
})

describe('inventoryExpiringSearchRequestSchema', () => {
  it.each([0, 1, 30, 365])('takes %d days', (days) => {
    expect(
      brokenBy(inventoryExpiringSearchRequestSchema, {
        salonId: SALON_ID,
        days,
      }),
    ).toEqual([])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no salon', { days: 30 }, ['salonId:invalid_type']],
    ['days below 0', { salonId: SALON_ID, days: -1 }, ['days:too_small']],
    [
      'more days than a year',
      { salonId: SALON_ID, days: 366 },
      ['days:too_big'],
    ],
    [
      'days with a fraction',
      { salonId: SALON_ID, days: 0.5 },
      ['days:invalid_type'],
    ],
    [
      'a threshold',
      { salonId: SALON_ID, threshold: 1 },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, query, broken) => {
    expect(brokenBy(inventoryExpiringSearchRequestSchema, query)).toEqual(
      broken,
    )
  })
})
