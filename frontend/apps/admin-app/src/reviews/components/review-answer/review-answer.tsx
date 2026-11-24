import type { ModelsReviewResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Actions,
  Alert,
  Button,
  ButtonLink,
  Card,
  Dialog,
  EmptyState,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  reviewMessages,
  uiMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
import type { Ref } from 'react'
import styles from './review-answer.module.css'

const { answer: ANSWER, withdrawal } = adminReviewMessages

export type ReviewAnswerProps = {
  review: Pick<ModelsReviewResponse, 'ownerResponse' | 'ownerRespondedAt'>
  /** The time zone of the salon, which the moment of the answer is said in */
  timezone: string
  /** The screen that writes the answer, or changes it; none when the account does not write the answers of the salon */
  responseHref?: string | undefined
  /** Whether the account withdraws the answer */
  withdraws: boolean
  /** What the account may not do here, and who may */
  note?: LocalizedText | undefined
  /** The heading of the part: the focus goes there after the withdrawal */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The withdrawal is on its way */
  pending?: boolean | undefined
  /** Whether the dialog of the withdrawal is open */
  asking?: boolean | undefined
  /** What went wrong with the withdrawal, in the dialog */
  message?: LocalizedText | undefined
  /** The button of the withdrawal was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onWithdraw: () => void
}

/**
 * What the salon answered to a review, which everybody who reads the
 * review reads below it, and when; or that it did not answer yet. The
 * owner and a manager write it and change it on a screen of their own.
 * A withdrawal removes it from the page of the salon, so a dialog asks
 * first.
 */
export const ReviewAnswer = ({
  review,
  timezone,
  responseHref,
  withdraws,
  note,
  headingRef,
  pending = false,
  asking = false,
  message,
  onAsk,
  onClose,
  onWithdraw,
}: ReviewAnswerProps) => {
  const say = useSay()
  const answered = review.ownerResponse !== null
  const withdrawable = withdraws && answered

  return (
    <Card title={say(reviewMessages.response)} headingRef={headingRef}>
      <div className={styles['answer']}>
        {review.ownerResponse === null ? (
          <EmptyState kind='part' title={say(ANSWER.none)} />
        ) : (
          <>
            <WrittenText className={styles['text']}>
              {review.ownerResponse}
            </WrittenText>
            {review.ownerRespondedAt !== null && (
              <p className={styles['moment']}>
                {say(
                  ANSWER.respondedAt(
                    momentNameAt(review.ownerRespondedAt, timezone),
                  ),
                )}
              </p>
            )}
          </>
        )}
        {(responseHref !== undefined || withdrawable) && (
          <Actions>
            {responseHref !== undefined && (
              <ButtonLink href={responseHref} variant='primary'>
                {say(answered ? ANSWER.change : ANSWER.write)}
              </ButtonLink>
            )}
            {withdrawable && (
              <Button variant='danger' onClick={onAsk}>
                {say(ANSWER.withdraw)}
              </Button>
            )}
          </Actions>
        )}
        {note !== undefined && <p className={styles['note']}>{say(note)}</p>}
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title={say(withdrawal.confirm)}
        description={say(withdrawal.description)}
        actions={
          <>
            <Button onClick={onClose}>{say(uiMessages.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onWithdraw}>
              {say(withdrawal.submit)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </Card>
  )
}
