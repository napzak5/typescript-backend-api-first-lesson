import {
  FAILED,
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type RefusedValue,
  refusedValuesOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsSalonCreateRequest,
  type ModelsSalonResponse,
  type ModelsSalonUpdateRequest,
  salonCrudCreate,
  salonCrudDelete,
  salonCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/*
 * The settings of a salon: everybody who works at it reads them (the salon
 * is public), and the owner, a manager and an administrator change them.
 * An administrator adds a salon; the owner and an administrator remove it.
 */

const UNANSWERED = P.union(...UNANSWERED_PARTS)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const KEEPERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether a role changes the settings of its salon: the owner, a manager and an administrator. */
export const mayKeepSalon = (role: string): boolean => KEEPERS.includes(role)

/** Whether a role adds salons: an administrator. */
export const mayAddSalon = (role: string): boolean => role === 'admin'

const REMOVERS: readonly string[] = ['owner', 'admin']

/** Whether a role removes its salon: the owner and an administrator. */
export const mayRemoveSalon = (role: string): boolean => REMOVERS.includes(role)

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

/** What came of the addition of a salon. */
export type SalonAddition =
  | { type: 'added'; salon: ModelsSalonResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | { type: 'emailTaken' }
  | Forbidden
  | Unread

/**
 * Adds a salon, and gives it as the API wrote it. The email address of a
 * salon is one no other salon has (409).
 */
export const addSalon = async (
  request: ModelsSalonCreateRequest,
): Promise<SalonAddition> => {
  const answer = await salonCrudCreate(request).catch(() => null)

  return match(answer)
    .returnType<SalonAddition>()
    .with({ status: 201 }, ({ data }) => ({ type: 'added', salon: data.data }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'emailTaken' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of the removal of a salon. */
export type SalonRemoval =
  | { type: 'removed' }
  /** A booking of the salon is not finished (409) */
  | { type: 'bookingsUnfinished' }
  | NotFound
  | Forbidden
  | Unread

/**
 * Removes a salon. A salon with a booking that is not finished stays: the
 * booking is finished or cancelled first.
 */
export const removeSalon = async (salonId: string): Promise<SalonRemoval> => {
  const answer = await salonCrudDelete(salonId).catch(() => null)

  return match(answer)
    .returnType<SalonRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 409 }, () => ({ type: 'bookingsUnfinished' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}
