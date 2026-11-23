import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryAlertAcknowledgeRequest,
  ModelsInventoryAlertResponse,
} from '@beauty-salon-frontend/api-client'
import { inJapanese, textOf, textOrNull } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { AlertAcknowledgement } from '../api/alerts-api'
import { alertNameOf } from './alert-format'

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
  | { type: 'done'; message: string }
  /** Nothing was recorded, and another attempt may: said in the dialog */
  | { type: 'again'; message: string }
  /** What changed meanwhile, which another attempt does not change: said under the heading, and the alerts are read again */
  | { type: 'refused'; message: string }

/** What is said after an alert was to be acknowledged. */
export const afterAcknowledgement = (
  outcome: AlertAcknowledgement,
  alert: Pick<
    ModelsInventoryAlertResponse,
    'alert' | 'inventoryId' | 'productName' | 'productCode' | 'lotNumber'
  >,
): AcknowledgementSays =>
  match(outcome)
    .returnType<AcknowledgementSays>()
    .with({ type: 'acknowledged' }, () => ({
      type: 'done',
      message: `${alertNameOf(alert)}を確認済みにしました。`,
    }))
    .with({ type: 'gone' }, () => ({
      type: 'refused',
      message: `${alertNameOf(alert)}は、もう出ていません。その間に、在庫が動いたか、商品が変わりました。アラートを読み直しました。`,
    }))
    .with({ type: 'acknowledgedAlready' }, () => ({
      type: 'refused',
      message: `${alertNameOf(alert)}は、その間に、ほかの人が確認済みにしました。アラートを読み直しました。`,
    }))
    // The account moved to another salon meanwhile
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message:
        'このアカウントでは、このサロンのアラートを確認済みにできません。',
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: inJapanese(TOO_MANY_REQUESTS_MESSAGE),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        'アラートを確認済みにできませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
