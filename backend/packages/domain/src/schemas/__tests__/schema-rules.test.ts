import { asOneString } from '@beauty-salon-shared/i18n'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { format, isValid } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { brokenRules } from '../../__tests__/fixtures/fixtures'
import { parseWith, uuidSchema } from '../../shared'
import {
  atLeastOneProperty,
  calendarDate,
  dayOfWeekOf,
  inTimeZone,
  MAX_INTEGER,
  momentInUtc,
  momentOfRequest,
  nonBlankText,
  noRepeatedEntries,
  orderedTimeSlot,
  phoneNumber,
  timeOfDay,
  timeSlot,
  timeZoneName,
  withSeconds,
} from '../rules'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

describe('nonBlankText', () => {
  it.each([
    ['a word', 'カット'],
    ['one character', 'a'],
    ['text with spaces around it', '  Cut & Blow-dry  '],
    ['text with a space in front', ' Cut'],
    ['text that ends in a line break', 'Cut\n'],
    ['several lines', 'Cut\nColour'],
    ['text of a full-width space and a letter', '　a'],
    ['a digit', '0'],
  ])('accepts %s and keeps it as it is, untrimmed', (_case, text) => {
    expect(parseWith(nonBlankText, text, 'Invalid')).toEqual({
      type: 'success',
      data: text,
    })
  })

  it.each([
    ['the empty string', ''],
    ['one space', ' '],
    ['several spaces', '    '],
    ['a tab', '\t'],
    ['line breaks', '\n\r\n'],
    ['a mix of whitespace', ' \t\n '],
    ['a full-width space', '　'],
    ['a no-break space', ' '],
  ])('refuses %s', (_case, text) => {
    expect(rulesBrokenBy(nonBlankText, text)).toEqual([':invalid_format'])
  })

  it.each([
    ['null', null],
    ['nothing', undefined],
    ['a number', 42],
    ['a list of text', ['Cut']],
  ])('refuses %s, which is not text', (_case, value) => {
    expect(rulesBrokenBy(nonBlankText, value)).toEqual([':invalid_type'])
  })

  it('reports a text that is blank and too long for its property under both rules', () => {
    expect(rulesBrokenBy(nonBlankText.max(3), '    ')).toEqual([
      ':invalid_format',
      ':too_big',
    ])
  })
})

describe('atLeastOneProperty', () => {
  /** An update in which every property may be absent. */
  const updateSchema = z
    .strictObject({ name: z.string(), isActive: z.boolean() })
    .exactPartial()
    .check(atLeastOneProperty)

  /** A request in which a property must be present. */
  const createSchema = z
    .strictObject({ name: z.string() })
    .check(atLeastOneProperty)

  it.each([
    ['one property', { name: 'Renamed' }],
    ['every property', { name: 'Renamed', isActive: false }],
  ])('adds nothing to an object with %s', (_case, input) => {
    expect(parseWith(updateSchema, input, 'Invalid')).toEqual({
      type: 'success',
      data: input,
    })
  })

  it('adds one issue for the object as a whole when it is empty', () => {
    expect(rulesBrokenBy(updateSchema, {})).toEqual([':custom'])
  })

  it.each([
    ['a property with an invalid value', { name: 42 }, ['name:invalid_type']],
    [
      'only a property that is unknown',
      { salonId: 'abc' },
      ['salonId:unrecognized_keys'],
    ],
    [
      'an invalid and an unknown property',
      { isActive: 'no', page: 2 },
      ['isActive:invalid_type', 'page:unrecognized_keys'],
    ],
  ])(
    'adds nothing to the issues of an object with %s',
    (_case, input, expected) => {
      expect(rulesBrokenBy(updateSchema, input)).toEqual(expected)
    },
  )

  it('adds nothing when the empty object already has an issue of its own', () => {
    expect(rulesBrokenBy(createSchema, {})).toEqual(['name:invalid_type'])
  })
})

