import type { ModelsCustomerVersionOperationType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { aCustomer } from '../bookings/components/examples'
import {
  afterRemoval,
  afterRestoration,
  changerNameOf,
  mayKeepCustomers,
  operationNameOf,
  whyUnrestorable,
} from './customer-history'
import type {
  CustomerRemoval,
  CustomerRestoration,
  Removal,
} from './customer-history-api'

const ME = '6c1f0e2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b'

const CUSTOMER = '7d2a1f3b-4c5e-4f60-9b1a-2c3d4e5f6a7b'

const NOT_SENT =
  'アクセスが多すぎます。しばらくしてから、もう一度お試しください。'

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
})

describe('operationNameOf', () => {
  it.each<[ModelsCustomerVersionOperationType, string]>([
    ['baseline', '記録の開始'],
    ['create', '登録'],
    ['update', '更新'],
    ['delete', '削除'],
    ['restore', '復元'],
    ['merge', '統合'],
    ['erase', '消去'],
  ])('should name what %s did in a word', (operation, name) => {
    // Act, Assert
    expect(operationNameOf(operation)).toBe(name)
  })
})

describe('changerNameOf', () => {
  it.each<[string, string | null, string | null, string]>([
    ['the account that is signed in', ME, CUSTOMER, 'あなた'],
    ['the account of the customer', CUSTOMER, CUSTOMER, 'お客様ご本人'],
    [
      'another account',
      '2b4d6f8a-0c1e-4a3b-9d5f-7b9d1f3a5c49',
      CUSTOMER,
      'ほかのアカウント',
    ],
    ['nobody, for the values the history began with', null, CUSTOMER, ''],
    [
      'another account, for a customer who has none',
      CUSTOMER,
      null,
      'ほかのアカウント',
    ],
  ])('should name %s', (_case, changedBy, customer, name) => {
    // Act, Assert
    expect(changerNameOf(changedBy, { me: ME, customer })).toBe(name)
  })
})

describe('whyUnrestorable', () => {
  it.each<[Removal, string | undefined]>([
    ['deleted', undefined],
    ['merged', 'ほかのお客様に統合されたため、台帳に戻せません。'],
    ['erased', '削除の依頼で消去されたため、台帳に戻せません。'],
  ])('should say whether a customer who was %s comes back', (removal, why) => {
    // Act, Assert
    expect(whyUnrestorable(removal)).toBe(why)
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
        message:
          '終わっていない予約があるため、削除できませんでした。予約を完了、キャンセル、または削除してから、もう一度お試しください。',
      },
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このアカウントでは、お客様を台帳から削除できません。台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
      },
    ],
    ['a customer who had left', { type: 'notFound' }, { type: 'gone' }],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      { type: 'again', message: NOT_SENT },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message:
          'お客様を台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
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
        message:
          'このお客様のメールアドレス（hanako.yamada@example.com）は、削除のあとに登録されたお客様が使っています。そのお客様のメールアドレスを変えてから、台帳に戻してください。',
      },
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このアカウントでは、お客様を台帳に戻せません。台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      { type: 'refused', message: NOT_SENT },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'refused',
        message:
          'お客様を台帳に戻せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what follows %s', (_case, outcome, says) => {
    // Act, Assert
    expect(afterRestoration(outcome, 'hanako.yamada@example.com')).toEqual(says)
  })
})
