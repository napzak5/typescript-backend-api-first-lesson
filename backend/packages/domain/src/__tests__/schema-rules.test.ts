import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  atLeastOneProperty,
  MAX_INTEGER,
  nonBlankText,
  noRepeatedEntries,
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

describe('MAX_INTEGER', () => {
  it('is the largest value of a PostgreSQL integer column, 2^31 - 1', () => {
    expect(MAX_INTEGER).toBe(2_147_483_647)
    expect(MAX_INTEGER).toBe(2 ** 31 - 1)
  })
})
