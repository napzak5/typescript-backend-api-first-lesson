import {
  Alert,
  FormDialog,
  type FormErrors,
  RadioGroup,
  TextArea,
} from '@beauty-salon-frontend/ui'
import { DETAILS, MAX_DETAILS_LENGTH, REASON, REASONS } from '../../reader-flow'

export type ReviewReportProps = {
  /** The dialog is open */
  open: boolean
  /** Which review it is, as the dialog names it: 「2026年11月10日 投稿」 */
  subject: string
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /**
   * The account reported the review before. An account reports a review
   * once, so there is nothing to send: the dialog says so in place of its
   * form, and can be closed
   */
  reportedBefore?: boolean | undefined
  /** What went wrong with the attempt as a whole; it is said in the dialog */
  message?: string | undefined
  /** What is wrong with a value, under the name of its control */
  errors?: FormErrors | undefined
  /** The report is on its way */
  pending?: boolean | undefined
  /** The customer sent the form: `reason` and `details` */
  onReport: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

const REPORTED_BEFORE =
  'このレビューは、すでに通報しています。1 つのレビューを通報できるのは、1 回です。'

/**
 * The form in which a customer reports a review to those who run the site:
 * why, and what is wrong with it. A report changes nothing about the
 * review, and the dialog says so before it is sent.
 */
export const ReviewReport = ({
  open,
  subject,
  onClose,
  reportedBefore = false,
  message,
  errors = NO_ERRORS,
  pending = false,
  onReport,
}: ReviewReportProps) => (
  <FormDialog
    open={open}
    onClose={onClose}
    title='レビューを通報する'
    description={`${subject}のレビューを、運営に通報します。運営が内容を確かめ、規則に反するレビューは削除します。確かめが済むまで、レビューは掲載されたままです。`}
    submitLabel='通報する'
    message={message}
    errors={errors}
    pending={pending}
    onSubmit={onReport}
    answer={
      reportedBefore ? <Alert tone='info'>{REPORTED_BEFORE}</Alert> : undefined
    }
  >
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
      rows={4}
      maxLength={MAX_DETAILS_LENGTH}
      description={`どこが問題かを、${MAX_DETAILS_LENGTH} 文字以内でご記入ください。理由が「その他」のときは、必ずご記入ください。`}
      error={errors[DETAILS]}
    />
  </FormDialog>
)
