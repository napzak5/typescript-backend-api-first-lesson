import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { SalonId } from '../../../models/salon'

/**
 * The products of a salon are what it sells at its counter and uses in its
 * treatments, with what it pays for them and where it buys them. They are
 * not shown to customers.
 */

/**
 * Who reads them: the platform's administrators, and everybody who works at
 * the salon. A staff member uses them in a treatment and sells them at the
 * till.
 */
export const mayReadProducts = (actor: Actor, salonId: SalonId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with({ type: 'salon' }, (scope) => scope.salonId === salonId)
    .with({ type: 'customer' }, { type: 'none' }, () => false)
    .exhaustive()

/**
 * Who keeps them: the platform's administrators, and the owner and the
 * managers of the salon itself, who keep its menu and its payment methods
 * as well.
 */
export const mayKeepProducts = (actor: Actor, salonId: SalonId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon', role: P.union('owner', 'manager') },
      (scope) => scope.salonId === salonId,
    )
    .with(
      { type: 'salon', role: 'staff' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
