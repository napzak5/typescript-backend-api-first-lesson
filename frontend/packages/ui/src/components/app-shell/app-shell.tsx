import { createContext, type ReactNode, useContext, useState } from 'react'
import { useWideScreen } from '../../hooks/wide-screen'
import { classNames } from '../../utils/class-names'
import { Button } from '../button/button'
import { Dialog } from '../dialog/dialog'
import { Link } from '../link/link'
import { Navigation, type NavigationItem } from '../navigation/navigation'
import { NotificationOutlet } from '../notifications/notifications'
import { visuallyHiddenClass } from '../visually-hidden/visually-hidden'
import styles from './app-shell.module.css'
import { ScreensProvider } from './screens'

export type AppShellProps = {
  /** The name of the application: in the header, beside the mark, as the link to its first screen */
  title: string
  /**
   * The links to the screens that the application offers now, to whoever
   * is signed in. Without any there is no navigation
   */
  navigation?: readonly NavigationItem[] | undefined
  /** What belongs to the person who is signed in: their name, signing out */
  account?: ReactNode
  children: ReactNode
}

/** The `id` of the main content, for the link that skips to it */
const MAIN_ID = 'main'

/**
 * The name of the navigation, of the menu that holds it on a narrow screen
 * and of the button that opens the menu. Not 「メニュー」: that is the
 * menu of the services of a salon, a screen of its own
 */
const MAIN_MENU = 'メインメニュー'

const InMenuContext = createContext(false)

/**
 * Whether a component stands in the menu of a narrow screen, where it has
 * the width of the screen: the account shows there what the header has no
 * room for.
 */
export const useInMenu = (): boolean => useContext(InMenuContext)

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

/** Three lines: what a phone has taught everybody to press for the menu */
const MenuIcon = () => (
  <svg className={styles['menuIcon']} viewBox='0 0 24 24' aria-hidden='true'>
    <path d='M4 6.5h16M4 12h16M4 17.5h16' />
  </svg>
)

type MenuProps = {
  items: readonly NavigationItem[]
  account: ReactNode
}

/**
 * The navigation and the account of a narrow screen, behind one button:
 * a sheet that comes up from the bottom edge, where a thumb reaches its
 * links. It closes when one of its links or buttons is pressed, as well as
 * on the overlay, on its own button and on the Escape key; the focus goes
 * back to the button that opened it, and from there to the heading of the
 * screen a link opened.
 */
const Menu = ({ items, account }: MenuProps) => {
  const [open, setOpen] = useState(false)
  const close = (): void => setOpen(false)

  return (
    <>
      <button
        type='button'
        className={styles['menuButton']}
        aria-label={MAIN_MENU}
        aria-haspopup='dialog'
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </button>
      <Dialog
        open={open}
        onClose={close}
        title={MAIN_MENU}
        kind='menu'
        actions={<Button onClick={close}>閉じる</Button>}
      >
        <Navigation label={MAIN_MENU} items={items} orientation='vertical' />
        {account !== undefined && (
          <div className={styles['menuAccount']}>
            <InMenuContext value>{account}</InMenuContext>
          </div>
        )}
      </Dialog>
    </>
  )
}

/**
 * The frame of an application: the header, the navigation and the main
 * content. The header begins with the mark and the name of the
 * application, a link to its first screen. The first thing the Tab key
 * reaches is a link that skips to the content, past the header and the
 * navigation. The notification of the application (`NotificationProvider`)
 * is shown at the top of the content.
 *
 * On a wide screen the account stands at the end of the header, and the
 * links of the navigation in a row under it. A narrow screen has no room
 * for either: the header is one row, with a button at its end that opens
 * the menu, the links and the account in a sheet. Without links the
 * account stays in the header, beside the name: the way in, for whoever is
 * not signed in.
 *
 * The screen inside it says what it is with a `PageHeader`: the frame names
 * the document after it and moves the focus to it when the screen changes.
 */
export const AppShell = ({
  title,
  navigation = [],
  account,
  children,
}: AppShellProps) => {
  const wide = useWideScreen()
  const hasLinks = navigation.length > 0

  return (
    <div className={styles['frame']}>
      {/* Out of sight until the keyboard reaches it */}
      <a
        className={classNames(styles['skipLink'], visuallyHiddenClass)}
        href={`#${MAIN_ID}`}
      >
        本文へ移動
      </a>
      <header className={styles['header']}>
        <div className={styles['headerContent']}>
          <Link href='/' className={styles['brand']}>
            <Mark />
            {title}
          </Link>
          {!wide && hasLinks ? (
            <Menu items={navigation} account={account} />
          ) : (
            account !== undefined && (
              <div className={styles['account']}>{account}</div>
            )
          )}
        </div>
      </header>
      {wide && hasLinks && (
        <div className={styles['navigation']}>
          <Navigation label={MAIN_MENU} items={navigation} />
        </div>
      )}
      <main className={styles['main']} id={MAIN_ID}>
        <NotificationOutlet />
        <div className={styles['content']}>
          <ScreensProvider applicationTitle={title}>{children}</ScreensProvider>
        </div>
      </main>
    </div>
  )
}
