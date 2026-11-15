import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { SalonId } from '../../../models/salon'
import type { SalonRole } from '../../../models/staff-invitation'
import { mayKeepStaffLedger } from '../../staff/_shared/authorization'

/**
 * Who may invite the staff members of a salon, look at their invitations
 * and take them back: whoever keeps the staff ledger of the salon. Keeping
 * the ledger already decides which accounts reach the salon.
 */
export const mayInviteStaff = (actor: Actor, salonId: SalonId): boolean =>
  mayKeepStaffLedger(actor, salonId)

/**
 * Whether an actor who may invite may give this role. Who runs a salon is
 * for the platform to say, which also registers the salons: an owner
 * invites managers and staff, and no owner makes another owner. An owner
 * whose session is taken over can then not be replaced by an account the
 * intruder keeps.
 */
export const mayGiveRole = (actor: Actor, role: SalonRole): boolean =>
  match(role)
    .with('owner', () => actor.scope.type === 'platform')
    .with('manager', 'staff', () => true)
    .exhaustive()
