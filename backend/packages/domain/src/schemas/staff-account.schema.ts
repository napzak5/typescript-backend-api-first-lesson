import { SalonRoleTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import type { ApiStaffAccountUpdateRequest } from '../models/staff-account'
import { atLeastOneProperty } from './rules'

/**
 * Validation of the request that changes the account of a staff member.
 * The shape is checked against the generated API type. The role is the
 * one property there is, and a request without it changes nothing and is
 * refused, as every update that names no property is.
 */
export const staffAccountUpdateRequestSchema = z
  .strictObject({
    role: SalonRoleTypeSchema.exactOptional(),
  })
  .check(atLeastOneProperty) satisfies z.ZodType<ApiStaffAccountUpdateRequest>
