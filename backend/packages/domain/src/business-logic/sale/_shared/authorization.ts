import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { LedgerReach } from '../../../models/booking'

/**
 * The sales ledger is the salon's, as the booking ledger is: it holds what
 * the till charged, with what the staff members earn of it. It is kept by
 * the platform's administrators, for every salon, and by the members of a
 * salon, for their salon. A customer does not reach it.
 */

/** The sales an actor reaches; null for an actor who reaches none. */
export const saleReachOf = (actor: Actor): LedgerReach | null =>
  match(actor.scope)
    .returnType<LedgerReach | null>()
    .with({ type: 'platform' }, () => ({ type: 'everySalon' }))
    .with({ type: 'salon' }, ({ salonId }) => ({ type: 'salon', salonId }))
    .with({ type: 'customer' }, { type: 'none' }, () => null)
    .exhaustive()
