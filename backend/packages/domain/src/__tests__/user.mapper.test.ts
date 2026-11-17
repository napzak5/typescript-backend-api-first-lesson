import { describe, expect, it } from 'vitest'
import { UserReadMapper } from '../mappers/read/user.mapper'
import type { DbUser } from '../models/auth'
import {
  BACKUP_CODE_HASH,
  CUSTOMER_ID,
  dataOf,
  dbUser,
  SEALED_SECRET,
  STAFF_ID,
  twoFactorUser,
  USER_ID,
} from './auth-fixtures'

/** A user with every column set, the secret ones included. */
const fullyStoredUser = (): DbUser =>
  dbUser({
    role: 'manager',
    permissions: ['manage_staff', 'view_reports'],
    status: 'locked',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$dGFndGFn',
    emailVerificationTokenHash: 'email-verification-token-hash',
    emailVerificationExpiry: '2026-11-15 09:00:00+00',
    passwordResetTokenHash: 'password-reset-token-hash',
    passwordResetExpiry: '2026-11-15 10:00:00+00',
    lastPasswordChange: '2026-10-01 12:00:00+09',
    twoFactorStatus: 'enabled',
    twoFactorSecret: 'TOTP-SHARED-SECRET',
    backupCodes: ['BACKUP-CODE-1', 'BACKUP-CODE-2'],
    twoFactorLastUsedStep: 59_375_001,
    failedLoginAttempts: 3,
    lockedUntil: '2026-11-14 18:15:00.5+09',
    lastLoginAt: '2026-11-14 08:59:59.123456+00',
    lastLoginIp: '203.0.113.7',
    customerId: CUSTOMER_ID,
    staffId: STAFF_ID,
    deletedAt: '2026-11-14 09:30:00+00',
  })

describe('UserReadMapper.toApiUser', () => {
  it('presents exactly the public columns, timestamps in ISO 8601 UTC', () => {
    const result = UserReadMapper.toApiUser(fullyStoredUser())

    expect(dataOf(result)).toEqual({
      id: USER_ID,
      email: 'hanako@example.com',
      role: 'manager',
      permissions: ['manage_staff', 'view_reports'],
      status: 'locked',
      emailVerified: true,
      lastPasswordChange: '2026-10-01T03:00:00.000Z',
      twoFactorStatus: 'enabled',
      failedLoginAttempts: 3,
      lockedUntil: '2026-11-14T09:15:00.500Z',
      lastLoginAt: '2026-11-14T08:59:59.123Z',
      lastLoginIp: '203.0.113.7',
      customerId: CUSTOMER_ID,
      staffId: STAFF_ID,
      createdAt: '2026-11-01T01:00:00.000Z',
      updatedAt: '2026-11-01T01:00:00.000Z',
    })
  })

  it('leaves out a column of the row that the response does not name', () => {
    const rowWithAnotherColumn = {
      ...fullyStoredUser(),
      internalNote: 'kept inside',
    }

    const presented = dataOf(UserReadMapper.toApiUser(rowWithAnotherColumn))

    expect(presented).not.toHaveProperty('internalNote')
    expect(JSON.stringify(presented)).not.toContain('kept inside')
  })

  it('leaves out the password hash, the secrets, the tokens and the internal columns', () => {
    const stored = fullyStoredUser()

    const presented = JSON.stringify(dataOf(UserReadMapper.toApiUser(stored)))

    for (const column of [
      'passwordHash',
      'twoFactorSecret',
      'backupCodes',
      'twoFactorLastUsedStep',
      'twoFactorEnabled',
      'emailVerificationTokenHash',
      'emailVerificationExpiry',
      'passwordResetTokenHash',
      'passwordResetExpiry',
      'deletedAt',
    ]) {
      expect(presented).not.toContain(`"${column}"`)
    }
    for (const secret of [
      stored.passwordHash,
      'TOTP-SHARED-SECRET',
      'BACKUP-CODE-1',
      'email-verification-token',
      'password-reset-token',
    ]) {
      expect(presented).not.toContain(secret)
    }
  })

  it.each<[DbUser['twoFactorStatus'], Partial<DbUser>]>([
    ['disabled', {}],
    ['pending', twoFactorUser('pending')],
    [
      'enabled',
      twoFactorUser('enabled', { twoFactorLastUsedStep: 59_821_560 }),
    ],
  ])(
    'presents the two-factor status %s and nothing else of the second factor',
    (twoFactorStatus, columns) => {
      const presented = dataOf(UserReadMapper.toApiUser(dbUser(columns)))

      expect(presented.twoFactorStatus).toBe(twoFactorStatus)
      expect(
        Object.keys(presented).filter((name) => /factor|backup/i.test(name)),
      ).toEqual(['twoFactorStatus'])
      const shown = JSON.stringify(presented)
      expect(shown).not.toContain(SEALED_SECRET)
      expect(shown).not.toContain(BACKUP_CODE_HASH)
      expect(shown).not.toContain('59821560')
    },
  )

  it('keeps null as null', () => {
    const result = UserReadMapper.toApiUser(
      dbUser({
        lastPasswordChange: null,
        lockedUntil: null,
        lastLoginAt: null,
        lastLoginIp: null,
        customerId: null,
        staffId: null,
      }),
    )

    expect(dataOf(result)).toMatchObject({
      lastPasswordChange: null,
      lockedUntil: null,
      lastLoginAt: null,
      lastLoginIp: null,
      customerId: null,
      staffId: null,
    })
  })

  it.each<[string, Partial<DbUser>]>([
    ['permissions that are not a list', { permissions: { all: true } }],
    ['permissions that are not names', { permissions: [1, 2] }],
    ['a timestamp that is not one', { lastLoginAt: 'yesterday' }],
  ])(
    'reports a stored user with %s as a database error',
    (_case, overrides) => {
      const result = UserReadMapper.toApiUser(dbUser(overrides))

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored user ${USER_ID} does not match the API model`,
        },
      })
    },
  )
})
