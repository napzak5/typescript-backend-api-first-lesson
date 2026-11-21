import type { ReactNode } from 'react'
import styles from './share-bar.module.css'

export type ShareBarProps = {
  /** What the bar draws of its length, in percent: from 0 (none of it) to 100 (the whole) */
  percent: number
  /** The amount the bar is drawn under, as it is read */
  children: ReactNode
}

/**
 * An amount of a table with a bar under it, as long as its share: the rows
 * are compared at a glance. The amount is what is read; the bar holds no
 * text.
 */
export const ShareBar = ({ percent, children }: ShareBarProps) => (
  <span className={styles['shared']}>
    <span>{children}</span>
    <span className={styles['track']}>
      <span className={styles['bar']} style={{ inlineSize: `${percent}%` }} />
    </span>
  </span>
)
