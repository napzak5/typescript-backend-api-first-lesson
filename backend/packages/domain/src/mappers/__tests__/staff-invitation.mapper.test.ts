import { describe, expect, it } from 'vitest'
import {
  apiStaffInvitation,
  dbStaffInvitation,
  INVITATION_ID,
} from '../../__tests__/fixtures/staff-invitation-fixtures'
import type { SalonRole } from '../../models/staff-invitation'
import { StaffInvitationReadMapper } from '../read/staff-invitation.mapper'
import { StaffInvitationWriteMapper } from '../write/staff-invitation.mapper'

describe('StaffInvitationReadMapper.toApiStaffInvitation', () => {
  it('returns the columns under their own names, with the timestamps in ISO 8601', () => {
    expect(
      StaffInvitationReadMapper.toApiStaffInvitation(dbStaffInvitation()),
    ).toEqual({ type: 'success', data: apiStaffInvitation() })
  })

  it.each<SalonRole>(['owner', 'manager', 'staff'])(
    'keeps the role %s',
    (role) => {
      expect(
        StaffInvitationReadMapper.toApiStaffInvitation(
          dbStaffInvitation({ role }),
        ),
      ).toEqual({ type: 'success', data: apiStaffInvitation({ role }) })
    },
  )

  it('leaves out the hash of the token', () => {
    const mapped = StaffInvitationReadMapper.toApiStaffInvitation(
      dbStaffInvitation({ tokenHash: 'sha256(secret)' }),
    )

    expect(JSON.stringify(mapped)).not.toContain('sha256(secret)')
    expect(JSON.stringify(mapped)).not.toContain('tokenHash')
  })

  it('does not pass on what a row carries beyond its columns', () => {
    const row = { ...dbStaffInvitation(), token: 'mailed-token' }

    const mapped = StaffInvitationReadMapper.toApiStaffInvitation(row)

    expect(mapped).toEqual({ type: 'success', data: apiStaffInvitation() })
  })

  it.each(['expiresAt', 'createdAt'])(
    'reports a stored %s that is no timestamp as a database error that names the invitation',
    (column) => {
      const mapped = StaffInvitationReadMapper.toApiStaffInvitation(
        dbStaffInvitation({ [column]: 'next week' }),
      )

      expect(mapped).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored staff invitation ${INVITATION_ID} does not match the API model`,
        },
      })
    },
  )
})

describe('StaffInvitationWriteMapper', () => {
  const token = 'the-token-of-the-mail'

  it.each<SalonRole>(['owner', 'manager', 'staff'])(
    'invites with the role %s the request names',
    (role) => {
      expect(
        StaffInvitationWriteMapper.fromCreateRequest({ role }),
      ).toStrictEqual({ role })
    },
  )

  it('verifies the token as it is presented', () => {
    expect(
      StaffInvitationWriteMapper.fromVerifyRequest({ token }),
    ).toStrictEqual({ token })
  })

  it('accepts with the token and the password as they are presented', () => {
    expect(
      StaffInvitationWriteMapper.fromAcceptRequest({
        token,
        password: 'a long enough password',
      }),
    ).toStrictEqual({ token, password: 'a long enough password' })
  })

  it('joins with the token as it is presented', () => {
    expect(StaffInvitationWriteMapper.fromJoinRequest({ token })).toStrictEqual(
      { token },
    )
  })
})
