import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { countOf, PagedTable } from '@beauty-salon-frontend/salon-screens'
import { Badge, Link, type More } from '@beauty-salon-frontend/ui'
import {
  expiryNameOf,
  isExpired,
  placeNameOf,
  productOf,
  quantityNameOf,
  REMOVED_PRODUCT,
} from '../../stock-format'
import styles from './stock-table.module.css'

export type StockTableProps = {
  /** What the table lists: 「在庫」, 「条件に合う在庫の行」, 「在庫僅少」 or 「期限切れ間近」 */
  caption: string
  /** The rows that were read so far, in the order of the view; at least one */
  rows: readonly ModelsInventoryResponse[]
  /** The products of the salon, which name the rows */
  products: readonly ModelsProductResponse[]
  /** The day at the salon: a row that expired before it is marked */
  today: string
  /** How many rows there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the rows that come next */
  onMore: () => void
  /** The address of a row */
  rowHref: (inventoryId: string) => string
}

/**
 * The stock of a salon: each row by the name of its product, which leads
 * to the row, with the code of the product, the lot, the expiry (marked
 * when it is past), where it is kept, and how much of it there is. What
 * of it is reserved is said on the row.
 */
export const StockTable = ({
  caption,
  rows,
  products,
  today,
  total,
  more,
  onMore,
  rowHref,
}: StockTableProps) => (
  <PagedTable
    caption={caption}
    rowHeader='name'
    columns={[
      {
        key: 'productCode',
        header: '商品コード',
        cell: ({ productId }) =>
          productOf(products, productId)?.productCode ?? null,
      },
      {
        key: 'name',
        header: '商品名',
        cell: ({ id, productId }) => (
          <Link href={rowHref(id)}>
            {productOf(products, productId)?.name ?? REMOVED_PRODUCT}
          </Link>
        ),
      },
      {
        key: 'lotNumber',
        header: 'ロット番号',
        cell: ({ lotNumber }) => lotNumber,
      },
      {
        key: 'expiryDate',
        header: '使用期限',
        cell: ({ expiryDate }) =>
          isExpired(expiryDate, today) ? (
            <span className={styles['expired']}>
              {expiryNameOf(expiryDate)} <Badge tone='danger'>期限切れ</Badge>
            </span>
          ) : (
            expiryNameOf(expiryDate)
          ),
      },
      {
        key: 'place',
        header: '保管場所',
        cell: (row) => placeNameOf(row),
      },
      {
        key: 'currentStock',
        header: '在庫数',
        align: 'end',
        cell: ({ currentStock, productId }) =>
          quantityNameOf(currentStock, productOf(products, productId)),
      },
    ]}
    rows={rows}
    rowKey={({ id }) => id}
    emptyMessage='在庫の行はありません'
    count={countOf(total, rows.length, '行')}
    more={more}
    onMore={onMore}
  />
)
