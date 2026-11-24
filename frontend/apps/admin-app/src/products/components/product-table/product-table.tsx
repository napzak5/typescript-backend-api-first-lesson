import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  carriedNameOf,
  priceNameOf,
  usesNameOf,
} from '../../utils/product-format'

const { ledger, words } = adminProductMessages

export type ProductTableProps = {
  /** What the table lists, in the language of the page: 「商品台帳」, or 「条件に合う商品」 */
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
}: ProductTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={caption}
      rowHeader='name'
      columns={[
        {
          key: 'productCode',
          header: say(words.productCode),
          cell: ({ productCode }) => productCode,
        },
        {
          key: 'name',
          header: say(words.name),
          cell: ({ id, name }) => <Link href={productHref(id)}>{name}</Link>,
        },
        {
          key: 'category',
          header: say(words.category),
          cell: ({ category }) => category,
        },
        {
          key: 'brand',
          header: say(words.brand),
          cell: ({ brand }) => brand,
        },
        {
          key: 'salonPrice',
          header: say(words.salonPrice),
          align: 'end',
          cell: ({ salonPrice }) => {
            const price = priceNameOf(salonPrice, currency)

            return price === null ? null : say(price)
          },
        },
        {
          key: 'uses',
          header: say(words.uses),
          cell: (product) => say(usesNameOf(product)),
        },
        {
          key: 'isActive',
          header: say(words.status),
          cell: ({ isActive }) => (
            <Badge tone={isActive ? 'success' : 'neutral'}>
              {say(carriedNameOf(isActive))}
            </Badge>
          ),
        },
      ]}
      rows={rows}
      rowKey={({ id }) => id}
      emptyMessage={say(ledger.none)}
      count={say(countOf(total, rows.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
