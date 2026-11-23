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
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { MOVEMENT_TYPE_CHOICES } from '../../utils/movement-format'
import {
  type MovementConditions,
  movementQueryOf,
} from '../../utils/movement-search'

const { filter: words } = adminInventoryMessages.movements

export type MovementFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: MovementConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors<LocalizedText> | undefined
  /** The address of every movement, when the conditions narrow them */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<'type' | 'from' | 'to', string>

const valuesOf = ({ type, from, to }: MovementConditions): Values => ({
  type: type ?? '',
  from: from ?? '',
  to: to ?? '',
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = ['type', 'from', 'to']

/**
 * Which movements of a row the history shows: their kind, and the days
 * they were recorded on, at the salon. Like the filter of the treatment
 * records, it mirrors the address.
 */
export const MovementFilter = ({
  conditions,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: MovementFilterProps) => {
  const say = useSay()
  const said = useSaidForm(undefined, errors)
  const options = useSaidChoices()
  const [values, hold] = useFilterValues(
    movementQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label={say(words.label)}
      purpose='view'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <Select
            label={say(words.kind)}
            name='type'
            options={options(MOVEMENT_TYPE_CHOICES)}
            placeholder={say(words.all)}
            value={values.type}
            onChange={(event) => hold('type', event.target.value)}
          />
          <TextField
            label={say(words.from)}
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
            label={say(words.to)}
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
