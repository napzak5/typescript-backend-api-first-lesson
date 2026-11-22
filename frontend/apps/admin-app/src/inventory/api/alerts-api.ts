import {
  FAILED,
  type Forbidden,
  from,
  outsideTheContract,
  type Page,
  pageOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  inventoryAlertCrudAcknowledge,
  inventoryAlertCrudGetSummary,
  inventoryAlertCrudList,
  type ModelsInventoryAlertAcknowledgeRequest,
  type ModelsInventoryAlertResponse,
  type ModelsInventoryAlertSummaryResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import type { AlertConditions } from '../utils/alert-search'
import { stockKeyOf } from './inventory-api'

/*
 * The alerts of the stock of a salon, which the API works out from the
 * products and the stock rows whenever they are read, how many there are,
 * and the acknowledgement of one. Every member of the staff of the salon
 * reads and acknowledges them, and an administrator.
 */

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/**
 * The key the alerts of a salon, and how many there are, are read under:
 * below the stock, which a movement or a count drops, as it changes the
 * alerts.
 */
export const alertsKeyOf = (salonId: string): string[] => [
  ...stockKeyOf(salonId),
  'alerts',
]

/** The key how many alerts a salon has is read under. */
export const alertSummaryKeyOf = (salonId: string): string[] => [
  ...alertsKeyOf(salonId),
  'summary',
]

const ALERT_PAGE = 20

export type AlertPage =
  | Page<ModelsInventoryAlertResponse>
  /** The account reads no alerts of the salon */
  | Forbidden
  | Unread

/** A page of the alerts of a salon that meet the conditions, in the order of the codes of their products. */
export const readAlertPage = async (
  salonId: string,
  conditions: AlertConditions,
  cursor: string | undefined,
): Promise<AlertPage> => {
  const answer = await inventoryAlertCrudList({
    salonId,
    ...conditions,
    ...from(cursor),
    limit: ALERT_PAGE,
  }).catch(() => null)

  // A 400 says that the salon was removed after it was read, or that the
  // stock row of the cursor was removed: nothing a person could act on
  return match(answer)
    .returnType<AlertPage>()
    .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

export type AlertSummaryRead =
  | { type: 'found'; summary: ModelsInventoryAlertSummaryResponse }
  /** The account reads no alerts of the salon */
  | Forbidden
  | Unread

/** How many alerts a salon has, by severity, and how many of them nobody acknowledged. */
export const readAlertSummary = async (
  salonId: string,
): Promise<AlertSummaryRead> => {
  const answer = await inventoryAlertCrudGetSummary({ salonId }).catch(
    () => null,
  )

  // A 400 says that the salon was removed after it was read
  return match(answer)
    .returnType<AlertSummaryRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      summary: data.data,
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

export type AlertAcknowledgement =
  | { type: 'acknowledged'; alert: ModelsInventoryAlertResponse }
  /** The alert is no longer there: the stock or the product changed meanwhile */
  | { type: 'gone' }
  /** Somebody else acknowledged the alert meanwhile */
  | { type: 'acknowledgedAlready' }
  /** The account acknowledges no alerts of the salon */
  | Forbidden
  | Unread

/** Records that an alert was seen to, as it is now. */
export const acknowledgeAlert = async (
  request: ModelsInventoryAlertAcknowledgeRequest,
): Promise<AlertAcknowledgement> => {
  const answer = await inventoryAlertCrudAcknowledge(request).catch(() => null)

  // The request names the alert as it was read, and its notes are none or
  // more than blanks: a 400 says nothing a person could act on
  return match(answer)
    .returnType<AlertAcknowledgement>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'acknowledged',
      alert: data.data,
    }))
    .with({ status: 404 }, () => ({ type: 'gone' }))
    .with({ status: 409 }, () => ({ type: 'acknowledgedAlready' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(400, 413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
