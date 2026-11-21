import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import type { BadgeTone } from '@beauty-salon-frontend/ui'
import { describe, expect, it } from 'vitest'
import {
  priceLineOf,
  statusNameOf,
  statusNoteOf,
  statusToneOf,
  totalOf,
  visitDayOf,
  whenKnownOf,
  whenLineOf,
  whenOf,
} from './booking-format'

const STATES: [ModelsBookingStatusType, string, BadgeTone][] = [
  ['draft', '下書き', 'neutral'],
  ['pending', '確定待ち', 'warning'],
  ['confirmed', '確定', 'success'],
  ['in_progress', '施術中', 'info'],
  ['completed', '完了', 'neutral'],
  ['cancelled', 'キャンセル', 'neutral'],
  ['no_show', '来店なし', 'danger'],
]

/** The states whose word says all there is to say */
const SAID_IN_A_WORD: ModelsBookingStatusType[] = [
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]

const FIXED: Parameters<typeof priceLineOf>[0] = {
  price: 5500,
  discountPrice: null,
  pricingStrategy: 'fixed',
  taxIncluded: true,
}

describe('statusNameOf and statusToneOf', () => {
  it.each(STATES)(
    'should say %s as 「%s」, in the tone %s',
    (status, name, tone) => {
      expect(statusNameOf(status)).toBe(name)
      expect(statusToneOf(status)).toBe(tone)
    },
  )
})

describe('statusNoteOf', () => {
  it('should say of a booking that waits that the salon confirms it', () => {
    expect(statusNoteOf('pending')).toBe(
      'サロンが内容を確認すると、予約が確定します。',
    )
  })

  it('should say of a draft that the salon is working on it', () => {
    expect(statusNoteOf('draft')).toBe('サロンが、予約の内容を整えています。')
  })

  it.each(SAID_IN_A_WORD)('should add nothing to the word for %s', (status) => {
    expect(statusNoteOf(status)).toBeUndefined()
  })
})

describe('whenOf', () => {
  it('should say the day with its day of the week, and from when until when, at the salon', () => {
    expect(
      whenOf(
        {
          startTime: '2026-11-24T01:30:00.000Z',
          endTime: '2026-11-24T02:30:00.000Z',
        },
        'Asia/Tokyo',
      ),
    ).toEqual({ day: '2026年11月24日火曜日', hours: '10:30〜11:30' })
  })

  it('should say the day it is at the salon, which is not that of the moment elsewhere', () => {
    const evening = {
      startTime: '2026-11-24T01:30:00.000Z',
      endTime: '2026-11-24T02:15:00.000Z',
    }

    expect(whenOf(evening, 'America/Los_Angeles')).toEqual({
      day: '2026年11月23日月曜日',
      hours: '17:30〜18:15',
    })
  })

  it('should write the hours of the morning with two digits, and midnight as 00:00', () => {
    expect(
      whenOf(
        {
          startTime: '2026-11-23T15:00:00.000Z',
          endTime: '2026-11-24T00:05:00.000Z',
        },
        'Asia/Tokyo',
      ),
    ).toEqual({ day: '2026年11月24日火曜日', hours: '00:00〜09:05' })
  })
})

describe('priceLineOf', () => {
  it('should be the amount and whether it includes the tax', () => {
    expect(priceLineOf(FIXED, 'JPY')).toBe('￥5,500（税込）')
  })

  it('should say that the tax comes on top of a price without it', () => {
    expect(priceLineOf({ ...FIXED, taxIncluded: false }, 'JPY')).toBe(
      '￥5,500（税別）',
    )
  })

  it('should be the discounted price when there is one', () => {
    expect(priceLineOf({ ...FIXED, discountPrice: 4400 }, 'JPY')).toBe(
      '￥4,400（税込）',
    )
  })

  it('should say that a price that is not fixed begins at the amount', () => {
    expect(
      priceLineOf(
        {
          ...FIXED,
          price: 8000,
          pricingStrategy: 'variable',
          taxIncluded: false,
        },
        'JPY',
      ),
    ).toBe('￥8,000〜（税別）')
  })

  it('should name no amount for a price that is agreed on in the consultation', () => {
    expect(
      priceLineOf({ ...FIXED, pricingStrategy: 'consultation_based' }, 'JPY'),
    ).toBe('要相談')
  })

  it('should be in the currency of the salon', () => {
    expect(priceLineOf({ ...FIXED, price: 55 }, 'USD')).toBe('$55.00（税込）')
  })
})

