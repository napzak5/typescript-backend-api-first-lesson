import { slotCursorOf } from '../../business-logic/available-slot/_shared/page'
import type { Slot } from '../../business-logic/available-slot/_shared/slots'
import type {
  ApiAvailableSlotCheckResponse,
  ApiAvailableSlotResponse,
} from '../../models/available-slot'
import type { ApiPage, Paging } from '../../models/page'
import { toApiPageEndingAt } from './page'

/** A slot → API response: its times are written in UTC. */
const toApiAvailableSlot = ({
  staffId,
  startTime,
  endTime,
}: Slot): ApiAvailableSlotResponse => ({
  staffId,
  startTime: startTime.toISOString(),
  endTime: endTime.toISOString(),
})

/** What was worked out of the available slots of a salon → API response. */
export const AvailableSlotReadMapper = {
  toApiAvailableSlot,

  /**
   * The slots of a page, of a list of `total` slots. Slots have no ID, so
   * the page after it starts behind its last slot itself (`slotCursorOf`).
   */
  toApiAvailableSlotPage(
    slots: Slot[],
    list: { total: number; hasMore: boolean },
    paging: Paging<string>,
  ): ApiPage<ApiAvailableSlotResponse> {
    const last = slots.at(-1)

    return toApiPageEndingAt(
      slots.map(toApiAvailableSlot),
      list,
      paging,
      last === undefined ? null : slotCursorOf(last),
    )
  },

  /**
   * Whether the ledger would take the booking that was asked about, and
   * the bookings that are in its way.
   */
  toApiCheck(
    isAvailable: boolean,
    conflicts: string[],
  ): ApiAvailableSlotCheckResponse {
    return { isAvailable, conflicts }
  },
}
