import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  Form,
  type FormErrors,
  NO_ERRORS,
  Rating,
  TextArea,
  useSaidForm,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import { RESPONSE } from '../../utils/review-actions'
import { reviewDayNameOf } from '../../utils/review-format'
import styles from './response-form.module.css'

const { response: RESPONSE_FORM, words } = adminReviewMessages

export type ResponseFormProps = {
  /** The review that is answered, and the answer it holds */
  review: Pick<
    ModelsReviewResponse,
    'overallRating' | 'title' | 'comment' | 'createdAt' | 'ownerResponse'
  >
  /** The time zone of the salon, which the day of the review is said in */
  timezone: string
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with the answer, under the name of its control. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** The answer is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/**
 * The answer of the salon to a review: what the customer wrote, to be
 * read while it is answered, and the answer, which starts with the one
 * the review holds. Everybody who reads the review reads the answer.
 */
export const ResponseForm = ({
  review,
  timezone,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: ResponseFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <div className={styles['parts']}>
      <Card title={say(RESPONSE_FORM.review)}>
        <div className={styles['review']}>
          <p>
            <Rating value={review.overallRating} />
            <time className={styles['date']} dateTime={review.createdAt}>
              {say(reviewDayNameOf(review.createdAt, timezone))}
            </time>
          </p>
          {review.title !== null && (
            <p className={styles['title']}>{review.title}</p>
          )}
          <WrittenText className={styles['text']}>
            {review.comment ?? say(words.noComment)}
          </WrittenText>
        </div>
      </Card>
      <Form
        submitLabel={say(
          review.ownerResponse === null
            ? RESPONSE_FORM.submit
            : RESPONSE_FORM.change,
        )}
        message={said.message}
        errors={errors}
        pending={pending}
        actions={actions}
        onSubmit={onSubmit}
      >
        <TextArea
          label={say(RESPONSE_FORM.label)}
          name={RESPONSE}
          rows={8}
          required
          defaultValue={review.ownerResponse ?? ''}
          description={say(RESPONSE_FORM.description)}
          error={said.errors[RESPONSE]}
        />
      </Form>
    </div>
  )
}
