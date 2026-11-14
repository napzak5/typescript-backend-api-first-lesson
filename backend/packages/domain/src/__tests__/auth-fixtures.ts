import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { AuthUseCaseDependencies } from '../business-logic/auth'
import {
  type Actor,
  actorSchema,
  type DbNewSession,
  type DbSession,
  type DbUser,
  type SessionRotation,
  type SessionWithAccount,
  type UserAccount,
} from '../models/auth'
import type { ISessionRepository } from '../repositories/session.repository'
import type {
  IUserRepository,
  SuccessfulLogin,
} from '../repositories/user.repository'
import type {
  IPasswordHasher,
  PasswordVerification,
} from '../services/password-hasher'
import type { IssuedToken, ITokenIssuer } from '../services/token-issuer'
import type { DomainError } from '../shared'
import { SALON_ID } from './fixtures'

export const USER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c01'
export const SESSION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c02'
export const STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c03'
export const CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c04'

export const PASSWORD = 'correct horse battery staple'

/** Where the links in mails point. */
export const PUBLIC_APP_URL = 'https://app.salon.example'

/** The time on the clock of every use case test. */
export const NOW = new Date('2026-11-14T09:00:00.000Z')

/** The instant `seconds` after `NOW` (before it when negative), in ISO 8601. */
export const secondsFromNow = (seconds: number): string =>
  new Date(NOW.getTime() + seconds * 1000).toISOString()

export const MINUTE = 60
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** A row of `users` as the driver returns it: an active admin, not locked. */
export const dbUser = (overrides: Partial<DbUser> = {}): DbUser => ({
  id: USER_ID,
  email: 'hanako@example.com',
  passwordHash: `hashed:${PASSWORD}`,
  role: 'admin',
  permissions: [],
  status: 'active',
  emailVerified: true,
  emailVerificationTokenHash: null,
  emailVerificationExpiry: null,
  passwordResetTokenHash: null,
  passwordResetExpiry: null,
  lastPasswordChange: null,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  backupCodes: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  lastLoginIp: null,
  trustedIpAddresses: [],
  customerId: null,
  staffId: null,
  metadata: {},
  deletedAt: null,
  createdAt: '2026-11-01 10:00:00+09',
  updatedAt: '2026-11-01 10:00:00+09',
  twoFactorStatus: 'disabled',
  ...overrides,
})

export const userAccount = (
  overrides: Partial<DbUser> = {},
  staffSalonId: string | null = null,
): UserAccount => ({ user: dbUser(overrides), staffSalonId })

/**
 * A row of `sessions` as the driver returns it: its access token has ten
 * minutes left and the session four hours.
 */
const dbSession = (overrides: Partial<DbSession> = {}): DbSession => ({
  id: SESSION_ID,
  userId: USER_ID,
  tokenHash: 'sha256(old-access)',
  refreshTokenHash: 'sha256(old-refresh)',
  ipAddress: '203.0.113.7',
  userAgent: 'SalonApp/1.0',
  expiresAt: secondsFromNow(10 * MINUTE),
  refreshExpiresAt: secondsFromNow(4 * HOUR),
  lastActivityAt: secondsFromNow(-5 * MINUTE),
  createdAt: secondsFromNow(-4 * HOUR),
  ...overrides,
})

export const sessionWithAccount = (
  session: Partial<DbSession> = {},
  user: Partial<DbUser> = {},
  staffSalonId: string | null = null,
): SessionWithAccount => ({
  session: dbSession(session),
  account: userAccount(user, staffSalonId),
})

/** The actor of a test: the user and session above, with the given scope. */
const actorWith = (scope: unknown): Actor =>
  actorSchema.parse({ userId: USER_ID, sessionId: SESSION_ID, scope })

export const actors = {
  admin: actorWith({ type: 'platform' }),
  ofSalon: (role: 'owner' | 'manager' | 'staff', salonId = SALON_ID): Actor =>
    actorWith({ type: 'salon', role, salonId, staffId: STAFF_ID }),
  customer: actorWith({ type: 'customer', customerId: CUSTOMER_ID }),
  withoutScope: actorWith({ type: 'none' }),
}

