import { describe, expect, it } from 'vitest'
import { aProduct, aTreatment } from './components/examples'
import {
  afterTreatmentRemoval,
  customerCalled,
  mayRemoveTreatments,
  productNameOf,
  quantityNameOf,
  SATISFACTION_OPTIONS,
  satisfactionNameOf,
  type TreatmentRemovalSays,
  wasChanged,
} from './treatment-format'
import type { TreatmentRemoval } from './treatments-api'

describe('satisfactionNameOf', () => {
  it.each<[number, string]>([
    [5, '5（とても満足）'],
    [3, '3（ふつう）'],
    [1, '1（とても不満）'],
  ])('should name %s', (satisfaction, name) => {
    expect(satisfactionNameOf(satisfaction)).toBe(name)
  })

  it('should offer the satisfactions from the highest', () => {
    expect(SATISFACTION_OPTIONS.map(({ value }) => value)).toEqual([
      '5',
      '4',
      '3',
      '2',
      '1',
    ])
  })
})

describe('quantityNameOf', () => {
  it.each<[number, string, string]>([
    [1, '本', '1 本'],
    [0.5, 'bottle', '0.5 bottle'],
    [1250.75, 'ml', '1,250.75 ml'],
  ])('should say %s %s', (quantity, unit, name) => {
    expect(quantityNameOf({ quantity, unit })).toBe(name)
  })
})

describe('productNameOf', () => {
  it('should name a product with its code', () => {
    expect(productNameOf(aProduct())).toBe('カラー剤 6N（COLOR-6N）')
  })
})

describe('mayRemoveTreatments', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should let the %s remove a record: %s', (role, may) => {
    expect(mayRemoveTreatments(role)).toBe(may)
  })
})

describe('wasChanged', () => {
  it('should tell a record that was changed after it was written', () => {
    expect([
      wasChanged(aTreatment()),
      wasChanged(aTreatment({ updatedAt: '2026-11-20T04:00:00.000Z' })),
    ]).toEqual([false, true])
  })
})

describe('customerCalled', () => {
  it('should call a customer by name, and one who left the ledger so', () => {
    expect([
      customerCalled({ lastName: '山田', firstName: '花子' }),
      customerCalled(undefined),
    ]).toEqual(['山田 花子 様', '台帳から削除されたお客様'])
  })
})

describe('afterTreatmentRemoval', () => {
  it.each<[string, TreatmentRemoval, TreatmentRemovalSays]>([
    [
      'a removal',
      { type: 'removed' },
      { type: 'done', message: '山田 花子 様の施術記録を削除しました。' },
    ],
    ['a record removed meanwhile', { type: 'notFound' }, { type: 'gone' }],
    [
      'a refusal of the role',
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このアカウントでは、施術記録を削除できません。間違えて書いた施術記録の削除は、オーナーとマネージャーができます。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'a failure',
      { type: 'failed' },
      {
        type: 'again',
        message:
          '施術記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what came of %s', (_case, outcome, says) => {
    expect(afterTreatmentRemoval(outcome, '山田 花子 様')).toEqual(says)
  })
})
