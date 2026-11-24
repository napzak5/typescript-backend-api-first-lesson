import type { ModelsInventoryAlertResponse } from '@beauty-salon-frontend/api-client'
import {
  DescriptionList,
  FormDialog,
  TextArea,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  alertKindNameOf,
  alertSubjectNameOf,
  severityNameOf,
  thresholdTermOf,
} from '../../utils/alert-format'
import { expiryNameOf, quantityNameOf } from '../../utils/stock-format'

const { dialog: words } = adminInventoryMessages.alerts

export type AlertDialogProps = {
  /** The dialog is open */
  open: boolean
  /** The alert the dialog sees to, also while it closes */
  alert: ModelsInventoryAlertResponse
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with an attempt that can be made again: said in the dialog */
  message?: LocalizedText | undefined
  /** The acknowledgement is on its way */
  pending?: boolean | undefined
  /** The form was sent: `notes` */
  onSubmit: (values: FormData) => void
}

/**
 * The acknowledgement of an alert: what it is, and the notes of what was
 * done about it, which the other members of the staff read. It holds while
 * what it was given for lasts.
 */
export const AlertDialog = ({
  open,
  alert,
  onClose,
  message,
  pending = false,
  onSubmit,
}: AlertDialogProps) => {
  const say = useSay()

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={say(
        words.title(alertKindNameOf(alert.alert), alertSubjectNameOf(alert)),
      )}
      description={say(words.description)}
      submitLabel={say(words.submit)}
      message={message === undefined ? undefined : say(message)}
      pending={pending}
      onSubmit={onSubmit}
    >
      <DescriptionList
        items={[
          {
            term: say(words.severity),
            description: say(severityNameOf(alert.severity)),
          },
          {
            term: say(words.inStock),
            description: say(quantityNameOf(alert.currentStock, alert)),
          },
          alert.threshold === null
            ? {
                term: say(words.expiry),
                description: say(expiryNameOf(alert.expiryDate)),
              }
            : {
                term: say(thresholdTermOf(alert.alert)),
                description: say(quantityNameOf(alert.threshold, alert)),
              },
        ]}
      />
      <TextArea
        label={say(words.notes)}
        name='notes'
        description={say(words.notesDescription)}
      />
    </FormDialog>
  )
}
