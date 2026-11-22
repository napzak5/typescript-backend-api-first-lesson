import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { COLOR_ID, CUT_ID } from '../../__tests__/fixtures/booking-fixtures'
import { PRODUCT_ID } from '../../__tests__/fixtures/product-fixtures'
import {
  TREATMENT_RECORD_ID,
  treatmentRecordCreateRequest,
} from '../../__tests__/fixtures/treatment-record-fixtures'
import {
  treatmentRecordCreateRequestSchema,
  treatmentRecordSearchRequestSchema,
  treatmentRecordUpdateRequestSchema,
} from '../treatment-record.schema'

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

/** An ID that sorts by its last number. */
const idOf = (last: number): string =>
  `0193a5b8-7c2e-7d4f-8a1b-${String(last).padStart(12, '0')}`

const material = (overrides: Record<string, unknown> = {}) => ({
  productId: PRODUCT_ID,
  quantity: 1,
  unit: 'g',
  lotNumber: null,
  notes: null,
  ...overrides,
})

describe('treatmentRecordCreateRequestSchema', () => {
  it('takes a request that names everything, and gives it back as it is', () => {
    expect(
      treatmentRecordCreateRequestSchema.parse(treatmentRecordCreateRequest()),
    ).toEqual(treatmentRecordCreateRequest())
  })

  it('takes null for everything a record may leave unwritten, and empty lists', () => {
    const request = treatmentRecordCreateRequest({
      techniques: [],
      consultationNotes: null,
      scalpCondition: null,
      hairCondition: null,
      colorFormula: null,
      processingTime: null,
      resultNotes: null,
      nextRecommendedDate: null,
      nextRecommendedServices: [],
      homeCareSuggestions: null,
      customerSatisfaction: null,
      staffEvaluation: null,
      materials: [],
    })

    expect(brokenBy(treatmentRecordCreateRequestSchema, request)).toEqual([])
  })

  it('takes the limits: 20 of each list, 50 materials, a day of treatment, and the smallest and largest quantities', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => idOf(index))
    const request = treatmentRecordCreateRequest({
      services: twenty,
      techniques: Array.from({ length: 20 }, (_, index) => `技法${index}`),
      nextRecommendedServices: twenty,
      processingTime: 1440,
      customerSatisfaction: 1,
      materials: Array.from({ length: 50 }, (_, index) =>
        material({ quantity: index === 0 ? 99_999_999.99 : 0.01 }),
      ),
    })

    expect(brokenBy(treatmentRecordCreateRequestSchema, request)).toEqual([])
  })

  it('reads an ID in upper case as the same ID', () => {
    const parsed = treatmentRecordCreateRequestSchema.parse(
      treatmentRecordCreateRequest({ services: [CUT_ID.toUpperCase()] }),
    )

    expect(parsed.services).toEqual([CUT_ID])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['no services', { services: [] }, ['services:too_small']],
    ['a service twice', { services: [CUT_ID, CUT_ID] }, ['services.1:custom']],
    [
      'the same service in two spellings',
      { services: [COLOR_ID, COLOR_ID.toUpperCase()] },
      ['services.1:custom'],
    ],
    [
      '21 services',
      { services: Array.from({ length: 21 }, (_, index) => idOf(index)) },
      ['services:too_big'],
    ],
    [
      '21 techniques',
      {
        techniques: Array.from({ length: 21 }, (_, index) => `技法${index}`),
      },
      ['techniques:too_big'],
    ],
    [
      'a technique twice',
      { techniques: ['カット', 'カット'] },
      ['techniques.1:custom'],
    ],
    [
      'a technique that is blank, and one longer than 100',
      { techniques: [' ', 'あ'.repeat(101)] },
      ['techniques.0:invalid_format', 'techniques.1:too_big'],
    ],
    [
      'a recommendation twice',
      { nextRecommendedServices: [CUT_ID, CUT_ID] },
      ['nextRecommendedServices.1:custom'],
    ],
    [
      '51 materials',
      { materials: Array.from({ length: 51 }, () => material()) },
      ['materials:too_big'],
    ],
    [
      'quantities of none, below none, finer than a hundredth and over what the column holds',
      {
        materials: [
          material({ quantity: 0 }),
          material({ quantity: -1 }),
          material({ quantity: 1.005 }),
          material({ quantity: 100_000_000 }),
        ],
      },
      [
        'materials.0.quantity:too_small',
        'materials.1.quantity:too_small',
        'materials.2.quantity:not_multiple_of',
        'materials.3.quantity:too_big',
      ],
    ],
    [
      'a unit that is blank, and one longer than 20',
      {
        materials: [material({ unit: '' }), material({ unit: 'g'.repeat(21) })],
      },
      ['materials.0.unit:invalid_format', 'materials.1.unit:too_big'],
    ],
    [
      'a lot number longer than 100',
      { materials: [material({ lotNumber: 'L'.repeat(101) })] },
      ['materials.0.lotNumber:too_big'],
    ],
    [
      'a material with a property it does not have',
      { materials: [material({ cost: 100 })] },
      ['materials.0:unrecognized_keys'],
    ],
    [
      'a treatment of minutes that are not whole',
      { processingTime: 1.5 },
      ['processingTime:invalid_type'],
    ],
    [
      'a treatment longer than a day',
      { processingTime: 1441 },
      ['processingTime:too_big'],
    ],
    [
      'a satisfaction of none',
      { customerSatisfaction: 0 },
      ['customerSatisfaction:too_small'],
    ],
    [
      'a satisfaction over five',
      { customerSatisfaction: 6 },
      ['customerSatisfaction:too_big'],
    ],
    [
      'notes that are blank',
      { consultationNotes: '  ', colorFormula: '' },
      ['consultationNotes:invalid_format', 'colorFormula:invalid_format'],
    ],
    [
      'a date that is no day of the calendar',
      { nextRecommendedDate: '2026-02-29' },
      ['nextRecommendedDate:invalid_format'],
    ],
    [
      'lists that are null',
      { techniques: null, nextRecommendedServices: null, materials: null },
      [
        'techniques:invalid_type',
        'nextRecommendedServices:invalid_type',
        'materials:invalid_type',
      ],
    ],
    [
      'the photos of the old columns',
      { beforePhotos: [], afterPhotos: [] },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, overrides, expected) => {
    expect(
      brokenBy(treatmentRecordCreateRequestSchema, {
        ...treatmentRecordCreateRequest(),
        ...overrides,
      }),
    ).toEqual(expected)
  })

  it.each([
    'bookingId',
    'customerId',
    'staffId',
    'services',
    'techniques',
    'consultationNotes',
    'nextRecommendedServices',
    'materials',
  ])('refuses a request without %s', (property) => {
    const request: Record<string, unknown> = treatmentRecordCreateRequest()
    delete request[property]

    expect(brokenBy(treatmentRecordCreateRequestSchema, request)).toEqual([
      `${property}:invalid_type`,
    ])
  })
})

