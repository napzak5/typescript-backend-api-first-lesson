import {
  Alert,
  Button,
  ButtonLink,
  Form,
  PageHeader,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { match, P } from 'ts-pattern'
import { type FormSays, NOTHING_TO_SAY } from '../forms'
import { confirmEmail, sendVerificationAgain } from './account-api'
import { afterRefusal, messageAfter, readEmail } from './account-flow'
import { useMailedToken } from './mailed-token'
import { VerificationSent } from './verification-sent'

type AskForAnotherMailProps = {
  title: string
  /** Why this screen cannot confirm the address */
  children: string
}

/** Where somebody whose link does not work asks for another mail. */
const AskForAnotherMail = ({ title, children }: AskForAnotherMailProps) => {
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const sending = useMutation({
    mutationFn: sendVerificationAgain,
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
    sending.mutate(read.value)
  }

  if (sentTo !== null) {
    return <VerificationSent email={sentTo} />
  }

  return (
    <>
      <PageHeader title={title} description={children} />
      <Form
        submitLabel='確認メールを送る'
        message={says.message}
        errors={says.errors}
        pending={sending.isPending}
        onSubmit={submit}
      >
        <TextField
          label='メールアドレス'
          name='email'
          type='email'
          autoComplete='username'
          required
          description='登録したメールアドレスに、確認メールをもう一度お送りします。'
          error={says.errors['email']}
        />
      </Form>
      <p>
        確認がすでに済んでいれば、そのまま
        <Link to='/sign-in'>サインイン</Link>できます。
      </p>
    </>
  )
}

type Step =
  | { type: 'ready'; message: string | undefined }
  | { type: 'confirmed' }
  | { type: 'linkRefused' }

const ConfirmWithToken = ({ token }: { token: string }) => {
  const [step, setStep] = useState<Step>({ type: 'ready', message: undefined })
  const confirmation = useMutation({
    mutationFn: confirmEmail,
    onSuccess: (outcome) => {
      setStep(
        match(outcome)
          .returnType<Step>()
          .with({ type: 'accepted' }, () => ({ type: 'confirmed' }))
          .with({ type: 'tokenRefused' }, () => ({ type: 'linkRefused' }))
          .with(
            { type: P.union('invalid', 'tooManyAttempts', 'failed') },
            (refusal) => ({ type: 'ready', message: messageAfter(refusal) }),
          )
          .exhaustive(),
      )
    },
  })

  return match(step)
    .with({ type: 'ready' }, ({ message }) => (
      <>
        <PageHeader
          title='メールアドレスの確認'
          description='ボタンを押すと、メールアドレスの確認が済み、アカウントを使えるようになります。'
        />
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
        <p>
          <Button
            variant='primary'
            pending={confirmation.isPending}
            onClick={() => confirmation.mutate(token)}
          >
            メールアドレスを確認する
          </Button>
        </p>
      </>
    ))
    .with({ type: 'confirmed' }, () => (
      <>
        <PageHeader
          title='メールアドレスを確認しました'
          description='登録が完了しました。登録したメールアドレスとパスワードでサインインしてください。'
        />
        <p>
          <ButtonLink href='/sign-in'>サインインする</ButtonLink>
        </p>
      </>
    ))
    .with({ type: 'linkRefused' }, () => (
      <AskForAnotherMail title='このリンクは使えません'>
        リンクの有効期間（24
        時間）が過ぎたか、すでに使われています。新しいリンクをお送りします。
      </AskForAnotherMail>
    ))
    .exhaustive()
}

/**
 * Where the link of the mail that confirms an address leads. Opening it
 * changes nothing: the address is confirmed when the button is pressed, so
 * that software which opens the links of a mail ahead of its reader does
 * not use the link up.
 */
export const VerifyEmailScreen = () => {
  const token = useMailedToken()

  return token === null ? (
    <AskForAnotherMail title='メールアドレスの確認'>
      このページは、確認メールのリンクから開いてください。メールが見つからないときは、新しいリンクをお送りします。
    </AskForAnotherMail>
  ) : (
    <ConfirmWithToken token={token} />
  )
}
