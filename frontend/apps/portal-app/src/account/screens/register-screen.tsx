import { PASSWORD_RULE } from '@beauty-salon-frontend/session'
import {
  Form,
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  PasswordField,
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
import { register } from '../api/account-api'
import { afterRefusal, readRegistration } from '../utils/account-flow'
import { VerificationSent } from './verification-sent'

const { register: words } = portalAccountMessages
const { signInForm } = sessionMessages

/**
 * Where a visitor creates an account: an address and a password. The
 * account can be used once the address is confirmed, through the link of
 * the mail that the API sends.
 */
export const RegisterScreen = () => {
  const say = useSay()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const said = useSaidForm(says.message, says.errors)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const registration = useMutation({
    mutationFn: register,
    onSuccess: (outcome, { email }) => {
      if (outcome.type === 'accepted') {
        setSentTo(email)
        return
      }
      setSays(afterRefusal(outcome))
    },
  })

  const submit = (values: FormData): void => {
    const read = readRegistration(values)
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    registration.mutate(read.value)
  }

  if (sentTo !== null) {
    return <VerificationSent email={sentTo} />
  }

  return (
    <>
      <PageHeader
        title={say(words.title)}
        description={say(words.description)}
      />
      <Form
        submitLabel={say(words.submit)}
        message={said.message}
        errors={says.errors}
        pending={registration.isPending}
        onSubmit={submit}
      >
        <TextField
          label={say(signInForm.email)}
          name='email'
          type='email'
          autoComplete='username'
          required
          description={say(words.emailDescription)}
          error={said.errors['email']}
        />
        <PasswordField
          label={say(signInForm.password)}
          name='password'
          autoComplete='new-password'
          required
          description={say(PASSWORD_RULE)}
          error={said.errors['password']}
        />
      </Form>
      <p>
        {say(words.haveAccountWithLink.before)}
        <Link to='/sign-in'>{say(words.haveAccountWithLink.link)}</Link>
        {say(words.haveAccountWithLink.after)}
      </p>
    </>
  )
}
