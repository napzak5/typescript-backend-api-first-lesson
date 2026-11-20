import {
  Button,
  ButtonLink,
  type FormErrors,
  Select,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { STATUS_OPTIONS, TIER_OPTIONS } from '../../customer-format'
import {
  type CustomerConditions,
  customerQueryOf,
  tagsTextOf,
} from '../../customer-ledger'
import styles from './customer-filter.module.css'

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

const NO_ERRORS: FormErrors = {}

/**
 * Which customers the ledger shows: a keyword, tags, the days they were
 * registered on, their state and their rank. The names of its controls
 * are the names of the conditions. Like the filters of the bookings and
 * the sales, it mirrors the address: when that changes under it, the
 * controls show the other conditions.
 */
export const CustomerFilter = ({
  conditions,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: CustomerFilterProps) => {
  const form = useErrorFocus(errors)
  const shownQuery = customerQueryOf(conditions).toString()
  const [shown, setShown] = useState({
    shownQuery,
    values: valuesOf(conditions),
  })
  if (shown.shownQuery !== shownQuery) {
    setShown({ shownQuery, values: valuesOf(conditions) })
  }

  const hold = (name: keyof Values, value: string): void => {
    setShown({ shownQuery, values: { ...shown.values, [name]: value } })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }

  return (
    <search aria-label='お客様を探す'>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        <div className={styles['keywords']}>
          <TextField
            label='キーワード'
            name='search'
            type='search'
            description='お名前（カナでも）、メールアドレス、電話番号の一部。'
            value={shown.values.search}
            error={errors['search']}
            onChange={(event) => hold('search', event.target.value)}
          />
          <TextField
            label='タグ'
            name='tags'
            description='「、」か「,」で区切ると、すべてのタグを持つお客様を探します。'
            value={shown.values.tags}
            error={errors['tags']}
            onChange={(event) => hold('tags', event.target.value)}
          />
        </div>
        <div className={styles['conditions']}>
          <TextField
            label='登録日（から）'
            name='from'
            type='date'
            min='1900-01-01'
            max='2999-12-31'
            value={shown.values.from}
            error={errors['from']}
            onChange={(event) => hold('from', event.target.value)}
          />
          <TextField
            label='登録日（まで）'
            name='to'
            type='date'
            min='1900-01-01'
            max='2999-12-31'
            value={shown.values.to}
            error={errors['to']}
            onChange={(event) => hold('to', event.target.value)}
          />
          <Select
            label='ステータス'
            name='customerStatus'
            options={STATUS_OPTIONS}
            placeholder='すべて'
            value={shown.values.customerStatus}
            onChange={(event) => hold('customerStatus', event.target.value)}
          />
          <Select
            label='会員ランク'
            name='membershipTier'
            options={TIER_OPTIONS}
            placeholder='すべて'
            value={shown.values.membershipTier}
            onChange={(event) => hold('membershipTier', event.target.value)}
          />
        </div>
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            探す
          </Button>
          {clearHref !== undefined && (
            <ButtonLink href={clearHref} variant='quiet'>
              条件を外す
            </ButtonLink>
          )}
        </div>
      </form>
    </search>
  )
}
