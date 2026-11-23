import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
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
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { paymentStatusNameOf } from '../../utils/sale-format'
import {
  type LedgerConditions,
  ledgerQueryOf,
  PAYMENT_STATUSES,
} from '../../utils/sales-ledger'

export type LedgerFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: LedgerConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors<LocalizedText> | undefined
  /** The address of today's sales, when the conditions are other */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

const { ledger, words } = adminSaleMessages

const STATUS_CHOICES = PAYMENT_STATUSES.map((status) => ({
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
  const say = useSay()
  const said = useSaidForm(undefined, errors)
  const options = useSaidChoices()
  const [values, hold] = useFilterValues(
    ledgerQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label={say(ledger.filter)}
      purpose='view'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <Select
          label={say(words.payment)}
          name='paymentStatus'
          options={options(STATUS_CHOICES)}
          placeholder={say(ledger.all)}
          value={values.paymentStatus}
          onChange={(event) => hold('paymentStatus', event.target.value)}
        />
      }
    >
      <TextField
        label={say(ledger.from)}
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
        label={say(ledger.to)}
        name='to'
        autoComplete='off'
        type='date'
        min={EARLIEST_DAY}
        max={LATEST_DAY}
        required
        value={values.to}
        error={said.errors['to']}
        onChange={(event) => hold('to', event.target.value)}
      />
    </FilterForm>
  )
}
