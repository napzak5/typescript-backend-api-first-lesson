import { Alert, Button, Checkbox, TextField } from '@beauty-salon-frontend/ui'
import { type FormEvent, useLayoutEffect, useRef } from 'react'
import styles from './sign-in-form.module.css'

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

/** The controls, in the order the form shows them */
const CONTROLS: (keyof SignInFormErrors)[] = [
  'email',
  'password',
  'twoFactorCode',
]

/**
 * The form a person signs in with: what it asks for, and what it says about
 * the last attempt. It keeps no state and calls no API; the browser keeps
 * the values, and the form hands them over when it is sent.
 *
 * The focus goes to the first control that has an error, and to the code
 * when the second step begins: the form changes without a page load, so it
 * says itself where to go on. It does so in the commit that shows the change,
 * before the browser paints it.
 */
export const SignInForm = ({
  step,
  message,
  errors = NO_ERRORS,
  pending = false,
  onSubmit,
  onBack,
}: SignInFormProps) => {
  const form = useRef<HTMLFormElement>(null)

  // A new set of errors is another attempt, also when it says the same
  useLayoutEffect(() => {
    const invalid = CONTROLS.find((name) => errors[name] !== undefined)
    const next = invalid ?? (step === 'twoFactorCode' ? step : undefined)

    if (next !== undefined) {
      form.current?.querySelector<HTMLElement>(`[name="${next}"]`)?.focus()
    }
  }, [errors, step])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    // The button ignores a press while an attempt is on its way. A form can
    // also be sent without one, by a script
    if (!pending) {
      onSubmit(new FormData(event.currentTarget))
    }
  }

  return (
    // The messages of the fields replace those of the browser, which are
    // shown one at a time and not to everyone
    <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
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
          label='認証コード'
          name='twoFactorCode'
          autoComplete='one-time-code'
          required
          description='認証アプリに表示されている 6 桁のコードか、バックアップコードを入力してください。'
          error={errors.twoFactorCode}
        />
      )}
      <div className={styles['actions']}>
        <Button type='submit' variant='primary' pending={pending}>
          サインイン
        </Button>
        {step === 'twoFactorCode' && onBack !== undefined && (
          <Button variant='quiet' onClick={onBack}>
            メールアドレスの入力に戻る
          </Button>
        )}
      </div>
    </form>
  )
}
