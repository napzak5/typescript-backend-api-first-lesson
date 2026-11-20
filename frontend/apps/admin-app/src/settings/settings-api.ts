import {
  type ModelsSalonResponse,
  type ModelsSalonUpdateRequest,
  salonCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  type RefusedValue,
  refusedValuesOf,
  type Unread,
  unreadOf,
} from '../reading'

/*
 * The settings of a salon: everybody who works at it reads them (the salon
 * is public), and the owner, a manager and an administrator change them.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const KEEPERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether a role changes the settings of its salon: the owner, a manager and an administrator. */
export const mayKeepSalon = (role: string): boolean => KEEPERS.includes(role)

/** What came of a change of a salon. */
export type SalonChange =
  | { type: 'written'; salon: ModelsSalonResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | { type: 'emailTaken' }
  | NotFound
  | Forbidden
  | Unread

/**
 * Changes what the request names of a salon, and gives the salon as it is
 * now. The email address of a salon is one no other salon has (409).
 */
export const changeSalon = async (
  salonId: string,
  request: ModelsSalonUpdateRequest,
): Promise<SalonChange> => {
  const answer = await salonCrudUpdate(salonId, request).catch(() => null)

  return match(answer)
    .returnType<SalonChange>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      salon: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'emailTaken' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
