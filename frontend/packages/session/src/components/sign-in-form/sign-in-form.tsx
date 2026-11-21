import { Button, Checkbox, Form, TextField } from '@beauty-salon-frontend/ui'
import { useLayoutEffect, useRef } from 'react'

/** What is wrong with a value, under the name of its control. */
export type SignInFormErrors = {
  email?: string | undefined
  password?: string | undefined
  twoFactorCode?: string | undefined
}

export type SignInFormProps = {
  /**
   * `credentials` asks for the email address and the password.
   * `twoFactorCode` asks for the code of the second step, once the API has
   * taken the first two.
   */
  step: 'credentials' | 'twoFactorCode'
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  errors?: SignInFormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** The values of the controls of the step, under their names */
  onSubmit: (values: FormData) => void
  /** From the second step back to the first */
  onBack?: (() => void) | undefined
}

const NO_ERRORS: SignInFormErrors = {}

/**
 * The form a person signs in with: what it asks for, and what it says about
 * the last attempt. It keeps no state and calls no API; the browser keeps
 * the values, and the form hands them over when it is sent.
 *
 * Like every `Form`, it moves the focus to the first control that has an
 * error. When the second step begins, the focus goes to the code: the form
 * changes without a page load, so it says itself where to go on. It does so
 * in the commit that shows the change, before the browser paints it.
 */
export const SignInForm = ({
  step,
  message,
  errors = NO_ERRORS,
  pending = false,
  onSubmit,
  onBack,
}: SignInFormProps) => {
  const code = useRef<HTMLInputElement>(null)

  // After the error of the code, if there is one, has taken the focus
  useLayoutEffect(() => {
    if (step === 'twoFactorCode' && errors.twoFactorCode === undefined) {
      code.current?.focus()
    }
  }, [errors, step])

  return (
    <Form
      submitLabel='サインイン'
      message={message}
      errors={errors}
      pending={pending}
      actions={
        step === 'twoFactorCode' &&
        onBack !== undefined && (
          <Button variant='quiet' onClick={onBack}>
            メールアドレスの入力に戻る
          </Button>
        )
      }
      onSubmit={onSubmit}
    >
      {step === 'credentials' ? (
        <>
          <TextField
            label='メールアドレス'
            name='email'
            type='email'
            autoComplete='username'
            required
            error={errors.email}
          />
          <TextField
            label='パスワード'
            name='password'
            type='password'
            autoComplete='current-password'
            required
            error={errors.password}
          />
          <Checkbox
            label='30 日間サインインしたままにする'
            name='rememberMe'
            description='ほかの人も使う端末では、選ばないでください。'
          />
        </>
      ) : (
        <TextField
          ref={code}
          label='認証コード'
          name='twoFactorCode'
          autoComplete='one-time-code'
          required
          description='認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。'
          error={errors.twoFactorCode}
        />
      )}
    </Form>
  )
}
