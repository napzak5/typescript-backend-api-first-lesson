import { parseISO } from 'date-fns'
import { z } from 'zod'
import { staffIdSchema } from '../../../models/staff'
import type { Slot } from './slots'

/**
 * Where a page of slots ends. Slots have no ID, so the cursor of a page is
 * its last slot itself: when it begins and whose it is,
 * `<startTime>_<staffId>`. The next page begins with the slot after it,
 * whether or not that slot is still free.
 */

const SEPARATOR = '_'

const positionSchema = z.strictObject({
  startTime: z.iso.datetime(),
  staffId: staffIdSchema,
})

/** The slot a cursor names. */
export type SlotPosition = {
  startTime: Date
  staffId: string
}

/** The slot a cursor names; null for a text that is not a cursor of slots. */
export const slotPositionOf = (cursor: string): SlotPosition | null => {
  const [startTime, staffId, ...rest] = cursor.split(SEPARATOR)
  const parsed = positionSchema.safeParse({ startTime, staffId })

  return parsed.success && rest.length === 0
    ? {
        startTime: parseISO(parsed.data.startTime),
        staffId: parsed.data.staffId,
      }
    : null
}

export const slotCursorOf = ({ startTime, staffId }: Slot): string =>
  `${startTime.toISOString()}${SEPARATOR}${staffId}`

/** Whether a slot comes after a position in the order slots are listed in. */
export const comesAfter = (slot: Slot, position: SlotPosition): boolean =>
  slot.startTime > position.startTime ||
  (slot.startTime.getTime() === position.startTime.getTime() &&
    slot.staffId > position.staffId)
