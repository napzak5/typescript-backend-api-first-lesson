import type { ModelsUserRoleType } from '@beauty-salon-frontend/api-client'
import { useNotifications } from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { SessionGate } from './components/session-gate/session-gate'
import { SignInScreen } from './components/sign-in-screen/sign-in-screen'
import { signOut } from './sign-out'
import { useSession } from './use-session'

/** Signs out and says so, where the application shows its notifications. */
export const useSignOut = (): (() => void) => {
  const { notify } = useNotifications()

  return () => {
    void signOut().then(() =>
      notify({ tone: 'success', message: 'サインアウトしました。' }),
    )
  }
}

export type RequireSessionProps = {
  /** The roles the screens inside are for */
  roles: readonly ModelsUserRoleType[]
  children: ReactNode
}

/**
 * The screens inside are for signed-in users of `roles`. Somebody who is not
 * signed in gets the sign-in screen in their place, at the address that was
 * asked for: after signing in, the screen of that address is what they see,
 * without having been sent anywhere.
 */
export const RequireSession = ({ roles, children }: RequireSessionProps) => {
  const session = useSession()
  const signOutAndSay = useSignOut()

  return (
    <SessionGate
      session={session}
      roles={roles}
      signIn={<SignInScreen />}
      onSignOut={signOutAndSay}
    >
      {children}
    </SessionGate>
  )
}
