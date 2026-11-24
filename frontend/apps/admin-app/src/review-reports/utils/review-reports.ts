import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsReviewReportReasonType,
  ModelsReviewReportResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { type NamedChoice, textOf } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import type { ReviewRemoval } from '../../reviews/api/reviews-api'
import type { Dismissal, ReportListParams } from '../api/review-reports-api'

const {
  dismissal,
  removal,
  shown: SHOWN_NAMES,
  table,
} = adminReviewReportMessages

/*
 * What an administrator does with the reports of reviews: reads them, and
 * dismisses one that finds nothing wrong with its review, or removes the
 * review, with its reports. Nobody else handles them.
 */

/** Whether a role handles the reports of reviews: an administrator alone. */
export const handlesReports = (role: string): boolean => role === 'admin'

/** The reports a list shows: those that wait, those dismissed, or all of them */
export type ReportsShown = 'pending' | 'dismissed' | 'all'

/** The name of the control, and of the query, that chooses the reports shown */
export const SHOWN = 'status'

/** The reports a list shows, in the order the control offers them; the first is shown when nothing is chosen. */
const SHOWN_ORDER: readonly ReportsShown[] = ['pending', 'dismissed', 'all']

/** The choices of the control of the reports shown, in its order. */
export const REPORTS_SHOWN: readonly NamedChoice[] = SHOWN_ORDER.map(
  (shown) => ({ value: shown, label: SHOWN_NAMES[shown] }),
)

const shownOf = (value: string | null): ReportsShown =>
  SHOWN_ORDER.find((shown) => shown === value) ?? 'pending'

/** The reports the address asks for: those that wait, unless it names others. */
export const reportsShownIn = (query: URLSearchParams): ReportsShown =>
  shownOf(query.get(SHOWN))

/** The reports the form asks for. */
export const readReportsShown = (values: FormData): ReportsShown =>
  shownOf(textOf(values, SHOWN))

/** The query of the address of the reports shown: none for those that wait. */
export const reportsQueryOf = (shown: ReportsShown): URLSearchParams =>
  new URLSearchParams(shown === 'pending' ? [] : [[SHOWN, shown]])

/** What the API is asked for the reports shown. */
export const reportListParamsOf = (shown: ReportsShown): ReportListParams =>
  shown === 'all' ? {} : { status: shown }

/** Why a review was reported, as the form of a report offers it. */
export const reasonNameOf = (
  reason: ModelsReviewReportReasonType,
): LocalizedText => termMessages.reviewReportReason[reason]

/** Whether a report waits for the platform, or when it was dismissed. */
export const reportStateOf = (
  {
    status,
    resolvedAt,
  }: Pick<ModelsReviewReportResponse, 'status' | 'resolvedAt'>,
  timezone: string,
): {
  waits: boolean
  label: LocalizedText
  note: LocalizedText | undefined
} =>
  match(status)
    .with('pending', () => ({
      waits: true,
      label: table.pending,
      note: undefined,
    }))
    .with('dismissed', () => ({
      waits: false,
      label: table.dismissed,
      note:
        resolvedAt === null
          ? undefined
          : table.dismissedAt(momentNameAt(resolvedAt, timezone)),
    }))
    .exhaustive()

/** What the screen does after an attempt to dismiss a report or to remove a review. */
export type HandlingSays =
  /** It was done: the notification says so */
  | { type: 'done'; message: LocalizedText }
  /** It may be done on another attempt: the dialog says why it was not */
  | { type: 'again'; message: LocalizedText }
  /** Another attempt changes nothing: the dialog closes, the part says why, and what changed is read anew */
  | { type: 'refused'; message: LocalizedText }
  /** The review was removed meanwhile: it is read anew, and the screen says it is gone */
  | { type: 'gone' }

/** What follows an attempt to dismiss a report. */
export const afterDismissal = (outcome: Dismissal): HandlingSays =>
  match(outcome)
    .returnType<HandlingSays>()
    .with({ type: 'dismissed' }, () => ({
      type: 'done',
      message: dismissal.done,
    }))
    .with({ type: 'dismissedAlready' }, () => ({
      type: 'refused',
      message: dismissal.already,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: adminReviewReportMessages.handlersOnly,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: dismissal.failed,
    }))
    .exhaustive()

/** What follows an attempt to remove a review. */
export const afterReviewRemoval = (outcome: ReviewRemoval): HandlingSays =>
  match(outcome)
    .returnType<HandlingSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: removal.done,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: removal.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: removal.failed,
    }))
    .exhaustive()
