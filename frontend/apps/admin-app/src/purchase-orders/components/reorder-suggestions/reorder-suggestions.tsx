import { ButtonLink, Card, Table } from '@beauty-salon-frontend/ui'
import { quantityNameOf } from '../../../inventory/stock-format'
import { orderDayNameOf } from '../../order-format'
import type { SuggestionGroup } from '../../order-suggestions'
import styles from './reorder-suggestions.module.css'

export type ReorderSuggestionsProps = {
  /** The suggestions by supplier, those of no supplier last; at least one */
  groups: readonly SuggestionGroup[]
  /** The time zone of the salon, which the days are said in */
  timezone: string
  /** A new order of a supplier that starts with its suggestions; `null` for the products that name none */
  entryHrefOf: (supplier: string | null) => string
}

/** What the suggestions of the products that name no supplier are called */
const NO_SUPPLIER = '仕入先の決まっていない商品'

/**
 * The products a salon had better order, a card for each supplier: how
 * many there are, how many are on order, the point they are ordered at
 * and the most that is kept, how many to order, and when the product was
 * last ordered. Each card leads to a new order that starts with them.
 */
export const ReorderSuggestions = ({
  groups,
  timezone,
  entryHrefOf,
}: ReorderSuggestionsProps) => (
  <div className={styles['groups']}>
    {groups.map(({ supplier, suggestions }) => (
      <Card
        key={supplier ?? ''}
        title={supplier ?? NO_SUPPLIER}
        actions={
          <ButtonLink href={entryHrefOf(supplier)} variant='primary'>
            {supplier === null
              ? '仕入先を決めて発注を作る'
              : `${supplier} への発注を作る`}
          </ButtonLink>
        }
      >
        <Table
          caption={`${supplier ?? NO_SUPPLIER}の提案`}
          captionHidden
          rowHeader='productName'
          columns={[
            {
              key: 'productCode',
              header: '商品コード',
              cell: ({ productCode }) => productCode,
            },
            {
              key: 'productName',
              header: '商品名',
              cell: ({ productName }) => productName,
            },
            {
              key: 'currentStock',
              header: '在庫',
              align: 'end',
              cell: ({ currentStock, unit }) =>
                quantityNameOf(currentStock, { unit }),
            },
            {
              key: 'onOrderQuantity',
              header: '発注中',
              align: 'end',
              cell: ({ onOrderQuantity, unit }) =>
                quantityNameOf(onOrderQuantity, { unit }),
            },
            {
              key: 'reorderPoint',
              header: '発注点',
              align: 'end',
              cell: ({ reorderPoint, unit }) =>
                quantityNameOf(reorderPoint, { unit }),
            },
            {
              key: 'maximumStock',
              header: '最大在庫数',
              align: 'end',
              cell: ({ maximumStock, unit }) =>
                maximumStock === null
                  ? '設定なし'
                  : quantityNameOf(maximumStock, { unit }),
            },
            {
              key: 'suggestedQuantity',
              header: '提案する数量',
              align: 'end',
              cell: ({ suggestedQuantity, unit }) => (
                <strong>{quantityNameOf(suggestedQuantity, { unit })}</strong>
              ),
            },
            {
              key: 'lastOrderDate',
              header: '最後の発注日',
              cell: ({ lastOrderDate }) =>
                lastOrderDate === null
                  ? 'なし'
                  : orderDayNameOf(lastOrderDate, timezone),
            },
          ]}
          rows={suggestions}
          rowKey={({ productId }) => productId}
          emptyMessage='提案はありません'
        />
      </Card>
    ))}
  </div>
)
