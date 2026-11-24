import type {
  ModelsPointTransactionType,
  ModelsPointUseRequest,
} from '@beauty-salon-frontend/api-client'
import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { aCustomer, salon } from '../../bookings/components/examples'
import { aSale } from '../../sales/components/examples'
import { aTransaction } from '../components/examples'
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

const POINTS_ERROR = {
  en: 'Enter the points as a whole number from 1 to 2,147,483,647.',
  ja: 'ポイント数は、1 から 2,147,483,647 までの整数で入力してください。',
}

const KIND_MISSING = {
  en: 'Choose what to record.',
  ja: '記録することを選んでください。',
}

const EXPIRY_IN_THE_PAST = {
  en: 'The expiry date must be today or later.',
  ja: '有効期限は、今日以降の日付にしてください。',
}

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

  it('should offer the kinds of the counter while nobody is known to be signed in', () => {
    // Act, Assert
    expect(pointKindsFor(undefined)).toEqual(['earned', 'used'])
  })
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
  it.each<[ModelsPointTransactionType, LocalizedText]>([
    ['earned', { en: 'Given', ja: '付与' }],
    ['used', { en: 'Used', ja: '利用' }],
    ['adjusted', { en: 'Adjusted', ja: '調整' }],
    ['expired', { en: 'Expired', ja: '失効' }],
    ['transferred', { en: 'Moved by a merge', ja: '統合による移行' }],
  ])('should name a transaction of the type %s', (type, name) => {
    // Act, Assert
    expect(transactionNameOf(type)).toEqual(name)
  })
})

