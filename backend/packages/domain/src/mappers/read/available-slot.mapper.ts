import type { Slot } from '../../business-logic/available-slot/_shared/slots'
import type { ApiAvailableSlotResponse } from '../../models/available-slot'

/** A slot → API response: its times are written in UTC. */
export const AvailableSlotReadMapper = {
  toApiAvailableSlot({
    staffId,
    startTime,
    endTime,
  }: Slot): ApiAvailableSlotResponse {
    return {
      staffId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }
  },
}
