import { describe, expect, it } from 'vitest'
import {
  colour,
  gloves,
  PRODUCTS_OF_THE_SALON,
  shampoo,
} from '../products/components/examples'
import { colourLot, shampooRow } from './components/examples'
import {
  afterStockRemoval,
  afterStockWrite,
  productsChanged,
  readStockChange,
  readStockEntry,
  showsLot,
} from './stock-form'

const SALON_ID = '3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60'

const formOf = (entries: [string, string][]): FormData => {
  const values = new FormData()
  for (const [name, value] of entries) {
    values.append(name, value)
  }

  return values
}

/** The values of a form of a row, as it was opened with the row, then changed */
const rowForm = (
  row: typeof colourLot,
  changed: Record<string, string>,
): FormData =>
  formOf(
    Object.entries({
      ...(row.lotNumber === null ? {} : { lotNumber: row.lotNumber }),
      expiryDate: row.expiryDate ?? '',
      location: row.location ?? '',
      shelf: row.shelf ?? '',
      notes: row.notes ?? '',
      ...changed,
    }),
  )

const LOT_ERROR =
  'ロット番号を、100 文字までで入力してください。この商品は、在庫をロット番号で分けます。'

describe('showsLot', () => {
  it.each<[string, string | null, boolean | undefined, boolean]>([
    ['a new row of a product kept by lots', null, true, true],
    ['a new row of a product without lots', null, false, false],
    ['a new row with no product chosen', null, undefined, false],
    ['a row with a lot of a product kept by lots', 'LOT-1', true, true],
    [
      'a row with a lot of a product no longer kept by lots',
      'LOT-1',
      false,
      true,
    ],
    ['a row without a lot of a product without lots', null, false, false],
  ])(
    'should tell whether the form of %s shows the lot',
    (_, lot, tracked, shows) => {
      expect(
        showsLot(
          lot === null ? null : { lotNumber: lot },
          tracked === undefined ? undefined : { requiresLotTracking: tracked },
        ),
      ).toBe(shows)
    },
  )
})

describe('readStockEntry', () => {
  it('should read a row of a product kept by lots, with its lot', () => {
    expect(
      readStockEntry(
        formOf([
          ['productId', colour.id],
          ['lotNumber', ' LOT-2026-050 '],
          ['expiryDate', '2027-06-30'],
          ['location', ' バックヤード '],
          ['shelf', 'B-3'],
          ['notes', ''],
        ]),
        SALON_ID,
        PRODUCTS_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        salonId: SALON_ID,
        productId: colour.id,
        lotNumber: 'LOT-2026-050',
        expiryDate: '2027-06-30',
        location: 'バックヤード',
        shelf: 'B-3',
        notes: null,
      },
    })
  })

  it('should read a row of a product without lots with no lot, whatever was left in the form', () => {
    expect(
      readStockEntry(
        formOf([
          ['productId', gloves.id],
          ['lotNumber', 'LOT-1'],
          ['expiryDate', ''],
        ]),
        SALON_ID,
        PRODUCTS_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        salonId: SALON_ID,
        productId: gloves.id,
        lotNumber: null,
        expiryDate: null,
        location: null,
        shelf: null,
        notes: null,
      },
    })
  })

  it('should ask for a product and for the lot of a product kept by lots', () => {
    expect(
      readStockEntry(
        formOf([['productId', '']]),
        SALON_ID,
        PRODUCTS_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'invalid',
      errors: { productId: '商品を選んでください。' },
    })
    expect(
      readStockEntry(
        formOf([
          ['productId', colour.id],
          ['lotNumber', '  '],
        ]),
        SALON_ID,
        PRODUCTS_OF_THE_SALON,
      ),
    ).toEqual({ type: 'invalid', errors: { lotNumber: LOT_ERROR } })
  })

  it('should say what is wrong with each value, by the limits of the API', () => {
    expect(
      readStockEntry(
        formOf([
          ['productId', colour.id],
          ['lotNumber', 'L'.repeat(101)],
          ['expiryDate', '2027-02-30'],
          ['location', '場'.repeat(101)],
          ['shelf', '棚'.repeat(51)],
        ]),
        SALON_ID,
        PRODUCTS_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        lotNumber: LOT_ERROR,
        expiryDate:
          '使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。',
        location: '保管場所は、100 文字までで入力してください。',
        shelf: '棚は、50 文字までで入力してください。',
      },
    })
  })

  it('should take the longest values the API takes, counted in characters', () => {
    expect(
      readStockEntry(
        formOf([
          ['productId', colour.id],
          ['lotNumber', '𠮷'.repeat(100)],
          ['location', '𠮷'.repeat(100)],
          ['shelf', '𠮷'.repeat(50)],
        ]),
        SALON_ID,
        PRODUCTS_OF_THE_SALON,
      ),
    ).toMatchObject({ type: 'valid' })
  })
})

