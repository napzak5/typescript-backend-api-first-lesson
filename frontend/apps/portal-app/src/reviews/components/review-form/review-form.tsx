import {
  Form,
  type FormProps,
  RadioGroup,
  Select,
  type SelectOption,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useState } from 'react'
import { match } from 'ts-pattern'
import { DETAIL_RATINGS } from '../../../salons/salon-format'
import {
  COMMENT,
  type Entered,
  IMAGES,
  MAX_IMAGES,
  MAX_TITLE_LENGTH,
  OVERALL_RATING,
  STAFF,
  STAFF_RATING,
  TITLE,
} from '../../review-flow'
import { NO_STAFF } from '../../review-format'
import styles from './review-form.module.css'

/** Whom a review rates, and whether the form asks. */
type RatedStaff =
  /**
   * A new review: one of these can be chosen, or nobody. With none of them
   * the form has no control, and says why
   */
  | { type: 'choice'; options: readonly SelectOption[] }
  /**
   * A review that is written rates this member, which cannot be changed.
   * `name` is `null` when their salon no longer shows them
   */
  | { type: 'fixed'; name: string | null }
  /** A review that is written rates nobody, which cannot be changed */
  | { type: 'nobody' }

export type ReviewFormProps = Pick<
  FormProps,
  'submitLabel' | 'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What the controls open with */
  entered: Entered
  staff: RatedStaff
}

/** The ratings there are, the best first, each with the word for it */
const RATINGS: readonly SelectOption[] = [
  { value: '5', label: '5（とても満足）' },
  { value: '4', label: '4（満足）' },
  { value: '3', label: '3（ふつう）' },
  { value: '2', label: '2（やや不満）' },
  { value: '1', label: '1（不満）' },
]

const NOT_RATED = '評価しない'

/**
 * What a customer says of a visit: how it was, as one rating and as
 * ratings of its sides, and in words. One form writes a review and changes
 * one: `submitLabel` says which, `entered` is what it opens with, and
 * `staff` whether it asks whom the review rates. A control is named as the
 * property of the request is; the browser keeps the values, and the form
 * hands them over when it is sent.
 *
 * Whom the review rates decides what the form offers, so that choice is
 * the form's own: a review that rates nobody has no rating of the staff,
 * and no control for one.
 */
export const ReviewForm = ({
  entered,
  staff,
  errors = {},
  ...form
}: ReviewFormProps) => {
  const [chosen, setChosen] = useState(entered.staffId ?? '')
  // What is offered may be read again behind the form: a member who is
  // offered no more is not chosen
  const offered = staff.type === 'choice' ? staff.options : []
  const staffId = offered.some(({ value }) => value === chosen) ? chosen : ''
  const rated = match(staff)
    .with({ type: 'choice' }, () => staffId !== '')
    .with({ type: 'fixed' }, () => true)
    .with({ type: 'nobody' }, () => false)
    .exhaustive()

  return (
    <Form {...form} errors={errors}>
      <p className={styles['note']}>
        レビューは、サロンのページに掲載され、誰でも読めます。
      </p>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>評価</legend>
        <div className={styles['controls']}>
          <RadioGroup
            label='総合の評価'
            name={OVERALL_RATING}
            options={RATINGS}
            defaultValue={entered.overallRating}
            required
            error={errors[OVERALL_RATING]}
          />
          {match(staff)
            .with({ type: 'choice' }, ({ options }) =>
              options.length === 0 ? (
                <p className={styles['note']}>
                  この来店を担当したスタッフは、いまサロンのページに掲載されていないため、スタッフの評価はできません。
                </p>
              ) : (
                <Select
                  label='評価するスタッフ'
                  name={STAFF}
                  placeholder='スタッフを評価しない'
                  options={options}
                  value={staffId}
                  onChange={(event) => setChosen(event.target.value)}
                  description='選んだスタッフへのレビューとしても、集計されます。'
                  error={errors[STAFF]}
                />
              ),
            )
            .with({ type: 'fixed' }, ({ name }) => (
              <p className={styles['note']}>
                評価するスタッフ: {name ?? NO_STAFF}
                。評価するスタッフは、変更できません。
              </p>
            ))
            .with({ type: 'nobody' }, () => (
              <p className={styles['note']}>
                このレビューは、スタッフを評価していません。評価するスタッフは、あとから追加できません。
              </p>
            ))
            .exhaustive()}
          <div className={styles['details']}>
            {DETAIL_RATINGS.filter(
              ({ name }) => name !== STAFF_RATING || rated,
            ).map(({ name, label }) => (
              <Select
                key={name}
                label={label}
                name={name}
                placeholder={NOT_RATED}
                options={RATINGS}
                defaultValue={entered[name] ?? ''}
                error={errors[name]}
              />
            ))}
          </div>
        </div>
      </fieldset>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>感想</legend>
        <div className={styles['controls']}>
          <TextField
            label='タイトル'
            name={TITLE}
            description={`${MAX_TITLE_LENGTH} 文字以内で書いてください。空欄のままでも、かまいません。`}
            defaultValue={entered.title}
            error={errors[TITLE]}
          />
          <TextArea
            label='本文'
            name={COMMENT}
            rows={6}
            description='空欄のままでも、かまいません。'
            defaultValue={entered.comment}
            error={errors[COMMENT]}
          />
          <TextArea
            label='写真の URL'
            name={IMAGES}
            rows={3}
            description={`写真のアドレスを、1 行に 1 つずつ、${MAX_IMAGES} 個まで書けます。`}
            defaultValue={entered.imageUrls}
            error={errors[IMAGES]}
          />
        </div>
      </fieldset>
    </Form>
  )
}
