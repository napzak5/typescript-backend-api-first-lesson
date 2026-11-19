import {
  Alert,
  Button,
  Dialog,
  type FormErrors,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useId, useLayoutEffect, useRef } from 'react'
import { CODE } from '../../two-factor-flow'
import { BackupCodeList } from '../backup-code-list/backup-code-list'
import styles from './backup-codes-dialog.module.css'

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

const NO_ERRORS: FormErrors = {}

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
  const formId = useId()
  const form = useErrorFocus(errors)
  const said = useRef<HTMLParagraphElement>(null)

  // The button that sent the form went with the form: the focus goes to
  // what is said about the codes, in the commit that shows them
  useLayoutEffect(() => {
    if (issued !== undefined) {
      said.current?.focus()
    }
  }, [issued])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!pending) {
      onIssue(new FormData(event.currentTarget))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title='バックアップコードを発行し直す'
      description={
        issued === undefined
          ? '新しいバックアップコードを 10 個発行します。いまのバックアップコードは、使えなくなります。'
          : undefined
      }
      actions={
        issued === undefined ? (
          <>
            <Button onClick={onClose}>戻る</Button>
            <Button
              type='submit'
              form={formId}
              variant='primary'
              pending={pending}
            >
              発行し直す
            </Button>
          </>
        ) : (
          <Button variant='primary' onClick={onClose}>
            閉じる
          </Button>
        )
      }
    >
      {issued === undefined ? (
        <form
          className={styles['form']}
          id={formId}
          noValidate
          onSubmit={submit}
          ref={form}
        >
          {message !== undefined && <Alert tone='danger'>{message}</Alert>}
          <TextField
            label='認証アプリのコードかバックアップコード'
            name={CODE}
            autoComplete='one-time-code'
            required
            description='アカウントの持ち主であることを確かめます。認証アプリに表示されている 6 桁のコードか、まだ使っていないバックアップコードを入力してください。'
            error={errors[CODE]}
          />
        </form>
      ) : (
        <div className={styles['issued']}>
          <p ref={said} tabIndex={-1}>
            新しいバックアップコードです。それまでのバックアップコードは、使えなくなりました。それぞれ
            1
            回だけ、認証アプリのコードの代わりに使えます。このダイアログを閉じると、二度と表示されません。印刷するか、パスワードマネージャーなどの安全な場所に控えてください。発行し直したことを、メールでお知らせしました。
          </p>
          <BackupCodeList codes={issued} />
        </div>
      )}
    </Dialog>
  )
}
