import {
  Alert,
  Button,
  Card,
  Dialog,
  type FormErrors,
  RadioGroup,
  TextArea,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useId, useLayoutEffect, useRef } from 'react'
import {
  DETAILS,
  MAX_DETAILS_LENGTH,
  REASON,
  REASONS,
  REPORTED_BEFORE,
} from '../../review-actions'
import styles from './review-report.module.css'

export type ReviewReportProps = {
  /** The report is on its way */
  pending?: boolean | undefined
  /** Whether the dialog of the report is open */
  asking?: boolean | undefined
  /** The API answered that the account reported the review before: the dialog says so, and only closes */
  reportedBefore?: boolean | undefined
  /** What went wrong with the report as a whole, in the dialog */
  message?: string | undefined
  /** What is wrong with the reason and the details, under the names of their controls */
  errors?: FormErrors | undefined
  /** The button of the report was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onReport: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

/**
 * Tells the platform that a review breaks its rules. A salon removes no
 * review: the platform reads the report and removes a review that breaks
 * them. The dialog asks why, and what is wrong with it.
 */
export const ReviewReport = ({
  pending = false,
  asking = false,
  reportedBefore = false,
  message,
  errors = NO_ERRORS,
  onAsk,
  onClose,
  onReport,
}: ReviewReportProps) => {
  const reportId = useId()
  const form = useErrorFocus(errors)
  const close = useRef<HTMLButtonElement>(null)

  // The button that sent the form went with the form: the focus goes to
  // the one that is left, in the commit that shows the dialog without them
  useLayoutEffect(() => {
    if (reportedBefore) {
      close.current?.focus()
    }
  }, [reportedBefore])

  // Its text area takes a line on Enter: the form is sent by its button,
  // and not again while the report is on its way
  const report = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!pending) {
      onReport(new FormData(event.currentTarget))
    }
  }

  return (
    <Card title='運営への通報'>
      <div className={styles['report']}>
        <p>
          事実と違う内容や個人情報など、規則に反するレビューを運営に知らせます。サロンは、レビューを削除できません。運営が内容を確かめ、規則に反するレビューは削除します。通報は、1
          つのレビューに 1 回です。
        </p>
        <div className={styles['buttons']}>
          <Button variant='danger' onClick={onAsk}>
            通報する
          </Button>
        </div>
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title='レビューを通報する'
        description='このレビューを、運営に通報します。通報の内容を読むのは運営だけで、レビューを書いたお客様には伝わりません。確かめが済むまで、レビューは掲載されたままです。'
        actions={
          reportedBefore ? (
            <Button ref={close} onClick={onClose}>
              閉じる
            </Button>
          ) : (
            <>
              <Button onClick={onClose}>戻る</Button>
              <Button
                type='submit'
                form={reportId}
                variant='danger'
                pending={pending}
              >
                通報する
              </Button>
            </>
          )
        }
      >
        {reportedBefore ? (
          <Alert tone='info'>{REPORTED_BEFORE}</Alert>
        ) : (
          <form
            className={styles['form']}
            id={reportId}
            noValidate
            onSubmit={report}
            ref={form}
          >
            {message !== undefined && <Alert tone='danger'>{message}</Alert>}
            <RadioGroup
              label='通報の理由'
              name={REASON}
              options={REASONS}
              required
              error={errors[REASON]}
            />
            <TextArea
              label='詳しい内容'
              name={DETAILS}
              maxLength={MAX_DETAILS_LENGTH}
              description={`どこが規則に反するかを、${MAX_DETAILS_LENGTH} 文字以内で書いてください。理由が「その他」のときは、必ず書いてください。`}
              error={errors[DETAILS]}
            />
          </form>
        )}
      </Dialog>
    </Card>
  )
}
