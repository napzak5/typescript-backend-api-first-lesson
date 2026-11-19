import { classNames } from '../../class-names'
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
  orientation?: NavigationOrientation
  className?: string | undefined
}

const orientationClass: Record<NavigationOrientation, string | undefined> = {
  horizontal: styles['horizontal'],
  vertical: styles['vertical'],
}

/**
 * The links to the screens of an application. The application says which
 * link is the current one; it knows its routes, this package does not.
 */
export const Navigation = ({
  label,
  items,
  orientation = 'horizontal',
  className,
}: NavigationProps) => (
  <nav className={className} aria-label={label}>
    <ul className={classNames(styles['list'], orientationClass[orientation])}>
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
