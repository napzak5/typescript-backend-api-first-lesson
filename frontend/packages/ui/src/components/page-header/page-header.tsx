import { type ReactNode, useState } from 'react'
import { useWideScreen } from '../../wide-screen'
import { useScreen } from '../app-shell/screens'
import { Button } from '../button/button'
import { Dialog } from '../dialog/dialog'
import styles from './page-header.module.css'

export type PageHeaderProps = {
  /** The heading of the screen: its one `h1` */
  title: string
  description?: string | undefined
  /** What can be done with the whole screen: 「新しい予約」. Always in sight */
  actions?: ReactNode
  /**
   * What else can be done with it, on a screen with more than two actions:
   * in the row of `actions` on a wide screen, in a sheet that 「ほかの操作」
   * opens on a narrow one. Links, and buttons that do their work at once:
   * the sheet closes when one is pressed, and a dialog that an action opened
   * would close with it
   */
  otherActions?: ReactNode
}

const OTHER_ACTIONS = 'ほかの操作'

/**
 * The top of a screen: what it is, and what can be done with all of it. It
 * is not a `header` element: the one banner of a page is that of its frame.
 *
 * Inside an `AppShell` its title also names the document, and its heading
 * takes the focus when the screen has taken the place of another one.
 */
export const PageHeader = ({
  title,
  description,
  actions,
  otherActions,
}: PageHeaderProps) => {
  const heading = useScreen(title)
  const wide = useWideScreen()
  const inSheet = !wide && otherActions !== undefined
  const [sheetOpen, setSheetOpen] = useState(false)
  if (sheetOpen && !inSheet) {
    // The window was made wide: the other actions are in the row
    setSheetOpen(false)
  }
  const close = (): void => setSheetOpen(false)

  return (
    <div className={styles['pageHeader']}>
      <div className={styles['text']}>
        {/* Takes the focus from the frame, never from the Tab key */}
        <h1 className={styles['title']} ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {description !== undefined && (
          <p className={styles['description']}>{description}</p>
        )}
      </div>
      {(actions !== undefined || otherActions !== undefined) && (
        <div className={styles['actions']}>
          {actions}
          {inSheet ? (
            <Button aria-haspopup='dialog' onClick={() => setSheetOpen(true)}>
              {OTHER_ACTIONS}
            </Button>
          ) : (
            otherActions
          )}
        </div>
      )}
      {inSheet && (
        <Dialog
          open={sheetOpen}
          onClose={close}
          title={OTHER_ACTIONS}
          kind='menu'
          actions={<Button onClick={close}>閉じる</Button>}
        >
          <div className={styles['otherActions']}>{otherActions}</div>
        </Dialog>
      )}
    </div>
  )
}