/**
 * A password hasher whose hashes can be read: `hashed:<password>` is a hash
 * with the current parameters, `weak:<password>` one with weaker parameters,
 * and anything else matches no password.
 */
export const fakePasswordHasher = (
  overrides: Partial<IPasswordHasher> = {},
): IPasswordHasher => ({
  hash: vi.fn(
    async (password: string): Promise<Result<string, DomainError>> =>
      Result.success(`hashed:${password}`),
  ),
  verify: vi.fn(
    async (
      password: string,
      passwordHash: string,
    ): Promise<Result<PasswordVerification, DomainError>> =>
      Result.success(
        passwordHash === `hashed:${password}`
          ? { type: 'match', needsRehash: false }
          : passwordHash === `weak:${password}`
            ? { type: 'match', needsRehash: true }
            : { type: 'mismatch' },
      ),
  ),
  ...overrides,
})

/** Issues `token-1`, `token-2`, …; the hash of a token is `sha256(<token>)`. */
const fakeTokenIssuer = (): ITokenIssuer => {
  const hashOf = (token: string): string => `sha256(${token})`
  let issued = 0

  return {
    issue: vi.fn((): IssuedToken => {
      issued += 1
      const token = `token-${issued}`
      return { token, hash: hashOf(token) }
    }),
    hashOf: vi.fn(hashOf),
  }
}

/** A user repository that finds the admin above; a test overrides what it needs. */
export const userRepositoryWith = (
  overrides: Partial<IUserRepository> = {},
): IUserRepository => ({
  findByEmail: vi.fn(async () => Result.success(userAccount())),
  findById: vi.fn(async () => Result.success(dbUser())),
  recordFailedLogin: vi.fn(async () => Result.success(null)),
  recordSuccessfulLogin: vi.fn(async (_id: string, login: SuccessfulLogin) =>
    Result.success(
      dbUser({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: login.at,
        lastLoginIp: login.ipAddress,
      }),
    ),
  ),
  createUnverified: vi.fn(async () => Result.success(true)),
  renewRegistration: vi.fn(async () => Result.success(true)),
  issueEmailVerification: vi.fn(async () => Result.success(true)),
  confirmEmail: vi.fn(async () => Result.success(dbUser())),
  issuePasswordReset: vi.fn(async () => Result.success(true)),
  findByPasswordResetToken: vi.fn(async () => Result.success(dbUser())),
  resetPassword: vi.fn(async () => Result.success(dbUser())),
  changePassword: vi.fn(async () => Result.success(true)),
  ...overrides,
})

/** A session repository that finds the session above; a test overrides what it needs. */
export const sessionRepositoryWith = (
  overrides: Partial<ISessionRepository> = {},
): ISessionRepository => ({
  create: vi.fn(async (session: DbNewSession) =>
    Result.success(
      dbSession({ ...session, createdAt: session.lastActivityAt }),
    ),
  ),
  findByTokenHash: vi.fn(async () => Result.success(sessionWithAccount())),
  findByRefreshTokenHash: vi.fn(async () =>
    Result.success(sessionWithAccount()),
  ),
  rotate: vi.fn(async (_hash: string, rotation: SessionRotation) =>
    Result.success(dbSession(rotation)),
  ),
  delete: vi.fn(async () => Result.success(true)),
  deleteAllOfUser: vi.fn(async () => Result.success(null)),
  ...overrides,
})

/** Everything the authentication use cases need, with the clock at `NOW`. */
export const authDependencies = (
  overrides: Partial<AuthUseCaseDependencies> = {},
): AuthUseCaseDependencies => ({
  userRepository: userRepositoryWith(),
  sessionRepository: sessionRepositoryWith(),
  passwordHasher: fakePasswordHasher(),
  tokenIssuer: fakeTokenIssuer(),
  mailer: { deliver: vi.fn() },
  publicAppUrl: PUBLIC_APP_URL,
  clock: () => NOW,
  ...overrides,
})

/** The data of a success; fails the test on an error. */
export const dataOf = <T>(result: Result<T, DomainError>): T => {
  if (result.type === 'error') {
    throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
  }
  return result.data
}
