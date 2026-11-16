import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { SalonId } from '../../../models/salon'

/**
 * The payment methods of a salon are a setting of the salon, with what the
 * salon pays a payment processor. They are not shown to customers.
 */

/**
 * Who reads them: the platform's administrators, and everybody who works at
 * the salon. A staff member at the till chooses among them.
 */
export const mayReadPaymentMethods = (
  actor: Actor,
  salonId: SalonId,
): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with({ type: 'salon' }, (scope) => scope.salonId === salonId)
    .with({ type: 'customer' }, { type: 'none' }, () => false)
    .exhaustive()

/**
 * Who sets them up: the platform's administrators, and the owner and the
 * managers of the salon itself, who keep its menu as well.
 */
export const mayKeepPaymentMethods = (
  actor: Actor,
  salonId: SalonId,
): boolean =>
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
