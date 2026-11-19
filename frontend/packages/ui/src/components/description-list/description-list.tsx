import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import styles from './description-list.module.css'

export type DescriptionListItem = {
  /** What the value is: 「電話番号」 */
  term: string
  description: ReactNode
}

export type DescriptionListProps = {
  items: readonly DescriptionListItem[]
  className?: string | undefined
}

/**
 * Names and their values, as the details of one record are shown. A value
 * that is not there is still an item: say 「未登録」, do not leave it out.
 */
export const DescriptionList = ({ items, className }: DescriptionListProps) => (
  <dl className={classNames(styles['list'], className)}>
    {items.map((item) => (
      <div key={item.term} className={styles['item']}>
        <dt className={styles['term']}>{item.term}</dt>
        <dd className={styles['description']}>{item.description}</dd>
      </div>
    ))}
  </dl>
)
