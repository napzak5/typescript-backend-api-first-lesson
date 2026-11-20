import { describe, expect, it } from 'vitest'
import { card } from './components/examples'
import {
  afterPaymentMethodRemoval,
  afterPaymentMethodWrite,
  readPaymentMethodChange,
  readPaymentMethodEntry,
} from './payment-method-form'
import type { PaymentMethodRemoval } from './payment-methods-api'

/** The values a form holds; those that are `undefined` are not handed over, as a checkbox that is not checked */
type Values = Record<string, string | undefined>

/** The values of a form, as a browser hands them over */
const formOf = (entries: Values): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    if (value !== undefined) {
      values.append(name, value)
    }
  }
  return values
}

/** A new method as it is filled in: a code payment used at the counter */
const entryWith = (changes: Values = {}): FormData =>
  formOf({
    method: 'qr_payment',
    displayName: 'PayPay',
    description: '',
    minimumAmount: '',
    maximumAmount: '',
    fee: '',
    processorName: '',
    isOfflineEnabled: 'on',
    sortOrder: '5',
    isActive: 'on',
    ...changes,
  })

/** The form as it opens with the card of the examples, which offers no kind */
const changeWith = (changes: Values = {}): FormData =>
  formOf({
    displayName: 'クレジットカード（端末 1）',
    description:
      'VISA、Mastercard、JCB、American Express。\n分割払いは受け付けません。',
    minimumAmount: '1000',
    maximumAmount: '',
    fee: '3.24',
    processorName: '決済代行の例',
    isOfflineEnabled: 'on',
    isOnlineEnabled: 'on',
    sortOrder: '2',
    isActive: 'on',
    ...changes,
  })

const KIND_ERROR = '種類を選んでください。'
const NAME_ERROR = '表示名を、100 文字までで入力してください。'
const PROCESSOR_ERROR = '決済代行会社の名前は、100 文字までで入力してください。'
const FEE_ERROR =
  '手数料率は、0 から 100 までの数（小数は 2 桁まで）で入力してください。'
const MINIMUM_ERROR = '下限は、1 以上の円の整数で入力してください。'
const MAXIMUM_ERROR = '上限は、1 以上の円の整数で入力してください。'
const RANGE_ERROR = '上限は、下限と同じか、下限より大きい金額にしてください。'
const ORDER_ERROR = '並び順は、0 以上の整数で入力してください。'

