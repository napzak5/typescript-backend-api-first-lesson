import { describe, expect, it } from 'vitest'
import { StaffAccountReadMapper } from '../mappers/read/staff-account.mapper'
import { StaffAccountWriteMapper } from '../mappers/write/staff-account.mapper'
import type { DbStaffAccount } from '../models/staff-account'
import type { SalonRole } from '../models/staff-invitation'
import { dbUser } from './auth-fixtures'
import {
  ACCOUNT_ID,
  apiStaffAccount,
  dbStaffAccount,
} from './staff-account-fixtures'

describe('StaffAccountReadMapper.toApiStaffAccount', () => {
  it('returns the columns under their own names, with the timestamps in ISO 8601', () => {
    expect(StaffAccountReadMapper.toApiStaffAccount(dbStaffAccount())).toEqual({
      type: 'success',
      data: apiStaffAccount(),
    })
  })

  it.each<SalonRole>(['owner', 'manager', 'staff'])(
    'keeps the role %s',
    (role) => {
      expect(
        StaffAccountReadMapper.toApiStaffAccount(dbStaffAccount({ role })),
      ).toEqual({ type: 'success', data: apiStaffAccount({ role }) })
    },
  )

  it.each<DbStaffAccount['status']>([
    'active',
    'unverified',
    'inactive',
    'locked',
    'suspended',
    'deleted',
  ])('keeps the status %s', (status) => {
    expect(
      StaffAccountReadMapper.toApiStaffAccount(dbStaffAccount({ status })),
    ).toEqual({ type: 'success', data: apiStaffAccount({ status }) })
  })

  it.each<DbStaffAccount['twoFactorStatus']>([
    'disabled',
    'pending',
    'enabled',
  ])('keeps the two-factor status %s', (twoFactorStatus) => {
    expect(
      StaffAccountReadMapper.toApiStaffAccount(
        dbStaffAccount({ twoFactorStatus }),
      ),
    ).toEqual({ type: 'success', data: apiStaffAccount({ twoFactorStatus }) })
  })

  it('keeps null for an account that never signed in', () => {
    expect(
      StaffAccountReadMapper.toApiStaffAccount(
        dbStaffAccount({ lastLoginAt: null }),
      ),
    ).toEqual({ type: 'success', data: apiStaffAccount({ lastLoginAt: null }) })
  })

  it('passes on nothing of a whole row of users but the columns the salon is shown', () => {
    const row = dbUser({
      id: ACCOUNT_ID,
      email: 'hanako@aoyama.example.com',
      role: 'staff',
      passwordHash: 'argon2(secret)',
      twoFactorSecret: 'sealed:SECRET-1',
      lastLoginIp: '203.0.113.7',
      lastLoginAt: '2026-11-13 21:15:00+09',
      updatedAt: '2026-11-13 12:15:00.5+00',
    })

    const mapped = StaffAccountReadMapper.toApiStaffAccount(row)

    expect(mapped).toEqual({ type: 'success', data: apiStaffAccount() })
    expect(JSON.stringify(mapped)).not.toContain('argon2')
    expect(JSON.stringify(mapped)).not.toContain('SECRET')
    expect(JSON.stringify(mapped)).not.toContain('203.0.113.7')
  })

  it.each<DbStaffAccount['role']>(['customer', 'admin'])(
    'reports a stored role %s as a database error that names the account: no such user is the account of a staff member',
    (role) => {
      const mapped = StaffAccountReadMapper.toApiStaffAccount(
        dbStaffAccount({ role }),
      )

      expect(mapped).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored account ${ACCOUNT_ID} of a staff member does not match the API model`,
        },
      })
    },
  )

  it.each(['lastLoginAt', 'createdAt', 'updatedAt'])(
    'reports a stored %s that is no timestamp as a database error',
    (column) => {
      const mapped = StaffAccountReadMapper.toApiStaffAccount(
        dbStaffAccount({ [column]: 'next week' }),
      )

      expect(mapped).toMatchObject({
        type: 'error',
        error: { type: 'database' },
      })
    },
  )
})

describe('StaffAccountWriteMapper.fromUpdateRequest', () => {
  it.each<SalonRole>(['owner', 'manager', 'staff'])(
    'changes the role to %s',
    (role) => {
      expect(StaffAccountWriteMapper.fromUpdateRequest({ role })).toStrictEqual(
        {
          role,
        },
      )
    },
  )
})
