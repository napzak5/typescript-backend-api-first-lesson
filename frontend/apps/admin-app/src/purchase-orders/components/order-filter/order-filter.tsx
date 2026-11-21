import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/salon-screens'
import {
  Button,
  ButtonLink,
  type FormErrors,
  Select,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { ORDER_STATUS_OPTIONS } from '../../order-format'
import { type OrderConditions, orderQueryOf } from '../../order-search'
import styles from './order-filter.module.css'

export type OrderFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: OrderConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
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

const NO_ERRORS: FormErrors = {}

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
  const form = useErrorFocus(errors)
  const shownQuery = orderQueryOf(conditions).toString()
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
    <search aria-label='発注を絞り込む'>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        <div className={styles['conditions']}>
          <Select
            label='ステータス'
            name='status'
            options={ORDER_STATUS_OPTIONS}
            placeholder='すべて'
            value={shown.values.status}
            onChange={(event) => hold('status', event.target.value)}
          />
          <TextField
            label='仕入先'
            name='supplier'
            description='仕入先の名前のすべて。発注に書いたとおりに入力します。'
            value={shown.values.supplier}
            error={errors['supplier']}
            onChange={(event) => hold('supplier', event.target.value)}
          />
          <TextField
            label='発注日（から）'
            name='from'
            type='date'
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            value={shown.values.from}
            error={errors['from']}
            onChange={(event) => hold('from', event.target.value)}
          />
          <TextField
            label='発注日（まで）'
            name='to'
            type='date'
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            value={shown.values.to}
            error={errors['to']}
            onChange={(event) => hold('to', event.target.value)}
          />
        </div>
        <div className={styles['actions']}>
          <Button type='submit' variant='primary'>
            表示する
          </Button>
          {clearHref !== undefined && (
            <ButtonLink href={clearHref} variant='quiet'>
              条件をすべて外す
            </ButtonLink>
          )}
        </div>
      </form>
    </search>
  )
}
