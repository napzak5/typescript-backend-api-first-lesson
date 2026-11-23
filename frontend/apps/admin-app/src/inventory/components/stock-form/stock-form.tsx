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
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useState } from 'react'
import { LONGEST_LOT } from '../../utils/lot-number'
import {
  LONGEST_LOCATION,
  LONGEST_SHELF,
  showsLot,
} from '../../utils/stock-form'
import { productNameOf, productOf } from '../../utils/stock-format'
import styles from './stock-form.module.css'

const { errors: refusals, form: words } = adminInventoryMessages

export type StockFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** The row the form opens with; `null` for a new one, whose product is chosen */
  row: ModelsInventoryResponse | null
  /**
   * The products a new row may be of, in the order of their codes; for a
   * row, the products of the salon, among which its own is looked for
   */
  products: readonly ModelsProductResponse[]
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

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
  message,
  errors = NO_ERRORS,
  ...form
}: StockFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const [chosen, setChosen] = useState('')
  const product = productOf(products, row?.productId ?? chosen)
  const tracked = product?.requiresLotTracking === true

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart
        label={say(words.part)}
        description={row === null ? say(words.newDescription) : undefined}
      >
        {row === null ? (
          <Select
            label={say(words.product)}
            name='productId'
            required
            placeholder={say(words.choose)}
            options={products.map((choice) => ({
              value: choice.id,
              label: say(productNameOf(choice)),
            }))}
            description={say(words.productDescription)}
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            error={said.errors['productId']}
          />
        ) : (
          <dl className={styles['product']}>
            <dt className={styles['term']}>{say(words.product)}</dt>
            <dd>{say(productNameOf(product))}</dd>
          </dl>
        )}
        {showsLot(row, product) && (
          <TextField
            label={say(words.lot)}
            name='lotNumber'
            autoComplete='off'
            required={tracked}
            description={say(
              tracked ? words.lotDescription(LONGEST_LOT) : refusals.lotNotKept,
            )}
            defaultValue={row?.lotNumber ?? undefined}
            error={said.errors['lotNumber']}
          />
        )}
        <TextField
          width='short'
          label={say(words.expiry)}
          name='expiryDate'
          type='date'
          autoComplete='off'
          min={EARLIEST_DAY}
          max={LATEST_DAY}
          description={say(words.expiryDescription)}
          defaultValue={row?.expiryDate ?? undefined}
          error={said.errors['expiryDate']}
        />
        <FieldRow>
          <TextField
            label={say(words.location)}
            name='location'
            autoComplete='off'
            description={say(upTo(LONGEST_LOCATION))}
            defaultValue={row?.location ?? undefined}
            error={said.errors['location']}
          />
          <TextField
            label={say(words.shelf)}
            name='shelf'
            autoComplete='off'
            description={say(upTo(LONGEST_SHELF))}
            defaultValue={row?.shelf ?? undefined}
            error={said.errors['shelf']}
          />
        </FieldRow>
        <TextArea
          label={say(words.notes)}
          name='notes'
          defaultValue={row?.notes ?? undefined}
          error={said.errors['notes']}
        />
      </FormPart>
    </Form>
  )
}
