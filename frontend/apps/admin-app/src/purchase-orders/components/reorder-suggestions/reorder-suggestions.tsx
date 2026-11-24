import {
  ButtonLink,
  Card,
  NONE,
  Table,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { quantityNameOf } from '../../../inventory/utils/stock-format'
import { orderDayNameOf } from '../../utils/order-format'
import type { SuggestionGroup } from '../../utils/order-suggestions'
import styles from './reorder-suggestions.module.css'

export type ReorderSuggestionsProps = {
  /** The suggestions by supplier, those of no supplier last; at least one */
  groups: readonly SuggestionGroup[]
  /** The time zone of the salon, which the days are said in */
  timezone: string
  /** A new order of a supplier that starts with its suggestions; `null` for the products that name none */
  entryHrefOf: (supplier: string | null) => string
}

const { suggestions: WORDS, words } = adminPurchaseOrderMessages

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
}: ReorderSuggestionsProps) => {
  const say = useSay()

  return (
    <div className={styles['groups']}>
      {groups.map(({ supplier, suggestions }) => (
        <Card
          key={supplier ?? ''}
          title={supplier ?? say(WORDS.noSupplier)}
          actions={
            <ButtonLink href={entryHrefOf(supplier)} variant='primary'>
              {say(
                supplier === null
                  ? WORDS.entryWithoutSupplier
                  : WORDS.entryOf(supplier),
              )}
            </ButtonLink>
          }
        >
          <Table
            caption={say(
              supplier === null ? WORDS.ofNoSupplier : WORDS.of(supplier),
            )}
            captionHidden
            rowHeader='productName'
            columns={[
              {
                key: 'productCode',
                header: say(words.productCode),
                cell: ({ productCode }) => productCode,
              },
              {
                key: 'productName',
                header: say(words.productName),
                cell: ({ productName }) => productName,
              },
              {
                key: 'currentStock',
                header: say(WORDS.inStock),
                align: 'end',
                cell: ({ currentStock, unit }) =>
                  say(quantityNameOf(currentStock, { unit })),
              },
              {
                key: 'onOrderQuantity',
                header: say(WORDS.onOrder),
                align: 'end',
                cell: ({ onOrderQuantity, unit }) =>
                  say(quantityNameOf(onOrderQuantity, { unit })),
              },
              {
                key: 'reorderPoint',
                header: say(WORDS.reorderPoint),
                align: 'end',
                cell: ({ reorderPoint, unit }) =>
                  say(quantityNameOf(reorderPoint, { unit })),
              },
              {
                key: 'maximumStock',
                header: say(WORDS.maximum),
                align: 'end',
                cell: ({ maximumStock, unit }) =>
                  say(
                    maximumStock === null
                      ? WORDS.noMaximum
                      : quantityNameOf(maximumStock, { unit }),
                  ),
              },
              {
                key: 'suggestedQuantity',
                header: say(WORDS.suggested),
                align: 'end',
                cell: ({ suggestedQuantity, unit }) => (
                  <strong>
                    {say(quantityNameOf(suggestedQuantity, { unit }))}
                  </strong>
                ),
              },
              {
                key: 'lastOrderDate',
                header: say(WORDS.lastOrdered),
                cell: ({ lastOrderDate }) =>
                  say(
                    lastOrderDate === null
                      ? NONE
                      : orderDayNameOf(lastOrderDate, timezone),
                  ),
              },
            ]}
            rows={suggestions}
            rowKey={({ productId }) => productId}
            emptyMessage={say(WORDS.noneOfThem)}
          />
        </Card>
      ))}
    </div>
  )
}
