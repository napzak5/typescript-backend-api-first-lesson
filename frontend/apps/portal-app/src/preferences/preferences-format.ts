import type { ModelsTimeSlot } from '@beauty-salon-frontend/api-client'
import { type StaffChoice, staffLabelOf } from './staff-choices'

/** What stands where a preference would, when the customer has none */
export const UNSET = '指定なし'

/** A time slot as it is read: 「10:00〜12:00」. */
export const timeSlotOf = ({ startTime, endTime }: ModelsTimeSlot): string =>
  `${startTime}〜${endTime}`

/**
 * The names of the members of the staff with the given IDs, in the order
 * of the IDs. A member who is not among `staff` has no name to show, and is
 * left out.
 */
export const staffNamed = (
  ids: readonly string[],
  staff: readonly StaffChoice[],
): string[] =>
  ids.flatMap((id) => {
    const member = staff.find((choice) => choice.id === id)

    return member === undefined ? [] : [staffLabelOf(member)]
  })
