import type { Actor } from '../../../models/auth'
import type { LedgerReach } from '../../../models/booking'
import { bookingRemovalReachOf } from '../../booking/_shared/authorization'

/**
 * A share link puts a file of the salon before somebody outside it, so it
 * is those who delete the salon's files who create, read and revoke its
 * links: the platform's administrators, for every salon and for the files
 * of none, and the owner and the managers of a salon, for theirs. A staff
 * member reaches the files and shares none, not even the ones they
 * uploaded; a customer reaches neither.
 *
 * Null for an actor who manages no share link.
 */
export const shareLinkReachOf = (actor: Actor): LedgerReach | null =>
  bookingRemovalReachOf(actor)
