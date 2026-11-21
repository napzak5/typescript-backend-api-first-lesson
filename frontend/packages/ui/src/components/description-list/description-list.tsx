import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import { NotRecorded } from '../not-recorded/not-recorded'
import styles from './description-list.module.css'

export type DescriptionListItem = {
  /** What the value is: 「電話番号」 */
  term: string
  /** The value, or `null` when it was not recorded: it is then said as 「記録なし」 */
  description: ReactNode
}

export type DescriptionListProps = {
  items: readonly DescriptionListItem[]
  className?: string | undefined
}

/**
 * Names and their values, as the details of one record are shown. A value
 * that is not there is still an item: give it as `null`, do not leave it
 * out.
 */
export const DescriptionList = ({ items, className }: DescriptionListProps) => (
  <dl className={classNames(styles['list'], className)}>
    {items.map((item) => (
      <div key={item.term} className={styles['item']}>
        <dt className={styles['term']}>{item.term}</dt>
        <dd>
          {item.description === null ? <NotRecorded /> : item.description}
        </dd>
      </div>
    ))}
  </dl>
)
