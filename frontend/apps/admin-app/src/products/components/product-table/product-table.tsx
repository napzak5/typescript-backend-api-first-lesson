import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import {
  countOf,
  type More,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import { Badge, Link } from '@beauty-salon-frontend/ui'
import { NOT_RECORDED } from '../../../staff/staff-format'
import { carriedNameOf, priceNameOf, usesNameOf } from '../../product-format'

export type ProductTableProps = {
  /** What the table lists: 「商品台帳」, or 「条件に合う商品」 */
  caption: string
  /** The products that were read so far, in the order of their codes; at least one */
  rows: readonly ModelsProductResponse[]
  /** How many products there are; `null` when the API did not count them */
  total: number | null
  currency: string
  more: More
  /** Asks for the products that come next */
  onMore: () => void
  /** The address of a product */
  productHref: (productId: string) => string
}

/**
 * The product ledger: each product by name, which leads to it, with its
 * code, its category and brand, the price it is sold for at the counter,
 * what it is for and whether the salon still carries it.
 */
export const ProductTable = ({
  caption,
  rows,
  total,
  currency,
  more,
  onMore,
  productHref,
}: ProductTableProps) => (
  <PagedTable
    caption={caption}
    rowHeader='name'
    columns={[
      {
        key: 'productCode',
        header: '商品コード',
        cell: ({ productCode }) => productCode,
      },
      {
        key: 'name',
        header: '商品名',
        cell: ({ id, name }) => <Link href={productHref(id)}>{name}</Link>,
      },
      {
        key: 'category',
        header: 'カテゴリー',
        cell: ({ category }) => category ?? NOT_RECORDED,
      },
      {
        key: 'brand',
        header: 'ブランド',
        cell: ({ brand }) => brand ?? NOT_RECORDED,
      },
      {
        key: 'salonPrice',
        header: '販売価格',
        align: 'end',
        cell: ({ salonPrice }) => priceNameOf(salonPrice, currency),
      },
      {
        key: 'uses',
        header: '用途',
        cell: (product) => usesNameOf(product),
      },
      {
        key: 'isActive',
        header: '状態',
        cell: ({ isActive }) => (
          <Badge tone={isActive ? 'success' : 'neutral'}>
            {carriedNameOf(isActive)}
          </Badge>
        ),
      },
    ]}
    rows={rows}
    rowKey={({ id }) => id}
    emptyMessage='商品はありません'
    count={countOf(total, rows.length, '件')}
    more={more}
    onMore={onMore}
  />
)
