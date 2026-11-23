import type { ModelsUserRoleType } from '@beauty-salon-frontend/api-client'
import { useNotifications } from '@beauty-salon-frontend/ui'
import { sessionMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { ReactNode } from 'react'
import { signOut } from '../api/sign-out'
import { SessionGate } from '../components/session-gate/session-gate'
import { useSession } from '../hooks/use-session'
import { SignInScreen } from './sign-in-screen'

/** Signs out and says so, where the application shows its notifications. */
export const useSignOut = (): (() => void) => {
  const { notify } = useNotifications()

  return () => {
    void signOut().then(() =>
      notify({ tone: 'success', message: sessionMessages.signedOut }),
    )
  }
}

export type RequireSessionProps = {
  /** The roles the screens inside are for */
  roles: readonly ModelsUserRoleType[]
  /** Said on the sign-in screen: why the screens inside ask for an account */
  signInNotice?: string | undefined
  /**
   * Shown under the sign-in form: the ways on for somebody who cannot sign
   * in, as links of the application
   */
  signInHelp?: ReactNode
  children: ReactNode
}

/**
 * The screens inside are for signed-in users of `roles`. Somebody who is not
 * signed in gets the sign-in screen in their place, at the address that was
 * asked for: after signing in, the screen of that address is what they see,
 * without having been sent anywhere.
 */
export const RequireSession = ({
  roles,
  signInNotice,
  signInHelp,
  children,
}: RequireSessionProps) => {
  const session = useSession()
  const signOutAndSay = useSignOut()

  return (
    <SessionGate
      session={session}
      roles={roles}
      signIn={<SignInScreen notice={signInNotice} help={signInHelp} />}
      onSignOut={signOutAndSay}
    >
      {children}
    </SessionGate>
  )
}
