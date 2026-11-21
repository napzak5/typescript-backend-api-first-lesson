import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn, userEvent } from 'storybook/test'
import type { FormErrors } from '../form/error-focus'
import { Select } from '../select/select'
import { TextField } from '../text-field/text-field'
import { FilterForm, type FilterFormProps } from './filter-form'
import { countNarrowing, useFilterValues } from './filter-values'

/** The conditions of a ledger of guests, as its address holds them */
type GuestConditions = {
  search?: string | undefined
  from?: string | undefined
  to?: string | undefined
  status?: string | undefined
}

type GuestFilterProps = Omit<
  FilterFormProps,
  'label' | 'children' | 'conditions' | 'conditionCount'
> & {
  /** The conditions of the address */
  shown: GuestConditions
}

const STATUS_OPTIONS = [
  { value: 'active', label: '通常' },
  { value: 'suspended', label: '休止中' },
]

/** What the controls hold, under the names of the conditions */
const valuesOf = (shown: GuestConditions) => ({
  search: shown.search ?? '',
  from: shown.from ?? '',
  to: shown.to ?? '',
  status: shown.status ?? '',
})

/** The conditions of the sheet that narrow the list: its button counts them */
const COUNTED: readonly (keyof ReturnType<typeof valuesOf>)[] = [
  'from',
  'to',
  'status',
]

/** A filter as a screen builds one: a keyword in sight, the other conditions in the sheet */
const GuestFilter = ({ shown, errors, ...filter }: GuestFilterProps) => {
  const [values, hold] = useFilterValues(JSON.stringify(shown), () =>
    valuesOf(shown),
  )

  return (
    <FilterForm
      {...filter}
      label='お客様を探す'
      errors={errors}
      conditionCount={countNarrowing(valuesOf(shown), COUNTED)}
      conditions={
        <>
          <TextField
            label='登録日（から）'
            name='from'
            type='date'
            value={values.from}
            error={errors?.['from']}
            onChange={(event) => hold('from', event.target.value)}
          />
          <TextField
            label='登録日（まで）'
            name='to'
            type='date'
            value={values.to}
            error={errors?.['to']}
            onChange={(event) => hold('to', event.target.value)}
          />
          <Select
            label='ステータス'
            name='status'
            options={STATUS_OPTIONS}
            placeholder='すべて'
            value={values.status}
            onChange={(event) => hold('status', event.target.value)}
          />
        </>
      }
    >
      <TextField
        label='キーワード'
        name='search'
        type='search'
        description='お名前（カナでも）、メールアドレス、電話番号の一部。'
        value={values.search}
        error={errors?.['search']}
        onChange={(event) => hold('search', event.target.value)}
      />
    </FilterForm>
  )
}

/**
 * A screen that refuses a period which ends before it starts, as the ledger
 * of customers does: its answer is an error of the control in the sheet.
 */
const RefusingGuestFilter = ({ onSubmit, ...filter }: GuestFilterProps) => {
  const [errors, setErrors] = useState<FormErrors>({})

  const send = (values: FormData): void => {
    onSubmit(values)
    const from = values.get('from')
    const to = values.get('to')
    setErrors(
      typeof from === 'string' &&
        typeof to === 'string' &&
        to !== '' &&
        to < from
        ? { to: '「登録日（から）」より後の日を入力してください。' }
        : {},
    )
  }

  return <GuestFilter {...filter} errors={errors} onSubmit={send} />
}

const meta: Meta<typeof GuestFilter> = {
  title: 'Components/FilterForm',
  component: GuestFilter,
  args: {
    shown: {},
    onSubmit: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

const NARROWED: GuestConditions = {
  search: '山田',
  from: '2026-04-01',
  status: 'active',
}

/** Conditions that narrow the list, and the link that takes them away */
export const Narrowed: Story = {
  args: { shown: NARROWED, clearHref: '?' },
}

/** An answer that refuses a condition: the control says why */
export const WithErrors: Story = {
  args: {
    shown: { from: '2026-04-01', to: '2026-03-01' },
    errors: { to: '「登録日（から）」より後の日を入力してください。' },
  },
}

/** A list narrowed by choices only, which shows the list as they narrow it */
export const ChoicesOnly: Story = {
  render: ({ shown, ...filter }) => (
    <FilterForm
      {...filter}
      label='予約を絞り込む'
      purpose='view'
      conditionCount={shown.status === undefined ? 0 : 1}
      conditions={
        <Select
          label='状態'
          name='status'
          options={STATUS_OPTIONS}
          placeholder='すべて'
          defaultValue={shown.status ?? ''}
        />
      }
    />
  ),
}

/** A search by one keyword: it has no other conditions, and no sheet */
export const KeywordOnly: Story = {
  render: ({ shown, ...filter }) => (
    <FilterForm {...filter} label='サロンを探す'>
      <TextField
        label='キーワード'
        name='search'
        type='search'
        defaultValue={shown.search ?? ''}
      />
    </FilterForm>
  ),
}

const PHONE = { viewport: { value: 'mobile1', isRotated: false } }

/**
 * On a screen as narrow as a phone the keyword is in sight, and the other
 * conditions are in a sheet: the list starts on the first screen.
 */
export const OnANarrowScreen: Story = {
  globals: PHONE,
  args: { shown: NARROWED, clearHref: '?' },
}

const openTheSheet: NonNullable<Story['play']> = async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('button', { name: /^条件/ }))
}

/** The sheet of the conditions, opened: on the bottom edge of the screen */
export const SheetOnANarrowScreen: Story = {
  globals: PHONE,
  args: { shown: NARROWED, clearHref: '?' },
  play: openTheSheet,
}

/** Without a control in sight, the button of the sheet comes first */
export const ChoicesOnlyOnANarrowScreen: Story = {
  ...ChoicesOnly,
  globals: PHONE,
}

/**
 * A screen that refuses the period of the sheet: once it is sent, the
 * sheet opens again with the focus on the control that has the error
 */
export const RefusedOnANarrowScreen: Story = {
  globals: PHONE,
  args: { shown: { from: '2026-04-01', to: '2026-03-01' } },
  render: (filter) => <RefusingGuestFilter {...filter} />,
}
