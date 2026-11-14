import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  booleanParameter,
  listParameter,
  numberParameter,
} from '../query-parameters'

/** The codes of the rules a value breaks; empty when it is accepted. */
const rulesBrokenBy = (parameter: z.ZodType, value: unknown): string[] => {
  const parsed = parameter.safeParse(value)
  return parsed.success ? [] : parsed.error.issues.map(({ code }) => code)
}

describe('numberParameter', () => {
  it.each([
    ['a whole number', '10', 10],
    ['zero', '0', 0],
    ['a negative number', '-3', -3],
    ['a decimal number', '4.5', 4.5],
    ['leading zeros', '007', 7],
  ])('reads %s as a number', (_case, text, number) => {
    expect(numberParameter.safeParse(text)).toEqual({
      success: true,
      data: number,
    })
  })

  it.each([
    ['a word', 'ten', 'invalid_format'],
    ['an empty value', '', 'invalid_format'],
    ['exponent notation', '1e1', 'invalid_format'],
    ['a hexadecimal number', '0x10', 'invalid_format'],
    ['a number with spaces around it', ' 1 ', 'invalid_format'],
    ['a number without digits after the point', '1.', 'invalid_format'],
    ['a parameter given twice', ['1', '2'], 'invalid_type'],
  ])('rejects %s', (_case, value, rule) => {
    expect(rulesBrokenBy(numberParameter, value)).toEqual([rule])
  })
})

describe('booleanParameter', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('reads %s', (text, value) => {
    expect(booleanParameter.safeParse(text)).toEqual({
      success: true,
      data: value,
    })
  })

  it.each([
    ['upper case', 'TRUE'],
    ['a digit', '1'],
    ['yes', 'yes'],
    ['an empty value', ''],
  ])('rejects %s', (_case, text) => {
    expect(rulesBrokenBy(booleanParameter, text)).toEqual(['invalid_value'])
  })
})

describe('listParameter', () => {
  it('reads a parameter given once as a list of one', () => {
    expect(listParameter.safeParse('color')).toEqual({
      success: true,
      data: ['color'],
    })
  })

  it('reads a parameter given several times as the list of its values', () => {
    expect(listParameter.safeParse(['color', 'kids'])).toEqual({
      success: true,
      data: ['color', 'kids'],
    })
  })

  it('rejects a value that is neither text nor a list of text', () => {
    expect(rulesBrokenBy(listParameter, { color: 'red' })).not.toEqual([])
  })
})
