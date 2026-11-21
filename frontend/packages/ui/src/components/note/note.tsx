import type { ComponentProps } from 'react'
import { classNames } from '../../class-names'
import styles from './note.module.css'

/**
 * `medium` for what is said of a screen, a part of it or a list (what a
 * list holds, why a step is not offered); `small` for what supports a
 * control or a part of a form, beside it.
 */
export type NoteSize = 'medium' | 'small'

export type NoteProps = ComponentProps<'p'> & {
  size?: NoteSize | undefined
}

const sizeClass: Record<NoteSize, string | undefined> = {
  medium: undefined,
  small: styles['small'],
}

/** A sentence said quietly, beside what it is about. */
export const Note = ({ size = 'medium', className, ...props }: NoteProps) => (
  <p
    className={classNames(styles['note'], sizeClass[size], className)}
    {...props}
  />
)
