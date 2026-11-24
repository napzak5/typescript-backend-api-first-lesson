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
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { ORDER_STATUS_CHOICES } from '../../utils/order-format'
import { type OrderConditions, orderQueryOf } from '../../utils/order-search'

const { filter: WORDS, words } = adminPurchaseOrderMessages

export type OrderFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: OrderConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors<LocalizedText> | undefined
  /** The address of every order, when the conditions narrow the list */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<'status' | 'supplier' | 'from' | 'to', string>

const valuesOf = ({ status, supplier, from, to }: OrderConditions): Values => ({
  status: status ?? '',
  supplier: supplier ?? '',
  from: from ?? '',
  to: to ?? '',
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['status', 'supplier', 'from', 'to']

/**
 * Which purchase orders the list shows: their status, their supplier, and
 * the days they were made on. Like the filter of the treatment records, it
 * mirrors the address.
 */
export const OrderFilter = ({
  conditions,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: OrderFilterProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(undefined, errors)
  const [values, hold] = useFilterValues(
    orderQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label={say(WORDS.label)}
      purpose='view'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <Select
            label={say(words.status)}
            name='status'
            options={options(ORDER_STATUS_CHOICES)}
            placeholder={say(WORDS.all)}
            value={values.status}
            onChange={(event) => hold('status', event.target.value)}
          />
          <TextField
            label={say(words.supplier)}
            name='supplier'
            autoComplete='off'
            description={say(WORDS.supplierDescription)}
            value={values.supplier}
            error={said.errors['supplier']}
            onChange={(event) => hold('supplier', event.target.value)}
          />
          <TextField
            label={say(WORDS.from)}
            name='from'
            autoComplete='off'
            type='date'
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            value={values.from}
            error={said.errors['from']}
            onChange={(event) => hold('from', event.target.value)}
          />
          <TextField
            label={say(WORDS.to)}
            name='to'
            autoComplete='off'
            type='date'
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            value={values.to}
            error={said.errors['to']}
            onChange={(event) => hold('to', event.target.value)}
          />
        </>
      }
    />
  )
}
