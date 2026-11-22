import { Alert, PageHeader, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { signIn } from '../api/sign-in'
import { SignInForm } from '../components/sign-in-form/sign-in-form'
import {
  type Attempt,
  afterAttempt,
  INITIAL_SIGN_IN_STATE,
  readAttempt,
  type SignInState,
} from '../utils/sign-in-flow'

type SignInScreenProps = {
  /** Why the person is asked to sign in, when the screen behind has a reason of its own */
  notice?: string | undefined
  /**
   * The ways on for somebody who cannot sign in: to a new account, to a new
   * password. They are links of the application, which knows where they lead
   */
  help?: ReactNode
}

/**
 * The screen a person signs in on: the form, the two steps of an account
 * with two-factor authentication, and what the API said about an attempt.
 *
 * It does not leave when the attempt succeeds. Whoever shows it reads the
 * session (`useSession`) and shows something else to a person who is signed
 * in: `RequireSession` shows the screen that was asked for.
 */
export const SignInScreen = ({ notice, help }: SignInScreenProps) => {
  const [state, setState] = useState<SignInState>(INITIAL_SIGN_IN_STATE)
  const { notify } = useNotifications()
  const attempt = useMutation({
    mutationFn: ({ credentials, twoFactorCode }: Attempt) =>
      signIn({ ...credentials, twoFactorCode }),
    // Runs also when the screen is gone by then, as it is after a success
    onSuccess: (outcome, { credentials }) => {
      if (outcome.type === 'signedIn') {
        notify({ tone: 'success', message: 'サインインしました。' })
      }
      setState((current) => afterAttempt(current, credentials, outcome))
    },
  })

  const submit = (values: FormData): void => {
    const read = readAttempt(state.step, values)
    if (read.type === 'invalid') {
      setState({ ...state, message: undefined, errors: read.errors })
      return
    }
    attempt.mutate(read.value)
  }

  return (
    <>
      <PageHeader title='サインイン' />
      {notice !== undefined && <Alert tone='info'>{notice}</Alert>}
      <SignInForm
        step={state.step.type}
        message={state.message}
        errors={state.errors}
        pending={attempt.isPending}
        onSubmit={submit}
        onBack={() => setState(INITIAL_SIGN_IN_STATE)}
      />
      {help}
    </>
  )
}
