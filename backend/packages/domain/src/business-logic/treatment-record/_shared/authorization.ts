import type { Actor } from '../../../models/auth'
import type { LedgerReach } from '../../../models/booking'
import {
  bookingReachOf,
  bookingRemovalReachOf,
} from '../../booking/_shared/authorization'

/**
 * A treatment record is the salon's, as the booking it is of: it holds what
 * the staff noted at the counselling and for one another next to what was
 * done. It is reached as the booking ledger is, by the platform's
 * administrators for every salon and by the members of a salon for their
 * salon. A customer reaches none, not even the records of their own
 * treatments.
 */

/**
 * The records an actor reads, writes and corrects; null for an actor who
 * reaches none. Every member of a salon writes the record of the
 * treatment they gave.
 */
export const treatmentRecordReachOf = (actor: Actor): LedgerReach | null =>
  bookingReachOf(actor)

/**
 * The records an actor removes; null for an actor who removes none. A
 * removal takes the materials and the photos with it, so within a salon it
 * is the owner's and the managers', as removing a booking is.
 */
export const treatmentRecordRemovalReachOf = (
  actor: Actor,
): LedgerReach | null => bookingRemovalReachOf(actor)
