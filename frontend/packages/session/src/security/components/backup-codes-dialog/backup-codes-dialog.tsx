import {
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  TextField,
} from '@beauty-salon-frontend/ui'
import { CODE } from '../../utils/two-factor-flow'
import { BackupCodeList } from '../backup-code-list/backup-code-list'

export type BackupCodesDialogProps = {
  open: boolean
  onClose: () => void
  /** The codes the API issued: they take the place of the form */
  issued?: readonly string[] | undefined
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /** What is wrong with the code, under the name of its control */
  errors?: FormErrors | undefined
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
}: BackupCodesDialogProps) => (
  <FormDialog
    open={open}
    onClose={onClose}
    title='バックアップコードを発行し直す'
    description={
      issued === undefined
        ? '新しいバックアップコードを 10 個発行します。いまのバックアップコードは、使えなくなります。'
        : undefined
    }
    submitLabel='発行し直す'
    message={message}
    errors={errors}
    pending={pending}
    onSubmit={onIssue}
    answer={
      issued === undefined ? undefined : (
        <>
          <p>
            新しいバックアップコードです。それまでのバックアップコードは、使えなくなりました。それぞれ
            1
            回だけ、認証アプリのコードの代わりに使えます。このダイアログを閉じると、二度と表示されません。印刷するか、パスワードマネージャーなどの安全な場所に控えてください。発行し直したことを、メールでお知らせしました。
          </p>
          <BackupCodeList codes={issued} />
        </>
      )
    }
  >
    <TextField
      label='認証アプリのコードかバックアップコード'
      name={CODE}
      autoComplete='one-time-code'
      required
      description='アカウントの持ち主であることを確かめます。認証アプリに表示されている 6 桁のコードか、まだ使っていないバックアップコードを入力してください。'
      error={errors[CODE]}
    />
  </FormDialog>
)
