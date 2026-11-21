import { useRef } from 'react'
import { CardList, type CardListProps } from '../card-list/card-list'
import { LoadMore, type More, useFocusOnMore } from '../load-more/load-more'
import { Note } from '../note/note'
import styles from './paged-list.module.css'

/**
 * What takes the focus in an item that 「さらに表示」 added: its first link
 * (`link`), or the item itself when it has none; or the item (`item`), so
 * that it is read from its beginning when its links are not where it
 * begins.
 */
export type PagedListFocus = 'link' | 'item'

export type PagedListProps<Item> = Omit<CardListProps<Item>, 'ref'> & {
  /** How many there are and how many are shown: said again whenever it changes */
  count?: string | undefined
  more: More
  /** Asks for the items that come next */
  onMore: () => void
  focus?: PagedListFocus | undefined
}

/** Out of the order of the keyboard: the focus is put there, and it is no control */
const focusItem = (item: HTMLElement): void => {
  item.tabIndex = -1
  item.focus()
}

/**
 * A `CardList` whose items are read a page at a time: how many there are,
 * the items, and the button that asks for more. The focus moves into the
 * first of the items the button added.
 */
export const PagedList = <Item,>({
  count,
  more,
  onMore,
  focus = 'link',
  ...list
}: PagedListProps<Item>) => {
  const items = useRef<HTMLUListElement>(null)
  const ask = useFocusOnMore(list.items.length, (index) => {
    const added = items.current
      ?.querySelectorAll<HTMLLIElement>(':scope > li')
      .item(index)
    if (added === null || added === undefined) {
      return
    }
    const link =
      focus === 'link' ? added.querySelector<HTMLAnchorElement>('a') : null
    if (link === null) {
      focusItem(added)
    } else {
      link.focus()
    }
  })

  return (
    <div className={styles['pagedList']}>
      {count !== undefined && <Note role='status'>{count}</Note>}
      <CardList {...list} ref={items} />
      <LoadMore
        more={more}
        onMore={() => {
          ask()
          onMore()
        }}
      />
    </div>
  )
}
