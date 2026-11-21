import type { ModelsSalesByCategoryResponse } from '@beauty-salon-frontend/api-client'
import { amountOf, categoryNameOf } from '@beauty-salon-frontend/salon-screens'
import { Card, Table } from '@beauty-salon-frontend/ui'
import { perServiceOf } from '../../sales-breakdown'
import {
  CATEGORY_SALES_NOTE,
  countNameOf,
  percentNameOf,
} from '../../sales-report'
import { ShareBar } from '../share-bar/share-bar'
import styles from './category-sales.module.css'

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
  const money = (amount: number): string => amountOf(amount, currency)

  return (
    <Card title='メニューの区分ごとの売上'>
      <div className={styles['part']}>
        <Table<ModelsSalesByCategoryResponse>
          caption='区分別の売上'
          captionHidden
          columns={[
            {
              key: 'category',
              header: '区分',
              cell: ({ category }) => categoryNameOf(category),
            },
            {
              key: 'amount',
              header: '売上',
              align: 'end',
              cell: ({ amount }) => money(amount),
            },
            {
              key: 'count',
              header: '施術の数',
              align: 'end',
              cell: ({ count }) => countNameOf(count),
            },
            {
              key: 'perService',
              header: '1 件あたり',
              align: 'end',
              cell: ({ amount, count }) => money(perServiceOf(amount, count)),
            },
            {
              key: 'percentage',
              header: '割合',
              align: 'end',
              cell: ({ percentage }) => (
                <ShareBar percent={percentage}>
                  {percentNameOf(percentage)}
                </ShareBar>
              ),
            },
          ]}
          rowHeader='category'
          rows={categories}
          rowKey={({ category }) => category}
          emptyMessage='メニューの売上はありません'
        />
        <p className={styles['note']}>
          {`${CATEGORY_SALES_NOTE}1 件あたりは、売上を施術の数で割った額です（1 円未満は切り捨て）。`}
        </p>
      </div>
    </Card>
  )
}
