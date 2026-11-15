import { describe, expect, it } from 'vitest'
import { staffInvitationLinks } from '../links'

const STAFF_MEMBER =
  '/api/v1/salons/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a01/staff/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'
const INVITATION = `${STAFF_MEMBER}/invitation`

describe('staffInvitationLinks', () => {
  it('links the invitation to itself and to the staff member who holds it', () => {
    expect(staffInvitationLinks(INVITATION)).toEqual({
      self: INVITATION,
      staff: STAFF_MEMBER,
    })
  })

  it('keeps the path as the request wrote it', () => {
    expect(staffInvitationLinks(INVITATION.toUpperCase())).toEqual({
      self: INVITATION.toUpperCase(),
      staff: STAFF_MEMBER.toUpperCase(),
    })
  })

  it('takes the staff member from the last segment alone, whatever the routes are mounted below', () => {
    expect(staffInvitationLinks('/v2/staff/42/invitation')).toEqual({
      self: '/v2/staff/42/invitation',
      staff: '/v2/staff/42',
    })
  })
})
