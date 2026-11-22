import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY, upTo } from '@beauty-salon-frontend/fields'
import {
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useState } from 'react'
import { LONGEST_LOT } from '../../lot-number'
import { LONGEST_LOCATION, LONGEST_SHELF, showsLot } from '../../stock-form'
import { productOf, REMOVED_PRODUCT } from '../../stock-format'
import styles from './stock-form.module.css'

export type StockFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The row the form opens with; `null` for a new one, whose product is chosen */
  row: ModelsInventoryResponse | null
  /**
   * The products a new row may be of, in the order of their codes; for a
   * row, the products of the salon, among which its own is looked for
   */
  products: readonly ModelsProductResponse[]
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
}

const LOT_KEPT = `${upTo(LONGEST_LOT)}この商品のほかの在庫の行と同じロット番号は使えません。`
const LOT_TO_CLEAR =
  'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。'

/**
 * A stock row: the product it is of and its lot, its expiry, and where it
 * is kept. The product of a new row is chosen; the lot is asked for when
 * that product is kept by lots. The product of a row stays what it is,
 * and its lot can be cleared when the product is no longer kept by lots.
 * How much there is is not written here: a new row counts nothing.
 */
export const StockForm = ({
  row,
  products,
  errors = NO_ERRORS,
  ...form
}: StockFormProps) => {
  const [chosen, setChosen] = useState('')
  const product = productOf(products, row?.productId ?? chosen)
  const tracked = product?.requiresLotTracking === true

  return (
    <Form {...form} errors={errors}>
      <FormPart
        label='在庫の行'
        description={
          row === null
            ? '在庫数 0 の行として足します。在庫数は、入庫と棚卸しで変わります。'
            : undefined
        }
      >
        {row === null ? (
          <Select
            label='商品'
            name='productId'
            required
            placeholder='選んでください'
            options={products.map(({ id, name, productCode }) => ({
              value: id,
              label: `${name}（${productCode}）`,
            }))}
            description='取り扱い中の商品です。ロット番号で分ける商品を選ぶと、ロット番号を入力します。'
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            error={errors['productId']}
          />
        ) : (
          <dl className={styles['product']}>
            <dt className={styles['term']}>商品</dt>
            <dd>
              {product === undefined
                ? REMOVED_PRODUCT
                : `${product.name}（${product.productCode}）`}
            </dd>
          </dl>
        )}
        {showsLot(row, product) && (
          <TextField
            label='ロット番号'
            name='lotNumber'
            autoComplete='off'
            required={tracked}
            description={tracked ? LOT_KEPT : LOT_TO_CLEAR}
            defaultValue={row?.lotNumber ?? undefined}
            error={errors['lotNumber']}
          />
        )}
        <TextField
          width='short'
          label='使用期限'
          name='expiryDate'
          type='date'
          autoComplete='off'
          min={EARLIEST_DAY}
          max={LATEST_DAY}
          description='使用期限のないものは、空にします。'
          defaultValue={row?.expiryDate ?? undefined}
          error={errors['expiryDate']}
        />
        <FieldRow>
          <TextField
            label='保管場所'
            name='location'
            autoComplete='off'
            description={upTo(LONGEST_LOCATION)}
            defaultValue={row?.location ?? undefined}
            error={errors['location']}
          />
          <TextField
            label='棚'
            name='shelf'
            autoComplete='off'
            description={upTo(LONGEST_SHELF)}
            defaultValue={row?.shelf ?? undefined}
            error={errors['shelf']}
          />
        </FieldRow>
        <TextArea
          label='メモ'
          name='notes'
          defaultValue={row?.notes ?? undefined}
          error={errors['notes']}
        />
      </FormPart>
    </Form>
  )
}
