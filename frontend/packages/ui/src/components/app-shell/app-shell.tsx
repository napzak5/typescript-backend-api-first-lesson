import type { ReactNode } from 'react'
import { classNames } from '../../class-names'
import { NotificationOutlet } from '../notifications/notifications'
import styles from './app-shell.module.css'
import { ScreensProvider } from './screens'

type NavigationPlacement = 'header' | 'side'

export type AppShellProps = {
  /** The name of the application, shown in the header */
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

/**
 * The frame of an application: the header, the navigation and the main
 * content. The first thing the Tab key reaches is a link that skips to the
 * content, past the header and the navigation. The notification of the
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
        <p className={styles['title']}>{title}</p>
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
