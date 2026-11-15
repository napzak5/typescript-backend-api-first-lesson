import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  atLeastOneProperty,
  dayOfWeekOf,
  MAX_INTEGER,
  nonBlankText,
  noRepeatedEntries,
  phoneNumber,
  timeOfDay,
  withSeconds,
} from '../schemas/rules'
import { parseWith, uuidSchema } from '../shared'
import { brokenRules } from './fixtures'

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
        issues: [{ field: '1', rule: 'custom', message: expect.any(String) }],
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
