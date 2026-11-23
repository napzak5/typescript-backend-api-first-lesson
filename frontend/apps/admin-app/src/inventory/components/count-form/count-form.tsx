import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { countedControlOf } from '../../utils/stock-count'
import {
  placeNameOf,
  productOf,
  quantityNameOf,
  stockRowNameOf,
} from '../../utils/stock-format'

const { form: words } = adminInventoryMessages.count

export type CountFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** The rows of the salon, in the order they are counted; at least one */
  rows: readonly ModelsInventoryResponse[]
  /** The products of the salon, which name the rows */
  products: readonly ModelsProductResponse[]
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

/** What the books say of a row: its stock and what of it is reserved, and where it is kept. */
const booksOf = (
  row: ModelsInventoryResponse,
  product: ModelsProductResponse | undefined,
): LocalizedText =>
  words.books(
    quantityNameOf(row.currentStock, product),
    row.reservedStock > 0 ? quantityNameOf(row.reservedStock, product) : null,
    placeNameOf(row),
  )

/**
 * A count of the stock: what was counted of each row, named by its product
 * and its lot, with what the books say of it; and why the books are set
 * to what was counted. A row left empty is not counted.
 */
export const CountForm = ({
  rows,
  products,
  message,
  errors = NO_ERRORS,
  ...form
}: CountFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart label={say(words.part)} description={say(words.description)}>
        {rows.map((row) => {
          const product = productOf(products, row.productId)
          const control = countedControlOf(row.id)

          return (
            <TextField
              width='short'
              key={row.id}
              label={say(stockRowNameOf(row, product))}
              name={control}
              inputMode='decimal'
              autoComplete='off'
              description={say(booksOf(row, product))}
              error={said.errors[control]}
            />
          )
        })}
        <TextArea
          label={say(words.reason)}
          name='reason'
          description={say(words.reasonDescription)}
          error={said.errors['reason']}
        />
      </FormPart>
    </Form>
  )
}
