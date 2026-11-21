import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Badge,
  Card,
  DescriptionList,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import { performerNameOf } from '../../movement-format'
import {
  countedNameOf,
  expiryNameOf,
  isExpired,
  quantityNameOf,
  REMOVED_PRODUCT,
} from '../../stock-format'
import styles from './stock-record.module.css'

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
}: StockRecordProps) => (
  <div className={styles['record']}>
    <Card title='在庫の行'>
      <DescriptionList
        items={[
          {
            term: '商品',
            description:
              product === undefined
                ? REMOVED_PRODUCT
                : `${product.name}（${product.productCode}）`,
          },
          { term: 'ロット番号', description: row.lotNumber },
          {
            term: '使用期限',
            description: isExpired(row.expiryDate, today) ? (
              <>
                {expiryNameOf(row.expiryDate)}{' '}
                <Badge tone='danger'>期限切れ</Badge>
              </>
            ) : (
              expiryNameOf(row.expiryDate)
            ),
          },
          { term: '保管場所', description: row.location },
          { term: '棚', description: row.shelf },
          {
            term: 'メモ',
            description:
              row.notes === null ? null : (
                <WrittenText>{row.notes}</WrittenText>
              ),
          },
        ]}
      />
    </Card>
    <Card title='在庫'>
      <DescriptionList
        items={[
          {
            term: '在庫数',
            description: quantityNameOf(row.currentStock, product),
          },
          {
            term: '引き当てた数',
            description: quantityNameOf(row.reservedStock, product),
          },
          {
            term: '使える数',
            description: quantityNameOf(row.availableStock, product),
          },
          {
            term: '最後の棚卸し',
            description: countedNameOf(
              row.lastCountedAt,
              timezone,
              row.lastCountedBy === null || staff === undefined
                ? undefined
                : performerNameOf(row.lastCountedBy, staff),
            ),
          },
        ]}
      />
    </Card>
  </div>
)
