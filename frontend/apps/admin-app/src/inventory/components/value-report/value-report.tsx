import type { ModelsInventoryValueReportResponse } from '@beauty-salon-frontend/api-client'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import { EmptyState, Table, useSay } from '@beauty-salon-frontend/ui'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'

const { value: words } = adminInventoryMessages.count

export type ValueReportProps = {
  report: ModelsInventoryValueReportResponse
  /** The currency of the salon */
  currency: string
}

/**
 * What the stock of a salon is worth at the purchase prices of its
 * products, by their categories, the most valuable first: the total above,
 * then each category with how many of its products are in stock.
 */
export const ValueReport = ({ report, currency }: ValueReportProps) => {
  const say = useSay()

  return report.categories.length === 0 ? (
    <EmptyState
      title={say(words.empty)}
      description={say(words.emptyDescription)}
    />
  ) : (
    <>
      <p>
        {say(
          words.total(amountOf(report.totalValue, currency), report.totalItems),
        )}
      </p>
      <Table
        caption={say(words.caption)}
        columns={[
          {
            key: 'category',
            header: say(words.category),
            cell: ({ category }) => category ?? say(words.noCategory),
          },
          {
            key: 'itemCount',
            header: say(words.itemCount),
            align: 'end',
            cell: ({ itemCount }) => say(words.itemsOf(itemCount)),
          },
          {
            key: 'value',
            header: say(words.value),
            align: 'end',
            cell: ({ value }) => say(amountOf(value, currency)),
          },
        ]}
        rows={report.categories}
        rowKey={({ category }) => category ?? ''}
        emptyMessage={say(words.empty)}
      />
    </>
  )
}
