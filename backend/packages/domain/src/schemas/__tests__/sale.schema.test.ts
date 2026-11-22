import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import { BOOKING_ID, CUT_ID } from '../../__tests__/fixtures/booking-fixtures'
import { brokenRules, SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  PRODUCT_ID,
  SALE_ID,
  saleCalculateRequest,
  saleCreateRequest,
  TREATMENT_ID,
} from '../../__tests__/fixtures/sale-fixtures'
import { STAFF_MEMBER_ID } from '../../__tests__/fixtures/staff-fixtures'
import { type DomainError, parseWith, toldIn } from '../../shared'
import {
  MAX_SALE_DETAILS,
  saleCalculateRequestSchema,
  saleCreateRequestSchema,
  saleSearchRequestSchema,
  saleUpdateRequestSchema,
  saleVoidRequestSchema,
} from '../sale.schema'

const MAX_INTEGER = 2_147_483_647

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

const parseCreate = (input: unknown) =>
  parseWith(saleCreateRequestSchema, input, 'Invalid')

const rulesOfCreate = (input: unknown): string[] =>
  rulesBrokenBy(saleCreateRequestSchema, input)

const parseUpdate = (input: unknown) =>
  parseWith(saleUpdateRequestSchema, input, 'Invalid')

const rulesOfUpdate = (input: unknown): string[] =>
  rulesBrokenBy(saleUpdateRequestSchema, input)

const parseVoid = (input: unknown) =>
  parseWith(saleVoidRequestSchema, input, 'Invalid')

const rulesOfVoid = (input: unknown): string[] =>
  rulesBrokenBy(saleVoidRequestSchema, input)

const parseSearch = (input: unknown) =>
  parseWith(saleSearchRequestSchema, input, 'Invalid')

const rulesOfSearch = (input: unknown): string[] =>
  rulesBrokenBy(saleSearchRequestSchema, input)

/** The messages of a failed validation, by `field`; empty for a success. */
const messagesOf = (input: unknown): Record<string, string> => {
  const result = parseCreate(input)
  const error: DomainError | null =
    result.type === 'error' ? result.error : null
  return error?.type === 'validation'
    ? Object.fromEntries(
        error.issues.map(({ field, message }) => [
          field,
          toldIn(message, 'en'),
        ]),
      )
    : {}
}

/** A line that keeps every rule: something of no record for 1,000 yen and 100 of tax. */
const line = (overrides: Record<string, unknown> = {}) => ({
  itemType: 'fee',
  itemId: null,
  itemName: '指名料',
  quantity: 1,
  unitPrice: 1000,
  discountAmount: 0,
  taxAmount: 100,
  totalAmount: 1100,
  staffId: null,
  commissionRate: null,
  commissionAmount: null,
  notes: null,
  sortOrder: 0,
  ...overrides,
})

/** The request of the fixtures with these lines. */
const withLines = (...details: unknown[]) => ({
  ...saleCreateRequest(),
  details,
})

/** The request of the fixtures with these properties changed. */
const withProperties = (overrides: Record<string, unknown>) => ({
  ...saleCreateRequest(),
  ...overrides,
})

/** A sale to nobody: no customer, no booking, no points. */
const toNobody = (overrides: Record<string, unknown> = {}) =>
  withProperties({
    customerId: null,
    bookingId: null,
    pointsUsed: null,
    pointsEarned: null,
    ...overrides,
  })

/** The time of an accepted request; null for a refused one. */
const saleTimeOf = (saleTime: unknown): string | null => {
  const result = parseCreate(withProperties({ saleTime }))
  return result.type === 'success' ? result.data.saleTime : null
}

