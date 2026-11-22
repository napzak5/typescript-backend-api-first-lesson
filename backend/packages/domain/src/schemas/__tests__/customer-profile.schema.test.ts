import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID, USER_ID } from '../../__tests__/fixtures/auth-fixtures'
import {
  customerProfileCreateRequest,
  REFERRER_ID,
} from '../../__tests__/fixtures/customer-fixtures'
import { brokenRules } from '../../__tests__/fixtures/fixtures'
import { parseWith } from '../../shared'
import {
  customerProfileCreateRequestSchema,
  customerProfileUpdateRequestSchema,
} from '../customer.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** The properties of a profile that may be null. */
const NULLABLE_PROPERTIES = [
  'firstNameKana',
  'lastNameKana',
  'alternativePhone',
  'postalCode',
  'prefecture',
  'city',
  'address',
  'building',
  'birthDate',
  'gender',
  'occupation',
  'preferences',
]

/** The properties of a profile that are never null, and the rule null breaks. */
const notNullable: [string, string][] = [
  ['firstName', 'firstName:invalid_type'],
  ['lastName', 'lastName:invalid_type'],
  ['phoneNumber', 'phoneNumber:invalid_type'],
  ['allowMarketing', 'allowMarketing:invalid_type'],
  ['allowSms', 'allowSms:invalid_type'],
  ['allowEmail', 'allowEmail:invalid_type'],
]

/**
 * What the ledger holds of a customer and the customer does not write: the
 * email of the account, what the staff decide or record, and what the
 * server manages.
 */
const NOT_THE_CUSTOMERS: [string, unknown][] = [
  ['email', 'someone.else@example.com'],
  ['membershipTier', 'vip'],
  ['notes', 'Prefers a short fringe'],
  ['internalNotes', 'Nothing to see'],
  ['tags', ['vip']],
  ['referredBy', REFERRER_ID],
  ['referralCode', 'FREE2026'],
  ['isActive', true],
  ['hairType', 'straight'],
  ['hairThickness', 'thin'],
  ['scalpCondition', 'normal'],
  ['customerStatus', 'active'],
  ['id', CUSTOMER_ID],
  ['userId', USER_ID],
  ['loyaltyPoints', 100_000],
  ['lifetimeValue', 5000],
  ['firstVisitDate', '2026-01-10'],
  ['lastVisitDate', '2026-11-01'],
  ['visitCount', 3],
  ['noShowCount', 0],
  ['cancellationCount', 0],
  ['createdAt', '2026-11-14T09:00:00.000Z'],
  ['updatedAt', '2026-11-14T09:00:00.000Z'],
  ['deletedAt', null],
]

/**
 * What breaks a rule of the ledger breaks it in a profile: a sample of the
 * rules of each kind. The rules themselves are tested with the ledger.
 */
const violations: [string, Record<string, unknown>, string[]][] = [
  ['an empty first name', { firstName: '' }, ['firstName:invalid_format']],
  ['a blank last name', { lastName: ' \t' }, ['lastName:invalid_format']],
  [
    'a first name of 101 characters',
    { firstName: 'a'.repeat(101) },
    ['firstName:too_big'],
  ],
  [
    'a phone number of nine digits',
    { phoneNumber: '031234567' },
    ['phoneNumber:custom'],
  ],
  [
    'a second phone number with letters',
    { alternativePhone: '03-1234-5678 ext' },
    ['alternativePhone:invalid_format'],
  ],
  [
    'a postal code of 11 characters',
    { postalCode: '1'.repeat(11) },
    ['postalCode:too_big'],
  ],
  [
    'a birth date that is not a date',
    { birthDate: '1990-02-30' },
    ['birthDate:invalid_format'],
  ],
  ['an unknown gender', { gender: 'unknown' }, ['gender:invalid_value']],
  [
    'a preferred service that is none',
    { preferences: { preferredServices: ['massage'], notes: null } },
    ['preferences.preferredServices.0:invalid_value'],
  ],
  [
    'a preferred service named twice',
    { preferences: { preferredServices: ['cut', 'cut'], notes: null } },
    ['preferences.preferredServices.1:custom'],
  ],
  ['a consent that is text', { allowSms: 'yes' }, ['allowSms:invalid_type']],
]

