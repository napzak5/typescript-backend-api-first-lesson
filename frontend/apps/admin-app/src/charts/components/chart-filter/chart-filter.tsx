import {
  countNarrowing,
  FilterForm,
  type FormErrors,
  Select,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import { ALLERGY_OPTIONS, chartQueryOf } from '../../chart-search'
import type { ChartConditions } from '../../charts-api'

export type ChartFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: ChartConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of every chart, when the conditions narrow them */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

type Values = Record<keyof ChartConditions, string>

const valuesOf = (conditions: ChartConditions): Values => ({
  search: conditions.search ?? '',
  allergies: conditions.allergies ?? '',
})

const NO_ERRORS: FormErrors = {}

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['allergies']

/**
 * Which charts the search shows: a keyword, and whether the customer has
 * allergies recorded. The names of its controls are the names of the
 * conditions. Like the filter of the customers, it mirrors the address:
 * when that changes under it, the controls show the other conditions.
 */
export const ChartFilter = ({
  conditions,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: ChartFilterProps) => {
  const [values, hold] = useFilterValues(
    chartQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label='カルテを探す'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <Select
          label='アレルギーの記録'
          name='allergies'
          options={ALLERGY_OPTIONS}
          placeholder='すべて'
          value={values.allergies}
          onChange={(event) => hold('allergies', event.target.value)}
        />
      }
    >
      <TextField
        label='キーワード'
        name='search'
        type='search'
        description='持病や体調、メモ、好みの商材と避ける商材の名前の一部。'
        value={values.search}
        error={errors['search']}
        onChange={(event) => hold('search', event.target.value)}
      />
    </FilterForm>
  )
}
