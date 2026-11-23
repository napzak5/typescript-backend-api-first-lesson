import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  booleanParameter,
  listParameter,
  numberParameter,
  queryDecoder,
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

describe('queryDecoder', () => {
  const HEADLINE: LocalizedText = {
    en: 'Invalid visit search',
    ja: '来店の検索の条件が正しくありません',
  }
  const schema = z.looseObject({
    limit: numberParameter.exactOptional(),
    isOpen: booleanParameter.exactOptional(),
  })

  it('should give the parameters their types and leave the others as they are', () => {
    // Act
    const decoded = queryDecoder(
      schema,
      HEADLINE,
    )({ limit: '20', isOpen: 'true', keyword: 'cut' })

    // Assert
    expect(decoded).toEqual({
      type: 'success',
      data: { limit: 20, isOpen: true, keyword: 'cut' },
    })
  })

  it('should say of a parameter that is of no type of its own what its rule says in every language, under the headline it was given', () => {
    // Act
    const decoded = queryDecoder(
      schema,
      HEADLINE,
    )({ limit: 'ten', isOpen: 'yes' })

    // Assert
    expect(decoded).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: HEADLINE,
        issues: [
          {
            field: 'limit',
            rule: 'invalid_format',
            message: ruleMessages.number,
          },
          {
            field: 'isOpen',
            rule: 'invalid_value',
            message: ruleMessages.trueOrFalse,
          },
        ],
      },
    })
  })
})
