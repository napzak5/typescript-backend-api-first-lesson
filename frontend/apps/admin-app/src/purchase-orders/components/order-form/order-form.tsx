import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  EARLIEST_DAY,
  LATEST_DAY,
} from '@beauty-salon-frontend/salon-screens'
import {
  Form,
  type FormErrors,
  type FormProps,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import {
  productOf,
  quantityNameOf,
  stockRowNameOf,
} from '../../../inventory/stock-format'
import {
  quantityControlOf,
  subtotalOf,
  taxAt,
  unitPriceControlOf,
} from '../../order-entry'
import styles from './order-form.module.css'

export type OrderFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The stock rows of the salon, in the order of the codes of their products and their lots; at least one */
  rows: readonly ModelsInventoryResponse[]
  /** The products of the salon, which name the rows and give their prices */
  products: readonly ModelsProductResponse[]
  /** The rate of tax of the salon, in percent, and its currency */
  salon: { taxRate: number; currency: string }
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
  /** What the form starts with besides the prices: a supplier, and quantities by the IDs of the rows */
  starting?: OrderStart | undefined
}

/** What a new order starts with: the suggestions of a supplier, or nothing */
type OrderStart = {
  supplier: string
  quantities: Readonly<Record<string, string>>
}

const NO_ERRORS: FormErrors = {}

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
  errors = NO_ERRORS,
  starting = EMPTY,
  ...form
}: OrderFormProps) => {
  // What was entered when a quantity or a price last changed, and what the
  // form opened with before. The subtotal is worked out from it over the
  // rows there are now: a row removed meanwhile, and read anew, adds
  // nothing
  const [entered, setEntered] = useState(() =>
    openedWith(rows, products, starting.quantities),
  )
  const subtotal = subtotalOf(entered, rows)

  const tally = (event: FormEvent<HTMLFieldSetElement>): void => {
    const form = event.currentTarget.form
    if (form !== null) {
      setEntered(new FormData(form))
    }
  }

  return (
    <Form {...form} errors={errors}>
      <TextField
        label='仕入先'
        name='supplier'
        autoComplete='organization'
        defaultValue={starting.supplier}
        description='発注を探すときも、この名前で探します。'
        error={errors['supplier']}
      />
      <fieldset className={styles['part']} onInput={tally}>
        <legend className={styles['name']}>明細</legend>
        <div className={styles['controls']}>
          <p className={styles['note']}>
            発注する行に、数量を入力します。空のままの行は発注しません。単価のはじめの値は、商品の仕入価格です。数量の小数は
            2 桁まで。
          </p>
          {rows.map((row) => {
            const product = productOf(products, row.productId)
            const quantity = quantityControlOf(row.id)
            const unitPrice = unitPriceControlOf(row.id)

            return (
              <fieldset key={row.id} className={styles['row']}>
                <legend className={styles['rowName']}>
                  {stockRowNameOf(row, product)}
                </legend>
                <div className={styles['amounts']}>
                  <TextField
                    label='数量'
                    name={quantity}
                    inputMode='decimal'
                    autoComplete='off'
                    defaultValue={starting.quantities[row.id]}
                    description={`在庫数 ${quantityNameOf(row.currentStock, product)}`}
                    error={errors[quantity]}
                  />
                  <TextField
                    label='単価（円）'
                    name={unitPrice}
                    inputMode='numeric'
                    autoComplete='off'
                    defaultValue={priceOf(product)}
                    error={errors[unitPrice]}
                  />
                </div>
              </fieldset>
            )
          })}
          <p className={styles['subtotal']}>
            {`小計 ${amountOf(subtotal, salon.currency)}`}
          </p>
        </div>
      </fieldset>
      <TextField
        label='税額（円）'
        name='taxAmount'
        inputMode='numeric'
        autoComplete='off'
        description={`仕入先の請求に合わせて入力します。小計の ${salon.taxRate}% は ${amountOf(taxAt(subtotal, salon.taxRate), salon.currency)} です（円未満切り捨て）。`}
        error={errors['taxAmount']}
      />
      <TextField
        label='送料（円）'
        name='shippingCost'
        inputMode='numeric'
        autoComplete='off'
        description='任意。送料がかからなければ空のままにします。'
        error={errors['shippingCost']}
      />
      <TextField
        label='納品予定日'
        name='expectedDelivery'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        description='任意。仕入先が約束した日。'
        error={errors['expectedDelivery']}
      />
      <TextField
        label='支払条件'
        name='paymentTerms'
        autoComplete='off'
        description='任意。月末締め翌月末払い、など。'
        error={errors['paymentTerms']}
      />
      <TextArea
        label='メモ'
        name='notes'
        rows={3}
        description='任意。仕入先への連絡や、届いたあとのことなど。'
        error={errors['notes']}
      />
    </Form>
  )
}
