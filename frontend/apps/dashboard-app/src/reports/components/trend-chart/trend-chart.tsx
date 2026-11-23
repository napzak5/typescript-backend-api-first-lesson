import { amountOf } from '@beauty-salon-frontend/salon-screens'
import { classNames, useSay } from '@beauty-salon-frontend/ui'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import {
  axisAmountOf,
  partNameOf,
  scaleTopOf,
  shortPartNameOf,
  type TrendPart,
  type TrendUnit,
} from '../../utils/sales-trends'
import styles from './trend-chart.module.css'

const { trends: words } = dashboardReportMessages

export type TrendChartProps = {
  /** The parts of the period, in their order; at least one */
  parts: readonly TrendPart[]
  /** What the period is cut into */
  unit: TrendUnit
  /** The currency of the salon */
  currency: string
}

/** More parts than this leave no room for the gap between their columns */
const MOST_SPACED = 60

/**
 * The sales of each part of a period as a column, on one scale from 0 to
 * a round amount. It is a picture of the table beside it, which holds the
 * same amounts: it is hidden from assistive technology, and the amount of
 * a column shows on a pointer over it. The axis names the first and the
 * last part alone.
 */
export const TrendChart = ({ parts, unit, currency }: TrendChartProps) => {
  const say = useSay()
  const top = scaleTopOf(Math.max(...parts.map(({ sales }) => sales)))
  const first = parts[0]
  const last = parts.at(-1)

  return (
    <div className={styles['chart']} aria-hidden='true'>
      <div className={styles['axis']}>
        <span className={styles['top']}>
          {say(axisAmountOf(top, currency))}
        </span>
        <span className={styles['half']}>
          {say(axisAmountOf(top / 2, currency))}
        </span>
        <span className={styles['zero']}>{say(axisAmountOf(0, currency))}</span>
      </div>
      <div
        className={classNames(
          styles['plot'],
          parts.length > MOST_SPACED && styles['dense'],
        )}
        style={{
          gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))`,
        }}
      >
        {parts.map(({ label, sales }, index) => (
          <div key={label} className={styles['part']}>
            <span
              className={styles['column']}
              style={{ blockSize: `${(sales * 100) / top}%` }}
            />
            <span
              className={classNames(
                styles['tip'],
                index < parts.length / 2
                  ? styles['fromStart']
                  : styles['fromEnd'],
              )}
            >
              {say(
                words.tip(partNameOf(label, unit), amountOf(sales, currency)),
              )}
            </span>
          </div>
        ))}
      </div>
      <div className={styles['labels']}>
        {first !== undefined && (
          <span>{say(shortPartNameOf(first.label, unit))}</span>
        )}
        {last !== undefined && last !== first && (
          <span>{say(shortPartNameOf(last.label, unit))}</span>
        )}
      </div>
    </div>
  )
}
