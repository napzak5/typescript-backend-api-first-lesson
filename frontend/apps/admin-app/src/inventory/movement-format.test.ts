import {
  ModelsInventoryTransactionType,
  type ModelsInventoryTransactionType as TransactionType,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { staff } from '../bookings/components/examples'
import { colour } from '../products/components/examples'
import {
  changeNameOf,
  MOVEMENT_TYPE_OPTIONS,
  movementReasonOf,
  movementTypeIn,
  movementTypeNameOf,
  needsReason,
  performerNameOf,
  recordedKindsOf,
  wayOf,
} from './movement-format'

describe('the kinds of movement', () => {
  it.each<[TransactionType, string, string, boolean]>([
    ['purchase', '仕入れ', 'in', false],
    ['use', '施術で使用', 'out', false],
    ['sale', '店頭販売', 'out', false],
    ['return', '返品', 'either', false],
    ['adjustment', '在庫の調整', 'either', true],
    ['disposal', '廃棄', 'out', true],
    ['transfer', 'サロン間の移動', 'either', false],
  ])(
    'should name %s 「%s」, moving %s, saying why: %s',
    (type, name, way, why) => {
      expect(movementTypeNameOf(type)).toBe(name)
      expect(wayOf(type)).toBe(way)
      expect(needsReason(type)).toBe(why)
    },
  )

  it('should offer every kind of the contract to narrow the history', () => {
    expect(MOVEMENT_TYPE_OPTIONS.map(({ value }) => value).toSorted()).toEqual(
      Object.values(ModelsInventoryTransactionType).toSorted(),
    )
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
    expect(changeNameOf(quantity, colour)).toBe(named)
  })

  it('should say a change without a unit when the product was removed', () => {
    expect(changeNameOf(-3, undefined)).toBe('−3')
  })
})

describe('movementReasonOf', () => {
  it.each<[string, string | null, string | null, string]>([
    ['what it says', '容器の破損', null, '容器の破損'],
    ['the receipt of a purchase order', null, 'purchase_order', '発注の入荷'],
    [
      'what a receipt says, when it says something',
      '箱がつぶれていた',
      'purchase_order',
      '箱がつぶれていた',
    ],
    ['nothing, of another record', null, 'treatment_record', '記録なし'],
    ['nothing', null, null, '記録なし'],
  ])('should say %s', (_, reason, referenceType, said) => {
    expect(movementReasonOf({ reason, referenceType })).toBe(said)
  })
})

describe('performerNameOf', () => {
  it.each<[string, string | null, string]>([
    ['a member of the staff', staff[1]?.id ?? '', '佐藤 健'],
    [
      'a member who left',
      '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b',
      '一覧にないスタッフ',
    ],
    ['nobody, for an administrator', null, '記録なし'],
  ])('should name %s', (_, performedBy, named) => {
    expect(performerNameOf(performedBy, staff)).toBe(named)
  })
})
