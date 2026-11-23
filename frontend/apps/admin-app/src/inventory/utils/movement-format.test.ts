import {
  ModelsInventoryTransactionType,
  type ModelsInventoryTransactionType as TransactionType,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { staff } from '../../bookings/components/examples'
import { colour } from '../../products/components/examples'
import {
  changeNameOf,
  MOVEMENT_TYPE_CHOICES,
  movementReasonOf,
  movementTypeIn,
  movementTypeNameOf,
  needsReason,
  performerNameOf,
  recordedKindsOf,
  wayOf,
} from './movement-format'

/** A text that stands as it was written, in every language */
const asWritten = (written: string): LocalizedText => ({
  en: written,
  ja: written,
})

describe('the kinds of movement', () => {
  it.each<[TransactionType, string, string, string, boolean]>([
    ['purchase', 'Purchase', '仕入れ', 'in', false],
    ['use', 'Used in a treatment', '施術で使用', 'out', false],
    ['sale', 'Retail sale', '店頭販売', 'out', false],
    ['return', 'Return', '返品', 'either', false],
    ['adjustment', 'Adjustment', '在庫の調整', 'either', true],
    ['disposal', 'Disposal', '廃棄', 'out', true],
    ['transfer', 'Transfer between salons', 'サロン間の移動', 'either', false],
  ])(
    'should name %s "%s" (「%s」), moving %s, saying why: %s',
    (type, en, ja, way, why) => {
      // Act, Assert
      expect(movementTypeNameOf(type)).toEqual({ en, ja })
      expect(wayOf(type)).toBe(way)
      expect(needsReason(type)).toBe(why)
    },
  )

  it('should offer every kind of the contract to narrow the history, by its name', () => {
    // Assert
    expect(MOVEMENT_TYPE_CHOICES.map(({ value }) => value).toSorted()).toEqual(
      Object.values(ModelsInventoryTransactionType).toSorted(),
    )
    expect(
      MOVEMENT_TYPE_CHOICES.map(({ value }) => {
        const type = movementTypeIn(value)

        return type === undefined ? undefined : movementTypeNameOf(type)
      }),
    ).toEqual(MOVEMENT_TYPE_CHOICES.map(({ label }) => label))
  })

  it('should let those who keep the stock record every kind, and the others those of every day', () => {
    expect(recordedKindsOf(true)).toEqual([
      'purchase',
      'use',
      'sale',
      'return',
      'adjustment',
      'disposal',
      'transfer',
    ])
    expect(recordedKindsOf(false)).toEqual([
      'purchase',
      'use',
      'sale',
      'return',
    ])
  })

  it.each<[string, TransactionType | undefined]>([
    ['use', 'use'],
    ['Use', undefined],
    ['', undefined],
    ['moving', undefined],
  ])('should read 「%s」 as the kind %s', (text, type) => {
    expect(movementTypeIn(text)).toBe(type)
  })
})

describe('changeNameOf', () => {
  it.each<[number, string]>([
    [10, '+10 本'],
    [-2.5, '−2.5 本'],
    [-0.01, '−0.01 本'],
    [1234.5, '+1,234.5 本'],
  ])('should say %d as 「%s」', (quantity, named) => {
    // Act, Assert
    expect(changeNameOf(quantity, colour)).toEqual(asWritten(named))
  })

  it('should say a change without a unit when the product was removed', () => {
    // Act, Assert
    expect(changeNameOf(-3, undefined)).toEqual(asWritten('−3'))
  })
})

describe('movementReasonOf', () => {
  it.each<[string, string | null, string | null, LocalizedText | null]>([
    ['what it says', '容器の破損', null, asWritten('容器の破損')],
    [
      'the receipt of a purchase order',
      null,
      'purchase_order',
      { en: 'Receipt of a purchase order', ja: '発注の入荷' },
    ],
    [
      'what a receipt says, when it says something',
      '箱がつぶれていた',
      'purchase_order',
      asWritten('箱がつぶれていた'),
    ],
    ['nothing, of another record', null, 'treatment_record', null],
    ['nothing', null, null, null],
  ])('should say %s', (_, reason, referenceType, said) => {
    // Act, Assert
    expect(movementReasonOf({ reason, referenceType })).toEqual(said)
  })
})

describe('performerNameOf', () => {
  it.each<[string, string, LocalizedText]>([
    ['a member of the staff', staff[1]?.id ?? '', asWritten('佐藤 健')],
    [
      'a member who left',
      '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
      { en: 'Staff member not listed', ja: '一覧にないスタッフ' },
    ],
  ])('should name %s', (_, performedBy, named) => {
    // Act, Assert
    expect(performerNameOf(performedBy, staff)).toEqual(named)
  })
})
