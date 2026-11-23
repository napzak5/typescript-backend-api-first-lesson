import { textIn } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  brokenRules,
  MADE_UP_HEADLINE,
  SALON_ID,
} from '../../__tests__/fixtures/fixtures'
import {
  PAYMENT_METHOD_ID,
  paymentMethodCreateRequest,
} from '../../__tests__/fixtures/payment-method-fixtures'
import { parseWith } from '../../shared'
import {
  paymentMethodCreateRequestSchema,
  paymentMethodSearchRequestSchema,
  paymentMethodUpdateRequestSchema,
} from '../payment-method.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, MADE_UP_HEADLINE)
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** What a refused request is told, by `field`. */
const messagesOf = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): Record<string, string> => {
  const result = parseWith(schema, input, MADE_UP_HEADLINE)
  return result.type === 'error' && result.error.type === 'validation'
    ? Object.fromEntries(
        result.error.issues.map(({ field, message }) => [
          field,
          textIn(message, 'en'),
        ]),
      )
    : {}
}

/** The largest value of an `integer` column. */
const MAX_INTEGER = 2_147_483_647

/** A request without limits, so that a test of one limit is not a test of their order. */
const withoutLimits = (): Record<string, unknown> => ({
  ...paymentMethodCreateRequest(),
  minimumAmount: null,
  maximumAmount: null,
})

/**
 * What breaks the rule of a property, in a create request and, when the
 * property is present, in an update request.
 */
const violations: [string, Record<string, unknown>, string[]][] = [
  ['an empty name', { displayName: '' }, ['displayName:invalid_format']],
  [
    'a name of only spaces',
    { displayName: '   ' },
    ['displayName:invalid_format'],
  ],
  [
    'a name of only full-width spaces',
    { displayName: '　　' },
    ['displayName:invalid_format'],
  ],
  [
    'a name of 101 characters',
    { displayName: 'a'.repeat(101) },
    ['displayName:too_big'],
  ],
  ['null as the name', { displayName: null }, ['displayName:invalid_type']],
  [
    'a name that is not text',
    { displayName: 42 },
    ['displayName:invalid_type'],
  ],
  ['an empty description', { description: '' }, ['description:invalid_format']],
  [
    'a description of only whitespace',
    { description: ' \n\t' },
    ['description:invalid_format'],
  ],
  [
    'a description that is not text',
    { description: 42 },
    ['description:invalid_type'],
  ],
  [
    'an empty processor name',
    { processorName: '' },
    ['processorName:invalid_format'],
  ],
  [
    'a processor name of only spaces',
    { processorName: '  ' },
    ['processorName:invalid_format'],
  ],
  [
    'a processor name of 101 characters',
    { processorName: 'a'.repeat(101) },
    ['processorName:too_big'],
  ],
  [
    'a processor name that is not text',
    { processorName: true },
    ['processorName:invalid_type'],
  ],
  ['a negative fee', { fee: -0.01 }, ['fee:too_small']],
  ['a fee above 100 per cent', { fee: 100.01 }, ['fee:too_big']],
  ['a fee with three decimals', { fee: 3.255 }, ['fee:not_multiple_of']],
  ['a fee that is text', { fee: '3.6' }, ['fee:invalid_type']],
  ['a lower limit of 0', { minimumAmount: 0 }, ['minimumAmount:too_small']],
  [
    'a negative lower limit',
    { minimumAmount: -1 },
    ['minimumAmount:too_small'],
  ],
  [
    'a lower limit that is not a whole number',
    { minimumAmount: 1.5 },
    ['minimumAmount:invalid_type'],
  ],
  [
    'a lower limit above the largest integer of the column',
    { minimumAmount: MAX_INTEGER + 1 },
    ['minimumAmount:too_big'],
  ],
  [
    'a lower limit that is text',
    { minimumAmount: '1000' },
    ['minimumAmount:invalid_type'],
  ],
  ['an upper limit of 0', { maximumAmount: 0 }, ['maximumAmount:too_small']],
  [
    'a negative upper limit',
    { maximumAmount: -1 },
    ['maximumAmount:too_small'],
  ],
  [
    'an upper limit that is not a whole number',
    { maximumAmount: 1000.5 },
    ['maximumAmount:invalid_type'],
  ],
  [
    'an upper limit above the largest integer of the column',
    { maximumAmount: MAX_INTEGER + 1 },
    ['maximumAmount:too_big'],
  ],
  [
    'an upper limit that is text',
    { maximumAmount: '1000' },
    ['maximumAmount:invalid_type'],
  ],
  [
    'text for whether it is taken online',
    { isOnlineEnabled: 'true' },
    ['isOnlineEnabled:invalid_type'],
  ],
  [
    'null for whether it is taken online',
    { isOnlineEnabled: null },
    ['isOnlineEnabled:invalid_type'],
  ],
  [
    'a number for whether it is taken at the salon',
    { isOfflineEnabled: 1 },
    ['isOfflineEnabled:invalid_type'],
  ],
  [
    'null for whether it is taken at the salon',
    { isOfflineEnabled: null },
    ['isOfflineEnabled:invalid_type'],
  ],
  ['a negative sort order', { sortOrder: -1 }, ['sortOrder:too_small']],
  [
    'a sort order that is not a whole number',
    { sortOrder: 1.5 },
    ['sortOrder:invalid_type'],
  ],
  [
    'a sort order above the largest integer of the column',
    { sortOrder: MAX_INTEGER + 1 },
    ['sortOrder:too_big'],
  ],
  ['a sort order that is text', { sortOrder: '2' }, ['sortOrder:invalid_type']],
  ['null as the sort order', { sortOrder: null }, ['sortOrder:invalid_type']],
  [
    'isActive that is not a boolean',
    { isActive: 'yes' },
    ['isActive:invalid_type'],
  ],
  ['null as isActive', { isActive: null }, ['isActive:invalid_type']],
  [
    'the settings of a payment processor',
    { processorConfig: { apiKey: 'secret' } },
    ['processorConfig:unrecognized_keys'],
  ],
  [
    'the salon, which is given by the path',
    { salonId: SALON_ID },
    ['salonId:unrecognized_keys'],
  ],
  [
    'what the server assigns',
    {
      id: PAYMENT_METHOD_ID,
      createdAt: '2026-11-14T09:00:00.000Z',
      updatedAt: '2026-11-14T09:00:00.000Z',
    },
    [
      'id:unrecognized_keys',
      'createdAt:unrecognized_keys',
      'updatedAt:unrecognized_keys',
    ],
  ],
  [
    'a property that does not exist',
    { displayOrder: 1 },
    ['displayOrder:unrecognized_keys'],
  ],
]

