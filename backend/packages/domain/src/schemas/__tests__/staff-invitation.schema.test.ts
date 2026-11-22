import { describe, expect, it } from 'vitest'
import { brokenRules } from '../../__tests__/fixtures/fixtures'
import { parseWith } from '../../shared'
import { staffInvitationCreateRequestSchema } from '../staff-invitation.schema'

const rulesBrokenBy = (input: unknown): string[] => {
  const result = parseWith(staffInvitationCreateRequestSchema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

describe('staffInvitationCreateRequestSchema', () => {
  it.each(['owner', 'manager', 'staff'])(
    'accepts the role %s and returns the request unchanged',
    (role) => {
      expect(
        parseWith(staffInvitationCreateRequestSchema, { role }, 'Invalid'),
      ).toEqual({ type: 'success', data: { role } })
    },
  )

  it.each([
    ['a missing role', {}, ['role:invalid_value']],
    ['a role that is null', { role: null }, ['role:invalid_value']],
    ['the role of a customer', { role: 'customer' }, ['role:invalid_value']],
    ['the role of an administrator', { role: 'admin' }, ['role:invalid_value']],
    ['a role in upper case', { role: 'OWNER' }, ['role:invalid_value']],
    ['a role with a space', { role: 'staff ' }, ['role:invalid_value']],
    ['an empty role', { role: '' }, ['role:invalid_value']],
    ['a list of roles', { role: ['staff'] }, ['role:invalid_value']],
    [
      'an address for the mail',
      { role: 'staff', email: 'hanako@example.com' },
      ['email:unrecognized_keys'],
    ],
    [
      'the staff member in the body',
      { role: 'staff', staffId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01' },
      ['staffId:unrecognized_keys'],
    ],
    [
      'an end for the invitation',
      { role: 'staff', expiresAt: '2099-01-01T00:00:00.000Z' },
      ['expiresAt:unrecognized_keys'],
    ],
    ['a list as the request', [], [':invalid_type']],
    ['null as the request', null, [':invalid_type']],
    ['a text as the request', 'staff', [':invalid_type']],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(input)).toEqual(expected)
  })
})
