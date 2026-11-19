import type { ReactNode } from 'react'
import styles from './empty-state.module.css'

export type EmptyStateProps = {
  /** What is not there yet: 「予約はまだありません」 */
  title: string
  /** What to do about it, or why it is so */
  description?: string | undefined
  /** The first step: a `Button` or a `ButtonLink` */
  action?: ReactNode
}

/**
 * What a screen shows where its content would be, while there is none. It
 * says so in words and offers the first step.
 */
export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className={styles['emptyState']}>
    <p className={styles['title']}>{title}</p>
    {description !== undefined && (
      <p className={styles['description']}>{description}</p>
    )}
    {action}
  </div>
)