describe('readStockChange', () => {
  it('should ask for nothing when nothing was changed', () => {
    expect(readStockChange(rowForm(colourLot, {}), colourLot, colour)).toEqual({
      type: 'unchanged',
    })
    expect(
      readStockChange(rowForm(shampooRow, {}), shampooRow, shampoo),
    ).toEqual({ type: 'unchanged' })
  })

  it('should compare a row written with spaces around its texts as the form reads it', () => {
    // Arrange: written so by another client of the API, which keeps texts as they are sent
    const spaced = {
      ...colourLot,
      lotNumber: ' LOT-2026-041 ',
      location: ' バックヤード ',
      shelf: ' B-2 ',
      notes: ' 開封済みから使う ',
    }

    // Act
    const read = readStockChange(rowForm(spaced, {}), spaced, colour)

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it('should ask for what was changed, and clear what was emptied', () => {
    expect(
      readStockChange(
        rowForm(colourLot, {
          lotNumber: 'LOT-2026-042',
          expiryDate: '',
          location: ' ',
          shelf: 'C-1',
          notes: '開封済み',
        }),
        colourLot,
        colour,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        lotNumber: 'LOT-2026-042',
        expiryDate: null,
        location: null,
        shelf: 'C-1',
        notes: '開封済み',
      },
    })
  })

  it('should ask for the lot of a product kept by lots', () => {
    expect(
      readStockChange(rowForm(colourLot, { lotNumber: '' }), colourLot, colour),
    ).toEqual({ type: 'invalid', errors: { lotNumber: LOT_ERROR } })
  })

  it('should let the lot of a product no longer kept by lots be cleared, and nothing else', () => {
    const dropped = { ...colour, requiresLotTracking: false }

    expect(
      readStockChange(
        rowForm(colourLot, { lotNumber: '' }),
        colourLot,
        dropped,
      ),
    ).toEqual({ type: 'valid', value: { lotNumber: null } })
    expect(
      readStockChange(
        rowForm(colourLot, { lotNumber: 'LOT-9' }),
        colourLot,
        dropped,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        lotNumber:
          'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。',
      },
    })
    expect(
      readStockChange(
        rowForm(colourLot, { lotNumber: 'L'.repeat(101) }),
        colourLot,
        dropped,
      ),
    ).toEqual({
      type: 'invalid',
      errors: { lotNumber: 'ロット番号は、100 文字までで入力してください。' },
    })
  })

  it('should not read a lot the form of a row without lots does not show', () => {
    expect(
      readStockChange(
        formOf([
          ['lotNumber', 'LOT-1'],
          ['expiryDate', ''],
          ['location', '店頭の棚'],
          ['shelf', ''],
          ['notes', shampooRow.notes ?? ''],
        ]),
        shampooRow,
        shampoo,
      ),
    ).toEqual({ type: 'unchanged' })
  })

  it('should say a day that does not exist', () => {
    expect(
      readStockChange(
        rowForm(colourLot, { expiryDate: '3000-01-01' }),
        colourLot,
        colour,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        expiryDate:
          '使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。',
      },
    })
  })
})

