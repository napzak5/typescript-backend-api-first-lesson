import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Badge,
  Card,
  DescriptionList,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { performerNameOf } from '../../utils/movement-format'
import {
  countedNameOf,
  expiryNameOf,
  isExpired,
  productNameOf,
  quantityNameOf,
} from '../../utils/stock-format'
import styles from './stock-record.module.css'

const { record, words } = adminInventoryMessages

export type StockRecordProps = {
  row: ModelsInventoryResponse
  /** The product of the row; none when it was removed */
  product: ModelsProductResponse | undefined
  /** The day at the salon: an expiry before it is marked */
  today: string
  /** The time zone of the salon, which a count is said in */
  timezone: string
  /** The staff of the salon, which name who counted the row last; none while they are read */
  staff?:
    | readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
    | undefined
}

/**
 * What a stock row keeps: the product and the lot, the expiry (marked when
 * it is past), where it is kept and what is noted of it; how much there
 * is, how much of it is reserved and how much may be used; and when it was
 * last counted, and by whom: nobody is named for an administrator.
 */
export const StockRecord = ({
  row,
  product,
  today,
  timezone,
  staff,
}: StockRecordProps) => {
  const say = useSay()

  return (
    <div className={styles['record']}>
      <Card title={say(record.row)}>
        <DescriptionList
          items={[
            {
              term: say(record.product),
              description: say(productNameOf(product)),
            },
            { term: say(record.lot), description: row.lotNumber },
            {
              term: say(record.expiry),
              description: isExpired(row.expiryDate, today) ? (
                <>
                  {say(expiryNameOf(row.expiryDate))}{' '}
                  <Badge tone='danger'>{say(words.expired)}</Badge>
                </>
              ) : (
                say(expiryNameOf(row.expiryDate))
              ),
            },
            { term: say(record.location), description: row.location },
            { term: say(record.shelf), description: row.shelf },
            {
              term: say(record.notes),
              description: <WrittenText>{row.notes}</WrittenText>,
            },
          ]}
        />
      </Card>
      <Card title={say(record.stock)}>
        <DescriptionList
          items={[
            {
              term: say(record.inStock),
              description: say(quantityNameOf(row.currentStock, product)),
            },
            {
              term: say(record.reserved),
              description: say(quantityNameOf(row.reservedStock, product)),
            },
            {
              term: say(record.available),
              description: say(quantityNameOf(row.availableStock, product)),
            },
            {
              term: say(record.lastCounted),
              description: say(
                countedNameOf(
                  row.lastCountedAt,
                  timezone,
                  row.lastCountedBy === null || staff === undefined
                    ? undefined
                    : performerNameOf(row.lastCountedBy, staff),
                ),
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
