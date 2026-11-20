import type {
  ModelsInventoryAlertResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { Badge, Button, Link } from '@beauty-salon-frontend/ui'
import {
  countOf,
  PagedTable,
} from '../../../components/paged-table/paged-table'
import type { More } from '../../../pages'
import {
  acknowledgementNameOf,
  alertKindNameOf,
  alertNameOf,
  alertSubjectNameOf,
  severityNameOf,
  severityToneOf,
  thresholdTermOf,
} from '../../alert-format'
import { expiryNameOf, quantityNameOf } from '../../stock-format'
import styles from './alert-table.module.css'

export type AlertTableProps = {
  /** What the table lists: 「在庫のアラート」 or 「条件に合う在庫のアラート」 */
  caption: string
  /** The alerts that were read so far, in the order of the codes of their products; at least one */
  alerts: readonly ModelsInventoryAlertResponse[]
  /** The members of the staff of the salon, who saw to the alerts; `undefined` while they are read */
  staff:
    | readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
    | undefined
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /** The screen of a stock row */
  rowHref: (inventoryId: string) => string
  /** How many alerts there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the alerts that come next */
  onMore: () => void
  /** The button that sees to an alert was pressed: the dialog is to be opened */
  onAcknowledge: (alert: ModelsInventoryAlertResponse) => void
}

/** The kind of an alert and what it is of: an alert has no ID of its own */
const keyOf = ({
  alert,
  inventoryId,
  productId,
}: ModelsInventoryAlertResponse): string =>
  `${alert}:${inventoryId ?? productId}`

/**
 * The alerts of the stock of a salon in four columns, which fit the page
 * of a laptop: how severe each is and of what kind; what it is of, with
 * the expiry of a stock row; the stock, with what the stock of a product
 * is held against; and whether somebody saw to it. An alert of a stock
 * row leads to the row; one of a product is of all its rows. An alert
 * nobody saw to has the button that does.
 */
export const AlertTable = ({
  caption,
  alerts,
  staff,
  timezone,
  rowHref,
  total,
  more,
  onMore,
  onAcknowledge,
}: AlertTableProps) => (
  <PagedTable
    caption={caption}
    rowHeader='subject'
    columns={[
      {
        key: 'alert',
        header: 'アラート',
        cell: ({ alert, severity }) => (
          <span className={styles['kind']}>
            <Badge tone={severityToneOf(severity)}>
              {severityNameOf(severity)}
            </Badge>
            <span>{alertKindNameOf(alert)}</span>
          </span>
        ),
      },
      {
        key: 'subject',
        header: '対象',
        cell: (alert) => (
          <span className={styles['subject']}>
            {alert.inventoryId === null ? (
              <span>{alertSubjectNameOf(alert)}</span>
            ) : (
              <>
                <Link href={rowHref(alert.inventoryId)}>
                  {alertSubjectNameOf(alert)}
                </Link>
                <span className={styles['detail']}>
                  {`使用期限 ${expiryNameOf(alert.expiryDate)}`}
                </span>
              </>
            )}
          </span>
        ),
      },
      {
        key: 'currentStock',
        header: '在庫数',
        align: 'end',
        cell: (alert) => (
          <span className={styles['stock']}>
            <span>{quantityNameOf(alert.currentStock, alert)}</span>
            {alert.threshold !== null && (
              <span className={styles['detail']}>
                {`${thresholdTermOf(alert.alert)} ${quantityNameOf(alert.threshold, alert)}`}
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'acknowledgement',
        header: '確認',
        cell: (alert) => (
          <span className={styles['acknowledgement']}>
            <span>
              {acknowledgementNameOf(alert.acknowledgement, timezone, staff)}
            </span>
            {alert.acknowledgement === null ? (
              <Button
                size='small'
                aria-label={`${alertNameOf(alert)}を確認済みにする`}
                onClick={() => onAcknowledge(alert)}
              >
                確認済みにする
              </Button>
            ) : (
              alert.acknowledgement.notes !== null && (
                <span className={styles['notes']}>
                  {alert.acknowledgement.notes}
                </span>
              )
            )}
          </span>
        ),
      },
    ]}
    rows={alerts}
    rowKey={keyOf}
    emptyMessage='在庫のアラートはありません'
    count={countOf(total, alerts.length, '件')}
    more={more}
    onMore={onMore}
  />
)
