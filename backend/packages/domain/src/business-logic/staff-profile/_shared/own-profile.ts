import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { StaffId } from '../../../models/staff'

/**
 * What an actor has to do with "my profile". An account has one while it
 * reaches a salon: the profile of the staff member that gives it the
 * salon. That staff member works at the salon and is not deleted, and
 * neither is the salon, which is when customers are shown the profile. An
 * administrator and a customer are no staff members, and an account whose
 * staff member gives it no salon has no profile anyone is shown.
 */
export type OwnProfile =
  | { type: 'ownProfile'; staffId: StaffId }
  | { type: 'notAStaffMember' }

export const ownProfileOf = (actor: Actor): OwnProfile =>
  match(actor.scope)
    .returnType<OwnProfile>()
    .with({ type: 'salon' }, ({ staffId }) => ({
      type: 'ownProfile',
      staffId,
    }))
    .with({ type: 'platform' }, { type: 'customer' }, { type: 'none' }, () => ({
      type: 'notAStaffMember',
    }))
    .exhaustive()
