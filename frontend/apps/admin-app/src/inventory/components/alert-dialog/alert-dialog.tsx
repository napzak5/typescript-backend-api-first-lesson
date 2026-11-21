import type { ModelsInventoryAlertResponse } from '@beauty-salon-frontend/api-client'
import {
  DescriptionList,
  FormDialog,
  TextArea,
} from '@beauty-salon-frontend/ui'
import {
  alertNameOf,
  severityNameOf,
  thresholdTermOf,
} from '../../alert-format'
import { expiryNameOf, quantityNameOf } from '../../stock-format'

export type AlertDialogProps = {
  /** The alert the dialog sees to; `undefined` while the dialog is closed */
  alert: ModelsInventoryAlertResponse | undefined
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `alert` to `undefined` here
   */
  onClose: () => void
  /** What went wrong with an attempt that can be made again: said in the dialog */
  message?: string | undefined
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
  alert,
  onClose,
  message,
  pending = false,
  onSubmit,
}: AlertDialogProps) => {
  return (
    <FormDialog
      open={alert !== undefined}
      onClose={onClose}
      title={
        alert === undefined ? '' : `${alertNameOf(alert)}を確認済みにしますか？`
      }
      description='アラートを見て手を打ったことを、ほかのスタッフに伝えます。在庫が動くか、商品の最低在庫数や最大在庫数が変わって、アラートの状態が変わると、もう一度未確認になります。'
      submitLabel='確認済みにする'
      message={message}
      pending={pending}
      onSubmit={onSubmit}
    >
      {alert !== undefined && (
        <DescriptionList
          items={[
            { term: '重要度', description: severityNameOf(alert.severity) },
            {
              term: '在庫数',
              description: quantityNameOf(alert.currentStock, alert),
            },
            alert.threshold === null
              ? {
                  term: '使用期限',
                  description: expiryNameOf(alert.expiryDate),
                }
              : {
                  term: thresholdTermOf(alert.alert),
                  description: quantityNameOf(alert.threshold, alert),
                },
          ]}
        />
      )}
      <TextArea
        label='メモ'
        name='notes'
        rows={3}
        description='任意。何をしたか、これから何をするかを書きます（発注した、廃棄する、など）。'
      />
    </FormDialog>
  )
}
