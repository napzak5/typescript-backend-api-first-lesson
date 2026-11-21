import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'

/*
 * Accounts for the stories: a customer of the portal, seen by an
 * administrator in Tokyo.
 */

/** When the stories are looked at */
export const NOW = new Date('2026-11-20T03:00:00Z')

/** The time zone of the device the stories are looked at on */
export const TIMEZONE = 'Asia/Tokyo'

/** The address of the account of the examples */
export const EMAIL = 'yuki.tanaka@example.com'

/** The account of a customer who signs in to the portal, with two factors. */
export const aUser = (
  changes: Partial<ModelsUserResponse> = {},
): ModelsUserResponse => ({
  id: '7c3e5a9b-2d4f-4b6a-9c8e-1f0a2b3c4d5e',
  email: EMAIL,
  role: 'customer',
  status: 'active',
  emailVerified: true,
  lastPasswordChange: '2026-06-02T01:15:00Z',
  twoFactorStatus: 'enabled',
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: '2026-11-19T23:45:00Z',
  lastLoginIp: '203.0.113.24',
  customerId: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
  staffId: null,
  createdAt: '2026-04-01T00:30:00Z',
  updatedAt: '2026-11-19T23:45:00Z',
  ...changes,
})

/** The account of the examples, locked ten minutes ago after five wrong passwords in a row. */
export const aLockedUser = (
  changes: Partial<ModelsUserResponse> = {},
): ModelsUserResponse =>
  aUser({
    status: 'locked',
    failedLoginAttempts: 5,
    lockedUntil: '2026-11-20T03:05:00Z',
    ...changes,
  })
