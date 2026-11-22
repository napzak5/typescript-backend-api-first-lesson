import type {
  ModelsBusinessHours,
  ModelsOpeningHours,
  ModelsSalonResponse,
  ModelsSalonUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { readSalon } from '@beauty-salon-frontend/salon-screens'
import { changeSalon, type SalonChange } from './settings-api'

/*
 * The hours of a salon: its regular week and the dates of its calendar.
 * The API replaces each of them whole, so a change is made against the
 * hours that were read, and not over hours somebody else changed since.
 */

/** The hours of a salon, as the API keeps them. */
export type Hours = {
  businessHours: ModelsBusinessHours[] | null
  openingHours: ModelsOpeningHours[]
}

/** The hours of a salon that was read. */
export const hoursOf = ({
  businessHours,
  openingHours,
}: ModelsSalonResponse): Hours => ({ businessHours, openingHours })

/** Whether two readings of the hours hold the same: the API lists them in one order. */
export const sameHours = (one: Hours, other: Hours): boolean =>
  JSON.stringify([one.businessHours, one.openingHours]) ===
  JSON.stringify([other.businessHours, other.openingHours])

/** What came of an attempt to change the hours: somebody else may have changed them since the form opened. */
export type HoursAttempt =
  | SalonChange
  | {
      type: 'changed'
      /** The hours as they are now */
      hours: Hours
    }

/**
 * Changes the hours of a salon unless somebody else changed them since the
 * form read them (`opened`): the API replaces the week and the calendar
 * whole, and would drop what the other person wrote. Hours that were
 * changed are not replaced, and come back as they are now: the next
 * attempt is made against them.
 */
export const attemptHoursChange = async (
  salonId: string,
  opened: Hours,
  request: ModelsSalonUpdateRequest,
): Promise<HoursAttempt> => {
  const now = await readSalon(salonId)
  if (now.type !== 'found') {
    return now
  }
  const hours = hoursOf(now.salon)
  if (!sameHours(hours, opened)) {
    return { type: 'changed', hours }
  }

  return changeSalon(salonId, request)
}
