import type { ReactNode, Ref } from 'react'
import styles from './card-list.module.css'

/** `column`: one item below the other. `tiles`: as many side by side as the width holds */
export type CardListLayout = 'column' | 'tiles'

export type CardListProps<Item> = {
  items: readonly Item[]
  itemKey: (item: Item) => string
  /** What an item shows, one below the other inside its frame */
  children: (item: Item) => ReactNode
  layout?: CardListLayout | undefined
  /** The name of the list, when no heading around it names it */
  label?: string | undefined
  ref?: Ref<HTMLUListElement> | undefined
}

const layoutClass: Record<CardListLayout, string | undefined> = {
  column: styles['column'],
  tiles: styles['tiles'],
}

/**
 * Records that are read one by one (bookings, reviews, salons, devices), as
 * a list whose items are framed as cards: the frame, the room inside it and
 * between the items are those of the cards of a page.
 */
export const CardList = <Item,>({
  items,
  itemKey,
  children,
  layout = 'column',
  label,
  ref,
}: CardListProps<Item>) => (
  <ul className={layoutClass[layout]} aria-label={label} ref={ref}>
    {items.map((item) => (
      <li key={itemKey(item)} className={styles['item']}>
        {children(item)}
      </li>
    ))}
  </ul>
)
