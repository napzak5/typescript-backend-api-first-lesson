import {
  Actions,
  Alert,
  Button,
  ButtonLink,
  Card,
  Dialog,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import styles from './customer-keeping.module.css'

const { keeping: words } = adminCustomerMessages

export type CustomerKeepingProps = {
  /** The account may read the history, merge the customer and remove them: the owner, a manager, the operator of the platform */
  keepable: boolean
  /** The name of the customer, as the dialog names them: 「山田 花子」 */
  name: string
  /** The address of the history of the customer */
  historyHref: string
  /** The address of the screen that merges the customer with another record of them */
  mergeHref: string
  /** The dialog that asks before the customer is removed is open */
  open: boolean
  /** The button that removes was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt to remove, and may be tried again; it is said in the dialog */
  message?: LocalizedText | undefined
  /** Why the customer stays, which another attempt does not change; it is said here */
  refusal?: LocalizedText | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** The removal was confirmed */
  onRemove: () => void
}

/**
 * What is done with the record of the customer itself: its history is
 * read, another record of the same person is merged into it, and the
 * customer is taken out of the ledger. A dialog asks before the removal,
 * and says what follows; a removed customer can be brought back. A member
 * of the staff is told who does it.
 */
export const CustomerKeeping = ({
  keepable,
  name,
  historyHref,
  mergeHref,
  open,
  onOpen,
  onClose,
  message,
  refusal,
  pending = false,
  onRemove,
}: CustomerKeepingProps) => {
  const say = useSay()

  return (
    <Card title={say(words.title)}>
      {keepable ? (
        <div className={styles['keeping']}>
          <p>{say(words.about)}</p>
          {refusal !== undefined && <Alert tone='danger'>{say(refusal)}</Alert>}
          <Actions>
            <ButtonLink href={historyHref}>{say(words.history)}</ButtonLink>
            <ButtonLink href={mergeHref}>{say(words.merge)}</ButtonLink>
            <Button variant='danger' onClick={onOpen}>
              {say(words.remove)}
            </Button>
          </Actions>
          <Dialog
            open={open}
            onClose={onClose}
            title={say(words.confirm(name))}
            description={say(words.confirmDescription)}
            actions={
              <>
                <Button onClick={onClose}>{say(words.back)}</Button>
                <Button variant='danger' pending={pending} onClick={onRemove}>
                  {say(words.confirmRemoval)}
                </Button>
              </>
            }
          >
            {message !== undefined && (
              <Alert tone='danger'>{say(message)}</Alert>
            )}
          </Dialog>
        </div>
      ) : (
        <p>{say(words.keptByOthers)}</p>
      )}
    </Card>
  )
}
