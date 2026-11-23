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
  inJapanese,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import styles from './review-answer.module.css'

export type ReviewAnswerProps = {
  review: Pick<ModelsReviewResponse, 'ownerResponse' | 'ownerRespondedAt'>
  /** The time zone of the salon, which the moment of the answer is said in */
  timezone: string
  /** The screen that writes the answer, or changes it; none when the account does not write the answers of the salon */
  responseHref?: string | undefined
  /** Whether the account withdraws the answer */
  withdraws: boolean
  /** What the account may not do here, and who may */
  note?: string | undefined
  /** The heading of the part: the focus goes there after the withdrawal */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** The withdrawal is on its way */
  pending?: boolean | undefined
  /** Whether the dialog of the withdrawal is open */
  asking?: boolean | undefined
  /** What went wrong with the withdrawal, in the dialog */
  message?: string | undefined
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
  const answered = review.ownerResponse !== null
  const withdrawable = withdraws && answered

  return (
    <Card title='サロンからの返信' headingRef={headingRef}>
      <div className={styles['answer']}>
        {review.ownerResponse === null ? (
          <EmptyState kind='part' title='まだ返信していません。' />
        ) : (
          <>
            <WrittenText className={styles['text']}>
              {review.ownerResponse}
            </WrittenText>
            {review.ownerRespondedAt !== null && (
              <p className={styles['moment']}>
                {`返信日時 ${inJapanese(momentNameAt(review.ownerRespondedAt, timezone))}`}
              </p>
            )}
          </>
        )}
        {(responseHref !== undefined || withdrawable) && (
          <Actions>
            {responseHref !== undefined && (
              <ButtonLink href={responseHref} variant='primary'>
                {answered ? '返信を直す' : '返信を書く'}
              </ButtonLink>
            )}
            {withdrawable && (
              <Button variant='danger' onClick={onAsk}>
                返信を取り下げる
              </Button>
            )}
          </Actions>
        )}
        {note !== undefined && <p className={styles['note']}>{note}</p>}
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title='返信を取り下げますか？'
        description='サロンからの返信を、このレビューから消します。消した返信は元に戻せません。返信は、あとからもう一度書けます。'
        actions={
          <>
            <Button onClick={onClose}>戻る</Button>
            <Button variant='danger' pending={pending} onClick={onWithdraw}>
              取り下げる
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      </Dialog>
    </Card>
  )
}
