import type { ModelsSalesByCategoryResponse } from '@beauty-salon-frontend/api-client'
import { amountOf, categoryNameOf } from '@beauty-salon-frontend/salon-screens'
import { Card, Note, Table, useSay } from '@beauty-salon-frontend/ui'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { perServiceOf } from '../../utils/sales-breakdown'
import { percentNameOf } from '../../utils/sales-report'
import { ShareBar } from '../share-bar/share-bar'
import styles from './category-sales.module.css'

const { categories: words, columns, count, titles } = dashboardReportMessages

export type CategorySalesProps = {
  /** The kinds of service that sold, the most first, as the API answers; at least one */
  categories: readonly ModelsSalesByCategoryResponse[]
  /** The currency of the salon */
  currency: string
}

/**
 * The sales of services of a period by kind of service: their sales, the
 * number of services, the sales of one service, and their share of all,
 * with a bar as long as it. How they are counted is said under the table.
 */
export const CategorySales = ({ categories, currency }: CategorySalesProps) => {
  const say = useSay()
  const money = (amount: number): string => say(amountOf(amount, currency))

  return (
    <Card title={say(words.title)}>
      <div className={styles['part']}>
        <Table<ModelsSalesByCategoryResponse>
          caption={say(titles.categories)}
          captionHidden
          columns={[
            {
              key: 'category',
              header: say(words.category),
              cell: ({ category }) => say(categoryNameOf(category)),
            },
            {
              key: 'amount',
              header: say(columns.sales),
              align: 'end',
              cell: ({ amount }) => money(amount),
            },
            {
              key: 'count',
              header: say(columns.services),
              align: 'end',
              cell: (category) => say(count(category.count)),
            },
            {
              key: 'perService',
              header: say(words.perService),
              align: 'end',
              cell: ({ amount, count }) => money(perServiceOf(amount, count)),
            },
            {
              key: 'percentage',
              header: say(columns.share),
              align: 'end',
              cell: ({ percentage }) => (
                <ShareBar percent={percentage}>
                  {say(percentNameOf(percentage))}
                </ShareBar>
              ),
            },
          ]}
          rowHeader='category'
          rows={categories}
          rowKey={({ category }) => category}
          emptyMessage={say(words.noneInTable)}
        />
        <Note>{say(words.noteWithPerService)}</Note>
      </div>
    </Card>
  )
}
