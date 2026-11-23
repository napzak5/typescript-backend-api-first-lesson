import {
  Alert,
  Button,
  ButtonLink,
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
import { match, P } from 'ts-pattern'
import { confirmEmail, sendVerificationAgain } from '../api/account-api'
import { useMailedToken } from '../hooks/mailed-token'
import { afterRefusal, messageAfter, readEmail } from '../utils/account-flow'
import { VerificationSent } from './verification-sent'

const { verifyEmail: words } = portalAccountMessages
const { alreadyConfirmedWithLink: alreadyConfirmed } = words

type AskForAnotherMailProps = {
  title: LocalizedText
  /** Why this screen cannot confirm the address */
  description: LocalizedText
}

/** Where somebody whose link does not work asks for another mail. */
const AskForAnotherMail = ({ title, description }: AskForAnotherMailProps) => {
  const say = useSay()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const said = useSaidForm(says.message, says.errors)
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
      <PageHeader title={say(title)} description={say(description)} />
      <Form
        submitLabel={say(words.send)}
        message={said.message}
        errors={says.errors}
        pending={sending.isPending}
        onSubmit={submit}
      >
        <TextField
          label={say(sessionMessages.signInForm.email)}
          name='email'
          type='email'
          autoComplete='username'
          required
          description={say(words.emailDescription)}
          error={said.errors['email']}
        />
      </Form>
      <p>
        {say(alreadyConfirmed.before)}
        <Link to='/sign-in'>{say(alreadyConfirmed.link)}</Link>
        {say(alreadyConfirmed.after)}
      </p>
    </>
  )
}

type Step =
  | { type: 'ready'; message: LocalizedText | undefined }
  | { type: 'confirmed' }
  | { type: 'linkRefused' }

const ConfirmWithToken = ({ token }: { token: string }) => {
  const say = useSay()
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
          title={say(words.title)}
          description={say(words.description)}
        />
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
        <Button
          variant='primary'
          pending={confirmation.isPending}
          onClick={() => confirmation.mutate(token)}
        >
          {say(words.confirm)}
        </Button>
      </>
    ))
    .with({ type: 'confirmed' }, () => (
      <>
        <PageHeader
          title={say(words.confirmed)}
          description={say(words.confirmedDescription)}
        />
        <ButtonLink href='/sign-in'>
          {say(portalAccountMessages.signIn)}
        </ButtonLink>
      </>
    ))
    .with({ type: 'linkRefused' }, () => (
      <AskForAnotherMail
        title={portalAccountMessages.mailedLink.unusable}
        description={words.expired}
      />
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
    <AskForAnotherMail title={words.title} description={words.noLink} />
  ) : (
    <ConfirmWithToken key={token} token={token} />
  )
}
