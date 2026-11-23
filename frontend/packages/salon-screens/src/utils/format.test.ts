import { describe, expect, it } from 'vitest'
import { amountOf, categoryNameOf, methodKindNameOf } from './format'

describe('amountOf', () => {
  it('should write an amount in the currency of the salon', () => {
    expect(amountOf(5500, 'JPY')).toEqual({ en: '¥5,500', ja: '￥5,500' })
  })
})

describe('methodKindNameOf and categoryNameOf', () => {
  it('should name a kind of payment and a kind of service in the words of the salon', () => {
    // Act, Assert
    expect(methodKindNameOf('qr_payment')).toEqual({
      en: 'QR code payment',
      ja: 'QR コード決済',
    })
    expect(categoryNameOf('treatment')).toEqual({
      en: 'Treatment',
      ja: 'トリートメント',
    })
  })
})
