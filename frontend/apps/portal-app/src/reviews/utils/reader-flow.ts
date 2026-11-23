import {
  CHECK_THE_VALUES_MESSAGE,
  NOT_SENT_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsReviewReportReasonType,
  ModelsReviewReportRequest,
} from '@beauty-salon-frontend/api-client'
import { lengthOf, tooLong } from '@beauty-salon-frontend/fields'
import type { Session } from '@beauty-salon-frontend/session'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalReviewMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import type { ProfileRead } from '../../profile/api/profile-api'
import type { ReviewReporting } from '../api/reviews-api'

/*
 * What somebody who reads the reviews of a salon may do with them, and
 * what the page makes of the form of a report and of the answers of the
 * API.
 */

/** Who reads the reviews, by what the page offers them. */
export type Reader =
  /** Nobody is signed in: signing in is the way to what a customer may do */
  | { type: 'visitor' }
  /**
   * A customer: finds what others wrote helpful and reports it, and
   * changes what they wrote themselves
   */
  | { type: 'customer'; customerId: string }
  /**
   * Somebody who reads and nothing else: an account of a salon or of an
   * administrator, an account that has not said who its customer is, and
   * whoever the page does not know yet
   */
  | { type: 'other' }

const OTHER: Reader = { type: 'other' }

/**
 * Who reads, from the session and from the profile of the account. The API
 * takes "helpful" and a report from a customer with a profile; a profile
 * that could not be read offers nothing, and the reviews are read all the
 * same.
 */
export const readerOf = (
  session: Session,
  profile: ProfileRead | undefined,
): Reader => {
  if (session.type === 'signedOut') {
    return { type: 'visitor' }
  }
  if (session.type !== 'signedIn' || session.user.role !== 'customer') {
    return OTHER
  }

  return profile?.type === 'found'
    ? { type: 'customer', customerId: profile.profile.id }
    : OTHER
}

/*
 * The names of the controls of the form of a report: those of the
 * properties of the request.
 */
export const REASON = 'reason'
export const DETAILS = 'details'

/** How many characters the column of the details takes */
export const MAX_DETAILS_LENGTH = 2000

const REASON_NAMES: Record<ModelsReviewReportReasonType, LocalizedText> =
  termMessages.reviewReportReason

/** The reasons of a report, in the order the form offers them */
const REASON_ORDER: readonly ModelsReviewReportReasonType[] = [
  'inappropriate',
  'false_information',
  'personal_information',
  'spam',
  'other',
]

/** Why a review is reported, in the order the form offers the reasons. */
export const REASONS: readonly {
  value: ModelsReviewReportReasonType
  label: LocalizedText
}[] = REASON_ORDER.map((value) => ({ value, label: REASON_NAMES[value] }))

const { report: words } = portalReviewMessages
const DETAILS_TOO_LONG = tooLong(MAX_DETAILS_LENGTH)

/**
 * Reads the form of a report into the request, or into what is wrong with
 * it. The details are sent without the spaces around them, and nothing is
 * sent as `null`: the API takes no text of spaces alone. A reason the list
 * does not name says what it is about.
 */
export const readReport = (
  values: FormData,
): FormRead<ModelsReviewReportRequest, FormErrors<LocalizedText>> => {
  const chosen = values.get(REASON)
  const reason = REASONS.find(({ value }) => value === chosen)?.value
  const entered = values.get(DETAILS)
  const details = typeof entered === 'string' ? entered.trim() : ''

  if (reason === undefined) {
    return { type: 'invalid', errors: { [REASON]: words.reasonMissing } }
  }
  if (lengthOf(details) > MAX_DETAILS_LENGTH) {
    return { type: 'invalid', errors: { [DETAILS]: DETAILS_TOO_LONG } }
  }
  if (reason === 'other' && details === '') {
    return { type: 'invalid', errors: { [DETAILS]: words.detailsMissing } }
  }

  return {
    type: 'valid',
    value: { reason, details: details === '' ? null : details },
  }
}

/** What to say at the details, for the rule the value broke. */
const detailsMessageOf = (rule: string): LocalizedText =>
  match(rule)
    .with('custom', () => words.detailsMissing)
    .with('too_big', () => DETAILS_TOO_LONG)
    .otherwise(() => words.unacceptable)

/**
 * What the form says about the values the API did not take: at the control
 * of each, and about the attempt when the form has no control for them.
 */
const afterRefusedValues = (
  values: readonly RefusedValue[],
): FormSays<LocalizedText> => {
  const reason = values.find(({ field }) => field === REASON)
  const details = values.find(({ field }) => field === DETAILS)

  return reason === undefined && details === undefined
    ? aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
    : {
        message: undefined,
        errors: {
          ...(reason === undefined ? {} : { [REASON]: words.reasonMissing }),
          ...(details === undefined
            ? {}
            : { [DETAILS]: detailsMessageOf(details.rule) }),
        },
      }
}

/**
 * What the form of a report says after the API did not take it, where the
 * customer may try again. A report that was made before and a review that
 * is gone are not said here: the form is then of no use.
 */
export const afterReport = (
  outcome: Exclude<
    ReviewReporting,
    { type: 'reported' } | { type: 'reportedBefore' } | { type: 'gone' }
  >,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => afterRefusedValues(values))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()
