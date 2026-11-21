import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  countNarrowing,
  FilterForm,
  Select,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import { type DayConditions, queryOf, STATUSES } from '../../booking-day'
import { statusNameOf } from '../../booking-format'

export type BookingFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: DayConditions
  /** The members of the staff to choose from */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** The address of the whole day, when the conditions narrow it */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

const STATUS_OPTIONS = STATUSES.map((status) => ({
  value: status,
  label: statusNameOf(status),
}))

/** What the controls hold, under the names of the conditions */
type Values = Record<keyof DayConditions, string>

const valuesOf = (conditions: DayConditions): Values => ({
  date: conditions.date,
  status: conditions.status ?? '',
  staffId: conditions.staffId ?? '',
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['status', 'staffId']

/**
 * Which bookings the list shows: a day, a state, a member of the staff.
 * The names of its controls are the names of the conditions. Like the
 * search of salons, it mirrors the address: when that changes under it,
 * the controls show the other conditions.
 */
export const BookingFilter = ({
  conditions,
  staff,
  clearHref,
  onSubmit,
}: BookingFilterProps) => {
  const [values, hold] = useFilterValues(queryOf(conditions).toString(), () =>
    valuesOf(conditions),
  )

  return (
    <FilterForm
      label='予約を絞り込む'
      purpose='view'
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <Select
            label='状態'
            name='status'
            options={STATUS_OPTIONS}
            placeholder='すべて'
            value={values.status}
            onChange={(event) => hold('status', event.target.value)}
          />
          <Select
            label='担当'
            name='staffId'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder='すべて'
            value={values.staffId}
            onChange={(event) => hold('staffId', event.target.value)}
          />
        </>
      }
    >
      <TextField
        label='日付'
        name='date'
        autoComplete='off'
        type='date'
        min='1900-01-01'
        max='2999-12-31'
        value={values.date}
        onChange={(event) => hold('date', event.target.value)}
      />
    </FilterForm>
  )
}
