import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import { type Tone, toneClass } from '../../tone'
import styles from './badge.module.css'

/** The colour of a badge: that of a state, or `neutral` for a state that is none of them */
export type BadgeTone = 'neutral' | Tone

export type BadgeProps = {
  /** What kind of state it is. The text says which state; the colour only groups */
  tone?: BadgeTone | undefined
  children: ReactNode
  className?: string | undefined
}

const badgeToneClass: Record<BadgeTone, string | undefined> = {
  neutral: styles['neutral'],
  ...toneClass,
}

/** The state of a record, in a word: 「確定」, 「キャンセル」. */
export const Badge = ({
  tone = 'neutral',
  children,
  className,
}: BadgeProps) => (
  <span
    className={classNames(styles['badge'], badgeToneClass[tone], className)}
  >
    {children}
  </span>
)
