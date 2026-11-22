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
} from '@beauty-salon-frontend/ui'
import { itemQuantityNameOf } from '../../order-format'
import { orderedTextOf, receivedControlOf } from '../../order-receipt'

export type OrderReceiptFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The items of the order, at least one of whose stock rows is still there, and the notes of its delivery */
  order: Pick<ModelsPurchaseOrderResponse, 'items' | 'deliveryNotes'>
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
}

/**
 * The goods that came for an order: for every item whose stock row is
 * still there, the quantity that came, which starts as all that was
 * ordered, and the notes of the delivery, which start as what the order
 * holds. The items whose rows were removed are named, and not received.
 */
export const OrderReceiptForm = ({
  order,
  errors = NO_ERRORS,
  ...form
}: OrderReceiptFormProps) => (
  <Form {...form} errors={errors}>
    <FormPart
      label='届いた数量'
      description='届いた数量を、明細ごとに入力します。はじめの値は、発注した数量です。届かなかった明細は空にします。入荷を記録すると、発注は納品済みになり、空の明細は受け取りません。あとから届いた分と、発注より多く届いた分は、在庫の移動（仕入れ）で記録します。'
    >
      {order.items.map((item) =>
        item.inventoryId === null ? (
          <Note size='small' key={item.productCode}>
            {`${item.productCode} ${item.productName}: 在庫の行が削除されたので、入荷できません。`}
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
            description={`発注 ${itemQuantityNameOf(item)}`}
            error={errors[receivedControlOf(item.inventoryId)]}
          />
        ),
      )}
    </FormPart>
    <TextArea
      label='納品のメモ'
      name='deliveryNotes'
      defaultValue={order.deliveryNotes ?? ''}
      description='任意。届いたときのこと（欠品や破損など）。書き換えると、発注の納品のメモが変わります。'
      error={errors['deliveryNotes']}
    />
  </Form>
)
