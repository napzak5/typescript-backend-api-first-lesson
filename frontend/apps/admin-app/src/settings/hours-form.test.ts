import type {
  ModelsBusinessHours,
  ModelsOpeningHours,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { aDescribedSalon, TODAY } from './components/examples'
import { type Hours, hoursOf } from './hours-api'
import {
  afterHoursChange,
  calendarPartsOf,
  readHoursChange,
  weekPartsOf,
} from './hours-form'

const SALON = aDescribedSalon()

/** The dates of the calendar of the example salon: one before today, a holiday it opens on, and a day off */
const PAST: ModelsOpeningHours = {
  dayOfWeek: 'friday',
  date: '2026-11-20',
  openTime: '10:00:00',
  closeTime: '20:00:00',
  isHoliday: false,
  holidayName: null,
  notes: null,
}

const HOLIDAY: ModelsOpeningHours = {
  dayOfWeek: 'monday',
  date: '2026-11-23',
  openTime: '10:00:00',
  closeTime: '17:00:00',
  isHoliday: true,
  holidayName: '勤労感謝の日',
  notes: '短縮営業',
}

const NEW_YEAR: ModelsOpeningHours = {
  dayOfWeek: 'thursday',
  date: '2026-12-31',
  openTime: null,
  closeTime: null,
  isHoliday: true,
  holidayName: '年末年始',
  notes: null,
}

const HOURS = hoursOf(SALON)

/** The values of the form of the hours of the example salon, as it opens: the week, and the dates from today on. */
const OPENED: readonly [string, string][] = [
  ['monday.opens', 'open'],
  ['monday.openTime', '10:00'],
  ['monday.closeTime', '20:00'],
  ['monday.breakStart', '13:00'],
  ['monday.breakEnd', '14:00'],
  ...['tuesday', 'wednesday', 'thursday', 'friday'].flatMap(
    (day): [string, string][] => [
      [`${day}.opens`, 'open'],
      [`${day}.openTime`, '10:00'],
      [`${day}.closeTime`, '20:00'],
      [`${day}.breakStart`, ''],
      [`${day}.breakEnd`, ''],
    ],
  ),
  ['saturday.opens', 'open'],
  ['saturday.openTime', '09:00'],
  ['saturday.closeTime', '18:00'],
  ['saturday.breakStart', ''],
  ['saturday.breakEnd', ''],
  ['sunday.opens', 'closed'],
  ['dates.0.date', '2026-11-23'],
  ['dates.0.opens', 'open'],
  ['dates.0.openTime', '10:00'],
  ['dates.0.closeTime', '17:00'],
  ['dates.0.isHoliday', 'on'],
  ['dates.0.holidayName', '勤労感謝の日'],
  ['dates.0.notes', '短縮営業'],
  ['dates.1.date', '2026-12-31'],
  ['dates.1.opens', 'closed'],
  ['dates.1.holidayName', '年末年始'],
  ['dates.1.notes', ''],
]

/**
 * The form as it opened, with the values of `changes` in place of those of
 * their names (and those not in it at its end), without the values of
 * `removed`.
 */
const formOf = (
  changes: readonly [string, string][] = [],
  removed: readonly string[] = [],
): FormData => {
  const values = new FormData()
  const given = new Map(changes)
  OPENED.filter(([name]) => !removed.includes(name)).forEach(
    ([name, value]) => {
      values.append(name, given.get(name) ?? value)
    },
  )
  changes
    .filter(([name]) => !OPENED.some(([opened]) => opened === name))
    .forEach(([name, value]) => {
      values.append(name, value)
    })

  return values
}

/** The names of the values of a row of a date */
const rowOf = (index: number): string[] =>
  [
    'date',
    'opens',
    'openTime',
    'closeTime',
    'isHoliday',
    'holidayName',
    'notes',
  ].map((property) => `dates.${index}.${property}`)

const weekOf = (
  read: ReturnType<typeof readHoursChange>,
): ModelsBusinessHours[] | null | undefined =>
  read.type === 'valid' ? read.value.businessHours : undefined

const calendarOf = (
  read: ReturnType<typeof readHoursChange>,
): ModelsOpeningHours[] | undefined =>
  read.type === 'valid' ? read.value.openingHours : undefined

const dayOf = (
  week: ModelsBusinessHours[] | null | undefined,
  day: string,
): ModelsBusinessHours | undefined =>
  week?.find(({ dayOfWeek }) => dayOfWeek === day)

describe('weekPartsOf', () => {
  it('should show the week from Monday, with the first hours and the first break of a day', () => {
    // Act
    const week = weekPartsOf(SALON.businessHours)

    // Assert
    expect(week.map(({ weekday }) => weekday)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ])
    expect(week[0]).toEqual({
      weekday: 'monday',
      opens: true,
      openTime: '10:00',
      closeTime: '20:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      more: false,
      effectivePeriod: null,
    })
    expect(week[6]).toMatchObject({ weekday: 'sunday', opens: false })
  })

  it.each<[string, ModelsBusinessHours[] | null]>([
    ['a week that is not recorded', null],
    ['a day without an entry', []],
    [
      'a day closed by its flag, although it has hours',
      [
        {
          dayOfWeek: 'monday',
          operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
          breakSlots: null,
          isClosed: true,
          effectivePeriod: null,
        },
      ],
    ],
    [
      'a day without hours',
      [
        {
          dayOfWeek: 'monday',
          operatingSlots: [],
          breakSlots: null,
          isClosed: false,
          effectivePeriod: null,
        },
      ],
    ],
  ])('should show %s closed', (_, businessHours) => {
    expect(weekPartsOf(businessHours)[0]).toMatchObject({
      weekday: 'monday',
      opens: false,
      openTime: undefined,
      closeTime: undefined,
      more: false,
    })
  })

  it('should say that a day has more hours or more breaks than the form holds, and keep its period', () => {
    // Arrange
    const period = {
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-09-30T00:00:00.000Z',
    }

    // Act
    const [monday, tuesday] = weekPartsOf([
      {
        dayOfWeek: 'monday',
        operatingSlots: [
          { startTime: '10:00', endTime: '13:00' },
          { startTime: '15:00', endTime: '20:00' },
        ],
        breakSlots: null,
        isClosed: false,
        effectivePeriod: null,
      },
      {
        dayOfWeek: 'tuesday',
        operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
        breakSlots: [
          { startTime: '12:00', endTime: '12:30' },
          { startTime: '16:00', endTime: '16:15' },
        ],
        isClosed: false,
        effectivePeriod: period,
      },
    ])

    // Assert
    expect(monday).toMatchObject({
      openTime: '10:00',
      closeTime: '13:00',
      more: true,
    })
    expect(tuesday).toMatchObject({
      breakStart: '12:00',
      breakEnd: '12:30',
      more: true,
      effectivePeriod: period,
    })
  })
})

