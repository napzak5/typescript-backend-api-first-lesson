import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { ProductRemoval } from '../api/products-api'
import { shampoo } from '../components/examples'
import {
  afterProductRemoval,
  afterProductWrite,
  levelOf,
  readProductChange,
  readProductEntry,
} from './product-form'

/** The values of the controls of a product that may be sent, with what a case changes */
const VALUES: Record<string, string> = {
  productCode: 'OIL001',
  unit: '本',
  name: 'ヘアオイル 100ml',
  description: '',
  category: '',
  brand: '',
  purchasePrice: '',
  retailPrice: '',
  salonPrice: '',
  minimumStock: '0',
  reorderPoint: '',
  maximumStock: '',
  supplier: '',
  supplierProductCode: '',
  leadTimeDays: '',
  barcode: '',
  expiryMonths: '',
  storageConditions: '',
  imageUrl: '',
  safetyDataSheet: '',
}

/** The form as it is sent: the values of its controls, and the checkboxes that are checked. */
const formOf = (
  changes: Record<string, string> = {},
  checked: readonly string[] = ['isForSale', 'isActive'],
): FormData => {
  const form = new FormData()
  for (const [name, value] of Object.entries({ ...VALUES, ...changes })) {
    form.append(name, value)
  }
  for (const name of checked) {
    form.append(name, 'on')
  }

  return form
}

/** The shampoo of the examples, as its form opens */
const SHAMPOO_VALUES: Record<string, string> = {
  productCode: 'SHMP001',
  unit: '本',
  name: 'プロフェッショナル シャンプー 500ml',
  description: 'サロン専売のシャンプー。\n乾燥した髪に。',
  category: 'ヘアケア',
  brand: 'Salon Pro',
  purchasePrice: '1500',
  retailPrice: '3500',
  salonPrice: '3000',
  minimumStock: '5',
  reorderPoint: '10',
  maximumStock: '50',
  supplier: '東京ビューティーサプライ',
  supplierProductCode: 'TBS-SH-500',
  leadTimeDays: '3',
  barcode: '4901234567894',
  expiryMonths: '36',
  storageConditions: '直射日光を避けて保管',
  imageUrl: 'https://images.example.com/products/shmp001.jpg',
  safetyDataSheet: 'https://docs.example.com/sds/shmp001.pdf',
}

const SHAMPOO_CHECKED = ['isForSale', 'isForTreatment', 'isActive']

const shampooFormOf = (
  changes: Record<string, string> = {},
  checked: readonly string[] = SHAMPOO_CHECKED,
): FormData => formOf({ ...SHAMPOO_VALUES, ...changes }, checked)

describe('levelOf', () => {
  it.each<[string, number | null | undefined]>([
    ['', null],
    ['  ', null],
    ['0', 0],
    ['10.5', 10.5],
    ['１,２００.２５', 1200.25],
    ['99999999.99', 99_999_999.99],
    ['100000000', undefined],
    ['1.234', undefined],
    ['-1', undefined],
    ['十', undefined],
  ])('should read %s as %s', (text, level) => {
    // Assert
    expect(levelOf(text)).toBe(level)
  })
})

