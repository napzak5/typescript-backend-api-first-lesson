import { describe, expect, it } from 'vitest'
import { customerAllergyRuleIssues } from '../business-logic/customer-allergy/_shared/rules'
import {
  customerAllergyCreateRequestSchema,
  customerAllergySearchRequestSchema,
  customerAllergyUpdateRequestSchema,
} from '../schemas/customer-allergy.schema'
import { CUSTOMER_ID, NOW } from './auth-fixtures'
import {
  CUSTOMER_ALLERGY_ID,
  customerAllergyCreateRequest,
} from './customer-allergy-fixtures'

/** The broken rules of a parse, as `field:rule`; empty for a success. */
const rulesOf = (result: {
  success: boolean
  error?: { issues: { path: PropertyKey[]; code: string }[] }
}): string[] =>
  (result.error?.issues ?? []).map(
    ({ path, code }) => `${path.map(String).join('.')}:${code}`,
  )

describe('customerAllergyCreateRequestSchema', () => {
  it('takes a request that states every item', () => {
    const request = customerAllergyCreateRequest()

    expect(customerAllergyCreateRequestSchema.parse(request)).toEqual(request)
  })

  it('takes nulls, every kind and every level, and what the limits allow', () => {
    const kinds = ['chemical', 'fragrance', 'metal', 'latex', 'plant', 'other']
    const levels = ['mild', 'moderate', 'severe', 'life_threatening']

    for (const allergyType of kinds) {
      for (const severityType of levels) {
        const request = {
          allergyType,
          allergenName: '漢'.repeat(255),
          severityType,
          symptoms: null,
          notes: null,
          confirmedDate: '1900-01-01',
        }
        expect(customerAllergyCreateRequestSchema.parse(request)).toEqual(
          request,
        )
      }
    }
    expect(
      customerAllergyCreateRequestSchema.safeParse(
        customerAllergyCreateRequest({ confirmedDate: null }),
      ).success,
    ).toBe(true)
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no kind', { allergyType: undefined }, ['allergyType:invalid_value']],
    [
      'a kind that is not one',
      { allergyType: 'food' },
      ['allergyType:invalid_value'],
    ],
    ['no allergen', { allergenName: undefined }, ['allergenName:invalid_type']],
    [
      'a blank allergen',
      { allergenName: ' \t' },
      ['allergenName:invalid_format'],
    ],
    [
      'an allergen too long',
      { allergenName: '漢'.repeat(256) },
      ['allergenName:too_big'],
    ],
    ['no level', { severityType: undefined }, ['severityType:invalid_value']],
    ['a level as null', { severityType: null }, ['severityType:invalid_value']],
    [
      'a level that is not one',
      { severityType: 'Severe' },
      ['severityType:invalid_value'],
    ],
    ['a level as a number', { severity: 3 }, [':unrecognized_keys']],
    ['no symptoms', { symptoms: undefined }, ['symptoms:invalid_type']],
    ['blank symptoms', { symptoms: '' }, ['symptoms:invalid_format']],
    ['blank notes', { notes: ' ' }, ['notes:invalid_format']],
    [
      'no day of confirmation',
      { confirmedDate: undefined },
      ['confirmedDate:invalid_type'],
    ],
    [
      'a day that is not one',
      { confirmedDate: '2026-02-29' },
      ['confirmedDate:invalid_format'],
    ],
    [
      'a day before 1900',
      { confirmedDate: '1899-12-31' },
      ['confirmedDate:too_small'],
    ],
    ['the customer', { customerId: CUSTOMER_ID }, [':unrecognized_keys']],
  ])('refuses %s', (_case, overrides, rules) => {
    expect(
      rulesOf(
        customerAllergyCreateRequestSchema.safeParse({
          ...customerAllergyCreateRequest(),
          ...overrides,
        }),
      ),
    ).toEqual(rules)
  })
})

describe('customerAllergyUpdateRequestSchema', () => {
  const every = customerAllergyCreateRequest()

  it.each<[string, Record<string, unknown>]>([
    ['the kind', { allergyType: 'metal' }],
    ['the allergen', { allergenName: 'ニッケル' }],
    ['the level', { severityType: 'life_threatening' }],
    ['no symptoms', { symptoms: null }],
    ['no notes', { notes: null }],
    ['no day of confirmation', { confirmedDate: null }],
    [
      'every item',
      {
        allergyType: every.allergyType,
        allergenName: every.allergenName,
        severityType: every.severityType,
        symptoms: every.symptoms,
        notes: every.notes,
        confirmedDate: every.confirmedDate,
      },
    ],
  ])('takes %s', (_case, request) => {
    expect(customerAllergyUpdateRequestSchema.parse(request)).toEqual(request)
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['nothing', {}, [':custom']],
    ['the customer', { customerId: CUSTOMER_ID }, [':unrecognized_keys']],
    [
      'an allergen as null',
      { allergenName: null },
      ['allergenName:invalid_type'],
    ],
    ['a level as null', { severityType: null }, ['severityType:invalid_value']],
    ['a kind as null', { allergyType: null }, ['allergyType:invalid_value']],
    [
      'an allergen stated without a value',
      { allergenName: undefined },
      ['allergenName:invalid_type'],
    ],
    ['a blank allergen', { allergenName: '' }, ['allergenName:invalid_format']],
    ['blank symptoms', { symptoms: ' ' }, ['symptoms:invalid_format']],
    [
      'a day before 1900',
      { confirmedDate: '1899-12-31' },
      ['confirmedDate:too_small'],
    ],
  ])('refuses %s', (_case, request, rules) => {
    expect(
      rulesOf(customerAllergyUpdateRequestSchema.safeParse(request)),
    ).toEqual(rules)
  })
})

describe('customerAllergySearchRequestSchema', () => {
  it('takes a limit and a cursor', () => {
    const query = { limit: 100, cursor: CUSTOMER_ALLERGY_ID }

    expect(customerAllergySearchRequestSchema.parse(query)).toEqual(query)
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a limit that is no whole number', { limit: 1.5 }, ['limit:invalid_type']],
    ['a cursor that is no UUID', { cursor: 'c' }, ['cursor:invalid_format']],
    ['a parameter of its own', { search: 'PPD' }, [':unrecognized_keys']],
  ])('refuses %s', (_case, query, rules) => {
    expect(
      rulesOf(customerAllergySearchRequestSchema.safeParse(query)),
    ).toEqual(rules)
  })
})

describe('customerAllergyRuleIssues', () => {
  it('lets through a day of the UTC day after today, which has begun in Japan', () => {
    expect(
      customerAllergyRuleIssues({ confirmedDate: '2026-11-15' }, NOW),
    ).toEqual([])
  })

  it.each(['2026-11-16', '2999-12-31'])(
    'refuses the later day %s',
    (confirmedDate) => {
      expect(customerAllergyRuleIssues({ confirmedDate }, NOW)).toEqual([
        {
          field: 'confirmedDate',
          rule: 'too_big',
          message: 'Must not be in the future',
        },
      ])
    },
  )

  it('has nothing to say of an allergy without a day, or a change that names none', () => {
    expect(customerAllergyRuleIssues({ confirmedDate: null }, NOW)).toEqual([])
    expect(customerAllergyRuleIssues({}, NOW)).toEqual([])
  })
})
