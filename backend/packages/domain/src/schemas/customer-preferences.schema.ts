import { z } from 'zod'
import type {
  ApiCustomerPreferencesUpdateRequest,
  ApiStylePreference,
  ApiTimeSlot,
} from '../models/customer-preferences'
import { staffIdSchema } from '../models/staff'
import {
  atLeastOneProperty,
  nonBlankText,
  noRepeatedEntries,
  orderedTimeSlot,
  timeSlot,
} from './rules'

/**
 * Validation of the preferences of a customer. The shapes are checked
 * against the generated API types, the length limit is that of the database
 * column, and the remaining rules are business rules. That the preferred
 * staff member is not among the avoided ones holds for the preferences as
 * they are stored afterwards, so it is not a rule of the request alone
 * (`business-logic/customer-preferences/_shared/rules.ts`).
 */

/**
 * Shape of the `preferredTimeSlots` JSON column. Stored values are checked
 * against it when they are read, because the database only keeps them an
 * array.
 */
export const storedTimeSlotsSchema = z.array(timeSlot) satisfies z.ZodType<
  ApiTimeSlot[]
>

/**
 * Shape of the `stylePreferences` JSON column. Stored values are checked
 * against it when they are read, because the database only keeps them
 * objects.
 */
export const storedStylePreferenceSchema = z.strictObject({
  preferredLength: z.string().nullable(),
  preferredColors: z.array(z.string()),
  avoidStyles: z.array(z.string()),
  inspirationImages: z.array(z.string()),
}) satisfies z.ZodType<ApiStylePreference>

/**
 * For a list of time slots that must not overlap: a slot that begins before
 * an earlier one ends, and ends after that one begins, is reported under
 * its own index. Two slots may touch.
 */
const noOverlappingTimeSlots = (
  context: z.core.ParsePayload<
    readonly { startTime: string; endTime: string }[]
  >,
): void => {
  context.value.forEach((slot, index) => {
    const overlapsAnEarlierOne = context.value
      .slice(0, index)
      .some(
        (earlier) =>
          slot.startTime < earlier.endTime && earlier.startTime < slot.endTime,
      )
    if (overlapsAnEarlierOne) {
      context.issues.push({
        code: 'custom',
        path: [index],
        message: 'Must not overlap an earlier time slot',
        input: slot,
      })
    }
  })
}

const texts = z.array(nonBlankText).check(noRepeatedEntries)

const stylePreferenceSchema = storedStylePreferenceSchema.extend({
  preferredLength: nonBlankText.nullable(),
  preferredColors: texts,
  avoidStyles: texts,
  inspirationImages: z.array(z.httpUrl().max(500)).check(noRepeatedEntries),
})

export const customerPreferencesUpdateRequestSchema = z
  .strictObject({
    preferredStaffId: staffIdSchema.nullable(),
    preferredTimeSlots: z.array(orderedTimeSlot).check(noOverlappingTimeSlots),
    avoidStaffIds: z.array(staffIdSchema).check(noRepeatedEntries),
    stylePreferences: stylePreferenceSchema.nullable(),
    communicationStyle: nonBlankText.max(100).nullable(),
    specialRequests: nonBlankText.nullable(),
  })
  .exactPartial()
  .check(
    atLeastOneProperty,
  ) satisfies z.ZodType<ApiCustomerPreferencesUpdateRequest>
