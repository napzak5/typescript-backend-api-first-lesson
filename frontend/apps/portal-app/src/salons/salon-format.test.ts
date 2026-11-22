import type {
  ModelsBusinessHours,
  ModelsOpeningHours,
  ModelsStaffLevelType,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { salon } from './components/examples'
import {
  addressOf,
  amountOf,
  calendarDateOf,
  comingDays,
  dateAt,
  dayOf,
  detailRatingsOf,
  durationOf,
  hoursOf,
  levelNameOf,
  postedOf,
  telephoneHrefOf,
  timeOfDayAt,
  weekdayOf,
  weeklyHoursOf,
} from './salon-format'

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

describe('levelNameOf', () => {
  const LEVELS: [ModelsStaffLevelType, string][] = [
    ['junior', 'ジュニア'],
    ['stylist', 'スタイリスト'],
    ['senior', 'シニア'],
    ['expert', 'エキスパート'],
    ['director', 'ディレクター'],
  ]

  it.each(LEVELS)('should name the level %s: %s', (level, name) => {
    expect(levelNameOf(level)).toBe(name)
  })
})

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

describe('amountOf', () => {
  it.each([
    [5500, 'JPY', '￥5,500'],
    [0, 'JPY', '￥0'],
    [1234567, 'JPY', '￥1,234,567'],
    [45.5, 'USD', '$45.50'],
    [30, 'EUR', '€30.00'],
  ])('should write %d in %s as %s', (amount, currency, written) => {
    expect(amountOf(amount, currency)).toBe(written)
  })
})

describe('durationOf', () => {
  it.each([
    [30, '30 分'],
    [45, '45 分'],
    [60, '1 時間'],
    [90, '1 時間 30 分'],
    [120, '2 時間'],
    [245, '4 時間 5 分'],
    [0, '0 分'],
  ])('should write %d minutes as %s', (minutes, written) => {
    expect(durationOf(minutes)).toBe(written)
  })
})

describe('calendarDateOf', () => {
  it.each([
    ['2026-11-23', '11月23日（月）'],
    ['2026-11-25', '11月25日（水）'],
    ['2027-01-01', '1月1日（金）'],
    ['2028-02-29', '2月29日（火）'],
  ])(
    'should write the date %s with its day of the week: %s',
    (date, written) => {
      expect(calendarDateOf(date)).toBe(written)
    },
  )
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
    expect(dayOf('2026-11-10T14:30:00.000Z', 'Asia/Tokyo')).toBe(
      '2026年11月10日',
    )
    expect(dayOf('2026-11-10T15:00:00.000Z', 'Asia/Tokyo')).toBe(
      '2026年11月11日',
    )
    expect(dayOf('2026-11-10T15:00:00.000Z', 'Europe/London')).toBe(
      '2026年11月10日',
    )
  })
})

describe('weekdayOf', () => {
  it('should write the day a moment falls on at the salon, with its day of the week', () => {
    expect(weekdayOf('2026-11-20T01:00:00.000Z', 'Asia/Tokyo')).toBe(
      '2026年11月20日金曜日',
    )
  })

  it.each([
    ['Asia/Tokyo', '2026年11月21日土曜日'],
    ['Europe/London', '2026年11月20日金曜日'],
    ['America/Los_Angeles', '2026年11月20日金曜日'],
  ])('should be the day it is at a salon in %s', (timezone, day) => {
    expect(weekdayOf('2026-11-20T15:00:00.000Z', timezone)).toBe(day)
  })
})

