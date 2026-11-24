import {
  Alert,
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  RadioGroup,
  TextArea,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalReviewMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  DETAILS,
  MAX_DETAILS_LENGTH,
  REASON,
  REASONS,
} from '../../utils/reader-flow'

const { report: words } = portalReviewMessages

export type ReviewReportProps = {
  /** The dialog is open */
  open: boolean
  /** Which review it is, as the page of the salon names it: 「2026年11月10日 投稿」 */
  subject: LocalizedText
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
  /** What went wrong with the attempt as a whole; it is said in the dialog, in the language of the page */
  message?: LocalizedText | undefined
  /**
   * What is wrong with a value, under the name of its control. A new
   * object is a new attempt: the focus goes to the first control with an
   * error
   */
  errors?: FormErrors<LocalizedText> | undefined
  /** The report is on its way */
  pending?: boolean | undefined
  /** The customer sent the form: `reason` and `details` */
  onReport: (values: FormData) => void
}

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
}: ReviewReportProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={say(reviewMessages.report.title)}
      description={say(words.description(subject))}
      submitLabel={say(reviewMessages.report.submit)}
      message={said.message}
      errors={errors}
      pending={pending}
      onSubmit={onReport}
      answer={
        reportedBefore ? (
          <Alert tone='info'>{say(words.reportedBefore)}</Alert>
        ) : undefined
      }
    >
      <RadioGroup
        label={say(reviewMessages.report.reason)}
        name={REASON}
        options={REASONS.map(({ value, label }) => ({
          value,
          label: say(label),
        }))}
        required
        error={said.errors[REASON]}
      />
      <TextArea
        label={say(reviewMessages.report.details)}
        name={DETAILS}
        rows={4}
        maxLength={MAX_DETAILS_LENGTH}
        description={say(words.detailsDescription(MAX_DETAILS_LENGTH))}
        error={said.errors[DETAILS]}
      />
    </FormDialog>
  )
}
