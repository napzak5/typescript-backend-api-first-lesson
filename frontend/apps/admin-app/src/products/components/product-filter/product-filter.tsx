import {
  countNarrowing,
  FilterForm,
  type FormErrors,
  NO_ERRORS,
  Select,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import { CARRIED_OPTIONS, USE_OPTIONS } from '../../product-format'
import { type ProductConditions, productQueryOf } from '../../product-ledger'

export type ProductFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: ProductConditions
  /** The categories of the products of the salon, to choose from, in their order */
  categories: readonly string[]
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of the whole ledger, when the conditions narrow it */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<keyof ProductConditions, string>

const valuesOf = (conditions: ProductConditions): Values => ({
  keyword: conditions.keyword ?? '',
  barcode: conditions.barcode ?? '',
  category: conditions.category ?? '',
  carried: conditions.carried ?? '',
  use: conditions.use ?? '',
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = [
  'barcode',
  'category',
  'carried',
  'use',
]

/**
 * Which products the ledger shows: a keyword, a barcode, a category,
 * whether the salon still carries them and what they are for. The names
 * of its controls are the names of the conditions. Like the filter of the
 * customers, it mirrors the address: when that changes under it, the
 * controls show the other conditions.
 */
export const ProductFilter = ({
  conditions,
  categories,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: ProductFilterProps) => {
  const [values, hold] = useFilterValues(
    productQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label='商品を探す'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <TextField
            label='バーコード'
            name='barcode'
            inputMode='numeric'
            autoComplete='off'
            description='バーコードのすべて。読み取り機で入力できます。'
            value={values.barcode}
            error={errors['barcode']}
            onChange={(event) => hold('barcode', event.target.value)}
          />
          <Select
            label='カテゴリー'
            name='category'
            options={categories.map((category) => ({
              value: category,
              label: category,
            }))}
            placeholder='すべて'
            value={values.category}
            onChange={(event) => hold('category', event.target.value)}
          />
          <Select
            label='取り扱い'
            name='carried'
            options={CARRIED_OPTIONS}
            placeholder='すべて'
            value={values.carried}
            onChange={(event) => hold('carried', event.target.value)}
          />
          <Select
            label='用途'
            name='use'
            options={USE_OPTIONS}
            placeholder='すべて'
            value={values.use}
            onChange={(event) => hold('use', event.target.value)}
          />
        </>
      }
    >
      <TextField
        label='キーワード'
        name='keyword'
        autoComplete='off'
        type='search'
        description='商品名、商品コード、ブランドの一部。'
        value={values.keyword}
        error={errors['keyword']}
        onChange={(event) => hold('keyword', event.target.value)}
      />
    </FilterForm>
  )
}
