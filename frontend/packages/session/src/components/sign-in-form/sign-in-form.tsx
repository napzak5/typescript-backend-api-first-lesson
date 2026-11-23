import {
  Button,
  Checkbox,
  Form,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { sessionMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useLayoutEffect, useRef } from 'react'

/** What is wrong with a value, under the name of its control. */
export type SignInFormErrors = {
  email?: LocalizedText | undefined
  password?: LocalizedText | undefined
  twoFactorCode?: LocalizedText | undefined
}

export type SignInFormProps = {
  /**
   * `credentials` asks for the email address and the password.
   * `twoFactorCode` asks for the code of the second step, once the API has
   * taken the first two.
   */
  step: 'credentials' | 'twoFactorCode'
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  errors?: SignInFormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** The values of the controls of the step, under their names */
  onSubmit: (values: FormData) => void
  /** From the second step back to the first */
  onBack?: (() => void) | undefined
}

const NO_ERRORS: SignInFormErrors = {}

const { signInForm } = sessionMessages

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
  const say = useSay()
  const said = useSaidForm(message, errors)
  const code = useRef<HTMLInputElement>(null)

  // After the error of the code, if there is one, has taken the focus
  useLayoutEffect(() => {
    if (step === 'twoFactorCode' && errors.twoFactorCode === undefined) {
      code.current?.focus()
    }
  }, [errors, step])

  return (
    <Form
      submitLabel={say(sessionMessages.signIn)}
      message={said.message}
      errors={errors}
      pending={pending}
      actions={
        step === 'twoFactorCode' &&
        onBack !== undefined && (
          <Button variant='quiet' onClick={onBack}>
            {say(signInForm.back)}
          </Button>
        )
      }
      onSubmit={onSubmit}
    >
      {step === 'credentials' ? (
        <>
          <TextField
            label={say(signInForm.email)}
            name='email'
            type='email'
            autoComplete='username'
            required
            error={said.errors['email']}
          />
          <TextField
            label={say(signInForm.password)}
            name='password'
            type='password'
            autoComplete='current-password'
            required
            error={said.errors['password']}
          />
          <Checkbox
            label={say(signInForm.rememberMe)}
            name='rememberMe'
            description={say(signInForm.rememberMeDescription)}
          />
        </>
      ) : (
        <TextField
          ref={code}
          label={say(signInForm.code)}
          name='twoFactorCode'
          autoComplete='one-time-code'
          required
          description={say(signInForm.codeDescription)}
          error={said.errors['twoFactorCode']}
        />
      )}
    </Form>
  )
}
