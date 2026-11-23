import { amountOf } from '@beauty-salon-frontend/salon-screens'
import { Card, Note, Table, useSay } from '@beauty-salon-frontend/ui'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import {
  partNameOf,
  type TrendPart,
  type TrendUnit,
} from '../../utils/sales-trends'
import { TrendChart } from '../trend-chart/trend-chart'
import styles from './sales-trend.module.css'

const { columns, count, trends: words } = dashboardReportMessages

export type SalesTrendProps = {
  /** The parts of the period, in their order, with their sums; a sale in one of them at least */
  parts: readonly TrendPart[]
  /** What the period is cut into */
  unit: TrendUnit
  /** The currency of the salon */
  currency: string
}

/**
 * The sales of a period part by part: a chart of them, and the table of
 * the sales, the number of sales and the average sale of every part. The
 * table is what assistive technology reads; the chart draws its sales.
 */
export const SalesTrend = ({ parts, unit, currency }: SalesTrendProps) => {
  const say = useSay()
  const money = (amount: number): string => say(amountOf(amount, currency))

  return (
    <Card title={say(words.title)}>
      <div className={styles['part']}>
        <TrendChart parts={parts} unit={unit} currency={currency} />
        <Table<TrendPart>
          caption={say(words.caption)}
          captionHidden
          columns={[
            {
              key: 'label',
              header: say(words.unit),
              cell: ({ label }) => say(partNameOf(label, unit)),
            },
            {
              key: 'sales',
              header: say(columns.sales),
              align: 'end',
              cell: ({ sales }) => money(sales),
            },
            {
              key: 'transactions',
              header: say(columns.transactions),
              align: 'end',
              cell: ({ transactions }) => say(count(transactions)),
            },
            {
              key: 'average',
              header: say(columns.averageTransaction),
              align: 'end',
              cell: ({ average }) => money(average),
            },
          ]}
          rowHeader='label'
          rows={parts}
          rowKey={({ label }) => label}
          emptyMessage={say(words.none)}
        />
        <Note>{say(words.note)}</Note>
      </div>
    </Card>
  )
}
