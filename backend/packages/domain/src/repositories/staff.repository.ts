import type { Result } from '@beauty-salon-backend/utility'
import type { SalonId } from '../models/salon'
import type {
  DbNewStaff,
  DbStaff,
  DbStaffChanges,
  StaffId,
} from '../models/staff'
import type { DomainError } from '../shared'

/** Which staff members of a salon a list returns. */
export type StaffListCriteria = {
  salonId: SalonId
  limit: number
  /** Return the staff members that follow this one; null starts from the first. */
  after: StaffId | null
}

export type StaffList = {
  staff: DbStaff[]
  /** Number of staff members of the salon, across all pages. */
  total: number
  hasMore: boolean
}

/**
 * Persistence of the staff members of a salon. Every method is given the
 * salon and sees only its staff: a staff member of another salon is one
 * that does not exist. Whether the salon itself exists is not looked at
 * here.
 *
 * Deleted staff members are invisible to every method, except that a
 * deleted one still says where a page of the list begins. An email that a
 * staff member of the salon who is not deleted has, and a staff code that
 * any staff member of the salon has or had, are refused with
 * `alreadyExists`.
 */
/** What became of a staff member that was to be deleted. */
export type StaffDeletion =
  | { type: 'deleted' }
  /** The salon has no such staff member, or it is deleted already. */
  | { type: 'notFound' }
  /**
   * The staff member is in charge of a booking that is not finished, or
   * does one of its service lines.
   */
  | { type: 'bookingsUnfinished' }

export interface IStaffRepository {
  create(
    salonId: SalonId,
    staff: DbNewStaff,
  ): Promise<Result<DbStaff, DomainError>>

  findById(
    salonId: SalonId,
    id: StaffId,
  ): Promise<Result<DbStaff | null, DomainError>>

  /**
   * In the order of registration. Resolves to null when the cursor
   * (`after`) names no staff member of the salon.
   */
  list(
    criteria: StaffListCriteria,
  ): Promise<Result<StaffList | null, DomainError>>

  /** Resolves to null when the salon has no such staff member. */
  update(
    salonId: SalonId,
    id: StaffId,
    changes: DbStaffChanges,
  ): Promise<Result<DbStaff | null, DomainError>>

  /**
   * Deletes the staff member; the row stays. A staff member who is in
   * charge of a booking that is not finished, or does one of its service
   * lines, is not deleted.
   */
  delete(
    salonId: SalonId,
    id: StaffId,
  ): Promise<Result<StaffDeletion, DomainError>>
}