/** Values at the edge of a rule that still satisfy it. */
const accepted: [string, Record<string, unknown>][] = [
  ['a name of one character', { displayName: 'a' }],
  ['a name of 100 characters', { displayName: 'a'.repeat(100) }],
  ['a name with spaces around it', { displayName: '  現金  ' }],
  ['a description of any length', { description: 'a'.repeat(5000) }],
  ['a processor name of 100 characters', { processorName: 'a'.repeat(100) }],
  ['a fee of 0', { fee: 0 }],
  ['a fee of 100 per cent', { fee: 100 }],
  ['a fee of a hundredth of a per cent', { fee: 0.01 }],
  ['a fee with two decimals', { fee: 3.25 }],
  ['a fee with one decimal', { fee: 2.9 }],
  ['a lower limit of 1', { minimumAmount: 1 }],
  ['the largest upper limit the column holds', { maximumAmount: MAX_INTEGER }],
  ['a sort order of 0', { sortOrder: 0 }],
  ['the largest sort order the column holds', { sortOrder: MAX_INTEGER }],
  ['a payment method that is not active', { isActive: false }],
  [
    'a payment method that is taken nowhere',
    { isOnlineEnabled: false, isOfflineEnabled: false },
  ],
]

/** Limits that are in order, and limits that are not. */
const inOrder: [string, number | null, number | null][] = [
  ['no limit', null, null],
  ['a lower limit alone', 1000, null],
  ['an upper limit alone', null, 1000],
  ['equal limits', 5000, 5000],
  ['a lower limit one below the upper one', 4999, 5000],
  ['the widest limits', 1, MAX_INTEGER],
]
const outOfOrder: [string, number, number][] = [
  ['a lower limit one above the upper one', 5001, 5000],
  ['the limits the wrong way round', MAX_INTEGER, 1],
]

