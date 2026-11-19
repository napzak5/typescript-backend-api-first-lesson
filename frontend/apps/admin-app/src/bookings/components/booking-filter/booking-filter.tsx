import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Button,
  ButtonLink,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { type DayConditions, queryOf, STATUSES } from '../../booking-day'
import { statusNameOf } from '../../booking-format'
import styles from './booking-filter.module.css'

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
  const shownQuery = queryOf(conditions).toString()
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
    <search aria-label='予約を絞り込む'>
      <form className={styles['form']} onSubmit={submit}>
        <div className={styles['conditions']}>
          <TextField
            label='日付'
            name='date'
            type='date'
            min='1900-01-01'
            max='2999-12-31'
            value={shown.values.date}
            onChange={(event) => hold('date', event.target.value)}
          />
          <Select
            label='状態'
            name='status'
            options={STATUS_OPTIONS}
            placeholder='すべて'
            value={shown.values.status}
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
            value={shown.values.staffId}
            onChange={(event) => hold('staffId', event.target.value)}
          />
        </div>
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            表示する
          </Button>
          {clearHref !== undefined && (
            <ButtonLink href={clearHref} variant='quiet'>
              条件をなくす
            </ButtonLink>
          )}
        </div>
      </form>
    </search>
  )
}
