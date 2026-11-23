import {
  Form,
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalAccountMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { sessionMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { requestPasswordReset } from '../api/account-api'
import { afterRefusal, readEmail } from '../utils/account-flow'

const { passwordReset: words } = portalAccountMessages

/**
 * Where somebody who cannot sign in asks for the mail with which a password
 * is set anew. What it says afterwards is the same for an address that has
 * an account and for one that has none, as the answer of the API is.
 */
export const ForgotPasswordScreen = () => {
  const say = useSay()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const said = useSaidForm(says.message, says.errors)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const request = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: (outcome, email) => {
      if (outcome.type === 'accepted') {
        setSentTo(email)
        return
      }
      setSays(afterRefusal(outcome))
    },
  })

  const submit = (values: FormData): void => {
    const read = readEmail(values)
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    request.mutate(read.value)
  }

  if (sentTo !== null) {
    return (
      <>
        <PageHeader title={say(words.sent)} />
        <p>{say(words.sentTo(sentTo))}</p>
        <p>{say(words.notArrived)}</p>
        <p>
          <Link to='/sign-in'>{say(words.backToSignIn)}</Link>
        </p>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={say(words.title)}
        description={say(words.description)}
      />
      <Form
        submitLabel={say(words.send)}
        message={said.message}
        errors={says.errors}
        pending={request.isPending}
        onSubmit={submit}
      >
        <TextField
          label={say(sessionMessages.signInForm.email)}
          name='email'
          type='email'
          autoComplete='username'
          required
          error={said.errors['email']}
        />
      </Form>
      <p>
        <Link to='/sign-in'>{say(words.backToSignIn)}</Link>
      </p>
    </>
  )
}
