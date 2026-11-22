import type {
  ModelsInventoryResponse,
  ModelsInventoryStockCountDiscrepancy,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { Link, Table } from '@beauty-salon-frontend/ui'
import { changeNameOf } from '../../utils/movement-format'
import {
  productOf,
  quantityNameOf,
  stockRowNameOf,
} from '../../utils/stock-format'

export type CountResultProps = {
  /** The rows that differed from the books, in the order they were counted */
  discrepancies: readonly ModelsInventoryStockCountDiscrepancy[]
  /** The rows as they were read before the count, which name the rows that differed */
  rows: readonly ModelsInventoryResponse[]
  /** The products of the salon, which name the rows */
  products: readonly ModelsProductResponse[]
  /** The address of the screen of a row */
  rowHref: (inventoryId: string) => string
}

/** A row that differed, with the row and the product that name it */
type Differed = ModelsInventoryStockCountDiscrepancy & {
  row: ModelsInventoryResponse | undefined
  product: ModelsProductResponse | undefined
}

/**
 * What a count found: the rows whose books differed from what was
 * counted, with what the books said, what was counted and the difference,
 * which the count recorded as an adjustment of the row. When none
 * differed, it says so.
 */
export const CountResult = ({
  discrepancies,
  rows,
  products,
  rowHref,
}: CountResultProps) => {
  const differed: Differed[] = discrepancies.map((discrepancy) => {
    const row = rows.find(({ id }) => id === discrepancy.inventoryId)

    return {
      ...discrepancy,
      row,
      product:
        row === undefined ? undefined : productOf(products, row.productId),
    }
  })

  return differed.length === 0 ? (
    <p>数えたどの行も、帳簿の在庫数と同じでした。在庫数は変わりません。</p>
  ) : (
    <Table
      caption='帳簿の在庫数と差のあった行'
      columns={[
        {
          key: 'row',
          header: '在庫の行',
          cell: ({ inventoryId, row, product }) => (
            <Link href={rowHref(inventoryId)}>
              {row === undefined ? '在庫の行' : stockRowNameOf(row, product)}
            </Link>
          ),
        },
        {
          key: 'expected',
          header: '帳簿の在庫数',
          align: 'end',
          cell: ({ expected, product }) => quantityNameOf(expected, product),
        },
        {
          key: 'counted',
          header: '数えた数',
          align: 'end',
          cell: ({ counted, product }) => quantityNameOf(counted, product),
        },
        {
          key: 'difference',
          header: '差',
          align: 'end',
          cell: ({ difference, product }) => changeNameOf(difference, product),
        },
      ]}
      rows={differed}
      rowKey={({ inventoryId }) => inventoryId}
      emptyMessage='差のあった行はありません'
    />
  )
}
