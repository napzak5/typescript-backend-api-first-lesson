import { PASSWORD_RULE } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  Form,
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  PasswordField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalAccountMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { match, P } from 'ts-pattern'
import {
  checkPasswordReset,
  resetPassword,
  TOKEN_REFUSED,
} from '../api/account-api'
import { useMailedToken } from '../hooks/mailed-token'
import { afterRefusal, readNewPassword } from '../utils/account-flow'
import { CheckingLink, LinkNotChecked, LinkUnusable } from './mailed-link'

const { passwordReset: words } = portalAccountMessages
const { password } = securityMessages

const AskAgain = () => {
  const say = useSay()

  return <ButtonLink href='/forgot-password'>{say(words.sendAgain)}</ButtonLink>
}

const ResetWithToken = ({ token }: { token: string }) => {
  // Asked once for this screen, and forgotten with it: the answer is about
  // a token that the next screen does not have
  const check = useQuery({
    queryKey: ['account', 'password-reset', token],
    queryFn: () => checkPasswordReset(token),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  })
  const say = useSay()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const said = useSaidForm(says.message, says.errors)
  const [ended, setEnded] = useState<'changed' | 'linkRefused' | null>(null)
  const reset = useMutation({
    mutationFn: (newPassword: string) => resetPassword(token, newPassword),
    onSuccess: (outcome) => {
      match(outcome)
        .with({ type: 'accepted' }, () => setEnded('changed'))
        .with({ type: 'tokenRefused' }, () => setEnded('linkRefused'))
        .with(
          { type: P.union('invalid', 'tooManyAttempts', 'failed') },
          (refusal) => setSays(afterRefusal(refusal)),
        )
        .exhaustive()
    },
  })

  const submit = (values: FormData): void => {
    const read = readNewPassword(values, 'newPassword')
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    reset.mutate(read.value)
  }

  if (ended === 'changed') {
    return (
      <>
        <PageHeader
          title={say(words.changed)}
          description={say(words.changedDescription)}
        />
        <ButtonLink href='/sign-in'>
          {say(portalAccountMessages.signIn)}
        </ButtonLink>
      </>
    )
  }

  return match(ended === 'linkRefused' ? TOKEN_REFUSED : check.data)
    .with(undefined, () => <CheckingLink title={words.title} />)
    .with({ type: 'accepted' }, () => (
      <>
        <PageHeader
          title={say(words.title)}
          description={say(words.chooseNew)}
        />
        <Form
          submitLabel={say(password.change)}
          message={said.message}
          errors={says.errors}
          pending={reset.isPending}
          onSubmit={submit}
        >
          <PasswordField
            label={say(password.new)}
            name='newPassword'
            autoComplete='new-password'
            required
            description={say(PASSWORD_RULE)}
            error={said.errors['newPassword']}
          />
        </Form>
      </>
    ))
    .with({ type: 'tokenRefused' }, () => (
      <LinkUnusable description={words.expired}>
        <AskAgain />
      </LinkUnusable>
    ))
    .with(
      { type: P.union('invalid', 'tooManyAttempts', 'failed') },
      (refusal) => (
        <LinkNotChecked
          title={words.title}
          refusal={refusal}
          onRetry={() => void check.refetch()}
        />
      ),
    )
    .exhaustive()
}

/**
 * Where the link of the mail of a password reset leads: the new password is
 * chosen here. Whether the link still works is asked when the screen opens,
 * before a person thinks of a password; asking uses nothing up.
 */
export const ResetPasswordScreen = () => {
  const token = useMailedToken()

  return token === null ? (
    <LinkUnusable description={words.noLink}>
      <AskAgain />
    </LinkUnusable>
  ) : (
    <ResetWithToken key={token} token={token} />
  )
}