describe('saleCreateRequestSchema', () => {
  it('accepts a request that keeps every rule and spells its time in one way', () => {
    const request = saleCreateRequest()

    expect(parseCreate(request)).toEqual({
      type: 'success',
      data: { ...request, saleTime: '2026-11-20T03:40:00.000Z' },
    })
  })

  it.each(['staffId', 'bookingId', 'pointsUsed', 'pointsEarned', 'notes'])(
    'accepts null for %s',
    (property) => {
      const result = parseCreate(withProperties({ [property]: null }))

      expect(result).toMatchObject({
        type: 'success',
        data: { [property]: null },
      })
    },
  )

  it('accepts a sale to nobody: a customer who is not on record pays at the till', () => {
    expect(parseCreate(toNobody())).toMatchObject({
      type: 'success',
      data: { customerId: null, pointsUsed: null, pointsEarned: null },
    })
  })

  it.each(['itemId', 'staffId', 'commissionRate', 'commissionAmount', 'notes'])(
    'accepts null for %s of a line',
    (property) => {
      const [cut] = saleCreateRequest().details

      const result = parseCreate(withLines({ ...cut, [property]: null }))

      expect(result).toMatchObject({
        type: 'success',
        data: { details: [{ [property]: null }] },
      })
    },
  )

  it.each(Object.keys(saleCreateRequest()))(
    'requires %s: nothing of a new sale is optional',
    (property) => {
      const { [property]: _omitted, ...request }: Record<string, unknown> =
        saleCreateRequest()

      expect(rulesOfCreate(request)).toEqual([`${property}:invalid_type`])
    },
  )

  it.each(Object.keys(line()))('requires %s of a line', (property) => {
    const { [property]: _omitted, ...incomplete }: Record<string, unknown> =
      line()

    expect(rulesOfCreate(withLines(incomplete))).toEqual([
      `details.0.${property}:invalid_type`,
    ])
  })

  it.each([
    'id',
    'saleNumber',
    'saleDate',
    'subtotal',
    'discountAmount',
    'taxAmount',
    'totalAmount',
    'paymentStatus',
    'isVoid',
    'voidedAt',
    'voidReason',
    'payments',
  ])('refuses %s: the system sets it', (property) => {
    expect(rulesOfCreate(withProperties({ [property]: null }))).toEqual([
      `${property}:unrecognized_keys`,
    ])
  })

  it.each(['id', 'saleId', 'createdAt'])(
    'refuses %s of a line: the system sets it',
    (property) => {
      expect(rulesOfCreate(withLines(line({ [property]: null })))).toEqual([
        `details.0.${property}:unrecognized_keys`,
      ])
    },
  )

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'sale'],
  ])('refuses %s for a request', (_case, input) => {
    expect(rulesOfCreate(input)).toEqual([':invalid_type'])
  })

  it.each(['salonId', 'customerId', 'staffId', 'bookingId'])(
    'refuses a value of %s that is no ID',
    (property) => {
      const rules = rulesOfCreate(withProperties({ [property]: 'not-an-id' }))

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(new RegExp(`^${property}:`))
    },
  )

  it('returns the IDs in lower case', () => {
    const result = parseCreate(
      withProperties({
        salonId: SALON_ID.toUpperCase(),
        customerId: CUSTOMER_ID.toUpperCase(),
        staffId: STAFF_MEMBER_ID.toUpperCase(),
        bookingId: BOOKING_ID.toUpperCase(),
        details: [
          line({
            itemType: 'service',
            itemId: CUT_ID.toUpperCase(),
            staffId: STAFF_MEMBER_ID.toUpperCase(),
          }),
        ],
      }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        salonId: SALON_ID,
        customerId: CUSTOMER_ID,
        staffId: STAFF_MEMBER_ID,
        bookingId: BOOKING_ID,
        details: [{ itemId: CUT_ID, staffId: STAFF_MEMBER_ID }],
      },
    })
  })

  describe('saleTime', () => {
    it('returns two spellings of one moment as the same text', () => {
      expect(saleTimeOf('2026-11-20T03:40:00Z')).toBe(
        '2026-11-20T03:40:00.000Z',
      )
      expect(saleTimeOf('2026-11-20T03:40:00.000Z')).toBe(
        '2026-11-20T03:40:00.000Z',
      )
    })

    it('takes a time to the millisecond and cuts what it has beyond that', () => {
      expect(saleTimeOf('2026-11-20T03:40:15.250Z')).toBe(
        '2026-11-20T03:40:15.250Z',
      )
      expect(saleTimeOf('2026-11-20T03:40:15.250999Z')).toBe(
        '2026-11-20T03:40:15.250Z',
      )
    })

    it('accepts a time long past and a time to come: the ledger is the salon’s to keep', () => {
      expect(saleTimeOf('2019-01-01T00:00:00Z')).toBe(
        '2019-01-01T00:00:00.000Z',
      )
      expect(saleTimeOf('2031-12-31T23:59:59Z')).toBe(
        '2031-12-31T23:59:59.000Z',
      )
    })

    it.each([
      ['a time in another zone', '2026-11-20T12:40:00+09:00'],
      ['a time without a zone', '2026-11-20T03:40:00'],
      ['a time without seconds', '2026-11-20T03:40Z'],
      ['a day', '2026-11-20'],
      ['a day that does not exist', '2026-02-30T03:40:00Z'],
      ['a time with a space', '2026-11-20 03:40:00Z'],
      ['a word', 'now'],
      ['an empty text', ''],
    ])('refuses %s', (_case, saleTime) => {
      expect(rulesOfCreate(withProperties({ saleTime }))).toEqual([
        'saleTime:invalid_format',
      ])
    })

    it.each([
      ['a number', 1_795_000_000_000],
      ['null', null],
    ])('refuses %s', (_case, saleTime) => {
      expect(rulesOfCreate(withProperties({ saleTime }))).toEqual([
        'saleTime:invalid_type',
      ])
    })
  })

  describe('points', () => {
    it.each(['pointsUsed', 'pointsEarned'])(
      'takes %s from 0 to what an integer column holds',
      (property) => {
        const rulesOf = (value: unknown) =>
          rulesOfCreate(withProperties({ [property]: value }))

        expect(rulesOf(0)).toEqual([])
        expect(rulesOf(MAX_INTEGER)).toEqual([])
        expect(rulesOf(-1)).toEqual([`${property}:too_small`])
        expect(rulesOf(MAX_INTEGER + 1)).toEqual([`${property}:too_big`])
        expect(rulesOf(1.5)).toEqual([`${property}:invalid_type`])
        expect(rulesOf('10')).toEqual([`${property}:invalid_type`])
      },
    )

    it.each(['pointsUsed', 'pointsEarned'])(
      'refuses %s of a sale to nobody, be it 0: points are a customer’s',
      (property) => {
        expect(rulesOfCreate(toNobody({ [property]: 0 }))).toEqual([
          `${property}:custom`,
        ])
        expect(rulesOfCreate(toNobody({ [property]: 50 }))).toEqual([
          `${property}:custom`,
        ])
      },
    )

    it('reports both, and says why', () => {
      const request = toNobody({ pointsUsed: 10, pointsEarned: 20 })

      expect(rulesOfCreate(request)).toEqual([
        'pointsUsed:custom',
        'pointsEarned:custom',
      ])
      expect(messagesOf(request)).toEqual({
        pointsUsed: 'Must be null for a sale without a customer',
        pointsEarned: 'Must be null for a sale without a customer',
      })
    })
  })

  describe('notes', () => {
    it.each([
      ['an empty text', ''],
      ['spaces', '   '],
      ['a line break', '\n'],
    ])('refuses %s: a sale without notes has null', (_case, notes) => {
      expect(rulesOfCreate(withProperties({ notes }))).toEqual([
        'notes:invalid_format',
      ])
      expect(rulesOfCreate(withLines(line({ notes })))).toEqual([
        'details.0.notes:invalid_format',
      ])
    })

    it('sets no limit to their length: the columns have none', () => {
      const notes = 'あ'.repeat(10_000)

      expect(rulesOfCreate(withProperties({ notes }))).toEqual([])
      expect(rulesOfCreate(withLines(line({ notes })))).toEqual([])
    })
  })

  describe('details', () => {
    /** That many lines, each with a place of its own. */
    const lines = (count: number) =>
      Array.from({ length: count }, (_value, sortOrder) => line({ sortOrder }))

    it('refuses a sale without a line', () => {
      expect(rulesOfCreate(withLines())).toEqual(['details:too_small'])
    })

    it(`takes up to ${MAX_SALE_DETAILS} lines`, () => {
      expect(MAX_SALE_DETAILS).toBe(100)
      expect(rulesOfCreate(withLines(...lines(100)))).toEqual([])
      expect(rulesOfCreate(withLines(...lines(101)))).toEqual([
        'details:too_big',
      ])
    })

    it.each([
      ['null', null],
      ['one line that is not in a list', line()],
      ['a text', 'cut'],
    ])('refuses %s for the lines', (_case, details) => {
      expect(rulesOfCreate(withProperties({ details }))).toEqual([
        'details:invalid_type',
      ])
    })

    it('refuses a line that is no object', () => {
      expect(rulesOfCreate(withLines(null))).toEqual(['details.0:invalid_type'])
    })
  })

  describe('what a line sells', () => {
    it.each(['service', 'product', 'fee', 'チケット', 'gift card'])(
      'accepts %s for the type of a line of no record',
      (itemType) => {
        expect(rulesOfCreate(withLines(line({ itemType })))).toEqual([])
      },
    )

    it.each([
      ['an empty text', ''],
      ['spaces', '  '],
    ])('refuses %s for the type', (_case, itemType) => {
      expect(rulesOfCreate(withLines(line({ itemType })))).toEqual([
        'details.0.itemType:invalid_format',
      ])
    })

    it('keeps the type within the 50 characters of its column and the name within its 255', () => {
      expect(
        rulesOfCreate(
          withLines(
            line({ itemType: 't'.repeat(50), itemName: 'n'.repeat(255) }),
          ),
        ),
      ).toEqual([])
      expect(
        rulesOfCreate(withLines(line({ itemType: 't'.repeat(51) }))),
      ).toEqual(['details.0.itemType:too_big'])
      expect(
        rulesOfCreate(withLines(line({ itemName: 'n'.repeat(256) }))),
      ).toEqual(['details.0.itemName:too_big'])
    })

    it.each([
      ['an empty text', ''],
      ['spaces', '  '],
    ])('refuses %s for the name', (_case, itemName) => {
      expect(rulesOfCreate(withLines(line({ itemName })))).toEqual([
        'details.0.itemName:invalid_format',
      ])
    })

    it.each([
      ['a service', 'service', CUT_ID],
      ['a product', 'product', PRODUCT_ID],
    ])('accepts the ID of %s', (_case, itemType, itemId) => {
      expect(rulesOfCreate(withLines(line({ itemType, itemId })))).toEqual([])
    })

    it.each([
      ['a fee', 'fee'],
      ['a type the system does not know', 'ticket'],
      ['a service in capitals', 'Service'],
      ['products', 'products'],
    ])(
      'refuses an ID for %s: nothing says what it would be the ID of',
      (_case, itemType) => {
        const request = withLines(line({ itemType, itemId: CUT_ID }))

        expect(rulesOfCreate(request)).toEqual(['details.0.itemId:custom'])
        expect(messagesOf(request)).toEqual({
          'details.0.itemId':
            'Must be null unless itemType is service or product',
        })
      },
    )

    it('refuses a value that is no ID', () => {
      const rules = rulesOfCreate(
        withLines(line({ itemType: 'service', itemId: 'cut' })),
      )

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(/^details\.0\.itemId:/)
    })

    it('refuses a staff member that is no ID', () => {
      const rules = rulesOfCreate(withLines(line({ staffId: 'stylist' })))

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(/^details\.0\.staffId:/)
    })
  })

  describe('the amounts of a line', () => {
    const rulesOfLine = (overrides: Record<string, unknown>) =>
      rulesOfCreate(withLines(line(overrides)))

    it('takes a quantity from 1', () => {
      expect(
        rulesOfLine({ quantity: 3, unitPrice: 1000, totalAmount: 3100 }),
      ).toEqual([])
      expect(rulesOfLine({ quantity: 0 })).toContain(
        'details.0.quantity:too_small',
      )
      expect(rulesOfLine({ quantity: -1 })).toEqual([
        'details.0.quantity:too_small',
      ])
      expect(rulesOfLine({ quantity: 1.5 })).toEqual([
        'details.0.quantity:invalid_type',
      ])
      expect(rulesOfLine({ quantity: MAX_INTEGER + 1 })).toEqual([
        'details.0.quantity:too_big',
      ])
    })

    it.each(['unitPrice', 'discountAmount', 'taxAmount', 'totalAmount'])(
      'refuses %s that is no amount, and says nothing more of the line',
      (property) => {
        expect(rulesOfLine({ [property]: -1 })).toEqual([
          `details.0.${property}:too_small`,
        ])
        expect(rulesOfLine({ [property]: MAX_INTEGER + 1 })).toEqual([
          `details.0.${property}:too_big`,
        ])
        expect(rulesOfLine({ [property]: 1.5 })).toEqual([
          `details.0.${property}:invalid_type`,
        ])
        expect(rulesOfLine({ [property]: '1000' })).toEqual([
          `details.0.${property}:invalid_type`,
        ])
      },
    )

    it('accepts a line that costs nothing', () => {
      expect(
        rulesOfLine({ unitPrice: 0, taxAmount: 0, totalAmount: 0 }),
      ).toEqual([])
    })

    it('accepts a discount up to the price: quantity times unitPrice', () => {
      expect(
        rulesOfLine({
          quantity: 2,
          unitPrice: 2800,
          discountAmount: 5600,
          taxAmount: 0,
          totalAmount: 0,
        }),
      ).toEqual([])
    })

    it('refuses a discount of a yen more, whatever the tax makes of the total', () => {
      const request = withLines(
        line({
          quantity: 2,
          unitPrice: 2800,
          discountAmount: 5601,
          taxAmount: 1,
          totalAmount: 0,
        }),
      )

      expect(rulesOfCreate(request)).toEqual([
        'details.0.discountAmount:custom',
      ])
      expect(messagesOf(request)).toEqual({
        'details.0.discountAmount':
          'Must not be more than quantity times unitPrice',
      })
    })

    it('measures the discount by the price of all pieces, not of one', () => {
      expect(
        rulesOfLine({
          quantity: 3,
          unitPrice: 1000,
          discountAmount: 2500,
          taxAmount: 50,
          totalAmount: 550,
        }),
      ).toEqual([])
    })

    it.each([
      ['a yen less', 5499],
      ['a yen more', 5501],
      ['the price without the discount', 6100],
      ['the price without the tax', 5000],
      ['nothing', 0],
    ])('refuses a total of %s than the line comes to', (_case, totalAmount) => {
      const request = withLines(
        line({
          quantity: 2,
          unitPrice: 2800,
          discountAmount: 600,
          taxAmount: 500,
          totalAmount,
        }),
      )

      expect(rulesOfCreate(request)).toEqual(['details.0.totalAmount:custom'])
      expect(messagesOf(request)).toEqual({
        'details.0.totalAmount':
          'Must be quantity times unitPrice, less discountAmount, plus taxAmount',
      })
    })

    it('works a price out exactly that a number does not hold', () => {
      // 94,906,267 squared is 9,007,199,515,875,289: odd, and beyond 2^53.
      expect(
        rulesOfLine({
          quantity: 94_906_267,
          unitPrice: 94_906_267,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: MAX_INTEGER,
        }),
      ).toEqual(['details.0.totalAmount:custom'])
    })

    it('accepts the largest total a line holds', () => {
      expect(
        rulesOfLine({
          quantity: 1,
          unitPrice: MAX_INTEGER,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: MAX_INTEGER,
        }),
      ).toEqual([])
    })

    it('takes a commission rate from 0 to 100 with two decimal places', () => {
      const rulesOfRate = (commissionRate: unknown) =>
        rulesOfLine({ commissionRate })

      for (const rate of [0, 0.01, 12.5, 33.33, 99.99, 100]) {
        expect(rulesOfRate(rate)).toEqual([])
      }
      expect(rulesOfRate(-0.01)).toEqual(['details.0.commissionRate:too_small'])
      expect(rulesOfRate(100.01)).toEqual(['details.0.commissionRate:too_big'])
      expect(rulesOfRate(12.345)).toEqual([
        'details.0.commissionRate:not_multiple_of',
      ])
      expect(rulesOfRate('40')).toEqual([
        'details.0.commissionRate:invalid_type',
      ])
    })

    it('takes a commission from 0, and does not work it out from the rate', () => {
      expect(rulesOfLine({ commissionRate: 40, commissionAmount: 0 })).toEqual(
        [],
      )
      expect(
        rulesOfLine({ commissionRate: null, commissionAmount: 999 }),
      ).toEqual([])
      expect(rulesOfLine({ commissionAmount: -1 })).toEqual([
        'details.0.commissionAmount:too_small',
      ])
      expect(rulesOfLine({ commissionAmount: 0.5 })).toEqual([
        'details.0.commissionAmount:invalid_type',
      ])
      expect(rulesOfLine({ commissionAmount: MAX_INTEGER + 1 })).toEqual([
        'details.0.commissionAmount:too_big',
      ])
    })
  })

  describe('the order of the lines', () => {
    const rulesOfOrders = (...sortOrders: unknown[]) =>
      rulesOfCreate(
        withLines(...sortOrders.map((sortOrder) => line({ sortOrder }))),
      )

    it('takes a place from 0', () => {
      expect(rulesOfOrders(0)).toEqual([])
      expect(rulesOfOrders(MAX_INTEGER)).toEqual([])
      expect(rulesOfOrders(-1)).toEqual(['details.0.sortOrder:too_small'])
      expect(rulesOfOrders(0.5)).toEqual(['details.0.sortOrder:invalid_type'])
    })

    it('accepts places in any order and with gaps', () => {
      expect(rulesOfOrders(5, 2, 9)).toEqual([])
    })

    it('refuses a line at the place of an earlier one, and says so', () => {
      const request = withLines(
        line({ sortOrder: 0 }),
        line({ sortOrder: 1 }),
        line({ sortOrder: 0 }),
      )

      expect(rulesOfCreate(request)).toEqual(['details.2.sortOrder:custom'])
      expect(messagesOf(request)).toEqual({
        'details.2.sortOrder':
          'Must not repeat the sortOrder of an earlier line',
      })
    })

    it('reports every line after the first at a place', () => {
      expect(rulesOfOrders(3, 3, 3, 4, 4)).toEqual([
        'details.1.sortOrder:custom',
        'details.2.sortOrder:custom',
        'details.4.sortOrder:custom',
      ])
    })
  })

  it('reports every broken rule at once', () => {
    const rules = rulesOfCreate({
      ...toNobody({ pointsUsed: 5, notes: '' }),
      details: [
        line({ itemName: '', totalAmount: 1 }),
        line({ itemType: 'fee', itemId: CUT_ID, commissionRate: 101 }),
      ],
    })

    expect(rules.toSorted()).toEqual([
      'details.0.itemName:invalid_format',
      'details.0.totalAmount:custom',
      'details.1.commissionRate:too_big',
      'details.1.itemId:custom',
      'details.1.sortOrder:custom',
      'notes:invalid_format',
      'pointsUsed:custom',
    ])
  })

  it('goes on to the rules of the lines and of the sale after a discount that is more than the price', () => {
    const rules = rulesOfCreate({
      ...toNobody({ pointsEarned: 5 }),
      details: [
        line({
          quantity: 1,
          unitPrice: 1000,
          discountAmount: 1500,
          taxAmount: 600,
          totalAmount: 100,
        }),
        line(),
      ],
    })

    expect(rules.toSorted()).toEqual([
      'details.0.discountAmount:custom',
      'details.1.sortOrder:custom',
      'pointsEarned:custom',
    ])
  })
})

