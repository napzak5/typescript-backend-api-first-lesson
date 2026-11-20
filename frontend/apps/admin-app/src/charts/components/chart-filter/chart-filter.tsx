import {
  Button,
  ButtonLink,
  type FormErrors,
  Select,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import { ALLERGY_OPTIONS, chartQueryOf } from '../../chart-search'
import type { ChartConditions } from '../../charts-api'
import styles from './chart-filter.module.css'

export type ChartFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: ChartConditions
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of every chart, when the conditions narrow them */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

type Values = Record<keyof ChartConditions, string>

const valuesOf = (conditions: ChartConditions): Values => ({
  search: conditions.search ?? '',
  allergies: conditions.allergies ?? '',
})

const NO_ERRORS: FormErrors = {}

/**
 * Which charts the search shows: a keyword, and whether the customer has
 * allergies recorded. The names of its controls are the names of the
 * conditions. Like the filter of the customers, it mirrors the address:
 * when that changes under it, the controls show the other conditions.
 */
export const ChartFilter = ({
  conditions,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: ChartFilterProps) => {
  const form = useErrorFocus(errors)
  const shownQuery = chartQueryOf(conditions).toString()
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
    <search aria-label='カルテを探す'>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        <div className={styles['conditions']}>
          <TextField
            label='キーワード'
            name='search'
            type='search'
            description='持病や体調、メモ、好みの商材と避ける商材の名前の一部。'
            value={shown.values.search}
            error={errors['search']}
            onChange={(event) => hold('search', event.target.value)}
          />
          <Select
            label='アレルギーの記録'
            name='allergies'
            options={ALLERGY_OPTIONS}
            placeholder='すべて'
            value={shown.values.allergies}
            onChange={(event) => hold('allergies', event.target.value)}
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
