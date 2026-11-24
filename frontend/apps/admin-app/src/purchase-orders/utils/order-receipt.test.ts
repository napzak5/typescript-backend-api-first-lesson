import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { colourLot, shampooRow } from '../../inventory/components/examples'
import { shippedOrder } from '../components/examples'
import {
  afterOrderReceipt,
  orderedTextOf,
  readOrderReceipt,
  receivableItemsOf,
  receivedControlOf,
  UNRECEIVABLE,
} from './order-receipt'

const COLOUR = receivedControlOf(colourLot.id)
const SHAMPOO = receivedControlOf(shampooRow.id)

/** The form as it opens on the shipped order of the stories: all that was ordered, and its notes */
const AS_OPENED = {
  [COLOUR]: '12',
  [SHAMPOO]: '2.5',
  deliveryNotes: '午前中に、裏口へ',
}

/** A text in every language */
type Said = { en: string; ja: string }

/** What is said of a quantity received that is none, or more than was ordered: 「12 本」 */
const quantityError = (ordered: string): Said => ({
  en: `Enter the quantity received as a number above 0 and up to the ${ordered} ordered (up to 2 decimal places).`,
  ja: `届いた数量は、0 より大きく、発注した ${ordered} までの数（小数は 2 桁まで）で入力してください。`,
})

/** Why the goods of an order of a status before it was placed are not received now */
const notPlaced = (status: Said): Said => ({
  en: `This order is “${status.en}”. A receipt is recorded for an order placed with the supplier (“Ordered” or “Shipped”).`,
  ja: `この発注は${status.ja}です。入荷は、仕入先に頼んだ発注（発注済みか出荷済み）に記録します。`,
})

describe('receivableItemsOf', () => {
  it('should leave out the items whose stock rows were removed', () => {
    // Assert
    expect(
      receivableItemsOf(shippedOrder.items).map(
        ({ inventoryId, productCode }) => [inventoryId, productCode],
      ),
    ).toEqual([
      [colourLot.id, 'COLOR001'],
      [shampooRow.id, 'SHMP001'],
    ])
  })
})

describe('orderedTextOf', () => {
  it('should start an item with all that was ordered', () => {
    // Assert
    expect(orderedTextOf({ quantity: 12 })).toBe('12')
    expect(orderedTextOf({ quantity: 2.5 })).toBe('2.5')
  })
})

