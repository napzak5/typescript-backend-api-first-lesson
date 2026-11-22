import type { ModelsPurchaseOrderResponse } from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { deliveryDayOf } from '../../utils/order-change'

export type OrderChangeFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  order: Pick<
    ModelsPurchaseOrderResponse,
    'expectedDelivery' | 'deliveryNotes' | 'notes'
  >
  /** The time zone of the salon, whose day the delivery is on */
  timezone: string
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
}

/**
 * What of an order is written down as it goes on, opened with what the
 * order holds now: the day the supplier promised to deliver on, what was
 * said about the delivery, and the notes. A field made empty clears it.
 */
export const OrderChangeForm = ({
  order,
  timezone,
  errors = NO_ERRORS,
  ...form
}: OrderChangeFormProps) => (
  <Form {...form} errors={errors}>
    <TextField
      width='short'
      label='納品予定日'
      name='expectedDelivery'
      autoComplete='off'
      type='date'
      min={EARLIEST_DAY}
      max={LATEST_DAY}
      defaultValue={deliveryDayOf(order.expectedDelivery, timezone)}
      description='任意。仕入先が約束した日。空にすると、未定になります。'
      error={errors['expectedDelivery']}
    />
    <TextArea
      label='納品のメモ'
      name='deliveryNotes'
      defaultValue={order.deliveryNotes ?? ''}
      description='任意。届け先や届く時間など、納品について仕入先と決めたこと。'
      error={errors['deliveryNotes']}
    />
    <TextArea
      label='メモ'
      name='notes'
      defaultValue={order.notes ?? ''}
      description='任意。仕入先への連絡や、届いたあとのことなど。'
      error={errors['notes']}
    />
  </Form>
)
