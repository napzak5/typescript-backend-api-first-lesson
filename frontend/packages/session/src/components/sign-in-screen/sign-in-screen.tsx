import { PageHeader, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { signIn } from '../../sign-in'
import { SignInForm } from '../sign-in-form/sign-in-form'
import {
  type Attempt,
  afterAttempt,
  INITIAL_SIGN_IN_STATE,
  readAttempt,
  type SignInState,
} from './sign-in-flow'

/**
 * The screen a person signs in on: the form, the two steps of an account
 * with two-factor authentication, and what the API said about an attempt.
 *
 * It does not leave when the attempt succeeds. Whoever shows it reads the
 * session (`useSession`) and shows something else to a person who is signed
 * in: `RequireSession` shows the screen that was asked for.
 */
export const SignInScreen = () => {
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
      <SignInForm
        step={state.step.type}
        message={state.message}
        errors={state.errors}
        pending={attempt.isPending}
        onSubmit={submit}
        onBack={() => setState(INITIAL_SIGN_IN_STATE)}
      />
    </>
  )
}
