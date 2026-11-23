import {
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { match, P } from 'ts-pattern'
import { changePassword, OWN_ACCOUNT_PARTS } from '../api/security-api'
import { PasswordChangeForm } from '../components/password-change-form/password-change-form'
import { afterPasswordChange, readPasswordChange } from '../utils/security-flow'

const { password } = securityMessages

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
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)

  const change = useMutation({
    mutationFn: changePassword,
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'changed' }, () => {
          // The screen it goes back to reads the account and its devices
          // anew, and shows nothing of what was read before
          queryClient.removeQueries({ queryKey: OWN_ACCOUNT_PARTS })
          notify({ tone: 'success', message: password.changed })
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
        title={say(password.change)}
        description={say(password.changeDescription)}
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
