import { salons, sessions, staff, users } from '@beauty-salon-backend/database'
import type {
  DbUser,
  DomainError,
  IUserRepository,
  LockRule,
  MailedToken,
  PasswordChange,
  PasswordReset,
  Registration,
  SuccessfulLogin,
  UserAccount,
  UserId,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, eq, gt, ne, sql } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import type { Database } from '../database/index'
import {
  accountColumns,
  salonOfStaff,
  staffOfUser,
  userNotDeleted,
} from './account'

/** The columns a verification token occupies. */
const emailVerificationOf = ({ tokenHash, expiresAt }: MailedToken) => ({
  emailVerificationTokenHash: tokenHash,
  emailVerificationExpiry: expiresAt,
})

const noEmailVerification = {
  emailVerificationTokenHash: null,
  emailVerificationExpiry: null,
}

const noPasswordReset = {
  passwordResetTokenHash: null,
  passwordResetExpiry: null,
}

/** An account that only waited for its address to be confirmed can be used now. */
const activeIfUnverified = sql`case when ${users.status} = 'unverified' then 'active' else ${users.status} end`

export class UserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(
    email: string,
  ): Promise<Result<UserAccount | null, DomainError>> {
    return attempt('Failed to find user by email', async () => {
      const [account] = await this.db
        .select(accountColumns)
        .from(users)
        .leftJoin(staff, staffOfUser)
        .leftJoin(salons, salonOfStaff)
        .where(and(eq(users.email, email), userNotDeleted))
        .limit(1)

      return account ?? null
    })
  }

  async findById(id: UserId): Promise<Result<DbUser | null, DomainError>> {
    return attempt('Failed to find user', async () => {
      const [user] = await this.db
        .select()
        .from(users)
        .where(and(eq(users.id, id), userNotDeleted))
        .limit(1)

      return user ?? null
    })
  }

  async recordFailedLogin(
    id: string,
    { threshold, lockedUntil }: LockRule,
  ): Promise<Result<null, DomainError>> {
    // The count this failure brings the user to, read and written by one
    // statement.
    const reachesThreshold = sql`${users.failedLoginAttempts} + 1 >= ${threshold}`

    return attempt('Failed to record failed login', async () => {
      await this.db
        .update(users)
        .set({
          failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
          lockedUntil: sql`case when ${reachesThreshold} then ${lockedUntil}::timestamptz else ${users.lockedUntil} end`,
          // Only an active account becomes locked: a suspended one stays
          // suspended when its lock runs out.
          status: sql`case when ${reachesThreshold} and ${users.status} = 'active' then 'locked' else ${users.status} end`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(users.id, id), userNotDeleted))

      return null
    })
  }

  async recordSuccessfulLogin(
    id: string,
    { at, ipAddress, passwordHash }: SuccessfulLogin,
  ): Promise<Result<DbUser | null, DomainError>> {
    return attempt('Failed to record login', async () => {
      const [user] = await this.db
        .update(users)
        .set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: sql`case when ${users.status} = 'locked' then 'active' else ${users.status} end`,
          lastLoginAt: at,
          lastLoginIp: ipAddress,
          ...(passwordHash === null ? {} : { passwordHash }),
          updatedAt: sql`now()`,
        })
        .where(and(eq(users.id, id), userNotDeleted))
        .returning()

      return user ?? null
    })
  }

  async createUnverified({
    email,
    passwordHash,
    emailVerification,
  }: Registration): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to create user', async () => {
      // The only unique values are the email and the hash of a random token.
      const created = await this.db
        .insert(users)
        .values({
          email,
          passwordHash,
          role: 'customer',
          status: 'unverified',
          emailVerified: false,
          ...emailVerificationOf(emailVerification),
        })
        .onConflictDoNothing()
        .returning({ id: users.id })

      return created.length > 0
    })
  }

  async renewRegistration(
    id: string,
    { passwordHash, emailVerification }: Omit<Registration, 'email'>,
  ): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to renew registration', async () => {
      const renewed = await this.db
        .update(users)
        .set({
          passwordHash,
          ...emailVerificationOf(emailVerification),
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: sql`now()`,
        })
        .where(
          and(eq(users.id, id), eq(users.status, 'unverified'), userNotDeleted),
        )
        .returning({ id: users.id })

      return renewed.length > 0
    })
  }

  async issueEmailVerification(
    id: string,
    token: MailedToken,
  ): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to issue email verification', async () => {
      const issued = await this.db
        .update(users)
        .set({ ...emailVerificationOf(token), updatedAt: sql`now()` })
        .where(
          and(eq(users.id, id), eq(users.emailVerified, false), userNotDeleted),
        )
        .returning({ id: users.id })

      return issued.length > 0
    })
  }

  async confirmEmail(
    tokenHash: string,
    now: string,
  ): Promise<Result<DbUser | null, DomainError>> {
    return attempt('Failed to confirm email', async () => {
      const [user] = await this.db
        .update(users)
        .set({
          emailVerified: true,
          status: activeIfUnverified,
          ...noEmailVerification,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(users.emailVerificationTokenHash, tokenHash),
            gt(users.emailVerificationExpiry, now),
            userNotDeleted,
          ),
        )
        .returning()

      return user ?? null
    })
  }

  async issuePasswordReset(
    id: string,
    { tokenHash, expiresAt }: MailedToken,
  ): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to issue password reset', async () => {
      const issued = await this.db
        .update(users)
        .set({
          passwordResetTokenHash: tokenHash,
          passwordResetExpiry: expiresAt,
          updatedAt: sql`now()`,
        })
        .where(and(eq(users.id, id), userNotDeleted))
        .returning({ id: users.id })

      return issued.length > 0
    })
  }

  async findByPasswordResetToken(
    tokenHash: string,
    now: string,
  ): Promise<Result<DbUser | null, DomainError>> {
    return attempt('Failed to find user by password reset token', async () => {
      const [user] = await this.db
        .select()
        .from(users)
        .where(
          and(
            eq(users.passwordResetTokenHash, tokenHash),
            gt(users.passwordResetExpiry, now),
            userNotDeleted,
          ),
        )
        .limit(1)

      return user ?? null
    })
  }

  async resetPassword(
    tokenHash: string,
    { passwordHash, at }: PasswordReset,
  ): Promise<Result<DbUser | null, DomainError>> {
    return attempt('Failed to reset password', () =>
      this.db.transaction(async (tx) => {
        const [user] = await tx
          .update(users)
          .set({
            passwordHash,
            lastPasswordChange: at,
            ...noPasswordReset,
            emailVerified: true,
            ...noEmailVerification,
            failedLoginAttempts: 0,
            lockedUntil: null,
            status: sql`case when ${users.status} in ('unverified', 'locked') then 'active' else ${users.status} end`,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(users.passwordResetTokenHash, tokenHash),
              gt(users.passwordResetExpiry, at),
              userNotDeleted,
            ),
          )
          .returning()
        if (user === undefined) {
          return null
        }

        await tx.delete(sessions).where(eq(sessions.userId, user.id))
        return user
      }),
    )
  }

  async changePassword(
    id: UserId,
    { passwordHash, at, keepSessionId }: PasswordChange,
  ): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to change password', () =>
      this.db.transaction(async (tx) => {
        const changed = await tx
          .update(users)
          .set({
            passwordHash,
            lastPasswordChange: at,
            ...noPasswordReset,
            failedLoginAttempts: 0,
            updatedAt: sql`now()`,
          })
          .where(and(eq(users.id, id), userNotDeleted))
          .returning({ id: users.id })
        if (changed.length === 0) {
          return false
        }

        await tx
          .delete(sessions)
          .where(and(eq(sessions.userId, id), ne(sessions.id, keepSessionId)))
        return true
      }),
    )
  }
}
