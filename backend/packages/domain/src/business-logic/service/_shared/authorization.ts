import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { SalonId } from '../../../models/salon'

/**
 * The services of a salon's menu are kept by those who keep the salon: the
 * platform's administrators, and the owner and the managers of the salon
 * itself. Reading them needs no permission.
 */
export const mayManageServices = (actor: Actor, salonId: SalonId): boolean =>
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
