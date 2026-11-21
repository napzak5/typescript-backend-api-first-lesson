import { Button, ButtonLink, Select } from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { ALERT_KIND_OPTIONS, SEVERITY_OPTIONS } from '../../alert-format'
import {
  ACKNOWLEDGED_OPTIONS,
  type AlertConditions,
  alertQueryOf,
} from '../../alert-search'
import styles from './alert-filter.module.css'

export type AlertFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: AlertConditions
  /** The address of every alert, when the conditions narrow them */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the conditions */
type Values = Record<'alert' | 'severity' | 'acknowledged', string>

const valuesOf = ({
  alert,
  severity,
  acknowledged,
}: AlertConditions): Values => ({
  alert: alert ?? '',
  severity: severity ?? '',
  acknowledged: acknowledged === undefined ? '' : `${acknowledged}`,
})

/**
 * Which alerts of the stock the screen shows: their kind, their severity,
 * and whether somebody saw to them. Like the filter of the movements, it
 * mirrors the address.
 */
export const AlertFilter = ({
  conditions,
  clearHref,
  onSubmit,
}: AlertFilterProps) => {
  const shownQuery = alertQueryOf(conditions).toString()
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
    <search aria-label='在庫のアラートを絞り込む'>
      <form className={styles['form']} noValidate onSubmit={submit}>
        <div className={styles['conditions']}>
          <Select
            label='種類'
            name='alert'
            options={ALERT_KIND_OPTIONS}
            placeholder='すべて'
            value={shown.values.alert}
            onChange={(event) => hold('alert', event.target.value)}
          />
          <Select
            label='重要度'
            name='severity'
            options={SEVERITY_OPTIONS}
            placeholder='すべて'
            value={shown.values.severity}
            onChange={(event) => hold('severity', event.target.value)}
          />
          <Select
            label='確認'
            name='acknowledged'
            options={ACKNOWLEDGED_OPTIONS}
            placeholder='すべて'
            value={shown.values.acknowledged}
            onChange={(event) => hold('acknowledged', event.target.value)}
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
