import {
  Button,
  ButtonLink,
  type FormErrors,
  Select,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { EARLIEST_DAY, LATEST_DAY } from '../../../salon-time'
import { MOVEMENT_TYPE_OPTIONS } from '../../movement-format'
import { type MovementConditions, movementQueryOf } from '../../movement-search'
import styles from './movement-filter.module.css'

export type MovementFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: MovementConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
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

const NO_ERRORS: FormErrors = {}

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
  const form = useErrorFocus(errors)
  const shownQuery = movementQueryOf(conditions).toString()
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
    <search aria-label='在庫の移動を絞り込む'>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        <div className={styles['conditions']}>
          <Select
            label='区分'
            name='type'
            options={MOVEMENT_TYPE_OPTIONS}
            placeholder='すべて'
            value={shown.values.type}
            onChange={(event) => hold('type', event.target.value)}
          />
          <TextField
            label='記録した日（から）'
            name='from'
            type='date'
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            value={shown.values.from}
            error={errors['from']}
            onChange={(event) => hold('from', event.target.value)}
          />
          <TextField
            label='記録した日（まで）'
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