describe('treatmentRecordUpdateRequestSchema', () => {
  it('takes any one property alone', () => {
    expect(
      brokenBy(treatmentRecordUpdateRequestSchema, { resultNotes: null }),
    ).toEqual([])
    expect(
      brokenBy(treatmentRecordUpdateRequestSchema, { materials: [] }),
    ).toEqual([])
  })

  it('gives back only what the request names', () => {
    expect(
      treatmentRecordUpdateRequestSchema.parse({ techniques: ['ハイライト'] }),
    ).toEqual({ techniques: ['ハイライト'] })
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['nothing', {}, [':custom']],
    [
      'a property set to undefined alone',
      { resultNotes: undefined },
      ['resultNotes:invalid_type'],
    ],
    ['services that are null', { services: null }, ['services:invalid_type']],
    ['no services', { services: [] }, ['services:too_small']],
    ['a booking', { bookingId: TREATMENT_RECORD_ID }, [':unrecognized_keys']],
    ['a customer', { customerId: TREATMENT_RECORD_ID }, [':unrecognized_keys']],
    [
      'a staff member',
      { staffId: TREATMENT_RECORD_ID },
      [':unrecognized_keys'],
    ],
    [
      'a material over what the column holds',
      { materials: [material({ quantity: 100_000_000 })] },
      ['materials.0.quantity:too_big'],
    ],
  ])('refuses %s', (_case, request, expected) => {
    expect(brokenBy(treatmentRecordUpdateRequestSchema, request)).toEqual(
      expected,
    )
  })
})

describe('treatmentRecordSearchRequestSchema', () => {
  it('takes no filter, and every filter', () => {
    expect(brokenBy(treatmentRecordSearchRequestSchema, {})).toEqual([])
    expect(
      brokenBy(treatmentRecordSearchRequestSchema, {
        limit: 100,
        cursor: TREATMENT_RECORD_ID,
        salonId: idOf(1),
        customerId: idOf(2),
        staffId: idOf(3),
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-01T00:00:00Z',
      }),
    ).toEqual([])
  })

  it('gives back the moments in the spelling of toISOString', () => {
    expect(
      treatmentRecordSearchRequestSchema.parse({
        startDate: '2026-11-01T00:00:00Z',
      }),
    ).toEqual({ startDate: '2026-11-01T00:00:00.000Z' })
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a limit of none', { limit: 0 }, ['limit:too_small']],
    ['a limit over 100', { limit: 101 }, ['limit:too_big']],
    ['a cursor that is no UUID', { cursor: 'r-1' }, ['cursor:invalid_format']],
    [
      'an end before the start',
      { startDate: '2026-11-02T00:00:00Z', endDate: '2026-11-01T23:59:59Z' },
      ['endDate:custom'],
    ],
    [
      'a start that is a day, not a moment',
      { startDate: '2026-11-01' },
      ['startDate:invalid_format'],
    ],
    [
      'an end in a time zone other than UTC',
      { endDate: '2026-11-01T09:00:00+09:00' },
      ['endDate:invalid_format'],
    ],
    [
      'a filter it does not know',
      { bookingId: idOf(1) },
      [':unrecognized_keys'],
    ],
  ])('refuses %s', (_case, request, expected) => {
    expect(brokenBy(treatmentRecordSearchRequestSchema, request)).toEqual(
      expected,
    )
  })
})
