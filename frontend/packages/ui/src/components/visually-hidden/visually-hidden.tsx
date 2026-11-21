import type { ReactNode } from 'react'
import styles from './visually-hidden.module.css'

/** The class that keeps an element out of sight and still read, for the components of this package */
export const visuallyHiddenClass = styles['hidden']

export type VisuallyHiddenProps = {
  children: ReactNode
}

/**
 * Words that assistive technology reads and the eye does not see, where
 * what is around them shows the same (the address of the account, in a
 * header with no room for it).
 */
export const VisuallyHidden = ({ children }: VisuallyHiddenProps) => (
  <span className={visuallyHiddenClass}>{children}</span>
)
