import { openingHours, salons } from '@beauty-salon-backend/database'
import {
  type DbNewOpeningHours,
  type DbNewSalon,
  type DbOpeningHours,
  type DbSalon,
  type DbSalonChanges,
  type DomainError,
  DomainErrors,
  type ISalonRepository,
  type OpeningHoursChange,
  type SalonId,
  type SalonList,
  type SalonListCriteria,
  type SalonWithOpeningHours,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { match, P } from 'ts-pattern'
import { describeDatabaseError } from '../database/failure'
import type { Database, DatabaseExecutor } from '../database/index'

const emailUniqueViolation = {
  code: '23505',
  constraint_name: 'salons_email_unique',
}

/**
 * Turns a failed write into a domain error. The unique index on `email`,
 * which covers the salons that are not deleted, is the only expected failure;
 * drizzle wraps the driver error, so the violation is looked for on the error
 * and on its cause. Anything else is
 * unexpected and keeps a description that is safe to log.
 */
const toDomainError =
  (message: string, email: string | null) =>
  (cause: unknown): DomainError =>
    match({ cause, email })
      .with(
        {
          email: P.string,
          cause: P.union(emailUniqueViolation, { cause: emailUniqueViolation }),
        },
        (violation) =>
          DomainErrors.alreadyExists('Salon', 'email', violation.email),
      )
      .otherwise(() =>
        DomainErrors.database(message, describeDatabaseError(cause)),
      )

const attempt = async <T>(
  message: string,
  email: string | null,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, email),
  )

/** A LIKE pattern that matches `keyword` literally, anywhere in the text. */
const containing = (keyword: string): string =>
  `%${keyword.replace(/[\\%_]/g, '\\$&')}%`

const notDeleted = isNull(salons.deletedAt)

const selectOpeningHours = async (
  executor: DatabaseExecutor,
  salonIds: string[],
): Promise<DbOpeningHours[]> =>
  salonIds.length === 0
    ? []
    : executor
        .select()
        .from(openingHours)
        .where(inArray(openingHours.salonId, salonIds))
        .orderBy(asc(openingHours.date), asc(openingHours.id))

const insertOpeningHours = async (
  executor: DatabaseExecutor,
  salonId: string,
  rows: DbNewOpeningHours[],
): Promise<void> => {
  if (rows.length > 0) {
    await executor
      .insert(openingHours)
      .values(rows.map((row) => ({ ...row, salonId })))
  }
}

const withOpeningHours = async (
  executor: DatabaseExecutor,
  salon: DbSalon,
): Promise<SalonWithOpeningHours> => ({
  salon,
  openingHours: await selectOpeningHours(executor, [salon.id]),
})

export class SalonRepository implements ISalonRepository {
  constructor(private readonly db: Database) {}

  async create(
    salon: DbNewSalon,
    newOpeningHours: DbNewOpeningHours[],
  ): Promise<Result<SalonWithOpeningHours, DomainError>> {
    const created = await attempt('Failed to create salon', salon.email, () =>
      this.db.transaction(async (tx) => {
        const [inserted] = await tx.insert(salons).values(salon).returning()
        if (inserted === undefined) {
          return null
        }
        await insertOpeningHours(tx, inserted.id, newOpeningHours)
        return withOpeningHours(tx, inserted)
      }),
    )

    return Result.flatMap(created, (data) =>
      data === null
        ? Result.error(
            DomainErrors.database('Insert of salon returned no row', null),
          )
        : Result.success(data),
    )
  }

  async findById(
    id: SalonId,
  ): Promise<Result<SalonWithOpeningHours | null, DomainError>> {
    return attempt('Failed to find salon', null, async () => {
      const [salon] = await this.db
        .select()
        .from(salons)
        .where(and(eq(salons.id, id), notDeleted))
        .limit(1)

      return salon === undefined ? null : withOpeningHours(this.db, salon)
    })
  }

  async exists(id: SalonId): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to look for salon', null, async () => {
      const [found] = await this.db
        .select({ id: salons.id })
        .from(salons)
        .where(and(eq(salons.id, id), notDeleted))
        .limit(1)

      return found !== undefined
    })
  }

  async list(
    criteria: SalonListCriteria,
  ): Promise<Result<SalonList, DomainError>> {
    const { limit, after, keyword, prefecture, city, isActive, minRating } =
      criteria

    const filters = and(
      notDeleted,
      keyword === null
        ? undefined
        : or(
            ilike(salons.name, containing(keyword)),
            ilike(salons.description, containing(keyword)),
          ),
      prefecture === null ? undefined : eq(salons.prefecture, prefecture),
      city === null ? undefined : eq(salons.city, city),
      isActive === null ? undefined : eq(salons.isActive, isActive),
      minRating === null ? undefined : gte(salons.rating, String(minRating)),
      criteria.features.length === 0
        ? undefined
        : arrayContains(salons.features, criteria.features),
    )

    // Keyset pagination on (createdAt, id): the page starts after the row
    // the cursor names, wherever that row is by now.
    const cursorSalon = alias(salons, 'cursor_salon')
    const afterCursor =
      after === null
        ? undefined
        : sql`(${salons.createdAt}, ${salons.id}) < (${this.db
            .select({ createdAt: cursorSalon.createdAt, id: cursorSalon.id })
            .from(cursorSalon)
            .where(eq(cursorSalon.id, after))})`

    return attempt('Failed to list salons', null, async () => {
      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(salons)
          .where(and(filters, afterCursor))
          .orderBy(desc(salons.createdAt), desc(salons.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(salons).where(filters),
      ])

      const pageSalons = page.slice(0, limit)
      const calendars = Map.groupBy(
        await selectOpeningHours(
          this.db,
          pageSalons.map((salon) => salon.id),
        ),
        (row) => row.salonId,
      )

      return {
        salons: pageSalons.map((salon) => ({
          salon,
          openingHours: calendars.get(salon.id) ?? [],
        })),
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    id: SalonId,
    changes: DbSalonChanges,
    openingHoursChange: OpeningHoursChange,
  ): Promise<Result<SalonWithOpeningHours | null, DomainError>> {
    return attempt('Failed to update salon', changes.email ?? null, () =>
      this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(salons)
          .set({ ...changes, updatedAt: sql`now()` })
          .where(and(eq(salons.id, id), notDeleted))
          .returning()
        if (updated === undefined) {
          return null
        }

        await match(openingHoursChange)
          .with({ type: 'keep' }, async () => undefined)
          .with({ type: 'replace' }, async (replacement) => {
            await tx.delete(openingHours).where(eq(openingHours.salonId, id))
            await insertOpeningHours(tx, id, replacement.openingHours)
          })
          .exhaustive()

        return withOpeningHours(tx, updated)
      }),
    )
  }

  async delete(id: SalonId): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to delete salon', null, async () => {
      const deleted = await this.db
        .update(salons)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(eq(salons.id, id), notDeleted))
        .returning({ id: salons.id })

      return deleted.length > 0
    })
  }
}
