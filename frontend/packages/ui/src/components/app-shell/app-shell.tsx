import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import { Link } from '../link/link'
import { NotificationOutlet } from '../notifications/notifications'
import styles from './app-shell.module.css'
import { ScreensProvider } from './screens'

type NavigationPlacement = 'header' | 'side'

export type AppShellProps = {
  /** The name of the application: in the header, beside the mark, as the link to its first screen */
  title: string
  /** The links to the screens: a `Navigation` */
  navigation?: ReactNode
  /**
   * Where the navigation stands: in the header, for a few links, or beside
   * the content, for many. On a narrow screen it is above the content either way.
   */
  navigationPlacement?: NavigationPlacement
  /** What belongs to the person who is signed in: their name, signing out */
  account?: ReactNode
  children: ReactNode
}

const placementClass: Record<NavigationPlacement, string | undefined> = {
  header: undefined,
  side: styles['navigationAtSide'],
}

/** The `id` of the main content, for the link that skips to it */
const MAIN_ID = 'main'

/** Where the teeth of the comb of the mark stand, on its grid of 32 */
const TEETH = [5, 8.33, 11.67, 15, 18.33, 21.67, 25]

/**
 * The mark of the product: a comb on a tile, as the icon of the tab and the
 * image of a shared link show it. It stands beside the name, which says
 * what it is, so it is not read out.
 */
const Mark = () => (
  <svg className={styles['mark']} viewBox='0 0 32 32' aria-hidden='true'>
    <rect className={styles['markTile']} width='32' height='32' rx='7' />
    <g className={styles['markComb']}>
      <path d='M5 15.5V13.2C5 10.2 10 8 16 8s11 2.2 11 5.2v2.3Z' />
      {TEETH.map((x) => (
        <rect key={x} x={x} y='13' width='2' height='11.5' rx='1' />
      ))}
    </g>
  </svg>
)

/**
 * The frame of an application: the header, the navigation and the main
 * content. The header begins with the mark and the name of the
 * application, a link to its first screen. The first thing the Tab key
 * reaches is a link that skips to the content, past the header and the
 * navigation. The notification of the
 * application (`NotificationProvider`) is shown at the top of the content.
 *
 * The screen inside it says what it is with a `PageHeader`: the frame names
 * the document after it and moves the focus to it when the screen changes.
 */
export const AppShell = ({
  title,
  navigation,
  navigationPlacement = 'header',
  account,
  children,
}: AppShellProps) => (
  <div
    className={classNames(styles['frame'], placementClass[navigationPlacement])}
  >
    <a className={styles['skipLink']} href={`#${MAIN_ID}`}>
      本文へ移動
    </a>
    <header className={styles['header']}>
      <div className={styles['headerContent']}>
        <Link href='/' className={styles['brand']}>
          <Mark />
          {title}
        </Link>
        {account !== undefined && (
          <div className={styles['account']}>{account}</div>
        )}
      </div>
    </header>
    {navigation !== undefined && (
      <div className={styles['navigation']}>{navigation}</div>
    )}
    <main className={styles['main']} id={MAIN_ID}>
      <NotificationOutlet />
      <div className={styles['content']}>
        <ScreensProvider applicationTitle={title}>{children}</ScreensProvider>
      </div>
    </main>
  </div>
)
