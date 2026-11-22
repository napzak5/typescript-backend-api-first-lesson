import {
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  PUBLIC_REFUSED_PARTS,
  pageOf,
  toTheEnd,
  type Unread,
  unreadOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsReviewResponse,
  type ModelsReviewSortType,
  type ModelsReviewSummaryResponse,
  type ModelsSalonResponse,
  type ModelsServiceCategoryResponse,
  type ModelsServiceResponse,
  type ModelsStaffProfileResponse,
  reviewCrudList,
  salonCrudGet,
  salonCrudList,
  salonReviewSummaryGetSummary,
  serviceCategoryCrudList,
  serviceCrudList,
  staffProfileList,
  staffReviewSummaryGetStaffSummary,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import type { SalonConditions } from '../utils/salon-search'

type SalonPage = Page<ModelsSalonResponse> | Unread

type SalonRead =
  | { type: 'found'; salon: ModelsSalonResponse }
  | NotFound
  | Unread

type MenuRead =
  | {
      type: 'found'
      categories: ModelsServiceCategoryResponse[]
      services: ModelsServiceResponse[]
    }
  | NotFound
  | Unread

type StaffRead = { type: 'found'; staff: ModelsStaffProfileResponse[] } | Unread

/**
 * How the members of a staff were rated, under their IDs. Somebody who was
 * removed since the staff was read has no rating here.
 */
export type StaffRatings =
  | { type: 'found'; summaries: Record<string, ModelsReviewSummaryResponse> }
  | Unread

type ReviewSummaryRead =
  | { type: 'found'; summary: ModelsReviewSummaryResponse }
  | NotFound
  | Unread

export type ReviewPage = Page<ModelsReviewResponse> | Unread

/** How many salons, and how many reviews, a page of the screen has. */
const SALONS_PER_PAGE = 20
const REVIEWS_PER_PAGE = 10

/**
 * The salons that take bookings and meet the conditions, a page at a time.
 * A salon that takes none is not looked for: its page still opens for
 * somebody who has its address.
 */
export const findSalons = async (
  conditions: SalonConditions,
  cursor: string | undefined,
): Promise<SalonPage> => {
  const answer = await salonCrudList({
    ...conditions,
    ...from(cursor),
    isActive: true,
    limit: SALONS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<SalonPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
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
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

const readCategories = async (
  salonId: string,
  cursor: string | undefined,
): Promise<Page<ModelsServiceCategoryResponse> | NotFound | Unread> => {
  const answer = await serviceCategoryCrudList(salonId, {
    ...from(cursor),
    isActive: true,
    limit: LARGEST_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<Page<ModelsServiceCategoryResponse> | NotFound | Unread>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 404 }, () => NOT_FOUND)
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

const readServices = async (
  salonId: string,
  cursor: string | undefined,
): Promise<Page<ModelsServiceResponse> | NotFound | Unread> => {
  const answer = await serviceCrudList(salonId, {
    ...from(cursor),
    isActive: true,
    limit: LARGEST_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<Page<ModelsServiceResponse> | NotFound | Unread>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 404 }, () => NOT_FOUND)
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * The menu of a salon: its categories and its services, those that are
 * switched on, each list in the order the salon gave it.
 */
export const readMenu = async (salonId: string): Promise<MenuRead> => {
  const [categories, services] = await Promise.all([
    toTheEnd((cursor) => readCategories(salonId, cursor)),
    toTheEnd((cursor) => readServices(salonId, cursor)),
  ])
  if (categories.type !== 'found') {
    return categories
  }
  if (services.type !== 'found') {
    return services
  }

  return {
    type: 'found',
    categories: categories.items,
    services: services.items,
  }
}

const readStaffPage = async (
  salonId: string,
  cursor: string | undefined,
): Promise<Page<ModelsStaffProfileResponse> | Unread> => {
  const answer = await staffProfileList({
    ...from(cursor),
    salonId,
    limit: LARGEST_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<Page<ModelsStaffProfileResponse> | Unread>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** The people of a salon, as the salon shows them to its customers. */
export const readStaff = async (salonId: string): Promise<StaffRead> => {
  const staff = await toTheEnd((cursor) => readStaffPage(salonId, cursor))

  return staff.type === 'found' ? { type: 'found', staff: staff.items } : staff
}

/** How the salon was rated: the mean, and how many gave each rating. */
export const readReviewSummary = async (
  salonId: string,
): Promise<ReviewSummaryRead> => {
  const answer = await salonReviewSummaryGetSummary(salonId).catch(() => null)

  return match(answer)
    .returnType<ReviewSummaryRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      summary: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

const readStaffReviewSummary = async (
  staffId: string,
): Promise<ReviewSummaryRead> => {
  const answer = await staffReviewSummaryGetStaffSummary(staffId).catch(
    () => null,
  )

  return match(answer)
    .returnType<ReviewSummaryRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      summary: data.data,
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/**
 * How each of the people of a salon was rated: the API counts the reviews
 * of one member at a request. One request that got no answer leaves them
 * all unread, so that the page says once what is missing.
 */
export const readStaffRatings = async (
  staffIds: readonly string[],
): Promise<StaffRatings> => {
  const reads = await Promise.all(staffIds.map(readStaffReviewSummary))

  return reads.some(
    ({ type }) => type === 'tooManyRequests' || type === 'failed',
  )
    ? whyUnread(reads)
    : {
        type: 'found',
        summaries: Object.fromEntries(
          reads.flatMap((read, index) => {
            const staffId = staffIds[index]

            return read.type === 'found' && staffId !== undefined
              ? [[staffId, read.summary]]
              : []
          }),
        ),
      }
}

/** The reviews of a salon in the order that was chosen, a page at a time. */
export const readReviews = async (
  salonId: string,
  sortBy: ModelsReviewSortType,
  cursor: string | undefined,
): Promise<ReviewPage> => {
  const answer = await reviewCrudList({
    ...from(cursor),
    salonId,
    sortBy,
    limit: REVIEWS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<ReviewPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with(P.union(...PUBLIC_REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
