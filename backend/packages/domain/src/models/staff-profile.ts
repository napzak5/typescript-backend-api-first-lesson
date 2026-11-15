import type { components, operations } from '@beauty-salon-backend/generated'
import type { DbStaff } from './staff'

/**
 * The profile of a staff member: what customers are shown of a row of
 * `staff`. The ledger (`./staff`) holds the row as the salon keeps it.
 */

// API types, generated from TypeSpec
export type ApiStaffProfileResponse =
  components['schemas']['Models.StaffProfileResponse']
export type ApiStaffProfileSearchRequest = NonNullable<
  operations['StaffProfile_list']['parameters']['query']
>
export type ApiStaffProfileUpdateRequest =
  components['schemas']['Models.StaffProfileUpdateRequest']

/**
 * The columns of `staff` that customers are shown. The name of a staff
 * member is the one the salon chose for customers (`displayName`); the real
 * name, the contact details and what the salon keeps as an employer are not
 * among them.
 */
export type DbStaffProfile = Pick<
  DbStaff,
  | 'id'
  | 'salonId'
  | 'displayName'
  | 'level'
  | 'position'
  | 'specialties'
  | 'bio'
  | 'imageUrl'
  | 'yearsOfExperience'
  | 'certifications'
  | 'canReceiveBookings'
>
