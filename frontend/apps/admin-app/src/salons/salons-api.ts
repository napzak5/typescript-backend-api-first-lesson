import {
  type ModelsServiceResponse,
  type ModelsStaffProfileResponse,
  serviceCrudList,
  staffProfileList,
} from '@beauty-salon-frontend/api-client'
import {
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  toTheEnd,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'

/** The answers of `Refused`, as a pattern */
const REFUSED = P.union(
  null,
  { status: 400 },
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

export type StaffProfilesRead =
  | { type: 'found'; items: ModelsStaffProfileResponse[] }
  | Unread

/**
 * The profiles of the staff of a salon, read to the end: what the screens
 * name a member of the staff by (`displayName`). A member the salon does
 * not show (one who left) has none.
 */
export const readStaffProfiles = (
  salonId: string,
): Promise<StaffProfilesRead> =>
  toTheEnd(async (cursor) => {
    const answer = await staffProfileList({
      salonId,
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    return match(answer)
      .returnType<Page<ModelsStaffProfileResponse> | Unread>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with(REFUSED, unreadOf)
      .exhaustive(outsideTheContract)
  })

export type ServicesRead =
  | { type: 'found'; items: ModelsServiceResponse[] }
  | NotFound
  | Unread

/**
 * The services of a salon, read to the end: those that are switched off as
 * well, since a booking keeps the service it was made for. A service that
 * was removed is not among them.
 */
export const readServices = (salonId: string): Promise<ServicesRead> =>
  toTheEnd(async (cursor) => {
    const answer = await serviceCrudList(salonId, {
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    return match(answer)
      .returnType<Page<ModelsServiceResponse> | NotFound | Unread>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 404 }, () => NOT_FOUND)
      .with(REFUSED, unreadOf)
      .exhaustive(outsideTheContract)
  })

/** The keys the names of a salon are read under. */
export const staffProfilesKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'staff-profiles',
]

export const servicesKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'services',
]