describe('noRepeatedEntries', () => {
  /** A list of text in which no entry may come twice. */
  const listSchema = z.array(z.string()).check(noRepeatedEntries)

  it.each([
    ['an empty list', []],
    ['a list of one entry', ['cut']],
    ['a list without repetitions', ['cut', 'color', 'perm']],
    ['entries that differ in case only', ['cut', 'Cut', 'CUT']],
  ])('adds nothing to %s and keeps it as it is', (_case, list) => {
    expect(parseWith(listSchema, list, 'Invalid')).toEqual({
      type: 'success',
      data: list,
    })
  })

  it('reports an entry that an earlier one equals under its own index', () => {
    expect(rulesBrokenBy(listSchema, ['cut', 'color', 'cut'])).toEqual([
      '2:custom',
    ])
  })

  it('reports each later repetition under its own index, the first occurrence not at all', () => {
    expect(
      rulesBrokenBy(listSchema, ['cut', 'cut', 'color', 'cut', 'color']),
    ).toEqual(['1:custom', '3:custom', '4:custom'])
  })

  it('reports the repetition with a message', () => {
    const result = parseWith(listSchema, ['cut', 'cut'], 'Invalid')

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: 'Invalid',
        issues: [
          {
            field: '1',
            rule: 'custom',
            message: ruleMessages.noRepeatedEntry,
          },
        ],
      },
    })
  })

  it('compares the entries as their schema reads them: a UUID in upper case repeats the same UUID in lower case', () => {
    const ids = z.array(uuidSchema).check(noRepeatedEntries)
    const id = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'

    expect(rulesBrokenBy(ids, [id, id.toUpperCase()])).toEqual(['1:custom'])
  })

  it('reports the repetitions under the path of the list within an object', () => {
    const schema = z.object({
      tags: z.array(z.string()).check(noRepeatedEntries),
    })

    expect(rulesBrokenBy(schema, { tags: ['a', 'b', 'a'] })).toEqual([
      'tags.2:custom',
    ])
  })
})

describe('phoneNumber', () => {
  it.each([
    ['exactly 10 digits', '0312345678'],
    ['digits separated by hyphens', '03-1234-5678'],
    ['digits separated by spaces', '03 1234 5678'],
    ['an international number', '+81 3 1234 5678'],
    ['an area code in parentheses', '(03)1234-5678'],
    ['20 characters', '090-1234-5678-901234'],
  ])('accepts %s and keeps it as it is', (_case, number) => {
    expect(parseWith(phoneNumber, number, 'Invalid')).toEqual({
      type: 'success',
      data: number,
    })
  })

  it.each([
    ['9 digits', '031234567', [':custom']],
    ['21 characters', '090-1234-5678-9012345', [':too_big']],
    [
      'a letter among 10 digits, which still has enough digits',
      '03-1234-5678 ext',
      [':invalid_format'],
    ],
    ['a dot as a separator', '03.1234.5678', [':invalid_format']],
    ['null', null, [':invalid_type']],
  ])('refuses %s', (_case, number, expected) => {
    expect(rulesBrokenBy(phoneNumber, number)).toEqual(expected)
  })
})

describe('inTimeZone', () => {
  const localTime = (moment: string, timeZone: string): string =>
    format(inTimeZone(new Date(moment), timeZone), 'yyyy-MM-dd HH:mm')

  it.each([
    ['Tokyo', '2026-11-20T15:00:00Z', 'Asia/Tokyo', '2026-11-21 00:00'],
    ['Tokyo', '2026-11-20T14:59:00Z', 'Asia/Tokyo', '2026-11-20 23:59'],
    ['UTC', '2026-11-20T15:00:00Z', 'UTC', '2026-11-20 15:00'],
    [
      'New York in winter',
      '2026-11-20T04:59:00Z',
      'America/New_York',
      '2026-11-19 23:59',
    ],
    [
      'New York in summer',
      '2026-07-01T04:00:00Z',
      'America/New_York',
      '2026-07-01 00:00',
    ],
    ['Kathmandu', '2026-11-20T18:15:00Z', 'Asia/Kathmandu', '2026-11-21 00:00'],
  ])(
    'tells the date and the time as the clocks show them in %s',
    (_case, moment, timeZone, expected) => {
      expect(localTime(moment, timeZone)).toBe(expected)
    },
  )

  it('is the same moment as the one it was given', () => {
    const moment = new Date('2026-11-20T15:00:00.000Z')

    expect(inTimeZone(moment, 'Asia/Tokyo').getTime()).toBe(moment.getTime())
  })

  it.each(['Mars/Olympus', '', ' ', 'Asia/Tokyo '])(
    'is no date in a time zone that is not known: "%s"',
    (timeZone) => {
      expect(isValid(inTimeZone(new Date(0), timeZone))).toBe(false)
    },
  )
})

