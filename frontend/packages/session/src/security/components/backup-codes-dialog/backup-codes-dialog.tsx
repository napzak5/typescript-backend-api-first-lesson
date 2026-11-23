import {
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { CODE } from '../../utils/two-factor-flow'
import { BackupCodeList } from '../backup-code-list/backup-code-list'

const { issue } = securityMessages

export type BackupCodesDialogProps = {
  open: boolean
  onClose: () => void
  /** The codes the API issued: they take the place of the form */
  issued?: readonly string[] | undefined
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with the code, under the name of its control */
  errors?: FormErrors<LocalizedText> | undefined
  /** The code is on its way */
  pending?: boolean | undefined
  /** The value of the control, under its name */
  onIssue: (values: FormData) => void
}

/**
 * Issues new backup codes, after a code that shows that the owner asks,
 * and then shows them, in the same dialog: they are in that answer alone.
 */
export const BackupCodesDialog = ({
  open,
  onClose,
  issued,
  message,
  errors = NO_ERRORS,
  pending = false,
  onIssue,
}: BackupCodesDialogProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={say(issue.title)}
      description={issued === undefined ? say(issue.description) : undefined}
      submitLabel={say(issue.submit)}
      message={said.message}
      errors={errors}
      pending={pending}
      onSubmit={onIssue}
      answer={
        issued === undefined ? undefined : (
          <>
            <p>{say(issue.issued)}</p>
            <BackupCodeList codes={issued} />
          </>
        )
      }
    >
      <TextField
        label={say(securityMessages.turnOff.code)}
        name={CODE}
        autoComplete='one-time-code'
        required
        description={say(issue.codeDescription)}
        error={said.errors[CODE]}
      />
    </FormDialog>
  )
}
