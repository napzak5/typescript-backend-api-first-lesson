import type { ModelsProductResponse } from '@beauty-salon-frontend/api-client'
import {
  countNarrowing,
  FilterForm,
  type FormErrors,
  NO_ERRORS,
  Select,
  TextField,
  useFilterValues,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { EXPIRY_CHOICES, productChoicesOf } from '../../utils/stock-format'
import { type StockView, stockQueryOf } from '../../utils/stock-view'

const { filter: words } = adminInventoryMessages

export type StockFilterProps = {
  /** The view that is shown, from the address: every row, or the rows that expire soon */
  view: Exclude<StockView, { type: 'lowStock' }>
  /** The products of the salon, to narrow every row to one of them */
  products: readonly ModelsProductResponse[]
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors<LocalizedText> | undefined
  /** The address of every row, when the conditions narrow them */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under their names */
type Values = { productId: string; lotNumber: string; days: string }

const valuesOf = (view: StockFilterProps['view']): Values =>
  view.type === 'all'
    ? {
        productId: view.productId ?? '',
        lotNumber: view.lotNumber ?? '',
        days: '30',
      }
    : { productId: '', lotNumber: '', days: String(view.days) }

/** The conditions of every row, in the sheet: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['productId', 'lotNumber']

/**
 * Which rows the view shows: every row may be narrowed to a product and a
 * lot, and the rows that expire soon are those of a window of days. Like
 * the filter of the products, it mirrors the address: when that changes
 * under it, the controls show the other view.
 */
export const StockFilter = ({
  view,
  products,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: StockFilterProps) => {
  const say = useSay()
  const said = useSaidForm(undefined, errors)
  const options = useSaidChoices()
  const [values, hold] = useFilterValues(stockQueryOf(view).toString(), () =>
    valuesOf(view),
  )

  return view.type === 'all' ? (
    <FilterForm
      label={say(words.label)}
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(view), COUNTED)}
      conditions={
        <>
          <Select
            label={say(words.product)}
            name='productId'
            options={options(productChoicesOf(products, view.productId))}
            placeholder={say(words.all)}
            value={values.productId}
            onChange={(event) => hold('productId', event.target.value)}
          />
          <TextField
            label={say(words.lot)}
            name='lotNumber'
            autoComplete='off'
            description={say(words.lotDescription)}
            value={values.lotNumber}
            error={said.errors['lotNumber']}
            onChange={(event) => hold('lotNumber', event.target.value)}
          />
        </>
      }
    />
  ) : (
    <FilterForm
      label={say(words.expiryLabel)}
      purpose='view'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
    >
      <Select
        label={say(words.expiry)}
        name='days'
        options={options(EXPIRY_CHOICES)}
        description={say(words.expiryDescription)}
        value={values.days}
        onChange={(event) => hold('days', event.target.value)}
      />
    </FilterForm>
  )
}
