import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { LedgerReach } from '../../../models/booking'

/**
 * The points ledger is one for the whole platform, as the customer ledger
 * is: points are a customer's and not a salon's, and a customer uses them
 * at whatever salon they visit. It is kept by those who serve customers at
 * the till. A customer does not reach it; they see their balance in their
 * own profile.
 *
 * What an actor reaches decides which records a point transaction may refer
 * to: an administrator the sales and the bookings of every salon, a member
 * of a salon those of their salon. A record outside the reach is, to that
 * actor, a record that does not exist.
 */

/**
 * Who reads the points of a customer, earns them and uses them: the
 * administrators, and the owner, the managers and the staff of any salon.
 * Null for an actor who does none of it.
 */
export const pointReachOf = (actor: Actor): LedgerReach | null =>
  match(actor.scope)
    .returnType<LedgerReach | null>()
    .with({ type: 'platform' }, () => ({ type: 'everySalon' }))
    .with({ type: 'salon' }, ({ salonId }) => ({ type: 'salon', salonId }))
    .with({ type: 'customer' }, { type: 'none' }, () => null)
    .exhaustive()

/**
 * Who adjusts the points of a customer: the administrators, and the owner
 * and the managers of any salon. An adjustment moves points for no record
 * of the till, so within a salon it is not the staff's, as the void of a
 * sale is not. Null for an actor who adjusts none.
 */
export const pointAdjustReachOf = (actor: Actor): LedgerReach | null =>
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

/**
 * Who expires the points that lapsed: the administrators alone. The expiry
 * dates are a rule of the platform, and an expiry may run over the
 * customers of every salon.
 */
export const mayExpirePoints = (actor: Actor): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
