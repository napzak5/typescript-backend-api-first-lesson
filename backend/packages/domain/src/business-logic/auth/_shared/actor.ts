import type { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'
import {
  type Actor,
  actorSchema,
  type DbUser,
  type SessionWithAccount,
  type UserAccount,
} from '../../../models/auth'
import { type DomainError, parseStored } from '../../../shared'

/** The scope a user's role and linked records give; see `ActorScope`. */
const scopeOf = ({ user, staffSalonId }: UserAccount): unknown =>
  match({ ...user, staffSalonId })
    .with({ role: 'admin' }, () => ({ type: 'platform' }))
    .with(
      {
        role: P.union('owner', 'manager', 'staff'),
        staffId: P.string,
        staffSalonId: P.string,
      },
      ({ role, staffId, staffSalonId: salonId }) => ({
        type: 'salon',
        role,
        salonId,
        staffId,
      }),
    )
    // A customer account is one with or without a customer record.
    .with({ role: 'customer' }, ({ customerId }) => ({
      type: 'customer',
      customerId,
    }))
    // The role is there and the staff member it needs is not.
    .with({ role: P.union('owner', 'manager', 'staff') }, () => ({
      type: 'none',
    }))
    .exhaustive()

/**
 * Whether an account has a role of a salon and reaches no salon:
 * `staffSalonId` is the salon of a `UserAccount`. These are the accounts
 * that get the scope `none` above, and the ones that join an invitation.
 * A repository asks while it holds the locks of a write, where there is no
 * actor to ask.
 */
export const isWithoutSalon = (
  role: DbUser['role'],
  staffSalonId: string | null,
): boolean =>
  match(role)
    .with('owner', 'manager', 'staff', () => staffSalonId === null)
    .with('customer', 'admin', () => false)
    .exhaustive()

/** The actor a session stands for. */
export const toActor = ({
  session,
  account,
}: SessionWithAccount): Result<Actor, DomainError> =>
  parseStored(
    actorSchema,
    {
      userId: account.user.id,
      sessionId: session.id,
      scope: scopeOf(account),
    },
    `Stored session ${session.id} does not describe an actor`,
  )
