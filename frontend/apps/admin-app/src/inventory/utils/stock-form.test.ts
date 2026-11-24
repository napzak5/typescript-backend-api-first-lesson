import { formOfEntries } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  colour,
  gloves,
  PRODUCTS_OF_THE_SALON,
  shampoo,
} from '../../products/components/examples'
import { colourLot, shampooRow } from '../components/examples'
import {
  afterStockRemoval,
  afterStockWrite,
  readStockChange,
  readStockEntry,
  showsLot,
} from './stock-form'

const SALON_ID = '3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60'

/** The values of a form of a row, as it was opened with the row, then changed */
const rowForm = (
  row: typeof colourLot,
  changed: Record<string, string>,
): FormData =>
  formOfEntries(
    Object.entries({
      ...(row.lotNumber === null ? {} : { lotNumber: row.lotNumber }),
      expiryDate: row.expiryDate ?? '',
      location: row.location ?? '',
      shelf: row.shelf ?? '',
      notes: row.notes ?? '',
      ...changed,
    }),
  )

const LOT_ERROR = {
  en: 'Lot number: enter 1 to 100 characters. This product keeps its stock by lot numbers.',
  ja: 'ロット番号を、100 文字以内で入力してください。この商品は、在庫をロット番号で分けます。',
}

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
  it('should take a lot, a place and a shelf as long as the API takes them, counted as it counts them', () => {
    expect(
      readStockEntry(
        formOfEntries([
          ['productId', colour.id],
          ['lotNumber', '𠮷'.repeat(100)],
          ['expiryDate', ''],
          ['location', '𠮷'.repeat(100)],
          ['shelf', '𠮷'.repeat(50)],
          ['notes', ''],
        ]),
        SALON_ID,
        PRODUCTS_OF_THE_SALON,
      ),
    ).toMatchObject({
      type: 'valid',
      value: {
        lotNumber: '𠮷'.repeat(100),
        location: '𠮷'.repeat(100),
        shelf: '𠮷'.repeat(50),
      },
    })
  })

  it('should read a row of a product kept by lots, with its lot', () => {
    expect(
      readStockEntry(
        formOfEntries([
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
        formOfEntries([
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
        formOfEntries([['productId', '']]),
        SALON_ID,
        PRODUCTS_OF_THE_SALON,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        productId: { en: 'Choose a product.', ja: '商品を選んでください。' },
      },
    })
    expect(
      readStockEntry(
        formOfEntries([
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
        formOfEntries([
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
        expiryDate: {
          en: 'Enter the expiry date as a date from January 1, 1900 to December 31, 2999.',
          ja: '使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。',
        },
        location: {
          en: 'Storage location: enter up to 100 characters.',
          ja: '保管場所は、100 文字以内で入力してください。',
        },
        shelf: {
          en: 'Shelf: enter up to 50 characters.',
          ja: '棚は、50 文字以内で入力してください。',
        },
      },
    })
  })

  it('should take the longest values the API takes, counted in characters', () => {
    expect(
      readStockEntry(
        formOfEntries([
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

  it('should take a changed lot as long as the API takes it, counted as it counts it, of a product kept by lots or not', () => {
    const dropped = { ...colour, requiresLotTracking: false }
    const unchanged = { ...colourLot, lotNumber: '𠮷'.repeat(100) }

    expect(
      readStockChange(
        rowForm(colourLot, { lotNumber: '𠮷'.repeat(100) }),
        colourLot,
        colour,
      ),
    ).toEqual({ type: 'valid', value: { lotNumber: '𠮷'.repeat(100) } })
    expect(
      readStockChange(rowForm(unchanged, { shelf: 'Z-9' }), unchanged, dropped),
    ).toEqual({ type: 'valid', value: { shelf: 'Z-9' } })
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
        lotNumber: {
          en: 'This product does not keep its stock by lot numbers. The lot number can only be cleared.',
          ja: 'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。',
        },
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
      errors: {
        lotNumber: {
          en: 'Lot number: enter up to 100 characters.',
          ja: 'ロット番号は、100 文字以内で入力してください。',
        },
      },
    })
  })

  it('should not read a lot the form of a row without lots does not show', () => {
    expect(
      readStockChange(
        formOfEntries([
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
        expiryDate: {
          en: 'Enter the expiry date as a date from January 1, 1900 to December 31, 2999.',
          ja: '使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。',
        },
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
        productId: {
          en: 'This product was removed. Choose another product.',
          ja: 'この商品は、削除されました。ほかの商品を選んでください。',
        },
        lotNumber: {
          en: 'Lot number: enter up to 100 characters.',
          ja: 'ロット番号は、100 文字以内で入力してください。',
        },
        shelf: {
          en: 'Shelf: enter up to 50 characters.',
          ja: '棚は、50 文字以内で入力してください。',
        },
      },
    })
  })

  it('should say at each control what it takes, and a value of a control without words of its own as refused', () => {
    expect(
      afterStockWrite(
        {
          type: 'invalid',
          values: [
            { field: 'productId', rule: 'invalid' },
            { field: 'expiryDate', rule: 'invalid' },
            { field: 'location', rule: 'too_big' },
            { field: 'notes', rule: 'invalid' },
          ],
        },
        false,
      ),
    ).toEqual({
      message: undefined,
      errors: {
        productId: { en: 'Choose a product.', ja: '商品を選んでください。' },
        expiryDate: {
          en: 'Enter the expiry date as a date from January 1, 1900 to December 31, 2999.',
          ja: '使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。',
        },
        location: {
          en: 'Storage location: enter up to 100 characters.',
          ja: '保管場所は、100 文字以内で入力してください。',
        },
        notes: {
          en: 'This value was not accepted. Check what you entered.',
          ja: 'この値は受け付けられませんでした。入力を確かめてください。',
        },
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
      message: {
        en: 'The mark “Keep the stock by lot numbers” of this product changed. The products were loaded again with the mark as it is now: check the lot number and try again.',
        ja: 'この商品の「在庫をロット番号で分ける」の印が、変わっていました。いまの印で読み直したので、ロット番号を確かめて、もう一度お試しください。',
      },
      errors: {
        shelf: {
          en: 'Shelf: enter up to 50 characters.',
          ja: '棚は、50 文字以内で入力してください。',
        },
      },
    })
  })

  it('should say a refusal of no control above the form', () => {
    expect(
      afterStockWrite(
        { type: 'invalid', values: [{ field: 'salonId', rule: 'not_found' }] },
        false,
      ),
    ).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it.each<[boolean, LocalizedText | undefined, Record<string, LocalizedText>]>([
    [
      true,
      undefined,
      {
        lotNumber: {
          en: 'This product already has a stock row with this lot number. Record the stock of that lot on that row.',
          ja: 'このロット番号の在庫の行は、この商品にすでにあります。同じロットの在庫は、その行で記録してください。',
        },
      },
    ],
    [
      false,
      {
        en: 'This product already has a stock row without a lot number. Record the stock without a lot number on that row.',
        ja: 'ロット番号のない在庫の行は、この商品にすでにあります。ロット番号のない在庫は、その行で記録してください。',
      },
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

  it.each<['forbidden' | 'tooManyRequests' | 'failed', LocalizedText]>([
    [
      'forbidden',
      {
        en: 'The stock of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its stock rows.',
        ja: 'このサロンの在庫は、変えられません。在庫の行を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    [
      'tooManyRequests',
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'failed',
      {
        en: 'The stock row could not be saved. Check your connection and try again.',
        ja: '在庫の行を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say above the form why it was not saved: %s', (type, message) => {
    expect(afterStockWrite({ type }, false)).toEqual({ message, errors: {} })
  })
})

describe('afterStockRemoval', () => {
  it.each<
    [
      Parameters<typeof afterStockRemoval>[0]['type'],
      ReturnType<typeof afterStockRemoval>,
    ]
  >([
    [
      'removed',
      {
        type: 'done',
        message: {
          en: 'Removed the stock row “LOT-1”.',
          ja: '在庫の行「LOT-1」を削除しました。',
        },
      },
    ],
    [
      'inStock',
      {
        type: 'refused',
        message: {
          en: 'The stock row “LOT-1” still has stock, so it cannot be removed. Bring its stock to 0 with a stock movement, then remove it.',
          ja: '在庫の行「LOT-1」は、在庫数が 0 でないので、削除できません。在庫の移動で在庫数を 0 にしてから、削除してください。',
        },
      },
    ],
    ['notFound', { type: 'gone' }],
    [
      'forbidden',
      {
        type: 'refused',
        message: {
          en: 'The stock of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its stock rows.',
          ja: 'このサロンの在庫は、変えられません。在庫の行を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
        },
      },
    ],
    [
      'tooManyRequests',
      {
        type: 'again',
        message: {
          en: 'There are too many requests. Wait a while and try again.',
          ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
      },
    ],
    [
      'failed',
      {
        type: 'again',
        message: {
          en: 'The stock row could not be removed. Check your connection and try again.',
          ja: '在庫の行を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
  ])('should say what became of the row after %s', (type, says) => {
    expect(afterStockRemoval({ type }, { en: 'LOT-1', ja: 'LOT-1' })).toEqual(
      says,
    )
  })
})
