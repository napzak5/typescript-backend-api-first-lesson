import type { ModelsUserRoleType } from '@beauty-salon-frontend/api-client'
import {
  Button,
  LoadingIndicator,
  PageHeader,
  useSay,
} from '@beauty-salon-frontend/ui'
import { sessionMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { Session } from '../../hooks/use-session'

const { sessionGate } = sessionMessages

export type SessionGateProps = {
  /** Who uses the application now: what `useSession` returns */
  session: Session
  /** The roles the content is for */
  roles: readonly ModelsUserRoleType[]
  /** What somebody who is not signed in is shown instead: the sign-in screen */
  signIn: ReactNode
  onSignOut: () => void
  /** What is shown to a signed-in user of one of the roles */
  children: ReactNode
}

/**
 * Shows its content to a signed-in user of one of `roles`, and says to
 * everybody else what stands in the way: nobody is signed in, the session
 * could not be checked, or the account is for another application.
 *
 * It only shows. `RequireSession` gives it the session of the application.
 */
export const SessionGate = ({
  session,
  roles,
  signIn,
  onSignOut,
  children,
}: SessionGateProps) => {
  const say = useSay()

  return match(session)
    .with({ type: 'loading' }, () => (
      <LoadingIndicator label={say(sessionGate.checking)} />
    ))
    .with({ type: 'signedOut' }, () => signIn)
    .with({ type: 'unavailable' }, ({ retry }) => (
      <>
        <PageHeader
          title={say(sessionGate.unavailable)}
          description={say(sessionGate.unavailableDescription)}
        />
        <Button onClick={retry}>{say(sessionGate.tryAgain)}</Button>
      </>
    ))
    .with({ type: 'signedIn' }, ({ user }) =>
      roles.includes(user.role) ? (
        children
      ) : (
        <>
          <PageHeader
            title={say(sessionGate.notForAccount)}
            description={say(sessionGate.notForAccountDescription(user.email))}
          />
          <Button onClick={onSignOut}>{say(sessionMessages.signOut)}</Button>
        </>
      ),
    )
    .exhaustive()
}