describe('readProductEntry', () => {
  it('should read a whole product: nothing as null, digits of full width, and the checkboxes that are checked', () => {
    // Act
    const read = readProductEntry(
      formOf(
        {
          productCode: ' OIL001 ',
          description: '  ',
          category: ' Hair Care ',
          purchasePrice: '１,２００',
          retailPrice: '0',
          minimumStock: '２.５',
          reorderPoint: '5',
          maximumStock: '5',
          leadTimeDays: '０',
          expiryMonths: '12',
          imageUrl: ' https://images.example.com/oil.jpg ',
        },
        ['isForTreatment', 'requiresLotTracking'],
      ),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        productCode: 'OIL001',
        name: 'ヘアオイル 100ml',
        description: null,
        category: 'Hair Care',
        brand: null,
        purchasePrice: 1200,
        retailPrice: 0,
        salonPrice: null,
        unit: '本',
        minimumStock: 2.5,
        maximumStock: 5,
        reorderPoint: 5,
        supplier: null,
        supplierProductCode: null,
        leadTimeDays: 0,
        imageUrl: 'https://images.example.com/oil.jpg',
        barcode: null,
        isForSale: false,
        isForTreatment: true,
        requiresLotTracking: true,
        expiryMonths: 12,
        storageConditions: null,
        safetyDataSheet: null,
        isActive: false,
      },
    })
  })

  it('should count the characters as the API does: one outside the basic plane is one', () => {
    // Act
    const read = readProductEntry(
      formOf({
        productCode: '𠮷'.repeat(100),
        name: '𠮷'.repeat(255),
        category: '𠮷'.repeat(100),
        brand: '𠮷'.repeat(100),
        unit: '𠮷'.repeat(20),
        supplier: '𠮷'.repeat(255),
        supplierProductCode: '𠮷'.repeat(100),
        barcode: '𠮷'.repeat(100),
      }),
    )

    // Assert
    expect(read.type).toBe('valid')
  })

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    [
      'no code, no name and no unit',
      { productCode: ' ', name: '', unit: '　' },
      {
        productCode: {
          en: 'Product code: enter 1 to 100 characters.',
          ja: '商品コードを、100 文字以内で入力してください。',
        },
        name: {
          en: 'Product name: enter 1 to 255 characters.',
          ja: '商品名を、255 文字以内で入力してください。',
        },
        unit: {
          en: 'Unit: enter 1 to 20 characters.',
          ja: '単位を、20 文字以内で入力してください。',
        },
      },
    ],
    [
      'texts that are too long',
      {
        productCode: 'a'.repeat(101),
        name: 'a'.repeat(256),
        category: 'a'.repeat(101),
        brand: 'a'.repeat(101),
        unit: 'a'.repeat(21),
        supplier: 'a'.repeat(256),
        supplierProductCode: 'a'.repeat(101),
        barcode: '1'.repeat(101),
      },
      {
        productCode: {
          en: 'Product code: enter 1 to 100 characters.',
          ja: '商品コードを、100 文字以内で入力してください。',
        },
        name: {
          en: 'Product name: enter 1 to 255 characters.',
          ja: '商品名を、255 文字以内で入力してください。',
        },
        category: {
          en: 'Category: enter up to 100 characters.',
          ja: 'カテゴリーは、100 文字以内で入力してください。',
        },
        brand: {
          en: 'Brand: enter up to 100 characters.',
          ja: 'ブランドは、100 文字以内で入力してください。',
        },
        unit: {
          en: 'Unit: enter 1 to 20 characters.',
          ja: '単位を、20 文字以内で入力してください。',
        },
        supplier: {
          en: 'Supplier: enter up to 255 characters.',
          ja: '仕入先は、255 文字以内で入力してください。',
        },
        supplierProductCode: {
          en: 'Supplier product code: enter up to 100 characters.',
          ja: '仕入先の商品コードは、100 文字以内で入力してください。',
        },
        barcode: {
          en: 'Barcode: enter up to 100 characters.',
          ja: 'バーコードは、100 文字以内で入力してください。',
        },
      },
    ],
    [
      'prices that are no whole numbers of yen',
      { purchasePrice: '-1', retailPrice: '1.5', salonPrice: '3000000000' },
      {
        purchasePrice: {
          en: 'Enter the purchase price as a whole number of yen from 0.',
          ja: '仕入価格は、0 以上の円の整数で入力してください。',
        },
        retailPrice: {
          en: 'Enter the list price as a whole number of yen from 0.',
          ja: '定価は、0 以上の円の整数で入力してください。',
        },
        salonPrice: {
          en: 'Enter the sale price as a whole number of yen from 0.',
          ja: '販売価格は、0 以上の円の整数で入力してください。',
        },
      },
    ],
    [
      'no minimum, and levels that are no numbers the API takes',
      { minimumStock: '', reorderPoint: '1.234', maximumStock: '100000000' },
      {
        minimumStock: {
          en: 'Enter the minimum stock as a number from 0 to 99,999,999.99, with up to 2 decimal places.',
          ja: '最低在庫数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
        },
        reorderPoint: {
          en: 'Enter the reorder point as a number from 0 to 99,999,999.99, with up to 2 decimal places.',
          ja: '発注点は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
        },
        maximumStock: {
          en: 'Enter the maximum stock as a number from 0 to 99,999,999.99, with up to 2 decimal places.',
          ja: '最大在庫数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
        },
      },
    ],
    [
      'days and months that are no whole numbers, or no month at all',
      { leadTimeDays: '1.5', expiryMonths: '0' },
      {
        leadTimeDays: {
          en: 'Enter the lead time as a whole number of days from 0.',
          ja: '納品までの日数は、0 以上の整数で入力してください。',
        },
        expiryMonths: {
          en: 'Enter the months to expiry as a whole number from 1.',
          ja: '使用期限までの月数は、1 以上の整数で入力してください。',
        },
      },
    ],
    [
      'addresses that lead nowhere on the web',
      {
        imageUrl: 'javascript:alert(1)',
        safetyDataSheet: `https://example.com/${'a'.repeat(481)}`,
      },
      {
        imageUrl: {
          en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
          ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
        },
        safetyDataSheet: {
          en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
          ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
        },
      },
    ],
    [
      'an address of a path alone',
      { imageUrl: '/images/a.jpg' },
      {
        imageUrl: {
          en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
          ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
        },
      },
    ],
  ])(
    'should send nothing with %s, and say why at each control',
    (_case, changes, errors) => {
      // Assert
      expect(readProductEntry(formOf(changes))).toEqual({
        type: 'invalid',
        errors,
      })
    },
  )

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    [
      'a reorder point below the minimum',
      { minimumStock: '5', reorderPoint: '4' },
      {
        reorderPoint: {
          en: 'Make the reorder point the same as the minimum stock or larger.',
          ja: '発注点は、最低在庫数と同じか、それより大きい数にしてください。',
        },
      },
    ],
    [
      'a maximum below the reorder point',
      { minimumStock: '5', reorderPoint: '10', maximumStock: '8' },
      {
        maximumStock: {
          en: 'Make the maximum stock the same as the reorder point or larger.',
          ja: '最大在庫数は、発注点と同じか、それより大きい数にしてください。',
        },
      },
    ],
    [
      'a maximum below the minimum, without a reorder point',
      { minimumStock: '5', maximumStock: '4.99' },
      {
        maximumStock: {
          en: 'Make the maximum stock the same as the minimum stock or larger.',
          ja: '最大在庫数は、最低在庫数と同じか、それより大きい数にしてください。',
        },
      },
    ],
    [
      'both levels above the minimum out of order',
      { minimumStock: '10', reorderPoint: '5', maximumStock: '3' },
      {
        reorderPoint: {
          en: 'Make the reorder point the same as the minimum stock or larger.',
          ja: '発注点は、最低在庫数と同じか、それより大きい数にしてください。',
        },
        maximumStock: {
          en: 'Make the maximum stock the same as the reorder point or larger.',
          ja: '最大在庫数は、発注点と同じか、それより大きい数にしてください。',
        },
      },
    ],
  ])(
    'should say at the higher level that the levels are out of order: %s',
    (_case, changes, errors) => {
      // Assert
      expect(readProductEntry(formOf(changes))).toEqual({
        type: 'invalid',
        errors,
      })
    },
  )

  it('should compare no levels while one of them is none the API takes', () => {
    // Assert
    expect(
      readProductEntry(
        formOf({ minimumStock: '10', reorderPoint: '5', maximumStock: 'x' }),
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        maximumStock: {
          en: 'Enter the maximum stock as a number from 0 to 99,999,999.99, with up to 2 decimal places.',
          ja: '最大在庫数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
        },
      },
    })
  })
})

