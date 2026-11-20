import { type ReactNode, useId, useLayoutEffect, useRef } from 'react'
import { classNames } from '../../class-names'
import styles from './dialog.module.css'

export type DialogProps = {
  open: boolean
  /**
   * Called once when the dialog has closed, whatever closed it: the Escape
   * key, or `open` turning false. Set `open` to false here.
   */
  onClose: () => void
  /** What is asked or shown: the name of the dialog */
  title: string
  /** What follows from the answer: 「この操作は取り消せません」 */
  description?: string | undefined
  /** A form or other content between the text and the actions */
  children?: ReactNode
  /**
   * The buttons, in the order they are read. In a dialog without a form the
   * focus goes to the first, so the first is the one that changes nothing:
   * 「キャンセル」, then 「削除する」. A form gets the focus at its first control
   */
  actions: ReactNode
  /**
   * How wide it may grow: `medium` for a question or a small form, `wide`
   * for a table to choose from. Never wider than the screen
   */
  size?: 'medium' | 'wide' | undefined
}

const sizeClass: Record<
  NonNullable<DialogProps['size']>,
  string | undefined
> = {
  medium: undefined,
  wide: styles['wide'],
}

/**
 * A question or a small form that has to be dealt with before anything else.
 * It is the `dialog` element of the browser, opened as a modal: the browser
 * keeps the focus inside, makes the rest of the page inert, closes it on the
 * Escape key and gives the focus back to what opened it.
 *
 * It opens and closes in the commit that changes `open`, before the layout
 * effects of the components around it run. The rest of the page is inert
 * while it is open, so a component that closes it and moves the focus out
 * of it (to the heading of what the answer changed) can do so in its own
 * layout effect.
 */
export const Dialog = ({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  size = 'medium',
}: DialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  /** Whether the caller was told that the dialog closed, since it last opened */
  const told = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null || dialog.open === open) {
      return
    }
    if (open) {
      told.current = false
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  // The Escape key fires `cancel` and closes the dialog at once; `close`
  // comes in a task of its own, after a press that opens the dialog again
  // may have come. So the caller is told at `cancel`, and a `close` that
  // comes while the dialog is open is one of before
  const tell = (): void => {
    if (!told.current) {
      told.current = true
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={classNames(styles['dialog'], sizeClass[size])}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onCancel={tell}
      onClose={(event) => {
        if (!event.currentTarget.open) {
          tell()
        }
      }}
    >
      <div className={styles['content']}>
        <h2 className={styles['title']} id={titleId}>
          {title}
        </h2>
        {description !== undefined && (
          <p className={styles['description']} id={descriptionId}>
            {description}
          </p>
        )}
        {children}
        <div className={styles['actions']}>{actions}</div>
      </div>
    </dialog>
  )
}
