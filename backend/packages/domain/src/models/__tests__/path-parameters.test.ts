import {
  customerMessages,
  salonMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import { brokenRules, SALON_ID } from '../../__tests__/fixtures/fixtures'
import { CATEGORY_ID } from '../../__tests__/fixtures/service-category-fixtures'
import { SERVICE_ID } from '../../__tests__/fixtures/service-fixtures'
import type { DomainError } from '../../shared'
import { customerIdSchema, parseCustomerId } from '../customer'
import { parseSalonIdOfPath } from '../salon'
import { parseServiceId, serviceIdSchema } from '../service'
import { parseCategoryId } from '../service-category'

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: { type: string; error?: DomainError }): string[] =>
  result.error === undefined ? [] : brokenRules(result.error)

/** Text in a path that is not a UUID. */
const notUuids: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['the empty string', ''],
  ['a UUID with a character too many', `${SALON_ID}0`],
  ['a UUID with a character too few', SALON_ID.slice(0, -1)],
  ['a UUID with a space in front', ` ${SALON_ID}`],
  ['a UUID followed by a line break', `${SALON_ID}\n`],
  ['a UUID without its hyphens', SALON_ID.replaceAll('-', '')],
  ['a UUID in braces', `{${SALON_ID}}`],
  [
    'a UUID with a letter that is not a hexadecimal digit',
    `g${SALON_ID.slice(1)}`,
  ],
]

/** What a path never carries, but an unchecked caller could pass. */
const notText: [string, unknown][] = [
  ['nothing', undefined],
  ['null', null],
  ['a number', 42],
  ['a list of IDs', [SALON_ID]],
]

describe('parseSalonIdOfPath', () => {
  it('returns the ID of a salon as it is', () => {
    expect(parseSalonIdOfPath(SALON_ID)).toEqual({
      type: 'success',
      data: SALON_ID,
    })
  })

  it.each([
    ['upper case', SALON_ID.toUpperCase()],
    ['mixed case', '0193A5b8-7C2e-7d4F-8a1B-3c5D7e9f0A1b'],
  ])(
    'returns an ID written in %s as the lower-case ID, the one the database returns',
    (_case, salonId) => {
      expect(parseSalonIdOfPath(salonId)).toEqual({
        type: 'success',
        data: SALON_ID,
      })
    },
  )

  it.each(notUuids)(
    'reports %s under salonId, not under id',
    (_case, salonId) => {
      expect(rulesOf(parseSalonIdOfPath(salonId))).toEqual([
        'salonId:invalid_format',
      ])
    },
  )

  it('should refuse what is no ID of a salon under the headline of the ID of a salon', () => {
    // Act
    const result = parseSalonIdOfPath('latest')

    // Assert
    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: salonMessages.invalidSalonId },
    })
  })

  it.each(notText)('reports %s under salonId', (_case, salonId) => {
    expect(rulesOf(parseSalonIdOfPath(salonId))).toEqual([
      'salonId:invalid_type',
    ])
  })
})

describe('parseCategoryId', () => {
  it('returns the ID of a category as it is', () => {
    expect(parseCategoryId(CATEGORY_ID)).toEqual({
      type: 'success',
      data: CATEGORY_ID,
    })
  })

  it.each([
    ['upper case', CATEGORY_ID.toUpperCase()],
    ['mixed case', '0193A5b8-7C2e-7d4F-8a1B-3c5D7e9f0D01'],
  ])(
    'returns an ID written in %s as the lower-case ID, the one the database returns',
    (_case, id) => {
      expect(parseCategoryId(id)).toEqual({
        type: 'success',
        data: CATEGORY_ID,
      })
    },
  )

  it.each(notUuids)('reports %s under id', (_case, id) => {
    expect(rulesOf(parseCategoryId(id))).toEqual(['id:invalid_format'])
  })

  it.each(notText)('reports %s under id', (_case, id) => {
    expect(rulesOf(parseCategoryId(id))).toEqual(['id:invalid_type'])
  })
})

describe('parseServiceId', () => {
  it('returns the ID of a service as it is', () => {
    expect(parseServiceId(SERVICE_ID)).toEqual({
      type: 'success',
      data: SERVICE_ID,
    })
  })

  it.each([
    ['upper case', SERVICE_ID.toUpperCase()],
    ['mixed case', '0193A5b8-7C2e-7d4F-8a1B-3c5D7e9f0E01'],
  ])(
    'returns an ID written in %s as the lower-case ID, the one the database returns',
    (_case, id) => {
      expect(parseServiceId(id)).toEqual({
        type: 'success',
        data: SERVICE_ID,
      })
    },
  )

  it.each([...notUuids, ['the word bulk', 'bulk']])(
    'reports %s under id',
    (_case, id) => {
      expect(rulesOf(parseServiceId(id))).toEqual(['id:invalid_format'])
    },
  )

  it.each(notText)('reports %s under id', (_case, id) => {
    expect(rulesOf(parseServiceId(id))).toEqual(['id:invalid_type'])
  })
})

describe('serviceIdSchema', () => {
  it('reads a service ID written in upper case as the lower-case ID', () => {
    expect(serviceIdSchema.safeParse(SERVICE_ID.toUpperCase())).toEqual({
      success: true,
      data: SERVICE_ID,
    })
  })

  it.each(notUuids)('rejects %s', (_case, id) => {
    expect(serviceIdSchema.safeParse(id).success).toBe(false)
  })
})

describe('parseCustomerId', () => {
  it('returns the ID of a customer as it is', () => {
    expect(parseCustomerId(CUSTOMER_ID)).toEqual({
      type: 'success',
      data: CUSTOMER_ID,
    })
  })

  it.each([
    ['upper case', CUSTOMER_ID.toUpperCase()],
    ['mixed case', '0193A5b8-7C2e-7d4F-8a1B-3c5D7e9f0C04'],
  ])(
    'returns an ID written in %s as the lower-case ID, the one the database returns',
    (_case, id) => {
      expect(parseCustomerId(id)).toEqual({
        type: 'success',
        data: CUSTOMER_ID,
      })
    },
  )

  it.each(notUuids)('reports %s under id', (_case, id) => {
    expect(rulesOf(parseCustomerId(id))).toEqual(['id:invalid_format'])
  })

  it.each(notText)('reports %s under id', (_case, id) => {
    expect(rulesOf(parseCustomerId(id))).toEqual(['id:invalid_type'])
  })

  it('reports the failure as a validation error', () => {
    expect(parseCustomerId('latest')).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: customerMessages.invalidCustomerId,
      },
    })
  })
})

describe('customerIdSchema', () => {
  it('reads a customer ID written in upper case as the lower-case ID', () => {
    expect(customerIdSchema.safeParse(CUSTOMER_ID.toUpperCase())).toEqual({
      success: true,
      data: CUSTOMER_ID,
    })
  })

  it.each(notUuids)('rejects %s', (_case, id) => {
    expect(customerIdSchema.safeParse(id).success).toBe(false)
  })
})