describe('readProductChange', () => {
  it('should send what was changed, and nothing else', () => {
    // Act
    const read = readProductChange(
      shampooFormOf({ salonPrice: '3,200', reorderPoint: '', supplier: '' }, [
        'isForSale',
        'isActive',
      ]),
      shampoo,
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        salonPrice: 3200,
        reorderPoint: null,
        supplier: null,
        isForTreatment: false,
      },
    })
  })

  it('should take a form sent as it was opened for no change', () => {
    // Assert
    expect(readProductChange(shampooFormOf(), shampoo)).toEqual({
      type: 'unchanged',
    })
  })

  it('should compare the texts as the form reads them: the spaces around a stored text are no change', () => {
    // Arrange
    const spaced = {
      ...shampoo,
      name: ` ${shampoo.name} `,
      brand: 'Salon Pro ',
    }

    // Act
    const read = readProductChange(
      shampooFormOf({ name: spaced.name, brand: spaced.brand }),
      spaced,
    )

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it('should send nothing when what was changed is none the API takes', () => {
    // Assert
    expect(
      readProductChange(shampooFormOf({ maximumStock: '9' }), shampoo),
    ).toEqual({
      type: 'invalid',
      errors: {
        maximumStock: {
          en: 'Make the maximum stock the same as the reorder point or larger.',
          ja: '最大在庫数は、発注点と同じか、それより大きい数にしてください。',
        },
      },
    })
  })
})

