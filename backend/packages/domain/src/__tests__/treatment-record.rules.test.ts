import { describe, expect, it } from 'vitest'
import {
  type CreationFacts,
  creationIssues,
  isTreated,
  type NamedOfTreatment,
  type TreatmentFacts,
  treatmentIssues,
} from '../business-logic/treatment-record/_shared/rules'
import type { DbBooking } from '../models/booking'
import { productIdSchema } from '../models/product'
import { serviceIdSchema } from '../models/service'
import { COLOR_ID, CUT_ID } from './booking-fixtures'
import { OTHER_PRODUCT_ID, PRODUCT_ID } from './product-fixtures'

const cut = serviceIdSchema.parse(CUT_ID)
const colour = serviceIdSchema.parse(COLOR_ID)
const unknownService = serviceIdSchema.parse(
  '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d91',
)
/** A product kept by lots, one that is not, and one the salon does not have. */
const byLots = productIdSchema.parse(PRODUCT_ID)
const loose = productIdSchema.parse(OTHER_PRODUCT_ID)
const unknownProduct = productIdSchema.parse(
  '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d92',
)

/** The salon has the cut, the colour and the two products; the booking is on 20 November 2026. */
const facts: TreatmentFacts = {
  bookingDate: '2026-11-20',
  services: new Set([cut, colour]),
  products: new Map([
    [byLots, true],
    [loose, false],
  ]),
}

const rulesOf = (issues: { field: string; rule: string }[]): string[] =>
  issues.map(({ field, rule }) => `${field}:${rule}`)

describe('isTreated', () => {
  it.each<[DbBooking['status'], boolean]>([
    ['in_progress', true],
    ['completed', true],
    ['draft', false],
    ['pending', false],
    ['confirmed', false],
    ['cancelled', false],
    ['no_show', false],
  ])('takes a record of a booking that is %s: %s', (status, expected) => {
    expect(isTreated(status)).toBe(expected)
  })
})

describe('treatmentIssues', () => {
  it('finds nothing in what fits the salon and the booking', () => {
    expect(
      treatmentIssues(facts, {
        services: [colour, cut],
        nextRecommendedDate: '2026-11-20',
        nextRecommendedServices: [cut],
        materials: [
          { productId: byLots, lotNumber: 'LOT-1' },
          { productId: loose, lotNumber: null },
          { productId: byLots, lotNumber: 'LOT-2' },
        ],
      }),
    ).toEqual([])
  })

  it('finds nothing in a request that names none of it', () => {
    expect(treatmentIssues(facts, {})).toEqual([])
  })

  it('reports everything that does not fit, in the order of the properties of the request, each entry by its place', () => {
    const named: NamedOfTreatment = {
      services: [cut, unknownService],
      nextRecommendedDate: '2026-11-19',
      nextRecommendedServices: [unknownService, colour],
      materials: [
        { productId: byLots, lotNumber: null },
        { productId: unknownProduct, lotNumber: null },
        { productId: loose, lotNumber: 'LOT-1' },
      ],
    }

    expect(treatmentIssues(facts, named)).toEqual([
      {
        field: 'services.1',
        rule: 'not_found',
        message: 'Must name a service of the salon of the booking',
      },
      {
        field: 'nextRecommendedDate',
        rule: 'too_small',
        message: 'Must not be before the date of the booking, 2026-11-20',
      },
      {
        field: 'nextRecommendedServices.0',
        rule: 'not_found',
        message: 'Must name a service of the salon of the booking',
      },
      {
        field: 'materials.0.lotNumber',
        rule: 'custom',
        message: 'Must name the lot: the product is kept by lots',
      },
      {
        field: 'materials.1.productId',
        rule: 'not_found',
        message: 'Must name a product of the salon of the booking',
      },
      {
        field: 'materials.2.lotNumber',
        rule: 'custom',
        message: 'Must be null: the product is not kept by lots',
      },
    ])
  })

  it('takes a next visit recommended for the day of the booking and no date at all', () => {
    expect(
      treatmentIssues(facts, { nextRecommendedDate: '2026-11-20' }),
    ).toEqual([])
    expect(treatmentIssues(facts, { nextRecommendedDate: null })).toEqual([])
  })

  it('does not look at the lot of a product the salon does not have', () => {
    expect(
      rulesOf(
        treatmentIssues(facts, {
          materials: [{ productId: unknownProduct, lotNumber: 'LOT-1' }],
        }),
      ),
    ).toEqual(['materials.0.productId:not_found'])
  })
})

describe('creationIssues', () => {
  const creation = (overrides: Partial<CreationFacts> = {}): CreationFacts => ({
    ...facts,
    customerOfBooking: true,
    staffOfSalon: true,
    ...overrides,
  })

  it('finds nothing when the customer is of the booking and the staff member of the salon', () => {
    expect(creationIssues(creation(), { services: [cut] })).toEqual([])
  })

  it('reports the customer and the staff member first, then the rest', () => {
    expect(
      rulesOf(
        creationIssues(
          creation({ customerOfBooking: false, staffOfSalon: false }),
          { services: [unknownService] },
        ),
      ),
    ).toEqual([
      'customerId:not_found',
      'staffId:not_found',
      'services.0:not_found',
    ])
  })

  it.each<[string, Partial<CreationFacts>, string]>([
    [
      'a customer who is not the one of the booking',
      { customerOfBooking: false },
      'customerId:not_found',
    ],
    [
      'a staff member of another salon',
      { staffOfSalon: false },
      'staffId:not_found',
    ],
  ])('reports %s alone', (_case, overrides, expected) => {
    expect(rulesOf(creationIssues(creation(overrides), {}))).toEqual([expected])
  })
})
