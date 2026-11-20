import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Button,
  ButtonLink,
  type FormErrors,
  Link,
  Select,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { EARLIEST_DAY, LATEST_DAY } from '../../../salon-time'
import { treatmentQueryOf } from '../../treatment-search'
import type { TreatmentConditions } from '../../treatments-api'
import styles from './treatment-filter.module.css'

export type TreatmentFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: TreatmentConditions
  /** The members of the staff of the salon */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /**
   * The customer of the conditions, by name: 「山田 花子 様」; 「このお客様」
   * while the name is not known. The list was opened from the ledger for them
   */
  customerName?: string | undefined
  /** The address of the same conditions without the customer */
  withoutCustomerHref?: string | undefined
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of every record, when the conditions narrow the list */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<'staff' | 'from' | 'to', string>

const valuesOf = ({ staff, from, to }: TreatmentConditions): Values => ({
  staff: staff ?? '',
  from: from ?? '',
  to: to ?? '',
})

const NO_ERRORS: FormErrors = {}

/**
 * Which treatment records the list shows: the member of the staff who did
 * the treatment, and the days the record was written on. The customer is
 * no control: the list is opened for one from the ledger, and the filter
 * names them, keeps them, and leads to the same conditions without them.
 * Like the filter of the sales, it mirrors the address.
 */
export const TreatmentFilter = ({
  conditions,
  staff,
  customerName,
  withoutCustomerHref,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: TreatmentFilterProps) => {
  const form = useErrorFocus(errors)
  const shownQuery = treatmentQueryOf(conditions).toString()
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
    <search aria-label='施術記録を絞り込む'>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        {conditions.customer === undefined ? null : (
          <p className={styles['customer']}>
            <span>{`お客様：${customerName ?? 'このお客様'}`}</span>
            {withoutCustomerHref === undefined ? null : (
              <Link href={withoutCustomerHref}>すべてのお客様にする</Link>
            )}
            <input type='hidden' name='customer' value={conditions.customer} />
          </p>
        )}
        <div className={styles['conditions']}>
          <Select
            label='担当'
            name='staff'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder='すべて'
            value={shown.values.staff}
            onChange={(event) => hold('staff', event.target.value)}
          />
          <TextField
            label='書いた日（から）'
            name='from'
            type='date'
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            value={shown.values.from}
            error={errors['from']}
            onChange={(event) => hold('from', event.target.value)}
          />
          <TextField
            label='書いた日（まで）'
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
