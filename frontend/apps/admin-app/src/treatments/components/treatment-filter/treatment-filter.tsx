import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  countNarrowing,
  FilterForm,
  type FormErrors,
  Link,
  NO_ERRORS,
  Select,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import type { TreatmentConditions } from '../../api/treatments-api'
import { treatmentQueryOf } from '../../utils/treatment-search'
import styles from './treatment-filter.module.css'

export type TreatmentFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: TreatmentConditions
  /** The members of the staff of the salon */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /**
   * The customer of the conditions, by name: 「山田 花子 様」; 「このお客様」
   * while the name is not known. The list was opened from the ledger for them
   */
  customerName?: string | undefined
  /** The address of the same conditions without the customer */
  withoutCustomerHref?: string | undefined
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of every record, when the conditions narrow the list */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<'staff' | 'from' | 'to', string>

const valuesOf = ({ staff, from, to }: TreatmentConditions): Values => ({
  staff: staff ?? '',
  from: from ?? '',
  to: to ?? '',
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['staff', 'from', 'to']

/**
 * Which treatment records the list shows: the member of the staff who did
 * the treatment, and the days the record was written on. The customer is
 * no control: the list is opened for one from the ledger, and the filter
 * names them, keeps them, and leads to the same conditions without them.
 * Like the filter of the sales, it mirrors the address.
 */
export const TreatmentFilter = ({
  conditions,
  staff,
  customerName,
  withoutCustomerHref,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: TreatmentFilterProps) => {
  const [values, hold] = useFilterValues(
    treatmentQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label='施術記録を絞り込む'
      purpose='view'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <Select
            label='担当'
            name='staff'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder='すべて'
            value={values.staff}
            onChange={(event) => hold('staff', event.target.value)}
          />
          <TextField
            label='書いた日（から）'
            name='from'
            autoComplete='off'
            type='date'
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            value={values.from}
            error={errors['from']}
            onChange={(event) => hold('from', event.target.value)}
          />
          <TextField
            label='書いた日（まで）'
            name='to'
            autoComplete='off'
            type='date'
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            value={values.to}
            error={errors['to']}
            onChange={(event) => hold('to', event.target.value)}
          />
        </>
      }
    >
      {conditions.customer === undefined ? undefined : (
        <p className={styles['customer']}>
          <span>{`お客様：${customerName ?? 'このお客様'}`}</span>
          {withoutCustomerHref === undefined ? null : (
            <Link href={withoutCustomerHref}>すべてのお客様にする</Link>
          )}
          <input type='hidden' name='customer' value={conditions.customer} />
        </p>
      )}
    </FilterForm>
  )
}
