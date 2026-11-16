import { match, P } from 'ts-pattern'
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

/**
 * The sales an actor voids; null for an actor who voids none. A void
 * takes a sale out of what the salon earned and lets its booking be billed
 * again, so within a salon it is the owner's and the managers', as the
 * removal of a booking is: a staff member corrects a sale that was entered
 * wrongly.
 */
export const saleVoidReachOf = (actor: Actor): LedgerReach | null =>
  match(actor.scope)
    .returnType<LedgerReach | null>()
    .with({ type: 'platform' }, () => ({ type: 'everySalon' }))
    .with(
      { type: 'salon', role: P.union('owner', 'manager') },
      ({ salonId }) => ({ type: 'salon', salonId }),
    )
    .with(
      { type: 'salon', role: 'staff' },
      { type: 'customer' },
      { type: 'none' },
      () => null,
    )
    .exhaustive()
