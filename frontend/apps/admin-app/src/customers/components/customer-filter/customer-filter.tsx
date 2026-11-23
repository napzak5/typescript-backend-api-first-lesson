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
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { STATUS_CHOICES, TIER_CHOICES } from '../../utils/customer-format'
import {
  type CustomerConditions,
  customerQueryOf,
  tagsTextOf,
} from '../../utils/customer-ledger'

const { filter: words } = adminCustomerMessages

export type CustomerFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: CustomerConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors<LocalizedText> | undefined
  /** The address of the whole ledger, when the conditions narrow it */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<keyof CustomerConditions, string>

const valuesOf = (
  conditions: CustomerConditions,
  say: (message: LocalizedText) => string,
): Values => ({
  search: conditions.search ?? '',
  tags: say(tagsTextOf(conditions.tags)),
  from: conditions.from ?? '',
  to: conditions.to ?? '',
  customerStatus: conditions.customerStatus ?? '',
  membershipTier: conditions.membershipTier ?? '',
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof Values)[] = [
  'tags',
  'from',
  'to',
  'customerStatus',
  'membershipTier',
]

/**
 * Which customers the ledger shows: a keyword, tags, the days they were
 * registered on, their state and their rank. The names of its controls
 * are the names of the conditions, and it mirrors the address.
 */
export const CustomerFilter = ({
  conditions,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: CustomerFilterProps) => {
  const say = useSay()
  const said = useSaidForm(undefined, errors)
  const options = useSaidChoices()
  const [values, hold] = useFilterValues(
    customerQueryOf(conditions).toString(),
    () => valuesOf(conditions, say),
  )

  return (
    <FilterForm
      label={say(words.label)}
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions, say), COUNTED)}
      conditions={
        <>
          <TextField
            label={say(words.tags)}
            name='tags'
            autoComplete='off'
            description={say(words.tagsDescription)}
            value={values.tags}
            error={said.errors['tags']}
            onChange={(event) => hold('tags', event.target.value)}
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
          <Select
            label={say(words.status)}
            name='customerStatus'
            options={options(STATUS_CHOICES)}
            placeholder={say(words.all)}
            value={values.customerStatus}
            onChange={(event) => hold('customerStatus', event.target.value)}
          />
          <Select
            label={say(words.tier)}
            name='membershipTier'
            options={options(TIER_CHOICES)}
            placeholder={say(words.all)}
            value={values.membershipTier}
            onChange={(event) => hold('membershipTier', event.target.value)}
          />
        </>
      }
    >
      <TextField
        label={say(words.keyword)}
        name='search'
        autoComplete='off'
        type='search'
        description={say(words.keywordDescription)}
        value={values.search}
        error={said.errors['search']}
        onChange={(event) => hold('search', event.target.value)}
      />
    </FilterForm>
  )
}
