import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  FilterForm,
  type FormErrors,
  NO_ERRORS,
  TextField,
  useFilterValues,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'

const { daily: words } = dashboardReportMessages

export type DayChoiceProps = {
  /** The day that is shown: that of the address */
  day: string
  /** What is wrong with the day that was sent (`readDay`): the component says it in the language of the page */
  errors?: FormErrors<LocalizedText> | undefined
  /** Called with the values of the form when it is sent */
  onSubmit: (values: FormData) => void
}

/**
 * The day whose sales are shown. Like the period of the reports, it
 * mirrors the address: when that changes under it (the day before or
 * after), the field shows the other day.
 */
export const DayChoice = ({
  day,
  errors = NO_ERRORS,
  onSubmit,
}: DayChoiceProps) => {
  const say = useSay()
  const said = useSaidForm(undefined, errors)
  const [values, hold] = useFilterValues(day, () => ({ date: day }))

  return (
    <FilterForm
      label={say(words.choice)}
      purpose='view'
      errors={errors}
      onSubmit={onSubmit}
    >
      <TextField
        label={say(words.day)}
        name='date'
        autoComplete='off'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        required
        description={say(words.dayDescription)}
        value={values.date}
        error={said.errors['date']}
        onChange={(event) => hold('date', event.target.value)}
      />
    </FilterForm>
  )
}
