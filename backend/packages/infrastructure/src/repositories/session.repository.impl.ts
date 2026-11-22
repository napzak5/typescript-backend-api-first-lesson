import { salons, sessions, staff, users } from '@beauty-salon-backend/database'
import {
  type DbNewSession,
  type DbSession,
  type DomainError,
  DomainErrors,
  type ISessionRepository,
  type SessionId,
  type SessionList,
  type SessionListCriteria,
  type SessionRotation,
  type SessionWithAccount,
  type UserId,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, count, desc, eq, gt, lte, type SQL, sql } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import type { Database } from '../database/index'
import {
  accountColumns,
  salonOfStaff,
  staffOfUser,
  userNotDeleted,
} from './_shared/account'

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

  async listOfUser({
    userId,
    now,
    limit,
    after,
  }: SessionListCriteria): Promise<Result<SessionList | null, DomainError>> {
    const notEnded = and(
      eq(sessions.userId, userId),
      gt(sessions.refreshExpiresAt, now),
    )

    return attempt('Failed to list sessions', async () => {
      // Keyset pagination on (createdAt, id): the page starts after the
      // session the cursor names, which must still be there to say where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ createdAt: sessions.createdAt, id: sessions.id })
              .from(sessions)
              .where(and(eq(sessions.id, after), eq(sessions.userId, userId)))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${sessions.createdAt}, ${sessions.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`

      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(sessions)
          .where(and(notEnded, afterCursor))
          .orderBy(desc(sessions.createdAt), desc(sessions.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(sessions).where(notEnded),
      ])

      return {
        sessions: page.slice(0, limit),
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
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

  async deleteOfUser(
    id: SessionId,
    userId: UserId,
    now: string,
  ): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to delete session of user', async () => {
      const deleted = await this.db
        .delete(sessions)
        .where(
          and(
            eq(sessions.id, id),
            eq(sessions.userId, userId),
            gt(sessions.refreshExpiresAt, now),
          ),
        )
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
