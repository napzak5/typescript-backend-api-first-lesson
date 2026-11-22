import type {
  ModelsPointTransactionType,
  ModelsPointUseRequest,
} from '@beauty-salon-frontend/api-client'
import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { aCustomer, salon } from '../bookings/components/examples'
import { aSale } from '../sales/components/examples'
import { aTransaction } from './components/examples'
import {
  afterRecording,
  mayAdjustPoints,
  movementOf,
  offeredSaleOf,
  type PointAttempt,
  type PointContext,
  type PointKind,
  type PointRecording,
  type PointSays,
  pointKindIn,
  pointKindsFor,
  readPointRecording,
  recordedMessageOf,
  transactionNameOf,
  whyRefused,
  withBalance,
} from './points'

const { id: customerId } = aCustomer()

const SALE = aSale({ customerId })

/** What an owner records, today at the salon, with no sale */
const OWNER: PointContext = {
  customerId,
  kinds: ['earned', 'used', 'added', 'taken'],
  today: '2026-11-20',
  offeredSale: null,
}

const POINTS_ERROR =
  'ポイント数は、1 から 2,147,483,647 までの整数で入力してください。'

describe('mayAdjustPoints', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])(
    'should say whether an account of the role %s adjusts points',
    (role, may) => {
      // Act, Assert
      expect(mayAdjustPoints(role)).toBe(may)
    },
  )
})

describe('pointKindsFor', () => {
  it.each<[string, PointKind[]]>([
    ['owner', ['earned', 'used', 'added', 'taken']],
    ['staff', ['earned', 'used']],
  ])(
    'should offer an account of the role %s what it records',
    (role, kinds) => {
      // Act, Assert
      expect(pointKindsFor(role)).toEqual(kinds)
    },
  )
})

describe('pointKindIn', () => {
  it.each<[string, PointKind]>([
    ['kind=used', 'used'],
    ['kind=earned', 'earned'],
    ['kind=added', 'earned'],
    ['', 'earned'],
  ])('should open the address %s on what it asks for', (query, kind) => {
    // Act, Assert
    expect(pointKindIn(new URLSearchParams(query))).toBe(kind)
  })
})

describe('transactionNameOf', () => {
  it.each<[ModelsPointTransactionType, string]>([
    ['earned', '付与'],
    ['used', '利用'],
    ['adjusted', '調整'],
    ['expired', '失効'],
    ['transferred', '統合による移行'],
  ])('should name a transaction of the type %s', (type, name) => {
    // Act, Assert
    expect(transactionNameOf(type)).toBe(name)
  })
})

describe('movementOf', () => {
  it.each<[number, string]>([
    [500, '+500'],
    [-1200, '−1,200'],
  ])('should write a movement of %i with its sign', (points, said) => {
    // Act, Assert
    expect(movementOf(points)).toBe(said)
  })
})

