import {
  type ModelsProblemDetails,
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
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { outsideTheContract } from '../outside-the-contract'
import type { SalonConditions } from './salon-search'

/** Why nothing came of a request to read: there is nothing a person could correct. */
export type Unread =
  | { type: 'tooManyRequests' }
  /** No answer, or one that says nothing a person could act on */
  | { type: 'failed' }

/** The address names nothing: no salon has this ID, or the salon was removed. */
export type NotFound = { type: 'notFound' }

/** One page of a list, and where the next one begins. */
export type Page<Item> = {
  type: 'found'
  items: Item[]
  /** How many items the whole list has; `null` when the API did not count */
  total: number | null
  /** `null` on the last page */
  nextCursor: string | null
}

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

type ReviewSummaryRead =
  | { type: 'found'; summary: ModelsReviewSummaryResponse }
  | NotFound
  | Unread

type ReviewPage = Page<ModelsReviewResponse> | Unread

/** How many salons, and how many reviews, a page of the screen has. */
const SALONS_PER_PAGE = 20
const REVIEWS_PER_PAGE = 10

/**
 * A list that is read to its end is asked for in the largest pages the API
 * gives, and in no more than this many: a menu of a thousand services is cut.
 */
const LARGEST_PAGE = 100
const MOST_PAGES = 10

type Problem<Status extends number> = {
  status: Status
  data: ModelsProblemDetails
}

/**
 * The answers that say nothing about what was asked for, and no answer at
 * all. A 400 is among them: the screens send only what the API takes.
 */
type Refused = Problem<400> | Problem<429> | Problem<500> | null

const REFUSED = P.union(null, { status: 400 }, { status: 429 }, { status: 500 })

const NOT_FOUND: NotFound = { type: 'notFound' }

const unreadOf = (answer: Refused): Unread =>
  match(answer)
    .returnType<Unread>()
    .with({ status: 429 }, () => ({ type: 'tooManyRequests' }))
    .with(P.union(null, { status: 400 }, { status: 500 }), () => ({
      type: 'failed',
    }))
    .exhaustive()

type ListMeta = { total: number | null; nextCursor: string | null }

const pageOf = <Item>(items: Item[], meta: ListMeta): Page<Item> => ({
  type: 'found',
  items,
  total: meta.total,
  nextCursor: meta.nextCursor,
})

/** The parameter `cursor` of a list: absent for its first page. */
const from = (cursor: string | undefined): { cursor?: string } =>
  cursor === undefined ? {} : { cursor }

/**
 * Reads a list to its end, a page at a time. What stops one page stops the
 * list: half a menu is not shown as the menu.
 */
const toTheEnd = async <Item, Stopped extends NotFound | Unread>(
  readPage: (cursor: string | undefined) => Promise<Page<Item> | Stopped>,
  cursor: string | undefined = undefined,
  read: Item[] = [],
  pagesLeft: number = MOST_PAGES,
): Promise<{ type: 'found'; items: Item[] } | Stopped> => {
  const page = await readPage(cursor)
  if (page.type !== 'found') {
    return page
  }
  const items = [...read, ...page.items]

  return page.nextCursor === null || pagesLeft === 1
    ? { type: 'found', items }
    : toTheEnd(readPage, page.nextCursor, items, pagesLeft - 1)
}

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
    .with(REFUSED, unreadOf)
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
    .with(REFUSED, unreadOf)
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
    .with(REFUSED, unreadOf)
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
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
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
    .with(REFUSED, unreadOf)
    .exhaustive(outsideTheContract)
}
