import {
  type ModelsSalonResponse,
  type ModelsServiceResponse,
  type ModelsStaffProfileResponse,
  salonCrudGet,
  salonCrudList,
  serviceCrudList,
  staffProfileList,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { outsideTheContract } from '../outside-the-contract'
import {
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  type Page,
  pageOf,
  toTheEnd,
  type Unread,
  unreadOf,
} from '../reading'

/** The answers of `Refused`, as a pattern */
const REFUSED = P.union(
  null,
  { status: 400 },
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

export type SalonPage = Page<ModelsSalonResponse> | Unread

export type SalonRead =
  | { type: 'found'; salon: ModelsSalonResponse }
  | NotFound
  | Unread

/** How many salons a page of the choice has. */
const SALONS_PER_PAGE = 20

/**
 * The salons whose name or description has the keyword, a page at a time;
 * every salon without one. A salon that takes no bookings is among them:
 * its bookings are still kept.
 */
export const findSalons = async (
  keyword: string | undefined,
  cursor: string | undefined,
): Promise<SalonPage> => {
  const answer = await salonCrudList({
    ...(keyword === undefined ? {} : { keyword }),
    ...from(cursor),
    limit: SALONS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<SalonPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

const salonIdSchema = z.uuid()

/**
 * The salon of an address. What is no ID is not asked for: the API would
 * answer that it takes no such value, which is no more than "not found".
 */
export const readSalon = async (id: string): Promise<SalonRead> => {
  if (!salonIdSchema.safeParse(id).success) {
    return NOT_FOUND
  }
  const answer = await salonCrudGet(id).catch(() => null)

  return match(answer)
    .returnType<SalonRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', salon: data.data }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** The key a salon is read under: the screens of the salon share it. */
export const salonKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'salon',
]

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
