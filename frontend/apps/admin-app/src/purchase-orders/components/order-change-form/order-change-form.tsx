import type { ModelsPurchaseOrderResponse } from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { deliveryDayOf } from '../../utils/order-change'

const { form, words } = adminPurchaseOrderMessages
const WORDS = form.change

export type OrderChangeFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  order: Pick<
    ModelsPurchaseOrderResponse,
    'expectedDelivery' | 'deliveryNotes' | 'notes'
  >
  /** The time zone of the salon, whose day the delivery is on */
  timezone: string
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

/**
 * What of an order is written down as it goes on, opened with what the
 * order holds now: the day the supplier promised to deliver on, what was
 * said about the delivery, and the notes. A field made empty clears it.
 */
export const OrderChangeForm = ({
  order,
  timezone,
  message,
  errors = NO_ERRORS,
  ...props
}: OrderChangeFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form {...props} message={said.message} errors={errors}>
      <TextField
        width='short'
        label={say(words.expectedDelivery)}
        name='expectedDelivery'
        autoComplete='off'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        defaultValue={deliveryDayOf(order.expectedDelivery, timezone)}
        description={say(WORDS.deliveryDescription)}
        error={said.errors['expectedDelivery']}
      />
      <TextArea
        label={say(words.deliveryNotes)}
        name='deliveryNotes'
        defaultValue={order.deliveryNotes ?? ''}
        description={say(WORDS.deliveryNotesDescription)}
        error={said.errors['deliveryNotes']}
      />
      <TextArea
        label={say(words.notes)}
        name='notes'
        defaultValue={order.notes ?? ''}
        description={say(words.notesDescription)}
        error={said.errors['notes']}
      />
    </Form>
  )
}
