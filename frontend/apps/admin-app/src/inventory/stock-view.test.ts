import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { colour } from '../products/components/examples'
import {
  isNarrowed,
  readExpiryWindow,
  readStockConditions,
  type StockView,
  stockQueryOf,
  stockViewIn,
} from './stock-view'

describe('stockViewIn', () => {
  it.each<[string, string, StockView]>([
    ['no query', '', { type: 'all' }],
    [
      'a product and a lot',
      `product=${colour.id}&lot=LOT-1`,
      { type: 'all', productId: colour.id, lotNumber: 'LOT-1' },
    ],
    [
      'a product written in capitals',
      `product=${colour.id.toUpperCase()}`,
      { type: 'all', productId: colour.id },
    ],
    ['a product that is no ID', 'product=COLOR001', { type: 'all' }],
    ['a lot of spaces only', 'lot=%20%20', { type: 'all' }],
    ['a lot that is too long', `lot=${'L'.repeat(101)}`, { type: 'all' }],
    ['the low stock', 'view=low-stock&lot=LOT-1', { type: 'lowStock' }],
    ['the expiring rows', 'view=expiring', { type: 'expiring', days: 30 }],
    [
      'the expiring rows of a window offered',
      'view=expiring&days=90',
      { type: 'expiring', days: 90 },
    ],
    [
      'the expiring rows of a window not offered',
      'view=expiring&days=45',
      { type: 'expiring', days: 30 },
    ],
    ['a view that does not exist', 'view=reserved', { type: 'all' }],
  ])('should read %s', (_, query, view) => {
    expect(stockViewIn(new URLSearchParams(query))).toEqual(view)
  })
})

describe('stockQueryOf', () => {
  it.each<[StockView, string]>([
    [{ type: 'all' }, ''],
    [
      { type: 'all', productId: colour.id, lotNumber: 'LOT 1' },
      `product=${colour.id}&lot=LOT+1`,
    ],
    [{ type: 'lowStock' }, 'view=low-stock'],
    [{ type: 'expiring', days: 30 }, 'view=expiring'],
    [{ type: 'expiring', days: 0 }, 'view=expiring&days=0'],
  ])('should keep %o as %s, and read it back', (view, query) => {
    expect(stockQueryOf(view).toString()).toBe(query)
    expect(stockViewIn(stockQueryOf(view))).toEqual(view)
  })
})

describe('isNarrowed', () => {
  it.each<[StockView, boolean]>([
    [{ type: 'all' }, false],
    [{ type: 'all', lotNumber: 'LOT-1' }, true],
    [{ type: 'all', productId: colour.id }, true],
    [{ type: 'lowStock' }, false],
    [{ type: 'expiring', days: 7 }, false],
  ])('should tell whether %o is narrowed: %s', (view, narrowed) => {
    expect(isNarrowed(view)).toBe(narrowed)
  })
})

describe('readStockConditions', () => {
  it('should read the product and the lot, without the spaces around the lot', () => {
    expect(
      readStockConditions(
        formOfEntries([
          ['productId', colour.id],
          ['lotNumber', ' LOT-1 '],
        ]),
      ),
    ).toEqual({
      type: 'valid',
      value: { type: 'all', productId: colour.id, lotNumber: 'LOT-1' },
    })
  })

  it('should read empty conditions as every row', () => {
    expect(
      readStockConditions(
        formOfEntries([
          ['productId', ''],
          ['lotNumber', '  '],
        ]),
      ),
    ).toEqual({ type: 'valid', value: { type: 'all' } })
  })

  it('should say that a lot is too long', () => {
    expect(
      readStockConditions(formOfEntries([['lotNumber', 'L'.repeat(101)]])),
    ).toEqual({
      type: 'invalid',
      errors: { lotNumber: 'ロット番号は、100 文字以内で入力してください。' },
    })
  })
})

describe('readExpiryWindow', () => {
  it.each<[string, number]>([
    ['0', 0],
    ['7', 7],
    ['90', 90],
    ['45', 30],
  ])('should read the window %s as %i days', (days, window) => {
    expect(readExpiryWindow(formOfEntries([['days', days]]))).toEqual({
      type: 'expiring',
      days: window,
    })
  })
})
