import {
  type ModelsReviewReportRequest,
  type ModelsReviewResponse,
  type ModelsReviewSummaryResponse,
  type ReviewCrudListParams,
  reviewCrudDelete,
  reviewCrudGet,
  reviewCrudList,
  reviewCrudReport,
  reviewCrudRespond,
  salonReviewSummaryGetSummary,
} from '@beauty-salon-frontend/api-client'
import {
  FAILED,
  type Forbidden,
  from,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'

/*
 * The reviews of a salon: what its customers wrote after a visit. Anybody
 * reads them; the owner and a manager answer them for the salon and report
 * them to the platform, and an administrator withdraws an answer that
 * breaks the rules, and removes a review that does.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/**
 * The key the reviews of a salon are read under: its summary and the
 * pages of every search, so that dropping it drops them all.
 */
export const reviewsKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'reviews',
]

/** The key a review is read under. */
export const reviewKeyOf = (reviewId: string): string[] => [
  'review',
  reviewId.toLowerCase(),
]

export type SummaryRead =
  | { type: 'found'; summary: ModelsReviewSummaryResponse }
  | Unread

/** The mean of the ratings of a salon, how many reviews it has, and how many of each rating. */
export const readReviewSummary = async (
  salonId: string,
): Promise<SummaryRead> => {
  const answer = await salonReviewSummaryGetSummary(salonId).catch(() => null)

  // The salon was removed after it was read: nothing a person could correct
  return match(answer)
    .returnType<SummaryRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      summary: data.data,
    }))
    .with({ status: P.union(400, 404) }, () => FAILED)
    .with({ status: P.union(429, 500) }, unreadOf)
    .with(null, unreadOf)
    .exhaustive(outsideTheContract)
}

const REVIEW_PAGE = 20

/** What the list is asked for besides its page and its salon: the conditions of the search */
export type ReviewListParams = Omit<
  ReviewCrudListParams,
  'cursor' | 'limit' | 'salonId'
>

export type ReviewPage = Page<ModelsReviewResponse> | Unread

/** A page of the reviews of a salon that meet the conditions, in the order they ask for. */
export const readReviewPage = async (
  salonId: string,
  params: ReviewListParams,
  cursor: string | undefined,
): Promise<ReviewPage> => {
  const answer = await reviewCrudList({
    salonId,
    ...params,
    ...from(cursor),
    limit: REVIEW_PAGE,
  }).catch(() => null)

  // A 400 says that the review of the cursor was removed meanwhile: the
  // screens send only conditions the API takes
  return match(answer)
    .returnType<ReviewPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 400 }, () => FAILED)
    .with({ status: P.union(429, 500) }, unreadOf)
    .with(null, unreadOf)
    .exhaustive(outsideTheContract)
}

export type ReviewRead =
  | { type: 'found'; review: ModelsReviewResponse }
  | NotFound
  | Unread

/** A review: one that was removed, or none, is not found. */
export const readReview = async (reviewId: string): Promise<ReviewRead> => {
  const answer = await reviewCrudGet(reviewId).catch(() => null)

  return match(answer)
    .returnType<ReviewRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', review: data.data }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: P.union(429, 500) }, unreadOf)
    .with(null, unreadOf)
    .exhaustive(outsideTheContract)
}

export type Responding =
  | { type: 'responded'; review: ModelsReviewResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The review was removed meanwhile */
  | NotFound
  /** The account answers no reviews of the salon, or only withdraws an answer */
  | Forbidden
  | Unread

/**
 * Writes the answer of the salon to a review, or withdraws it for `null`.
 * The same answer again, or `null` for a review with none, writes nothing
 * and answers with the review as it is.
 */
export const respondToReview = async (
  reviewId: string,
  ownerResponse: string | null,
): Promise<Responding> => {
  const answer = await reviewCrudRespond(reviewId, { ownerResponse }).catch(
    () => null,
  )

  return match(answer)
    .returnType<Responding>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'responded',
      review: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type Reporting =
  | { type: 'reported' }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The account reported the review before: an account reports a review once */
  | { type: 'reportedAlready' }
  /** The review was removed meanwhile */
  | NotFound
  /** The account reports no reviews of the salon */
  | Forbidden
  | Unread

/** Tells the platform that a review breaks the rules, and why. */
export const reportReview = async (
  reviewId: string,
  request: ModelsReviewReportRequest,
): Promise<Reporting> => {
  const answer = await reviewCrudReport(reviewId, request).catch(() => null)

  return match(answer)
    .returnType<Reporting>()
    .with({ status: 200 }, () => ({ type: 'reported' }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'reportedAlready' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type ReviewRemoval =
  | { type: 'removed' }
  /** The review was removed meanwhile */
  | NotFound
  /** The account removes no reviews: only their customers and an administrator do */
  | Forbidden
  | Unread

/** Removes a review that breaks the rules of the platform, and the reports of it. */
export const removeReview = async (
  reviewId: string,
): Promise<ReviewRemoval> => {
  const answer = await reviewCrudDelete(reviewId).catch(() => null)

  return match(answer)
    .returnType<ReviewRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}
