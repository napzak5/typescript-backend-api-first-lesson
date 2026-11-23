import type { ModelsSaleUpdateRequest } from '@beauty-salon-frontend/api-client'
import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  aPaidSale,
  aPayment,
  aSale,
  salon,
  staff,
} from '../components/examples'
import {
  afterSaleChange,
  afterVoid,
  mayUndoSales,
  readSaleChange,
  readVoid,
  type SaleChangeAttempt,
  saleMomentOf,
  type VoidAttempt,
  whyNoVoid,
  whyUnchangeable,
} from './sale-changes'

const [misaki, ken] = staff

/** The sale of the examples, entered at 11:02 on the clock of the salon, with a note */
const sale = aSale({ notes: '次回はカラーの相談' })

/** The form as it opens on the sale */
const AS_OPENED: Record<string, string> = {
  staffId: misaki?.id ?? '',
  saleDate: '2026-11-20',
  saleTime: '11:02',
  notes: '次回はカラーの相談',
}

/** A moment after the sale: 12:00 at the salon */
const NOW = new Date('2026-11-20T03:00:00.000Z')

describe('mayUndoSales', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])(
    'should say whether the role %s voids sales and gives payments back',
    (role, may) => {
      // Act, Assert
      expect(mayUndoSales(role)).toBe(may)
    },
  )
})

describe('whyUnchangeable', () => {
  it('should change a sale that is not void, whatever was paid of it', () => {
    // Act, Assert
    expect(whyUnchangeable(aPaidSale())).toBeUndefined()
  })

  it('should say that a voided sale is not changed', () => {
    // Act, Assert
    expect(whyUnchangeable(aSale({ isVoid: true }))).toEqual({
      en: 'A voided sale cannot be edited. It stays as a record of the voiding.',
      ja: '取り消した売上は、直せません。取り消しの記録として残ります。',
    })
  })
})

describe('saleMomentOf', () => {
  it.each<[string, string, string, { date: string; time: string }]>([
    [
      'the morning',
      '2026-11-20T02:02:00.000Z',
      salon.timezone,
      { date: '2026-11-20', time: '11:02' },
    ],
    [
      'a moment that is the day before in UTC',
      '2026-11-19T15:30:00.000Z',
      salon.timezone,
      { date: '2026-11-20', time: '00:30' },
    ],
    [
      'a moment at a salon of another time zone',
      '2026-11-20T02:02:00.000Z',
      'America/New_York',
      { date: '2026-11-19', time: '21:02' },
    ],
  ])(
    'should read %s on the clock of the salon',
    (_case, saleTime, timezone, shown) => {
      // Act, Assert
      expect(saleMomentOf(saleTime, timezone)).toEqual(shown)
    },
  )
})

