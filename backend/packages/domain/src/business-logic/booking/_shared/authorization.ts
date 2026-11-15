import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { BookingReach } from '../../../models/booking'
import type { SalonId } from '../../../models/salon'

/**
 * The booking ledger is the salon's: it holds what the salon notes for
 * itself next to what the customer asked for. It is kept by the platform's
 * administrators, for every salon, and by the members of a salon, for
 * their salon. A customer does not reach it, not even their own bookings.
 */

/** The bookings an actor reaches; null for an actor who reaches none. */
export const bookingReachOf = (actor: Actor): BookingReach | null =>
  match(actor.scope)
    .returnType<BookingReach | null>()
    .with({ type: 'platform' }, () => ({ type: 'everySalon' }))
    .with({ type: 'salon' }, ({ salonId }) => ({ type: 'salon', salonId }))
    .with({ type: 'customer' }, { type: 'none' }, () => null)
    .exhaustive()

/** Whether the bookings of a salon are within a reach. */
export const isWithin = (reach: BookingReach, salonId: SalonId): boolean =>
  match(reach)
    .with({ type: 'everySalon' }, () => true)
    .with({ type: 'salon' }, (own) => own.salonId === salonId)
    .exhaustive()
