import {
  countNarrowing,
  FilterForm,
  type FormErrors,
  NO_ERRORS,
  Select,
  TextField,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import { STATUS_OPTIONS, TIER_OPTIONS } from '../../customer-format'
import {
  type CustomerConditions,
  customerQueryOf,
  tagsTextOf,
} from '../../customer-ledger'

export type CustomerFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: CustomerConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of the whole ledger, when the conditions narrow it */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<keyof CustomerConditions, string>

const valuesOf = (conditions: CustomerConditions): Values => ({
  search: conditions.search ?? '',
  tags: tagsTextOf(conditions.tags),
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
  const [values, hold] = useFilterValues(
    customerQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label='お客様を探す'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <TextField
            label='タグ'
            name='tags'
            autoComplete='off'
            description='「、」か「,」で区切ると、すべてのタグを持つお客様を探します。'
            value={values.tags}
            error={errors['tags']}
            onChange={(event) => hold('tags', event.target.value)}
          />
          <TextField
            label='登録日（から）'
            name='from'
            autoComplete='off'
            type='date'
            min='1900-01-01'
            max='2999-12-31'
            value={values.from}
            error={errors['from']}
            onChange={(event) => hold('from', event.target.value)}
          />
          <TextField
            label='登録日（まで）'
            name='to'
            autoComplete='off'
            type='date'
            min='1900-01-01'
            max='2999-12-31'
            value={values.to}
            error={errors['to']}
            onChange={(event) => hold('to', event.target.value)}
          />
          <Select
            label='ステータス'
            name='customerStatus'
            options={STATUS_OPTIONS}
            placeholder='すべて'
            value={values.customerStatus}
            onChange={(event) => hold('customerStatus', event.target.value)}
          />
          <Select
            label='会員ランク'
            name='membershipTier'
            options={TIER_OPTIONS}
            placeholder='すべて'
            value={values.membershipTier}
            onChange={(event) => hold('membershipTier', event.target.value)}
          />
        </>
      }
    >
      <TextField
        label='キーワード'
        name='search'
        autoComplete='off'
        type='search'
        description='お名前（カナでも）、メールアドレス、電話番号の一部。'
        value={values.search}
        error={errors['search']}
        onChange={(event) => hold('search', event.target.value)}
      />
    </FilterForm>
  )
}
