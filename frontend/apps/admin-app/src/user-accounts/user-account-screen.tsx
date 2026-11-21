import { NOT_FOUND, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { useSignedInUserId } from '../staff/with-staff-member'
import { accountKeyOf } from '../staff-accounts/accounts-api'
import { useAdministersAccounts } from './administers-accounts'
import { AccountUnlock } from './components/account-unlock/account-unlock'
import { TwoFactorReset } from './components/two-factor-reset/two-factor-reset'
import { UserRecord } from './components/user-record/user-record'
import {
  ADMINISTRATORS_ONLY,
  afterTwoFactorReset,
  afterUnlocking,
  NOTHING_TO_DO,
  OWN_ACCOUNT,
  supportOf,
} from './user-accounts'
import {
  readUser,
  resetTwoFactor,
  type UserRead,
  unlockAccount,
  userKeyOf,
} from './user-accounts-api'

const TITLE = 'ログインアカウント'

/** The way out of a screen that shows no account */
const ToTheStart = () => <ButtonLink href='/'>トップへ戻る</ButtonLink>

type AccountPartsProps = {
  user: ModelsUserResponse
  /** When the account was last put into its query: the focus moves after a write on it */
  readAt: number
}

/**
 * The account of the address, and what an administrator does with it:
 * its lock lifted at once, its second factor reset after a dialog. An
 * operation is offered while the account is in the state the API takes
 * it in, never on the administrator's own account. What a write answered
 * is shown at once, and the heading of the record takes the focus, where
 * the button that was pressed was; what changed meanwhile is read anew
 * and said above the record.
 */
const AccountParts = ({ user, readAt }: AccountPartsProps) => {
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const support = supportOf(user, new Date(), useSignedInUserId())
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const heading = useRef<HTMLHeadingElement>(null)
  /** Whether the focus goes to the heading once the account is shown anew */
  const toHeading = useRef(false)
  const [meanwhile, setMeanwhile] = useState<string>()
  const [unlockMessage, setUnlockMessage] = useState<string>()
  const [asking, setAsking] = useState(false)
  const [resetMessage, setResetMessage] = useState<string>()
  const [resetRefusal, setResetRefusal] = useState<string>()

  useLayoutEffect(() => {
    if (toHeading.current && readAt > 0) {
      toHeading.current = false
      heading.current?.focus()
    }
  }, [readAt])

  /** The account of a member of the staff is shown on the screen of their account too, as it was read there */
  const forgetElsewhere = (): void => {
    if (user.staffId !== null) {
      queryClient.removeQueries({ queryKey: accountKeyOf(user.staffId) })
    }
  }

  const show = (changed: ModelsUserResponse, message: string): void => {
    forgetElsewhere()
    setMeanwhile(undefined)
    setUnlockMessage(undefined)
    setResetRefusal(undefined)
    toHeading.current = true
    const read: UserRead = { type: 'found', user: changed }
    queryClient.setQueryData(userKeyOf(user.id), read)
    notify({ tone: 'success', message })
  }

  const readAnew = (message: string): void => {
    forgetElsewhere()
    setMeanwhile(message)
    toHeading.current = true
    void queryClient.invalidateQueries({ queryKey: userKeyOf(user.id) })
  }

  /** The account was deleted meanwhile: the screen says it is not found */
  const gone = (): void => {
    forgetElsewhere()
    queryClient.setQueryData(userKeyOf(user.id), NOT_FOUND)
  }

  const unlock = useMutation({
    mutationFn: () => unlockAccount(user.id),
    onSuccess: (outcome) =>
      match(afterUnlocking(outcome, user.email))
        .with({ type: 'done' }, ({ user: changed, message }) =>
          show(changed, message),
        )
        .with({ type: 'meanwhile' }, ({ message }) => readAnew(message))
        .with({ type: 'gone' }, gone)
        .with({ type: P.union('again', 'refused') }, ({ message }) =>
          setUnlockMessage(message),
        )
        .exhaustive(),
  })

  const reset = useMutation({
    mutationFn: () => resetTwoFactor(user.id),
    onSuccess: (outcome) =>
      match(afterTwoFactorReset(outcome, user.email))
        .with({ type: 'done' }, ({ user: changed, message }) => {
          setAsking(false)
          show(changed, message)
        })
        .with({ type: 'meanwhile' }, ({ message }) => {
          setAsking(false)
          readAnew(message)
        })
        .with({ type: 'gone' }, () => {
          setAsking(false)
          gone()
        })
        .with({ type: 'again' }, ({ message }) => setResetMessage(message))
        .with({ type: 'refused' }, ({ message }) => {
          setAsking(false)
          setResetRefusal(message)
        })
        .exhaustive(),
  })

  return (
    <>
      {match(support)
        .with({ type: 'own' }, () => <p>{OWN_ACCOUNT}</p>)
        .with({ type: P.union('none', 'some') }, () => null)
        .exhaustive()}
      <UserRecord
        user={user}
        now={new Date()}
        timezone={timezone}
        headingRef={heading}
        meanwhile={meanwhile}
      />
      {support.type === 'none' && <p>{NOTHING_TO_DO}</p>}
      {support.type === 'some' && support.unlock && (
        <AccountUnlock
          pending={unlock.isPending}
          message={unlockMessage}
          onUnlock={() => {
            setUnlockMessage(undefined)
            unlock.mutate()
          }}
        />
      )}
      {support.type === 'some' && support.reset && (
        <TwoFactorReset
          email={user.email}
          refusal={resetRefusal}
          asking={asking}
          pending={reset.isPending}
          message={resetMessage}
          onAsk={() => {
            setResetMessage(undefined)
            setResetRefusal(undefined)
            setAsking(true)
          }}
          onClose={() => setAsking(false)}
          onReset={() => {
            setResetMessage(undefined)
            reset.mutate()
          }}
        />
      )}
    </>
  )
}

type AccountPageProps = { userId: string }

/** The account of the address, read whenever the screen opens: users sign in, and get locked, at any time. */
const AccountPage = ({ userId }: AccountPageProps) => {
  const read = useQuery({
    queryKey: userKeyOf(userId),
    queryFn: () => readUser(userId),
    staleTime: 0,
  })

  return (
    <>
      <PageHeader
        title={TITLE}
        description={
          read.data?.type === 'found' ? read.data.user.email : undefined
        }
      />
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='アカウントを読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ user }) => (
          <AccountParts key={user.id} user={user} readAt={read.dataUpdatedAt} />
        ))
        .with({ type: 'notFound' }, () => (
          <>
            <p>
              このアカウントは見つかりません。削除されたか、アドレスが違います。
            </p>
            <ToTheStart />
          </>
        ))
        .with({ type: 'forbidden' }, () => (
          <>
            <p>{ADMINISTRATORS_ONLY}</p>
            <ToTheStart />
          </>
        ))
        .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('アカウント', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}

/**
 * The account a user of any role signs in with, for an administrator who
 * answers the user: whether it can sign in and why not, its lock lifted,
 * and its second factor reset. Another role is told who does it, and the
 * API is not asked.
 */
export const UserAccountScreen = () => {
  const { userId = '' } = useParams()
  const administers = useAdministersAccounts()

  return administers ? (
    <AccountPage userId={userId} />
  ) : (
    <>
      <PageHeader title={TITLE} />
      <p>{ADMINISTRATORS_ONLY}</p>
      <ToTheStart />
    </>
  )
}
