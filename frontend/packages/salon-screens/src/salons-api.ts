import {
  from,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsSalonResponse,
  salonCrudGet,
  salonCrudList,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'

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
