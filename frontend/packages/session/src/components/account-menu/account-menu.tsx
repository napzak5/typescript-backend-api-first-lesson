import {
  Button,
  ButtonLink,
  useInMenu,
  useWideScreen,
  VisuallyHidden,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { Session } from '../../hooks/use-session'
import styles from './account-menu.module.css'

export type AccountMenuProps = {
  /** Who uses the application now: what `useSession` returns */
  session: Session
  /**
   * Where somebody who is not signed in signs in, in an application that
   * has screens for everybody. Without it nothing is shown to them.
   */
  signInHref?: string | undefined
  /**
   * The screen of the security of the account (the password, the devices
   * that are signed in), in an application that has no page of its own for
   * the account. Without it the menu leads nowhere but out.
   */
  securityHref?: string | undefined
  onSignOut: () => void
}

/**
 * What the header of an application says about the account: who is signed
 * in, with the way out, or the way in. It goes into `account` of `AppShell`.
 *
 * In the menu of a narrow screen it has the width of the screen: the
 * address is shown whole, and the buttons are as high as the links above
 * them, for a finger. A narrow header (one without a menu) has room for
 * the name and for the way out only: there the address is out of sight,
 * and still read.
 */
export const AccountMenu = ({
  session,
  signInHref,
  securityHref,
  onSignOut,
}: AccountMenuProps) => {
  const inMenu = useInMenu()
  const wide = useWideScreen()
  const size = inMenu ? 'medium' : 'small'

  return match(session)
    .with({ type: 'signedIn' }, ({ user }) => (
      <>
        {inMenu || wide ? (
          <span className={inMenu ? styles['userInMenu'] : styles['user']}>
            {user.email}
          </span>
        ) : (
          <VisuallyHidden>{user.email}</VisuallyHidden>
        )}
        {securityHref !== undefined && (
          <ButtonLink href={securityHref} variant='quiet' size={size}>
            アカウントの安全
          </ButtonLink>
        )}
        <Button variant='quiet' size={size} onClick={onSignOut}>
          サインアウト
        </Button>
      </>
    ))
    .with({ type: 'signedOut' }, () =>
      signInHref === undefined ? null : (
        <ButtonLink href={signInHref} size='small'>
          サインイン
        </ButtonLink>
      ),
    )
    .with({ type: 'loading' }, { type: 'unavailable' }, () => null)
    .exhaustive()
}
