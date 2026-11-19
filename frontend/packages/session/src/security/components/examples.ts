import type {
  ModelsSessionResponse,
  ModelsUserResponse,
} from '@beauty-salon-frontend/api-client'

/** The account the stories show: a customer who signed in on a phone and on a computer. */
export const account: ModelsUserResponse = {
  id: '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07',
  email: 'hanako@example.com',
  role: 'customer',
  status: 'active',
  emailVerified: true,
  lastPasswordChange: '2026-10-02T09:30:00.000Z',
  twoFactorStatus: 'disabled',
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: '2026-11-20T01:15:00.000Z',
  lastLoginIp: '203.0.113.24',
  customerId: '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f99',
  staffId: null,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-11-20T01:15:00.000Z',
}

/** The session of the computer the stories are seen on. */
export const thisDevice: ModelsSessionResponse = {
  id: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01',
  userId: account.id,
  ipAddress: '203.0.113.24',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15',
  expiresAt: '2026-11-20T01:30:00.000Z',
  refreshExpiresAt: '2026-11-20T09:15:00.000Z',
  lastActivityAt: '2026-11-20T01:15:00.000Z',
  createdAt: '2026-11-20T01:15:00.000Z',
  current: true,
}

/** A phone that signed in a week before and was kept signed in. */
export const phone: ModelsSessionResponse = {
  id: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c02',
  userId: account.id,
  ipAddress: '198.51.100.7',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Mobile/15E148 Safari/604.1',
  expiresAt: '2026-11-19T12:15:00.000Z',
  refreshExpiresAt: '2026-12-13T11:00:00.000Z',
  lastActivityAt: '2026-11-19T12:00:00.000Z',
  createdAt: '2026-11-13T11:00:00.000Z',
  current: false,
}

/** A session of which the API kept neither the address nor the browser. */
export const unrecorded: ModelsSessionResponse = {
  id: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c03',
  userId: account.id,
  ipAddress: null,
  userAgent: null,
  expiresAt: '2026-11-20T01:00:00.000Z',
  refreshExpiresAt: '2026-11-20T07:30:00.000Z',
  lastActivityAt: '2026-11-20T00:45:00.000Z',
  createdAt: '2026-11-19T23:30:00.000Z',
  current: false,
}

/** The sessions as the API lists them, the latest first. */
export const sessions: ModelsSessionResponse[] = [thisDevice, unrecorded, phone]
