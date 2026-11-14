import { salons, staff, users } from '@beauty-salon-backend/database'
import type {
  DbUser,
  DomainError,
  IUserRepository,
  LockRule,
  SuccessfulLogin,
  UserAccount,
  UserId,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, eq, sql } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import type { Database } from '../database/index'
import {
  accountColumns,
  salonOfStaff,
  staffOfUser,
  userNotDeleted,
} from './account'

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
}
