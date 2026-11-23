import type { ModelsDailySalesResponse } from '@beauty-salon-frontend/api-client'
import { amountOf, dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { Card, DescriptionList, Note, useSay } from '@beauty-salon-frontend/ui'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import styles from './daily-sales.module.css'

const { columns, count, daily: words, report } = dashboardReportMessages
const { totals } = report

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
  const say = useSay()
  const money = (amount: number): string => say(amountOf(amount, currency))

  return (
    <Card title={say(words.of(dayNameOf(sales.date)))}>
      <div className={styles['part']}>
        <DescriptionList
          items={[
            { term: say(columns.sales), description: money(sales.sales) },
            {
              term: say(columns.transactions),
              description: say(count(sales.transactions)),
            },
            { term: say(totals.refunds), description: money(sales.refunds) },
            { term: say(totals.net), description: money(sales.net) },
          ]}
        />
        <Note>{say(words.note)}</Note>
      </div>
    </Card>
  )
}
