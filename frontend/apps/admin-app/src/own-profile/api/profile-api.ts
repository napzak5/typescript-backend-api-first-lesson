import {
  FAILED,
  outsideTheContract,
  type RefusedValue,
  refusedValuesOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsStaffProfileResponse,
  type ModelsStaffProfileUpdateRequest,
  staffOwnProfileGet,
  staffOwnProfileUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/*
 * The profile of the member of the staff the signed-in account is linked
 * to: what the customers are shown of them, read and changed by the member
 * themselves. The API knows the member from the account.
 */

/** The key the profile of the account is read under */
export const OWN_PROFILE: string[] = ['own-profile']

/**
 * The account has no profile now: the member it is linked to was made
 * inactive or removed, or it was unlinked from them.
 */
type Unavailable = { type: 'unavailable' }

export const UNAVAILABLE: Unavailable = { type: 'unavailable' }

/** What was read of the profile of the account. */
export type ProfileRead =
  | { type: 'found'; profile: ModelsStaffProfileResponse }
  | Unavailable
  | Unread

/** Reads the profile of the member the account is linked to. */
export const readOwnProfile = async (): Promise<ProfileRead> => {
  const answer = await staffOwnProfileGet().catch(() => null)

  return match(answer)
    .returnType<ProfileRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      profile: data.data,
    }))
    .with({ status: P.union(403, 404) }, () => UNAVAILABLE)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of changing the profile of the account. */
export type ProfileSave =
  | { type: 'saved'; profile: ModelsStaffProfileResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  | Unavailable
  | Unread

/** Changes the values of the profile that the request names; the others stay as they are. */
export const saveOwnProfile = async (
  request: ModelsStaffProfileUpdateRequest,
): Promise<ProfileSave> => {
  const answer = await staffOwnProfileUpdate(request).catch(() => null)

  return match(answer)
    .returnType<ProfileSave>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'saved',
      profile: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: P.union(403, 404) }, () => UNAVAILABLE)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
