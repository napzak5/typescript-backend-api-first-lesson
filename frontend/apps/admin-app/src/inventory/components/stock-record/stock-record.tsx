import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { Badge, Card, DescriptionList } from '@beauty-salon-frontend/ui'
import { NOT_RECORDED } from '../../../staff/staff-format'
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
}

/**
 * What a stock row keeps: the product and the lot, the expiry (marked when
 * it is past), where it is kept and what is noted of it; how much there
 * is, how much of it is reserved and how much may be used; and when it was
 * last counted.
 */
export const StockRecord = ({
  row,
  product,
  today,
  timezone,
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
          { term: 'ロット番号', description: row.lotNumber ?? 'なし' },
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
          { term: '保管場所', description: row.location ?? NOT_RECORDED },
          { term: '棚', description: row.shelf ?? NOT_RECORDED },
          {
            term: 'メモ',
            description:
              row.notes === null ? (
                NOT_RECORDED
              ) : (
                <p className={styles['written']}>{row.notes}</p>
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
            description: countedNameOf(row.lastCountedAt, timezone),
          },
        ]}
      />
    </Card>
  </div>
)