describe('readPointRecording', () => {
  it('should give points with the day they expire on, and why', () => {
    // Act
    const read = readPointRecording(
      formOf({
        kind: 'earned',
        points: '５００',
        expiryDate: '2026-11-20',
        description: ' 紹介のお礼 ',
      }),
      OWNER,
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        type: 'earn',
        request: {
          customerId,
          points: 500,
          description: '紹介のお礼',
          referenceType: null,
          referenceId: null,
          expiryDate: '2026-11-20',
        },
      },
    })
  })

  it('should give points that never expire when no day is given', () => {
    // Act, Assert
    expect(
      readPointRecording(
        formOf({ kind: 'earned', points: '1,000', expiryDate: '' }),
        OWNER,
      ),
    ).toMatchObject({
      type: 'valid',
      value: { type: 'earn', request: { points: 1000, expiryDate: null } },
    })
  })

  it('should record points used for the sale whose box is checked', () => {
    // Act, Assert
    expect(
      readPointRecording(
        formOf({ kind: 'used', points: '300', saleId: SALE.id }),
        { ...OWNER, offeredSale: SALE.id },
      ),
    ).toEqual({
      type: 'valid',
      value: {
        type: 'use',
        request: {
          customerId,
          points: 300,
          description: null,
          referenceType: 'sale',
          referenceId: SALE.id,
        },
      },
    })
  })

  it.each<[string, Record<string, string>]>([
    ['its box is unchecked', { kind: 'used', points: '300' }],
    [
      'another sale is sent',
      {
        kind: 'used',
        points: '300',
        saleId: '00000000-0000-4000-8000-000000000000',
      },
    ],
  ])('should record points for no sale when %s', (_case, entries) => {
    // Act, Assert
    expect(
      readPointRecording(formOf(entries), {
        ...OWNER,
        offeredSale: SALE.id,
      }),
    ).toMatchObject({
      type: 'valid',
      value: { request: { referenceType: null, referenceId: null } },
    })
  })

  it.each<[PointKind, number]>([
    ['added', 200],
    ['taken', -200],
  ])(
    'should send an adjustment of the kind %s with its sign',
    (kind, points) => {
      // Act, Assert
      expect(
        readPointRecording(
          formOf({ kind, points: '200', expiryDate: '2026-12-31' }),
          OWNER,
        ),
      ).toEqual({
        type: 'valid',
        value: {
          type: 'adjust',
          request: {
            customerId,
            points,
            description: null,
            referenceType: null,
            referenceId: null,
          },
        },
      })
    },
  )

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'nothing',
      {},
      { kind: '記録することを選んでください。', points: POINTS_ERROR },
    ],
    ['no count', { kind: 'earned', points: '' }, { points: POINTS_ERROR }],
    [
      'a count of nought',
      { kind: 'used', points: '0' },
      { points: POINTS_ERROR },
    ],
    [
      'a count that is no whole number',
      { kind: 'used', points: '1.5' },
      { points: POINTS_ERROR },
    ],
    [
      'a negative count',
      { kind: 'used', points: '-5' },
      { points: POINTS_ERROR },
    ],
    [
      'a count above the largest',
      { kind: 'earned', points: '2147483648' },
      { points: POINTS_ERROR },
    ],
    [
      'a day of expiry before today',
      { kind: 'earned', points: '100', expiryDate: '2026-11-19' },
      { expiryDate: '有効期限は、今日以降の日付にしてください。' },
    ],
    [
      'a day of expiry that is no day',
      { kind: 'earned', points: '100', expiryDate: '2026-02-30' },
      {
        expiryDate:
          '有効期限は、今日から2999年12月31日までの日付で入力してください。',
      },
    ],
  ])('should say what is wrong with %s', (_case, entries, errors) => {
    // Act, Assert
    expect(readPointRecording(formOf(entries), OWNER)).toEqual({
      type: 'invalid',
      errors,
    })
  })

  it('should not let a member of the staff adjust', () => {
    // Act, Assert
    expect(
      readPointRecording(formOf({ kind: 'added', points: '100' }), {
        ...OWNER,
        kinds: ['earned', 'used'],
      }),
    ).toEqual({
      type: 'invalid',
      errors: { kind: '記録することを選んでください。' },
    })
  })
})

describe('offeredSaleOf', () => {
  it('should offer a sale of the customer by its number, its time and its total', () => {
    // Act, Assert
    expect(
      offeredSaleOf({ type: 'found', sale: SALE }, customerId, salon),
    ).toEqual({
      type: 'sale',
      id: SALE.id,
      name: '売上番号 SL-2KQM-9F4H（2026年11月20日（金） 11:02、￥5,500）',
    })
  })

  it.each<[string, Parameters<typeof offeredSaleOf>[0], string]>([
    [
      'a sale of another customer',
      {
        type: 'found',
        sale: aSale({ customerId: '00000000-0000-4000-8000-000000000000' }),
      },
      'アドレスの売上は、ほかのお客様の売上です。売上に結びつけずに記録します。',
    ],
    [
      'a sale of nobody of the ledger',
      { type: 'found', sale: aSale({ customerId: null }) },
      'アドレスの売上は、お客様を記録していない売上です。売上に結びつけずに記録します。',
    ],
    [
      'a void sale',
      { type: 'found', sale: aSale({ customerId, isVoid: true }) },
      'アドレスの売上は取り消されています。取り消した売上には、ポイントを付与も利用もできないため、売上に結びつけずに記録します。',
    ],
    [
      'a sale that is not found',
      { type: 'notFound' },
      'アドレスの売上が見つかりません。売上に結びつけずに記録します。',
    ],
    [
      'a sale that could not be read',
      { type: 'failed' },
      'アドレスの売上を読み込めませんでした。売上に結びつけるときは、読み込み直してください。',
    ],
  ])('should say why %s is not offered', (_case, read, why) => {
    // Act, Assert
    expect(offeredSaleOf(read, customerId, salon)).toEqual({
      type: 'unusable',
      why,
    })
  })
})

