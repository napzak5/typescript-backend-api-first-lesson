import {
  Alert,
  Button,
  Card,
  FormDialog,
  type FormErrors,
  RadioGroup,
  TextArea,
} from '@beauty-salon-frontend/ui'
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
}: ReviewReportProps) => (
  <Card title='運営への通報'>
    <div className={styles['report']}>
      <p>
        事実と違う内容や個人情報など、規則に反するレビューを運営に知らせます。サロンは、レビューを削除できません。運営が内容を確かめ、規則に反するレビューは削除します。通報は、1
        つのレビューに 1 回です。
      </p>
      <Button variant='danger' onClick={onAsk}>
        通報する
      </Button>
    </div>
    <FormDialog
      open={asking}
      onClose={onClose}
      title='レビューを通報する'
      description='このレビューを、運営に通報します。通報の内容を読むのは運営だけで、レビューを書いたお客様には伝わりません。確かめが済むまで、レビューは掲載されたままです。'
      submitLabel='通報する'
      submitVariant='danger'
      message={message}
      errors={errors}
      pending={pending}
      onSubmit={onReport}
      answer={
        reportedBefore ? (
          <Alert tone='info'>{REPORTED_BEFORE}</Alert>
        ) : undefined
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
        description={`どこが規則に反するかを、${MAX_DETAILS_LENGTH} 文字以内で書いてください。理由が「その他」のときは、必ず書いてください。`}
        error={errors[DETAILS]}
      />
    </FormDialog>
  </Card>
)
