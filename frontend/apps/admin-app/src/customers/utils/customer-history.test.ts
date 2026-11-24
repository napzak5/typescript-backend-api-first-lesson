import type { ModelsCustomerVersionOperationType } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { aCustomer } from '../../bookings/components/examples'
import type {
  CustomerRemoval,
  CustomerRestoration,
  Removal,
} from '../api/customer-history-api'
import {
  afterRemoval,
  afterRestoration,
  changerNameOf,
  KEPT_BY_OTHERS,
  mayKeepCustomers,
  operationNameOf,
  whyUnrestorable,
} from './customer-history'

const ME = '6c1f0e2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b'

const CUSTOMER = '7d2a1f3b-4c5e-4f60-9b1a-2c3d4e5f6a7b'

const TOO_MANY = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}

describe('mayKeepCustomers', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])(
    'should tell whether an account of the role %s keeps the ledger',
    (role, keeps) => {
      // Act, Assert
      expect(mayKeepCustomers(role)).toBe(keeps)
    },
  )

  it('should tell a member of the staff who keeps the ledger', () => {
    // Assert
    expect(KEPT_BY_OTHERS).toEqual({
      en: 'Owners and managers remove customers from the ledger, merge them and read the change history.',
      ja: '台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
    })
  })
})

describe('operationNameOf', () => {
  it.each<[ModelsCustomerVersionOperationType, LocalizedText]>([
    ['baseline', { en: 'Start of the record', ja: '記録の開始' }],
    ['create', { en: 'Registered', ja: '登録' }],
    ['update', { en: 'Updated', ja: '更新' }],
    ['delete', { en: 'Removed', ja: '削除' }],
    ['restore', { en: 'Restored', ja: '復元' }],
    ['merge', { en: 'Merged', ja: '統合' }],
    ['erase', { en: 'Erased', ja: '消去' }],
  ])('should name what %s did in a word', (operation, name) => {
    // Act, Assert
    expect(operationNameOf(operation)).toEqual(name)
  })
})

describe('changerNameOf', () => {
  it.each<[string, string | null, string | null, LocalizedText | null]>([
    [
      'the account that is signed in',
      ME,
      CUSTOMER,
      { en: 'You', ja: 'あなた' },
    ],
    [
      'the account of the customer',
      CUSTOMER,
      CUSTOMER,
      { en: 'The customer', ja: 'お客様ご本人' },
    ],
    [
      'another account',
      '2b4d6f8a-0c1e-4a3b-9d5f-7b9d1f3a5c49',
      CUSTOMER,
      { en: 'Another account', ja: 'ほかのアカウント' },
    ],
    ['nobody, for the values the history began with', null, CUSTOMER, null],
    [
      'another account, for a customer who has none',
      CUSTOMER,
      null,
      { en: 'Another account', ja: 'ほかのアカウント' },
    ],
  ])('should name %s', (_case, changedBy, customer, name) => {
    // Act, Assert
    expect(changerNameOf(changedBy, { me: ME, customer })).toEqual(name)
  })

  it('should call nobody "you" while nobody is known to be signed in', () => {
    // Act, Assert
    expect(changerNameOf(ME, { me: undefined, customer: CUSTOMER })).toEqual({
      en: 'Another account',
      ja: 'ほかのアカウント',
    })
  })
})

describe('whyUnrestorable', () => {
  it.each<[Removal, LocalizedText | undefined]>([
    ['deleted', undefined],
    [
      'merged',
      {
        en: 'This customer was merged into another, so they cannot be brought back to the ledger.',
        ja: 'ほかのお客様に統合されたため、台帳に戻せません。',
      },
    ],
    [
      'erased',
      {
        en: 'This customer was erased on a deletion request, so they cannot be brought back to the ledger.',
        ja: '削除の依頼で消去されたため、台帳に戻せません。',
      },
    ],
  ])('should say whether a customer who was %s comes back', (removal, why) => {
    // Act, Assert
    expect(whyUnrestorable(removal)).toEqual(why)
  })
})

describe('afterRemoval', () => {
  it.each<[string, CustomerRemoval, ReturnType<typeof afterRemoval>]>([
    ['a removal', { type: 'removed' }, { type: 'done' }],
    [
      'a booking that is not finished',
      { type: 'unfinished' },
      {
        type: 'refused',
        message: {
          en: 'The customer has bookings that are not finished, so they could not be removed. Complete, cancel or delete those bookings, then try again.',
          ja: '終わっていない予約があるため、削除できませんでした。予約を完了、キャンセル、または削除してから、もう一度お試しください。',
        },
      },
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      {
        type: 'refused',
        message: {
          en: 'This account cannot remove customers from the ledger. Owners and managers remove customers from the ledger, merge them and read the change history.',
          ja: 'このアカウントでは、お客様を台帳から削除できません。台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
        },
      },
    ],
    ['a customer who had left', { type: 'notFound' }, { type: 'gone' }],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      { type: 'again', message: TOO_MANY },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message: {
          en: 'The customer could not be removed from the ledger. Check your connection and try again.',
          ja: 'お客様を台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
  ])('should say what follows %s', (_case, outcome, says) => {
    // Act, Assert
    expect(afterRemoval(outcome)).toEqual(says)
  })
})

describe('afterRestoration', () => {
  const customer = aCustomer()

  it.each<[string, CustomerRestoration, ReturnType<typeof afterRestoration>]>([
    [
      'a customer who came back',
      { type: 'restored', customer },
      { type: 'done', customer },
    ],
    [
      'a customer who is not one to bring back',
      { type: 'unrestorable' },
      { type: 'changed' },
    ],
    ['a customer who is not there', { type: 'notFound' }, { type: 'changed' }],
    [
      'an address of mail that another customer took',
      { type: 'emailTaken' },
      {
        type: 'emailTaken',
        message: {
          en: "A customer registered after the removal uses this customer's email address (hanako.yamada@example.com). Change that customer's email address, then bring this one back to the ledger.",
          ja: 'このお客様のメールアドレス（hanako.yamada@example.com）は、削除のあとに登録されたお客様が使っています。そのお客様のメールアドレスを変えてから、台帳に戻してください。',
        },
      },
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      {
        type: 'refused',
        message: {
          en: 'This account cannot bring customers back to the ledger. Owners and managers remove customers from the ledger, merge them and read the change history.',
          ja: 'このアカウントでは、お客様を台帳に戻せません。台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
        },
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      { type: 'refused', message: TOO_MANY },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'refused',
        message: {
          en: 'The customer could not be brought back to the ledger. Check your connection and try again.',
          ja: 'お客様を台帳に戻せませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
  ])('should say what follows %s', (_case, outcome, says) => {
    // Act, Assert
    expect(afterRestoration(outcome, 'hanako.yamada@example.com')).toEqual(says)
  })
})
