import type {
  ModelsInventoryAlertAcknowledgementResponse,
  ModelsInventoryAlertResponse,
  ModelsInventoryAlertSeverityType,
  ModelsInventoryAlertType,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import type { BadgeTone, NamedChoice } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { performerNameOf } from './movement-format'
import { productNameOf, stockRowNameOf } from './stock-format'

/*
 * The kinds and the severities of the alerts of the stock, and how an
 * alert is named on the screens.
 */

const { alerts, words } = adminInventoryMessages

/** Every kind, in the order the filter offers them: those of a product, then those of a stock row */
const KIND_ORDER: readonly ModelsInventoryAlertType[] = [
  'low_stock',
  'overstock',
  'expiring',
  'expired',
]

/** A kind of alert, by name: 「在庫僅少」. */
export const alertKindNameOf = (
  alert: ModelsInventoryAlertType,
): LocalizedText => alerts.kinds[alert]

/** Every kind, to narrow the alerts to one */
export const ALERT_KIND_CHOICES: readonly NamedChoice[] = KIND_ORDER.map(
  (alert) => ({ value: alert, label: alerts.kinds[alert] }),
)

/** Whether a text is the name of a kind, as an address or a form holds it. */
export const alertKindIn = (
  text: string,
): ModelsInventoryAlertType | undefined =>
  KIND_ORDER.find((alert) => alert === text)

/** The colour groups the severities; the word says which one */
const TONES: Record<ModelsInventoryAlertSeverityType, BadgeTone> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
}

/** Every severity, the heaviest first */
const SEVERITY_ORDER: readonly ModelsInventoryAlertSeverityType[] = [
  'critical',
  'warning',
  'info',
]

/** A severity, by name: 「緊急」. */
export const severityNameOf = (
  severity: ModelsInventoryAlertSeverityType,
): LocalizedText => alerts.severities[severity]

/** The colour a severity is shown in. */
export const severityToneOf = (
  severity: ModelsInventoryAlertSeverityType,
): BadgeTone => TONES[severity]

/** Every severity, to narrow the alerts to one */
export const SEVERITY_CHOICES: readonly NamedChoice[] = SEVERITY_ORDER.map(
  (severity) => ({ value: severity, label: alerts.severities[severity] }),
)

/** Whether a text is the name of a severity, as an address or a form holds it. */
export const severityIn = (
  text: string,
): ModelsInventoryAlertSeverityType | undefined =>
  SEVERITY_ORDER.find((severity) => severity === text)

/**
 * What an alert is of: a product, by its name and code, or a stock row, by
 * the name of its product and its lot, as the stock names the row:
 * 「Hair Color（COLOR001）」, 「Hair Color（ロット LOT-2025-112）」.
 */
export const alertSubjectNameOf = (
  alert: Pick<
    ModelsInventoryAlertResponse,
    'inventoryId' | 'productName' | 'productCode' | 'lotNumber'
  >,
): LocalizedText =>
  alert.inventoryId === null
    ? productNameOf({ name: alert.productName, productCode: alert.productCode })
    : stockRowNameOf(alert, { name: alert.productName })

/** What the stock of a product is held against: 「最低在庫数」 or 「最大在庫数」. */
export const thresholdTermOf = (
  alert: ModelsInventoryAlertType,
): LocalizedText => (alert === 'overstock' ? alerts.maximum : alerts.minimum)

/**
 * Who saw to an alert and when, on the clock of the salon:
 * 「2026年11月20日（金） 10:00（佐藤 健）」. Nobody is named for an
 * administrator, nor while the staff are being read; 「未確認」 when nobody
 * did.
 */
export const acknowledgementNameOf = (
  acknowledgement: Pick<
    ModelsInventoryAlertAcknowledgementResponse,
    'acknowledgedAt' | 'acknowledgedBy'
  > | null,
  timezone: string,
  staff:
    | readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
    | undefined,
): LocalizedText => {
  if (acknowledgement === null) {
    return alerts.notAcknowledged
  }
  const { acknowledgedAt, acknowledgedBy } = acknowledgement
  const moment = momentNameAt(acknowledgedAt, timezone)

  return acknowledgedBy === null || staff === undefined
    ? moment
    : words.byWhom(moment, performerNameOf(acknowledgedBy, staff))
}
