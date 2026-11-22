import {
  FAILED,
  isUnread,
  type NotFound,
  outsideTheContract,
  type RefusedValue,
  refusedValuesOf,
  TOO_MANY_REQUESTS,
  UNANSWERED_PARTS,
  type Unread,
  type Unsent,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import {
  customerProfileGetPreferences,
  customerProfileUpdatePreferences,
  type ModelsCustomerPreferencesResponse,
  type ModelsCustomerPreferencesUpdateRequest,
  type ModelsStaffProfileResponse,
  staffProfileGet,
} from '@beauty-salon-frontend/api-client'
import {
  type StaffChoice,
  staffChoicesOf,
  staffIdsOf,
} from '@beauty-salon-frontend/preferences'
import { match, P } from 'ts-pattern'
import { unansweredOf } from '../behind-the-session'
import { readBookedSalonIds } from '../bookings/bookings-api'
import { readSalon, readStaff } from '../salons/salons-api'

/**
 * The key under which the preferences of the customer are kept, as the
 * page of the customer shows them. The form that changes them puts what the
 * API answered there.
 */
export const OWN_PREFERENCES = ['own', 'preferences']

/**
 * The key of what the form opens with. It is no beginning of the key
 * above, and the key above none of this one: the form reads more than the
 * page shows, and is never opened with what the page read.
 */
export const OWN_PREFERENCES_TO_CHANGE = ['own', 'preferences-to-change']

export type PreferencesRead =
  | {
      type: 'found'
      preferences: ModelsCustomerPreferencesResponse
      /**
       * The members of the staff a screen can name, each with their salon.
       * A member the preferences name who is not among them is no longer
       * shown by their salon, and no screen shows them
       */
      staff: StaffChoice[]
    }
  /** The account has no profile: preferences are those of a customer */
  | { type: 'none' }
  | Unread

export type PreferencesUpdate =
  | { type: 'updated'; preferences: ModelsCustomerPreferencesResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The profile is gone since the screen read the preferences */
  | { type: 'none' }
  | Unsent

type StoredRead =
  | { type: 'found'; preferences: ModelsCustomerPreferencesResponse }
  | { type: 'none' }
  | Unread

type StaffMemberRead =
  | { type: 'found'; staff: ModelsStaffProfileResponse }
  | NotFound
  | Unread

const NOT_FOUND: NotFound = { type: 'notFound' }

const readStored = async (): Promise<StoredRead> => {
  const answer = await customerProfileGetPreferences().catch(() => null)

  return match(answer)
    .returnType<StoredRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      preferences: data.data,
    }))
    .with({ status: 404 }, () => ({ type: 'none' }))
    .with(P.union(...UNANSWERED_PARTS, { status: 403 }), unansweredOf)
    .exhaustive(outsideTheContract)
}

/**
 * A member of the staff, as their salon shows them to its customers. One
 * who was removed, or who does not work there at the moment, is not found.
 */
const readStaffMember = async (id: string): Promise<StaffMemberRead> => {
  const answer = await staffProfileGet(id).catch(() => null)

  return match(answer)
    .returnType<StaffMemberRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', staff: data.data }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(P.union(null, { status: 400 }, { status: 500 }), () => FAILED)
    .exhaustive(outsideTheContract)
}
/**
 * The preferences with the staff a screen can name: the staff that is
 * `listed` already, the members the preferences name beyond them, and the
 * salon of each. One request that got no answer leaves the whole unread:
 * a member whose name is not known cannot be told from one who is gone.
 */
const withStaff = async (
  preferences: ModelsCustomerPreferencesResponse,
  listed: readonly ModelsStaffProfileResponse[],
): Promise<PreferencesRead> => {
  const known = new Set(listed.map(({ id }) => id))
  const members = await Promise.all(
    staffIdsOf(preferences)
      .filter((id) => !known.has(id))
      .map(readStaffMember),
  )
  const staff = [
    ...listed,
    ...members.flatMap((member) =>
      member.type === 'found' ? [member.staff] : [],
    ),
  ]
  const salons = await Promise.all(
    [...new Set(staff.map(({ salonId }) => salonId))].map(readSalon),
  )
  const reads = [...members, ...salons]

  return reads.some(isUnread)
    ? whyUnread(reads)
    : {
        type: 'found',
        preferences,
        staff: staffChoicesOf(
          staff,
          salons.flatMap((salon) =>
            salon.type === 'found' ? [salon.salon] : [],
          ),
        ),
      }
}

/**
 * What the customer of the account wants the salons to keep in mind, with
 * the names of the staff it names.
 */
export const readOwnPreferences = async (): Promise<PreferencesRead> => {
  const stored = await readStored()

  return stored.type === 'found' ? withStaff(stored.preferences, []) : stored
}

/**
 * The preferences as a form opens with them: with the staff of every salon
 * the customer has a booking at, who are the people to wish for or to
 * avoid, and with the members the preferences name already.
 */
export const readOwnPreferencesToChange =
  async (): Promise<PreferencesRead> => {
    const stored = await readStored()
    if (stored.type !== 'found') {
      return stored
    }
    const booked = await readBookedSalonIds()
    if (booked.type !== 'found') {
      return booked
    }
    const lists = await Promise.all(booked.salonIds.map(readStaff))

    return lists.some(isUnread)
      ? whyUnread(lists)
      : withStaff(
          stored.preferences,
          lists.flatMap((list) => (list.type === 'found' ? list.staff : [])),
        )
  }

/**
 * Changes the preferences the request names. The others stay as they are,
 * so the request holds what the customer changed and nothing else.
 */
export const updateOwnPreferences = async (
  request: ModelsCustomerPreferencesUpdateRequest,
): Promise<PreferencesUpdate> => {
  const answer = await customerProfileUpdatePreferences(request).catch(
    () => null,
  )

  return match(answer)
    .returnType<PreferencesUpdate>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'updated',
      preferences: data.data,
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
