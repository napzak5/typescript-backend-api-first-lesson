import { describe, expect, it } from 'vitest'
import { salon } from '../bookings/components/examples'
import {
  colourLot,
  expiredColour,
  glovesRow,
  STOCK_OF_THE_SALON,
  shampooRow,
} from '../inventory/components/examples'
import {
  afterOrderEntry,
  quantityControlOf,
  readOrderEntry,
  subtotalOf,
  taxAt,
  unitPriceControlOf,
} from './order-entry'

/** The values of a form, under the names of its controls */
const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

/** A form with a supplier and a tax, every row priced and none ordered, and what else is given */
const filled = (entries: Record<string, string>): FormData =>
  formOf({
    supplier: '東京ビューティーサプライ',
    ...Object.fromEntries(
      STOCK_OF_THE_SALON.map(({ id }) => [unitPriceControlOf(id), '800']),
    ),
    taxAmount: '0',
    shippingCost: '',
    expectedDelivery: '',
    paymentTerms: '',
    notes: '',
    ...entries,
  })

const QUANTITY_ERROR =
  '数量は、0 より大きく 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。'

describe('readOrderEntry', () => {
  it('should order the rows with a quantity, in the order of the form, with what else was written', () => {
    expect(
      readOrderEntry(
        filled({
          supplier: ' 東京ビューティーサプライ ',
          [quantityControlOf(colourLot.id)]: '１２',
          [quantityControlOf(shampooRow.id)]: '2.5',
          [unitPriceControlOf(shampooRow.id)]: '1,499',
          taxAmount: '1334',
          shippingCost: '800',
          expectedDelivery: '2026-11-27',
          paymentTerms: ' 月末締め翌月末払い ',
          notes: '  ',
        }),
        salon,
        STOCK_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        salonId: salon.id,
        supplier: '東京ビューティーサプライ',
        items: [
          {
            inventoryId: colourLot.id,
            quantity: 12,
            unitPrice: 800,
            notes: null,
          },
          {
            inventoryId: shampooRow.id,
            quantity: 2.5,
            unitPrice: 1499,
            notes: null,
          },
        ],
        taxAmount: 1334,
        shippingCost: 800,
        // The day begins at midnight in Tokyo
        expectedDelivery: '2026-11-26T15:00:00.000Z',
        paymentTerms: '月末締め翌月末払い',
        notes: null,
      },
    })
  })

  it('should say what is wrong with every field at once', () => {
    expect(
      readOrderEntry(
        filled({
          supplier: '  ',
          [quantityControlOf(expiredColour.id)]: '0',
          [quantityControlOf(colourLot.id)]: '1.234',
          [quantityControlOf(shampooRow.id)]: '3',
          [unitPriceControlOf(shampooRow.id)]: '',
          [quantityControlOf(glovesRow.id)]: '2',
          [unitPriceControlOf(glovesRow.id)]: '-1',
          taxAmount: '',
          shippingCost: '8.5',
          expectedDelivery: '2026-02-30',
        }),
        salon,
        STOCK_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        supplier: '仕入先を入力してください。',
        [quantityControlOf(expiredColour.id)]: QUANTITY_ERROR,
        [quantityControlOf(colourLot.id)]: QUANTITY_ERROR,
        [unitPriceControlOf(shampooRow.id)]:
          '単価は、0 以上の円の整数で入力してください。',
        [unitPriceControlOf(glovesRow.id)]:
          '単価は、0 以上の円の整数で入力してください。',
        taxAmount: '税額を入力してください。税がかからなければ 0 にします。',
        shippingCost: '送料は、0 以上の円の整数で入力してください。',
        expectedDelivery: '日付を入力してください。',
      },
    })
  })

  it('should say at the first row that nothing is ordered, and take a supplier of 255 letters', () => {
    expect(
      readOrderEntry(
        filled({ supplier: '仕'.repeat(255), taxAmount: 'x' }),
        salon,
        STOCK_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        [quantityControlOf(expiredColour.id)]:
          '発注する行がありません。発注する行に、数量を入力してください。',
        taxAmount: '税額は、0 以上の円の整数で入力してください。',
      },
    })
    expect(
      readOrderEntry(
        filled({ supplier: '仕'.repeat(256) }),
        salon,
        STOCK_OF_THE_SALON,
      ),
    ).toMatchObject({
      type: 'invalid',
      errors: { supplier: '仕入先は 255 文字以内で入力してください。' },
    })
  })

  it('should say at the hundred and first item that an order holds a hundred', () => {
    // Arrange
    const rows = Array.from({ length: 101 }, (_, place) => ({
      id: `row-${place}`,
    }))
    const values = formOf({
      supplier: '東京ビューティーサプライ',
      taxAmount: '0',
      ...Object.fromEntries(
        rows.flatMap(({ id }) => [
          [quantityControlOf(id), '1'],
          [unitPriceControlOf(id), '1'],
        ]),
      ),
    })

    // Act
    const read = readOrderEntry(values, salon, rows)

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        [quantityControlOf('row-100')]:
          '1 件の発注に入れられるのは 100 行までです。残りの行は、別の発注にしてください。',
      },
    })
    expect(readOrderEntry(values, salon, rows.slice(0, 100))).toMatchObject({
      type: 'valid',
    })
  })

  it('should say the largest unit price at which an item still comes to what an amount holds', () => {
    // 3 × 715,827,882 = 2,147,483,646; one yen more is too much
    expect(
      readOrderEntry(
        filled({
          [quantityControlOf(colourLot.id)]: '3',
          [unitPriceControlOf(colourLot.id)]: '715827883',
        }),
        salon,
        STOCK_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        [unitPriceControlOf(colourLot.id)]:
          'この数量では、単価は 715,827,882 円までです。明細の金額は 2,147,483,647 円までです。',
      },
    })
    expect(
      readOrderEntry(
        filled({
          [quantityControlOf(colourLot.id)]: '3',
          [unitPriceControlOf(colourLot.id)]: '715827882',
          taxAmount: '1',
        }),
        salon,
        STOCK_OF_THE_SALON,
      ),
    ).toMatchObject({ type: 'valid' })
  })

  it('should say the largest unit price where a half yen rounds up beyond what an amount holds', () => {
    // 2.5 × 858,993,458 = 2,147,483,645; 2.5 × 858,993,459 = 2,147,483,647.5, rounded up
    expect(
      readOrderEntry(
        filled({
          [quantityControlOf(colourLot.id)]: '2.5',
          [unitPriceControlOf(colourLot.id)]: '858993459',
        }),
        salon,
        STOCK_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        [unitPriceControlOf(colourLot.id)]:
          'この数量では、単価は 858,993,458 円までです。明細の金額は 2,147,483,647 円までです。',
      },
    })
  })

  it('should say that an order whose total is more than an amount holds is to be split', () => {
    expect(
      readOrderEntry(
        filled({
          [quantityControlOf(colourLot.id)]: '3',
          [unitPriceControlOf(colourLot.id)]: '715827882',
          taxAmount: '1',
          shippingCost: '1',
        }),
        salon,
        STOCK_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'tooMuch',
      message:
        '合計が 2,147,483,647 円を超えます。明細を分けて、発注を 2 件以上にしてください。',
    })
  })
})

