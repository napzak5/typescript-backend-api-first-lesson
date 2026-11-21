import type { ComponentProps } from 'react'
import { classNames } from '../../class-names'
import styles from './written-text.module.css'

export type WrittenTextProps = ComponentProps<'p'>

/**
 * What somebody wrote in a control of several lines (a note, a request, a
 * review), with its lines and its spaces as they were written.
 */
export const WrittenText = ({ className, ...props }: WrittenTextProps) => (
  <p className={classNames(styles['writtenText'], className)} {...props} />
)
