import type {
  ModelsAuthTwoFactorSetupResponse,
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

/**
 * What the API issues when the second factor is set up for the account:
 * the secret, the address the authenticator app reads, and the backup codes.
 */
export const twoFactorSetup: ModelsAuthTwoFactorSetupResponse = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  qrCodeUrl:
    'otpauth://totp/Beauty%20Salon:hanako%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Beauty%20Salon&algorithm=SHA1&digits=6&period=30',
  backupCodes: [
    'K7M2-PZQX-4HDA-WN3E',
    'B5TR-J2LC-Q6VY-XE4M',
    'H3NW-7FKD-ZP2S-LU6A',
    'R4QE-M7XB-T5JN-CW2K',
    'V6LA-D3YP-G2HU-QS7F',
    'Z2CK-W5RT-N4MX-JE3B',
    'P7GU-S4LF-Y6QD-HA2N',
    'E3WJ-K6ZM-R2TC-XV5P',
    'L5DY-Q2BN-U7KS-FG4W',
    'T6HX-A3VE-M5PL-ZR2J',
  ],
}
