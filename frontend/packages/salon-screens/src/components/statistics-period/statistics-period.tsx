import {
  Button,
  type FormErrors,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, type ReactNode, useState } from 'react'
import { type Period, periodQueryOf } from '../../period'
import { EARLIEST_DAY, LATEST_DAY } from '../../salon-time'
import styles from './statistics-period.module.css'

export type StatisticsPeriodProps = {
  /** The period that is shown: that of the address */
  period: Period
  /** What is said of the period: how long it may be, or what is counted over it */
  description: string
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
  /** Further controls of what is counted, below the days: what the period is cut into */
  children?: ReactNode
}

const NO_ERRORS: FormErrors = {}

/**
 * The days that something is counted over, both ends counted: what a
 * customer did at the salon, or the treatment records the salon wrote.
 * Like the filters of the ledgers, it mirrors the address: when that
 * changes under it, the controls show the other days.
 */
export const StatisticsPeriod = ({
  period,
  description,
  errors = NO_ERRORS,
  onSubmit,
  children,
}: StatisticsPeriodProps) => {
  const form = useErrorFocus(errors)
  const shownQuery = periodQueryOf(period).toString()
  const [shown, setShown] = useState({ shownQuery, values: period })
  if (shown.shownQuery !== shownQuery) {
    setShown({ shownQuery, values: period })
  }

  const hold = (name: keyof Period, value: string): void => {
    setShown({ shownQuery, values: { ...shown.values, [name]: value } })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSubmit(new FormData(event.currentTarget))
  }

  return (
    <form
      className={styles['form']}
      aria-label='集計する期間'
      noValidate
      onSubmit={submit}
      ref={form}
    >
      <div className={styles['days']}>
        <TextField
          label='集計する期間（から）'
          name='from'
          type='date'
          min={EARLIEST_DAY}
          max={LATEST_DAY}
          required
          value={shown.values.from}
          error={errors['from']}
          onChange={(event) => hold('from', event.target.value)}
        />
        <TextField
          label='集計する期間（まで）'
          name='to'
          type='date'
          min={EARLIEST_DAY}
          max={LATEST_DAY}
          required
          description={description}
          value={shown.values.to}
          error={errors['to']}
          onChange={(event) => hold('to', event.target.value)}
        />
      </div>
      {children}
      <div className={styles['actions']}>
        <Button type='submit'>集計する</Button>
      </div>
    </form>
  )
}
