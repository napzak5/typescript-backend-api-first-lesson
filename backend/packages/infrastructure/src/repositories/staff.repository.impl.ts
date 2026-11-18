import {
  bookingServices,
  bookings,
  staff,
} from '@beauty-salon-backend/database'
import {
  type DbNewStaff,
  type DbStaff,
  type DbStaffChanges,
  type DomainError,
  DomainErrors,
  type IStaffRepository,
  type SalonId,
  type StaffDeletion,
  type StaffId,
  type StaffList,
  type StaffListCriteria,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm'
import { match, P } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import { describeDatabaseError } from '../database/failure'
import type { Database } from '../database/index'
import {
  hasLineOfUnfinishedBooking,
  hasUnfinishedBooking,
} from './unfinished-bookings'

const emailTaken = {
  code: '23505',
  constraint_name: 'staff_email_salon_unique',
}

const staffCodeTaken = {
  code: '23505',
  constraint_name: 'staff_code_salon_unique',
}

/** The values of a write that no other staff member of the salon may have. */
type UniqueValues = {
  email: string | null
  staffCode: string | null
}

/**
 * Turns a failed write into a domain error. Two failures are expected: the
 * unique index on the salon and `email`, which covers the staff members
 * that are not deleted, and the unique constraint on the salon and
 * `staffCode`, which covers every staff member. drizzle wraps the driver
 * error, so a violation is looked for on the error and on its cause.
 * Anything else is unexpected and keeps a description that is safe to log.
 */
const toDomainError =
  (message: string, unique: UniqueValues) =>
  (cause: unknown): DomainError =>
    match({ cause, ...unique })
      .with(
        {
          email: P.string,
          cause: P.union(emailTaken, { cause: emailTaken }),
        },
        ({ email }) =>
          DomainErrors.alreadyExists('Staff member', 'email', email),
      )
      .with(
        {
          staffCode: P.string,
          cause: P.union(staffCodeTaken, { cause: staffCodeTaken }),
        },
        ({ staffCode }) =>
          DomainErrors.alreadyExists('Staff member', 'staffCode', staffCode),
      )
      .otherwise(() =>
        DomainErrors.database(message, describeDatabaseError(cause)),
      )

const attemptWrite = async <T>(
  message: string,
  unique: UniqueValues,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, unique),
  )

const notDeleted = isNull(staff.deletedAt)

const ofSalon = (salonId: SalonId, id: StaffId) =>
  and(eq(staff.id, id), eq(staff.salonId, salonId))

export class StaffRepository implements IStaffRepository {
  constructor(private readonly db: Database) {}

  async create(
    salonId: SalonId,
    member: DbNewStaff,
  ): Promise<Result<DbStaff, DomainError>> {
    const created = await attemptWrite(
      'Failed to create staff member',
      { email: member.email, staffCode: member.staffCode },
      async () => {
        const [inserted] = await this.db
          .insert(staff)
          .values({ ...member, salonId })
          .returning()

        return inserted ?? null
      },
    )

    return Result.flatMap(created, (row) =>
      row === null
        ? Result.error(
            DomainErrors.database(
              'Insert of staff member returned no row',
              null,
            ),
          )
        : Result.success(row),
    )
  }

  async findById(
    salonId: SalonId,
    id: StaffId,
  ): Promise<Result<DbStaff | null, DomainError>> {
    return attempt('Failed to find staff member', async () => {
      const [member] = await this.db
        .select()
        .from(staff)
        .where(and(ofSalon(salonId, id), notDeleted))
        .limit(1)

      return member ?? null
    })
  }

  async list({
    salonId,
    limit,
    after,
  }: StaffListCriteria): Promise<Result<StaffList | null, DomainError>> {
    const filters = and(eq(staff.salonId, salonId), notDeleted)

    return attempt('Failed to list staff', async () => {
      // Keyset pagination on (createdAt, id): the page starts after the
      // staff member the cursor names. A deleted staff member keeps its
      // row, so it still says where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ createdAt: staff.createdAt, id: staff.id })
              .from(staff)
              .where(ofSalon(salonId, after))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${staff.createdAt}, ${staff.id}) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`

      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(staff)
          .where(and(filters, afterCursor))
          .orderBy(asc(staff.createdAt), asc(staff.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(staff).where(filters),
      ])

      return {
        staff: page.slice(0, limit),
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    salonId: SalonId,
    id: StaffId,
    changes: DbStaffChanges,
  ): Promise<Result<DbStaff | null, DomainError>> {
    return attemptWrite(
      'Failed to update staff member',
      {
        email: changes.email ?? null,
        staffCode: changes.staffCode ?? null,
      },
      async () => {
        // One statement: a staff member who is deleted at the same moment
        // is changed before the delete or not found after it.
        const [updated] = await this.db
          .update(staff)
          .set({ ...changes, updatedAt: CLOCK })
          .where(and(ofSalon(salonId, id), notDeleted))
          .returning()

        return updated ?? null
      },
    )
  }

  async delete(
    salonId: SalonId,
    id: StaffId,
  ): Promise<Result<StaffDeletion, DomainError>> {
    return attempt('Failed to delete staff member', () =>
      this.db.transaction(
        async (tx): Promise<StaffDeletion> => {
          // An entry and a reschedule of a booking hold the rows of the
          // staff members they name until they have written: the look for
          // bookings is after this lock.
          const [held] = await tx
            .select({ id: staff.id })
            .from(staff)
            .where(and(ofSalon(salonId, id), notDeleted))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }
          if (
            (await hasUnfinishedBooking(tx, eq(bookings.staffId, id))) ||
            (await hasLineOfUnfinishedBooking(
              tx,
              eq(bookingServices.staffId, id),
            ))
          ) {
            return { type: 'bookingsUnfinished' }
          }

          await tx
            .update(staff)
            .set({ deletedAt: CLOCK, updatedAt: CLOCK })
            .where(eq(staff.id, id))

          return { type: 'deleted' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }
}