describe('readOrderReceipt', () => {
  it('should receive all that was ordered, and keep the notes left as they were', () => {
    // Assert
    expect(readOrderReceipt(formOf(AS_OPENED), shippedOrder)).toEqual({
      type: 'valid',
      value: {
        items: [
          { inventoryId: colourLot.id, quantity: 12 },
          { inventoryId: shampooRow.id, quantity: 2.5 },
        ],
        deliveryNotes: null,
      },
    })
  })

  it('should receive what came of some items, and leave out those made empty', () => {
    // Assert
    expect(
      readOrderReceipt(
        formOf({
          ...AS_OPENED,
          [COLOUR]: '１０',
          [SHAMPOO]: ' ',
          deliveryNotes: ' 2 本は後日 ',
        }),
        shippedOrder,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        items: [{ inventoryId: colourLot.id, quantity: 10 }],
        deliveryNotes: '2 本は後日',
      },
    })
  })

  it('should send the notes written on an order that had none', () => {
    // Assert
    expect(
      readOrderReceipt(
        formOf({ ...AS_OPENED, deliveryNotes: '箱がつぶれていた' }),
        {
          ...shippedOrder,
          deliveryNotes: null,
        },
      ),
    ).toEqual({
      type: 'valid',
      value: {
        items: [
          { inventoryId: colourLot.id, quantity: 12 },
          { inventoryId: shampooRow.id, quantity: 2.5 },
        ],
        deliveryNotes: '箱がつぶれていた',
      },
    })
  })

  it.each<[string, string, Said]>([
    ['more than was ordered', '12.01', quantityError('12 本')],
    ['none', '0', quantityError('12 本')],
    ['three decimals', '1.005', quantityError('12 本')],
    ['no number', '十', quantityError('12 本')],
  ])('should not receive %s', (_case, quantity, error) => {
    // Assert
    expect(
      readOrderReceipt(
        formOf({ ...AS_OPENED, [COLOUR]: quantity }),
        shippedOrder,
      ),
    ).toEqual({ type: 'invalid', errors: { [COLOUR]: error } })
  })

  it('should not send a receipt of nothing', () => {
    // Assert
    expect(
      readOrderReceipt(
        formOf({ ...AS_OPENED, [COLOUR]: '', [SHAMPOO]: '' }),
        shippedOrder,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        [COLOUR]: {
          en: 'No line item is received. Enter a quantity in the line items that arrived.',
          ja: '入荷する明細がありません。届いた明細に、数量を入力してください。',
        },
      },
    })
  })

  it('should not take the notes of the delivery away, which the API keeps for nothing', () => {
    // Assert
    expect(
      readOrderReceipt(
        formOf({ ...AS_OPENED, deliveryNotes: ' ' }),
        shippedOrder,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        deliveryNotes: {
          en: 'The delivery notes cannot be cleared when the receipt is recorded. Keep them, or write others.',
          ja: 'いまの納品のメモは、入荷では消せません。そのまま残すか、書き換えてください。',
        },
      },
    })
  })

  it('should say every wrong quantity at once', () => {
    // Assert
    expect(
      readOrderReceipt(
        formOf({ ...AS_OPENED, [COLOUR]: '13', [SHAMPOO]: '2.51' }),
        shippedOrder,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        [COLOUR]: quantityError('12 本'),
        [SHAMPOO]: quantityError('2.5 本'),
      },
    })
  })
})

describe('UNRECEIVABLE', () => {
  it('should say why the goods of an order are not received now', () => {
    // Assert
    expect(UNRECEIVABLE).toEqual({
      draft: notPlaced({ en: 'Draft', ja: '下書き' }),
      pending: notPlaced({ en: 'Awaiting approval', ja: '承認待ち' }),
      approved: notPlaced({ en: 'Approved', ja: '承認済み' }),
      delivered: {
        en: 'This order was delivered. Its receipt is recorded.',
        ja: 'この発注は納品済みです。入荷は、記録してあります。',
      },
      cancelled: {
        en: 'This order was cancelled. No receipt is recorded for a cancelled order.',
        ja: 'この発注は取り消しました。取り消した発注は、入荷できません。',
      },
    })
  })
})

describe('afterOrderReceipt', () => {
  it.each<[string, Parameters<typeof afterOrderReceipt>[0], Said]>([
    [
      'values the API refused',
      { type: 'invalid', values: [] },
      {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
    ],
    [
      'a row removed meanwhile',
      { type: 'rowsChanged' },
      {
        en: 'One of the stock rows of the line items was removed meanwhile. The order was loaded again. Check the quantities received and record them again.',
        ja: '明細の在庫の行のどれかが、その間に削除されました。発注を読み直しました。届いた数量を確かめて、もう一度記録してください。',
      },
    ],
    [
      'an order changed meanwhile, or a stock too large',
      { type: 'conflict' },
      {
        en: 'Could not record the receipt. The order changed meanwhile, or the stock of a row would go above 99,999,999.99. The order was loaded again.',
        ja: '入荷を記録できませんでした。発注がその間に変わったか、入荷すると在庫数が 99,999,999.99 を超える行があります。発注を読み直しました。',
      },
    ],
    [
      'the account',
      { type: 'forbidden' },
      {
        en: 'This account cannot record the receipt of this order.',
        ja: 'このアカウントでは、この発注の入荷を記録できません。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'a failure',
      { type: 'failed' },
      {
        en: 'Could not record the receipt. Check your connection and try again.',
        ja: '入荷を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say above the form what came of %s', (_case, outcome, message) => {
    expect(afterOrderReceipt(outcome)).toEqual({ message, errors: {} })
  })
})