/** A recording of so many points of a kind, for the sale when it is given */
const recording = (
  type: PointRecording['type'],
  points: number,
  referenceId: string | null = null,
): PointRecording => {
  const request: ModelsPointUseRequest = {
    customerId,
    points,
    description: null,
    referenceType: referenceId === null ? null : 'sale',
    referenceId,
  }

  return type === 'earn'
    ? { type, request: { ...request, expiryDate: null } }
    : { type, request }
}

describe('whyRefused', () => {
  it.each<
    [
      string,
      PointRecording,
      number | undefined,
      { isVoid: boolean } | undefined,
      ReturnType<typeof whyRefused>,
    ]
  >([
    [
      'points used for a void sale',
      recording('use', 100, SALE.id),
      2000,
      { isVoid: true },
      { type: 'voidSale' },
    ],
    [
      'more points used than there are',
      recording('use', 2500, SALE.id),
      2000,
      { isVoid: false },
      { type: 'short', balance: 2000 },
    ],
    [
      'more points taken than there are',
      recording('adjust', -2500),
      2000,
      undefined,
      { type: 'short', balance: 2000 },
    ],
    [
      'points given above the largest balance',
      recording('earn', 2_147_483_000),
      1000,
      undefined,
      { type: 'over' },
    ],
    [
      'points given for a sale that has them',
      recording('earn', 100, SALE.id),
      2000,
      { isVoid: false },
      { type: 'recordedAlready', recording: 'earn' },
    ],
    [
      'points used for a sale that has them',
      recording('use', 100, SALE.id),
      2000,
      { isVoid: false },
      { type: 'recordedAlready', recording: 'use' },
    ],
    [
      'points given for no sale, with a balance that was not read',
      recording('earn', 100),
      undefined,
      undefined,
      { type: 'unknown' },
    ],
  ])(
    'should find out why %s were refused',
    (_case, refused, balance, sale, why) => {
      // Act, Assert
      expect(whyRefused(refused, balance, sale)).toEqual(why)
    },
  )
})

describe('recordedMessageOf', () => {
  it.each<[ModelsPointTransactionType, number, string]>([
    ['earned', 500, '500 ポイントを付与しました。残高は 3,000 ポイントです。'],
    ['used', -500, '500 ポイントを使いました。残高は 3,000 ポイントです。'],
    [
      'adjusted',
      500,
      '調整で500 ポイント増やしました。残高は 3,000 ポイントです。',
    ],
    [
      'adjusted',
      -500,
      '調整で500 ポイント減らしました。残高は 3,000 ポイントです。',
    ],
  ])(
    'should say what a transaction of the type %s of %i points did',
    (transactionType, points, said) => {
      // Act, Assert
      expect(
        recordedMessageOf({ transactionType, points, balance: 3000 }),
      ).toBe(said)
    },
  )
})

const AGAIN =
  'ポイントを記録できませんでした。通信の状態を確かめて、もう一度お試しください。'

