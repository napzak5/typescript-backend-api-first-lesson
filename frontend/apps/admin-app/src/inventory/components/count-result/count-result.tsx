import type {
  ModelsInventoryResponse,
  ModelsInventoryStockCountDiscrepancy,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { Link, Table, useSay } from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { changeNameOf } from '../../utils/movement-format'
import {
  productOf,
  quantityNameOf,
  stockRowNameOf,
} from '../../utils/stock-format'

const { result } = adminInventoryMessages.count

export type CountResultProps = {
  /** The rows that differed from the books, in the order they were counted */
  discrepancies: readonly ModelsInventoryStockCountDiscrepancy[]
  /** The rows the count was entered on, as they were read before it: those that differed are among them */
  rows: readonly ModelsInventoryResponse[]
  /** The products of the salon, which name the rows */
  products: readonly ModelsProductResponse[]
  /** The address of the screen of a row */
  rowHref: (inventoryId: string) => string
}

/** A row that differed, with the row and the product that name it */
type Differed = ModelsInventoryStockCountDiscrepancy & {
  row: ModelsInventoryResponse
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
  const say = useSay()
  // In the order of the rows, which is the order they were counted in
  const differed: Differed[] = rows.flatMap((row) =>
    discrepancies
      .filter(({ inventoryId }) => inventoryId === row.id)
      .map((discrepancy) => ({
        ...discrepancy,
        row,
        product: productOf(products, row.productId),
      })),
  )

  return differed.length === 0 ? (
    <p>{say(result.same)}</p>
  ) : (
    <Table
      caption={say(result.caption)}
      columns={[
        {
          key: 'row',
          header: say(result.row),
          cell: ({ inventoryId, row, product }) => (
            <Link href={rowHref(inventoryId)}>
              {say(stockRowNameOf(row, product))}
            </Link>
          ),
        },
        {
          key: 'expected',
          header: say(result.onTheBooks),
          align: 'end',
          cell: ({ expected, product }) =>
            say(quantityNameOf(expected, product)),
        },
        {
          key: 'counted',
          header: say(result.counted),
          align: 'end',
          cell: ({ counted, product }) => say(quantityNameOf(counted, product)),
        },
        {
          key: 'difference',
          header: say(result.difference),
          align: 'end',
          cell: ({ difference, product }) =>
            say(changeNameOf(difference, product)),
        },
      ]}
      rows={differed}
      rowKey={({ inventoryId }) => inventoryId}
      emptyMessage={say(result.empty)}
    />
  )
}