describe('readSaleChange', () => {
  it('should ask for nothing when nothing was changed', () => {
    // Act, Assert
    expect(
      readSaleChange(formOf(AS_OPENED), sale, salon.timezone, NOW),
    ).toEqual({ type: 'unchanged' })
  })

  it('should take a note of blanks as no note on a sale without one', () => {
    // Act
    const read = readSaleChange(
      formOf({ ...AS_OPENED, notes: '  ' }),
      aSale({ notes: null }),
      salon.timezone,
      NOW,
    )

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it.each<[string, Record<string, string>, ModelsSaleUpdateRequest]>([
    ['another member', { staffId: ken?.id ?? '' }, { staffId: ken?.id ?? '' }],
    ['nobody as the member', { staffId: 'none' }, { staffId: null }],
    [
      'another note, trimmed',
      { notes: ' 次回はパーマ ' },
      { notes: '次回はパーマ' },
    ],
    ['no note', { notes: '' }, { notes: null }],
    [
      'another time of the day',
      { saleTime: '10:30' },
      { saleTime: '2026-11-20T01:30:00.000Z' },
    ],
    [
      'another day',
      { saleDate: '2026-11-19' },
      { saleTime: '2026-11-19T02:02:00.000Z' },
    ],
    [
      'the member and the time',
      { staffId: ken?.id ?? '', saleTime: '11:30' },
      { staffId: ken?.id ?? '', saleTime: '2026-11-20T02:30:00.000Z' },
    ],
  ])('should send %s, and nothing else', (_case, changed, request) => {
    // Act
    const read = readSaleChange(
      formOf({ ...AS_OPENED, ...changed }),
      sale,
      salon.timezone,
      NOW,
    )

    // Assert
    expect(read).toEqual({ type: 'valid', value: request })
  })

  it('should keep a member who is among the staff no more, when the choice is left as it is', () => {
    // Arrange
    const unlisted = aSale({ staffId: 'unlisted' })

    // Act
    const read = readSaleChange(
      formOf({ ...AS_OPENED, staffId: 'unlisted', notes: '' }),
      unlisted,
      salon.timezone,
      NOW,
    )

    // Assert
    expect(read).toEqual({ type: 'unchanged' })
  })

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    [
      'no day',
      { saleDate: '' },
      {
        saleDate: {
          en: 'Enter the date of the sale.',
          ja: '会計日を入力してください。',
        },
      },
    ],
    [
      'a day the API does not take',
      { saleDate: '1899-12-31' },
      {
        saleDate: {
          en: 'Enter the date of the sale.',
          ja: '会計日を入力してください。',
        },
      },
    ],
    [
      'no time',
      { saleTime: '' },
      {
        saleTime: {
          en: 'Enter the time of the sale.',
          ja: '会計の時刻を入力してください。',
        },
      },
    ],
    [
      'a time to come',
      { saleTime: '12:30' },
      {
        saleTime: {
          en: 'The time of the sale must be before now.',
          ja: '会計日時は、いまより前にしてください。',
        },
      },
    ],
    [
      'a day to come',
      { saleDate: '2026-11-21', saleTime: '09:00' },
      {
        saleTime: {
          en: 'The time of the sale must be before now.',
          ja: '会計日時は、いまより前にしてください。',
        },
      },
    ],
  ])('should refuse %s', (_case, changed, errors) => {
    // Act
    const read = readSaleChange(
      formOf({ ...AS_OPENED, ...changed }),
      sale,
      salon.timezone,
      NOW,
    )

    // Assert
    expect(read).toEqual({ type: 'invalid', errors })
  })

  it('should refuse a time that the clock of the salon skips', () => {
    // Arrange: the clocks of New York go from 2:00 to 3:00 on 2026-03-08
    const timezone = 'America/New_York'
    const { date, time } = saleMomentOf(sale.saleTime, timezone)

    // Act
    const read = readSaleChange(
      formOf({ ...AS_OPENED, saleDate: '2026-03-08', saleTime: '02:30' }),
      sale,
      timezone,
      NOW,
    )

    // Assert
    expect([date, time]).toEqual(['2026-11-19', '21:02'])
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        saleTime: {
          en: 'The clock of the salon skips this time on this day (daylight saving time begins). Enter another time.',
          ja: 'サロンの時計で、この日にない時刻です（夏時間の始まり）。別の時刻を入力してください。',
        },
      },
    })
  })
})

