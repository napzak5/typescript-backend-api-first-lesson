import type { ComponentProps } from 'react'
import { classNames } from '../../utils/class-names'
import { NotRecorded } from '../not-recorded/not-recorded'
import styles from './written-text.module.css'

export type WrittenTextProps = Omit<ComponentProps<'p'>, 'children'> & {
  /** What was written, or `null` when nothing was: it is then said as 「記録なし」, as a list says it */
  children: string | null
}

/**
 * What somebody wrote in a control of several lines (a note, a request, a
 * review), with its lines and its spaces as they were written.
 */
export const WrittenText = ({
  className,
  children,
  ...props
}: WrittenTextProps) =>
  children === null ? (
    <NotRecorded />
  ) : (
    <p className={classNames(styles['writtenText'], className)} {...props}>
      {children}
    </p>
  )
