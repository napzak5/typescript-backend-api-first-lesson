import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { LedgerReach } from '../../../models/booking'

/**
 * The reports of a salon show what the whole salon earned and how much
 * each staff member brought in, so they are for those who run the salon:
 * the platform's administrators, for every salon, and the owner and the
 * managers of a salon, for their salon. A staff member keeps the sales
 * ledger but is not shown the reports, and a customer reaches neither.
 */

/** The salons whose reports an actor reads; null for an actor who reads none. */
export const salesReportReachOf = (actor: Actor): LedgerReach | null =>
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
