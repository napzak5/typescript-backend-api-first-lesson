import { PASSWORD_RULE } from '@beauty-salon-frontend/session'
import {
  Form,
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  PasswordField,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { register } from '../api/account-api'
import { afterRefusal, readRegistration } from '../utils/account-flow'
import { VerificationSent } from './verification-sent'

/**
 * Where a visitor creates an account: an address and a password. The
 * account can be used once the address is confirmed, through the link of
 * the mail that the API sends.
 */
export const RegisterScreen = () => {
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
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
        title='アカウントの登録'
        description='メールアドレスとパスワードを登録すると、予約やその確認ができるようになります。'
      />
      <Form
        submitLabel='登録する'
        message={says.message}
        errors={says.errors}
        pending={registration.isPending}
        onSubmit={submit}
      >
        <TextField
          label='メールアドレス'
          name='email'
          type='email'
          autoComplete='username'
          required
          description='確認のメールをお送りします。'
          error={says.errors['email']}
        />
        <PasswordField
          label='パスワード'
          name='password'
          autoComplete='new-password'
          required
          description={PASSWORD_RULE}
          error={says.errors['password']}
        />
      </Form>
      <p>
        すでにアカウントをお持ちの方は、
        <Link to='/sign-in'>サインイン</Link>してください。
      </p>
    </>
  )
}