describe('timeZoneName', () => {
  it.each([
    'Asia/Tokyo',
    'America/New_York',
    'America/Argentina/Buenos_Aires',
    'Europe/London',
    'UTC',
    'Etc/GMT+9',
    // A name that tzdata keeps as a link to Asia/Kolkata.
    'Asia/Calcutta',
  ])('accepts %s and returns it unchanged', (zone) => {
    expect(parseWith(timeZoneName, zone, 'Invalid')).toEqual({
      type: 'success',
      data: zone,
    })
  })

  it.each([
    ['a place that has no time zone of its own', 'Mars/Olympus'],
    ['a city without its region', 'Tokyo'],
    ['an offset', '+09:00'],
    ['an offset without a sign', '09:00'],
    ['a number', '9'],
    ['an empty text', ''],
    ['a blank text', ' '],
    ['a name with a space after it', 'Asia/Tokyo '],
    ['a name with a space before it', ' Asia/Tokyo'],
  ])('refuses %s', (_case, zone) => {
    expect(rulesBrokenBy(timeZoneName, zone)).toEqual([':custom'])
  })

  it('refuses what is longer than the column', () => {
    expect(rulesBrokenBy(timeZoneName, 'A'.repeat(51))).toContain(':too_big')
  })

  it.each([
    ['null', null],
    ['a number', 9],
  ])('refuses %s', (_case, zone) => {
    expect(rulesBrokenBy(timeZoneName, zone)).toEqual([':invalid_type'])
  })
})

describe('MAX_INTEGER', () => {
  it('is the largest value of a PostgreSQL integer column, 2^31 - 1', () => {
    expect(MAX_INTEGER).toBe(2_147_483_647)
    expect(MAX_INTEGER).toBe(2 ** 31 - 1)
  })
})

describe('timeOfDay', () => {
  it.each([
    ['midnight', '00:00'],
    ['the last minute of a day', '23:59'],
    ['a time with seconds', '09:30:15'],
    ['the last second of a day', '23:59:59'],
    ['an hour of 19', '19:00'],
    ['an hour of 20', '20:00'],
  ])('accepts %s and keeps it as it is', (_case, time) => {
    expect(parseWith(timeOfDay, time, 'Invalid')).toEqual({
      type: 'success',
      data: time,
    })
  })

  it.each([
    ['24:00', '24:00', [':invalid_format']],
    ['an hour of 30', '30:00', [':invalid_format']],
    ['a minute of 60', '09:60', [':invalid_format']],
    ['a second of 60', '09:00:60', [':invalid_format']],
    ['an hour of one digit', '9:00', [':invalid_format']],
    ['a minute of one digit', '09:0', [':invalid_format']],
    ['a second of one digit', '09:00:0', [':invalid_format']],
    ['hours alone', '09', [':invalid_format']],
    ['fractions of a second', '09:00:00.123', [':invalid_format']],
    ['a time zone', '09:00Z', [':invalid_format']],
    ['an offset', '09:00+09:00', [':invalid_format']],
    ['a time of 12 hours', '9:00 AM', [':invalid_format']],
    ['a space in front', ' 09:00', [':invalid_format']],
    ['a line break at the end', '09:00\n', [':invalid_format']],
    ['a date and a time', '2026-12-31T09:00', [':invalid_format']],
    ['the empty string', '', [':invalid_format']],
    ['a number', 900, [':invalid_type']],
    ['null', null, [':invalid_type']],
  ])('refuses %s', (_case, time, expected) => {
    expect(rulesBrokenBy(timeOfDay, time)).toEqual(expected)
  })
})

describe('withSeconds', () => {
  it('adds the seconds to a time without them', () => {
    expect(withSeconds('09:00')).toBe('09:00:00')
    expect(withSeconds('23:59')).toBe('23:59:00')
  })

  it('keeps a time with seconds as it is', () => {
    expect(withSeconds('09:00:30')).toBe('09:00:30')
  })

  it('puts two times in the order of the clock, whichever of them has seconds', () => {
    const times = ['10:00', '09:00:30', '09:00', '09:01', '09:00:59']

    expect(times.map(withSeconds).toSorted()).toEqual([
      '09:00:00',
      '09:00:30',
      '09:00:59',
      '09:01:00',
      '10:00:00',
    ])
  })
})