describe('customerProfileCreateRequestSchema', () => {
  it('accepts a request that sets every property and returns it as it is', () => {
    const result = parseWith(
      customerProfileCreateRequestSchema,
      customerProfileCreateRequest(),
      'Invalid',
    )

    expect(result).toEqual({
      type: 'success',
      data: customerProfileCreateRequest(),
    })
  })

  it('accepts null for every property that may be unset', () => {
    const request = {
      ...customerProfileCreateRequest(),
      ...Object.fromEntries(
        NULLABLE_PROPERTIES.map((property) => [property, null]),
      ),
    }

    const result = parseWith(
      customerProfileCreateRequestSchema,
      request,
      'Invalid',
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it("has the properties of the ledger that are neither the staff's nor the server's, and no other", () => {
    expect(
      Object.keys(customerProfileCreateRequestSchema.shape).sort(),
    ).toEqual(Object.keys(customerProfileCreateRequest()).sort())
    expect(
      [...NULLABLE_PROPERTIES, ...notNullable.map(([name]) => name)].sort(),
    ).toEqual(Object.keys(customerProfileCreateRequest()).sort())
  })

  it.each(notNullable)('rejects null for %s', (property, expected) => {
    const rules = rulesBrokenBy(customerProfileCreateRequestSchema, {
      ...customerProfileCreateRequest(),
      [property]: null,
    })

    expect(rules).toEqual([expected])
  })

  it.each(Object.keys(customerProfileCreateRequest()))(
    'rejects a request that leaves %s out',
    (property) => {
      const request: Record<string, unknown> = customerProfileCreateRequest()
      const withoutProperty = Object.fromEntries(
        Object.entries(request).filter(([name]) => name !== property),
      )

      const rules = rulesBrokenBy(
        customerProfileCreateRequestSchema,
        withoutProperty,
      )

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(new RegExp(`^${property}:invalid_`))
    },
  )

  it.each(NOT_THE_CUSTOMERS)(
    "rejects %s, which is not the customer's to write, as a property the request does not have",
    (property, value) => {
      const rules = rulesBrokenBy(customerProfileCreateRequestSchema, {
        ...customerProfileCreateRequest(),
        [property]: value,
      })

      expect(rules).toEqual([`${property}:unrecognized_keys`])
    },
  )

  it.each(violations)('rejects %s', (_case, change, expected) => {
    const rules = rulesBrokenBy(customerProfileCreateRequestSchema, {
      ...customerProfileCreateRequest(),
      ...change,
    })

    expect(rules).toEqual(expected)
  })

  it.each([
    ['text', 'firstName=Hanako'],
    ['a list', [customerProfileCreateRequest()]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    const result = parseWith(
      customerProfileCreateRequestSchema,
      input,
      'Invalid',
    )

    expect(result.type).toBe('error')
  })
})

describe('customerProfileUpdateRequestSchema', () => {
  it.each(Object.entries(customerProfileCreateRequest()))(
    'accepts a request that changes only %s',
    (property, value) => {
      const request = { [property]: value }

      const result = parseWith(
        customerProfileUpdateRequestSchema,
        request,
        'Invalid',
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it('accepts a request that changes every property', () => {
    const result = parseWith(
      customerProfileUpdateRequestSchema,
      customerProfileCreateRequest(),
      'Invalid',
    )

    expect(result).toEqual({
      type: 'success',
      data: customerProfileCreateRequest(),
    })
  })

  it.each(NULLABLE_PROPERTIES)(
    'accepts null for %s, which unsets it',
    (property) => {
      const request = { [property]: null }

      const result = parseWith(
        customerProfileUpdateRequestSchema,
        request,
        'Invalid',
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it.each(notNullable)(
    'rejects null for %s, which is never unset',
    (property, expected) => {
      const rules = rulesBrokenBy(customerProfileUpdateRequestSchema, {
        [property]: null,
      })

      expect(rules).toEqual([expected])
    },
  )

  it('rejects a request that changes nothing', () => {
    const result = parseWith(customerProfileUpdateRequestSchema, {}, 'Invalid')

    expect(result.type).toBe('error')
  })

  it('rejects a property that is present and undefined', () => {
    const rules = rulesBrokenBy(customerProfileUpdateRequestSchema, {
      firstName: undefined,
    })

    expect(rules).toEqual(['firstName:invalid_type'])
  })

  it.each(NOT_THE_CUSTOMERS)(
    "rejects %s, which is not the customer's to change",
    (property, value) => {
      const rules = rulesBrokenBy(customerProfileUpdateRequestSchema, {
        firstName: 'Renamed',
        [property]: value,
      })

      expect(rules).toEqual([`${property}:unrecognized_keys`])
    },
  )

  it.each(NOT_THE_CUSTOMERS)(
    'rejects a request that names only %s',
    (property, value) => {
      const result = parseWith(
        customerProfileUpdateRequestSchema,
        { [property]: value },
        'Invalid',
      )

      expect(result.type).toBe('error')
    },
  )

  it.each(violations)('rejects %s', (_case, change, expected) => {
    const rules = rulesBrokenBy(customerProfileUpdateRequestSchema, change)

    expect(rules).toEqual(expected)
  })
})
