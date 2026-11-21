import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  Form,
  type FormErrors,
  Rating,
  TextArea,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { RESPONSE } from '../../review-actions'
import { reviewDayNameOf } from '../../review-format'
import styles from './response-form.module.css'

export type ResponseFormProps = {
  /** The review that is answered, and the answer it holds */
  review: Pick<
    ModelsReviewResponse,
    'overallRating' | 'title' | 'comment' | 'createdAt' | 'ownerResponse'
  >
  /** The time zone of the salon, which the day of the review is said in */
  timezone: string
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /** What is wrong with the answer, under the name of its control */
  errors?: FormErrors | undefined
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
  errors,
  pending,
  actions,
  onSubmit,
}: ResponseFormProps) => (
  <div className={styles['parts']}>
    <Card title='お客様のレビュー'>
      <div className={styles['review']}>
        <p>
          <Rating value={review.overallRating} />
          <time className={styles['date']} dateTime={review.createdAt}>
            {reviewDayNameOf(review.createdAt, timezone)}
          </time>
        </p>
        {review.title !== null && (
          <p className={styles['title']}>{review.title}</p>
        )}
        <p className={styles['text']}>{review.comment ?? 'コメントなし'}</p>
      </div>
    </Card>
    <Form
      submitLabel={review.ownerResponse === null ? '返信する' : '返信を直す'}
      message={message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <TextArea
        label='返信'
        name={RESPONSE}
        rows={8}
        required
        defaultValue={review.ownerResponse ?? ''}
        description='サロンからの返信として、レビューの下に載ります。お客様と、レビューを読むすべての人が読みます。'
        error={errors?.[RESPONSE]}
      />
    </Form>
  </div>
)
