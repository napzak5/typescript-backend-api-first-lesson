import { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'
import {
  type Actor,
  actorSchema,
  type SessionWithAccount,
  type UserAccount,
} from '../../../models/auth'
import { type DomainError, DomainErrors, parseWith } from '../../../shared'

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

/** The actor a session stands for. */
export const toActor = ({
  session,
  account,
}: SessionWithAccount): Result<Actor, DomainError> =>
  Result.mapError(
    parseWith(
      actorSchema,
      {
        userId: account.user.id,
        sessionId: session.id,
        scope: scopeOf(account),
      },
      'Invalid stored session',
    ),
    (error) =>
      DomainErrors.database(
        `Stored session ${session.id} does not describe an actor`,
        error,
      ),
  )
