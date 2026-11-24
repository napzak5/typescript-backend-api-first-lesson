import type { ModelsPurchaseOrderResponse } from '@beauty-salon-frontend/api-client'
import {
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  Note,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { itemQuantityNameOf } from '../../utils/order-format'
import { orderedTextOf, receivedControlOf } from '../../utils/order-receipt'

const { receipt: WORDS, words } = adminPurchaseOrderMessages

export type OrderReceiptFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** The items of the order, at least one of whose stock rows is still there, and the notes of its delivery */
  order: Pick<ModelsPurchaseOrderResponse, 'items' | 'deliveryNotes'>
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

/**
 * The goods that came for an order: for every item whose stock row is
 * still there, the quantity that came, which starts as all that was
 * ordered, and the notes of the delivery, which start as what the order
 * holds. The items whose rows were removed are named, and not received.
 */
export const OrderReceiptForm = ({
  order,
  message,
  errors = NO_ERRORS,
  ...form
}: OrderReceiptFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart
        label={say(WORDS.received)}
        description={say(WORDS.receivedDescription)}
      >
        {order.items.map((item) =>
          item.inventoryId === null ? (
            <Note size='small' key={item.productCode}>
              {say(WORDS.rowRemoved(item.productCode, item.productName))}
            </Note>
          ) : (
            <TextField
              width='short'
              key={item.inventoryId}
              label={`${item.productCode} ${item.productName}`}
              name={receivedControlOf(item.inventoryId)}
              inputMode='decimal'
              autoComplete='off'
              defaultValue={orderedTextOf(item)}
              description={say(WORDS.ordered(itemQuantityNameOf(item)))}
              error={said.errors[receivedControlOf(item.inventoryId)]}
            />
          ),
        )}
      </FormPart>
      <TextArea
        label={say(words.deliveryNotes)}
        name='deliveryNotes'
        defaultValue={order.deliveryNotes ?? ''}
        description={say(WORDS.deliveryNotesDescription)}
        error={said.errors['deliveryNotes']}
      />
    </Form>
  )
}
