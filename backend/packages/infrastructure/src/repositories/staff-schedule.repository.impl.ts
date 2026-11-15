import { staff, staffSchedules } from '@beauty-salon-backend/database'
import type {
  DbNewStaffSchedule,
  DbStaffSchedule,
  DomainError,
  IStaffScheduleRepository,
  SalonId,
  StaffId,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import type { Database, DatabaseExecutor } from '../database/index'

/** The staff member, if the salon has them and they are not deleted. */
const staffMemberOf = (salonId: SalonId, staffId: StaffId) =>
  and(
    eq(staff.id, staffId),
    eq(staff.salonId, salonId),
    isNull(staff.deletedAt),
  )

/**
 * The weekly rows from Monday to Sunday, which is the order of the
 * `day_of_week` type, then the rows for single days from the earliest
 * date on. A weekly row has no date and a row for a single day no day of
 * the week, so each column orders one of the two groups.
 */
const schedulesOf = (
  executor: DatabaseExecutor,
  staffId: StaffId,
): Promise<DbStaffSchedule[]> =>
  executor
    .select()
    .from(staffSchedules)
    .where(eq(staffSchedules.staffId, staffId))
    .orderBy(
      desc(staffSchedules.isRecurring),
      asc(staffSchedules.dayOfWeek),
      asc(staffSchedules.date),
    )

export class StaffScheduleRepository implements IStaffScheduleRepository {
  constructor(private readonly db: Database) {}

  async findByStaff(
    salonId: SalonId,
    staffId: StaffId,
  ): Promise<Result<DbStaffSchedule[] | null, DomainError>> {
    return attempt('Failed to find staff schedules', async () => {
      const [member] = await this.db
        .select({ id: staff.id })
        .from(staff)
        .where(staffMemberOf(salonId, staffId))
        .limit(1)

      return member === undefined ? null : schedulesOf(this.db, staffId)
    })
  }

  async replace(
    salonId: SalonId,
    staffId: StaffId,
    schedules: DbNewStaffSchedule[],
  ): Promise<Result<DbStaffSchedule[] | null, DomainError>> {
    return attempt('Failed to replace staff schedules', () =>
      this.db.transaction(async (tx) => {
        // The staff member is locked: of two replacements that arrive
        // together, the second waits here until the first has written all
        // its rows, and a staff member who is found is not deleted before
        // the rows are written.
        const [locked] = await tx
          .select({ id: staff.id })
          .from(staff)
          .where(staffMemberOf(salonId, staffId))
          .for('update')
        if (locked === undefined) {
          return null
        }

        await tx
          .delete(staffSchedules)
          .where(eq(staffSchedules.staffId, staffId))
        if (schedules.length > 0) {
          await tx
            .insert(staffSchedules)
            .values(schedules.map((schedule) => ({ ...schedule, staffId })))
        }

        return schedulesOf(tx, staffId)
      }),
    )
  }
}
