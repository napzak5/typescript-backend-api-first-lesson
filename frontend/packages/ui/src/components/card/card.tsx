import { type ReactNode, useId } from 'react'
import { match } from 'ts-pattern'
import { classNames } from '../../class-names'
import styles from './card.module.css'

type HeadingLevel = 2 | 3

export type CardProps = {
  /** The heading of the card; the card is a region of this name */
  title: string
  /** The level of the heading: 2 below the heading of the screen, 3 inside another card */
  headingLevel?: HeadingLevel
  /** What can be done with what the card holds: 「編集」 */
  actions?: ReactNode
  children: ReactNode
  className?: string | undefined
}

/** A part of a screen that stands by itself, under its own heading. */
export const Card = ({
  title,
  headingLevel = 2,
  actions,
  children,
  className,
}: CardProps) => {
  const titleId = useId()

  return (
    <section
      className={classNames(styles['card'], className)}
      aria-labelledby={titleId}
    >
      <div className={styles['head']}>
        {match(headingLevel)
          .with(2, () => (
            <h2 className={styles['title']} id={titleId}>
              {title}
            </h2>
          ))
          .with(3, () => (
            <h3 className={styles['title']} id={titleId}>
              {title}
            </h3>
          ))
          .exhaustive()}
        {actions !== undefined && (
          <div className={styles['actions']}>{actions}</div>
        )}
      </div>
      {children}
    </section>
  )
}
