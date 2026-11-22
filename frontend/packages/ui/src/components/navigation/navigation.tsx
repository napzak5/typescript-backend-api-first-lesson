import { useLayoutEffect, useRef } from 'react'
import { classNames } from '../../utils/class-names'
import { Link } from '../link/link'
import styles from './navigation.module.css'

type NavigationOrientation = 'horizontal' | 'vertical'

export type NavigationItem = {
  href: string
  label: string
  /** This link leads to the screen that is shown now */
  current?: boolean | undefined
}

export type NavigationProps = {
  /** What these links are, for assistive technology: 「メインメニュー」 */
  label: string
  items: readonly NavigationItem[]
  /**
   * `horizontal`: in a row, which scrolls when it is longer than its place.
   * `vertical`: below each other, in as many columns as there is room for
   */
  orientation?: NavigationOrientation | undefined
}

const orientationClass: Record<NavigationOrientation, string | undefined> = {
  horizontal: styles['horizontal'],
  vertical: styles['vertical'],
}

/** Between the addresses of the links, which hold none */
const NEXT_ADDRESS = '\n'

/**
 * Scrolls a row of links that is wider than its place, and only the row,
 * so that the item of the current link is in its middle, as far as the
 * row goes.
 */
const centreInRow = (row: Element, item: Element): void => {
  const shown = row.getBoundingClientRect()
  const link = item.getBoundingClientRect()
  row.scrollLeft += link.left + link.width / 2 - (shown.left + shown.width / 2)
}

/**
 * The links to the screens of an application. The application says which
 * link is the current one; it knows its routes, this package does not.
 *
 * On a narrow screen a row of links would leave the current one out of
 * sight, so the row is scrolled to it whenever its links or the current one
 * change: another screen, or links that came with the role of whoever
 * signed in. It is not scrolled when the screen is drawn again, so a row
 * somebody scrolled stays where they left it.
 */
export const Navigation = ({
  label,
  items,
  orientation = 'horizontal',
}: NavigationProps) => {
  const list = useRef<HTMLUListElement>(null)
  const addresses = items.map((item) => item.href).join(NEXT_ADDRESS)
  const current = items.find((item) => item.current === true)?.href

  useLayoutEffect(() => {
    const row = list.current
    const place =
      current === undefined
        ? -1
        : addresses.split(NEXT_ADDRESS).indexOf(current)
    const item = place < 0 ? null : (row?.children.item(place) ?? null)
    if (orientation === 'horizontal' && row !== null && item !== null) {
      centreInRow(row, item)
    }
  }, [addresses, current, orientation])

  return (
    <nav aria-label={label}>
      <ul
        ref={list}
        className={classNames(styles['list'], orientationClass[orientation])}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={styles['item']}
              aria-current={item.current === true ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
