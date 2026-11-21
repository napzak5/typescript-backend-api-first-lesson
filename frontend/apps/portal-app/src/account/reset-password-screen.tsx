import { PASSWORD_RULE } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  Form,
  PageHeader,
  PasswordField,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { match, P } from 'ts-pattern'
import { type FormSays, NOTHING_TO_SAY } from '../forms'
import { checkPasswordReset, resetPassword } from './account-api'
import { afterRefusal, readNewPassword } from './account-flow'
import { CheckingLink, LinkNotChecked, LinkUnusable } from './mailed-link'
import { useMailedToken } from './mailed-token'

const TITLE = 'パスワードの再設定'

const LINK_REFUSED: { type: 'tokenRefused' } = { type: 'tokenRefused' }

const AskAgain = () => (
  <ButtonLink href='/forgot-password'>再設定のメールをもう一度送る</ButtonLink>
)

const ResetWithToken = ({ token }: { token: string }) => {
  // Asked once for this screen, and forgotten with it: the answer is about
  // a token that the next screen does not have
  const check = useQuery({
    queryKey: ['account', 'password-reset', token],
    queryFn: () => checkPasswordReset(token),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  })
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)
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
          title='パスワードを変更しました'
          description='このアカウントは、すべての端末でサインアウトされました。新しいパスワードでサインインしてください。'
        />
        <ButtonLink href='/sign-in'>サインインする</ButtonLink>
      </>
    )
  }

  return match(ended === 'linkRefused' ? LINK_REFUSED : check.data)
    .with(undefined, () => <CheckingLink title={TITLE} />)
    .with({ type: 'accepted' }, () => (
      <>
        <PageHeader
          title={TITLE}
          description='新しいパスワードを決めてください。'
        />
        <Form
          submitLabel='パスワードを変更する'
          message={says.message}
          errors={says.errors}
          pending={reset.isPending}
          onSubmit={submit}
        >
          <PasswordField
            label='新しいパスワード'
            name='newPassword'
            autoComplete='new-password'
            required
            description={PASSWORD_RULE}
            error={says.errors['newPassword']}
          />
        </Form>
      </>
    ))
    .with({ type: 'tokenRefused' }, () => (
      <LinkUnusable description='リンクの有効期間（30 分）が過ぎたか、すでに使われています。再設定のメールを、もう一度お送りします。'>
        <AskAgain />
      </LinkUnusable>
    ))
    .with(
      { type: P.union('invalid', 'tooManyAttempts', 'failed') },
      (refusal) => (
        <LinkNotChecked
          title={TITLE}
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
    <LinkUnusable description='このページは、再設定のメールのリンクから開いてください。メールが見つからないときは、もう一度お送りします。'>
      <AskAgain />
    </LinkUnusable>
  ) : (
    <ResetWithToken key={token} token={token} />
  )
}
