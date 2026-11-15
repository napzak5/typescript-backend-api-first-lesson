import { describe, expect, it } from 'vitest'
import type { ApiStaffSchedule } from '../models/staff-schedule'
import {
  staffScheduleSearchRequestSchema,
  staffScheduleUpdateRequestSchema,
} from '../schemas/staff-schedule.schema'
import { parseWith } from '../shared'
import { brokenRules } from './fixtures'
import {
  dayOffEntry,
  singleDayEntry,
  weeklyEntry,
} from './staff-schedule-fixtures'

const update = (input: unknown) =>
  parseWith(staffScheduleUpdateRequestSchema, input, 'Invalid')

const search = (input: unknown) =>
  parseWith(staffScheduleSearchRequestSchema, input, 'Invalid')

/** The broken rules of a request for a replacement, as `field:rule`. */
const rulesBrokenBy = (input: unknown): string[] => {
  const result = update(input)
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** The messages of the broken rules, as `field: message`. */
const messagesFor = (input: unknown): string[] => {
  const result = update(input)
  return result.type === 'error' && result.error.type === 'validation'
    ? result.error.issues.map(({ field, message }) => `${field}: ${message}`)
    : []
}

const DAYS: ApiStaffSchedule['dayOfWeek'][] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** Entries for `count` consecutive dates from 2027-01-01 on. */
const singleDays = (count: number): ApiStaffSchedule[] =>
  Array.from({ length: count }, (_, index) =>
    singleDayEntry({
      date: new Date(Date.UTC(2027, 0, 1 + index)).toISOString().slice(0, 10),
    }),
  )

describe('staffScheduleUpdateRequestSchema', () => {
  it('accepts an empty list: a staff member without a schedule', () => {
    expect(update([])).toEqual({ type: 'success', data: [] })
  })

  it('accepts weekly entries, entries of single days and days off together, and keeps them as they are and in their order', () => {
    const request = [
      singleDayEntry(),
      weeklyEntry({ dayOfWeek: 'sunday' }),
      dayOffEntry(),
      weeklyEntry(),
      dayOffEntry({ dayOfWeek: 'wednesday', date: null, isRecurring: true }),
    ]

    expect(update(request)).toEqual({ type: 'success', data: request })
  })

  it.each([
    [
      'times without seconds',
      weeklyEntry({
        startTime: '09:00',
        endTime: '18:00',
        breakStartTime: '12:00',
        breakEndTime: '13:00',
      }),
    ],
    [
      'a working day without a break',
      weeklyEntry({ breakStartTime: null, breakEndTime: null }),
    ],
    [
      'a working day from midnight to the last second',
      weeklyEntry({
        startTime: '00:00',
        endTime: '23:59:59',
        breakStartTime: null,
        breakEndTime: null,
      }),
    ],
    [
      'a working day of one second',
      weeklyEntry({
        startTime: '09:00:00',
        endTime: '09:00:01',
        breakStartTime: null,
        breakEndTime: null,
      }),
    ],
    [
      'an end without seconds one minute after a start with seconds',
      weeklyEntry({
        startTime: '09:00:59',
        endTime: '09:01',
        breakStartTime: null,
        breakEndTime: null,
      }),
    ],
    [
      'a break one second inside the working hours on both sides',
      weeklyEntry({ breakStartTime: '09:00:01', breakEndTime: '17:59:59' }),
    ],
    [
      'a break of one second',
      weeklyEntry({ breakStartTime: '12:00:00', breakEndTime: '12:00:01' }),
    ],
    ['notes', weeklyEntry({ notes: '早番' })],
    ['notes with spaces around them', weeklyEntry({ notes: ' 早番 ' })],
    [
      'a weekly day off',
      dayOffEntry({ dayOfWeek: 'monday', date: null, isRecurring: true }),
    ],
    ['a day off without notes', dayOffEntry({ notes: null })],
    ['a date in the past', singleDayEntry({ date: '2001-01-01' })],
    ['29 February of a leap year', singleDayEntry({ date: '2028-02-29' })],
  ])('accepts %s', (_case, entry) => {
    expect(update([entry])).toEqual({ type: 'success', data: [entry] })
  })

  it('accepts a weekly entry for every day of the week', () => {
    const request = DAYS.map((dayOfWeek) => weeklyEntry({ dayOfWeek }))

    expect(update(request)).toEqual({ type: 'success', data: request })
  })

  it('accepts a weekly entry and an entry of a single day that falls on the same day of the week', () => {
    // 2026-12-28 is a Monday.
    const request = [weeklyEntry(), singleDayEntry({ date: '2026-12-28' })]

    expect(update(request)).toEqual({ type: 'success', data: request })
  })

  it('accepts 373 entries, the seven weekly ones and one for every day of a year, and no more', () => {
    const weekly = DAYS.map((dayOfWeek) => weeklyEntry({ dayOfWeek }))

    expect(update([...weekly, ...singleDays(366)])).toMatchObject({
      type: 'success',
    })
    expect(rulesBrokenBy([...weekly, ...singleDays(367)])).toEqual([':too_big'])
  })

  describe('the kind of an entry', () => {
    it.each([
      [
        'a weekly entry without a day of the week',
        weeklyEntry({ dayOfWeek: null }),
        ['0.dayOfWeek: Required for a weekly entry'],
      ],
      [
        'a weekly entry with a date',
        weeklyEntry({ date: '2026-12-28' }),
        ['0.date: Must be null for a weekly entry'],
      ],
      [
        'a weekly entry with a date instead of a day of the week',
        weeklyEntry({ dayOfWeek: null, date: '2026-12-28' }),
        [
          '0.dayOfWeek: Required for a weekly entry',
          '0.date: Must be null for a weekly entry',
        ],
      ],
      [
        'an entry of a single day without a date',
        singleDayEntry({ date: null }),
        ['0.date: Required for an entry of a single day'],
      ],
      [
        'an entry of a single day with a day of the week',
        singleDayEntry({ dayOfWeek: 'thursday' }),
        ['0.dayOfWeek: Must be null for an entry of a single day'],
      ],
      [
        'an entry of a single day with a day of the week instead of a date',
        singleDayEntry({ dayOfWeek: 'thursday', date: null }),
        [
          '0.date: Required for an entry of a single day',
          '0.dayOfWeek: Must be null for an entry of a single day',
        ],
      ],
      [
        'a weekly day off without a day of the week',
        dayOffEntry({ date: null, isRecurring: true }),
        ['0.dayOfWeek: Required for a weekly entry'],
      ],
      [
        'a day off of a single day without a date',
        dayOffEntry({ date: null }),
        ['0.date: Required for an entry of a single day'],
      ],
    ])('rejects %s', (_case, entry, messages) => {
      expect(messagesFor([entry])).toEqual(messages)
    })
  })

  describe('the hours of an entry', () => {
    it.each([
      [
        'a working day without a start',
        weeklyEntry({
          startTime: null,
          breakStartTime: null,
          breakEndTime: null,
        }),
        ['0.startTime: Required for a working day'],
      ],
      [
        'a working day without an end',
        weeklyEntry({
          endTime: null,
          breakStartTime: null,
          breakEndTime: null,
        }),
        ['0.endTime: Required for a working day'],
      ],
      [
        'a working day without hours',
        weeklyEntry({
          startTime: null,
          endTime: null,
          breakStartTime: null,
          breakEndTime: null,
        }),
        [
          '0.startTime: Required for a working day',
          '0.endTime: Required for a working day',
        ],
      ],
      [
        'a day off with a start',
        dayOffEntry({ startTime: '09:00' }),
        ['0.startTime: Must be null for a day off'],
      ],
      [
        'a day off with an end',
        dayOffEntry({ endTime: '18:00' }),
        ['0.endTime: Must be null for a day off'],
      ],
      [
        'a day off with the start of a break',
        dayOffEntry({ breakStartTime: '12:00' }),
        ['0.breakStartTime: Must be null for a day off'],
      ],
      [
        'a day off with the end of a break',
        dayOffEntry({ breakEndTime: '13:00' }),
        ['0.breakEndTime: Must be null for a day off'],
      ],
      [
        'a day off with every time, even in a wrong order',
        dayOffEntry({
          startTime: '18:00',
          endTime: '09:00',
          breakStartTime: '13:00',
          breakEndTime: '12:00',
        }),
        [
          '0.startTime: Must be null for a day off',
          '0.endTime: Must be null for a day off',
          '0.breakStartTime: Must be null for a day off',
          '0.breakEndTime: Must be null for a day off',
        ],
      ],
      [
        'an end before the start',
        weeklyEntry({
          startTime: '18:00',
          endTime: '09:00',
          breakStartTime: null,
          breakEndTime: null,
        }),
        ['0.endTime: Must be later than startTime'],
      ],
      [
        'an end at the start',
        weeklyEntry({
          startTime: '09:00',
          endTime: '09:00',
          breakStartTime: null,
          breakEndTime: null,
        }),
        ['0.endTime: Must be later than startTime'],
      ],
      [
        'an end at the start, written with seconds',
        weeklyEntry({
          startTime: '09:00',
          endTime: '09:00:00',
          breakStartTime: null,
          breakEndTime: null,
        }),
        ['0.endTime: Must be later than startTime'],
      ],
      [
        'an end without seconds before a start with seconds',
        weeklyEntry({
          startTime: '09:00:30',
          endTime: '09:00',
          breakStartTime: null,
          breakEndTime: null,
        }),
        ['0.endTime: Must be later than startTime'],
      ],
    ])('rejects %s', (_case, entry, messages) => {
      expect(messagesFor([entry])).toEqual(messages)
    })
  })

  describe('the break of an entry', () => {
    it.each([
      [
        'a break without an end',
        weeklyEntry({ breakEndTime: null }),
        ['0.breakEndTime: Required when breakStartTime is given'],
      ],
      [
        'a break without a start',
        weeklyEntry({ breakStartTime: null }),
        ['0.breakStartTime: Required when breakEndTime is given'],
      ],
      [
        'a break that starts with the working hours',
        weeklyEntry({ breakStartTime: '09:00' }),
        ['0.breakStartTime: Must be later than startTime'],
      ],
      [
        'a break that starts before the working hours',
        weeklyEntry({ breakStartTime: '08:00' }),
        ['0.breakStartTime: Must be later than startTime'],
      ],
      [
        'a break that ends with the working hours',
        weeklyEntry({ breakEndTime: '18:00' }),
        ['0.breakEndTime: Must be earlier than endTime'],
      ],
      [
        'a break that ends after the working hours',
        weeklyEntry({ breakEndTime: '19:00' }),
        ['0.breakEndTime: Must be earlier than endTime'],
      ],
      [
        'a break that ends when it starts',
        weeklyEntry({ breakStartTime: '12:00', breakEndTime: '12:00:00' }),
        ['0.breakEndTime: Must be later than breakStartTime'],
      ],
      [
        'a break that ends before it starts',
        weeklyEntry({ breakStartTime: '13:00', breakEndTime: '12:00' }),
        ['0.breakEndTime: Must be later than breakStartTime'],
      ],
      [
        'a break that is the whole working day',
        weeklyEntry({ breakStartTime: '09:00', breakEndTime: '18:00' }),
        [
          '0.breakStartTime: Must be later than startTime',
          '0.breakEndTime: Must be earlier than endTime',
        ],
      ],
      [
        'a break after the working hours',
        weeklyEntry({ breakStartTime: '19:00', breakEndTime: '20:00' }),
        ['0.breakEndTime: Must be earlier than endTime'],
      ],
      [
        'a break before the working hours',
        weeklyEntry({ breakStartTime: '07:00', breakEndTime: '08:00' }),
        ['0.breakStartTime: Must be later than startTime'],
      ],
      [
        'a break that starts after the working hours and ends before them',
        weeklyEntry({ breakStartTime: '19:00', breakEndTime: '08:00' }),
        ['0.breakEndTime: Must be later than breakStartTime'],
      ],
    ])('rejects %s', (_case, entry, messages) => {
      expect(messagesFor([entry])).toEqual(messages)
    })

    it('compares the start of a break with the start of the work even when the end of the break is missing', () => {
      expect(
        messagesFor([
          weeklyEntry({ breakStartTime: '08:00', breakEndTime: null }),
        ]),
      ).toEqual([
        '0.breakEndTime: Required when breakStartTime is given',
        '0.breakStartTime: Must be later than startTime',
      ])
    })
  })

  describe('the format of a property', () => {
    it.each([
      [
        'a time without a leading zero',
        { startTime: '9:00' },
        ['0.startTime:invalid_format'],
      ],
      ['24:00', { endTime: '24:00' }, ['0.endTime:invalid_format']],
      ['a minute of 60', { endTime: '17:60' }, ['0.endTime:invalid_format']],
      ['a second of 60', { endTime: '17:59:60' }, ['0.endTime:invalid_format']],
      [
        'a time with fractions of a second',
        { endTime: '18:00:00.5' },
        ['0.endTime:invalid_format'],
      ],
      [
        'a time with a zone',
        { endTime: '18:00Z' },
        ['0.endTime:invalid_format'],
      ],
      [
        'a time of hours alone',
        { startTime: '09' },
        ['0.startTime:invalid_format'],
      ],
      ['an empty time', { startTime: '' }, ['0.startTime:invalid_format']],
      ['a time as a number', { startTime: 9 }, ['0.startTime:invalid_type']],
      [
        'a day of the week in upper case',
        { dayOfWeek: 'MONDAY' },
        ['0.dayOfWeek:invalid_value'],
      ],
      [
        'an abbreviated day of the week',
        { dayOfWeek: 'mon' },
        ['0.dayOfWeek:invalid_value'],
      ],
      [
        'a day of the week as a number',
        { dayOfWeek: 1 },
        ['0.dayOfWeek:invalid_value'],
      ],
      [
        'isRecurring as text',
        { isRecurring: 'true' },
        ['0.isRecurring:invalid_type'],
      ],
      [
        'isRecurring as null',
        { isRecurring: null },
        ['0.isRecurring:invalid_type'],
      ],
      [
        'isAvailable as a number',
        { isAvailable: 1 },
        ['0.isAvailable:invalid_type'],
      ],
      ['empty notes', { notes: '' }, ['0.notes:invalid_format']],
      ['notes of spaces', { notes: ' \n\t' }, ['0.notes:invalid_format']],
      ['notes as a number', { notes: 5 }, ['0.notes:invalid_type']],
      [
        'an unknown property',
        { id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01' },
        ['0.id:unrecognized_keys'],
      ],
      [
        'the staff member as a property',
        { staffId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01' },
        ['0.staffId:unrecognized_keys'],
      ],
    ])('rejects %s', (_case, overrides, rules) => {
      expect(rulesBrokenBy([{ ...weeklyEntry(), ...overrides }])).toEqual(rules)
    })

    it.each(['startTime', 'endTime', 'breakStartTime', 'breakEndTime'])(
      'rejects a text that is no time as %s',
      (property) => {
        expect(
          rulesBrokenBy([{ ...weeklyEntry(), [property]: 'noon' }]),
        ).toEqual([`0.${property}:invalid_format`])
      },
    )

    it.each([
      ['a date that does not exist', '2026-02-30'],
      ['29 February of a year that is not a leap year', '2027-02-29'],
      ['a date with a time', '2026-12-31T00:00:00Z'],
      ['a date without leading zeros', '2026-1-5'],
      ['a date with slashes', '2026/12/31'],
      ['an empty date', ''],
    ])('rejects %s', (_case, date) => {
      expect(rulesBrokenBy([singleDayEntry({ date })])).toEqual([
        '0.date:invalid_format',
      ])
    })

    it('does not compare a time that is no time with the others', () => {
      expect(
        rulesBrokenBy([
          weeklyEntry({ startTime: 'early', breakStartTime: '8:00' }),
        ]),
      ).toEqual([
        '0.startTime:invalid_format',
        '0.breakStartTime:invalid_format',
      ])
      expect(rulesBrokenBy([weeklyEntry({ endTime: '1' })])).toEqual([
        '0.endTime:invalid_format',
      ])
    })

    it.each(Object.keys(weeklyEntry()))(
      'rejects an entry without %s',
      (property) => {
        const entry = Object.fromEntries(
          Object.entries(weeklyEntry()).filter(([name]) => name !== property),
        )

        expect(rulesBrokenBy([entry])).toEqual([
          expect.stringMatching(new RegExp(`^0\\.${property}:invalid_`)),
        ])
      },
    )
  })

  describe('the entries of a schedule together', () => {
    it('rejects a second weekly entry for a day of the week, under the index of the second', () => {
      expect(
        messagesFor([
          weeklyEntry(),
          weeklyEntry({ dayOfWeek: 'tuesday' }),
          weeklyEntry({ startTime: '10:00' }),
        ]),
      ).toEqual([
        '2.dayOfWeek: Must not repeat the day of the week of an earlier entry',
      ])
    })

    it('rejects a weekly day off for a day of the week that has a working entry', () => {
      expect(
        rulesBrokenBy([
          weeklyEntry(),
          dayOffEntry({ dayOfWeek: 'monday', date: null, isRecurring: true }),
        ]),
      ).toEqual(['1.dayOfWeek:custom'])
    })

    it('rejects a second entry for a date, under the index of the second', () => {
      expect(
        messagesFor([
          singleDayEntry({ date: '2026-12-24' }),
          singleDayEntry(),
          dayOffEntry(),
        ]),
      ).toEqual(['2.date: Must not repeat the date of an earlier entry'])
    })

    it('reports every repetition, each under its own index', () => {
      expect(
        rulesBrokenBy([
          weeklyEntry(),
          singleDayEntry(),
          weeklyEntry(),
          singleDayEntry(),
          weeklyEntry(),
        ]),
      ).toEqual(['2.dayOfWeek:custom', '3.date:custom', '4.dayOfWeek:custom'])
    })

    it('reports the broken rules of every entry, each under its own index', () => {
      expect(
        rulesBrokenBy([
          weeklyEntry({ endTime: '08:00' }),
          weeklyEntry({ dayOfWeek: 'tuesday' }),
          singleDayEntry({ date: null }),
        ]),
      ).toEqual(['0.endTime:custom', '0.breakEndTime:custom', '2.date:custom'])
    })

    it('reports a repetition together with the broken rules of the entries', () => {
      expect(
        rulesBrokenBy([
          weeklyEntry({ breakStartTime: '09:00' }),
          weeklyEntry({
            endTime: null,
            breakStartTime: null,
            breakEndTime: null,
          }),
          singleDayEntry({ dayOfWeek: 'thursday' }),
          singleDayEntry(),
        ]),
      ).toEqual([
        '0.breakStartTime:custom',
        '1.endTime:custom',
        '2.dayOfWeek:custom',
        '1.dayOfWeek:custom',
        '3.date:custom',
      ])
    })

    it('does not look for repetitions among entries of a wrong shape', () => {
      expect(
        rulesBrokenBy([
          weeklyEntry(),
          weeklyEntry(),
          { ...weeklyEntry(), isAvailable: 'yes' },
        ]),
      ).toEqual(['2.isAvailable:invalid_type'])
    })

    it('does not take the day of the week of entries of single days, or the date of weekly entries, for a repetition: those are reported by the rule of the entry', () => {
      expect(
        messagesFor([
          singleDayEntry({ date: '2026-12-28', dayOfWeek: 'monday' }),
          singleDayEntry({ date: '2026-12-29', dayOfWeek: 'monday' }),
          weeklyEntry({ dayOfWeek: 'tuesday', date: '2026-12-30' }),
          weeklyEntry({ dayOfWeek: 'wednesday', date: '2026-12-30' }),
        ]),
      ).toEqual([
        '0.dayOfWeek: Must be null for an entry of a single day',
        '1.dayOfWeek: Must be null for an entry of a single day',
        '2.date: Must be null for a weekly entry',
        '3.date: Must be null for a weekly entry',
      ])
    })

    it('does not take entries without their day for repetitions of each other', () => {
      expect(
        rulesBrokenBy([
          weeklyEntry({ dayOfWeek: null }),
          weeklyEntry({ dayOfWeek: null }),
          singleDayEntry({ date: null }),
          singleDayEntry({ date: null }),
        ]),
      ).toEqual([
        '0.dayOfWeek:custom',
        '1.dayOfWeek:custom',
        '2.date:custom',
        '3.date:custom',
      ])
    })
  })

  it.each([
    ['an object', { schedules: [] }, [':invalid_type']],
    ['one entry that is not in a list', weeklyEntry(), [':invalid_type']],
    ['null', null, [':invalid_type']],
    ['nothing', undefined, [':invalid_type']],
    ['text', '[]', [':invalid_type']],
    ['a list of text', ['monday'], ['0:invalid_type']],
    ['a list with null', [weeklyEntry(), null], ['1:invalid_type']],
    ['a list of lists', [[weeklyEntry()]], ['0:invalid_type']],
  ])('rejects %s', (_case, input, rules) => {
    expect(rulesBrokenBy(input)).toEqual(rules)
  })
})

describe('staffScheduleSearchRequestSchema', () => {
  it('accepts a request without a date', () => {
    expect(search({})).toEqual({ type: 'success', data: {} })
  })

  it.each([
    ['a date', '2026-12-31'],
    ['a date in the past', '1999-01-01'],
    ['29 February of a leap year', '2028-02-29'],
  ])('accepts %s and keeps it as it is', (_case, date) => {
    expect(search({ date })).toEqual({ type: 'success', data: { date } })
  })

  it.each([
    [
      'a date that does not exist',
      { date: '2026-02-30' },
      ['date:invalid_format'],
    ],
    [
      'a date with a time',
      { date: '2026-12-31T09:00:00Z' },
      ['date:invalid_format'],
    ],
    [
      'a date without leading zeros',
      { date: '2026-1-5' },
      ['date:invalid_format'],
    ],
    ['a day of the week', { date: 'monday' }, ['date:invalid_format']],
    ['an empty date', { date: '' }, ['date:invalid_format']],
    [
      'a date that is given twice',
      { date: ['2026-12-30', '2026-12-31'] },
      ['date:invalid_type'],
    ],
    ['a date that is null', { date: null }, ['date:invalid_type']],
    [
      'a date that is present without a value',
      { date: undefined },
      ['date:invalid_type'],
    ],
    [
      'a parameter of the lists with pages',
      { limit: 20 },
      ['limit:unrecognized_keys'],
    ],
    [
      'a range of dates',
      { from: '2026-12-01', to: '2026-12-31' },
      ['from:unrecognized_keys', 'to:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, input, rules) => {
    const result = search(input)

    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual(
      rules,
    )
  })
})
