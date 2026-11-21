import type { ModelsDailySalesResponse } from '@beauty-salon-frontend/api-client'
import { amountOf, dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { Card, DescriptionList, Note } from '@beauty-salon-frontend/ui'
import { countNameOf } from '../../sales-report'
import styles from './daily-sales.module.css'

export type DailySalesProps = {
  /** The sales of the day, as the API counted them; all of them 0 on a day without a sale */
  sales: ModelsDailySalesResponse
  /** The currency of the salon */
  currency: string
}

/**
 * The sales of one day: the sales, the number of them, what was given back
 * of them, and what is left. A day without a sale shows its zeros: they are
 * the answer that nothing was sold.
 */
export const DailySales = ({ sales, currency }: DailySalesProps) => {
  const money = (amount: number): string => amountOf(amount, currency)

  return (
    <Card title={`${dayNameOf(sales.date)}の売上`}>
      <div className={styles['part']}>
        <DescriptionList
          items={[
            { term: '売上', description: money(sales.sales) },
            {
              term: '会計の件数',
              description: countNameOf(sales.transactions),
            },
            { term: '返金', description: money(sales.refunds) },
            { term: '純売上', description: money(sales.net) },
          ]}
        />
        <Note>
          売上は、消費税を含み、値引きを引いた額です。返金は、この日の会計から返した額で、返金した日には数えません。純売上は、売上から返金を引いた額です。
        </Note>
      </div>
    </Card>
  )
}