describe('afterRecording', () => {
  it.each<[string, PointAttempt, PointSays]>([
    [
      'points recorded',
      {
        type: 'recorded',
        transaction: aTransaction({ points: 500, balance: 3000 }),
      },
      {
        type: 'done',
        message: '500 ポイントを付与しました。残高は 3,000 ポイントです。',
        balance: 3000,
      },
    ],
    [
      'a customer who left the ledger',
      {
        type: 'invalid',
        values: [{ field: 'customerId', rule: 'not_found' }],
      },
      { type: 'gone' },
    ],
    [
      'a sale that is not of the customer',
      {
        type: 'invalid',
        values: [{ field: 'referenceId', rule: 'not_found' }],
      },
      {
        type: 'again',
        message:
          'この売上は、このお客様の売上として見つかりません。売上に結びつけるチェックを外して、もう一度お試しください。',
        errors: {},
      },
    ],
    [
      'a day of expiry that is past',
      {
        type: 'invalid',
        values: [{ field: 'expiryDate', rule: 'too_small' }],
      },
      {
        type: 'again',
        message: undefined,
        errors: { expiryDate: '有効期限は、今日以降の日付にしてください。' },
      },
    ],
    [
      'a count refused',
      { type: 'invalid', values: [{ field: 'points', rule: 'too_big' }] },
      { type: 'again', message: undefined, errors: { points: POINTS_ERROR } },
    ],
    [
      'a value no control has',
      { type: 'invalid', values: [{ field: 'description', rule: 'custom' }] },
      { type: 'again', message: AGAIN, errors: {} },
    ],
    [
      'a void sale',
      { type: 'refused', why: { type: 'voidSale' } },
      {
        type: 'again',
        message: '取り消した売上には、ポイントを付与も利用もできません。',
        errors: {},
      },
    ],
    [
      'a balance that is too small',
      { type: 'refused', why: { type: 'short', balance: 800 } },
      {
        type: 'again',
        message: undefined,
        errors: { points: '残高（800 ポイント）より多くは減らせません。' },
      },
    ],
    [
      'a balance that would be too large',
      { type: 'refused', why: { type: 'over' } },
      {
        type: 'again',
        message: undefined,
        errors: {
          points:
            '残高が上限（2,147,483,647 ポイント）を超えるため、記録できません。',
        },
      },
    ],
    [
      'points given for the sale already',
      { type: 'refused', why: { type: 'recordedAlready', recording: 'earn' } },
      {
        type: 'again',
        message:
          'この売上には、もうポイントを付与しています。ポイントの履歴をお確かめください。',
        errors: {},
      },
    ],
    [
      'points used for the sale already',
      { type: 'refused', why: { type: 'recordedAlready', recording: 'use' } },
      {
        type: 'again',
        message:
          'この売上には、もう使ったポイントを記録しています。ポイントの履歴をお確かめください。',
        errors: {},
      },
    ],
    [
      'a conflict nothing explains',
      { type: 'refused', why: { type: 'unknown' } },
      { type: 'again', message: AGAIN, errors: {} },
    ],
    [
      'an account that may not',
      { type: 'forbidden' },
      {
        type: 'again',
        message:
          'このアカウントでは、このポイントを記録できません。ポイントの調整は、オーナーとマネージャーができます。',
        errors: {},
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        errors: {},
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      { type: 'again', message: AGAIN, errors: {} },
    ],
  ])('should say what came of %s', (_case, outcome, says) => {
    // Act, Assert
    expect(afterRecording(outcome)).toEqual(says)
  })
})

describe('withBalance', () => {
  it('should give the record of a customer the balance the points left, and keep the rest', () => {
    expect(
      withBalance(
        { type: 'found', customer: aCustomer({ loyaltyPoints: 2500 }) },
        3000,
      ),
    ).toEqual({
      type: 'found',
      customer: aCustomer({ loyaltyPoints: 3000 }),
    })
  })

  it.each<[string, Parameters<typeof withBalance>[0]]>([
    ['a customer who was not found', { type: 'notFound' }],
    ['a customer who was not read', { type: 'failed' }],
  ])('should leave as it is %s', (_, read) => {
    expect(withBalance(read, 3000)).toEqual(read)
  })
})
