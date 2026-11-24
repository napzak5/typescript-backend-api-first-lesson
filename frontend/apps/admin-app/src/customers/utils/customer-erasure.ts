import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type { ModelsCustomerDeletionRequestCreateRequest } from '@beauty-salon-frontend/api-client'
import { lengthOf, tooLongOf } from '@beauty-salon-frontend/fields'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  type FormErrors,
  type FormRead,
  type FormSays,
  textOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type {
  ErasureAsking,
  ErasureCancelling,
  ErasureRequest,
} from '../api/customer-erasure-api'

const { erasure: words } = adminCustomerMessages

/*
 * What a request of a customer to have their data erased says, what the
 * form of a new one reads, and what follows taking one or calling it off.
 */

/** The longest reason the API keeps, in characters */
const LONGEST_REASON = 1_000

const BLANK_REASON = words.asking.blankReason

const LONG_REASON = tooLongOf(words.asking.reason, LONGEST_REASON)

/**
 * The reason of a new request, from the form of the dialog: kept with the
 * request as it was written. One of blanks alone says nothing.
 */
export const readErasureAsk = (
  values: FormData,
): FormRead<
  ModelsCustomerDeletionRequestCreateRequest,
  FormErrors<LocalizedText>
> => {
  const reason = textOf(values, 'reason')
  if (reason.trim() === '') {
    return { type: 'invalid', errors: { reason: BLANK_REASON } }
  }
  if (lengthOf(reason) > LONGEST_REASON) {
    return { type: 'invalid', errors: { reason: LONG_REASON } }
  }

  return { type: 'valid', value: { reason } }
}

/** A request that was called off, or on which the data was erased */
export type EndedRequest = ErasureRequest & {
  status: Exclude<ErasureRequest['status'], 'pending'>
}

/**
 * What became of the latest request, in a sentence. A pending one is
 * shown with its moments and its reason instead.
 */
export const erasureStateOf = (
  request: EndedRequest,
  timezone: string,
): LocalizedText => {
  const asked = momentNameAt(request.requestedAt, timezone)
  const at = (moment: string | null): LocalizedText | null =>
    moment === null ? null : momentNameAt(moment, timezone)

  return match(request)
    .returnType<LocalizedText>()
    .with({ status: 'cancelled' }, ({ cancelledAt }) =>
      words.cancelled(asked, at(cancelledAt)),
    )
    .with({ status: 'completed' }, ({ completedAt }) =>
      words.completed(asked, at(completedAt)),
    )
    .exhaustive()
}

/** What follows an attempt to take a request, or to call one off. */
export type ErasureSays =
  /** Done: the dialog closes, the part shows the request, and the notification says what was done */
  | { type: 'done'; request: ErasureRequest; message: LocalizedText }
  /** Nothing was done, and nothing is known to have changed: said in the dialog */
  | ({ type: 'again' } & FormSays<LocalizedText>)
  /** Nothing was done, and the request is not what the part shows: the dialog closes, the part reads again and says why */
  | { type: 'refused'; message: LocalizedText }
  /** The customer left the ledger meanwhile: the page shows them as removed */
  | { type: 'gone' }

const ASK_AGAIN = words.askFailed

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
      message: words.asked(name, momentNameAt(request.scheduledAt, timezone)),
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
      message: words.takenMeanwhile,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: words.askForbidden,
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
      message: words.cancelledDone(name),
    }))
    .with({ type: 'notFound' }, () => ({
      type: 'refused',
      message: words.goneMeanwhile,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: words.cancelForbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: words.cancelFailed,
      errors: {},
    }))
    .exhaustive()
