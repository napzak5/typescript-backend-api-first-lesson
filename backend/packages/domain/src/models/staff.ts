import type { staff } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { staffMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const staffIdSchema = uuidSchema.brand<'StaffId'>()
export type StaffId = z.infer<typeof staffIdSchema>

const staffIdParameterSchema = z.object({ id: staffIdSchema })

export const parseStaffId = (id: unknown): Result<StaffId, DomainError> =>
  Result.map(
    parseWith(staffIdParameterSchema, { id }, staffMessages.invalidStaffId),
    (parameters) => parameters.id,
  )

const staffIdOfPathSchema = z.object({ staffId: staffIdSchema })

/**
 * The staff member in the path of a route below a staff member
 * (`/staff/{staffId}/...`); a failure is reported under `staffId`.
 */
export const parseStaffIdOfPath = (
  staffId: unknown,
): Result<StaffId, DomainError> =>
  Result.map(
    parseWith(staffIdOfPathSchema, { staffId }, staffMessages.invalidStaffId),
    (parameters) => parameters.staffId,
  )

// API types, generated from TypeSpec
export type ApiStaffResponse = components['schemas']['Models.StaffResponse']
export type ApiStaffCreateRequest =
  components['schemas']['Models.StaffCreateRequest']
export type ApiStaffUpdateRequest =
  components['schemas']['Models.StaffUpdateRequest']
export type ApiStaffSearchRequest = NonNullable<
  operations['StaffCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbStaff = DeepRequired<typeof staff.$inferSelect>

/**
 * Columns of `staff` that a request never writes: the database assigns `id`
 * and the timestamps, the salon comes from the path and a staff member
 * stays in it, a delete sets `deletedAt`, and the login account (`userId`)
 * is not the ledger's to link, because linking writes the user as well.
 */
type StaffManagedColumn =
  | 'id'
  | 'salonId'
  | 'userId'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewStaff = DeepRequired<
  Omit<typeof staff.$inferInsert, StaffManagedColumn>
>
export type DbStaffChanges = Partial<DbNewStaff>
