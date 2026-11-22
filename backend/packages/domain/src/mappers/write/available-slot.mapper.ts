import { parseISO } from 'date-fns'
import type { Paging } from '../../models/page'
import type { SalonId } from '../../models/salon'
import type {
  OccupancyQuery,
  SlotDayQuery,
} from '../../repositories/available-slot.repository'
import type {
  AvailableSlotCheckRequest,
  AvailableSlotSearchRequest,
} from '../../schemas/available-slot.schema'
import { toPaging } from './page'

/**
 * API request → what the available slots of a salon are asked with. The
 * salon is the one of the path: a request names none. Slots are worked
 * out and not stored, so nothing here becomes a row.
 */
export const AvailableSlotWriteMapper = {
  /**
   * The day whose slots are listed, for one staff member or for all of
   * the salon, how long a slot is when the request says so (null leaves
   * it to the service), and the place of the page. The cursor of a page
   * of slots is its last slot itself, as the text a page gave it as.
   */
  fromSearchRequest(
    request: AvailableSlotSearchRequest,
    salonId: SalonId,
  ): Paging<string> & { day: SlotDayQuery; duration: number | null } {
    return {
      ...toPaging(request),
      day: {
        salonId,
        serviceId: request.serviceId,
        staffId: request.staffId ?? null,
        date: request.date,
      },
      duration: request.duration ?? null,
    }
  },

  /** The staff member, the service and the moment of which the ledger is asked. */
  fromCheckRequest(
    request: AvailableSlotCheckRequest,
    salonId: SalonId,
  ): OccupancyQuery {
    return {
      salonId,
      serviceId: request.serviceId,
      staffId: request.staffId,
      startTime: parseISO(request.startTime),
    }
  },
}
