import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import { Actions } from '../actions/actions'
import { Note } from '../note/note'
import styles from './empty-state.module.css'

/**
 * `page` where the content of a page would be: in a frame, in the middle.
 * `part` inside a part of a page (a card, a section of a record): a quiet
 * sentence where the content of the part would be.
 */
type EmptyStateKind = 'page' | 'part'

export type EmptyStateProps = {
  /** What is not there yet: 「予約はまだありません」 */
  title: string
  /** What to do about it, or why it is so */
  description?: string | undefined
  /** The first step: a `Button` or a `ButtonLink` */
  actions?: ReactNode
  kind?: EmptyStateKind | undefined
}

const kindClass: Record<EmptyStateKind, string | undefined> = {
  page: styles['page'],
  part: styles['part'],
}

/**
 * What a screen shows where its content would be, while there is none. It
 * says so in words and offers the first step.
 */
export const EmptyState = ({
  title,
  description,
  actions,
  kind = 'page',
}: EmptyStateProps) => (
  <div className={classNames(styles['emptyState'], kindClass[kind])}>
    <p className={styles['title']}>{title}</p>
    {description !== undefined && (
      <Note className={styles['description']}>{description}</Note>
    )}
    {actions !== undefined && <Actions>{actions}</Actions>}
  </div>
)
