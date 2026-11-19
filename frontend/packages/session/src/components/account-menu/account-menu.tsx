import { Button, ButtonLink } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { Session } from '../../use-session'
import styles from './account-menu.module.css'

export type AccountMenuProps = {
  /** Who uses the application now: what `useSession` returns */
  session: Session
  /**
   * Where somebody who is not signed in signs in, in an application that
   * has screens for everybody. Without it nothing is shown to them.
   */
  signInHref?: string | undefined
  onSignOut: () => void
}

/**
 * What the header of an application says about the account: who is signed
 * in, with the way out, or the way in. It goes into `account` of `AppShell`.
 */
export const AccountMenu = ({
  session,
  signInHref,
  onSignOut,
}: AccountMenuProps) =>
  match(session)
    .with({ type: 'signedIn' }, ({ user }) => (
      <>
        <span className={styles['user']}>{user.email}</span>
        <Button variant='quiet' size='small' onClick={onSignOut}>
          サインアウト
        </Button>
      </>
    ))
    .with({ type: 'signedOut' }, () =>
      signInHref === undefined ? null : (
        <ButtonLink href={signInHref} variant='secondary' size='small'>
          サインイン
        </ButtonLink>
      ),
    )
    .with({ type: 'loading' }, { type: 'unavailable' }, () => null)
    .exhaustive()
