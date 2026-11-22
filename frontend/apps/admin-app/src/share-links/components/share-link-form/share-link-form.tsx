import {
  Form,
  type FormErrors,
  NO_ERRORS,
  Note,
  PasswordField,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import {
  DEFAULT_PERIOD,
  MAX_DOWNLOADS,
  PASSWORD,
  PERIOD,
  PERIODS,
} from '../../share-link'

export type ShareLinkFormProps = {
  /** The name of the file the link shows */
  filename: string
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /** What is wrong with a value, under the name of its control */
  errors?: FormErrors | undefined
  /** The link is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/**
 * The form that issues a share link of a file: how long it works, from
 * the moment it is issued, how often it gives the file, and the password
 * it asks for, if any. The password is one chosen for the link, so the
 * browser is asked to offer a new one.
 */
export const ShareLinkForm = ({
  filename,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: ShareLinkFormProps) => (
  <Form
    submitLabel='共有リンクを発行する'
    message={message}
    errors={errors}
    pending={pending}
    actions={actions}
    onSubmit={onSubmit}
  >
    <Note>
      「{filename}」を、アカウントを持たない人に見せるリンクを発行します。
    </Note>
    <Select
      label='有効期間'
      name={PERIOD}
      options={PERIODS.map(({ days, label }) => ({
        value: String(days),
        label,
      }))}
      defaultValue={String(DEFAULT_PERIOD)}
      required
      description='発行した時刻から数えます。期限を過ぎると、リンクは使えなくなります。'
      error={errors[PERIOD]}
    />
    <TextField
      width='short'
      label='ダウンロードの回数の上限'
      name={MAX_DOWNLOADS}
      inputMode='numeric'
      autoComplete='off'
      description='リンクからファイルを読み込める回数です。空のままなら、上限はありません。'
      error={errors[MAX_DOWNLOADS]}
    />
    <PasswordField
      label='パスワード'
      name={PASSWORD}
      autoComplete='new-password'
      description='8 文字から 128 文字。空のままなら、パスワードなしで共有します。パスワードは、リンクとは別の方法で伝えてください。'
      error={errors[PASSWORD]}
    />
  </Form>
)
