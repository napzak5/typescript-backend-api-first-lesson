import {
  type ModelsCustomerBookingResponse,
  type ModelsReviewCreateRequest,
  type ModelsReviewReportRequest,
  type ModelsReviewResponse,
  type ModelsReviewUpdateRequest,
  type ModelsSalonResponse,
  type ModelsStaffProfileResponse,
  reviewCrudCreate,
  reviewCrudDelete,
  reviewCrudGet,
  reviewCrudList,
  reviewCrudMarkHelpful,
  reviewCrudReport,
  reviewCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import {
  FAILED,
  type RefusedValue,
  refusedValuesOf,
  TOO_MANY_REQUESTS,
  type Unsent,
} from '../behind-the-session'
import { readOwnBooking } from '../bookings/bookings-api'
import { outsideTheContract } from '../outside-the-contract'
import { readOwnProfile } from '../profile/profile-api'
import {
  from,
  type NotFound,
  type Page,
  pageOf,
  readSalon,
  readStaff,
  type Unread,
  whyUnread,
} from '../salons/salons-api'
import { reviewersOf } from './review-staff'

/**
 * The key of the lists of what the customer wrote. It is no beginning of
 * the other keys of this module: what takes the lists away leaves the rest.
 */
export const OWN_REVIEW_LISTS = ['own', 'review-lists']

/** The key of the review of a visit, as the page of the booking shows it. */
export const reviewOfBookingKey = (bookingId: string): string[] => [
  'own',
  'booking-reviews',
  bookingId,
]

/** The key of what the form of a new review opens with. */
export const visitToReviewKey = (bookingId: string): string[] => [
  'own',
  'visit-to-review',
  bookingId,
]

/** The key of what the form that changes a review opens with. */
export const reviewToChangeKey = (reviewId: string): string[] => [
  'own',
  'review-to-change',
  reviewId,
]

/** How many reviews a page of the list of a customer has */
const REVIEWS_PER_PAGE = 10

const NOT_FOUND: NotFound = { type: 'notFound' }

/**
 * The answers to a request to read that say nothing about what was asked
 * for, and no answer at all. A 400 is among them: the screens ask for what
 * the API takes.
 */
const REFUSED = P.union(null, { status: 400 }, { status: 500 })

/** A review with what a screen names it by. */
export type OwnReview = {
  review: ModelsReviewResponse
  /**
   * The salon the review is of. `null` when it was removed between two
   * requests: the API lists no review of a salon that is gone
   */
  salon: ModelsSalonResponse | null
  /** The member of the staff the review rates, when their salon shows them */
  staffName: string | null
}

/** The review of a visit, as the page of the booking tells it. */
export type VisitReviewRead =
  | { type: 'found'; review: ModelsReviewResponse }
  /** Nobody has written about the visit */
  | { type: 'none' }
  | Unread

/** A visit that can be written about, with what the form offers. */
export type Visit = {
  booking: ModelsCustomerBookingResponse
  /** The customer of the account: who writes */
  customerId: string
  salon: ModelsSalonResponse
  /** Who took the booking and is shown by the salon: the people a review can rate */
  staff: ModelsStaffProfileResponse[]
}

export type VisitRead =
  | { type: 'found'; visit: Visit }
  /** The visit has not taken place: there is nothing to write about */
  | { type: 'notVisited' }
  /** The visit has its review: a visit is written about once */
  | { type: 'reviewed'; review: ModelsReviewResponse }
  /** The salon was removed: its visits are written about no more */
  | { type: 'salonGone' }
  | NotFound
  | Unread

export type ReviewToChangeRead =
  | ({ type: 'found' } & OwnReview)
  /** No review has this ID, or somebody else wrote it */
  | NotFound
  | Unread

export type ReviewWriting =
  | { type: 'written'; review: ModelsReviewResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * The visit cannot be written about: it has a review by now, or it is no
   * visit that took place. The API says so with one code for both
   */
  | { type: 'refused' }
  | Unsent

export type ReviewChange =
  | { type: 'changed'; review: ModelsReviewResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The review is gone since the screen read it */
  | { type: 'gone' }
  | Unsent

export type ReviewRemoval =
  | { type: 'removed' }
  /** The review was gone already: what the customer asked for is so */
  | { type: 'gone' }
  | Unsent

export type HelpfulSaying =
  /** How many customers found the review helpful, this one among them */
  | { type: 'counted'; helpfulCount: number }
  /** The review is gone since the screen read it */
  | { type: 'gone' }
  | Unsent

export type ReviewReporting =
  | { type: 'reported' }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The account reported the review before: an account reports a review once */
  | { type: 'reportedBefore' }
  /** The review is gone since the screen read it */
  | { type: 'gone' }
  | Unsent

const reviewIdSchema = z.uuid()

const readReviewPage = async (
  customerId: string,
  cursor: string | undefined,
): Promise<Page<ModelsReviewResponse> | Unread> => {
  const answer = await reviewCrudList({
    ...from(cursor),
    customerId,
    sortBy: 'recent',
    limit: REVIEWS_PER_PAGE,
  }).catch(() => null)

  return match(answer)
    .returnType<Page<ModelsReviewResponse> | Unread>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(REFUSED, () => FAILED)
    .exhaustive(outsideTheContract)
}

const UNREAD = { type: P.union('tooManyRequests', 'failed') }

const isUnread = ({ type }: { type: string }): boolean =>
  type === 'tooManyRequests' || type === 'failed'

/** What reviews name by an ID: their salons, and the staff of those salons. */
type Names = {
  salons: ModelsSalonResponse[]
  staff: ModelsStaffProfileResponse[]
}

/**
 * The salons of the reviews, each read once, and the staff of the salons
 * of which a review rates somebody. One request that got no answer leaves
 * the whole unread: a name that is not known cannot be told from one that
 * is gone.
 */
const readNames = async (
  reviews: readonly ModelsReviewResponse[],
): Promise<({ type: 'found' } & Names) | Unread> => {
  const salonIds = [...new Set(reviews.map(({ salonId }) => salonId))]
  const withStaff = [
    ...new Set(
      reviews.flatMap(({ salonId, staffId }) =>
        staffId === null ? [] : [salonId],
      ),
    ),
  ]
  const [salons, lists] = await Promise.all([
    Promise.all(salonIds.map(readSalon)),
    Promise.all(withStaff.map(readStaff)),
  ])
  const reads = [...salons, ...lists]

  return reads.some(isUnread)
    ? whyUnread(reads)
    : {
        type: 'found',
        salons: salons.flatMap((salon) =>
          salon.type === 'found' ? [salon.salon] : [],
        ),
        staff: lists.flatMap((list) =>
          list.type === 'found' ? list.staff : [],
        ),
      }
}

const ownReviewOf = (
  review: ModelsReviewResponse,
  { salons, staff }: Names,
): OwnReview => ({
  review,
  salon: salons.find(({ id }) => id === review.salonId) ?? null,
  staffName: staff.find(({ id }) => id === review.staffId)?.displayName ?? null,
})

/**
 * A page of what the customer wrote, the latest first, each review with
 * its salon.
 */
export const readOwnReviews = async (
  customerId: string,
  cursor: string | undefined,
): Promise<Page<OwnReview> | Unread> => {
  const page = await readReviewPage(customerId, cursor)
  if (page.type !== 'found') {
    return page
  }
  const names = await readNames(page.items)

  return names.type === 'found'
    ? { ...page, items: page.items.map((review) => ownReviewOf(review, names)) }
    : names
}

/** What was written about a visit. A visit has one review, or none. */
export const readReviewOfBooking = async (
  bookingId: string,
): Promise<VisitReviewRead> => {
  const answer = await reviewCrudList({ bookingId, limit: 1 }).catch(() => null)

  return match(answer)
    .returnType<VisitReviewRead>()
    .with({ status: 200 }, ({ data }) => {
      const [review] = data.data

      return review === undefined ? { type: 'none' } : { type: 'found', review }
    })
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(REFUSED, () => FAILED)
    .exhaustive(outsideTheContract)
}

/**
 * The visit of an address, as the form of a new review opens with it: the
 * booking, who writes, the salon, and the people who can be rated. What
 * stands in the way of a review is told apart, so that the screen can say
 * it; one request that got no answer leaves the whole unread.
 */
export const readVisitToReview = async (
  bookingId: string,
): Promise<VisitRead> => {
  const own = await readOwnBooking(bookingId)
  if (own.type !== 'found') {
    return own
  }
  const { booking } = own
  if (booking.status !== 'completed') {
    return { type: 'notVisited' }
  }
  const reads = await Promise.all([
    readOwnProfile(),
    readReviewOfBooking(booking.id),
    readSalon(booking.salonId),
    readStaff(booking.salonId),
  ])

  return (
    match(reads)
      .returnType<VisitRead>()
      .with(
        [UNREAD, P._, P._, P._],
        [P._, UNREAD, P._, P._],
        [P._, P._, UNREAD, P._],
        [P._, P._, P._, UNREAD],
        () => whyUnread(reads),
      )
      .with([P._, { type: 'found' }, P._, P._], ([, { review }]) => ({
        type: 'reviewed',
        review,
      }))
      .with([P._, P._, { type: 'notFound' }, P._], () => ({
        type: 'salonGone',
      }))
      // An account without a profile has no booking, and this one has one:
      // the profile went between the two requests
      .with([{ type: 'none' }, P._, P._, P._], () => NOT_FOUND)
      .with(
        [
          { type: 'found' },
          { type: 'none' },
          { type: 'found' },
          { type: 'found' },
        ],
        ([{ profile }, , { salon }, { staff }]) => ({
          type: 'found',
          visit: {
            booking,
            customerId: profile.id,
            salon,
            staff: reviewersOf(booking, staff),
          },
        }),
      )
      .exhaustive()
  )
}

const readReview = async (
  id: string,
): Promise<
  { type: 'found'; review: ModelsReviewResponse } | NotFound | Unread
> => {
  const answer = await reviewCrudGet(id).catch(() => null)

  return match(answer)
    .returnType<
      { type: 'found'; review: ModelsReviewResponse } | NotFound | Unread
    >()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', review: data.data }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(REFUSED, () => FAILED)
    .exhaustive(outsideTheContract)
}

/**
 * The review of an address, as the form that changes it opens with it.
 * Everybody can read a review, and its writer alone can change it: the
 * review of somebody else is not found here. What is no ID is not asked
 * for: the API would answer that it takes no such value, which is no more
 * than "not found".
 */
export const readOwnReviewToChange = async (
  reviewId: string,
): Promise<ReviewToChangeRead> => {
  if (!reviewIdSchema.safeParse(reviewId).success) {
    return NOT_FOUND
  }
  const [read, profile] = await Promise.all([
    readReview(reviewId),
    readOwnProfile(),
  ])
  if (read.type !== 'found') {
    return read
  }
  if (profile.type === 'tooManyRequests' || profile.type === 'failed') {
    return profile
  }
  if (
    profile.type === 'none' ||
    profile.profile.id !== read.review.customerId
  ) {
    return NOT_FOUND
  }
  const names = await readNames([read.review])

  return names.type === 'found'
    ? { type: 'found', ...ownReviewOf(read.review, names) }
    : names
}

/** Writes the review of a visit. */
export const writeReview = async (
  request: ModelsReviewCreateRequest,
): Promise<ReviewWriting> => {
  const answer = await reviewCrudCreate(request).catch(() => null)

  return match(answer)
    .returnType<ReviewWriting>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'written',
      review: data.data,
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
 * Changes what the request names of a review. The rest stays as it is, so
 * the request holds what the customer changed and nothing else.
 */
export const changeReview = async (
  id: string,
  request: ModelsReviewUpdateRequest,
): Promise<ReviewChange> => {
  const answer = await reviewCrudUpdate(id, request).catch(() => null)

  return match(answer)
    .returnType<ReviewChange>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'changed',
      review: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => ({ type: 'gone' }))
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

/** Removes a review for good. The visit can be written about again. */
export const removeReview = async (id: string): Promise<ReviewRemoval> => {
  const answer = await reviewCrudDelete(id).catch(() => null)

  return match(answer)
    .returnType<ReviewRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 404 }, () => ({ type: 'gone' }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(
        null,
        { status: 400 },
        { status: 401 },
        { status: 403 },
        { status: 500 },
      ),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}

/**
 * Says that the customer found a review helpful. A customer says so once:
 * the API counts a second time as the first, and answers with the count
 * there is.
 */
export const sayHelpful = async (id: string): Promise<HelpfulSaying> => {
  const answer = await reviewCrudMarkHelpful(id).catch(() => null)

  return match(answer)
    .returnType<HelpfulSaying>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'counted',
      helpfulCount: data.data.helpfulCount,
    }))
    .with({ status: 404 }, () => ({ type: 'gone' }))
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(
        null,
        { status: 400 },
        { status: 401 },
        { status: 403 },
        { status: 500 },
      ),
      () => FAILED,
    )
    .exhaustive(outsideTheContract)
}

/**
 * Reports a review to those who run the site. The review stays as it is:
 * an administrator decides what becomes of it.
 */
export const reportReview = async (
  id: string,
  request: ModelsReviewReportRequest,
): Promise<ReviewReporting> => {
  const answer = await reviewCrudReport(id, request).catch(() => null)

  return match(answer)
    .returnType<ReviewReporting>()
    .with({ status: 200 }, () => ({ type: 'reported' }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => ({ type: 'gone' }))
    .with({ status: 409 }, () => ({ type: 'reportedBefore' }))
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
