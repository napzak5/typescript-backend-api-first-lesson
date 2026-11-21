import {
  FAILED,
  type Forbidden,
  from,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsReviewReportResponse,
  type ReviewReportCrudListParams,
  reviewReportCrudDismiss,
  reviewReportCrudList,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'

/*
 * The reports of reviews: what customers and salons told the platform
 * about a review that breaks its rules. An administrator reads them, of a
 * salon and of one of its reviews, and dismisses those that find nothing
 * wrong; a review that breaks the rules is removed, and its reports with it.
 */

const UNANSWERED = P.union(...UNANSWERED_PARTS)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/**
 * The key the reports of the reviews of a salon are read under: every
 * list of them, of the salon and of each of its reviews, so that dropping
 * it drops them all.
 */
export const reviewReportsKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'review-reports',
]

const REPORT_PAGE = 20

/** Which reports a list asks for, besides its page and its salon */
export type ReportListParams = Pick<
  ReviewReportCrudListParams,
  'status' | 'reviewId'
>

export type ReportPage = Page<ModelsReviewReportResponse> | Unread

/** A page of the reports of the reviews of a salon, the first received first. */
export const readReportPage = async (
  salonId: string,
  params: ReportListParams,
  cursor: string | undefined,
): Promise<ReportPage> => {
  const answer = await reviewReportCrudList({
    salonId,
    ...params,
    ...from(cursor),
    limit: REPORT_PAGE,
  }).catch(() => null)

  // A 400 says that the report of the cursor went meanwhile, with its
  // review: the screens send only conditions the API takes. A 403 answers
  // an account that is not an administrator, which the screens read for
  // no other
  return match(answer)
    .returnType<ReportPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: P.union(400, 403) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of the dismissal of a report. */
export type Dismissal =
  | { type: 'dismissed'; report: ModelsReviewReportResponse }
  /** Another administrator dismissed it meanwhile: a report is dismissed once */
  | { type: 'dismissedAlready' }
  /** The report went meanwhile, with its review */
  | NotFound
  | Forbidden
  | Unread

/**
 * Dismisses a report that waits: the platform found nothing wrong with
 * the review. The review counts it no longer among those that wait.
 */
export const dismissReport = async (reportId: string): Promise<Dismissal> => {
  const answer = await reviewReportCrudDismiss(reportId).catch(() => null)

  return match(answer)
    .returnType<Dismissal>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'dismissed',
      report: data.data,
    }))
    .with({ status: 409 }, () => ({ type: 'dismissedAlready' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}