describe('totalOf', () => {
  it('should be the amount alone when no tax was added to it', () => {
    expect(totalOf({ totalAmount: 5500, taxAmount: 0 }, 'JPY')).toBe('￥5,500')
  })

  it('should name the tax that was added to the amount', () => {
    expect(totalOf({ totalAmount: 6050, taxAmount: 550 }, 'JPY')).toBe(
      '￥6,050（うち消費税 ￥550）',
    )
  })

  it('should be in the currency of the salon', () => {
    expect(totalOf({ totalAmount: 60.5, taxAmount: 5.5 }, 'USD')).toBe(
      '$60.50（うち消費税 $5.50）',
    )
  })

  it('should say that a booking costs nothing', () => {
    expect(totalOf({ totalAmount: 0, taxAmount: 0 }, 'JPY')).toBe('￥0')
  })
})

describe('visitDayOf', () => {
  it('should be the day as the booking names it, with its day of the week', () => {
    expect(visitDayOf('2026-11-24')).toBe('2026年11月24日火曜日')
  })

  it.each([
    ['the first day of a year', '2027-01-01', '2027年1月1日金曜日'],
    ['the last day of a year', '2026-12-31', '2026年12月31日木曜日'],
    ['a leap day', '2028-02-29', '2028年2月29日火曜日'],
  ])('should read %s as that day, wherever it is read', (_case, date, day) => {
    expect(visitDayOf(date)).toBe(day)
  })
})

describe('whenKnownOf', () => {
  /** 23:30 to 00:30 in Tokyo: the visit begins on the 24th there, and on the 24th in UTC as well */
  const LATE = {
    bookingDate: '2026-11-24',
    startTime: '2026-11-24T14:30:00.000Z',
    endTime: '2026-11-24T15:30:00.000Z',
  }

  it('should be the day and the hours at the salon when the time zone of the salon is known', () => {
    expect(whenKnownOf(LATE, 'Asia/Tokyo')).toEqual({
      day: '2026年11月24日火曜日',
      hours: '23:30〜00:30',
    })
  })

  it('should be the day and the hours of another salon in its time zone', () => {
    expect(
      whenKnownOf(
        { ...LATE, bookingDate: '2026-11-24' },
        'America/Los_Angeles',
      ),
    ).toEqual({ day: '2026年11月24日火曜日', hours: '06:30〜07:30' })
  })

  it('should be the day of the booking alone, and no hours, when the salon is no longer there', () => {
    expect(whenKnownOf(LATE, null)).toEqual({
      day: '2026年11月24日火曜日',
      hours: null,
    })
  })

  it('should take the day from the booking, not from its moment, when the salon is no longer there: a visit in the morning of Tokyo begins the day before in UTC', () => {
    expect(
      whenKnownOf(
        {
          bookingDate: '2026-11-25',
          startTime: '2026-11-24T23:00:00.000Z',
          endTime: '2026-11-25T00:00:00.000Z',
        },
        null,
      ),
    ).toEqual({ day: '2026年11月25日水曜日', hours: null })
  })
})

describe('whenLineOf', () => {
  const VISIT = {
    bookingDate: '2026-11-24',
    startTime: '2026-11-24T01:30:00.000Z',
    endTime: '2026-11-24T02:30:00.000Z',
  }

  it('should be the day and the hours in one line', () => {
    expect(whenLineOf(VISIT, 'Asia/Tokyo')).toBe(
      '2026年11月24日火曜日 10:30〜11:30',
    )
  })

  it('should be the day alone when the salon is no longer there', () => {
    expect(whenLineOf(VISIT, null)).toBe('2026年11月24日火曜日')
  })
})