describe('afterProductWrite', () => {
  it('should say each refused value at its control, the levels compared with those that are kept by what they are compared with', () => {
    // Act
    const said = afterProductWrite({
      type: 'invalid',
      values: [
        { field: 'productCode', rule: 'too_big' },
        { field: 'minimumStock', rule: 'custom' },
        { field: 'reorderPoint', rule: 'custom' },
        { field: 'maximumStock', rule: 'custom' },
        { field: 'salonPrice', rule: 'too_small' },
        { field: 'imageUrl', rule: 'invalid_format' },
      ],
    })

    // Assert
    expect(said).toEqual({
      message: undefined,
      errors: {
        productCode: {
          en: 'Product code: enter 1 to 100 characters.',
          ja: '商品コードを、100 文字以内で入力してください。',
        },
        minimumStock: {
          en: 'Make the minimum stock the same as the reorder point and the maximum stock, or smaller.',
          ja: '最低在庫数は、発注点と最大在庫数と同じか、それより小さい数にしてください。',
        },
        reorderPoint: {
          en: 'Make the reorder point a number from the minimum stock to the maximum stock.',
          ja: '発注点は、最低在庫数から最大在庫数までの数にしてください。',
        },
        maximumStock: {
          en: 'Make the maximum stock the same as the minimum stock and the reorder point, or larger.',
          ja: '最大在庫数は、最低在庫数と発注点と同じか、それより大きい数にしてください。',
        },
        salonPrice: {
          en: 'Enter the sale price as a whole number of yen from 0.',
          ja: '販売価格は、0 以上の円の整数で入力してください。',
        },
        imageUrl: {
          en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
          ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
        },
      },
    })
  })

  it('should say above the form what it has no control for', () => {
    // Assert
    expect(
      afterProductWrite({
        type: 'invalid',
        values: [{ field: 'salonId', rule: 'unrecognized_keys' }],
      }),
    ).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it('should say at the code that another product has it, those no longer carried among them', () => {
    // Assert
    expect(afterProductWrite({ type: 'codeTaken' })).toEqual({
      message: undefined,
      errors: {
        productCode: {
          en: 'Another product of this salon uses this product code, and the code of a discontinued product cannot be used either. Enter another code.',
          ja: 'この商品コードは、このサロンのほかの商品が使っています。取り扱いをやめた商品のコードも使えません。ほかのコードを入力してください。',
        },
      },
    })
  })

  it.each<
    ['forbidden' | 'tooManyRequests' | 'failed', { en: string; ja: string }]
  >([
    [
      'forbidden',
      {
        en: 'The products of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its products.',
        ja: 'このサロンの商品は、変えられません。商品を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
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
        en: 'Could not save the product. Check your connection and try again.',
        ja: '商品を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say above the form what came of %s', (type, message) => {
    // Assert
    expect(afterProductWrite({ type })).toEqual({ message, errors: {} })
  })
})

describe('afterProductRemoval', () => {
  it.each<[ProductRemoval, ReturnType<typeof afterProductRemoval>]>([
    [
      { type: 'removed' },
      {
        type: 'done',
        message: {
          en: 'Removed the product “Styling Wax 80g”.',
          ja: '商品「Styling Wax 80g」を削除しました。',
        },
      },
    ],
    [
      { type: 'inStock' },
      {
        type: 'refused',
        message: {
          en: 'The product “Styling Wax 80g” has stock records, so it cannot be removed. To discontinue it, clear “Active” and save.',
          ja: '商品「Styling Wax 80g」には在庫の記録があるので、削除できません。取り扱いをやめるときは、「取り扱い中」の印を外して保存してください。',
        },
      },
    ],
    [{ type: 'notFound' }, { type: 'gone' }],
    [
      { type: 'forbidden' },
      {
        type: 'refused',
        message: {
          en: 'The products of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its products.',
          ja: 'このサロンの商品は、変えられません。商品を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
        },
      },
    ],
    [
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message: {
          en: 'There are too many requests. Wait a while and try again.',
          ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
      },
    ],
    [
      { type: 'failed' },
      {
        type: 'again',
        message: {
          en: 'Could not remove the product. Check your connection and try again.',
          ja: '商品を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
  ])('should say what came of %o', (outcome, says) => {
    // Assert
    expect(afterProductRemoval(outcome, 'Styling Wax 80g')).toEqual(says)
  })
})
