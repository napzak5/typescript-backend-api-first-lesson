import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  countNarrowing,
  FilterForm,
  type FormErrors,
  type NamedChoice,
  NO_ERRORS,
  Select,
  useFilterValues,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  RATINGS,
  type ReviewConditions,
  reviewQueryOf,
} from '../../utils/review-search'

const { list, words } = adminReviewMessages

export type ReviewFilterProps = {
  /** The conditions that are shown: those of the address */
  conditions: ReviewConditions
  /** The members of the staff of the salon */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** What is wrong with the values that were sent, under the names of the controls */
  errors?: FormErrors<LocalizedText> | undefined
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

const RATING_CHOICES: readonly NamedChoice[] = RATINGS.map((rating) => ({
  value: `${rating}`,
  label: formats.numberOf(rating),
}))

/** The orders besides the latest first, which is the order when none is chosen */
const ORDER_CHOICES: readonly NamedChoice[] = [
  { value: 'rating', label: reviewMessages.highestRated },
  { value: 'helpful', label: reviewMessages.mostHelpful },
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
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(undefined, errors)
  const [values, hold] = useFilterValues(
    reviewQueryOf(conditions).toString(),
    () => valuesOf(conditions),
  )

  return (
    <FilterForm
      label={say(list.filter)}
      purpose='view'
      errors={errors}
      clearHref={clearHref}
      onSubmit={onSubmit}
      conditionCount={countNarrowing(valuesOf(conditions), COUNTED)}
      conditions={
        <>
          <Select
            label={say(list.lowest)}
            name='min'
            options={options(RATING_CHOICES)}
            placeholder={say(list.anyRating)}
            value={values.min}
            onChange={(event) => hold('min', event.target.value)}
          />
          <Select
            label={say(list.highest)}
            name='max'
            options={options(RATING_CHOICES)}
            placeholder={say(list.anyRating)}
            value={values.max}
            error={said.errors['max']}
            onChange={(event) => hold('max', event.target.value)}
          />
          <Select
            label={say(words.staff)}
            name='staff'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder={say(list.allStaff)}
            value={values.staff}
            onChange={(event) => hold('staff', event.target.value)}
          />
          <Select
            label={say(reviewMessages.sortBy)}
            name='sort'
            options={options(ORDER_CHOICES)}
            placeholder={say(reviewMessages.recent)}
            value={values.sort}
            onChange={(event) => hold('sort', event.target.value)}
          />
        </>
      }
    />
  )
}
