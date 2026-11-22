import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type { ModelsCustomerDeletionRequestCreateRequest } from '@beauty-salon-frontend/api-client'
import { lengthOf, tooLongOf } from '@beauty-salon-frontend/fields'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { type FormRead, textOf } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type {
  ErasureAsking,
  ErasureCancelling,
  ErasureRequest,
} from './customer-erasure-api'
import { ANSWERED_BY_OTHERS } from './customer-export'

/*
 * What a request of a customer to have their data erased says, what the
 * form of a new one reads, and what follows taking one or calling it off.
 */

/** The longest reason the API keeps, in characters */
const LONGEST_REASON = 1_000

const BLANK_REASON = '依頼の理由を入力してください。'

const LONG_REASON = tooLongOf('依頼の理由', LONGEST_REASON)

/**
 * The reason of a new request, from the form of the dialog: kept with the
 * request as it was written. One of blanks alone says nothing.
 */
export const readErasureAsk = (
  values: FormData,
): FormRead<ModelsCustomerDeletionRequestCreateRequest> => {
  const reason = textOf(values, 'reason')
  if (reason.trim() === '') {
    return { type: 'invalid', errors: { reason: BLANK_REASON } }
  }
  if (lengthOf(reason) > LONGEST_REASON) {
    return { type: 'invalid', errors: { reason: LONG_REASON } }
  }

  return { type: 'valid', value: { reason } }
}

/**
 * What became of the latest request, in a sentence; `undefined` for a
 * pending one, which is shown with its moments and its reason.
 */
export const erasureStateOf = (
  request: ErasureRequest,
  timezone: string,
): string | undefined => {
  const asked = momentNameAt(request.requestedAt, timezone)

  return match(request)
    .returnType<string | undefined>()
    .with({ status: 'pending' }, () => undefined)
    .with({ status: 'cancelled' }, ({ cancelledAt }) =>
      cancelledAt === null
        ? `${asked} に受け付けた依頼は、取り消しました。`
        : `${asked} に受け付けた依頼は、${momentNameAt(cancelledAt, timezone)} に取り消しました。`,
    )
    .with({ status: 'completed' }, ({ completedAt }) =>
      completedAt === null
        ? `${asked} に受け付けた依頼により、データを消去しました。消去したことを、ご本人にお知らせください。`
        : `${asked} に受け付けた依頼により、${momentNameAt(completedAt, timezone)} にデータを消去しました。消去したことを、ご本人にお知らせください。`,
    )
    .exhaustive()
}

/** What follows an attempt to take a request, or to call one off. */
export type ErasureSays =
  /** Done: the dialog closes, the part shows the request, and the notification says what was done */
  | { type: 'done'; request: ErasureRequest; message: string }
  /** Nothing was done, and nothing is known to have changed: said in the dialog */
  | {
      type: 'again'
      message: string | undefined
      errors: Record<string, string>
    }
  /** Nothing was done, and the request is not what the part shows: the dialog closes, the part reads again and says why */
  | { type: 'refused'; message: string }
  /** The customer left the ledger meanwhile: the page shows them as removed */
  | { type: 'gone' }

const ASK_AGAIN =
  '消去の依頼を受け付けられませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What follows an attempt to take the request of the customer. */
export const afterErasureAsk = (
  outcome: ErasureAsking,
  name: string,
  timezone: string,
): ErasureSays =>
  match(outcome)
    .returnType<ErasureSays>()
    .with({ type: 'asked' }, ({ request }) => ({
      type: 'done',
      request,
      message: `${name} 様のデータの消去の依頼を受け付けました。${momentNameAt(request.scheduledAt, timezone)} 以降に消去します。`,
    }))
    .with({ type: 'invalid' }, ({ values }) => {
      const reason = values.find(({ field }) => field === 'reason')

      return reason === undefined
        ? { type: 'again', message: ASK_AGAIN, errors: {} }
        : {
            type: 'again',
            message: undefined,
            errors: {
              reason: reason.rule === 'too_big' ? LONG_REASON : BLANK_REASON,
            },
          }
    })
    .with({ type: 'pending' }, () => ({
      type: 'refused',
      message:
        'その間に、ほかのアカウントがこのお客様の消去の依頼を受け付けていました。',
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: `このアカウントでは、消去の依頼を受け付けられません。${ANSWERED_BY_OTHERS}`,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: ASK_AGAIN,
      errors: {},
    }))
    .exhaustive()

/** What follows an attempt to call off the pending request of the customer. */
export const afterErasureCancel = (
  outcome: ErasureCancelling,
  name: string,
): ErasureSays =>
  match(outcome)
    .returnType<ErasureSays>()
    .with({ type: 'cancelled' }, ({ request }) => ({
      type: 'done',
      request,
      message: `${name} 様のデータの消去の依頼を取り消しました。`,
    }))
    .with({ type: 'notFound' }, () => ({
      type: 'refused',
      message: 'この依頼は、その間に取り消されたか、消去が実行されていました。',
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: `このアカウントでは、消去の依頼を取り消せません。${ANSWERED_BY_OTHERS}`,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '消去の依頼を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()
