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
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { CARRIED_CHOICES, USE_CHOICES } from '../../utils/product-format'
import {
  type ProductConditions,
  productQueryOf,
} from '../../utils/product-ledger'

const { filter: WORDS, words } = adminProductMessages

export type ProductFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: ProductConditions
  /** The categories of the products of the salon, to choose from, in their order */
  categories: readonly string[]
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors<LocalizedText> | undefined
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
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(undefined, errors)
  const [values, hold] = useFilterValues(
    productQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label={say(WORDS.label)}
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <TextField
            label={say(words.barcode)}
            name='barcode'
            inputMode='numeric'
            autoComplete='off'
            description={say(WORDS.barcodeDescription)}
            value={values.barcode}
            error={said.errors['barcode']}
            onChange={(event) => hold('barcode', event.target.value)}
          />
          <Select
            label={say(words.category)}
            name='category'
            options={categories.map((category) => ({
              value: category,
              label: category,
            }))}
            placeholder={say(WORDS.all)}
            value={values.category}
            onChange={(event) => hold('category', event.target.value)}
          />
          <Select
            label={say(WORDS.carried)}
            name='carried'
            options={options(CARRIED_CHOICES)}
            placeholder={say(WORDS.all)}
            value={values.carried}
            onChange={(event) => hold('carried', event.target.value)}
          />
          <Select
            label={say(words.uses)}
            name='use'
            options={options(USE_CHOICES)}
            placeholder={say(WORDS.all)}
            value={values.use}
            onChange={(event) => hold('use', event.target.value)}
          />
        </>
      }
    >
      <TextField
        label={say(WORDS.keyword)}
        name='keyword'
        autoComplete='off'
        type='search'
        description={say(WORDS.keywordDescription)}
        value={values.keyword}
        error={said.errors['keyword']}
        onChange={(event) => hold('keyword', event.target.value)}
      />
    </FilterForm>
  )
}
