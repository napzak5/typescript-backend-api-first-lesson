import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  expiryNameOf,
  isExpired,
  placeNameOf,
  productOf,
  quantityNameOf,
} from '../../utils/stock-format'
import styles from './stock-table.module.css'

const { removedProduct, stock, table, words } = adminInventoryMessages

export type StockTableProps = {
  /** What the table lists: 「在庫」, 「条件に合う在庫の行」, 「在庫僅少」 or 「期限切れ間近」 */
  caption: LocalizedText
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
}: StockTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(caption)}
      rowHeader='name'
      columns={[
        {
          key: 'productCode',
          header: say(table.productCode),
          cell: ({ productId }) =>
            productOf(products, productId)?.productCode ?? null,
        },
        {
          key: 'name',
          header: say(table.productName),
          cell: ({ id, productId }) => (
            <Link href={rowHref(id)}>
              {productOf(products, productId)?.name ?? say(removedProduct)}
            </Link>
          ),
        },
        {
          key: 'lotNumber',
          header: say(table.lot),
          cell: ({ lotNumber }) => lotNumber,
        },
        {
          key: 'expiryDate',
          header: say(table.expiry),
          cell: ({ expiryDate }) =>
            isExpired(expiryDate, today) ? (
              <span className={styles['expired']}>
                {say(expiryNameOf(expiryDate))}{' '}
                <Badge tone='danger'>{say(words.expired)}</Badge>
              </span>
            ) : (
              say(expiryNameOf(expiryDate))
            ),
        },
        {
          key: 'place',
          header: say(table.location),
          cell: (row) => {
            const place = placeNameOf(row)

            return place === null ? null : say(place)
          },
        },
        {
          key: 'currentStock',
          header: say(table.inStock),
          align: 'end',
          cell: ({ currentStock, productId }) =>
            say(quantityNameOf(currentStock, productOf(products, productId))),
        },
      ]}
      rows={rows}
      rowKey={({ id }) => id}
      emptyMessage={say(stock.all.empty)}
      count={say(countOf(total, rows.length, COUNTED.rows))}
      more={more}
      onMore={onMore}
    />
  )
}
