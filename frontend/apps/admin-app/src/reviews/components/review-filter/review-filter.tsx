import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Button,
  ButtonLink,
  type FormErrors,
  Select,
  type SelectOption,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useState } from 'react'
import {
  RATINGS,
  type ReviewConditions,
  reviewQueryOf,
} from '../../review-search'
import styles from './review-filter.module.css'

export type ReviewFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: ReviewConditions
  /** The members of the staff of the salon */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors | undefined
  /** The address of every review, when the conditions narrow the list */
  clearHref?: string | undefined
  /** Called with the values of the controls when the form is sent */
  onSubmit: (values: FormData) => void
}

/** What the controls hold, under the names of the query */
type Values = Record<'min' | 'max' | 'staff' | 'sort', string>

const valuesOf = ({
  minRating,
  maxRating,
  staff,
  order,
}: ReviewConditions): Values => ({
  min: minRating === undefined ? '' : `${minRating}`,
  max: maxRating === undefined ? '' : `${maxRating}`,
  staff: staff ?? '',
  sort: order ?? '',
})

const RATING_OPTIONS: readonly SelectOption[] = RATINGS.map((rating) => ({
  value: `${rating}`,
  label: `${rating}`,
}))

const ORDER_OPTIONS: readonly SelectOption[] = [
  { value: 'rating', label: '評価の高い順' },
  { value: 'helpful', label: '参考になった順' },
]

const NO_ERRORS: FormErrors = {}

/**
 * Which reviews of a salon the list shows, and in what order: the lowest
 * and the highest overall rating, the member of the staff they rate, and
 * the latest first, the highest rated first or the most helpful first.
 * Like the other filters, it mirrors the address.
 */
export const ReviewFilter = ({
  conditions,
  staff,
  errors = NO_ERRORS,
  clearHref,
  onSubmit,
}: ReviewFilterProps) => {
  const form = useErrorFocus(errors)
  const shownQuery = reviewQueryOf(conditions).toString()
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
    <search aria-label='レビューを絞り込む'>
      <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
        <div className={styles['conditions']}>
          <Select
            label='評価の下限'
            name='min'
            options={RATING_OPTIONS}
            placeholder='指定しない'
            value={shown.values.min}
            onChange={(event) => hold('min', event.target.value)}
          />
          <Select
            label='評価の上限'
            name='max'
            options={RATING_OPTIONS}
            placeholder='指定しない'
            value={shown.values.max}
            error={errors['max']}
            onChange={(event) => hold('max', event.target.value)}
          />
          <Select
            label='担当スタッフ'
            name='staff'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder='すべて'
            value={shown.values.staff}
            onChange={(event) => hold('staff', event.target.value)}
          />
          <Select
            label='並び順'
            name='sort'
            options={ORDER_OPTIONS}
            placeholder='新しい順'
            value={shown.values.sort}
            onChange={(event) => hold('sort', event.target.value)}
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
