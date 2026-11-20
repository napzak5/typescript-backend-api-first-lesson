import {
  Button,
  ButtonLink,
  type FormErrors,
  Select,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { paymentStatusNameOf } from '../../sale-format'
import {
  type LedgerConditions,
  ledgerQueryOf,
  PAYMENT_STATUSES,
} from '../../sales-ledger'
import styles from './ledger-filter.module.css'

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
  const form = useErrorFocus(errors)
  const shownQuery = ledgerQueryOf(conditions).toString()
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
    <search aria-label='売上を絞り込む'>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        <div className={styles['conditions']}>
          <TextField
            label='会計日（から）'
            name='from'
            type='date'
            min='1900-01-01'
            max='2999-12-31'
            required
            value={shown.values.from}
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
            value={shown.values.to}
            error={errors['to']}
            onChange={(event) => hold('to', event.target.value)}
          />
          <Select
            label='支払い'
            name='paymentStatus'
            options={STATUS_OPTIONS}
            placeholder='すべて'
            value={shown.values.paymentStatus}
            onChange={(event) => hold('paymentStatus', event.target.value)}
          />
        </div>
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            表示する
          </Button>
          {clearHref !== undefined && (
            <ButtonLink href={clearHref} variant='quiet'>
              今日の売上に戻す
            </ButtonLink>
          )}
        </div>
      </form>
    </search>
  )
}
