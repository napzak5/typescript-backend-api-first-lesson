import type { ModelsUserRoleType } from '@beauty-salon-frontend/api-client'
import { Button, LoadingIndicator, PageHeader } from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { Session } from '../../use-session'

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
}: SessionGateProps) =>
  match(session)
    .with({ type: 'loading' }, () => (
      <LoadingIndicator label='サインインを確認しています' />
    ))
    .with({ type: 'signedOut' }, () => signIn)
    .with({ type: 'unavailable' }, ({ retry }) => (
      <>
        <PageHeader
          title='サインインを確認できません'
          description='通信の状態を確かめて、もう一度お試しください。'
        />
        <p>
          <Button onClick={retry}>もう一度試す</Button>
        </p>
      </>
    ))
    .with({ type: 'signedIn' }, ({ user }) =>
      roles.includes(user.role) ? (
        children
      ) : (
        <>
          <PageHeader
            title='このアプリケーションは利用できません'
            description={`${user.email} のアカウントでは利用できません。利用できるアカウントでサインインし直してください。`}
          />
          <p>
            <Button onClick={onSignOut}>サインアウト</Button>
          </p>
        </>
      ),
    )
    .exhaustive()
