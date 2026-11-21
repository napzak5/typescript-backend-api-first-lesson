import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/salon-screens'
import {
  FilterForm,
  type FormErrors,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'

export type DayChoiceProps = {
  /** The day that is shown: that of the address */
  day: string
  /** What is wrong with the day that was sent */
  errors?: FormErrors | undefined
  /** Called with the values of the form when it is sent */
  onSubmit: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

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
  const [values, hold] = useFilterValues(day, () => ({ date: day }))

  return (
    <FilterForm
      label='売上を見る日'
      purpose='view'
      errors={errors}
      onSubmit={onSubmit}
    >
      <TextField
        label='日付'
        name='date'
        autoComplete='off'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        required
        description='会計した日（サロンの日付）で数えます。'
        value={values.date}
        error={errors['date']}
        onChange={(event) => hold('date', event.target.value)}
      />
    </FilterForm>
  )
}
