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
import { salonScreenMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { ReactNode } from 'react'
import { type Period, periodQueryOf } from '../../utils/period'

const { period: words } = salonScreenMessages

export type StatisticsPeriodProps = {
  /** The period that is shown: that of the address */
  period: Period
  /** What is said of the period: how long it may be, or what is counted over it */
  description: string
  /**
   * What is wrong with the values that were sent, under the names of the
   * controls (`readPeriod`, `readDays`): the component says it in the
   * language of the page
   */
  errors?: FormErrors<LocalizedText> | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
  /** Further controls of what is counted, after the days: what the period is cut into */
  children?: ReactNode
}

/**
 * The days that something is counted over, both ends counted: what a
 * customer did at the salon, or the treatment records the salon wrote.
 * Like the filters of the ledgers, it mirrors the address: when that
 * changes under it, the controls show the other days. The days are in
 * sight on every screen; what the period is cut into is one of the other
 * conditions, in the sheet of a narrow screen.
 */
export const StatisticsPeriod = ({
  period,
  description,
  errors = NO_ERRORS,
  onSubmit,
  children,
}: StatisticsPeriodProps) => {
  const say = useSay()
  const said = useSaidForm(undefined, errors)
  const [values, hold] = useFilterValues(
    periodQueryOf(period).toString(),
    () => period,
  )

  return (
    <FilterForm
      label={say(words.label)}
      purpose='count'
      conditions={children}
      errors={errors}
      onSubmit={onSubmit}
    >
      <TextField
        label={say(words.from)}
        name='from'
        autoComplete='off'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        required
        value={values.from}
        error={said.errors['from']}
        onChange={(event) => hold('from', event.target.value)}
      />
      <TextField
        label={say(words.to)}
        name='to'
        autoComplete='off'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        required
        description={description}
        value={values.to}
        error={said.errors['to']}
        onChange={(event) => hold('to', event.target.value)}
      />
    </FilterForm>
  )
}