describe('readPaymentMethodEntry', () => {
  it('should read a whole method, without the spaces around its texts, with its amounts and fee as numbers', () => {
    // Act
    const read = readPaymentMethodEntry(
      entryWith({
        displayName: '  PayPay  ',
        description: '  レジ横のコードを読んでもらいます。  ',
        minimumAmount: '１００',
        maximumAmount: '１０,０００',
        fee: '１.９８',
        processorName: '  コード決済の会社  ',
        isOnlineEnabled: 'on',
        sortOrder: '０',
      }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      request: {
        method: 'qr_payment',
        displayName: 'PayPay',
        description: 'レジ横のコードを読んでもらいます。',
        processorName: 'コード決済の会社',
        fee: 1.98,
        minimumAmount: 100,
        maximumAmount: 10000,
        isOnlineEnabled: true,
        isOfflineEnabled: true,
        sortOrder: 0,
        isActive: true,
      },
    })
  })

  it('should read what was left empty as not recorded, and what was not checked as no', () => {
    // Act
    const read = readPaymentMethodEntry(
      entryWith({
        description: '   ',
        isOfflineEnabled: undefined,
        isActive: undefined,
      }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      request: {
        method: 'qr_payment',
        displayName: 'PayPay',
        description: null,
        processorName: null,
        fee: null,
        minimumAmount: null,
        maximumAmount: null,
        isOnlineEnabled: false,
        isOfflineEnabled: false,
        sortOrder: 5,
        isActive: false,
      },
    })
  })

  it.each<[string, Values, Record<string, string>]>([
    ['no kind', { method: '' }, { method: KIND_ERROR }],
    [
      'a kind the API does not have',
      { method: 'cheque' },
      { method: KIND_ERROR },
    ],
    ['no name', { displayName: '   ' }, { displayName: NAME_ERROR }],
    [
      'a name of 101 characters',
      { displayName: 'あ'.repeat(101) },
      { displayName: NAME_ERROR },
    ],
    [
      'a company of 101 characters',
      { processorName: 'あ'.repeat(101) },
      { processorName: PROCESSOR_ERROR },
    ],
    ['a fee beyond 100', { fee: '100.01' }, { fee: FEE_ERROR }],
    ['a fee of three decimals', { fee: '1.234' }, { fee: FEE_ERROR }],
    ['a fee below 0', { fee: '-1' }, { fee: FEE_ERROR }],
    ['a fee that is no number', { fee: '3%' }, { fee: FEE_ERROR }],
    [
      'a smallest amount of 0',
      { minimumAmount: '0' },
      { minimumAmount: MINIMUM_ERROR },
    ],
    [
      'a smallest amount with a fraction',
      { minimumAmount: '1.5' },
      { minimumAmount: MINIMUM_ERROR },
    ],
    [
      'a smallest amount beyond what the API keeps',
      { minimumAmount: '2147483648' },
      { minimumAmount: MINIMUM_ERROR },
    ],
    [
      'a largest amount of 0',
      { maximumAmount: '0' },
      { maximumAmount: MAXIMUM_ERROR },
    ],
    [
      'a largest amount below the smallest',
      { minimumAmount: '2,000', maximumAmount: '1,999' },
      { maximumAmount: RANGE_ERROR },
    ],
    ['no place in the order', { sortOrder: '' }, { sortOrder: ORDER_ERROR }],
    [
      'a place in the order below 0',
      { sortOrder: '-1' },
      { sortOrder: ORDER_ERROR },
    ],
    [
      'a place in the order with a fraction',
      { sortOrder: '1.5' },
      { sortOrder: ORDER_ERROR },
    ],
    [
      'several wrong values',
      { method: '', displayName: '', fee: '101', sortOrder: 'x' },
      {
        method: KIND_ERROR,
        displayName: NAME_ERROR,
        fee: FEE_ERROR,
        sortOrder: ORDER_ERROR,
      },
    ],
  ])('should send nothing with %s, and say why', (_, changes, errors) => {
    expect(readPaymentMethodEntry(entryWith(changes))).toEqual({
      type: 'invalid',
      errors,
    })
  })

  it.each<[string, Values]>([
    ['a name of 100 characters', { displayName: 'あ'.repeat(100) }],
    ['a company of 100 characters', { processorName: 'あ'.repeat(100) }],
    ['a fee of 100', { fee: '100' }],
    ['a fee of 0', { fee: '0' }],
    ['a smallest amount of 1', { minimumAmount: '1' }],
    ['the largest amount the API keeps', { maximumAmount: '2147483647' }],
    [
      'a largest amount the same as the smallest',
      { minimumAmount: '1000', maximumAmount: '1000' },
    ],
  ])('should send %s', (_, changes) => {
    expect(readPaymentMethodEntry(entryWith(changes))).toMatchObject({
      type: 'valid',
    })
  })
})

describe('readPaymentMethodChange', () => {
  it('should ask for nothing when nothing was changed, nor when only spaces were added around', () => {
    expect([
      readPaymentMethodChange(changeWith(), card()),
      readPaymentMethodChange(
        changeWith({
          displayName: '  クレジットカード（端末 1）  ',
          processorName: ' 決済代行の例 ',
          minimumAmount: '1,000',
          fee: ' ３.２４ ',
        }),
        card(),
      ),
    ]).toEqual([{ type: 'unchanged' }, { type: 'unchanged' }])
  })

  it('should send what was changed and nothing else, and the kind never', () => {
    // Act
    const read = readPaymentMethodChange(
      changeWith({
        method: 'cash',
        displayName: 'クレジットカード',
        fee: '3.6',
        processorName: '',
        maximumAmount: '300000',
        isOnlineEnabled: undefined,
      }),
      card(),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      request: {
        displayName: 'クレジットカード',
        processorName: null,
        fee: 3.6,
        maximumAmount: 300000,
        isOnlineEnabled: false,
      },
    })
  })

  it.each<[string, Values, Record<string, unknown>]>([
    ['the description cleared', { description: '' }, { description: null }],
    [
      'the smallest amount cleared',
      { minimumAmount: '' },
      { minimumAmount: null },
    ],
    ['the fee cleared', { fee: '' }, { fee: null }],
    [
      'the counter given up',
      { isOfflineEnabled: undefined },
      { isOfflineEnabled: false },
    ],
    ['another place in the order', { sortOrder: '9' }, { sortOrder: 9 }],
    ['the method no longer used', { isActive: undefined }, { isActive: false }],
  ])('should send %s', (_, changes, request) => {
    expect(readPaymentMethodChange(changeWith(changes), card())).toEqual({
      type: 'valid',
      request,
    })
  })

  it('should send nothing with a largest amount below the smallest it keeps', () => {
    expect(
      readPaymentMethodChange(changeWith({ maximumAmount: '999' }), card()),
    ).toEqual({ type: 'invalid', errors: { maximumAmount: RANGE_ERROR } })
  })
})

