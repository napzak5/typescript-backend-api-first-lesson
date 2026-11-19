import { AccountMenu } from './components/account-menu/account-menu'
import { useSignOut } from './require-session'
import { useSession } from './use-session'

export type SessionAccountProps = {
  /**
   * The address of the sign-in screen, in an application that has screens
   * for everybody. An application that is all behind `RequireSession` needs
   * none: its sign-in screen is shown wherever somebody is not signed in.
   */
  signInHref?: string | undefined
  /**
   * The screen of the security of the account, in an application that has
   * no page of its own for the account: the header leads to it
   */
  securityHref?: string | undefined
}

/** The account of the session of the application, for `account` of `AppShell`. */
export const SessionAccount = ({
  signInHref,
  securityHref,
}: SessionAccountProps) => {
  const session = useSession()
  const signOutAndSay = useSignOut()

  return (
    <AccountMenu
      session={session}
      signInHref={signInHref}
      securityHref={securityHref}
      onSignOut={signOutAndSay}
    />
  )
}
