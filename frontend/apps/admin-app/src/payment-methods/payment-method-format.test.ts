import { describe, expect, it } from 'vitest'
import { card, cash, eMoney, transfer } from './components/examples'
import {
  amountsNameOf,
  feeNameOf,
  KIND_OPTIONS,
  nextSortOrderOf,
  placesNameOf,
  usedNameOf,
} from './payment-method-format'

describe('KIND_OPTIONS', () => {
  it('should offer every kind of payment in the words of the sales', () => {
    expect(KIND_OPTIONS).toEqual([
      { value: 'cash', label: '現金' },
      { value: 'credit_card', label: 'クレジットカード' },
      { value: 'debit_card', label: 'デビットカード' },
      { value: 'e_money', label: '電子マネー' },
      { value: 'qr_payment', label: 'QR コード決済' },
      { value: 'bank_transfer', label: '銀行振込' },
      { value: 'point', label: 'ポイント' },
    ])
  })
})

describe('feeNameOf', () => {
  it.each<[number | null, string | null]>([
    [null, null],
    [0, '手数料なし'],
    [3.24, '3.24%'],
    [100, '100%'],
  ])('should name a fee of %s as %s', (fee, name) => {
    expect(feeNameOf(fee)).toBe(name)
  })
})

describe('amountsNameOf', () => {
  it.each<[string, Parameters<typeof amountsNameOf>[0], string]>([
    ['no limit', cash(), '下限も上限もなし'],
    ['a smallest amount', card(), '￥1,000から'],
    ['a largest amount', eMoney(), '￥20,000まで'],
    ['both', transfer(), '￥10,000から￥500,000まで'],
  ])('should name a method with %s', (_, method, name) => {
    expect(amountsNameOf(method, 'JPY')).toBe(name)
  })
})

describe('placesNameOf', () => {
  it.each<[boolean, boolean, string]>([
    [true, false, '店頭'],
    [false, true, 'オンライン'],
    [true, true, '店頭、オンライン'],
    [false, false, 'どちらでも使わない'],
  ])(
    'should name a method used at the counter (%s) and online (%s) as %s',
    (isOfflineEnabled, isOnlineEnabled, name) => {
      expect(placesNameOf({ isOfflineEnabled, isOnlineEnabled })).toBe(name)
    },
  )
})

describe('usedNameOf', () => {
  it.each<[boolean, string]>([
    [true, '使っている'],
    [false, '使っていない'],
  ])('should name a method that is used (%s) as %s', (isActive, name) => {
    expect(usedNameOf(isActive)).toBe(name)
  })
})

describe('nextSortOrderOf', () => {
  it.each<[string, number[], number]>([
    ['no method', [], 1],
    ['methods in order', [1, 2, 3], 4],
    ['methods out of order', [7, 2, 5], 8],
    ['methods at the start', [0, 0], 1],
  ])('should place a new method after %s', (_, orders, next) => {
    expect(nextSortOrderOf(orders.map((sortOrder) => ({ sortOrder })))).toBe(
      next,
    )
  })
})
