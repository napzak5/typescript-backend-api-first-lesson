import {
  Alert,
  Button,
  PageHeader,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalAccountMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { sendVerificationAgain } from '../api/account-api'
import { messageAfter } from '../utils/account-flow'

const { verificationSent: words } = portalAccountMessages
const { notArrivedWithLinks: notArrived } = words

type VerificationSentProps = {
  /** The address that was typed. Whether it has an account is not known here */
  email: string
}

/**
 * What a person reads after asking for the mail that confirms an address.
 * It says the same whether or not a mail was sent: the API answers alike
 * for an address that has an account and for one that has none, and so
 * does the screen.
 */
export const VerificationSent = ({ email }: VerificationSentProps) => {
  const say = useSay()
  const { notify } = useNotifications()
  const [message, setMessage] = useState<LocalizedText | undefined>(undefined)
  const sending = useMutation({
    mutationFn: sendVerificationAgain,
    onSuccess: (outcome) => {
      if (outcome.type === 'accepted') {
        setMessage(undefined)
        notify({ tone: 'success', message: words.sentAgain })
        return
      }
      setMessage(messageAfter(outcome))
    },
  })

  return (
    <>
      <PageHeader title={say(words.title)} />
      {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      <p>{say(words.sentTo(email))}</p>
      <p>
        {say(notArrived.before)}
        <Link to='/sign-in'>{say(notArrived.signIn)}</Link>
        {say(notArrived.between)}
        <Link to='/forgot-password'>{say(notArrived.reset)}</Link>
        {say(notArrived.after)}
      </p>
      <Button pending={sending.isPending} onClick={() => sending.mutate(email)}>
        {say(words.sendAgain)}
      </Button>
      <p>{say(words.oncePerMinute)}</p>
    </>
  )
}
