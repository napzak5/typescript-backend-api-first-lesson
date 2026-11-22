import { describe, expect, it } from 'vitest'
import { NOW } from '../../__tests__/fixtures/auth-fixtures'
import {
  MEDICAL_CHART_ID,
  medicalChartCreateRequest,
} from '../../__tests__/fixtures/medical-chart-fixtures'
import { medicalChartRuleIssues } from '../../business-logic/medical-chart/_shared/rules'
import {
  medicalChartCreateRequestSchema,
  medicalChartSearchRequestSchema,
  medicalChartUpdateRequestSchema,
} from '../medical-chart.schema'

/** The broken rules of a parse, as `field:rule`; empty for a success. */
const rulesOf = (result: {
  success: boolean
  error?: { issues: { path: PropertyKey[]; code: string }[] }
}): string[] =>
  (result.error?.issues ?? []).map(
    ({ path, code }) => `${path.map(String).join('.')}:${code}`,
  )

const treatment = (overrides: Record<string, unknown> = {}) => ({
  treatment: 'cut',
  date: '2026-03-14',
  salonName: null,
  notes: null,
  ...overrides,
})

describe('medicalChartCreateRequestSchema', () => {
  it('takes a request that states every item', () => {
    const request = medicalChartCreateRequest()

    expect(medicalChartCreateRequestSchema.parse(request)).toEqual(request)
  })

  it('takes empty lists and nulls', () => {
    const request = medicalChartCreateRequest({
      previousTreatments: [],
      medicalConditions: null,
      preferredProducts: [],
      avoidProducts: [],
      notes: null,
    })

    expect(medicalChartCreateRequestSchema.safeParse(request).success).toBe(
      true,
    )
  })

  it('takes what the limits allow', () => {
    const request = {
      ...medicalChartCreateRequest(),
      previousTreatments: Array.from({ length: 50 }, () =>
        treatment({
          treatment: 'eyelash',
          date: '1900-01-01',
          salonName: 's'.repeat(255),
        }),
      ),
      preferredProducts: Array.from({ length: 50 }, (_, index) =>
        `${index}`.padEnd(100, 'p'),
      ),
      avoidProducts: Array.from({ length: 50 }, (_, index) =>
        `${index}`.padEnd(100, 'a'),
      ),
    }

    expect(medicalChartCreateRequestSchema.safeParse(request).success).toBe(
      true,
    )
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no customer', { customerId: undefined }, ['customerId:invalid_type']],
    [
      'a customer that is no UUID',
      { customerId: 'c-1' },
      ['customerId:invalid_format'],
    ],
    ['an item of its own', { allergies: [] }, [':unrecognized_keys']],
    [
      'a list as null',
      { previousTreatments: null },
      ['previousTreatments:invalid_type'],
    ],
    [
      'too many treatments',
      { previousTreatments: Array.from({ length: 51 }, () => treatment()) },
      ['previousTreatments:too_big'],
    ],
    [
      'a kind of treatment that is not one',
      { previousTreatments: [treatment({ treatment: 'massage' })] },
      ['previousTreatments.0.treatment:invalid_value'],
    ],
    [
      'a day that is not one, and one before 1900',
      {
        previousTreatments: [
          treatment({ date: '2026-02-29' }),
          treatment({ date: '1899-12-31' }),
        ],
      },
      [
        'previousTreatments.0.date:invalid_format',
        'previousTreatments.1.date:too_small',
      ],
    ],
    [
      'a salon name too long, and blank',
      {
        previousTreatments: [
          treatment({ salonName: 's'.repeat(256) }),
          treatment({ salonName: ' ' }),
        ],
      },
      [
        'previousTreatments.0.salonName:too_big',
        'previousTreatments.1.salonName:invalid_format',
      ],
    ],
    [
      'blank notes of a treatment',
      { previousTreatments: [treatment({ notes: '\t' })] },
      ['previousTreatments.0.notes:invalid_format'],
    ],
    [
      'a treatment with a key of its own',
      { previousTreatments: [{ ...treatment(), staff: 'Hanako' }] },
      ['previousTreatments.0:unrecognized_keys'],
    ],
    [
      'a treatment without its notes',
      {
        previousTreatments: [
          { treatment: 'cut', date: '2026-03-14', salonName: null },
        ],
      },
      ['previousTreatments.0.notes:invalid_type'],
    ],
    [
      'blank conditions',
      { medicalConditions: '' },
      ['medicalConditions:invalid_format'],
    ],
    ['blank notes', { notes: ' ' }, ['notes:invalid_format']],
    [
      'a product name blank, and one too long',
      { preferredProducts: ['', 'x'.repeat(101)] },
      ['preferredProducts.0:invalid_format', 'preferredProducts.1:too_big'],
    ],
    [
      'too many products to avoid',
      { avoidProducts: Array.from({ length: 51 }, (_, index) => `${index}`) },
      ['avoidProducts:too_big'],
    ],
    [
      'a name twice in each list',
      { preferredProducts: ['A', 'A'], avoidProducts: ['B', 'C', 'B'] },
      ['preferredProducts.1:custom', 'avoidProducts.2:custom'],
    ],
  ])('refuses %s', (_case, overrides, rules) => {
    expect(
      rulesOf(
        medicalChartCreateRequestSchema.safeParse({
          ...medicalChartCreateRequest(),
          ...overrides,
        }),
      ),
    ).toEqual(rules)
  })
})

