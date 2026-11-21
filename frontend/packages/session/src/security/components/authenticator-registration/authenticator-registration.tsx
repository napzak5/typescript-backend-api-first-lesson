import {
  ButtonLink,
  Card,
  Form,
  type FormErrors,
  QrCode,
  TextField,
} from '@beauty-salon-frontend/ui'
import type { Ref } from 'react'
import { CODE, secretGroupsOf } from '../../two-factor-flow'
import styles from './authenticator-registration.module.css'

export type AuthenticatorRegistrationProps = {
  /** The `otpauth://` address the authenticator app reads: it holds the secret */
  qrCodeUrl: string
  /** The secret, for an app that cannot read the code */
  secret: string
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /** What is wrong with the code, under the name of its control */
  errors?: FormErrors | undefined
  /** The code is on its way */
  pending?: boolean | undefined
  /** Where the way back leads: the screen of the security of the account */
  cancelHref: string
  /** The value of the control, under its name */
  onSubmit: (values: FormData) => void
  /** The heading of the step, which takes the focus when the step begins */
  headingRef?: Ref<HTMLHeadingElement> | undefined
}

const NO_ERRORS: FormErrors = {}

/**
 * The second step of setting up the second factor: the authenticator app
 * takes the secret, from the QR code or as it is typed, and its code shows
 * that it holds it.
 */
export const AuthenticatorRegistration = ({
  qrCodeUrl,
  secret,
  message,
  errors = NO_ERRORS,
  pending,
  cancelHref,
  onSubmit,
  headingRef,
}: AuthenticatorRegistrationProps) => (
  <>
    <Card title='認証アプリに登録する' headingRef={headingRef}>
      <p>
        スマートフォンの認証アプリ（TOTP に対応したもの）で、この QR
        コードを読み取ってください。
      </p>
      <QrCode value={qrCodeUrl} label='認証アプリで読み取る QR コード' />
      <p>
        QR コードを読み取れないときは、このキーを認証アプリに入力してください。
      </p>
      <p className={styles['secret']}>
        <code>{secretGroupsOf(secret)}</code>
      </p>
    </Card>
    <Card title='コードを確かめる'>
      <Form
        submitLabel='2 要素認証を有効にする'
        message={message}
        errors={errors}
        pending={pending}
        actions={<ButtonLink href={cancelHref}>やめる</ButtonLink>}
        onSubmit={onSubmit}
      >
        <TextField
          label='認証アプリのコード'
          name={CODE}
          inputMode='numeric'
          autoComplete='one-time-code'
          required
          description='認証アプリに表示されている 6 桁の数字です。バックアップコードは使えません。'
          error={errors[CODE]}
        />
      </Form>
    </Card>
  </>
)
