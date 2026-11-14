import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { atLeastOneProperty, nonBlankText } from '../schemas/rules'
import { parseWith } from '../shared'
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
