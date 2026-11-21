import {
  countNarrowing,
  FilterForm,
  type FormErrors,
  Select,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import { paymentStatusNameOf } from '../../sale-format'
import {
  type LedgerConditions,
  ledgerQueryOf,
  PAYMENT_STATUSES,
} from '../../sales-ledger'

export type LedgerFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: LedgerConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of today's sales, when the conditions are other */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

const STATUS_OPTIONS = PAYMENT_STATUSES.map((status) => ({
  value: status,
  label: paymentStatusNameOf(status),
}))

/** What the controls hold, under the names of the conditions */
type Values = Record<keyof LedgerConditions, string>

const valuesOf = (conditions: LedgerConditions): Values => ({
  from: conditions.from,
  to: conditions.to,
  paymentStatus: conditions.paymentStatus ?? '',
})

const NO_ERRORS: FormErrors = {}

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['paymentStatus']

/**
 * Which sales the ledger shows: the days they were entered on, and how far
 * they were paid. The names of its controls are the names of the
 * conditions. Like the filter of the bookings, it mirrors the address:
 * when that changes under it, the controls show the other conditions.
 */
export const LedgerFilter = ({
  conditions,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: LedgerFilterProps) => {
  const [values, hold] = useFilterValues(
    ledgerQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label='売上を絞り込む'
      purpose='view'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <Select
          label='支払い'
          name='paymentStatus'
          options={STATUS_OPTIONS}
          placeholder='すべて'
          value={values.paymentStatus}
          onChange={(event) => hold('paymentStatus', event.target.value)}
        />
      }
    >
      <TextField
        label='会計日（から）'
        name='from'
        type='date'
        min='1900-01-01'
        max='2999-12-31'
        required
        value={values.from}
        error={errors['from']}
        onChange={(event) => hold('from', event.target.value)}
      />
      <TextField
        label='会計日（まで）'
        name='to'
        type='date'
        min='1900-01-01'
        max='2999-12-31'
        required
        value={values.to}
        error={errors['to']}
        onChange={(event) => hold('to', event.target.value)}
      />
    </FilterForm>
  )
}