describe('medicalChartUpdateRequestSchema', () => {
  const every = medicalChartCreateRequest()

  it.each<[string, Record<string, unknown>]>([
    ['one item', { notes: null }],
    ['an empty list', { avoidProducts: [] }],
    [
      'every item but the customer',
      {
        previousTreatments: every.previousTreatments,
        medicalConditions: every.medicalConditions,
        preferredProducts: every.preferredProducts,
        avoidProducts: every.avoidProducts,
        notes: every.notes,
      },
    ],
  ])('takes %s', (_case, request) => {
    expect(medicalChartUpdateRequestSchema.parse(request)).toEqual(request)
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['nothing', {}, [':custom']],
    ['the customer', { customerId: MEDICAL_CHART_ID }, [':unrecognized_keys']],
    [
      'a list as null',
      { preferredProducts: null },
      ['preferredProducts:invalid_type'],
    ],
    ['a name twice', { avoidProducts: ['A', 'A'] }, ['avoidProducts.1:custom']],
    [
      'a kind of treatment that is not one',
      { previousTreatments: [treatment({ treatment: 'spa' })] },
      ['previousTreatments.0.treatment:invalid_value'],
    ],
    [
      'blank conditions',
      { medicalConditions: ' ' },
      ['medicalConditions:invalid_format'],
    ],
  ])('refuses %s', (_case, request, rules) => {
    expect(rulesOf(medicalChartUpdateRequestSchema.safeParse(request))).toEqual(
      rules,
    )
  })
})

describe('medicalChartSearchRequestSchema', () => {
  it('takes every filter', () => {
    const query = {
      limit: 100,
      cursor: MEDICAL_CHART_ID,
      search: 'Aveda',
      hasAllergies: false,
    }

    expect(medicalChartSearchRequestSchema.parse(query)).toEqual(query)
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a limit that is no whole number', { limit: 1.5 }, ['limit:invalid_type']],
    ['a cursor that is no UUID', { cursor: 'c' }, ['cursor:invalid_format']],
    ['a blank keyword', { search: '  ' }, ['search:invalid_format']],
    ['a keyword too long', { search: 'x'.repeat(101) }, ['search:too_big']],
    [
      'an allergy filter as text',
      { hasAllergies: 'true' },
      ['hasAllergies:invalid_type'],
    ],
    [
      'a parameter of its own',
      { customerId: MEDICAL_CHART_ID },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, query, rules) => {
    expect(rulesOf(medicalChartSearchRequestSchema.safeParse(query))).toEqual(
      rules,
    )
  })
})

describe('medicalChartRuleIssues', () => {
  it('lets through a treatment of the UTC day after today, which has begun in Japan', () => {
    expect(
      medicalChartRuleIssues(
        { previousTreatments: [treatment({ date: '2026-11-15' })] },
        NOW,
      ),
    ).toEqual([])
  })

  it('refuses each treatment of a later day, under its place', () => {
    expect(
      medicalChartRuleIssues(
        {
          previousTreatments: [
            treatment({ date: '2026-11-16' }),
            treatment({ date: '2026-11-14' }),
            treatment({ date: '2999-12-31' }),
          ],
        },
        NOW,
      ),
    ).toEqual([
      {
        field: 'previousTreatments.0.date',
        rule: 'too_big',
        message: 'Must not be in the future',
      },
      {
        field: 'previousTreatments.2.date',
        rule: 'too_big',
        message: 'Must not be in the future',
      },
    ])
  })

  it('has nothing to say of a change that names no treatments', () => {
    expect(medicalChartRuleIssues({}, NOW)).toEqual([])
  })
})