describe('timeOfDayAt', () => {
  it.each([
    ['Asia/Tokyo', '10:00'],
    ['Asia/Kolkata', '06:30'],
    ['Europe/London', '01:00'],
    ['America/Los_Angeles', '17:00'],
  ])('should be the time of day it is at a salon in %s', (timezone, time) => {
    expect(timeOfDayAt('2026-11-20T01:00:00.000Z', timezone)).toBe(time)
  })

  it('should write the hours and the minutes with two digits each', () => {
    expect(timeOfDayAt('2026-11-20T00:05:00.000Z', 'Asia/Tokyo')).toBe('09:05')
  })

  it('should write midnight as 00:00, and not as the 24th hour', () => {
    expect(timeOfDayAt('2026-11-20T15:00:00.000Z', 'Asia/Tokyo')).toBe('00:00')
  })

  it('should leave out the seconds', () => {
    expect(timeOfDayAt('2026-11-20T01:00:59.999Z', 'Asia/Tokyo')).toBe('10:00')
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
    expect(hoursOf(day('2026-11-23'))).toBe('10:00〜20:00')
  })

  it('should say that the salon is closed on a holiday, whatever times the day carries', () => {
    expect(hoursOf(day('2026-11-23', { isHoliday: true }))).toBe('休業')
  })

  it.each([
    ['no opening time', { openTime: null }],
    ['no closing time', { closeTime: null }],
    ['neither', { openTime: null, closeTime: null }],
  ])('should say that the salon is closed on a day with %s', (_, hours) => {
    expect(hoursOf(day('2026-11-23', hours))).toBe('休業')
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
      ['monday', '月曜日'],
      ['tuesday', '火曜日'],
      ['wednesday', '水曜日'],
      ['thursday', '木曜日'],
      ['friday', '金曜日'],
      ['saturday', '土曜日'],
      ['sunday', '日曜日'],
    ])
  })

  const hoursOfMonday = (entries: ModelsBusinessHours[]): string | undefined =>
    weeklyHoursOf(entries, 'Asia/Tokyo').at(0)?.hours

  it('should say from when until when the salon is open', () => {
    expect(hoursOfMonday([weekly()])).toBe('10:00〜20:00')
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
    ).toBe('09:00〜12:00、14:00〜18:30（休憩 10:00〜10:15、16:00〜16:15）')
  })

  it('should name no break for an empty list of breaks', () => {
    expect(hoursOfMonday([weekly({ breakSlots: [] })])).toBe('10:00〜20:00')
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
    ).toBe('10:00〜20:00（2026年12月1日〜2026年12月31日）')
  })

  it.each([
    ['is marked as closed', [weekly({ isClosed: true })]],
    ['has no slot', [weekly({ operatingSlots: [] })]],
    ['has no entry', [weekly({ dayOfWeek: 'tuesday' })]],
  ])('should say that the salon is closed on a day that %s', (_, entries) => {
    expect(hoursOfMonday(entries)).toBe('定休日')
  })

  it('should read the first entry of a day, as the API does', () => {
    expect(
      hoursOfMonday([
        weekly({ operatingSlots: [{ startTime: '08:00', endTime: '12:00' }] }),
        weekly({ operatingSlots: [{ startTime: '13:00', endTime: '22:00' }] }),
      ]),
    ).toBe('08:00〜12:00')
  })

  it('should say that every day is closed for a salon without an entry', () => {
    expect(weeklyHoursOf([], 'Asia/Tokyo').map(({ hours }) => hours)).toEqual(
      Array.from({ length: 7 }, () => '定休日'),
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
    ).toBe('「また行きます」（2026年11月10日 投稿）')
  })

  it('should name a review without a title by the day alone', () => {
    expect(
      postedOf(
        { title: null, createdAt: '2026-11-10T05:30:00.000Z' },
        'Asia/Tokyo',
      ),
    ).toBe('2026年11月10日 投稿')
  })

  it('should take the day where the salon is: late in the evening in Tokyo is the next day in Auckland', () => {
    const review = { title: null, createdAt: '2026-11-10T14:30:00.000Z' }

    expect(postedOf(review, 'Asia/Tokyo')).toBe('2026年11月10日 投稿')
    expect(postedOf(review, 'Pacific/Auckland')).toBe('2026年11月11日 投稿')
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
    ).toBe('サービス 1・スタッフ 2・雰囲気 3・清潔さ 5・価格 4')
  })

  it('should leave out a rating that was not given', () => {
    expect(
      detailRatingsOf({ ...NO_DETAIL, staffRating: 5, valueRating: 3 }),
    ).toBe('スタッフ 5・価格 3')
  })

  it('should be nothing when none was given', () => {
    expect(detailRatingsOf(NO_DETAIL)).toBeNull()
  })
})
