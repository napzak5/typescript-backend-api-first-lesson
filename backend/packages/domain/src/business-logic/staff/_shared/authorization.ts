import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { SalonId } from '../../../models/salon'
import type { StaffId } from '../../../models/staff'

/**
 * The staff ledger of a salon holds what an employer keeps about the people
 * who work there: their pay, their contact details, and whether they are
 * still with the salon. It is kept by the platform's administrators and by
 * the owner of the salon itself.
 *
 * A manager is not let in. Besides the pay, deactivating or deleting a staff
 * member takes the salon away from the account of that member, and a
 * manager could take it from the owner.
 */
export const mayKeepStaffLedger = (actor: Actor, salonId: SalonId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon', role: 'owner' },
      (scope) => scope.salonId === salonId,
    )
    .with(
      { type: 'salon', role: P.union('manager', 'staff') },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()

/**
 * Whether the staff member is the one that gives the actor's own account
 * its salon. Deactivating or deleting it would lock the actor out, and
 * nothing the actor could do afterwards would undo that.
 */
export const isOwnStaffRecord = (actor: Actor, staffId: StaffId): boolean =>
  match(actor.scope)
    .with({ type: 'salon' }, (scope) => scope.staffId === staffId)
    .with(
      { type: 'platform' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
