import { describe, expect, it } from 'vitest'
import { salon } from '../../bookings/components/examples'
import { PRODUCTS_OF_THE_SALON } from '../../products/components/examples'
import type { StockCount } from '../api/count-api'
import {
  colourLot,
  expiredColour,
  glovesRow,
  STOCK_OF_THE_SALON,
  shampooRow,
} from '../components/examples'
import {
  afterStockCount,
  countedControlOf,
  readStockCount,
} from './stock-count'

/** A refusal of a count that is said above the form */
type Refusal = Exclude<StockCount, { type: 'counted' | 'invalid' }>

/** The form of a count, as a browser sends it: every row, the counts given filled in */
const countForm = (counted: Record<string, string>, reason = ''): FormData => {
  const values = new FormData()
  for (const { id } of STOCK_OF_THE_SALON) {
    values.append(countedControlOf(id), counted[id] ?? '')
  }
  values.append('reason', reason)

  return values
}

const read = (values: FormData) =>
  readStockCount(values, salon.id, STOCK_OF_THE_SALON, PRODUCTS_OF_THE_SALON)

const COUNT_ERROR =
  '数えた数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。'

describe('countedControlOf', () => {
  it('should name the control of a row by its ID', () => {
    expect(countedControlOf(colourLot.id)).toBe(`counted.${colourLot.id}`)
  })
})

describe('readStockCount', () => {
  it('should count the rows that were filled in, in the order of the form, and leave the others', () => {
    // Act
    const count = read(
      countForm(
        {
          [shampooRow.id]: '９',
          [expiredColour.id]: '2.5',
          [glovesRow.id]: '0',
        },
        '  月末の棚卸し  ',
      ),
    )

    // Assert
    expect(count).toEqual({
      type: 'valid',
      value: {
        salonId: salon.id,
        items: [
          { inventoryId: expiredColour.id, countedQuantity: 2.5 },
          { inventoryId: shampooRow.id, countedQuantity: 9 },
          { inventoryId: glovesRow.id, countedQuantity: 0 },
        ],
        reason: '月末の棚卸し',
      },
    })
  })

  it('should send no reason when none was written', () => {
    // Act
    const count = read(countForm({ [colourLot.id]: '1,200.25' }, '   '))

    // Assert
    expect(count).toEqual({
      type: 'valid',
      value: {
        salonId: salon.id,
        items: [{ inventoryId: colourLot.id, countedQuantity: 1200.25 }],
        reason: null,
      },
    })
  })

  it('should take a count of exactly what is reserved', () => {
    // Act
    const count = read(countForm({ [shampooRow.id]: '2' }))

    // Assert
    expect(count).toMatchObject({
      type: 'valid',
      value: { items: [{ inventoryId: shampooRow.id, countedQuantity: 2 }] },
    })
  })

  it('should say that nothing was counted under the first row', () => {
    // Act
    const count = read(countForm({}))

    // Assert
    expect(count).toEqual({
      type: 'invalid',
      errors: {
        [countedControlOf(expiredColour.id)]:
          '数えた行がありません。数えた行に、数えた数を入力してください。',
      },
    })
  })

  it.each<[string, string]>([
    ['a negative number', '-1'],
    ['three decimals', '1.005'],
    ['more than 99,999,999.99', '100000000'],
    ['no number', '十'],
  ])('should refuse %s under its row', (_, given) => {
    // Act
    const count = read(
      countForm({ [colourLot.id]: given, [glovesRow.id]: '1' }),
    )

    // Assert
    expect(count).toEqual({
      type: 'invalid',
      errors: { [countedControlOf(colourLot.id)]: COUNT_ERROR },
    })
  })

  it('should refuse a count below what is reserved, naming what is', () => {
    // Act
    const count = read(
      countForm({ [shampooRow.id]: '1.99', [expiredColour.id]: 'x' }),
    )

    // Assert
    expect(count).toEqual({
      type: 'invalid',
      errors: {
        [countedControlOf(expiredColour.id)]: COUNT_ERROR,
        [countedControlOf(shampooRow.id)]:
          '引き当てた数の 2 本 を下回ります。引き当てた在庫も、数えた数に入れてください。',
      },
    })
  })

  it('should refuse more than 500 rows in one count, under the first beyond', () => {
    // Arrange
    const rows = Array.from({ length: 501 }, (_, index) => ({
      ...glovesRow,
      id: `row-${index}`,
    }))
    const values = new FormData()
    for (const { id } of rows) {
      values.append(countedControlOf(id), '1')
    }

    // Act
    const count = readStockCount(values, salon.id, rows, PRODUCTS_OF_THE_SALON)

    // Assert
    expect(count).toEqual({
      type: 'invalid',
      errors: {
        [countedControlOf('row-500')]:
          '一度に記録できるのは 500 行までです。残りの行は、記録したあとに、もう一度棚卸しをして記録してください。',
      },
    })
  })

  it('should take 500 rows in one count', () => {
    // Arrange
    const rows = Array.from({ length: 500 }, (_, index) => ({
      ...glovesRow,
      id: `row-${index}`,
    }))
    const values = new FormData()
    for (const { id } of rows) {
      values.append(countedControlOf(id), '1')
    }

    // Act
    const count = readStockCount(values, salon.id, rows, PRODUCTS_OF_THE_SALON)

    // Assert
    expect(count).toMatchObject({ type: 'valid' })
  })
})

describe('afterStockCount', () => {
  const sent = {
    items: [
      { inventoryId: expiredColour.id, countedQuantity: 2 },
      { inventoryId: shampooRow.id, countedQuantity: 9 },
    ],
  }

  it('should say a count the API refused under its row, by its place in the request', () => {
    // Act
    const said = afterStockCount(
      {
        type: 'invalid',
        values: [
          {
            field: 'items.1.countedQuantity',
            rule: 'too_big',
          },
        ],
      },
      sent,
    )

    // Assert
    expect(said).toEqual({
      message: undefined,
      errors: { [countedControlOf(shampooRow.id)]: COUNT_ERROR },
    })
  })

  it('should say above the form what the API refused of no row', () => {
    // Act
    const said = afterStockCount(
      { type: 'invalid', values: [{ field: 'reason', rule: 'too_big' }] },
      sent,
    )

    // Assert
    expect(said).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<[string, Refusal, string]>([
    [
      'rows removed meanwhile',
      { type: 'rowsChanged' },
      '数えた在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
    ],
    [
      'stock reserved meanwhile',
      { type: 'belowReserved' },
      '数えた数が、引き当てた数を下回る行があります。その間に在庫が引き当てられました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      'このアカウントでは、棚卸しを記録できません。棚卸しを記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'no answer',
      { type: 'failed' },
      '棚卸しを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form after %s', (_, refusal, message) => {
    // Act
    const said = afterStockCount(refusal, sent)

    // Assert
    expect(said).toEqual({ message, errors: {} })
  })
})