describe('saleSearchRequestSchema', () => {
  it('accepts a search without a condition', () => {
    expect(parseSearch({})).toEqual({ type: 'success', data: {} })
  })

  it('accepts every condition together and returns the search unchanged', () => {
    const search = {
      limit: 50,
      cursor: SALE_ID,
      salonId: SALON_ID,
      customerId: CUSTOMER_ID,
      bookingId: BOOKING_ID,
      paymentStatus: 'completed',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    }

    expect(parseSearch(search)).toEqual({ type: 'success', data: search })
  })

  it.each([
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded',
    'partial_refund',
  ])('accepts the payment status %s', (paymentStatus) => {
    expect(parseSearch({ paymentStatus }).type).toBe('success')
  })

  it.each([
    ['a status that does not exist', 'paid'],
    ['a status in capitals', 'PENDING'],
    ['an empty status', ''],
  ])('refuses %s', (_case, paymentStatus) => {
    expect(rulesOfSearch({ paymentStatus })).toEqual([
      'paymentStatus:invalid_value',
    ])
  })

  it('takes a limit from 1 to 100', () => {
    expect(parseSearch({ limit: 1 }).type).toBe('success')
    expect(parseSearch({ limit: 100 }).type).toBe('success')
    expect(rulesOfSearch({ limit: 0 })).toEqual(['limit:too_small'])
    expect(rulesOfSearch({ limit: 101 })).toEqual(['limit:too_big'])
    expect(rulesOfSearch({ limit: 1.5 })).toEqual(['limit:invalid_type'])
    expect(rulesOfSearch({ limit: '20' })).toEqual(['limit:invalid_type'])
  })

  it.each(['cursor', 'salonId', 'customerId', 'bookingId'])(
    'refuses a value of %s that is no ID',
    (property) => {
      const rules = rulesOfSearch({ [property]: 'not-an-id' })

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(new RegExp(`^${property}:`))
    },
  )

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['a time', '2026-11-20T03:40:00Z'],
    ['another order of the parts', '20/11/2026'],
    ['an empty text', ''],
  ])('refuses %s for a day', (_case, day) => {
    expect(rulesOfSearch({ startDate: day })).toEqual([
      'startDate:invalid_format',
    ])
    expect(rulesOfSearch({ endDate: day })).toEqual(['endDate:invalid_format'])
  })

  it('accepts one day as both ends, and either end alone', () => {
    expect(
      parseSearch({ startDate: '2026-11-20', endDate: '2026-11-20' }).type,
    ).toBe('success')
    expect(parseSearch({ startDate: '2026-11-20' }).type).toBe('success')
    expect(parseSearch({ endDate: '2026-11-20' }).type).toBe('success')
  })

  it('refuses a last day before the first one, and says so', () => {
    const result = parseSearch({
      startDate: '2026-11-20',
      endDate: '2026-11-19',
    })

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: 'Invalid',
        issues: [
          {
            field: 'endDate',
            rule: 'custom',
            message: 'Must not be earlier than startDate',
          },
        ],
      },
    })
  })

  it.each([
    ['a staff member', 'staffId'],
    ['a sale number', 'saleNumber'],
    ['whether a sale is void', 'isVoid'],
    ['a page number', 'page'],
  ])('refuses %s, which the search does not have', (_case, property) => {
    expect(rulesOfSearch({ [property]: 'x' })).toEqual([
      `${property}:unrecognized_keys`,
    ])
  })

  it('refuses null for a condition: one that is not wanted is left out', () => {
    expect(rulesOfSearch({ paymentStatus: null })).toEqual([
      'paymentStatus:invalid_value',
    ])
    expect(rulesOfSearch({ salonId: null })).toHaveLength(1)
  })
})

