import type {
  ModelsInventoryAlertResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Button,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  acknowledgementNameOf,
  alertKindNameOf,
  alertSubjectNameOf,
  severityNameOf,
  severityToneOf,
  thresholdTermOf,
} from '../../utils/alert-format'
import { expiryNameOf, quantityNameOf } from '../../utils/stock-format'
import styles from './alert-table.module.css'

const { list, table } = adminInventoryMessages.alerts

export type AlertTableProps = {
  /** What the table lists: 「在庫のアラート」 or 「条件に合う在庫のアラート」 */
  caption: LocalizedText
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
}: AlertTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(caption)}
      rowHeader='subject'
      columns={[
        {
          key: 'alert',
          header: say(table.alert),
          cell: ({ alert, severity }) => (
            <span className={styles['kind']}>
              <Badge tone={severityToneOf(severity)}>
                {say(severityNameOf(severity))}
              </Badge>
              <span>{say(alertKindNameOf(alert))}</span>
            </span>
          ),
        },
        {
          key: 'subject',
          header: say(table.subject),
          wrap: 'words',
          cell: (alert) => (
            <span className={styles['subject']}>
              {alert.inventoryId === null ? (
                <span>{say(alertSubjectNameOf(alert))}</span>
              ) : (
                <>
                  <Link href={rowHref(alert.inventoryId)}>
                    {say(alertSubjectNameOf(alert))}
                  </Link>
                  <span className={styles['detail']}>
                    {say(table.expiryOf(expiryNameOf(alert.expiryDate)))}
                  </span>
                </>
              )}
            </span>
          ),
        },
        {
          key: 'currentStock',
          header: say(table.inStock),
          align: 'end',
          cell: (alert) => (
            <span className={styles['stock']}>
              <span>{say(quantityNameOf(alert.currentStock, alert))}</span>
              {alert.threshold !== null && (
                <span className={styles['detail']}>
                  {say(
                    table.thresholdOf(
                      thresholdTermOf(alert.alert),
                      quantityNameOf(alert.threshold, alert),
                    ),
                  )}
                </span>
              )}
            </span>
          ),
        },
        {
          key: 'acknowledgement',
          header: say(table.acknowledgement),
          wrap: 'words',
          cell: (alert) => (
            <div className={styles['acknowledgement']}>
              <span>
                {say(
                  acknowledgementNameOf(alert.acknowledgement, timezone, staff),
                )}
              </span>
              {alert.acknowledgement === null ? (
                <Button
                  size='small'
                  aria-label={say(
                    table.acknowledgeLabel(
                      alertKindNameOf(alert.alert),
                      alertSubjectNameOf(alert),
                    ),
                  )}
                  onClick={() => onAcknowledge(alert)}
                >
                  {say(table.acknowledge)}
                </Button>
              ) : (
                alert.acknowledgement.notes !== null && (
                  <WrittenText className={styles['notes']}>
                    {alert.acknowledgement.notes}
                  </WrittenText>
                )
              )}
            </div>
          ),
        },
      ]}
      rows={alerts}
      rowKey={keyOf}
      emptyMessage={say(list.empty)}
      count={say(countOf(total, alerts.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
