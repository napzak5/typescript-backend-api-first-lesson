import type { staff } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const staffIdSchema = uuidSchema.brand<'StaffId'>()
export type StaffId = z.infer<typeof staffIdSchema>

const staffIdParameterSchema = z.object({ id: staffIdSchema })

export const parseStaffId = (id: unknown): Result<StaffId, DomainError> =>
  Result.map(
    parseWith(staffIdParameterSchema, { id }, 'Invalid staff ID'),
    (parameters) => parameters.id,
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
 * stays in it, a delete sets `deletedAt`, the login account (`userId`) is
 * linked by an operation that writes the user as well, and `awards` is a
 * jsonb column without a defined structure.
 */
type StaffManagedColumn =
  | 'id'
  | 'salonId'
  | 'userId'
  | 'awards'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'

export type DbNewStaff = DeepRequired<
  Omit<typeof staff.$inferInsert, StaffManagedColumn>
>
export type DbStaffChanges = Partial<DbNewStaff>
