import { describe, expect, it } from 'vitest'
import {
  customerRuleIssues,
  referredByItself,
} from '../business-logic/customer/_shared/rules'
import { phoneDigitsOf } from '../business-logic/customer/_shared/search'
import { customerIdSchema } from '../models/customer'
import { CUSTOMER_ID } from './auth-fixtures'
import { REFERRER_ID } from './customer-fixtures'

/** The time of the clock: noon in UTC, nine in the evening in Japan. */
const NOON = new Date('2026-11-15T12:00:00.000Z')

/** The issues as `field:rule`. */
const asRules = (issues: { field: string; rule: string }[]): string[] =>
  issues.map(({ field, rule }) => `${field}:${rule}`)

describe('phoneDigitsOf', () => {
  it.each([
    ['digits with hyphens', '090-1234', '0901234'],
    ['digits with spaces', '090 1234 5678', '09012345678'],
    ['digits alone', '09012345678', '09012345678'],
    ['digits with parentheses', '(090)1234', '0901234'],
    ['an international number', '+81 90-1234-5678', '819012345678'],
    ['one digit', '7', '7'],
    ['digits with spaces around them', ' 5678 ', '5678'],
  ])(
    'returns the digits of a keyword written like a phone number: %s',
    (_case, keyword, digits) => {
      expect(phoneDigitsOf(keyword)).toBe(digits)
    },
  )

  it.each([
    ['a name', '山田'],
    ['a word with digits', 'hanako090'],
    ['an email that contains digits', '090@example.com'],
    ['digits with a letter', '090-1234-567x'],
    ['digits with a dot', '090.1234.5678'],
    ['digits with a slash', '090/1234'],
    ['digits with a percent sign', '090%'],
    ['digits with an underscore', '090_1234'],
    ['separators without a digit', '+-()'],
    ['whitespace only', ' \t '],
  ])('returns null for %s', (_case, keyword) => {
    expect(phoneDigitsOf(keyword)).toBeNull()
  })
})

describe('customerRuleIssues', () => {
  it.each([
    ['a birth date long ago', { birthDate: '1990-04-01' }],
    ['the first of January 1900', { birthDate: '1900-01-01' }],
    ['the date of today in UTC', { birthDate: '2026-11-15' }],
    ['the date that has begun in Japan', { birthDate: '2026-11-16' }],
    ['no birth date', { birthDate: null }],
    ['a request without a birth date', {}],
  ])('finds nothing wrong with %s', (_case, customer) => {
    expect(customerRuleIssues(customer, NOON)).toEqual([])
  })

  it('refuses a birth date before 1900 as too small', () => {
    expect(
      asRules(customerRuleIssues({ birthDate: '1899-12-31' }, NOON)),
    ).toEqual(['birthDate:too_small'])
  })

  it('refuses a birth date after the date that has begun anywhere as too big', () => {
    expect(
      asRules(customerRuleIssues({ birthDate: '2026-11-17' }, NOON)),
    ).toEqual(['birthDate:too_big'])
  })

  it.each([
    [
      'the last moment of a UTC day',
      '2026-11-15T23:59:59.999Z',
      '2026-11-16',
      [],
    ],
    [
      'the last moment of a UTC day',
      '2026-11-15T23:59:59.999Z',
      '2026-11-17',
      ['birthDate:too_big'],
    ],
    [
      'the first moment of a UTC day',
      '2026-11-16T00:00:00.000Z',
      '2026-11-17',
      [],
    ],
    [
      'the first moment of a UTC day',
      '2026-11-16T00:00:00.000Z',
      '2026-11-18',
      ['birthDate:too_big'],
    ],
  ])(
    'judges the future from the UTC date of the clock: at %s (%s) the birth date %s breaks %j',
    (_case, now, birthDate, expected) => {
      expect(asRules(customerRuleIssues({ birthDate }, new Date(now)))).toEqual(
        expected,
      )
    },
  )

  it('says what is wrong with the birth date in a message', () => {
    expect(customerRuleIssues({ birthDate: '1899-12-31' }, NOON)).toEqual([
      { field: 'birthDate', rule: 'too_small', message: expect.any(String) },
    ])
  })
})

describe('referredByItself', () => {
  const customerId = customerIdSchema.parse(CUSTOMER_ID)

  it('refuses the customer itself as its referrer as circular', () => {
    const issues = referredByItself(customerId, { referredBy: customerId })

    expect(issues).toEqual([
      { field: 'referredBy', rule: 'circular', message: expect.any(String) },
    ])
  })

  it.each([
    ['another customer', { referredBy: customerIdSchema.parse(REFERRER_ID) }],
    ['no referrer', { referredBy: null }],
    ['a request without a referrer', {}],
  ])('finds nothing wrong with %s as the referrer', (_case, customer) => {
    expect(referredByItself(customerId, customer)).toEqual([])
  })
})
