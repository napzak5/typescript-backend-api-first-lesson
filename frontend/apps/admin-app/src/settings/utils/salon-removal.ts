import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { SalonRemoval } from '../api/settings-api'

const { removal } = adminSettingsMessages

/** Why a salon was not removed, of what another attempt does not change. */
export type SalonRemovalRefusal =
  /** A booking of the salon is not finished: said with the way to the bookings */
  | { type: 'bookingsUnfinished'; message: LocalizedText }
  /** The account does not remove the salon */
  | { type: 'forbidden'; message: LocalizedText }

/** What a removal of a salon comes to on the screen. */
export type SalonRemovalSays =
  /** The salon was removed: said in a notification at the start */
  | { type: 'done'; message: LocalizedText }
  /** Nothing was removed, and another attempt may: said in the dialog */
  | { type: 'again'; message: LocalizedText }
  /** What another attempt does not change: said at the removal */
  | { type: 'refused'; refusal: SalonRemovalRefusal }
  /** The salon was removed meanwhile: the screen says it is not found */
  | { type: 'gone' }

/**
 * What is said after a salon was to be removed. A booking that is not
 * finished keeps the salon: it is completed, cancelled or marked as a
 * no-show first.
 */
export const afterSalonRemoval = (
  outcome: SalonRemoval,
  name: string,
): SalonRemovalSays =>
  match(outcome)
    .returnType<SalonRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: removal.done(name),
    }))
    .with({ type: 'bookingsUnfinished' }, () => ({
      type: 'refused',
      refusal: {
        type: 'bookingsUnfinished',
        message: removal.bookingsUnfinished(name),
      },
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    // The account no longer removes the salon
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      refusal: {
        type: 'forbidden',
        message: removal.forbidden,
      },
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
