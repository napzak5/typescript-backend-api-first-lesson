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
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ChartConditions } from '../../api/charts-api'
import { ALLERGY_CHOICES, chartQueryOf } from '../../utils/chart-search'

const { search: SEARCH } = adminChartMessages

export type ChartFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: ChartConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors<LocalizedText> | undefined
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
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(undefined, errors)
  const [values, hold] = useFilterValues(
    chartQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label={say(SEARCH.label)}
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <Select
          label={say(SEARCH.allergies)}
          name='allergies'
          options={options(ALLERGY_CHOICES)}
          placeholder={say(SEARCH.all)}
          value={values.allergies}
          onChange={(event) => hold('allergies', event.target.value)}
        />
      }
    >
      <TextField
        label={say(SEARCH.keyword)}
        name='search'
        autoComplete='off'
        type='search'
        description={say(SEARCH.keywordDescription)}
        value={values.search}
        error={said.errors['search']}
        onChange={(event) => hold('search', event.target.value)}
      />
    </FilterForm>
  )
}
