import { z } from 'zod'
import { salonIdSchema } from '../models/salon'
import { staffIdSchema } from '../models/staff'
import type { ApiStaffProfileSearchRequest } from '../models/staff-profile'
import { nonBlankText } from './rules'

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
