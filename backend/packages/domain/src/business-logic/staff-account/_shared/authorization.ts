import type { Actor } from '../../../models/auth'
import type { SalonId } from '../../../models/salon'
import { mayKeepStaffLedger } from '../../staff/_shared/authorization'

/**
 * Who may read the accounts of the staff members of a salon, change their
 * roles and unlink them: whoever keeps the staff ledger of the salon.
 * Keeping the ledger already decides which accounts reach the salon, and
 * inviting decides with which role.
 *
 * Which role an actor may give is the same question as for an invitation
 * (`mayGiveRole`), and whether the account is the actor's own the same as
 * for the ledger (`isOwnStaffRecord`).
 */
export const mayKeepStaffAccounts = (actor: Actor, salonId: SalonId): boolean =>
  mayKeepStaffLedger(actor, salonId)
