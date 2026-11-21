import type {
  ModelsInventoryAlertAcknowledgementResponse,
  ModelsInventoryAlertResponse,
  ModelsInventoryAlertSeverityType,
  ModelsInventoryAlertType,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import type { BadgeProps, SelectOption } from '@beauty-salon-frontend/ui'
import { momentNameAt } from '../salon-time'
import { performerNameOf } from './movement-format'
import { stockRowNameOf } from './stock-format'

/*
 * The kinds and the severities of the alerts of the stock, and how an
 * alert is named on the screens.
 */

const KINDS: Record<ModelsInventoryAlertType, string> = {
  low_stock: '在庫僅少',
  overstock: '在庫過剰',
  expiring: '期限切れ間近',
  expired: '期限切れ',
}

/** Every kind, in the order the filter offers them: those of a product, then those of a stock row */
const KIND_ORDER: readonly ModelsInventoryAlertType[] = [
  'low_stock',
  'overstock',
  'expiring',
  'expired',
]

/** A kind of alert, by name: 「在庫僅少」. */
export const alertKindNameOf = (alert: ModelsInventoryAlertType): string =>
  KINDS[alert]

/** Every kind, to narrow the alerts to one */
export const ALERT_KIND_OPTIONS: readonly SelectOption[] = KIND_ORDER.map(
  (alert) => ({ value: alert, label: KINDS[alert] }),
)

/** Whether a text is the name of a kind, as an address or a form holds it. */
export const alertKindIn = (
  text: string,
): ModelsInventoryAlertType | undefined =>
  KIND_ORDER.find((alert) => alert === text)

type Severity = {
  name: string
  /** The colour groups the severities; the word says which one */
  tone: NonNullable<BadgeProps['tone']>
}

const SEVERITIES: Record<ModelsInventoryAlertSeverityType, Severity> = {
  critical: { name: '緊急', tone: 'danger' },
  warning: { name: '注意', tone: 'warning' },
  info: { name: '情報', tone: 'info' },
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
): string => SEVERITIES[severity].name

/** The colour a severity is shown in. */
export const severityToneOf = (
  severity: ModelsInventoryAlertSeverityType,
): NonNullable<BadgeProps['tone']> => SEVERITIES[severity].tone

/** Every severity, to narrow the alerts to one */
export const SEVERITY_OPTIONS: readonly SelectOption[] = SEVERITY_ORDER.map(
  (severity) => ({ value: severity, label: SEVERITIES[severity].name }),
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
): string =>
  alert.inventoryId === null
    ? `${alert.productName}（${alert.productCode}）`
    : stockRowNameOf(alert, { name: alert.productName })

/** The alert, as a dialog or a notification names it: 「Hair Color（COLOR001）の在庫僅少」. */
export const alertNameOf = (
  alert: Pick<
    ModelsInventoryAlertResponse,
    'alert' | 'inventoryId' | 'productName' | 'productCode' | 'lotNumber'
  >,
): string => `${alertSubjectNameOf(alert)}の${alertKindNameOf(alert.alert)}`

/** What an alert of a product holds the stock of the product against: 「最低在庫数」 or 「最大在庫数」. */
export const thresholdTermOf = (alert: ModelsInventoryAlertType): string =>
  alert === 'overstock' ? '最大在庫数' : '最低在庫数'

const UNACKNOWLEDGED = '未確認'

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
): string => {
  if (acknowledgement === null) {
    return UNACKNOWLEDGED
  }
  const { acknowledgedAt, acknowledgedBy } = acknowledgement
  const who =
    acknowledgedBy === null || staff === undefined
      ? undefined
      : performerNameOf(acknowledgedBy, staff)

  return `${momentNameAt(acknowledgedAt, timezone)}${who === undefined ? '' : `（${who}）`}`
}