describe('movementOf', () => {
  it.each<[number, LocalizedText]>([
    [500, { en: '+500', ja: '+500' }],
    [-1200, { en: '−1,200', ja: '−1,200' }],
  ])('should write a movement of %i with its sign', (points, said) => {
    // Act, Assert
    expect(movementOf(points)).toEqual(said)
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

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    ['nothing', {}, { kind: KIND_MISSING, points: POINTS_ERROR }],
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
      { expiryDate: EXPIRY_IN_THE_PAST },
    ],
    [
      'a day of expiry that is no day',
      { kind: 'earned', points: '100', expiryDate: '2026-02-30' },
      {
        expiryDate: {
          en: 'Enter an expiry date from today to December 31, 2999.',
          ja: '有効期限は、今日から2999年12月31日までの日付で入力してください。',
        },
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
      errors: { kind: KIND_MISSING },
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
      name: {
        en: 'sale SL-2KQM-9F4H (Fri, November 20, 2026 at 11:02, ¥5,500)',
        ja: '売上番号 SL-2KQM-9F4H（2026年11月20日（金） 11:02、￥5,500）',
      },
    })
  })

  it.each<[string, Parameters<typeof offeredSaleOf>[0], LocalizedText]>([
    [
      'a sale of another customer',
      {
        type: 'found',
        sale: aSale({ customerId: '00000000-0000-4000-8000-000000000000' }),
      },
      {
        en: 'The sale in the address is a sale of another customer. The points will be recorded without a sale.',
        ja: 'アドレスの売上は、ほかのお客様の売上です。売上に結びつけずに記録します。',
      },
    ],
    [
      'a sale of nobody of the ledger',
      { type: 'found', sale: aSale({ customerId: null }) },
      {
        en: 'The sale in the address records no customer. The points will be recorded without a sale.',
        ja: 'アドレスの売上は、お客様を記録していない売上です。売上に結びつけずに記録します。',
      },
    ],
    [
      'a void sale',
      { type: 'found', sale: aSale({ customerId, isVoid: true }) },
      {
        en: 'The sale in the address was voided. Points cannot be given or used for a voided sale, so they will be recorded without a sale.',
        ja: 'アドレスの売上は取り消されています。取り消した売上には、ポイントを付与も利用もできないため、売上に結びつけずに記録します。',
      },
    ],
    [
      'a sale that is not found',
      { type: 'notFound' },
      {
        en: 'The sale in the address was not found. The points will be recorded without a sale.',
        ja: 'アドレスの売上が見つかりません。売上に結びつけずに記録します。',
      },
    ],
    [
      'a sale that could not be read',
      { type: 'failed' },
      {
        en: 'The sale in the address could not be loaded. To link the points to it, load it again.',
        ja: 'アドレスの売上を読み込めませんでした。売上に結びつけるときは、読み込み直してください。',
      },
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

/** What the notification says of 500 points given, which left 3,000 */
const GIVEN = {
  en: 'Gave 500 points. The balance is now 3,000 points.',
  ja: '500 ポイントを付与しました。残高は 3,000 ポイントです。',
}

describe('recordedMessageOf', () => {
  it.each<[ModelsPointTransactionType, number, LocalizedText]>([
    ['earned', 500, GIVEN],
    [
      'used',
      -500,
      {
        en: 'Recorded 500 points used. The balance is now 3,000 points.',
        ja: '500 ポイントを使いました。残高は 3,000 ポイントです。',
      },
    ],
    [
      'adjusted',
      500,
      {
        en: 'Added 500 points by an adjustment. The balance is now 3,000 points.',
        ja: '調整で500 ポイント増やしました。残高は 3,000 ポイントです。',
      },
    ],
    [
      'adjusted',
      -500,
      {
        en: 'Took away 500 points by an adjustment. The balance is now 3,000 points.',
        ja: '調整で500 ポイント減らしました。残高は 3,000 ポイントです。',
      },
    ],
    [
      'expired',
      -500,
      {
        en: 'Recorded the points. The balance is now 3,000 points.',
        ja: 'ポイントを記録しました。残高は 3,000 ポイントです。',
      },
    ],
  ])(
    'should say what a transaction of the type %s of %i points did',
    (transactionType, points, said) => {
      // Act, Assert
      expect(
        recordedMessageOf({ transactionType, points, balance: 3000 }),
      ).toEqual(said)
    },
  )
})

const AGAIN = {
  en: 'The points could not be recorded. Check your connection and try again.',
  ja: 'ポイントを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
}

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
        message: GIVEN,
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
        message: {
          en: 'This sale was not found among the sales of this customer. Clear the box that links the points to the sale, then try again.',
          ja: 'この売上は、このお客様の売上として見つかりません。売上に結びつけるチェックを外して、もう一度お試しください。',
        },
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
        errors: { expiryDate: EXPIRY_IN_THE_PAST },
      },
    ],
    [
      'a day of expiry that is too far',
      {
        type: 'invalid',
        values: [{ field: 'expiryDate', rule: 'too_big' }],
      },
      {
        type: 'again',
        message: undefined,
        errors: {
          expiryDate: {
            en: 'Enter an expiry date from today to December 31, 2999.',
            ja: '有効期限は、今日から2999年12月31日までの日付で入力してください。',
          },
        },
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
        message: {
          en: 'Points cannot be given or used for a voided sale.',
          ja: '取り消した売上には、ポイントを付与も利用もできません。',
        },
        errors: {},
      },
    ],
    [
      'a balance that is too small',
      { type: 'refused', why: { type: 'short', balance: 800 } },
      {
        type: 'again',
        message: undefined,
        errors: {
          points: {
            en: 'You cannot take away more than the balance (800 points).',
            ja: '残高（800 ポイント）より多くは減らせません。',
          },
        },
      },
    ],
    [
      'a balance that would be too large',
      { type: 'refused', why: { type: 'over' } },
      {
        type: 'again',
        message: undefined,
        errors: {
          points: {
            en: 'This cannot be recorded: the balance would go over the limit (2,147,483,647 points).',
            ja: '残高が上限（2,147,483,647 ポイント）を超えるため、記録できません。',
          },
        },
      },
    ],
    [
      'points given for the sale already',
      { type: 'refused', why: { type: 'recordedAlready', recording: 'earn' } },
      {
        type: 'again',
        message: {
          en: 'Points were already given for this sale. Check the point history.',
          ja: 'この売上には、もうポイントを付与しています。ポイントの履歴をお確かめください。',
        },
        errors: {},
      },
    ],
    [
      'points used for the sale already',
      { type: 'refused', why: { type: 'recordedAlready', recording: 'use' } },
      {
        type: 'again',
        message: {
          en: 'Points used were already recorded for this sale. Check the point history.',
          ja: 'この売上には、もう使ったポイントを記録しています。ポイントの履歴をお確かめください。',
        },
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
        message: {
          en: 'This account cannot record these points. Owners and managers adjust points.',
          ja: 'このアカウントでは、このポイントを記録できません。ポイントの調整は、オーナーとマネージャーができます。',
        },
        errors: {},
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
    expect(withBalance(aCustomer({ loyaltyPoints: 2500 }), 3000)).toEqual({
      type: 'found',
      customer: aCustomer({ loyaltyPoints: 3000 }),
    })
  })
})
