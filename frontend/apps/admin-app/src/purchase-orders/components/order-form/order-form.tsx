import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import { amountOf } from '@beauty-salon-frontend/salon-screens'
import {
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  FormRow,
  formValuesOf,
  NO_ERRORS,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { type FormEvent, useState } from 'react'
import {
  productOf,
  quantityNameOf,
  stockRowNameOf,
} from '../../../inventory/utils/stock-format'
import {
  quantityControlOf,
  subtotalOf,
  taxAt,
  unitPriceControlOf,
} from '../../utils/order-entry'
import styles from './order-form.module.css'

const { words } = adminPurchaseOrderMessages
const WORDS = adminPurchaseOrderMessages.form.entry

export type OrderFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** The stock rows of the salon, in the order of the codes of their products and their lots; at least one */
  rows: readonly ModelsInventoryResponse[]
  /** The products of the salon, which name the rows and give their prices */
  products: readonly ModelsProductResponse[]
  /** The rate of tax of the salon, in percent, and its currency */
  salon: { taxRate: number; currency: string }
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** What the form starts with besides the prices: a supplier, and quantities by the IDs of the rows */
  starting?: OrderStart | undefined
}

/** What a new order starts with: the suggestions of a supplier, or nothing */
type OrderStart = {
  supplier: string
  quantities: Readonly<Record<string, string>>
}

const EMPTY: OrderStart = { supplier: '', quantities: {} }

/** The price a row is ordered at first: what the product is bought at, when it has one */
const priceOf = (product: ModelsProductResponse | undefined): string =>
  product === undefined || product.purchasePrice === null
    ? ''
    : `${product.purchasePrice}`

/** The quantities and the prices of the rows as the form opens: what its subtotal starts from */
const openedWith = (
  rows: readonly ModelsInventoryResponse[],
  products: readonly ModelsProductResponse[],
  quantities: Readonly<Record<string, string>>,
): FormData => {
  const values = new FormData()
  for (const row of rows) {
    values.set(quantityControlOf(row.id), quantities[row.id] ?? '')
    values.set(
      unitPriceControlOf(row.id),
      priceOf(productOf(products, row.productId)),
    )
  }

  return values
}

/**
 * A new purchase order: its supplier; a quantity and a unit price for
 * every stock row of the salon, of which the rows with a quantity are
 * ordered; what the items come to, worked out as they are entered, beside
 * the tax, which follows the bill of the supplier; the shipping cost, the
 * day of delivery, the terms of payment and the notes.
 */
export const OrderForm = ({
  rows,
  products,
  salon,
  message,
  errors = NO_ERRORS,
  starting = EMPTY,
  ...form
}: OrderFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  // What was entered when a quantity or a price last changed, and what the
  // form opened with before. The subtotal is worked out from it over the
  // rows there are now: a row removed meanwhile, and read anew, adds
  // nothing
  const [entered, setEntered] = useState(() =>
    openedWith(rows, products, starting.quantities),
  )
  const subtotal = subtotalOf(entered, rows)

  const tally = (event: FormEvent<HTMLFieldSetElement>): void =>
    setEntered(formValuesOf(event.currentTarget))

  return (
    <Form {...form} message={said.message} errors={errors}>
      <TextField
        label={say(words.supplier)}
        name='supplier'
        autoComplete='organization'
        defaultValue={starting.supplier}
        description={say(WORDS.supplierDescription)}
        error={said.errors['supplier']}
      />
      <FormPart
        label={say(words.items)}
        description={say(WORDS.itemsDescription)}
        onInput={tally}
      >
        {rows.map((row) => {
          const product = productOf(products, row.productId)
          const quantity = quantityControlOf(row.id)
          const unitPrice = unitPriceControlOf(row.id)

          return (
            <FormRow key={row.id} label={say(stockRowNameOf(row, product))}>
              <FieldRow>
                <TextField
                  label={say(words.quantity)}
                  name={quantity}
                  inputMode='decimal'
                  autoComplete='off'
                  defaultValue={starting.quantities[row.id]}
                  description={say(
                    WORDS.inStock(quantityNameOf(row.currentStock, product)),
                  )}
                  error={said.errors[quantity]}
                />
                <TextField
                  label={say(WORDS.unitPrice)}
                  name={unitPrice}
                  inputMode='numeric'
                  autoComplete='off'
                  defaultValue={priceOf(product)}
                  error={said.errors[unitPrice]}
                />
              </FieldRow>
            </FormRow>
          )
        })}
        <p className={styles['subtotal']}>
          {say(WORDS.subtotal(amountOf(subtotal, salon.currency)))}
        </p>
      </FormPart>
      <TextField
        width='short'
        label={say(WORDS.tax)}
        name='taxAmount'
        inputMode='numeric'
        autoComplete='off'
        description={say(
          WORDS.taxDescription(
            formats.percentOf(salon.taxRate),
            amountOf(taxAt(subtotal, salon.taxRate), salon.currency),
          ),
        )}
        error={said.errors['taxAmount']}
      />
      <TextField
        width='short'
        label={say(WORDS.shipping)}
        name='shippingCost'
        inputMode='numeric'
        autoComplete='off'
        description={say(WORDS.shippingDescription)}
        error={said.errors['shippingCost']}
      />
      <TextField
        width='short'
        label={say(words.expectedDelivery)}
        name='expectedDelivery'
        autoComplete='off'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        description={say(words.deliveryDescription)}
        error={said.errors['expectedDelivery']}
      />
      <TextField
        label={say(words.paymentTerms)}
        name='paymentTerms'
        autoComplete='off'
        description={say(WORDS.paymentTermsDescription)}
        error={said.errors['paymentTerms']}
      />
      <TextArea
        label={say(words.notes)}
        name='notes'
        description={say(words.notesDescription)}
        error={said.errors['notes']}
      />
    </Form>
  )
}
