import { describe, expect, it } from 'vitest'
import { card, cash, eMoney, transfer } from '../components/examples'
import {
  amountsNameOf,
  feeNameOf,
  KIND_CHOICES,
  nextSortOrderOf,
  placesNameOf,
  usedNameOf,
} from './payment-method-format'

describe('KIND_CHOICES', () => {
  it('should offer every kind of payment in the words of the sales', () => {
    // Assert
    expect(KIND_CHOICES.map(({ value, label }) => [value, label])).toEqual([
      ['cash', { en: 'Cash', ja: '現金' }],
      ['credit_card', { en: 'Credit card', ja: 'クレジットカード' }],
      ['debit_card', { en: 'Debit card', ja: 'デビットカード' }],
      ['e_money', { en: 'E-money', ja: '電子マネー' }],
      ['qr_payment', { en: 'QR code payment', ja: 'QR コード決済' }],
      ['bank_transfer', { en: 'Bank transfer', ja: '銀行振込' }],
      ['point', { en: 'Points', ja: 'ポイント' }],
    ])
  })
})

describe('feeNameOf', () => {
  it.each<[number | null, { en: string; ja: string } | null]>([
    [null, null],
    [0, { en: 'No fee', ja: '手数料なし' }],
    [3.24, { en: '3.24%', ja: '3.24%' }],
    [100, { en: '100%', ja: '100%' }],
  ])('should name a fee of %s as %o', (fee, name) => {
    // Assert
    expect(feeNameOf(fee)).toEqual(name)
  })
})

describe('amountsNameOf', () => {
  it.each<
    [string, Parameters<typeof amountsNameOf>[0], { en: string; ja: string }]
  >([
    ['no limit', cash(), { en: 'No limits', ja: '下限も上限もなし' }],
    ['a smallest amount', card(), { en: '¥1,000 or more', ja: '￥1,000から' }],
    ['a largest amount', eMoney(), { en: 'Up to ¥20,000', ja: '￥20,000まで' }],
    [
      'both',
      transfer(),
      { en: '¥10,000 to ¥500,000', ja: '￥10,000から￥500,000まで' },
    ],
  ])('should name a method with %s as the sales do', (_, method, name) => {
    // Assert
    expect(amountsNameOf(method, 'JPY')).toEqual(name)
  })
})

describe('placesNameOf', () => {
  it.each<[boolean, boolean, { en: string; ja: string }]>([
    [true, false, { en: 'In store', ja: '店頭' }],
    [false, true, { en: 'Online', ja: 'オンライン' }],
    [true, true, { en: 'In store, Online', ja: '店頭、オンライン' }],
    [false, false, { en: 'Neither', ja: 'どちらでも使わない' }],
  ])(
    'should name a method used at the counter (%s) and online (%s) as %o',
    (isOfflineEnabled, isOnlineEnabled, name) => {
      // Assert
      expect(placesNameOf({ isOfflineEnabled, isOnlineEnabled })).toEqual(name)
    },
  )
})

describe('usedNameOf', () => {
  it.each<[boolean, { en: string; ja: string }]>([
    [true, { en: 'In use', ja: '使っている' }],
    [false, { en: 'Not in use', ja: '使っていない' }],
  ])('should name a method that is used (%s) as %o', (isActive, name) => {
    // Assert
    expect(usedNameOf(isActive)).toEqual(name)
  })
})

describe('nextSortOrderOf', () => {
  it.each<[string, number[], number]>([
    ['no method', [], 1],
    ['methods in order', [1, 2, 3], 4],
    ['methods out of order', [7, 2, 5], 8],
    ['methods at the start', [0, 0], 1],
  ])('should place a new method after %s', (_, orders, next) => {
    // Assert
    expect(nextSortOrderOf(orders.map((sortOrder) => ({ sortOrder })))).toBe(
      next,
    )
  })
})
