import { useSyncExternalStore } from 'react'

/** Where the stylesheets of this package lay out a wide screen: `@media (min-width: 40rem)` */
const WIDE = '(min-width: 40rem)'

const subscribe = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(WIDE)
  query.addEventListener('change', onChange)

  return () => query.removeEventListener('change', onChange)
}

const isWide = (): boolean => window.matchMedia(WIDE).matches

/**
 * Whether the window is as wide as the stylesheets say a wide screen is,
 * now and whenever it is turned or made wider: for a component that draws
 * something else on a narrow one. It draws one of the two, and does not
 * hide the other with a stylesheet, so that a screen reader and a test
 * never find the same link twice.
 */
export const useWideScreen = (): boolean =>
  useSyncExternalStore(subscribe, isWide)