describe('subtotalOf and taxAt', () => {
  it('should add up what the items come to, each rounded half up to the yen, leaving out a row that is wrong', () => {
    const values = filled({
      [quantityControlOf(colourLot.id)]: '12',
      [quantityControlOf(shampooRow.id)]: '2.5',
      [unitPriceControlOf(shampooRow.id)]: '1499',
      [quantityControlOf(glovesRow.id)]: 'x',
    })

    expect(subtotalOf(values, STOCK_OF_THE_SALON)).toBe(13348)
  })

  it('should take the tax at the rate of the salon, rounded down to the yen', () => {
    expect(taxAt(13348, 10)).toBe(1334)
    expect(taxAt(13348, 8)).toBe(1067)
    expect(taxAt(0, 10)).toBe(0)
  })
})

describe('afterOrderEntry', () => {
  const REQUEST = {
    items: [
      { inventoryId: colourLot.id, quantity: 3, unitPrice: 800, notes: null },
      { inventoryId: shampooRow.id, quantity: 1, unitPrice: 9, notes: null },
    ],
  }

  it('should say a refused quantity or price under the control of its row, and a field of the order under its own', () => {
    expect(
      afterOrderEntry(
        {
          type: 'invalid',
          values: [
            { field: 'items.1.unitPrice', rule: 'too_big' },
            { field: 'items.0.quantity', rule: 'not_multiple_of' },
            { field: 'expectedDelivery', rule: 'invalid_format' },
          ],
        },
        REQUEST,
      ),
    ).toEqual({
      message: undefined,
      errors: {
        [unitPriceControlOf(shampooRow.id)]:
          '単価は、0 以上の円の整数で入力してください。',
        [quantityControlOf(colourLot.id)]: QUANTITY_ERROR,
        expectedDelivery: '日付を入力してください。',
      },
    })
  })

  it('should say that the total is too much, and to check a value the form has no control for', () => {
    expect(
      afterOrderEntry(
        { type: 'invalid', values: [{ field: 'items', rule: 'custom' }] },
        REQUEST,
      ).message,
    ).toBe(
      '合計が 2,147,483,647 円を超えます。明細を分けて、発注を 2 件以上にしてください。',
    )
    expect(
      afterOrderEntry(
        {
          type: 'invalid',
          values: [{ field: 'items.0.notes', rule: 'invalid_format' }],
        },
        REQUEST,
      ),
    ).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<[string, Parameters<typeof afterOrderEntry>[0], string]>([
    [
      'a row removed meanwhile',
      { type: 'rowsChanged' },
      '発注する在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数量を確かめて、もう一度作ってください。',
    ],
    [
      'the account',
      { type: 'forbidden' },
      'このアカウントでは、このサロンの発注を作れません。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'no answer',
      { type: 'failed' },
      '発注を作れませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form what came of %s', (_, outcome, message) => {
    expect(afterOrderEntry(outcome, REQUEST)).toEqual({ message, errors: {} })
  })
})
