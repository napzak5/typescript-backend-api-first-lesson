import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import styles from './badge.module.css'

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type BadgeProps = {
  /** What kind of state it is. The text says which state; the colour only groups */
  tone?: BadgeTone
  children: ReactNode
  className?: string | undefined
}

const toneClass: Record<BadgeTone, string | undefined> = {
  neutral: styles['neutral'],
  info: styles['info'],
  success: styles['success'],
  warning: styles['warning'],
  danger: styles['danger'],
}

/** The state of a record, in a word: 「確定」, 「キャンセル」. */
export const Badge = ({
  tone = 'neutral',
  children,
  className,
}: BadgeProps) => (
  <span className={classNames(styles['badge'], toneClass[tone], className)}>
    {children}
  </span>
)
