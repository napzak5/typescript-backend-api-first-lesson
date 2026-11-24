import {
  CHECK_THE_VALUES_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsReviewReportReasonType,
  ModelsReviewReportRequest,
} from '@beauty-salon-frontend/api-client'
import { lengthOf, tooLong } from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  type NamedChoice,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  reviewMessages,
  termMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import type { Reporting, Responding } from '../api/reviews-api'

const { notes, report, response, withdrawal } = adminReviewMessages

/*
 * What an account does to a review of its salon, as the API decides it:
 * the owner and a manager answer it for the salon and report it to the
 * platform; an administrator only withdraws an answer that breaks the
 * rules; the rest of the staff read it.
 */

const SPEAKERS: readonly string[] = ['owner', 'manager']

/** Whether a role writes the answer of its salon to a review, and reports a review: the owner and a manager. */
export const speaksForTheSalon = (role: string): boolean =>
  SPEAKERS.includes(role)

/** Whether a role withdraws the answer of a salon: those who write it, and an administrator. */
export const withdrawsAnswers = (role: string): boolean =>
  speaksForTheSalon(role) || role === 'admin'

/** Why a review offers a role no operation, or only some: what the role may not do, and who may. */
export const reviewActionNoteOf = (role: string): LocalizedText | undefined =>
  match(role)
    .with('owner', 'manager', () => undefined)
    .with('admin', () => notes.admin)
    .otherwise(() => notes.others)

/** The name of the control of the answer: that of the property of the request */
export const RESPONSE = 'ownerResponse'

const RESPONSE_MISSING = response.missing

export type ResponseRead =
  | FormRead<string, FormErrors<LocalizedText>>
  /** The answer is the one the review holds: writing it changes nothing */
  | { type: 'unchanged' }

/**
 * The answer of the form. It is sent as it was written, with the lines
 * and spaces around it, as the API keeps it; one of spaces alone is none.
 */
export const readResponse = (
  values: FormData,
  current: string | null,
): ResponseRead => {
  const response = textOf(values, RESPONSE)
  if (response.trim() === '') {
    return { type: 'invalid', errors: { [RESPONSE]: RESPONSE_MISSING } }
  }

  return response === current
    ? { type: 'unchanged' }
    : { type: 'valid', value: response }
}

/** The names of the controls of the report: those of the properties of the request */
export const REASON = 'reason'
export const DETAILS = 'details'

/** How many characters the details of a report hold */
export const MAX_DETAILS_LENGTH = 2000

/** The reasons a review is reported for, in the order the form offers them */
const REASON_ORDER: readonly ModelsReviewReportReasonType[] = [
  'inappropriate',
  'false_information',
  'personal_information',
  'spam',
  'other',
]

/** Why a review is reported, in the order the form offers the reasons. */
export const REASONS: readonly NamedChoice[] = REASON_ORDER.map((reason) => ({
  value: reason,
  label: termMessages.reviewReportReason[reason],
}))

const REASON_MISSING = reviewMessages.report.reasonMissing
const DETAILS_MISSING = reviewMessages.report.detailsMissing
const DETAILS_TOO_LONG = tooLong(MAX_DETAILS_LENGTH)

/**
 * The report of the form, with what the API checks of it: a reason of the
 * list, and details of no more than 2,000 characters, which «その他»
 * needs. The details are sent without the spaces around them; none are
 * sent as `null`.
 */
export const readReport = (
  values: FormData,
): FormRead<ModelsReviewReportRequest, FormErrors<LocalizedText>> => {
  const reason = REASON_ORDER.find((value) => value === textOf(values, REASON))
  const details = textOf(values, DETAILS).trim()
  if (reason === undefined) {
    return { type: 'invalid', errors: { [REASON]: REASON_MISSING } }
  }
  if (lengthOf(details) > MAX_DETAILS_LENGTH) {
    return {
      type: 'invalid',
      errors: { [DETAILS]: DETAILS_TOO_LONG },
    }
  }
  if (reason === 'other' && details === '') {
    return { type: 'invalid', errors: { [DETAILS]: DETAILS_MISSING } }
  }

  return {
    type: 'valid',
    value: { reason, details: details === '' ? null : details },
  }
}
/** What the form of the answer says of the values the API refused: at the answer, or above the form. */
const afterRefusedResponse = (
  values: readonly RefusedValue[],
): FormSays<LocalizedText> =>
  values.some(({ field }) => field === RESPONSE)
    ? { message: undefined, errors: { [RESPONSE]: RESPONSE_MISSING } }
    : aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)

/**
 * What is said after the API did not take an answer, or its withdrawal. A
 * review removed meanwhile is read anew: the screen then says it is gone.
 */
export const afterResponding = (
  outcome: Exclude<Responding, { type: 'responded' | 'notFound' }>,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => afterRefusedResponse(values))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(response.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(response.failed))
    .exhaustive()

/**
 * What the dialog of the withdrawal says after the API did not take it.
 * It sends nothing but the ID of the review the screen read, so a refused
 * value is one of a review that changed its address meanwhile.
 */
export const afterWithdrawing = (
  outcome: Exclude<Responding, { type: 'responded' | 'notFound' }>,
): LocalizedText =>
  match(outcome)
    .with({ type: 'invalid' }, () => withdrawal.invalid)
    .with({ type: 'forbidden' }, () => withdrawal.forbidden)
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS_MESSAGE)
    .with({ type: 'failed' }, () => withdrawal.failed)
    .exhaustive()

/** What the form of the report says of the values the API refused: at their controls, or above the form. */
const afterRefusedReport = (
  values: readonly RefusedValue[],
): FormSays<LocalizedText> => {
  const reason = values.some(({ field }) => field === REASON)
  const details = values.find(({ field }) => field === DETAILS)

  return reason || details !== undefined
    ? {
        message: undefined,
        errors: {
          ...(reason ? { [REASON]: REASON_MISSING } : {}),
          ...(details === undefined
            ? {}
            : {
                [DETAILS]:
                  details.rule === 'too_big'
                    ? DETAILS_TOO_LONG
                    : DETAILS_MISSING,
              }),
        },
      }
    : aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
}

/**
 * What the dialog of the report says after the API did not take it. A
 * review removed meanwhile is read anew: the screen then says it is gone;
 * a report made before is said in place of the form.
 */
export const afterReporting = (
  outcome: Exclude<
    Reporting,
    { type: 'reported' | 'notFound' | 'reportedAlready' }
  >,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => afterRefusedReport(values))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(report.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(report.failed))
    .exhaustive()
