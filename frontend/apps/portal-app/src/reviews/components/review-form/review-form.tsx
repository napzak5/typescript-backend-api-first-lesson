import {
  type ChoiceOption,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  Note,
  RadioGroup,
  Select,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalReviewMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { useState } from 'react'
import { match } from 'ts-pattern'
import { DETAIL_RATINGS } from '../../../salons/utils/salon-format'
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
} from '../../utils/review-flow'
import styles from './review-form.module.css'

const { form: words } = portalReviewMessages

/** Whom a review rates, and whether the form asks. */
type RatedStaff =
  /**
   * A new review: one of these can be chosen, or nobody. With none of them
   * the form has no control, and says why
   */
  | { type: 'choice'; options: readonly ChoiceOption[] }
  /**
   * A review that is written rates this member, which cannot be changed.
   * `name` is `null` when their salon no longer shows them
   */
  | { type: 'fixed'; name: string | null }
  /** A review that is written rates nobody, which cannot be changed */
  | { type: 'nobody' }

export type ReviewFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What the controls open with */
  entered: Entered
  staff: RatedStaff
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /**
   * The errors of the controls, under their names. A new object is a new
   * attempt: the focus goes to the first control with an error
   */
  errors?: FormErrors<LocalizedText> | undefined
}

/** The ratings there are, the best first, each with the word for it */
const RATINGS: readonly { value: string; label: LocalizedText }[] = [
  { value: '5', label: words.scale.verySatisfied },
  { value: '4', label: words.scale.satisfied },
  { value: '3', label: words.scale.neutral },
  { value: '2', label: words.scale.somewhatDissatisfied },
  { value: '1', label: words.scale.dissatisfied },
]

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
  message,
  errors = NO_ERRORS,
  ...form
}: ReviewFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const ratings = RATINGS.map(({ value, label }) => ({
    value,
    label: say(label),
  }))
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
    <Form {...form} message={said.message} errors={errors}>
      <Note size='small'>{say(words.shownToAll)}</Note>
      <FormPart label={say(words.ratings)}>
        <RadioGroup
          label={say(words.overallRating)}
          name={OVERALL_RATING}
          options={ratings}
          defaultValue={entered.overallRating}
          required
          error={said.errors[OVERALL_RATING]}
        />
        {match(staff)
          .with({ type: 'choice' }, ({ options }) =>
            options.length === 0 ? (
              <Note size='small'>{say(words.noStaffToRate)}</Note>
            ) : (
              <Select
                label={say(words.staff)}
                name={STAFF}
                placeholder={say(words.noStaffRated)}
                options={options}
                value={staffId}
                onChange={(event) => setChosen(event.target.value)}
                description={say(words.staffDescription)}
                error={said.errors[STAFF]}
              />
            ),
          )
          .with({ type: 'fixed' }, ({ name }) => (
            <Note size='small'>{say(words.staffFixed(name))}</Note>
          ))
          .with({ type: 'nobody' }, () => (
            <Note size='small'>{say(words.nobodyRated)}</Note>
          ))
          .exhaustive()}
        <div className={styles['details']}>
          {DETAIL_RATINGS.filter(
            ({ name }) => name !== STAFF_RATING || rated,
          ).map(({ name, label }) => (
            <Select
              key={name}
              label={say(label)}
              name={name}
              placeholder={say(words.notRated)}
              options={ratings}
              defaultValue={entered[name] ?? ''}
              error={said.errors[name]}
            />
          ))}
        </div>
      </FormPart>
      <FormPart label={say(words.words)}>
        <TextField
          label={say(words.title)}
          name={TITLE}
          autoComplete='off'
          description={say(words.titleDescription(MAX_TITLE_LENGTH))}
          defaultValue={entered.title}
          error={said.errors[TITLE]}
        />
        <TextArea
          label={say(words.comment)}
          name={COMMENT}
          rows={6}
          description={say(words.commentDescription)}
          defaultValue={entered.comment}
          error={said.errors[COMMENT]}
        />
        <TextArea
          label={say(words.images)}
          name={IMAGES}
          description={say(words.imagesDescription(MAX_IMAGES))}
          defaultValue={entered.imageUrls}
          error={said.errors[IMAGES]}
        />
      </FormPart>
    </Form>
  )
}