describe('afterSaleChange', () => {
  it.each<
    [
      string,
      Exclude<
        SaleChangeAttempt,
        { type: 'updated' } | { type: 'refused' } | { type: 'notFound' }
      >,
      ReturnType<typeof afterSaleChange>,
    ]
  >([
    [
      'a member removed meanwhile, at the control',
      { type: 'invalid', values: [{ field: 'staffId', rule: 'not_found' }] },
      {
        message: undefined,
        errors: {
          staffId: {
            en: 'This staff member was removed meanwhile and cannot be chosen. Choose again.',
            ja: 'このスタッフは、その間に削除されたため、選べません。選び直してください。',
          },
        },
      },
    ],
    [
      'a time the API did not take, at the control',
      {
        type: 'invalid',
        values: [{ field: 'saleTime', rule: 'invalid_format' }],
      },
      {
        message: undefined,
        errors: {
          saleTime: {
            en: 'This value was not accepted. Check what you entered.',
            ja: 'この値は受け付けられませんでした。入力を確かめてください。',
          },
        },
      },
    ],
    [
      'a value the form has no control for',
      { type: 'invalid', values: [{ field: 'customerId', rule: 'not_found' }] },
      {
        message: {
          en: 'Check what you entered and try again.',
          ja: '入力した内容を確かめて、もう一度お試しください。',
        },
        errors: {},
      },
    ],
    [
      'a time zone of the salon that is no name',
      { type: 'undated' },
      {
        message: {
          en: 'The time zone of the salon is not valid, so the date of the sale could not be set and its time was not changed. Correct the settings of the salon.',
          ja: 'サロンのタイムゾーンが正しくないため、会計日を決められず、会計日時を直せませんでした。サロンの設定を直してください。',
        },
        errors: {},
      },
    ],
    [
      'an account that may not',
      { type: 'forbidden' },
      {
        message: {
          en: 'This account cannot edit this sale.',
          ja: 'このアカウントでは、この売上を直せません。',
        },
        errors: {},
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
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
      {
        message: {
          en: 'The sale could not be saved. Check your connection and try again.',
          ja: '売上を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
        errors: {},
      },
    ],
  ])('should say %s', (_case, outcome, says) => {
    // Act, Assert
    expect(afterSaleChange(outcome)).toEqual(says)
  })
})

describe('whyNoVoid', () => {
  it.each<[string, Parameters<typeof whyNoVoid>[0], LocalizedText | undefined]>(
    [
      ['a sale with nothing received', aSale(), undefined],
      [
        'a sale whose payments were given back whole',
        aSale({
          payments: [aPayment({ status: 'refunded', refundAmount: 3000 })],
        }),
        undefined,
      ],
      [
        'a sale with a payment the API does not write',
        aSale({ payments: [aPayment({ status: 'failed' })] }),
        undefined,
      ],
      [
        'a sale that was voided',
        aSale({ isVoid: true }),
        { en: 'This sale was voided.', ja: 'この売上は、取り消されています。' },
      ],
      [
        'a sale with a payment received',
        aPaidSale(),
        {
          en: 'This sale has payments that were received, so it cannot be voided as it is. Refund every payment in full first.',
          ja: '受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。',
        },
      ],
      [
        'a sale with a payment given back in part, beside one that was received',
        aSale({
          payments: [
            aPayment(),
            aPayment({ status: 'partial_refund', refundAmount: 500 }),
          ],
        }),
        {
          en: 'A payment of this sale was partly refunded, so the sale cannot be voided. A payment is refunded once, so the rest cannot be refunded.',
          ja: '一部を返金した支払いがあるため、この売上は取り消せません。1 件の支払いの返金は 1 回で、残りは返金できません。',
        },
      ],
    ],
  )('should say whether %s is voided', (_case, voided, why) => {
    // Act, Assert
    expect(whyNoVoid(voided)).toEqual(why)
  })
})

describe('readVoid', () => {
  it('should send the reason, trimmed', () => {
    // Act, Assert
    expect(readVoid(formOf({ voidReason: ' 取り違え ' }))).toEqual({
      type: 'valid',
      value: { voidReason: '取り違え' },
    })
  })

  it.each<[string, Record<string, string>]>([
    ['no reason', {}],
    ['a reason of blanks', { voidReason: ' \n ' }],
  ])('should ask for a reason on %s', (_case, entries) => {
    // Act, Assert
    expect(readVoid(formOf(entries))).toEqual({
      type: 'invalid',
      errors: {
        voidReason: {
          en: 'Enter the reason for voiding.',
          ja: '取り消しの理由を入力してください。',
        },
      },
    })
  })
})

describe('afterVoid', () => {
  const voided = aSale({ isVoid: true })
  const paid = aPaidSale()
  const AGAIN = {
    en: 'The sale could not be voided. Check your connection and try again.',
    ja: '売上を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
  }

  it.each<[string, VoidAttempt, ReturnType<typeof afterVoid>]>([
    [
      'a voiding',
      { type: 'voided', sale: voided },
      { type: 'done', sale: voided },
    ],
    [
      'a reason the API did not take',
      { type: 'invalid', values: [{ field: 'voidReason', rule: 'custom' }] },
      {
        type: 'again',
        message: undefined,
        errors: {
          voidReason: {
            en: 'Enter the reason for voiding.',
            ja: '取り消しの理由を入力してください。',
          },
        },
      },
    ],
    [
      'a body the API did not take',
      { type: 'invalid', values: [{ field: '', rule: 'unrecognized_keys' }] },
      { type: 'again', message: AGAIN, errors: {} },
    ],
    [
      'a sale voided meanwhile',
      { type: 'refused', sale: voided },
      {
        type: 'refused',
        sale: voided,
        message: {
          en: 'This sale was voided meanwhile.',
          ja: 'この売上は、その間に取り消されていました。',
        },
      },
    ],
    [
      'a sale paid meanwhile',
      { type: 'refused', sale: paid },
      {
        type: 'refused',
        sale: paid,
        message: {
          en: 'The payments of this sale changed meanwhile. This sale has payments that were received, so it cannot be voided as it is. Refund every payment in full first.',
          ja: 'その間に、この売上の支払いが変わりました。受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。',
        },
      },
    ],
    [
      'a refusal the sale read again does not explain',
      { type: 'refused', sale: aSale() },
      { type: 'again', message: AGAIN, errors: {} },
    ],
    ['a sale that is gone', { type: 'notFound' }, { type: 'gone' }],
    [
      'an account that may not',
      { type: 'forbidden' },
      {
        type: 'again',
        message: {
          en: 'This account cannot void sales. Owners and managers void sales and record refunds.',
          ja: 'このアカウントでは、売上を取り消せません。売上の取り消しと返金は、オーナーとマネージャーができます。',
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
  ])('should follow %s', (_case, outcome, says) => {
    // Act, Assert
    expect(afterVoid(outcome)).toEqual(says)
  })
})