describe('afterPaymentMethodWrite', () => {
  it.each<[string, { field: string; rule: string }[], Record<string, string>]>([
    [
      'a name',
      [{ field: 'displayName', rule: 'too_big' }],
      { displayName: NAME_ERROR },
    ],
    [
      'a kind',
      [{ field: 'method', rule: 'invalid_value' }],
      { method: KIND_ERROR },
    ],
    [
      'a company',
      [{ field: 'processorName', rule: 'too_big' }],
      { processorName: PROCESSOR_ERROR },
    ],
    ['a fee', [{ field: 'fee', rule: 'too_big' }], { fee: FEE_ERROR }],
    [
      'a smallest amount',
      [{ field: 'minimumAmount', rule: 'too_small' }],
      { minimumAmount: MINIMUM_ERROR },
    ],
    [
      'a largest amount',
      [{ field: 'maximumAmount', rule: 'too_small' }],
      { maximumAmount: MAXIMUM_ERROR },
    ],
    [
      'a largest amount below the smallest kept',
      [{ field: 'maximumAmount', rule: 'custom' }],
      { maximumAmount: RANGE_ERROR },
    ],
    [
      'a smallest amount beyond the largest kept',
      [{ field: 'minimumAmount', rule: 'custom' }],
      {
        minimumAmount:
          '下限は、上限と同じか、上限より小さい金額にしてください。',
      },
    ],
    [
      'a place in the order',
      [{ field: 'sortOrder', rule: 'too_small' }],
      { sortOrder: ORDER_ERROR },
    ],
    [
      'a switch',
      [{ field: 'isActive', rule: 'invalid_type' }],
      {
        isActive: 'この値は受け付けられませんでした。入力を確かめてください。',
      },
    ],
  ])(
    'should say at its control that the API refused %s',
    (_, values, errors) => {
      expect(afterPaymentMethodWrite({ type: 'invalid', values })).toEqual({
        message: undefined,
        errors,
      })
    },
  )

  it('should say above the form what the API refused that the form has no control for', () => {
    expect(
      afterPaymentMethodWrite({
        type: 'invalid',
        values: [{ field: '', rule: 'unrecognized_keys' }],
      }),
    ).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<[string, Parameters<typeof afterPaymentMethodWrite>[0], string]>([
    [
      'a refusal of the account',
      { type: 'forbidden' },
      'このサロンの支払い方法は、変えられません。支払い方法を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'a failure',
      { type: 'failed' },
      '支払い方法を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form after %s', (_, outcome, message) => {
    expect(afterPaymentMethodWrite(outcome)).toEqual({ message, errors: {} })
  })
})

describe('afterPaymentMethodRemoval', () => {
  it.each<[PaymentMethodRemoval, ReturnType<typeof afterPaymentMethodRemoval>]>(
    [
      [
        { type: 'removed' },
        { type: 'done', message: '支払い方法「現金」を削除しました。' },
      ],
      [
        { type: 'inUse' },
        {
          type: 'refused',
          message:
            '支払い方法「現金」で受け取った支払いがあるので、削除できません。使うのをやめるときは、「この支払い方法を使う」の印を外して保存してください。',
        },
      ],
      [{ type: 'notFound' }, { type: 'gone' }],
      [
        { type: 'forbidden' },
        {
          type: 'refused',
          message:
            'このサロンの支払い方法は、変えられません。支払い方法を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
        },
      ],
      [
        { type: 'tooManyRequests' },
        {
          type: 'again',
          message:
            'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
      ],
      [
        { type: 'failed' },
        {
          type: 'again',
          message:
            '支払い方法を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      ],
    ],
  )('should say after the answer %j', (outcome, said) => {
    expect(afterPaymentMethodRemoval(outcome, '現金')).toEqual(said)
  })
})