describe('saleUpdateRequestSchema', () => {
  /** Everything a correction can name, each with a value it takes. */
  const stated = {
    customerId: CUSTOMER_ID,
    staffId: STAFF_MEMBER_ID,
    bookingId: BOOKING_ID,
    saleTime: '2026-11-20T03:40:00.000Z',
    pointsUsed: 100,
    pointsEarned: 126,
    notes: '現金でお支払い',
    details: [line()],
  }

  it('accepts every property at once and returns them as they were written', () => {
    expect(parseUpdate(stated)).toStrictEqual({ type: 'success', data: stated })
  })

  it.each(Object.entries(stated))(
    'accepts %s alone and returns no other property',
    (property, value) => {
      expect(parseUpdate({ [property]: value })).toStrictEqual({
        type: 'success',
        data: { [property]: value },
      })
    },
  )

  it.each([
    'customerId',
    'staffId',
    'bookingId',
    'pointsUsed',
    'pointsEarned',
    'notes',
  ])('accepts null for %s, which empties it', (property) => {
    expect(parseUpdate({ [property]: null })).toStrictEqual({
      type: 'success',
      data: { [property]: null },
    })
  })

  it.each([
    ['saleTime', 'invalid_type'],
    ['details', 'invalid_type'],
  ])('refuses null for %s: a sale has it', (property, rule) => {
    expect(rulesOfUpdate({ [property]: null })).toEqual([`${property}:${rule}`])
  })

  it.each(Object.keys(stated))(
    'refuses %s that is stated as undefined: a property is there with a value or it is not there',
    (property) => {
      expect(rulesOfUpdate({ ...stated, [property]: undefined })).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  it('refuses a request that states nothing, with one error for the request as a whole', () => {
    expect(rulesOfUpdate({})).toEqual([':custom'])
    expect(parseUpdate({})).toMatchObject({
      type: 'error',
      error: {
        issues: [{ message: ruleMessages.atLeastOneProperty }],
      },
    })
  })

  it.each([
    ['the salon: a sale does not move', 'salonId', SALON_ID],
    ['the number of the sale', 'saleNumber', 'SL-0000-0001'],
    ['the day, which follows from the time', 'saleDate', '2026-11-20'],
    ['the subtotal, which the lines come to', 'subtotal', 1000],
    ['the discount, which the lines come to', 'discountAmount', 0],
    ['the tax, which the lines come to', 'taxAmount', 100],
    ['the total, which the lines come to', 'totalAmount', 1100],
    [
      'the payment status, which the payments decide',
      'paymentStatus',
      'completed',
    ],
    ['whether the sale is void, which a void decides', 'isVoid', true],
    ['the time of a void', 'voidedAt', '2026-11-20T05:00:00Z'],
    ['the reason of a void', 'voidReason', '二重登録'],
    ['the payments', 'payments', []],
    ['the ID', 'id', SALE_ID],
  ])('refuses %s', (_case, property, value) => {
    expect(rulesOfUpdate({ ...stated, [property]: value })).toEqual([
      `${property}:unrecognized_keys`,
    ])
  })

  it('reports an unknown property as such, not as a request that states nothing', () => {
    expect(rulesOfUpdate({ isVoid: true })).toEqual([
      'isVoid:unrecognized_keys',
    ])
  })

  it.each([
    ['a list', [stated]],
    ['a text', 'notes'],
    ['nothing', undefined],
    ['null', null],
  ])('refuses %s for the request', (_case, input) => {
    expect(rulesOfUpdate(input)).toEqual([':invalid_type'])
  })

  it('spells the time in one way, as a create request does', () => {
    expect(parseUpdate({ saleTime: '2026-11-20T03:40:00Z' })).toEqual({
      type: 'success',
      data: { saleTime: '2026-11-20T03:40:00.000Z' },
    })
  })

  it.each([
    [
      'a customer that is no ID',
      { customerId: 'cust-1' },
      'customerId:invalid_format',
    ],
    [
      'a staff member that is no ID',
      { staffId: 'staff-1' },
      'staffId:invalid_format',
    ],
    [
      'a booking that is no ID',
      { bookingId: 'BK-0000-0001' },
      'bookingId:invalid_format',
    ],
    [
      'a day for the time',
      { saleTime: '2026-11-20' },
      'saleTime:invalid_format',
    ],
    [
      'a time in another zone',
      { saleTime: '2026-11-20T12:40:00+09:00' },
      'saleTime:invalid_format',
    ],
    ['points below 0', { pointsUsed: -1 }, 'pointsUsed:too_small'],
    [
      'more points than the column holds',
      { pointsEarned: MAX_INTEGER + 1 },
      'pointsEarned:too_big',
    ],
    ['half a point', { pointsEarned: 0.5 }, 'pointsEarned:invalid_type'],
    ['notes that say nothing', { notes: '  ' }, 'notes:invalid_format'],
    ['no line', { details: [] }, 'details:too_small'],
    [
      'one line that is not in a list',
      { details: line() },
      'details:invalid_type',
    ],
  ])('refuses %s, as a create request does', (_case, change, rule) => {
    expect(rulesOfUpdate(change)).toEqual([rule])
  })

  it(`takes up to ${MAX_SALE_DETAILS} lines`, () => {
    const lines = (count: number) =>
      Array.from({ length: count }, (_value, sortOrder) => line({ sortOrder }))

    expect(rulesOfUpdate({ details: lines(100) })).toEqual([])
    expect(rulesOfUpdate({ details: lines(101) })).toEqual(['details:too_big'])
  })

  it('holds every line to the rules of a line', () => {
    expect(
      rulesOfUpdate({
        details: [
          line({ totalAmount: 1000 }),
          line({ sortOrder: 1, itemName: '' }),
          line({ sortOrder: 2, itemId: CUT_ID }),
          line({ sortOrder: 3, salonId: SALON_ID }),
          line({ sortOrder: 3 }),
        ],
      }).toSorted(),
    ).toEqual([
      'details.0.totalAmount:custom',
      'details.1.itemName:invalid_format',
      'details.2.itemId:custom',
      'details.3.salonId:unrecognized_keys',
      'details.4.sortOrder:custom',
    ])
  })

  it.each(['pointsUsed', 'pointsEarned'])(
    'does not hold %s to the customer of the request: the sale as it is afterwards is held to that rule',
    (property) => {
      expect(rulesOfUpdate({ customerId: null, [property]: 10 })).toEqual([])
      expect(rulesOfUpdate({ [property]: 10 })).toEqual([])
    },
  )

  it('reports every broken rule at once', () => {
    expect(
      rulesOfUpdate({
        customerId: 'cust-1',
        saleTime: 'noon',
        pointsUsed: -1,
        notes: '',
        details: [],
        salonId: SALON_ID,
      }).toSorted(),
    ).toEqual([
      'customerId:invalid_format',
      'details:too_small',
      'notes:invalid_format',
      'pointsUsed:too_small',
      'saleTime:invalid_format',
      'salonId:unrecognized_keys',
    ])
  })
})

describe('saleVoidRequestSchema', () => {
  it('accepts a reason and returns it as it was written', () => {
    expect(parseVoid({ voidReason: ' 二重登録 ' })).toStrictEqual({
      type: 'success',
      data: { voidReason: ' 二重登録 ' },
    })
  })

  it('accepts null: a void of which no reason is kept', () => {
    expect(parseVoid({ voidReason: null })).toStrictEqual({
      type: 'success',
      data: { voidReason: null },
    })
  })

  it('sets no limit to the length of the reason: the column has none', () => {
    expect(rulesOfVoid({ voidReason: 'あ'.repeat(10_000) })).toEqual([])
  })

  it.each([
    ['a request without the reason', {}, 'voidReason:invalid_type'],
    [
      'a reason stated as undefined',
      { voidReason: undefined },
      'voidReason:invalid_type',
    ],
    ['an empty reason', { voidReason: '' }, 'voidReason:invalid_format'],
    [
      'a reason of spaces',
      { voidReason: ' \t\n' },
      'voidReason:invalid_format',
    ],
    ['a number for the reason', { voidReason: 1 }, 'voidReason:invalid_type'],
    [
      'a list of reasons',
      { voidReason: ['二重登録'] },
      'voidReason:invalid_type',
    ],
  ])('refuses %s', (_case, input, rule) => {
    expect(rulesOfVoid(input)).toEqual([rule])
  })

  it.each([
    ['whether the sale is void', 'isVoid', true],
    ['the time of the void', 'voidedAt', '2026-11-20T05:00:00Z'],
    ['the sale', 'id', SALE_ID],
    ['notes', 'notes', '二重登録'],
  ])(
    'refuses %s: a void states its reason and nothing else',
    (_case, property, value) => {
      expect(rulesOfVoid({ voidReason: null, [property]: value })).toEqual([
        `${property}:unrecognized_keys`,
      ])
    },
  )

  it.each([
    ['a list', [{ voidReason: null }]],
    ['a text', '二重登録'],
    ['nothing', undefined],
    ['null', null],
  ])('refuses %s for the request', (_case, input) => {
    expect(rulesOfVoid(input)).toEqual([':invalid_type'])
  })
})

describe('saleCalculateRequestSchema', () => {
  const parseCalculation = (input: unknown) =>
    parseWith(saleCalculateRequestSchema, input, 'Invalid')

  const rulesOfCalculation = (input: unknown): string[] =>
    rulesBrokenBy(saleCalculateRequestSchema, input)

  it('accepts a calculation and returns it as it was written', () => {
    expect(parseCalculation(saleCalculateRequest())).toStrictEqual({
      type: 'success',
      data: saleCalculateRequest(),
    })
  })

  it.each([
    [
      'a visit without a booking',
      { ...saleCalculateRequest(), bookingId: null },
    ],
    [
      'a booking with nothing added',
      { ...saleCalculateRequest(), services: [] },
    ],
    [
      'nothing but a salon: whether that comes to a line is told by the booking',
      { salonId: SALON_ID, bookingId: null, services: [] },
    ],
  ])('accepts %s', (_case, input) => {
    expect(rulesOfCalculation(input)).toEqual([])
  })

  it('keeps a service that is named more than once, every time, in its place', () => {
    const services = [CUT_ID, TREATMENT_ID, CUT_ID, CUT_ID]

    const parsed = parseCalculation({ ...saleCalculateRequest(), services })

    expect(parsed).toMatchObject({ type: 'success', data: { services } })
  })

  it('takes as many services as a sale has lines, and no more', () => {
    const services = (count: number) =>
      Array.from({ length: count }, () => CUT_ID)

    expect(
      rulesOfCalculation({
        ...saleCalculateRequest(),
        services: services(MAX_SALE_DETAILS),
      }),
    ).toEqual([])
    expect(
      rulesOfCalculation({
        ...saleCalculateRequest(),
        services: services(MAX_SALE_DETAILS + 1),
      }),
    ).toEqual(['services:too_big'])
  })

  it.each([['salonId'], ['bookingId'], ['services']])(
    'refuses a request without %s: every key is stated',
    (key) => {
      const rest = Object.fromEntries(
        Object.entries(saleCalculateRequest()).filter(([name]) => name !== key),
      )

      expect(rulesOfCalculation(rest)).toEqual([`${key}:invalid_type`])
    },
  )

  it.each([['salonId'], ['bookingId'], ['services']])(
    'refuses %s stated as undefined',
    (key) => {
      expect(
        rulesOfCalculation({ ...saleCalculateRequest(), [key]: undefined }),
      ).toEqual([`${key}:invalid_type`])
    },
  )

  it.each<[string, Record<string, unknown>, string[]]>([
    [
      'a salon that is no ID',
      { salonId: 'salon-1' },
      ['salonId:invalid_format'],
    ],
    ['no salon', { salonId: null }, ['salonId:invalid_type']],
    [
      'a booking that is no ID',
      { bookingId: 'BK-7Z3K-0QXM' },
      ['bookingId:invalid_format'],
    ],
    [
      'a service that is no ID, among others',
      { services: [CUT_ID, 'cut', TREATMENT_ID] },
      ['services.1:invalid_format'],
    ],
    [
      'null among the services',
      { services: [null] },
      ['services.0:invalid_type'],
    ],
    ['a service for the list', { services: CUT_ID }, ['services:invalid_type']],
    ['no list of services', { services: null }, ['services:invalid_type']],
    [
      'everything at once',
      { salonId: '', bookingId: 1, services: ['x', 'y'] },
      [
        'salonId:invalid_format',
        'bookingId:invalid_type',
        'services.0:invalid_format',
        'services.1:invalid_format',
      ],
    ],
  ])('refuses %s', (_case, change, rules) => {
    expect(
      rulesOfCalculation({ ...saleCalculateRequest(), ...change }),
    ).toEqual(rules)
  })

  it.each([
    [
      'a discount code: there are no discount codes',
      'discountCode',
      'WELCOME10',
    ],
    ['points to use: what a point is worth is not known', 'pointsToUse', 100],
    [
      'a customer: nothing of a customer changes what a sale comes to',
      'customerId',
      CUSTOMER_ID,
    ],
    ['notes', 'notes', '常連'],
    ['the lines of a sale', 'details', []],
  ])('refuses %s', (_case, property, value) => {
    expect(
      rulesOfCalculation({ ...saleCalculateRequest(), [property]: value }),
    ).toEqual([`${property}:unrecognized_keys`])
  })

  it.each([
    ['a list', [saleCalculateRequest()]],
    ['a text', SALON_ID],
    ['nothing', undefined],
    ['null', null],
  ])('refuses %s for the request', (_case, input) => {
    expect(rulesOfCalculation(input)).toEqual([':invalid_type'])
  })
})
