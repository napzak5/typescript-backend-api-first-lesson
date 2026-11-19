import { Form, PageHeader, TextField } from '@beauty-salon-frontend/ui'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { type FormSays, NOTHING_TO_SAY } from '../forms'
import { requestPasswordReset } from './account-api'
import { afterRefusal, readEmail } from './account-flow'

/**
 * Where somebody who cannot sign in asks for the mail with which a password
 * is set anew. What it says afterwards is the same for an address that has
 * an account and for one that has none, as the answer of the API is.
 */
export const ForgotPasswordScreen = () => {
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
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
        <PageHeader title='再設定のメールを送りました' />
        <p>
          {sentTo}{' '}
          のアカウントがあれば、パスワードを再設定するためのメールを送りました。メールのリンクを開いて、新しいパスワードを決めてください。リンクは
          30 分間有効です。
        </p>
        <p>
          メールが届かないときは、迷惑メールのフォルダーと、入力したメールアドレスをお確かめください。続けて送れるのは、1
          分に 1 回までです。
        </p>
        <p>
          <Link to='/sign-in'>サインインの画面に戻る</Link>
        </p>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title='パスワードの再設定'
        description='登録したメールアドレスに、パスワードを再設定するためのリンクをお送りします。'
      />
      <Form
        submitLabel='再設定のメールを送る'
        message={says.message}
        errors={says.errors}
        pending={request.isPending}
        onSubmit={submit}
      >
        <TextField
          label='メールアドレス'
          name='email'
          type='email'
          autoComplete='username'
          required
          error={says.errors['email']}
        />
      </Form>
      <p>
        <Link to='/sign-in'>サインインの画面に戻る</Link>
      </p>
    </>
  )
}
