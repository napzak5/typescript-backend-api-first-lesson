import { salons, staff } from '@beauty-salon-backend/database'
import type {
  DbStaffProfile,
  DomainError,
  IStaffProfileRepository,
  StaffId,
  StaffProfileChanges,
  StaffProfileList,
  StaffProfileListCriteria,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, arrayContains, asc, count, eq, isNull, sql } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import { totalOf } from '../database/count'
import type { Database } from '../database/index'

/** The columns customers are shown; no other column of `staff` is read. */
const profileColumns = {
  id: staff.id,
  salonId: staff.salonId,
  displayName: staff.displayName,
  level: staff.level,
  position: staff.position,
  specialties: staff.specialties,
  bio: staff.bio,
  imageUrl: staff.imageUrl,
  yearsOfExperience: staff.yearsOfExperience,
  certifications: staff.certifications,
  canReceiveBookings: staff.canReceiveBookings,
}

const salonOfStaff = eq(salons.id, staff.salonId)

/**
 * Whom customers are shown: the staff members who work at their salon and
 * are not deleted, of salons that are not deleted.
 */
const shown = and(
  eq(staff.isActive, true),
  isNull(staff.deletedAt),
  isNull(salons.deletedAt),
)

export class StaffProfileRepository implements IStaffProfileRepository {
  constructor(private readonly db: Database) {}

  async findById(
    id: StaffId,
  ): Promise<Result<DbStaffProfile | null, DomainError>> {
    return attempt('Failed to find staff profile', async () => {
      const [profile] = await this.db
        .select(profileColumns)
        .from(staff)
        .innerJoin(salons, salonOfStaff)
        .where(and(eq(staff.id, id), shown))
        .limit(1)

      return profile ?? null
    })
  }

  async update(
    id: StaffId,
    changes: StaffProfileChanges,
  ): Promise<Result<DbStaffProfile | null, DomainError>> {
    return attempt('Failed to update staff profile', async () => {
      // One statement: a staff member who stops being shown while it runs
      // is either written before that or not at all.
      const [profile] = await this.db
        .update(staff)
        .set({ ...changes, updatedAt: CLOCK })
        .from(salons)
        .where(and(eq(staff.id, id), salonOfStaff, shown))
        .returning(profileColumns)

      return profile ?? null
    })
  }

  async list({
    limit,
    after,
    salonId,
    specialty,
    city,
  }: StaffProfileListCriteria): Promise<
    Result<StaffProfileList | null, DomainError>
  > {
    const filters = and(
      shown,
      salonId === null ? undefined : eq(staff.salonId, salonId),
      specialty === null
        ? undefined
        : arrayContains(staff.specialties, [specialty]),
      city === null ? undefined : eq(salons.city, city),
    )

    return attempt('Failed to list staff profiles', async () => {
      // Keyset pagination on (createdAt, id): the page starts after the
      // staff member the cursor names. Any staff member will do, shown or
      // not: the row stays, so it still says where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ createdAt: staff.createdAt, id: staff.id })
              .from(staff)
              .where(eq(staff.id, after))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${staff.createdAt}, ${staff.id}) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`

      const [page, counted] = await Promise.all([
        this.db
          .select(profileColumns)
          .from(staff)
          .innerJoin(salons, salonOfStaff)
          .where(and(filters, afterCursor))
          .orderBy(asc(staff.createdAt), asc(staff.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db
          .select({ total: count() })
          .from(staff)
          .innerJoin(salons, salonOfStaff)
          .where(filters),
      ])

      return {
        profiles: page.slice(0, limit),
        total: totalOf(counted),
        hasMore: page.length > limit,
      }
    })
  }
}
