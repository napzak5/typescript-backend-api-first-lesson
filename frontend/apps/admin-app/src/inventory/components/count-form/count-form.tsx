import type {
  ModelsInventoryResponse,
  ModelsProductResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { countedControlOf } from '../../stock-count'
import {
  placeNameOf,
  productOf,
  quantityNameOf,
  stockRowNameOf,
} from '../../stock-format'

export type CountFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The rows of the salon, in the order they are counted; at least one */
  rows: readonly ModelsInventoryResponse[]
  /** The products of the salon, which name the rows */
  products: readonly ModelsProductResponse[]
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
}

const NO_ERRORS: FormErrors = {}

/** What the books say of a row: its stock and what of it is reserved, and where it is kept. */
const booksOf = (
  row: ModelsInventoryResponse,
  product: ModelsProductResponse | undefined,
): string => {
  const reserved =
    row.reservedStock > 0
      ? `（うち引き当て ${quantityNameOf(row.reservedStock, product)}）`
      : ''
  const place =
    row.location === null && row.shelf === null
      ? ''
      : `、保管場所 ${placeNameOf(row)}`

  return `帳簿の在庫数 ${quantityNameOf(row.currentStock, product)}${reserved}${place}`
}

/**
 * A count of the stock: what was counted of each row, named by its product
 * and its lot, with what the books say of it; and why the books are set
 * to what was counted. A row left empty is not counted.
 */
export const CountForm = ({
  rows,
  products,
  errors = NO_ERRORS,
  ...form
}: CountFormProps) => (
  <Form {...form} errors={errors}>
    <FormPart
      label='数えた数'
      description='数えた行に、数えた数を入力します。空のままの行は数えず、在庫数も変わりません。小数は 2 桁まで。'
    >
      {rows.map((row) => {
        const product = productOf(products, row.productId)
        const control = countedControlOf(row.id)

        return (
          <TextField
            key={row.id}
            label={stockRowNameOf(row, product)}
            name={control}
            inputMode='decimal'
            autoComplete='off'
            description={booksOf(row, product)}
            error={errors[control]}
          />
        )
      })}
      <TextArea
        label='理由'
        name='reason'
        description='任意。帳簿の在庫数との差を直す、在庫の調整の理由になります。空のときは「棚卸しの差異」と記録します。'
        error={errors['reason']}
      />
    </FormPart>
  </Form>
)
