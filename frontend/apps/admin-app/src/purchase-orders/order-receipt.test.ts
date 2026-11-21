import { describe, expect, it } from 'vitest'
import { colourLot, shampooRow } from '../inventory/components/examples'
import { shippedOrder } from './components/examples'
import {
  afterOrderReceipt,
  orderedTextOf,
  readOrderReceipt,
  receivableItemsOf,
  receivedControlOf,
  UNRECEIVABLE,
} from './order-receipt'

/** The values of a form, under the names of its controls */
const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

const COLOUR = receivedControlOf(colourLot.id)
const SHAMPOO = receivedControlOf(shampooRow.id)

/** The form as it opens on the shipped order of the stories: all that was ordered, and its notes */
const AS_OPENED = {
  [COLOUR]: '12',
  [SHAMPOO]: '2.5',
  deliveryNotes: '午前中に、裏口へ',
}

const quantityError = (ordered: string): string =>
  `届いた数量は、0 より大きく、発注した ${ordered} までの数（小数は 2 桁まで）で入力してください。`

describe('receivableItemsOf', () => {
  it('should leave out the items whose stock rows were removed', () => {
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
    expect(orderedTextOf({ quantity: 12 })).toBe('12')
    expect(orderedTextOf({ quantity: 2.5 })).toBe('2.5')
  })
})

describe('readOrderReceipt', () => {
  it('should receive all that was ordered, and keep the notes left as they were', () => {
    expect(readOrderReceipt(formOf(AS_OPENED), shippedOrder)).toEqual({
      type: 'valid',
      request: {
        items: [
          { inventoryId: colourLot.id, quantity: 12 },
          { inventoryId: shampooRow.id, quantity: 2.5 },
        ],
        deliveryNotes: null,
      },
    })
  })

  it('should receive what came of some items, and leave out those made empty', () => {
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
      request: {
        items: [{ inventoryId: colourLot.id, quantity: 10 }],
        deliveryNotes: '2 本は後日',
      },
    })
  })

  it('should send the notes written on an order that had none', () => {
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
      request: {
        items: [
          { inventoryId: colourLot.id, quantity: 12 },
          { inventoryId: shampooRow.id, quantity: 2.5 },
        ],
        deliveryNotes: '箱がつぶれていた',
      },
    })
  })

  it.each<[string, string, string]>([
    ['more than was ordered', '12.01', quantityError('12 本')],
    ['none', '0', quantityError('12 本')],
    ['three decimals', '1.005', quantityError('12 本')],
    ['no number', '十', quantityError('12 本')],
  ])('should not receive %s', (_case, quantity, error) => {
    expect(
      readOrderReceipt(
        formOf({ ...AS_OPENED, [COLOUR]: quantity }),
        shippedOrder,
      ),
    ).toEqual({ type: 'invalid', errors: { [COLOUR]: error } })
  })

  it('should not send a receipt of nothing', () => {
    expect(
      readOrderReceipt(
        formOf({ ...AS_OPENED, [COLOUR]: '', [SHAMPOO]: '' }),
        shippedOrder,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        [COLOUR]:
          '入荷する明細がありません。届いた明細に、数量を入力してください。',
      },
    })
  })

  it('should not take the notes of the delivery away, which the API keeps for nothing', () => {
    expect(
      readOrderReceipt(
        formOf({ ...AS_OPENED, deliveryNotes: ' ' }),
        shippedOrder,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        deliveryNotes:
          'いまの納品のメモは、入荷では消せません。そのまま残すか、書き換えてください。',
      },
    })
  })

  it('should say every wrong quantity at once', () => {
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
    expect(UNRECEIVABLE).toEqual({
      draft:
        'この発注は下書きです。入荷は、仕入先に頼んだ発注（発注済みか出荷済み）に記録します。',
      pending:
        'この発注は承認待ちです。入荷は、仕入先に頼んだ発注（発注済みか出荷済み）に記録します。',
      approved:
        'この発注は承認済みです。入荷は、仕入先に頼んだ発注（発注済みか出荷済み）に記録します。',
      delivered: 'この発注は納品済みです。入荷は、記録してあります。',
      cancelled: 'この発注は取り消しました。取り消した発注は、入荷できません。',
    })
  })
})

describe('afterOrderReceipt', () => {
  it.each<[string, Parameters<typeof afterOrderReceipt>[0], string]>([
    [
      'values the API refused',
      { type: 'invalid', values: [] },
      '入力した内容を確かめて、もう一度お試しください。',
    ],
    [
      'a row removed meanwhile',
      { type: 'rowsChanged' },
      '明細の在庫の行のどれかが、その間に削除されました。発注を読み直しました。届いた数量を確かめて、もう一度記録してください。',
    ],
    [
      'an order changed meanwhile, or a stock too large',
      { type: 'conflict' },
      '入荷を記録できませんでした。発注がその間に変わったか、入荷すると在庫数が 99,999,999.99 を超える行があります。発注を読み直しました。',
    ],
    [
      'the account',
      { type: 'forbidden' },
      'このアカウントでは、この発注の入荷を記録できません。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'a failure',
      { type: 'failed' },
      '入荷を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form what came of %s', (_case, outcome, message) => {
    expect(afterOrderReceipt(outcome)).toEqual({ message, errors: {} })
  })
})
