import {
  Alert,
  Button,
  Card,
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  RadioGroup,
  TextArea,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  DETAILS,
  MAX_DETAILS_LENGTH,
  REASON,
  REASONS,
} from '../../utils/review-actions'
import styles from './review-report.module.css'

const { report } = adminReviewMessages

export type ReviewReportProps = {
  /** The report is on its way */
  pending?: boolean | undefined
  /** Whether the dialog of the report is open */
  asking?: boolean | undefined
  /** The API answered that the account reported the review before: the dialog says so, and only closes */
  reportedBefore?: boolean | undefined
  /** What went wrong with the report as a whole, in the dialog */
  message?: LocalizedText | undefined
  /** What is wrong with the reason and the details, under the names of their controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** The button of the report was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  onReport: (values: FormData) => void
}

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
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)

  return (
    <Card title={say(report.title)}>
      <div className={styles['report']}>
        <p>{say(report.explanation)}</p>
        <Button variant='danger' onClick={onAsk}>
          {say(reviewMessages.report.submit)}
        </Button>
      </div>
      <FormDialog
        open={asking}
        onClose={onClose}
        title={say(reviewMessages.report.title)}
        description={say(report.description)}
        submitLabel={say(reviewMessages.report.submit)}
        submitVariant='danger'
        message={said.message}
        errors={errors}
        pending={pending}
        onSubmit={onReport}
        answer={
          reportedBefore ? (
            <Alert tone='info'>{say(report.reportedBefore)}</Alert>
          ) : undefined
        }
      >
        <RadioGroup
          label={say(reviewMessages.report.reason)}
          name={REASON}
          options={options(REASONS)}
          required
          error={said.errors[REASON]}
        />
        <TextArea
          label={say(reviewMessages.report.details)}
          name={DETAILS}
          rows={4}
          maxLength={MAX_DETAILS_LENGTH}
          description={say(report.detailsDescription(MAX_DETAILS_LENGTH))}
          error={said.errors[DETAILS]}
        />
      </FormDialog>
    </Card>
  )
}
