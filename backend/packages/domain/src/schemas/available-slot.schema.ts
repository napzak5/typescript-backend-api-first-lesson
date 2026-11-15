import { z } from 'zod'
import { slotPositionOf } from '../business-logic/available-slot/_shared/page'
import type {
  ApiAvailableSlotCheckRequest,
  ApiAvailableSlotSearchRequest,
} from '../models/available-slot'
import { serviceIdSchema } from '../models/service'
import { staffIdSchema } from '../models/staff'
import { minuteInUtc } from './booking.schema'

/**
 * Validation of the requests for the available slots of a salon. The
 * shapes are checked against the generated API types. Whether the service
 * and the staff member are the salon's is the repository's to say.
 */

/** A treatment takes no longer than a day, in minutes. */
const MAX_DURATION = 1440

export const availableSlotSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: z
    .string()
    .refine(
      (cursor) => slotPositionOf(cursor) !== null,
      'Must be the nextCursor of a page of available slots',
    )
    .exactOptional(),
  staffId: staffIdSchema.exactOptional(),
  serviceId: serviceIdSchema,
  date: z.iso.date(),
  duration: z.number().int().min(1).max(MAX_DURATION).exactOptional(),
}) satisfies z.ZodType<ApiAvailableSlotSearchRequest>

export const availableSlotCheckRequestSchema = z.strictObject({
  staffId: staffIdSchema,
  serviceId: serviceIdSchema,
  startTime: minuteInUtc,
}) satisfies z.ZodType<ApiAvailableSlotCheckRequest>
