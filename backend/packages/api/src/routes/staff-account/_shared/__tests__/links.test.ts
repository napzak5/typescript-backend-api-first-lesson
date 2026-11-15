import { describe, expect, it } from 'vitest'
import { staffAccountLinks } from '../links'

const STAFF_MEMBER =
  '/api/v1/salons/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a01/staff/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'
const ACCOUNT = `${STAFF_MEMBER}/account`

describe('staffAccountLinks', () => {
  it('links the account to itself and to the staff member whose it is', () => {
    expect(staffAccountLinks(ACCOUNT)).toEqual({
      self: ACCOUNT,
      staff: STAFF_MEMBER,
    })
  })

  it('keeps the path as the request wrote it', () => {
    expect(staffAccountLinks(ACCOUNT.toUpperCase())).toEqual({
      self: ACCOUNT.toUpperCase(),
      staff: STAFF_MEMBER.toUpperCase(),
    })
  })

  it('takes the staff member from the last segment alone, whatever the routes are mounted below', () => {
    expect(staffAccountLinks('/v2/staff/42/account')).toEqual({
      self: '/v2/staff/42/account',
      staff: '/v2/staff/42',
    })
  })
})
