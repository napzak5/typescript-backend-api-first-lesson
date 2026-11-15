import type { Actor } from '../../../models/auth'
import type { SalonId } from '../../../models/salon'
import { bookingReachOf, isWithin } from '../../booking/_shared/authorization'

/**
 * The slots of a salon are what its customers may book, and every
 * signed-in user reads them: they say nothing about any booking.
 *
 * Asking whether a staff member is free at a time is asking the ledger. The
 * answer names the bookings that are in the way, so it is for those who
 * keep the ledger of the salon: the platform's administrators and the
 * members of the salon.
 */
export const mayAskLedgerOf = (actor: Actor, salonId: SalonId): boolean => {
  const reach = bookingReachOf(actor)

  return reach !== null && isWithin(reach, salonId)
}
