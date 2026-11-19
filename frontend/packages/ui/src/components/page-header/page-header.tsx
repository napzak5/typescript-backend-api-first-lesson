import type { ReactNode } from 'react'
import styles from './page-header.module.css'

export type PageHeaderProps = {
  /** The heading of the screen: its one `h1` */
  title: string
  description?: string | undefined
  /** What can be done with the whole screen: 「新しい予約」 */
  actions?: ReactNode
}

/**
 * The top of a screen: what it is, and what can be done with all of it. It
 * is not a `header` element: the one banner of a page is that of its frame.
 */
export const PageHeader = ({
  title,
  description,
  actions,
}: PageHeaderProps) => (
  <div className={styles['pageHeader']}>
    <div className={styles['text']}>
      <h1 className={styles['title']}>{title}</h1>
      {description !== undefined && (
        <p className={styles['description']}>{description}</p>
      )}
    </div>
    {actions !== undefined && (
      <div className={styles['actions']}>{actions}</div>
    )}
  </div>
)
