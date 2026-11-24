import { Alert, Button, Card, Dialog, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminOperationMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import type { RunCopy } from '../../utils/operations'
import styles from './operation-run.module.css'

export type OperationRunProps = {
  /** What the part says, and asks before the operation runs */
  copy: RunCopy
  /** When the operation was last run on this screen, with what it did */
  result?: LocalizedText | undefined
  /** What the last run did, in detail: a table below the result */
  children?: ReactNode
  /** Why the last attempt changed nothing, said above the button */
  refusal?: LocalizedText | undefined
  /** Whether the dialog that asks is open */
  asking?: boolean | undefined
  /** The operation is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, in the dialog */
  message?: LocalizedText | undefined
  /** The button that asks was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  /** The operation was confirmed */
  onRun: () => void
}

/**
 * One of the operations that are meant to run at intervals, run by hand
 * after a dialog that says what cannot be undone. What the last run did is
 * said in the part, until the screen is left: no operation keeps a record
 * of its runs that could be read again.
 */
export const OperationRun = ({
  copy,
  result,
  children,
  refusal,
  asking = false,
  pending = false,
  message,
  onAsk,
  onClose,
  onRun,
}: OperationRunProps) => {
  const say = useSay()

  return (
    <Card title={say(copy.title)}>
      <div className={styles['run']}>
        <p>{say(copy.text)}</p>
        {result !== undefined && <p>{say(result)}</p>}
        {children}
        {refusal !== undefined && <Alert tone='danger'>{say(refusal)}</Alert>}
        <Button variant='danger' onClick={onAsk}>
          {say(copy.button)}
        </Button>
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title={say(copy.question)}
        description={say(copy.warning)}
        actions={
          <>
            <Button onClick={onClose}>
              {say(adminOperationMessages.runs.back)}
            </Button>
            <Button variant='danger' pending={pending} onClick={onRun}>
              {say(copy.confirm)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </Card>
  )
}