describe('calendarPartsOf', () => {
  it('should show the dates from today on in their order, and keep those before today', () => {
    // Act
    const parts = calendarPartsOf([NEW_YEAR, HOLIDAY, PAST], TODAY)

    // Assert
    expect(parts.dates.map(({ date }) => date)).toEqual([
      '2026-11-23',
      '2026-12-31',
    ])
    expect(parts.past.map(({ date }) => date)).toEqual(['2026-11-20'])
  })

  it('should show a date that is today', () => {
    expect(
      calendarPartsOf(
        [{ ...NEW_YEAR, dayOfWeek: 'saturday', date: TODAY }],
        TODAY,
      ).dates.map(({ date }) => date),
    ).toEqual([TODAY])
  })
})

describe('readHoursChange', () => {
  describe('a form with nothing changed', () => {
    it.each<[string, FormData]>([
      ['as it opened', formOf()],
      [
        'with blanks around what was typed',
        formOf([
          ['dates.0.holidayName', ' 勤労感謝の日 '],
          ['dates.0.notes', '短縮営業\n'],
        ]),
      ],
      [
        'with its times in seconds',
        formOf([
          ['monday.openTime', '10:00:00'],
          ['dates.0.closeTime', '17:00:00'],
        ]),
      ],
      [
        'with the rows of the dates in another order',
        formOf(
          [
            ['dates.0.date', '2026-12-31'],
            ['dates.0.opens', 'closed'],
            ['dates.0.holidayName', '年末年始'],
            ['dates.0.notes', ''],
            ['dates.1.date', '2026-11-23'],
            ['dates.1.opens', 'open'],
            ['dates.1.openTime', '10:00'],
            ['dates.1.closeTime', '17:00'],
            ['dates.1.isHoliday', 'on'],
            ['dates.1.holidayName', '勤労感謝の日'],
            ['dates.1.notes', '短縮営業'],
          ],
          ['dates.0.openTime', 'dates.0.closeTime', 'dates.0.isHoliday'],
        ),
      ],
    ])('should ask for nothing %s', (_, values) => {
      expect(readHoursChange(values, HOURS, TODAY)).toEqual({
        type: 'unchanged',
      })
    })

    it('should ask for nothing of a week that is not recorded, when every day stays closed', () => {
      // Arrange
      const values = new FormData()
      for (const day of [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]) {
        values.append(`${day}.opens`, 'closed')
      }

      // Act
      const read = readHoursChange(
        values,
        { businessHours: null, openingHours: [] },
        TODAY,
      )

      // Assert
      expect(read).toEqual({ type: 'unchanged' })
    })

    it('should ask for nothing of a calendar the API listed in another order than that of its dates', () => {
      // Arrange
      const hours: Hours = { ...HOURS, openingHours: [NEW_YEAR, PAST, HOLIDAY] }

      // Act
      const read = readHoursChange(formOf(), hours, TODAY)

      // Assert
      expect(read).toEqual({ type: 'unchanged' })
    })

    it('should not send a day with more hours than the form holds while the week is not changed', () => {
      // Arrange
      const hours: Hours = {
        ...HOURS,
        businessHours: (HOURS.businessHours ?? []).map((entry) =>
          entry.dayOfWeek === 'monday'
            ? {
                ...entry,
                breakSlots: [
                  { startTime: '13:00', endTime: '14:00' },
                  { startTime: '17:00', endTime: '17:15' },
                ],
              }
            : entry,
        ),
      }

      // Act
      const read = readHoursChange(formOf(), hours, TODAY)

      // Assert
      expect(read).toEqual({ type: 'unchanged' })
    })
  })

  describe('a change of the week', () => {
    it('should send the whole week, and not the calendar, when a day of it was changed', () => {
      // Act
      const read = readHoursChange(
        formOf([['saturday.closeTime', '19:00']]),
        HOURS,
        TODAY,
      )

      // Assert
      expect(read).toEqual({
        type: 'valid',
        value: {
          businessHours: [
            {
              dayOfWeek: 'monday',
              operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
              breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
              isClosed: false,
              effectivePeriod: null,
            },
            ...['tuesday', 'wednesday', 'thursday', 'friday'].map(
              (dayOfWeek) => ({
                dayOfWeek,
                operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
                breakSlots: null,
                isClosed: false,
                effectivePeriod: null,
              }),
            ),
            {
              dayOfWeek: 'saturday',
              operatingSlots: [{ startTime: '09:00', endTime: '19:00' }],
              breakSlots: null,
              isClosed: false,
              effectivePeriod: null,
            },
            {
              dayOfWeek: 'sunday',
              operatingSlots: [],
              breakSlots: null,
              isClosed: true,
              effectivePeriod: null,
            },
          ],
        },
      })
    })

    it('should close a day, and send none of the times it still holds', () => {
      // Act
      const week = weekOf(
        readHoursChange(formOf([['monday.opens', 'closed']]), HOURS, TODAY),
      )

      // Assert
      expect(dayOf(week, 'monday')).toEqual({
        dayOfWeek: 'monday',
        operatingSlots: [],
        breakSlots: null,
        isClosed: true,
        effectivePeriod: null,
      })
    })

    it('should open a closed day, in minutes, and take a break away', () => {
      // Act
      const week = weekOf(
        readHoursChange(
          formOf([
            ['sunday.opens', 'open'],
            ['sunday.openTime', '11:00:00'],
            ['sunday.closeTime', '17:30'],
            ['sunday.breakStart', ' '],
            ['sunday.breakEnd', ''],
            ['monday.breakStart', ''],
            ['monday.breakEnd', ''],
          ]),
          HOURS,
          TODAY,
        ),
      )

      // Assert
      expect(dayOf(week, 'sunday')).toEqual({
        dayOfWeek: 'sunday',
        operatingSlots: [{ startTime: '11:00', endTime: '17:30' }],
        breakSlots: null,
        isClosed: false,
        effectivePeriod: null,
      })
      expect(dayOf(week, 'monday')?.breakSlots).toBeNull()
    })

    it('should keep the first hours and the first break of a day with more, and its period, when the week was changed', () => {
      // Arrange
      const period = {
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2027-03-31T00:00:00.000Z',
      }
      const hours: Hours = {
        ...HOURS,
        businessHours: (HOURS.businessHours ?? []).map((entry) =>
          entry.dayOfWeek === 'monday'
            ? {
                ...entry,
                operatingSlots: [
                  { startTime: '10:00', endTime: '20:00' },
                  { startTime: '21:00', endTime: '22:00' },
                ],
                effectivePeriod: period,
              }
            : entry,
        ),
      }

      // Act
      const week = weekOf(
        readHoursChange(
          formOf([['saturday.closeTime', '19:00']]),
          hours,
          TODAY,
        ),
      )

      // Assert
      expect(dayOf(week, 'monday')).toEqual({
        dayOfWeek: 'monday',
        operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
        breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
        isClosed: false,
        effectivePeriod: period,
      })
    })
  })

  describe('a change of the calendar', () => {
    it('should add a day off, and send the whole calendar in the order of its dates, the dates before today among them', () => {
      // Act
      const read = readHoursChange(
        formOf([
          ['dates.2.date', '2026-12-01'],
          ['dates.2.opens', 'closed'],
          ['dates.2.holidayName', ' 設備の点検 '],
          ['dates.2.notes', ''],
        ]),
        HOURS,
        TODAY,
      )

      // Assert
      expect(read).toEqual({
        type: 'valid',
        value: {
          openingHours: [
            PAST,
            HOLIDAY,
            {
              dayOfWeek: 'tuesday',
              date: '2026-12-01',
              openTime: null,
              closeTime: null,
              isHoliday: true,
              holidayName: '設備の点検',
              notes: null,
            },
            NEW_YEAR,
          ],
        },
      })
    })

    it('should send the times of a date that is open in seconds, and whether it is a holiday as it was ticked', () => {
      // Act
      const calendar = calendarOf(
        readHoursChange(
          formOf([
            ['dates.2.date', TODAY],
            ['dates.2.opens', 'open'],
            ['dates.2.openTime', '12:00'],
            ['dates.2.closeTime', '18:30'],
            ['dates.2.holidayName', ''],
            ['dates.2.notes', ' 午前は研修 '],
          ]),
          HOURS,
          TODAY,
        ),
      )

      // Assert
      expect(calendar?.find(({ date }) => date === TODAY)).toEqual({
        dayOfWeek: 'saturday',
        date: TODAY,
        openTime: '12:00:00',
        closeTime: '18:30:00',
        isHoliday: false,
        holidayName: null,
        notes: '午前は研修',
      })
    })

    it('should close a date that was open, and send none of its times', () => {
      // Act
      const calendar = calendarOf(
        readHoursChange(
          formOf([['dates.0.opens', 'closed']], ['dates.0.isHoliday']),
          HOURS,
          TODAY,
        ),
      )

      // Assert
      expect(calendar?.find(({ date }) => date === '2026-11-23')).toEqual({
        dayOfWeek: 'monday',
        date: '2026-11-23',
        openTime: null,
        closeTime: null,
        isHoliday: true,
        holidayName: '勤労感謝の日',
        notes: '短縮営業',
      })
    })

    it('should take a date away, and keep the dates before today', () => {
      // Act
      const read = readHoursChange(formOf([], rowOf(1)), HOURS, TODAY)

      // Assert
      expect(read).toEqual({
        type: 'valid',
        value: { openingHours: [PAST, HOLIDAY] },
      })
    })

    it('should send the week and the calendar when both were changed', () => {
      // Act
      const read = readHoursChange(
        formOf(
          [
            ['sunday.opens', 'open'],
            ['sunday.openTime', '10:00'],
            ['sunday.closeTime', '16:00'],
          ],
          rowOf(1),
        ),
        HOURS,
        TODAY,
      )

      // Assert
      expect(Object.keys(read.type === 'valid' ? read.value : {})).toEqual([
        'businessHours',
        'openingHours',
      ])
    })
  })

  describe('a form that is not sent', () => {
    it.each<[string, [string, string][], string, string]>([
      [
        'a day without its opening',
        [['monday.openTime', '']],
        'monday.openTime',
        '開店の時刻を入力してください。',
      ],
      [
        'a day without its closing',
        [['saturday.closeTime', '']],
        'saturday.closeTime',
        '閉店の時刻を入力してください。',
      ],
      [
        'a day closing when it opens',
        [['tuesday.closeTime', '10:00']],
        'tuesday.closeTime',
        '閉店は、開店より後の時刻にしてください。日付をまたぐ営業は入れられません。',
      ],
      [
        'a day closing after midnight',
        [['tuesday.closeTime', '01:00']],
        'tuesday.closeTime',
        '閉店は、開店より後の時刻にしてください。日付をまたぐ営業は入れられません。',
      ],
      [
        'a break without its end',
        [['monday.breakEnd', '']],
        'monday.breakEnd',
        '休憩の終わりの時刻も入力してください。休憩がないときは、始まりも終わりも空にします。',
      ],
      [
        'a break without its start',
        [['monday.breakStart', '']],
        'monday.breakStart',
        '休憩の始まりの時刻も入力してください。休憩がないときは、始まりも終わりも空にします。',
      ],
      [
        'a break starting at the opening',
        [['monday.breakStart', '10:00']],
        'monday.breakStart',
        '休憩は、開店より後に始めてください。',
      ],
      [
        'a break ending when it starts',
        [['monday.breakEnd', '13:00']],
        'monday.breakEnd',
        '休憩の終わりは、休憩の始まりより後の時刻にしてください。',
      ],
      [
        'a break ending at the closing',
        [['monday.breakEnd', '20:00']],
        'monday.breakEnd',
        '休憩は、閉店より前に終えてください。',
      ],
      [
        'a time that is not one',
        [['friday.openTime', '25:00']],
        'friday.openTime',
        '開店の時刻を入力してください。',
      ],
      [
        'a row without its date',
        [['dates.0.date', '']],
        'dates.0.date',
        '日付を入力してください。',
      ],
      [
        'a date beyond the years the API keeps',
        [['dates.1.date', '3000-01-01']],
        'dates.1.date',
        '日付は、1900 年 1 月 1 日から 2999 年 12 月 31 日までにしてください。',
      ],
      [
        'a date before today',
        [['dates.0.date', '2026-11-20']],
        'dates.0.date',
        '今日か、今日より後の日付を入力してください。',
      ],
      [
        'a date of an earlier row',
        [['dates.1.date', '2026-11-23']],
        'dates.1.date',
        'この日付は、1 行目と同じです。1 つの日付に入れられるのは 1 行です。',
      ],
      [
        'an open date without its opening',
        [['dates.0.openTime', '']],
        'dates.0.openTime',
        '開店の時刻を入力してください。',
      ],
      [
        'an open date closing before it opens',
        [['dates.0.closeTime', '09:00']],
        'dates.0.closeTime',
        '閉店は、開店より後の時刻にしてください。日付をまたぐ営業は入れられません。',
      ],
      [
        'a name of a holiday longer than 100 characters',
        [['dates.1.holidayName', 'あ'.repeat(101)]],
        'dates.1.holidayName',
        '祝日・休業日の名前は、100 文字までで入力してください。',
      ],
    ])(
      'should say what is wrong with %s, at its control',
      (_, changes, name, error) => {
        // Act
        const read = readHoursChange(formOf(changes), HOURS, TODAY)

        // Assert
        expect(read).toEqual({ type: 'invalid', errors: { [name]: error } })
      },
    )

    it.each<[string, [string, string][], 'valid' | 'unchanged']>([
      [
        'a name of a holiday of 100 characters',
        [['dates.1.holidayName', 'あ'.repeat(100)]],
        'valid',
      ],
      ['a date that is today', [['dates.1.date', TODAY]], 'valid'],
      [
        'a break right after the opening, ending right before the closing',
        [
          ['monday.breakStart', '10:01'],
          ['monday.breakEnd', '19:59'],
        ],
        'valid',
      ],
      // The form shows no times for a day it closes: what they held is not read
      [
        'a closed day with times left in it',
        [
          ['sunday.openTime', '20:00'],
          ['sunday.closeTime', '10:00'],
        ],
        'unchanged',
      ],
      [
        'a closed date with times left in it',
        [
          ['dates.1.openTime', '20:00'],
          ['dates.1.closeTime', '10:00'],
        ],
        'unchanged',
      ],
    ])('should take %s', (_, changes, type) => {
      expect(readHoursChange(formOf(changes), HOURS, TODAY).type).toBe(type)
    })
  })
})

describe('afterHoursChange', () => {
  it.each<[string, Parameters<typeof afterHoursChange>[0], string]>([
    [
      'hours changed meanwhile',
      { type: 'changed', hours: HOURS },
      'その間に、ほかのアカウントがこのサロンの営業時間を変えていました。このフォームの内容は、まだ保存していません。もう一度「保存する」を押すと、いまの営業時間を、このフォームの内容で置き換えます。ほかのアカウントの変更を確かめるときは、「やめる」で設定に戻ってください。',
    ],
    [
      'values the API refused',
      { type: 'invalid', values: [] },
      '入力した内容を確かめて、もう一度お試しください。',
    ],
    [
      'an email address of another salon',
      { type: 'emailTaken' },
      '入力した内容を確かめて、もう一度お試しください。',
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      'このサロンの営業時間は、変えられません。営業時間を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'a failure',
      { type: 'failed' },
      '営業時間を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])(
    'should say after %s what keeps the form from being saved',
    (_, outcome, message) => {
      expect(afterHoursChange(outcome)).toEqual({ message, errors: {} })
    },
  )
})
