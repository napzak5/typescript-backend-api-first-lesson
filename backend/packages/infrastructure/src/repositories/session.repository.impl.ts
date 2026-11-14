import { salons, sessions, staff, users } from '@beauty-salon-backend/database'
import {
  type DbNewSession,
  type DbSession,
  type DomainError,
  DomainErrors,
  type ISessionRepository,
  type SessionId,
  type SessionRotation,
  type SessionWithAccount,
  type UserId,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, eq, lte, type SQL } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import type { Database } from '../database/index'
import {
  accountColumns,
  salonOfStaff,
  staffOfUser,
  userNotDeleted,
} from './account'

export class SessionRepository implements ISessionRepository {
  constructor(private readonly db: Database) {}

  async create(session: DbNewSession): Promise<Result<DbSession, DomainError>> {
    const created = await attempt('Failed to create session', () =>
      this.db.transaction(async (tx) => {
        await tx
          .delete(sessions)
          .where(
            and(
              eq(sessions.userId, session.userId),
              lte(sessions.refreshExpiresAt, session.lastActivityAt),
            ),
          )
        const [inserted] = await tx.insert(sessions).values(session).returning()
        return inserted ?? null
      }),
    )

    return Result.flatMap(created, (data) =>
      data === null
        ? Result.error(
            DomainErrors.database('Insert of session returned no row', null),
          )
        : Result.success(data),
    )
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<Result<SessionWithAccount | null, DomainError>> {
    return this.findWhere(eq(sessions.tokenHash, tokenHash))
  }

  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<Result<SessionWithAccount | null, DomainError>> {
    return this.findWhere(eq(sessions.refreshTokenHash, refreshTokenHash))
  }

  async rotate(
    refreshTokenHash: string,
    rotation: SessionRotation,
  ): Promise<Result<DbSession | null, DomainError>> {
    return attempt('Failed to rotate session tokens', async () => {
      const [rotated] = await this.db
        .update(sessions)
        .set(rotation)
        .where(eq(sessions.refreshTokenHash, refreshTokenHash))
        .returning()

      return rotated ?? null
    })
  }

  async delete(id: SessionId): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to delete session', async () => {
      const deleted = await this.db
        .delete(sessions)
        .where(eq(sessions.id, id))
        .returning({ id: sessions.id })

      return deleted.length > 0
    })
  }

  async deleteAllOfUser(userId: UserId): Promise<Result<null, DomainError>> {
    return attempt('Failed to delete sessions of user', async () => {
      await this.db.delete(sessions).where(eq(sessions.userId, userId))
      return null
    })
  }

  private async findWhere(
    condition: SQL,
  ): Promise<Result<SessionWithAccount | null, DomainError>> {
    return attempt('Failed to find session', async () => {
      const [found] = await this.db
        .select({ session: sessions, ...accountColumns })
        .from(sessions)
        .innerJoin(users, and(eq(users.id, sessions.userId), userNotDeleted))
        .leftJoin(staff, staffOfUser)
        .leftJoin(salons, salonOfStaff)
        .where(condition)
        .limit(1)

      return found === undefined
        ? null
        : {
            session: found.session,
            account: { user: found.user, staffSalonId: found.staffSalonId },
          }
    })
  }
}