describe('paymentMethodCreateRequestSchema', () => {
  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const request = paymentMethodCreateRequest()

    const result = parseWith(
      paymentMethodCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('accepts null for the five properties that may be unset and keeps it', () => {
    const request = {
      ...paymentMethodCreateRequest(),
      description: null,
      processorName: null,
      fee: null,
      minimumAmount: null,
      maximumAmount: null,
    }

    const result = parseWith(
      paymentMethodCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each([
    'cash',
    'credit_card',
    'debit_card',
    'e_money',
    'qr_payment',
    'bank_transfer',
    'point',
  ])('accepts the method %s', (method) => {
    const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, {
      ...paymentMethodCreateRequest(),
      method,
    })

    expect(rules).toEqual([])
  })

  it.each([
    ['a method that is none', 'paypal'],
    ['a method in capitals', 'CASH'],
    ['a method that is a number', 1],
    ['null as the method', null],
  ])('rejects %s', (_case, method) => {
    const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, {
      ...paymentMethodCreateRequest(),
      method,
    })

    expect(rules).toEqual(['method:invalid_value'])
  })

  it.each(accepted)('accepts %s and keeps it as it is', (_case, change) => {
    const request = { ...withoutLimits(), ...change }

    const result = parseWith(
      paymentMethodCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('counts the characters of a name, not the units of its encoding', () => {
    // 𠮷 (U+20BB7, as in 𠮷野) lies outside the Basic Multilingual Plane.
    const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, {
      ...paymentMethodCreateRequest(),
      displayName: '𠮷'.repeat(100),
      processorName: '𠮷'.repeat(100),
    })

    expect(rules).toEqual([])
  })

  it.each(violations)('rejects %s', (_case, change, expected) => {
    const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, {
      ...withoutLimits(),
      ...change,
    })

    expect(rules).toEqual(expected)
  })

  it.each(inOrder)('accepts %s', (_case, minimumAmount, maximumAmount) => {
    const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, {
      ...paymentMethodCreateRequest(),
      minimumAmount,
      maximumAmount,
    })

    expect(rules).toEqual([])
  })

  it.each(outOfOrder)(
    'rejects %s, and says so of the upper limit',
    (_case, minimumAmount, maximumAmount) => {
      const messages = messagesOf(paymentMethodCreateRequestSchema, {
        ...paymentMethodCreateRequest(),
        minimumAmount,
        maximumAmount,
      })

      expect(messages).toEqual({
        maximumAmount: 'Must not be less than minimumAmount',
      })
    },
  )

  it.each([
    [
      'an upper limit of 0',
      { minimumAmount: 5000, maximumAmount: 0 },
      ['maximumAmount:too_small'],
    ],
    [
      'a lower limit above the largest integer',
      { minimumAmount: MAX_INTEGER + 1, maximumAmount: 5000 },
      ['minimumAmount:too_big'],
    ],
    [
      'an upper limit that is text',
      { minimumAmount: 5000, maximumAmount: '4000' },
      ['maximumAmount:invalid_type'],
    ],
  ])(
    'does not compare the limits when one of them is not a limit: %s',
    (_case, limits, expected) => {
      const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, {
        ...paymentMethodCreateRequest(),
        ...limits,
      })

      expect(rules).toEqual(expected)
    },
  )

  it('reports limits out of order together with what else is wrong', () => {
    const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, {
      ...paymentMethodCreateRequest(),
      displayName: ' ',
      fee: 100.5,
      sortOrder: -1,
      minimumAmount: 5001,
      maximumAmount: 5000,
    })

    expect(rules).toEqual([
      'displayName:invalid_format',
      'fee:too_big',
      'sortOrder:too_small',
      'maximumAmount:custom',
    ])
  })

  it.each(Object.keys(paymentMethodCreateRequest()))(
    'rejects a request that leaves %s out',
    (property) => {
      const request: Record<string, unknown> = paymentMethodCreateRequest()
      const withoutProperty = Object.fromEntries(
        Object.entries(request).filter(([name]) => name !== property),
      )

      const rules = rulesBrokenBy(
        paymentMethodCreateRequestSchema,
        withoutProperty,
      )

      expect(rules.map((rule) => rule.replace(/:.*$/, ''))).toEqual([property])
    },
  )

  it('rejects a request that leaves the fee out as a broken rule of its type: null has to be said', () => {
    const { fee: _fee, ...withoutFee } = paymentMethodCreateRequest()

    const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, withoutFee)

    expect(rules).toEqual(['fee:invalid_type'])
  })

  it('reports every broken rule at once, in the order of the properties', () => {
    const rules = rulesBrokenBy(paymentMethodCreateRequestSchema, {
      ...paymentMethodCreateRequest(),
      method: 'paypal',
      displayName: ' ',
      fee: 101,
      minimumAmount: 0,
      sortOrder: -1,
      isActive: 'yes',
      processorConfig: {},
    })

    expect(rules).toEqual([
      'method:invalid_value',
      'displayName:invalid_format',
      'fee:too_big',
      'minimumAmount:too_small',
      'sortOrder:too_small',
      'isActive:invalid_type',
      'processorConfig:unrecognized_keys',
    ])
  })

  it.each([
    ['text', 'method=cash'],
    ['a list', [paymentMethodCreateRequest()]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(paymentMethodCreateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('paymentMethodUpdateRequestSchema', () => {
  const { method: _method, ...everything } = paymentMethodCreateRequest()

  it('accepts everything a payment method has but its method, and returns it unchanged', () => {
    const result = parseWith(
      paymentMethodUpdateRequestSchema,
      everything,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: everything })
  })

  it.each(Object.entries(everything))(
    'accepts %s alone and returns only that',
    (property, value) => {
      const request = { [property]: value }

      const result = parseWith(
        paymentMethodUpdateRequestSchema,
        request,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it.each([
    'description',
    'processorName',
    'fee',
    'minimumAmount',
    'maximumAmount',
  ])('accepts null for %s, which takes the value away', (property) => {
    const request = { [property]: null }

    const result = parseWith(
      paymentMethodUpdateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each(accepted)('accepts %s and keeps it as it is', (_case, change) => {
    const result = parseWith(
      paymentMethodUpdateRequestSchema,
      change,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: change })
  })

  it.each(violations)('rejects %s', (_case, change, expected) => {
    expect(rulesBrokenBy(paymentMethodUpdateRequestSchema, change)).toEqual(
      expected,
    )
  })

  it.each([
    ['another method', 'cash'],
    ['the method the payment method has', 'credit_card'],
    ['a method that is none', 'paypal'],
  ])(
    'rejects %s: the method of a payment method is not changed',
    (_case, method) => {
      expect(
        rulesBrokenBy(paymentMethodUpdateRequestSchema, {
          method,
          displayName: 'Card',
        }),
      ).toEqual(['method:unrecognized_keys'])
    },
  )

  it('rejects a request that names nothing', () => {
    expect(messagesOf(paymentMethodUpdateRequestSchema, {})).toEqual({
      '': 'At least one property must be specified',
    })
    expect(rulesBrokenBy(paymentMethodUpdateRequestSchema, {})).toEqual([
      ':custom',
    ])
  })

  it.each(Object.keys(everything))(
    'rejects %s that is present without a value: a property is stated or left out',
    (property) => {
      const rules = rulesBrokenBy(paymentMethodUpdateRequestSchema, {
        [property]: undefined,
      })

      expect(rules.map((rule) => rule.replace(/:.*$/, ''))).toEqual([property])
    },
  )

  it('says of a request with only a property that is not known that the property is not known, not that it names nothing', () => {
    expect(
      rulesBrokenBy(paymentMethodUpdateRequestSchema, { salonId: SALON_ID }),
    ).toEqual(['salonId:unrecognized_keys'])
  })

  it.each(inOrder)(
    'accepts %s when both limits are named',
    (_case, minimumAmount, maximumAmount) => {
      expect(
        rulesBrokenBy(paymentMethodUpdateRequestSchema, {
          minimumAmount,
          maximumAmount,
        }),
      ).toEqual([])
    },
  )

  it.each(outOfOrder)(
    'rejects %s when both limits are named, and says so of the upper limit',
    (_case, minimumAmount, maximumAmount) => {
      expect(
        messagesOf(paymentMethodUpdateRequestSchema, {
          minimumAmount,
          maximumAmount,
        }),
      ).toEqual({ maximumAmount: 'Must not be less than minimumAmount' })
    },
  )

  it('does not compare the limits when one of them is not a limit', () => {
    expect(
      rulesBrokenBy(paymentMethodUpdateRequestSchema, {
        minimumAmount: 0,
        maximumAmount: -1,
      }),
    ).toEqual(['minimumAmount:too_small', 'maximumAmount:too_small'])
  })

  it('reports limits out of order together with what else is wrong', () => {
    expect(
      rulesBrokenBy(paymentMethodUpdateRequestSchema, {
        displayName: '',
        minimumAmount: 2,
        maximumAmount: 1,
      }),
    ).toEqual(['displayName:invalid_format', 'maximumAmount:custom'])
  })

  it.each([
    ['the lower limit', { minimumAmount: MAX_INTEGER }],
    ['the upper limit', { maximumAmount: 1 }],
  ])(
    'accepts %s alone, whatever it is: what it goes with is stored',
    (_case, request) => {
      expect(rulesBrokenBy(paymentMethodUpdateRequestSchema, request)).toEqual(
        [],
      )
    },
  )

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(paymentMethodUpdateRequestSchema, {
      displayName: '',
      fee: -1,
      isActive: 'no',
    })

    expect(rules).toEqual([
      'displayName:invalid_format',
      'fee:too_small',
      'isActive:invalid_type',
    ])
  })

  it.each([
    ['text', 'displayName=Card'],
    ['a list', [{ displayName: 'Card' }]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(paymentMethodUpdateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('paymentMethodSearchRequestSchema', () => {
  it('accepts a request without any parameter', () => {
    expect(
      parseWith(paymentMethodSearchRequestSchema, {}, MADE_UP_HEADLINE),
    ).toEqual({
      type: 'success',
      data: {},
    })
  })

  it.each([
    ['the smallest limit', { limit: 1 }],
    ['the largest limit', { limit: 100 }],
    ['a cursor', { cursor: PAYMENT_METHOD_ID }],
    ['a method', { method: 'qr_payment' }],
    ['active payment methods only', { isActive: true }],
    ['payment methods that are not active only', { isActive: false }],
    [
      'every parameter together',
      {
        limit: 50,
        cursor: PAYMENT_METHOD_ID,
        method: 'cash',
        isActive: false,
      },
    ],
  ])('accepts %s and returns the request unchanged', (_case, request) => {
    expect(
      parseWith(paymentMethodSearchRequestSchema, request, MADE_UP_HEADLINE),
    ).toEqual({ type: 'success', data: request })
  })

  it('reads a cursor written in upper case as the lower-case ID, the one the database returns', () => {
    expect(
      parseWith(
        paymentMethodSearchRequestSchema,
        { cursor: PAYMENT_METHOD_ID.toUpperCase() },
        MADE_UP_HEADLINE,
      ),
    ).toEqual({ type: 'success', data: { cursor: PAYMENT_METHOD_ID } })
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a negative limit', { limit: -1 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a fractional limit', { limit: 1.5 }, ['limit:invalid_type']],
    ['a limit that is still text', { limit: '10' }, ['limit:invalid_type']],
    [
      'a cursor that is not an ID',
      { cursor: 'offset:20' },
      ['cursor:invalid_format'],
    ],
    ['an empty cursor', { cursor: '' }, ['cursor:invalid_format']],
    ['a method that is none', { method: 'paypal' }, ['method:invalid_value']],
    ['an empty method', { method: '' }, ['method:invalid_value']],
    [
      'isActive that is still text',
      { isActive: 'true' },
      ['isActive:invalid_type'],
    ],
    [
      'the salon, which is given by the path',
      { salonId: SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'a filter that the list does not have',
      { processorName: 'Stripe', isOnlineEnabled: true },
      ['processorName:unrecognized_keys', 'isOnlineEnabled:unrecognized_keys'],
    ],
    [
      'a parameter that does not exist',
      { page: 2 },
      ['page:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(paymentMethodSearchRequestSchema, input)).toEqual(
      expected,
    )
  })

  it.each([
    ['limit', 'limit:invalid_type'],
    ['cursor', 'cursor:invalid_type'],
    ['method', 'method:invalid_value'],
    ['isActive', 'isActive:invalid_type'],
  ])('rejects %s that is present without a value', (parameter, expected) => {
    expect(
      rulesBrokenBy(paymentMethodSearchRequestSchema, {
        [parameter]: undefined,
      }),
    ).toEqual([expected])
  })
})
