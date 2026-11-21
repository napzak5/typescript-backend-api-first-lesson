import type {
  ModelsReviewReportReasonType,
  ModelsReviewReportRequest,
} from '@beauty-salon-frontend/api-client'
import {
  type Read,
  type RefusedValue,
  textOf,
} from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import { type FormSays, TOO_MANY_REQUESTS } from '../bookings/booking-entry'
import type { Reporting, Responding } from './reviews-api'

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
export const reviewActionNoteOf = (role: string): string | undefined =>
  match(role)
    .with('owner', 'manager', () => undefined)
    .with(
      'admin',
      () =>
        '管理者は、規約に反する返信を取り下げられます。返信を書くことと、運営への通報は、サロンのオーナーとマネージャーがします。',
    )
    .otherwise(
      () =>
        '返信を書くことと、運営への通報ができるのは、サロンのオーナーとマネージャーです。',
    )

/** The name of the control of the answer: that of the property of the request */
export const RESPONSE = 'ownerResponse'

const RESPONSE_MISSING = '返信を入力してください。'

export type ResponseRead =
  | Read<string>
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
    : { type: 'valid', request: response }
}

/** The names of the controls of the report: those of the properties of the request */
export const REASON = 'reason'
export const DETAILS = 'details'

/** How many characters the details of a report hold */
export const MAX_DETAILS_LENGTH = 2000

/** Why a review is reported, in the order the form offers the reasons. */
export const REASONS: readonly {
  value: ModelsReviewReportReasonType
  label: string
}[] = [
  { value: 'inappropriate', label: '不適切な表現（暴言、差別的な表現など）' },
  { value: 'false_information', label: '事実と違う内容' },
  { value: 'personal_information', label: '個人情報（氏名や連絡先など）' },
  { value: 'spam', label: '宣伝や、来店と関係のない内容' },
  { value: 'other', label: 'その他' },
]

const REASON_MISSING = '通報の理由を選んでください。'
const DETAILS_MISSING =
  '「その他」を選んだときは、何が問題かを入力してください。'
const DETAILS_TOO_LONG = `${MAX_DETAILS_LENGTH} 文字以内で入力してください。`

/**
 * The report of the form, with what the API checks of it: a reason of the
 * list, and details of no more than 2,000 characters, which «その他»
 * needs. The details are sent without the spaces around them; none are
 * sent as `null`.
 */
export const readReport = (
  values: FormData,
): Read<ModelsReviewReportRequest> => {
  const reason = REASONS.find(
    ({ value }) => value === textOf(values, REASON),
  )?.value
  const details = textOf(values, DETAILS).trim()
  if (reason === undefined) {
    return { type: 'invalid', errors: { [REASON]: REASON_MISSING } }
  }
  if (details.length > MAX_DETAILS_LENGTH) {
    return { type: 'invalid', errors: { [DETAILS]: DETAILS_TOO_LONG } }
  }
  if (reason === 'other' && details === '') {
    return { type: 'invalid', errors: { [DETAILS]: DETAILS_MISSING } }
  }

  return {
    type: 'valid',
    request: { reason, details: details === '' ? null : details },
  }
}

const CHECK_THE_VALUES: FormSays = {
  message: '入力した内容を確かめて、もう一度お試しください。',
  errors: {},
}

/** What the form of the answer says of the values the API refused: at the answer, or above the form. */
const afterRefusedResponse = (values: readonly RefusedValue[]): FormSays =>
  values.some(({ field }) => field === RESPONSE)
    ? { message: undefined, errors: { [RESPONSE]: RESPONSE_MISSING } }
    : CHECK_THE_VALUES

/**
 * What is said after the API did not take an answer, or its withdrawal. A
 * review removed meanwhile is read anew: the screen then says it is gone.
 */
export const afterResponding = (
  outcome: Exclude<Responding, { type: 'responded' | 'notFound' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => afterRefusedResponse(values))
    .with({ type: 'forbidden' }, () => ({
      message:
        'このアカウントでは、このレビューに返信できません。返信できるのは、サロンのオーナーとマネージャーです。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '返信を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()

/**
 * What the dialog of the withdrawal says after the API did not take it.
 * It sends nothing but the ID of the review the screen read, so a refused
 * value is one of a review that changed its address meanwhile.
 */
export const afterWithdrawing = (
  outcome: Exclude<Responding, { type: 'responded' | 'notFound' }>,
): string =>
  match(outcome)
    .with(
      { type: 'invalid' },
      () =>
        '返信を取り下げられませんでした。画面を読み込み直して、もう一度お試しください。',
    )
    .with(
      { type: 'forbidden' },
      () =>
        'このアカウントでは、この返信を取り下げられません。取り下げられるのは、サロンのオーナーとマネージャーと、管理者です。',
    )
    .with(
      { type: 'tooManyRequests' },
      () => 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    )
    .with(
      { type: 'failed' },
      () =>
        '返信を取り下げられませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    .exhaustive()

/** What the form of the report says of the values the API refused: at their controls, or above the form. */
const afterRefusedReport = (values: readonly RefusedValue[]): FormSays => {
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
    : CHECK_THE_VALUES
}

/** What the dialog says when the account reported the review before */
export const REPORTED_BEFORE =
  'このアカウントでは、このレビューをもう通報しています。通報は、1 つのレビューに 1 回です。運営が確かめるまで、お待ちください。'

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
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => afterRefusedReport(values))
    .with({ type: 'forbidden' }, () => ({
      message:
        'このアカウントでは、このレビューを通報できません。通報できるのは、サロンのオーナーとマネージャーです。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '通報を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()
