import { amountOf } from '@beauty-salon-frontend/salon-screens'
import { Card, Table } from '@beauty-salon-frontend/ui'
import { countNameOf } from '../../sales-report'
import {
  partNameOf,
  TREND_PARTS,
  type TrendPart,
  type TrendUnit,
} from '../../sales-trends'
import { TrendChart } from '../trend-chart/trend-chart'
import styles from './sales-trend.module.css'

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
  const money = (amount: number): string => amountOf(amount, currency)

  return (
    <Card title='区切りごとの売上'>
      <div className={styles['part']}>
        <TrendChart parts={parts} unit={unit} currency={currency} />
        <Table<TrendPart>
          caption='区切りごとの売上、会計の件数、客単価'
          captionHidden
          columns={[
            {
              key: 'label',
              header: '区切り',
              cell: ({ label }) => partNameOf(label, unit),
            },
            {
              key: 'sales',
              header: '売上',
              align: 'end',
              cell: ({ sales }) => money(sales),
            },
            {
              key: 'transactions',
              header: '会計の件数',
              align: 'end',
              cell: ({ transactions }) => countNameOf(transactions),
            },
            {
              key: 'average',
              header: '客単価',
              align: 'end',
              cell: ({ average }) => money(average),
            },
          ]}
          rowHeader='label'
          rows={parts}
          rowKey={({ label }) => label}
          emptyMessage='区切りはありません'
        />
        <p className={styles['note']}>
          {`売上は、消費税を含み、値引きを引いた額です。客単価は、売上を会計の件数で割った額です（1 円未満は切り捨て）。${TREND_PARTS}`}
        </p>
      </div>
    </Card>
  )
}
