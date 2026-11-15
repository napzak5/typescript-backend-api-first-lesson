import { z } from 'zod'
import { salonIdSchema } from '../models/salon'
import { staffIdSchema } from '../models/staff'
import type {
  ApiStaffProfileSearchRequest,
  ApiStaffProfileUpdateRequest,
} from '../models/staff-profile'
import { atLeastOneProperty, nonBlankText } from './rules'
import { staffCreateRequestSchema } from './staff.schema'

/**
 * Validation of the search for staff profiles. The shape is checked against
 * the generated API type; the limit of `city` is that of the column of the
 * salon it is compared with.
 */
export const staffProfileSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: staffIdSchema.exactOptional(),
  salonId: salonIdSchema.exactOptional(),
  specialty: nonBlankText.exactOptional(),
  city: nonBlankText.max(100).exactOptional(),
}) satisfies z.ZodType<ApiStaffProfileSearchRequest>

/**
 * What a staff member writes about themselves: the properties of their
 * entry in the ledger that describe them, under the rules of the ledger.
 * A request that names another property of the entry is refused, like one
 * that names none.
 */
export const staffProfileUpdateRequestSchema = staffCreateRequestSchema
  .pick({
    specialties: true,
    bio: true,
    imageUrl: true,
    yearsOfExperience: true,
    certifications: true,
  })
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiStaffProfileUpdateRequest>
