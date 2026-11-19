import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import styles from './alert.module.css'

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export type AlertProps = {
  /** `danger` is something that went wrong and interrupts; the others wait their turn */
  tone?: AlertTone | undefined
  title?: string | undefined
  children: ReactNode
  className?: string | undefined
}

const toneClass: Record<AlertTone, string | undefined> = {
  info: styles['info'],
  success: styles['success'],
  warning: styles['warning'],
  danger: styles['danger'],
}

/** An error is announced at once; anything else when the user is idle. */
const roleOf: Record<AlertTone, 'alert' | 'status'> = {
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
export const Alert = ({
  tone = 'info',
  title,
  children,
  className,
}: AlertProps) => (
  <div
    className={classNames(styles['alert'], toneClass[tone], className)}
    role={roleOf[tone]}
  >
    {title !== undefined && <p className={styles['title']}>{title}</p>}
    <div>{children}</div>
  </div>
)
