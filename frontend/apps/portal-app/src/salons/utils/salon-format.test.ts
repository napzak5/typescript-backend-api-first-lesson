import type {
  ModelsBusinessHours,
  ModelsOpeningHours,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { salon } from '../components/examples'
import {
  addressOf,
  comingDays,
  dateAt,
  dayOf,
  detailRatingsOf,
  hoursOf,
  postedOf,
  telephoneHrefOf,
  weekdayOf,
  weeklyHoursOf,
} from './salon-format'

/** A day of the calendar or of the week on which the salon does not open */
const CLOSED_ON_A_DATE = { en: 'Closed', ja: '休業' }
const CLOSED_ON_A_WEEKDAY = { en: 'Closed', ja: '定休日' }

const day = (
  date: string,
  hours: Partial<ModelsOpeningHours> = {},
): ModelsOpeningHours => ({
  dayOfWeek: 'monday',
  date,
  openTime: '10:00:00',
  closeTime: '20:00:00',
  isHoliday: false,
  holidayName: null,
  notes: null,
  ...hours,
})

const weekly = (
  hours: Partial<ModelsBusinessHours> = {},
): ModelsBusinessHours => ({
  dayOfWeek: 'monday',
  operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
  breakSlots: null,
  isClosed: false,
  effectivePeriod: null,
  ...hours,
})

const NO_DETAIL = {
  serviceRating: null,
  staffRating: null,
  atmosphereRating: null,
  cleanlinessRating: null,
  valueRating: null,
}

describe('addressOf', () => {
  it('should put the parts of the address in one line, as the salon wrote them', () => {
    expect(addressOf(salon)).toBe(
      '東京都 渋谷区 神宮前 4-1-1 こもれびビル 2 階',
    )
  })

  it('should leave out a building the salon did not name', () => {
    expect(addressOf({ ...salon, building: null })).toBe(
      '東京都 渋谷区 神宮前 4-1-1',
    )
  })
})

describe('dateAt', () => {
  it('should be the date it is at the salon, which is not the date in UTC late in the day', () => {
    // 15:30 in UTC is half past midnight of the next day in Tokyo
    const moment = new Date('2026-11-19T15:30:00.000Z')

    expect(dateAt(moment, 'Asia/Tokyo')).toBe('2026-11-20')
    expect(dateAt(moment, 'UTC')).toBe('2026-11-19')
    expect(dateAt(moment, 'America/Los_Angeles')).toBe('2026-11-19')
  })

  it('should write a month and a day of one digit with two', () => {
    expect(dateAt(new Date('2027-01-05T03:00:00.000Z'), 'Asia/Tokyo')).toBe(
      '2027-01-05',
    )
  })
})

describe('dayOf', () => {
  it('should write the day a moment falls on at the salon', () => {
    expect(dayOf('2026-11-10T14:30:00.000Z', 'Asia/Tokyo')).toEqual({
      en: 'November 10, 2026',
      ja: '2026年11月10日',
    })
    expect(dayOf('2026-11-10T15:00:00.000Z', 'Asia/Tokyo')).toEqual({
      en: 'November 11, 2026',
      ja: '2026年11月11日',
    })
    expect(dayOf('2026-11-10T15:00:00.000Z', 'Europe/London')).toEqual({
      en: 'November 10, 2026',
      ja: '2026年11月10日',
    })
  })
})

describe('weekdayOf', () => {
  it('should write the day a moment falls on at the salon, with its day of the week', () => {
    expect(weekdayOf('2026-11-20T01:00:00.000Z', 'Asia/Tokyo')).toEqual({
      en: 'Friday, November 20, 2026',
      ja: '2026年11月20日金曜日',
    })
  })

  it.each<[string, LocalizedText]>([
    [
      'Asia/Tokyo',
      { en: 'Saturday, November 21, 2026', ja: '2026年11月21日土曜日' },
    ],
    [
      'Europe/London',
      { en: 'Friday, November 20, 2026', ja: '2026年11月20日金曜日' },
    ],
    [
      'America/Los_Angeles',
      { en: 'Friday, November 20, 2026', ja: '2026年11月20日金曜日' },
    ],
  ])('should be the day it is at a salon in %s', (timezone, day) => {
    expect(weekdayOf('2026-11-20T15:00:00.000Z', timezone)).toEqual(day)
  })
})

describe('comingDays', () => {
  const DAYS = [
    day('2026-11-25'),
    day('2026-11-18'),
    day('2026-11-19'),
    day('2026-12-01'),
    day('2024-01-01'),
    day('2026-11-20'),
  ]

  it('should keep the days from today on, the nearest first', () => {
    expect(
      comingDays(DAYS, '2026-11-19', 14).map((coming) => coming.date),
    ).toEqual(['2026-11-19', '2026-11-20', '2026-11-25', '2026-12-01'])
  })

  it('should keep no more days than asked for', () => {
    expect(
      comingDays(DAYS, '2026-11-19', 2).map((coming) => coming.date),
    ).toEqual(['2026-11-19', '2026-11-20'])
  })

  it('should keep none when every day has passed', () => {
    expect(comingDays(DAYS, '2026-12-02', 14)).toEqual([])
  })

  it('should leave the days it was given as they are', () => {
    comingDays(DAYS, '2026-11-19', 14)

    expect(DAYS.at(0)?.date).toBe('2026-11-25')
  })
})

describe('hoursOf', () => {
  it('should say from when until when, without the seconds', () => {
    expect(hoursOf(day('2026-11-23'))).toEqual({
      en: '10:00–20:00',
      ja: '10:00〜20:00',
    })
  })

  it('should say that the salon is closed on a holiday, whatever times the day carries', () => {
    expect(hoursOf(day('2026-11-23', { isHoliday: true }))).toEqual(
      CLOSED_ON_A_DATE,
    )
  })

  it.each([
    ['no opening time', { openTime: null }],
    ['no closing time', { closeTime: null }],
    ['neither', { openTime: null, closeTime: null }],
  ])('should say that the salon is closed on a day with %s', (_, hours) => {
    expect(hoursOf(day('2026-11-23', hours))).toEqual(CLOSED_ON_A_DATE)
  })
})

describe('weeklyHoursOf', () => {
  it('should list the seven days from Monday on, whatever order the entries are in', () => {
    expect(
      weeklyHoursOf(
        [weekly({ dayOfWeek: 'sunday' }), weekly({ dayOfWeek: 'monday' })],
        'Asia/Tokyo',
      ).map(({ day: dayOfWeek, name }) => [dayOfWeek, name]),
    ).toEqual([
      ['monday', { en: 'Monday', ja: '月曜日' }],
      ['tuesday', { en: 'Tuesday', ja: '火曜日' }],
      ['wednesday', { en: 'Wednesday', ja: '水曜日' }],
      ['thursday', { en: 'Thursday', ja: '木曜日' }],
      ['friday', { en: 'Friday', ja: '金曜日' }],
      ['saturday', { en: 'Saturday', ja: '土曜日' }],
      ['sunday', { en: 'Sunday', ja: '日曜日' }],
    ])
  })

  const hoursOfMonday = (
    entries: ModelsBusinessHours[],
  ): LocalizedText | undefined =>
    weeklyHoursOf(entries, 'Asia/Tokyo').at(0)?.hours

  it('should say from when until when the salon is open', () => {
    expect(hoursOfMonday([weekly()])).toEqual({
      en: '10:00–20:00',
      ja: '10:00〜20:00',
    })
  })

  it('should list several slots of a day, and the breaks', () => {
    expect(
      hoursOfMonday([
        weekly({
          operatingSlots: [
            { startTime: '09:00', endTime: '12:00' },
            { startTime: '14:00:00', endTime: '18:30:00' },
          ],
          breakSlots: [
            { startTime: '10:00', endTime: '10:15' },
            { startTime: '16:00', endTime: '16:15' },
          ],
        }),
      ]),
    ).toEqual({
      en: '09:00–12:00, 14:00–18:30 (break 10:00–10:15, 16:00–16:15)',
      ja: '09:00〜12:00、14:00〜18:30（休憩 10:00〜10:15、16:00〜16:15）',
    })
  })

  it('should name no break for an empty list of breaks', () => {
    expect(hoursOfMonday([weekly({ breakSlots: [] })])).toEqual({
      en: '10:00–20:00',
      ja: '10:00〜20:00',
    })
  })

  it('should say the time the hours hold for, in the days of the salon', () => {
    expect(
      hoursOfMonday([
        weekly({
          effectivePeriod: {
            startDate: '2026-11-30T15:00:00.000Z',
            endDate: '2026-12-31T14:59:59.000Z',
          },
        }),
      ]),
    ).toEqual({
      en: '10:00–20:00 (December 1, 2026 – December 31, 2026)',
      ja: '10:00〜20:00（2026年12月1日〜2026年12月31日）',
    })
  })

  it.each([
    ['is marked as closed', [weekly({ isClosed: true })]],
    ['has no slot', [weekly({ operatingSlots: [] })]],
    ['has no entry', [weekly({ dayOfWeek: 'tuesday' })]],
  ])('should say that the salon is closed on a day that %s', (_, entries) => {
    expect(hoursOfMonday(entries)).toEqual(CLOSED_ON_A_WEEKDAY)
  })

  it('should read the first entry of a day, as the API does', () => {
    expect(
      hoursOfMonday([
        weekly({ operatingSlots: [{ startTime: '08:00', endTime: '12:00' }] }),
        weekly({ operatingSlots: [{ startTime: '13:00', endTime: '22:00' }] }),
      ]),
    ).toEqual({ en: '08:00–12:00', ja: '08:00〜12:00' })
  })

  it('should say that every day is closed for a salon without an entry', () => {
    expect(weeklyHoursOf([], 'Asia/Tokyo').map(({ hours }) => hours)).toEqual(
      Array.from({ length: 7 }, () => CLOSED_ON_A_WEEKDAY),
    )
  })
})

describe('postedOf', () => {
  it('should name a review by its title and the day it was posted', () => {
    expect(
      postedOf(
        { title: 'また行きます', createdAt: '2026-11-10T05:30:00.000Z' },
        'Asia/Tokyo',
      ),
    ).toEqual({
      en: '“また行きます” (posted November 10, 2026)',
      ja: '「また行きます」（2026年11月10日 投稿）',
    })
  })

  it('should name a review without a title by the day alone', () => {
    expect(
      postedOf(
        { title: null, createdAt: '2026-11-10T05:30:00.000Z' },
        'Asia/Tokyo',
      ),
    ).toEqual({ en: 'posted November 10, 2026', ja: '2026年11月10日 投稿' })
  })

  it('should take the day where the salon is: late in the evening in Tokyo is the next day in Auckland', () => {
    const review = { title: null, createdAt: '2026-11-10T14:30:00.000Z' }

    expect(postedOf(review, 'Asia/Tokyo')).toEqual({
      en: 'posted November 10, 2026',
      ja: '2026年11月10日 投稿',
    })
    expect(postedOf(review, 'Pacific/Auckland')).toEqual({
      en: 'posted November 11, 2026',
      ja: '2026年11月11日 投稿',
    })
  })
})

describe('telephoneHrefOf', () => {
  it.each([
    ['03-5550-0101', 'tel:0355500101'],
    ['+81-3-1234-5678', 'tel:+81312345678'],
    ['+81 90 5550 0103', 'tel:+819055500103'],
    ['(03) 5550-0101', 'tel:0355500101'],
  ])('should make of %s the address %s', (phoneNumber, href) => {
    expect(telephoneHrefOf(phoneNumber)).toBe(href)
  })
})

describe('detailRatingsOf', () => {
  it('should name every rating the customer gave, in one order', () => {
    expect(
      detailRatingsOf({
        valueRating: 4,
        cleanlinessRating: 5,
        atmosphereRating: 3,
        staffRating: 2,
        serviceRating: 1,
      }),
    ).toEqual({
      en: 'Service 1 · Staff 2 · Atmosphere 3 · Cleanliness 5 · Value 4',
      ja: 'サービス 1・スタッフ 2・雰囲気 3・清潔さ 5・価格 4',
    })
  })

  it('should leave out a rating that was not given', () => {
    expect(
      detailRatingsOf({ ...NO_DETAIL, staffRating: 5, valueRating: 3 }),
    ).toEqual({ en: 'Staff 5 · Value 3', ja: 'スタッフ 5・価格 3' })
  })

  it('should be nothing when none was given', () => {
    expect(detailRatingsOf(NO_DETAIL)).toBeNull()
  })
})