describe('dayOfWeekOf', () => {
  it.each([
    ['2026-12-28', 'monday'],
    ['2026-12-29', 'tuesday'],
    ['2026-12-30', 'wednesday'],
    ['2026-12-31', 'thursday'],
    ['2027-01-01', 'friday'],
    ['2027-01-02', 'saturday'],
    ['2027-01-03', 'sunday'],
    ['2028-02-29', 'tuesday'],
    ['1999-12-31', 'friday'],
    ['2000-01-01', 'saturday'],
  ])(
    'names the day of the week of %s as the database does: %s',
    (date, day) => {
      expect(dayOfWeekOf(date)).toBe(day)
    },
  )

  it.each([
    ['a date that does not exist', '2026-02-30'],
    ['29 February of a year that is not a leap year', '2027-02-29'],
    ['a word', 'monday'],
    ['the empty string', ''],
  ])('returns null for %s', (_case, text) => {
    expect(dayOfWeekOf(text)).toBeNull()
  })
})

describe('timeSlot', () => {
  it.each([
    ['a slot of a morning', { startTime: '09:00', endTime: '12:30' }],
    [
      'the first and the last minute of a day',
      { startTime: '00:00', endTime: '23:59' },
    ],
    [
      'a slot that ends before it begins',
      { startTime: '18:00', endTime: '09:00' },
    ],
    [
      'a slot that ends when it begins',
      { startTime: '09:00', endTime: '09:00' },
    ],
  ])('has the shape of %s', (_case, slot) => {
    expect(parseWith(timeSlot, slot, 'Invalid')).toEqual({
      type: 'success',
      data: slot,
    })
  })

  it.each<[string, unknown, string[]]>([
    [
      'a time with seconds',
      { startTime: '09:00:00', endTime: '12:00' },
      ['startTime:invalid_format'],
    ],
    [
      'a time without a leading zero',
      { startTime: '9:00', endTime: '12:00' },
      ['startTime:invalid_format'],
    ],
    [
      'an hour that no day has',
      { startTime: '09:00', endTime: '24:00' },
      ['endTime:invalid_format'],
    ],
    [
      'a minute that no hour has',
      { startTime: '09:60', endTime: '12:00' },
      ['startTime:invalid_format'],
    ],
    [
      'a time that is a number',
      { startTime: 900, endTime: '12:00' },
      ['startTime:invalid_type'],
    ],
    ['a slot without an end', { startTime: '09:00' }, ['endTime:invalid_type']],
    [
      'a slot with another property',
      { startTime: '09:00', endTime: '12:00', day: 'monday' },
      ['day:unrecognized_keys'],
    ],
    ['text', '09:00-12:00', [':invalid_type']],
    ['null', null, [':invalid_type']],
  ])('does not have the shape of %s', (_case, slot, rules) => {
    expect(rulesBrokenBy(timeSlot, slot)).toEqual(rules)
  })
})

describe('orderedTimeSlot', () => {
  it.each([
    ['a slot of one minute', { startTime: '09:00', endTime: '09:01' }],
    ['a slot of a whole day', { startTime: '00:00', endTime: '23:59' }],
  ])('accepts %s', (_case, slot) => {
    expect(parseWith(orderedTimeSlot, slot, 'Invalid')).toEqual({
      type: 'success',
      data: slot,
    })
  })

  it.each([
    ['ends when it begins', { startTime: '09:00', endTime: '09:00' }],
    ['ends before it begins', { startTime: '09:01', endTime: '09:00' }],
    [
      'ends in the morning after it began in the evening',
      { startTime: '22:00', endTime: '02:00' },
    ],
  ])('rejects a slot that %s, under its end', (_case, slot) => {
    expect(rulesBrokenBy(orderedTimeSlot, slot)).toEqual(['endTime:custom'])
  })

  it('says what the end has to be', () => {
    expect(
      parseWith(
        orderedTimeSlot,
        { startTime: '09:00', endTime: '09:00' },
        'Invalid',
      ),
    ).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: 'Invalid',
        issues: [
          {
            field: 'endTime',
            rule: 'custom',
            message: ruleMessages.laterThan('startTime'),
          },
        ],
      },
    })
  })

  it('keeps the rules of the shape', () => {
    expect(
      rulesBrokenBy(orderedTimeSlot, { startTime: '09:00', endTime: 'noon' }),
    ).toEqual(['endTime:invalid_format'])
  })
})

