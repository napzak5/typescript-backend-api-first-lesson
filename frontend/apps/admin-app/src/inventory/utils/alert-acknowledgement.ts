import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryAlertAcknowledgeRequest,
  ModelsInventoryAlertResponse,
} from '@beauty-salon-frontend/api-client'
import { textOf, textOrNull } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { AlertAcknowledgement } from '../api/alerts-api'
import { alertKindNameOf, alertSubjectNameOf } from './alert-format'

const { alerts } = adminInventoryMessages

/*
 * The acknowledgement of an alert: the alert as it was read, with the
 * notes of what was done about it, and what is said after it.
 */

/** The acknowledgement of an alert, with the notes the dialog holds: none when they are blank. */
export const acknowledgementOf = (
  alert: Pick<
    ModelsInventoryAlertResponse,
    'alert' | 'productId' | 'inventoryId'
  >,
  values: FormData,
): ModelsInventoryAlertAcknowledgeRequest => ({
  alert: alert.alert,
  productId: alert.productId,
  inventoryId: alert.inventoryId,
  notes: textOrNull(textOf(values, 'notes')),
})

export type AcknowledgementSays =
  /** The alert was acknowledged: said in a notification */
  | { type: 'done'; message: LocalizedText }
  /** Nothing was recorded, and another attempt may: said in the dialog */
  | { type: 'again'; message: LocalizedText }
  /** What changed meanwhile, which another attempt does not change: said under the heading, and the alerts are read again */
  | { type: 'refused'; message: LocalizedText }

/** What is said after an alert was to be acknowledged. */
export const afterAcknowledgement = (
  outcome: AlertAcknowledgement,
  alert: Pick<
    ModelsInventoryAlertResponse,
    'alert' | 'inventoryId' | 'productName' | 'productCode' | 'lotNumber'
  >,
): AcknowledgementSays => {
  const kind = alertKindNameOf(alert.alert)
  const subject = alertSubjectNameOf(alert)

  return (
    match(outcome)
      .returnType<AcknowledgementSays>()
      .with({ type: 'acknowledged' }, () => ({
        type: 'done',
        message: alerts.done(kind, subject),
      }))
      .with({ type: 'gone' }, () => ({
        type: 'refused',
        message: alerts.gone(kind, subject),
      }))
      .with({ type: 'acknowledgedAlready' }, () => ({
        type: 'refused',
        message: alerts.acknowledgedMeanwhile(kind, subject),
      }))
      // The account moved to another salon meanwhile
      .with({ type: 'forbidden' }, () => ({
        type: 'refused',
        message: alerts.forbidden,
      }))
      .with({ type: 'tooManyRequests' }, () => ({
        type: 'again',
        message: TOO_MANY_REQUESTS_MESSAGE,
      }))
      .with({ type: 'failed' }, () => ({
        type: 'again',
        message: alerts.failed,
      }))
      .exhaustive()
  )
}
