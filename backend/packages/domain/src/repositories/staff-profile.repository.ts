import type { Result } from '@beauty-salon-backend/utility'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type { DbStaffProfile } from '../models/staff-profile'
import type { DomainError } from '../shared'

/** Which staff profiles a list returns. Every filter that is set must hold. */
export type StaffProfileListCriteria = {
  limit: number
  /** Return the profiles that follow this staff member; null starts from the first. */
  after: StaffId | null
  /** The staff members of this salon. */
  salonId: SalonId | null
  /** The staff members who name exactly this among their specialties. */
  specialty: string | null
  /** The staff members of the salons in exactly this city. */
  city: string | null
}

export type StaffProfileList = {
  profiles: DbStaffProfile[]
  /** Number of matching profiles, across all pages. */
  total: number
  hasMore: boolean
}

/**
 * What a staff member changes of their own profile. A property that is
 * absent stays as it is.
 */
export type StaffProfileChanges = Partial<
  Pick<
    DbStaffProfile,
    'specialties' | 'bio' | 'imageUrl' | 'yearsOfExperience' | 'certifications'
  >
>

/**
 * Reads the staff members that customers are shown, across all salons: the
 * ones who work at their salon (`isActive`) and are not deleted, of salons
 * that are not deleted. Every other staff member is invisible to every
 * method, except that any staff member still says where a page of the list
 * begins. Only the columns of the profile are read.
 */
export interface IStaffProfileRepository {
  findById(id: StaffId): Promise<Result<DbStaffProfile | null, DomainError>>

  /**
   * Changes the given columns of a staff member that customers are shown,
   * and resolves to the profile as it is stored then. Resolves to null,
   * and writes nothing, for a staff member that is not shown.
   */
  update(
    id: StaffId,
    changes: StaffProfileChanges,
  ): Promise<Result<DbStaffProfile | null, DomainError>>

  /**
   * In the order of registration. Resolves to null when the cursor (`after`)
   * names no staff member.
   */
  list(
    criteria: StaffProfileListCriteria,
  ): Promise<Result<StaffProfileList | null, DomainError>>
}
