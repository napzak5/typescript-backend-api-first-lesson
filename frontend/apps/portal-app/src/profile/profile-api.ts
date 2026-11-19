import {
  customerProfileCreate,
  customerProfileGet,
  customerProfileUpdate,
  type ModelsCustomerProfileCreateRequest,
  type ModelsCustomerProfileResponse,
  type ModelsCustomerProfileUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import {
  FAILED,
  type RefusedValue,
  refusedValuesOf,
  TOO_MANY_REQUESTS,
  type Unsent,
  unansweredOf,
} from '../behind-the-session'
import { outsideTheContract } from '../outside-the-contract'
import type { Unread } from '../salons/salons-api'

/**
 * The key under which the profile of the account is kept. Every screen
 * that reads it reads it under this key, and a screen that wrote it puts
 * what the API answered there.
 */
export const OWN_PROFILE = ['own', 'profile']

/**
 * The answers `unansweredOf` reads. (A pattern is a constant of its module:
 * the type of one cannot be written out, so it is not exported.)
 */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 403 },
  { status: 429 },
  { status: 500 },
)

export type ProfileRead =
  | { type: 'found'; profile: ModelsCustomerProfileResponse }
  /** The account has no profile yet: nobody has said who the customer is */
  | { type: 'none' }
  | Unread

export type ProfileCreation =
  | { type: 'created'; profile: ModelsCustomerProfileResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * The account cannot have this profile: it has one, its address is not
   * confirmed, or the customer of its address belongs to another account
   */
  | { type: 'refused' }
  | Unsent

export type ProfileUpdate =
  | { type: 'updated'; profile: ModelsCustomerProfileResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The profile is gone since the screen read it */
  | { type: 'none' }
  | Unsent

/** The profile of the account that is signed in: who the customer is. */
export const readOwnProfile = async (): Promise<ProfileRead> => {
  const answer = await customerProfileGet().catch(() => null)

  return match(answer)
    .returnType<ProfileRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      profile: data.data,
    }))
    .with({ status: 404 }, () => ({ type: 'none' }))
    .with(UNANSWERED, unansweredOf)
    .exhaustive(outsideTheContract)
}

/** Makes the account a customer: with a new record, or with the one the ledger has for its address. */
export const createOwnProfile = async (
  request: ModelsCustomerProfileCreateRequest,
): Promise<ProfileCreation> => {
  const answer = await customerProfileCreate(request).catch(() => null)

  return match(answer)
    .returnType<ProfileCreation>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'created',
      profile: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'refused' }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(
        null,
        { status: 401 },
        { status: 403 },
        { status: 413 },
        { status: 415 },
        { status: 500 },
      ),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}

/**
 * Changes the properties of the profile that the request names. The others
 * stay as they are, so the request holds what the customer changed and
 * nothing else.
 */
export const updateOwnProfile = async (
  request: ModelsCustomerProfileUpdateRequest,
): Promise<ProfileUpdate> => {
  const answer = await customerProfileUpdate(request).catch(() => null)

  return match(answer)
    .returnType<ProfileUpdate>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'updated',
      profile: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => ({ type: 'none' }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(
        null,
        { status: 401 },
        { status: 403 },
        { status: 413 },
        { status: 415 },
        { status: 500 },
      ),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}
