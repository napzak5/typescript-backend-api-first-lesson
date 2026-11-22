import type { ReactNode } from 'react'
import { classNames } from '../../utils/class-names'
import styles from './field-row.module.css'

export type FieldRowProps = {
  /** How many controls are side by side where there is room */
  columns?: 2 | 3 | undefined
  /** The controls that are read together: 「姓」 and 「名」 */
  children: ReactNode
}

const columnsClass: Record<2 | 3, string | undefined> = {
  2: styles['two'],
  3: styles['three'],
}

/**
 * Controls that are read together: one below the other on a narrow screen,
 * side by side from 40rem, each as wide as its column. Their upper edges
 * line up when one has a description and another has none.
 */
export const FieldRow = ({ columns = 2, children }: FieldRowProps) => (
  <div className={classNames(styles['row'], columnsClass[columns])}>
    {children}
  </div>
)
