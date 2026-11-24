import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { TreatmentRemoval } from '../api/treatments-api'
import { aTreatment } from '../components/examples'
import {
  afterTreatmentRemoval,
  customerCalled,
  customerInASentence,
  isTreated,
  mayRemoveTreatments,
  SATISFACTION_CHOICES,
  satisfactionNameOf,
  type TreatmentRemovalSays,
  wasChanged,
} from './treatment-format'

describe('satisfactionNameOf', () => {
  it.each<[number, LocalizedText]>([
    [5, { en: '5 (Very satisfied)', ja: '5（とても満足）' }],
    [4, { en: '4 (Satisfied)', ja: '4（満足）' }],
    [3, { en: '3 (Neutral)', ja: '3（ふつう）' }],
    [2, { en: '2 (Dissatisfied)', ja: '2（不満）' }],
    [1, { en: '1 (Very dissatisfied)', ja: '1（とても不満）' }],
  ])('should name %s', (satisfaction, name) => {
    // Act
    const named = satisfactionNameOf(satisfaction)

    // Assert
    expect(named).toEqual(name)
  })

  it('should write a satisfaction the contract does not name as its number', () => {
    // Act
    const named = satisfactionNameOf(6)

    // Assert
    expect(named).toEqual({ en: '6', ja: '6' })
  })

  it('should offer the satisfactions from the highest, by name', () => {
    // Assert
    expect(SATISFACTION_CHOICES).toEqual(
      [5, 4, 3, 2, 1].map((value) => ({
        value: String(value),
        label: satisfactionNameOf(value),
      })),
    )
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
    // Act
    const allowed = mayRemoveTreatments(role)

    // Assert
    expect(allowed).toBe(may)
  })
})

describe('wasChanged', () => {
  it('should tell a record that was changed after it was written', () => {
    // Act
    const changed = [
      wasChanged(aTreatment()),
      wasChanged(aTreatment({ updatedAt: '2026-11-20T04:00:00.000Z' })),
    ]

    // Assert
    expect(changed).toEqual([false, true])
  })
})

describe('customerCalled', () => {
  it('should call a customer by name, and one who left the ledger so', () => {
    // Act
    const called = [
      customerCalled({ lastName: '山田', firstName: '花子' }),
      customerCalled(undefined),
    ]

    // Assert
    expect(called).toEqual([
      { en: '山田 花子', ja: '山田 花子 様' },
      { en: 'Removed from the ledger', ja: '台帳から削除されたお客様' },
    ])
  })
})

describe('customerInASentence', () => {
  it('should name a customer in a sentence by name, and one who left the ledger so', () => {
    // Act
    const named = [
      customerInASentence({ lastName: '山田', firstName: '花子' }),
      customerInASentence(undefined),
    ]

    // Assert
    expect(named).toEqual([
      { en: '山田 花子', ja: '山田 花子 様' },
      {
        en: 'a customer removed from the ledger',
        ja: '台帳から削除されたお客様',
      },
    ])
  })
})

describe('isTreated', () => {
  it.each<[ModelsBookingStatusType, boolean]>([
    ['draft', false],
    ['pending', false],
    ['confirmed', false],
    ['in_progress', true],
    ['completed', true],
    ['cancelled', false],
    ['no_show', false],
  ])(
    'should tell whether a booking that is %s was treated: %s',
    (status, treated) => {
      // Act
      const told = isTreated({ status })

      // Assert
      expect(told).toBe(treated)
    },
  )
})

describe('afterTreatmentRemoval', () => {
  it.each<[string, TreatmentRemoval, TreatmentRemovalSays]>([
    [
      'a removal',
      { type: 'removed' },
      {
        type: 'done',
        message: {
          en: 'Removed the treatment record of 山田 花子.',
          ja: '山田 花子 様の施術記録を削除しました。',
        },
      },
    ],
    ['a record removed meanwhile', { type: 'notFound' }, { type: 'gone' }],
    [
      'a refusal of the role',
      { type: 'forbidden' },
      {
        type: 'refused',
        message: {
          en: 'This account cannot remove treatment records. The owner and the managers can remove a treatment record written by mistake.',
          ja: 'このアカウントでは、施術記録を削除できません。間違えて書いた施術記録の削除は、オーナーとマネージャーができます。',
        },
      },
    ],
    [
      'too many requests',
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
      'a failure',
      { type: 'failed' },
      {
        type: 'again',
        message: {
          en: 'The treatment record could not be removed. Check your connection and try again.',
          ja: '施術記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
  ])('should say what came of %s', (_case, outcome, says) => {
    // Act
    const said = afterTreatmentRemoval(outcome, {
      en: '山田 花子',
      ja: '山田 花子 様',
    })

    // Assert
    expect(said).toEqual(says)
  })
})
