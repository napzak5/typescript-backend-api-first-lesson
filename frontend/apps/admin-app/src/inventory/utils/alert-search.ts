import type {
  ModelsInventoryAlertSeverityType,
  ModelsInventoryAlertType,
} from '@beauty-salon-frontend/api-client'
import { type NamedChoice, textOf } from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { alertKindIn, severityIn } from './alert-format'

/*
 * Which alerts of the stock the screen shows, kept in the query of the
 * address: a reload, the way back and an address that is passed on show
 * the same alerts. The conditions have the names of the parameters of the
 * API, and are asked for as they are.
 */

export type AlertConditions = {
  alert?: ModelsInventoryAlertType
  severity?: ModelsInventoryAlertSeverityType
  /** `false` for the alerts nobody saw to, `true` for those somebody did */
  acknowledged?: boolean
}

/** Whether somebody saw to the alerts, as an address or a form holds it. */
const acknowledgedIn = (text: string): boolean | undefined =>
  match(text)
    .returnType<boolean | undefined>()
    .with('false', () => false)
    .with('true', () => true)
    .otherwise(() => undefined)

/** Whether somebody saw to the alerts, to narrow them by it */
export const ACKNOWLEDGED_CHOICES: readonly NamedChoice[] = [
  { value: 'false', label: adminInventoryMessages.alerts.notAcknowledged },
  { value: 'true', label: adminInventoryMessages.alerts.acknowledged },
]

/** The conditions a query or a form holds. What the API does not take is no condition. */
const conditionsOf = (
  kind: string,
  severityText: string,
  acknowledgedText: string,
): AlertConditions => {
  const alert = alertKindIn(kind)
  const severity = severityIn(severityText)
  const acknowledged = acknowledgedIn(acknowledgedText)

  return {
    ...(alert === undefined ? {} : { alert }),
    ...(severity === undefined ? {} : { severity }),
    ...(acknowledged === undefined ? {} : { acknowledged }),
  }
}

/** The conditions in the query of an address. */
export const alertConditionsIn = (query: URLSearchParams): AlertConditions =>
  conditionsOf(
    query.get('alert') ?? '',
    query.get('severity') ?? '',
    query.get('acknowledged') ?? '',
  )

/** The conditions that were chosen: each may be left as all. */
export const readAlertConditions = (values: FormData): AlertConditions =>
  conditionsOf(
    textOf(values, 'alert'),
    textOf(values, 'severity'),
    textOf(values, 'acknowledged'),
  )

/** The query that keeps conditions in an address: the same conditions are the same address. */
export const alertQueryOf = ({
  alert,
  severity,
  acknowledged,
}: AlertConditions): URLSearchParams =>
  new URLSearchParams(
    Object.entries({
      alert,
      severity,
      acknowledged: acknowledged === undefined ? undefined : `${acknowledged}`,
    }).flatMap(([name, value]) => (value === undefined ? [] : [[name, value]])),
  )

/** Whether the conditions narrow the alerts. */
export const isNarrowedAlerts = (conditions: AlertConditions): boolean =>
  Object.keys(conditions).length > 0
