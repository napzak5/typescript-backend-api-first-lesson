import { type ReactNode, useEffect, useId, useRef } from 'react'
import styles from './dialog.module.css'

export type DialogProps = {
  open: boolean
  /**
   * Called when the dialog has closed, whatever closed it: the Escape key, or
   * `open` turning false. Set `open` to false here.
   */
  onClose: () => void
  /** What is asked or shown: the name of the dialog */
  title: string
  /** What follows from the answer: 「この操作は取り消せません」 */
  description?: string | undefined
  /** A form or other content between the text and the actions */
  children?: ReactNode
  /**
   * The buttons, in the order they are read. The focus goes to the first, so
   * the first is the one that changes nothing: 「キャンセル」, then 「削除する」.
   */
  actions: ReactNode
}

/**
 * A question or a small form that has to be dealt with before anything else.
 * It is the `dialog` element of the browser, opened as a modal: the browser
 * keeps the focus inside, makes the rest of the page inert, closes it on the
 * Escape key and gives the focus back to what opened it.
 */
export const Dialog = ({
  open,
  onClose,
  title,
  description,
  children,
  actions,
}: DialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null || dialog.open === open) {
      return
    }
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles['dialog']}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onClose={onClose}
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
