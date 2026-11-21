import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import { type Tone, toneClass } from '../../tone'
import styles from './alert.module.css'

export type AlertProps = {
  /** `danger` is something that went wrong and interrupts; the others wait their turn */
  tone?: Tone | undefined
  title?: string | undefined
  children: ReactNode
}

/** An error is announced at once; anything else when the user is idle. */
const roleOf: Record<Tone, 'alert' | 'status'> = {
  info: 'status',
  success: 'status',
  warning: 'status',
  danger: 'alert',
}

/**
 * A message about the form or the page: what went wrong, what was done, what
 * to know. Assistive technology announces it when it appears, so render it
 * when there is something to say and not before.
 */
export const Alert = ({ tone = 'info', title, children }: AlertProps) => (
  <div
    className={classNames(styles['alert'], toneClass[tone])}
    role={roleOf[tone]}
  >
    {title !== undefined && <p className={styles['title']}>{title}</p>}
    <div>{children}</div>
  </div>
)