describe('calendarDate', () => {
  it.each(['1900-01-01', '2028-02-29', '2999-12-31'])('takes %s', (date) => {
    expect(calendarDate.safeParse(date)).toEqual({ success: true, data: date })
  })

  it.each([
    ['the day before 1900', '1899-12-31'],
    ['a day of the year 1', '0001-01-01'],
    ['a day of the year 0, which PostgreSQL does not hold', '0000-12-31'],
  ])('refuses %s as too small', (_case, date) => {
    expect(calendarDate.safeParse(date).error?.issues).toEqual([
      expect.objectContaining({
        code: 'too_small',
        path: [],
        message: asOneString(ruleMessages.notEarlierThan('1900-01-01')),
      }),
    ])
  })

  it.each([
    ['the day after 2999', '3000-01-01'],
    ['the last day of the year 9999', '9999-12-31'],
  ])('refuses %s as too big', (_case, date) => {
    expect(calendarDate.safeParse(date).error?.issues).toEqual([
      expect.objectContaining({
        code: 'too_big',
        path: [],
        message: asOneString(ruleMessages.notLaterThan('2999-12-31')),
      }),
    ])
  })

  it.each([
    '2027-02-29',
    '2027-13-01',
    '27-01-01',
    '2027-01-01T00:00:00Z',
    '+12027-01-01',
    '0000-02-30',
    '3000-02-30',
  ])('refuses %s as no day, and as nothing else', (date) => {
    expect(calendarDate.safeParse(date).error?.issues).toEqual([
      expect.objectContaining({ code: 'invalid_format' }),
    ])
  })

  it('lets the checks of the object around it run', () => {
    const period = z
      .strictObject({ from: calendarDate, until: calendarDate })
      .refine(({ from, until }) => from <= until, {
        path: ['until'],
        message: 'Must not be earlier than from',
      })

    expect(
      rulesBrokenBy(period, { from: '3000-01-02', until: '2026-01-01' }),
    ).toEqual(['from:too_big', 'until:custom'])
  })
})

describe('momentOfRequest', () => {
  it.each([
    '1900-01-01T00:00:00Z',
    '2026-11-17T09:30:00.5Z',
    '2999-12-31T23:59:59.999Z',
  ])('takes %s as it is written', (moment) => {
    expect(momentOfRequest.safeParse(moment)).toEqual({
      success: true,
      data: moment,
    })
  })

  it.each([
    ['the last moment before 1900', '1899-12-31T23:59:59.999Z'],
    ['a moment of the year 0', '0000-06-30T12:00:00Z'],
  ])('refuses %s as too small', (_case, moment) => {
    expect(momentOfRequest.safeParse(moment).error?.issues).toEqual([
      expect.objectContaining({
        code: 'too_small',
        message: asOneString(ruleMessages.notEarlierThan('1900-01-01')),
      }),
    ])
  })

  it('refuses the first moment of 3000 as too big', () => {
    expect(
      momentOfRequest.safeParse('3000-01-01T00:00:00Z').error?.issues,
    ).toEqual([
      expect.objectContaining({
        code: 'too_big',
        message: asOneString(ruleMessages.notLaterThan('2999-12-31')),
      }),
    ])
  })

  it.each(['2026-11-17T09:30:00+09:00', '2026-11-17', '0000-02-30T00:00:00Z'])(
    'refuses %s as no moment in UTC, and as nothing else',
    (moment) => {
      expect(momentOfRequest.safeParse(moment).error?.issues).toEqual([
        expect.objectContaining({ code: 'invalid_format' }),
      ])
    },
  )
})

describe('momentInUtc', () => {
  it('returns a moment in the spelling of toISOString', () => {
    expect(momentInUtc.safeParse('1900-01-01T00:00:00Z')).toEqual({
      success: true,
      data: '1900-01-01T00:00:00.000Z',
    })
  })

  it.each([
    ['1899-12-31T23:59:59Z', 'too_small'],
    ['3000-01-01T00:00:00Z', 'too_big'],
  ])('refuses %s as %s', (moment, code) => {
    expect(momentInUtc.safeParse(moment).error?.issues).toEqual([
      expect.objectContaining({ code }),
    ])
  })
})
