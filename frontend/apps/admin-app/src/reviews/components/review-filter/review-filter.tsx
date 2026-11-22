import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  type ChoiceOption,
  countNarrowing,
  FilterForm,
  type FormErrors,
  NO_ERRORS,
  Select,
  useFilterValues,
} from '@beauty-salon-frontend/ui'
import {
  RATINGS,
  type ReviewConditions,
  reviewQueryOf,
} from '../../utils/review-search'

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

const RATING_OPTIONS: readonly ChoiceOption[] = RATINGS.map((rating) => ({
  value: `${rating}`,
  label: `${rating}`,
}))

const ORDER_OPTIONS: readonly ChoiceOption[] = [
  { value: 'rating', label: '評価の高い順' },
  { value: 'helpful', label: '参考になった順' },
]

/**
 * The conditions of the sheet that narrow the list: its button counts
 * them. The order is in the sheet too, and narrows nothing
 */
const COUNTED: readonly (keyof Values)[] = ['min', 'max', 'staff']

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
  const [values, hold] = useFilterValues(
    reviewQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label='レビューを絞り込む'
      purpose='view'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <Select
            label='評価の下限'
            name='min'
            options={RATING_OPTIONS}
            placeholder='指定しない'
            value={values.min}
            onChange={(event) => hold('min', event.target.value)}
          />
          <Select
            label='評価の上限'
            name='max'
            options={RATING_OPTIONS}
            placeholder='指定しない'
            value={values.max}
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
            value={values.staff}
            onChange={(event) => hold('staff', event.target.value)}
          />
          <Select
            label='並び順'
            name='sort'
            options={ORDER_OPTIONS}
            placeholder='新しい順'
            value={values.sort}
            onChange={(event) => hold('sort', event.target.value)}
          />
        </>
      }
    />
  )
}