describe('afterStockWrite', () => {
  it('should say each value the API refused at its control', () => {
    expect(
      afterStockWrite(
        {
          type: 'invalid',
          values: [
            { field: 'productId', rule: 'not_found' },
            { field: 'lotNumber', rule: 'too_big' },
            { field: 'shelf', rule: 'too_big' },
          ],
        },
        true,
      ),
    ).toEqual({
      message: undefined,
      errors: {
        productId: 'この商品は、削除されました。ほかの商品を選んでください。',
        lotNumber: 'ロット番号は、100 文字までで入力してください。',
        shelf: '棚は、50 文字までで入力してください。',
      },
    })
  })

  it('should say above the form that the product was marked otherwise as to its lots', () => {
    expect(
      afterStockWrite(
        {
          type: 'invalid',
          values: [
            { field: 'lotNumber', rule: 'custom' },
            { field: 'shelf', rule: 'too_big' },
          ],
        },
        false,
      ),
    ).toEqual({
      message:
        'この商品の「在庫をロット番号で分ける」の印が、変わっていました。いまの印で読み直したので、ロット番号を確かめて、もう一度お試しください。',
      errors: { shelf: '棚は、50 文字までで入力してください。' },
    })
  })

  it('should say a refusal of no control above the form', () => {
    expect(
      afterStockWrite(
        { type: 'invalid', values: [{ field: 'salonId', rule: 'not_found' }] },
        false,
      ),
    ).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<[boolean, string | undefined, Record<string, string>]>([
    [
      true,
      undefined,
      {
        lotNumber:
          'このロット番号の在庫の行は、この商品にすでにあります。同じロットの在庫は、その行で記録してください。',
      },
    ],
    [
      false,
      'ロット番号のない在庫の行は、この商品にすでにあります。ロット番号のない在庫は、その行で記録してください。',
      {},
    ],
  ])(
    'should say a lot taken where it was written (a lot sent: %s)',
    (lotSent, message, errors) => {
      expect(afterStockWrite({ type: 'lotTaken' }, lotSent)).toEqual({
        message,
        errors,
      })
    },
  )

  it.each<['forbidden' | 'tooManyRequests' | 'failed', string]>([
    [
      'forbidden',
      'このサロンの在庫は、変えられません。在庫の行を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      'failed',
      '在庫の行を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form why it was not saved: %s', (type, message) => {
    expect(afterStockWrite({ type }, false)).toEqual({ message, errors: {} })
  })
})

describe('productsChanged', () => {
  it.each<[string, string, boolean]>([
    ['productId', 'not_found', true],
    ['lotNumber', 'custom', true],
    ['lotNumber', 'too_big', false],
    ['shelf', 'too_big', false],
  ])(
    'should tell whether a refusal of %s (%s) means that the products changed',
    (field, rule, changed) => {
      expect(productsChanged([{ field, rule }])).toBe(changed)
    },
  )
})

describe('afterStockRemoval', () => {
  it.each<
    [
      Parameters<typeof afterStockRemoval>[0]['type'],
      ReturnType<typeof afterStockRemoval>,
    ]
  >([
    ['removed', { type: 'done', message: '在庫の行「LOT-1」を削除しました。' }],
    [
      'inStock',
      {
        type: 'refused',
        message:
          '在庫の行「LOT-1」は、在庫数が 0 でないので、削除できません。在庫の移動で在庫数を 0 にしてから、削除してください。',
      },
    ],
    ['notFound', { type: 'gone' }],
    [
      'forbidden',
      {
        type: 'refused',
        message:
          'このサロンの在庫は、変えられません。在庫の行を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    [
      'tooManyRequests',
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'failed',
      {
        type: 'again',
        message:
          '在庫の行を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what became of the row after %s', (type, says) => {
    expect(afterStockRemoval({ type }, 'LOT-1')).toEqual(says)
  })
})
