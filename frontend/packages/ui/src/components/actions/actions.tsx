import type { ReactNode } from 'react'
import styles from './actions.module.css'

/**
 * `flow`: side by side, each as wide as its label, and on in the next line
 * where the room ends: the buttons follow each other like words.
 * `row`: one below the other and as wide as the room on a narrow screen,
 * side by side from 40rem: the buttons of a form.
 * `stack`: one below the other on every screen, each as wide as its label.
 */
export type ActionsLayout = 'flow' | 'row' | 'stack'

export type ActionsProps = {
  /** The buttons and the links that look like one, in the order they are read */
  children: ReactNode
  layout?: ActionsLayout | undefined
}

const layoutClass: Record<ActionsLayout, string | undefined> = {
  flow: styles['flow'],
  row: styles['row'],
  stack: styles['stack'],
}

/**
 * What can be done from where the buttons stand, side by side or one below
 * the other, with one gap between them. A button that stands alone needs no
 * `Actions`: it is as wide as its label wherever it is.
 */
export const Actions = ({ children, layout = 'flow' }: ActionsProps) => (
  <div className={layoutClass[layout]}>{children}</div>
)
