import {
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { match, P } from 'ts-pattern'
import { PasswordChangeForm } from './components/password-change-form/password-change-form'
import { changePassword, OWN_ACCOUNT_PARTS } from './security-api'
import { afterPasswordChange, readPasswordChange } from './security-flow'

export type PasswordChangeScreenProps = {
  /** The address of the screen of the security of the account: the way back */
  securityHref: string
  /** The password was changed: the application goes back to the screen of the security of the account */
  onChanged: () => void
}

/**
 * Changes the password of the account of the session. The API signs every
 * other device out and mails the account; this device stays signed in.
 */
export const PasswordChangeScreen = ({
  securityHref,
  onChanged,
}: PasswordChangeScreenProps) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays>(NOTHING_TO_SAY)

  const change = useMutation({
    mutationFn: changePassword,
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'changed' }, () => {
          // The screen it goes back to reads the account and its devices
          // anew, and shows nothing of what was read before
          queryClient.removeQueries({ queryKey: OWN_ACCOUNT_PARTS })
          notify({
            tone: 'success',
            message:
              'パスワードを変更しました。この端末のほかは、すべての端末でサインアウトしました。変更したことを、メールでお知らせしました。',
          })
          onChanged()
        })
        .with(
          { type: P.union('invalid', 'tooManyRequests', 'failed') },
          (refusal) => setSays(afterPasswordChange(refusal)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void => {
    const read = readPasswordChange(values)
    if (read.type === 'invalid') {
      setSays({ message: undefined, errors: read.errors })
      return
    }
    change.mutate(read.value)
  }

  return (
    <>
      <PageHeader
        title='パスワードを変更する'
        description='変更すると、この端末のほかは、すべての端末でサインアウトします。'
      />
      <PasswordChangeForm
        message={says.message}
        errors={says.errors}
        pending={change.isPending}
        cancelHref={securityHref}
        onSubmit={submit}
      />
    </>
  )
}
