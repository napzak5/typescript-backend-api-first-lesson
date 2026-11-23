import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  brokenRules,
  MADE_UP_HEADLINE,
} from '../../__tests__/fixtures/fixtures'
import { parseWith } from '../../shared'
import { staffAccountUpdateRequestSchema } from '../staff-account.schema'

const rulesBrokenBy = (input: unknown): string[] => {
  const result = parseWith(
    staffAccountUpdateRequestSchema,
    input,
    MADE_UP_HEADLINE,
  )
  return result.type === 'error' ? brokenRules(result.error) : []
}

describe('staffAccountUpdateRequestSchema', () => {
  it.each(['owner', 'manager', 'staff'])(
    'accepts the role %s and returns the request unchanged',
    (role) => {
      expect(
        parseWith(staffAccountUpdateRequestSchema, { role }, MADE_UP_HEADLINE),
      ).toEqual({ type: 'success', data: { role } })
    },
  )

  it('rejects a request that names no property: it would change nothing', () => {
    const result = parseWith(
      staffAccountUpdateRequestSchema,
      {},
      MADE_UP_HEADLINE,
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        issues: [{ field: '', message: ruleMessages.atLeastOneProperty }],
      },
    })
  })

  it.each([
    ['a role that is null', { role: null }, ['role:invalid_value']],
    ['a role that is undefined', { role: undefined }, ['role:invalid_value']],
    ['the role of a customer', { role: 'customer' }, ['role:invalid_value']],
    ['the role of an administrator', { role: 'admin' }, ['role:invalid_value']],
    ['a role in upper case', { role: 'OWNER' }, ['role:invalid_value']],
    ['a role with a space', { role: 'staff ' }, ['role:invalid_value']],
    ['an empty role', { role: '' }, ['role:invalid_value']],
    ['a list of roles', { role: ['staff'] }, ['role:invalid_value']],
    [
      'an address for the account',
      { role: 'staff', email: 'hanako@example.com' },
      ['email:unrecognized_keys'],
    ],
    [
      'a status for the account',
      { role: 'staff', status: 'suspended' },
      ['status:unrecognized_keys'],
    ],
    [
      'another staff member for the account',
      { role: 'staff', staffId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01' },
      ['staffId:unrecognized_keys'],
    ],
    [
      'only a property it does not know',
      { status: 'suspended' },
      ['status:unrecognized_keys'],
    ],
    ['a list as the request', [], [':invalid_type']],
    ['null as the request', null, [':invalid_type']],
    ['a text as the request', 'staff', [':invalid_type']],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(input)).toEqual(expected)
  })
})
