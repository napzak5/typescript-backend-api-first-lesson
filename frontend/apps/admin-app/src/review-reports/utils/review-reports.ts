import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsReviewReportReasonType,
  ModelsReviewReportResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  dayNameOf,
  timeOfDayAt,
} from '@beauty-salon-frontend/salon-screens'
import { inJapanese, textOf } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { ReviewRemoval } from '../../reviews/api/reviews-api'
import { REASONS } from '../../reviews/utils/review-actions'
import type { Dismissal, ReportListParams } from '../api/review-reports-api'

/*
 * What an administrator does with the reports of reviews: reads them, and
 * dismisses one that finds nothing wrong with its review, or removes the
 * review, with its reports. Nobody else handles them.
 */

/** Whether a role handles the reports of reviews: an administrator alone. */
export const handlesReports = (role: string): boolean => role === 'admin'

/** What an account that handles no reports is told */
export const HANDLERS_ONLY =
  'このアカウントでは、通報を扱えません。通報を確かめて、却下するか、レビューを削除するのは、管理者です。'

/** The reports a list shows: those that wait, those dismissed, or all of them */
export type ReportsShown = 'pending' | 'dismissed' | 'all'

/** The name of the control, and of the query, that chooses the reports shown */
export const SHOWN = 'status'

/** The reports a list shows, in the order the control offers them; the first is shown when nothing is chosen. */
export const REPORTS_SHOWN: readonly { value: ReportsShown; label: string }[] =
  [
    { value: 'pending', label: '未処理' },
    { value: 'dismissed', label: '却下' },
    { value: 'all', label: 'すべて' },
  ]

const shownOf = (value: string | null): ReportsShown =>
  REPORTS_SHOWN.find((shown) => shown.value === value)?.value ?? 'pending'

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
export const reasonNameOf = (reason: ModelsReviewReportReasonType): string =>
  REASONS.find(({ value }) => value === reason)?.label ?? reason

/** A moment on the clock of the salon: 「2026年11月21日（土） 14:05」. */
export const reportMomentOf = (moment: string, timezone: string): string =>
  `${dayNameOf(dayAt(new Date(moment), timezone))} ${timeOfDayAt(moment, timezone)}`

/** Whether a report waits for the platform, or when it was dismissed. */
export const reportStateOf = (
  {
    status,
    resolvedAt,
  }: Pick<ModelsReviewReportResponse, 'status' | 'resolvedAt'>,
  timezone: string,
): { waits: boolean; label: string; note: string | undefined } =>
  match(status)
    .with('pending', () => ({ waits: true, label: '未処理', note: undefined }))
    .with('dismissed', () => ({
      waits: false,
      label: '却下',
      note:
        resolvedAt === null
          ? undefined
          : `${reportMomentOf(resolvedAt, timezone)}に却下`,
    }))
    .exhaustive()

/** What the screen does after an attempt to dismiss a report or to remove a review. */
export type HandlingSays =
  /** It was done: the notification says so */
  | { type: 'done'; message: string }
  /** It may be done on another attempt: the dialog says why it was not */
  | { type: 'again'; message: string }
  /** Another attempt changes nothing: the dialog closes, the part says why, and what changed is read anew */
  | { type: 'refused'; message: string }
  /** The review was removed meanwhile: it is read anew, and the screen says it is gone */
  | { type: 'gone' }

/** What follows an attempt to dismiss a report. */
export const afterDismissal = (outcome: Dismissal): HandlingSays =>
  match(outcome)
    .returnType<HandlingSays>()
    .with({ type: 'dismissed' }, () => ({
      type: 'done',
      message: '通報を却下しました。',
    }))
    .with({ type: 'dismissedAlready' }, () => ({
      type: 'refused',
      message:
        'この通報は、その間に、ほかの管理者が却下しました。却下は、1 つの通報に 1 回です。',
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: HANDLERS_ONLY,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: inJapanese(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '通報を却下できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()

/** What follows an attempt to remove a review. */
export const afterReviewRemoval = (outcome: ReviewRemoval): HandlingSays =>
  match(outcome)
    .returnType<HandlingSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: 'レビューを削除しました。通報も、一緒に削除しました。',
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message:
        'このアカウントでは、このレビューを削除できません。レビューを削除できるのは、書いたお客様と、管理者です。',
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: inJapanese(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'レビューを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
