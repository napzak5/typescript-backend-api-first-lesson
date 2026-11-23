import {
  firstCursor,
  UNREAD_TYPES,
  unreadMessageOf,
  unsentMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSessionResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  type FormSays,
  LoadingIndicator,
  moreOf,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import {
  type AccountRead,
  endSession,
  issueBackupCodes,
  OWN_ACCOUNT,
  OWN_SESSIONS,
  readOwnAccount,
  readOwnSessions,
  type SessionPage,
  signOutEverywhere,
  stopTwoFactor,
} from '../api/security-api'
import { BackupCodesDialog } from '../components/backup-codes-dialog/backup-codes-dialog'
import { SecuritySummary } from '../components/security-summary/security-summary'
import { SessionList } from '../components/session-list/session-list'
import { SignOutEverywhere } from '../components/sign-out-everywhere/sign-out-everywhere'
import { TwoFactorStopDialog } from '../components/two-factor-stop-dialog/two-factor-stop-dialog'
import {
  cursorAfter,
  endsWithGoneCursor,
  listingOf,
  withoutSession,
} from '../utils/security-flow'
import {
  afterRefusal,
  CHANGED_ELSEWHERE,
  readCode,
  readStop,
  withTwoFactorStatus,
} from '../utils/two-factor-flow'

type SessionPages = InfiniteData<SessionPage, string | undefined>

const { names, sessions, twoFactor } = securityMessages

type PartProps = {
  /** The time zone of whoever reads: the moments are said in it */
  timeZone: string
}

type DialogProps = {
  open: boolean
  onClose: () => void
  /** The second factor was not in the state the request was for */
  onChangedElsewhere: () => void
}

/** The dialog that issues new backup codes, and shows them. */
const BackupCodes = ({ open, onClose, onChangedElsewhere }: DialogProps) => {
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [issued, setIssued] = useState<string[]>()
  const issue = useMutation({
    mutationFn: issueBackupCodes,
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'issued' }, ({ backupCodes }) => setIssued(backupCodes))
        .with({ type: 'conflict' }, onChangedElsewhere)
        .with(
          { type: P.union('invalid', 'tooManyRequests', 'failed') },
          (refusal) => setSays(afterRefusal(refusal, 'appOrBackup')),
        )
        .exhaustive(),
  })

  return (
    <BackupCodesDialog
      open={open}
      onClose={onClose}
      issued={issued}
      message={says.message}
      errors={says.errors}
      pending={issue.isPending}
      onIssue={(values) => {
        const read = readCode(values, 'appOrBackup')
        if (read.type === 'invalid') {
          setSays({ message: undefined, errors: read.errors })
          return
        }
        issue.mutate(read.value)
      }}
    />
  )
}

/** The dialog that turns the second factor off. */
const StopTwoFactor = ({
  open,
  onClose,
  onChangedElsewhere,
  onStopped,
}: DialogProps & { onStopped: () => void }) => {
  const [says, setSays] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const stop = useMutation({
    mutationFn: stopTwoFactor,
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'disabled' }, onStopped)
        .with({ type: 'conflict' }, onChangedElsewhere)
        .with(
          { type: P.union('invalid', 'tooManyRequests', 'failed') },
          (refusal) => setSays(afterRefusal(refusal, 'appOrBackup')),
        )
        .exhaustive(),
  })

  return (
    <TwoFactorStopDialog
      open={open}
      onClose={onClose}
      message={says.message}
      errors={says.errors}
      pending={stop.isPending}
      onStop={(values) => {
        const read = readStop(values)
        if (read.type === 'invalid') {
          setSays({ message: undefined, errors: read.errors })
          return
        }
        stop.mutate(read.value)
      }}
    />
  )
}

/** Which dialog is open, and how many times one was: each opening begins anew. */
type Asked = { dialog: 'none' | 'backupCodes' | 'stop'; opening: number }

type AccountProps = PartProps & {
  passwordHref: string
  twoFactorHref: string
}

/** The password and the second factor, as the API has them now. */
const Account = ({ passwordHref, twoFactorHref, timeZone }: AccountProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const read = useQuery({
    queryKey: OWN_ACCOUNT,
    queryFn: readOwnAccount,
    // The password is changed, and the second factor set up, on other
    // devices too: what is shown is read whenever the screen opens
    staleTime: 0,
  })
  const [asked, setAsked] = useState<Asked>({ dialog: 'none', opening: 0 })
  const twoFactorHeading = useRef<HTMLHeadingElement>(null)
  const status =
    read.data?.type === 'found' ? read.data.user.twoFactorStatus : undefined

  const statusBefore = useRef(status)

  // In the commit that shows the state the account was read anew in,
  // before the browser paints: the button that had the focus went with the
  // state before, after a dialog of it or on its own (the second factor
  // turned off on another device)
  useLayoutEffect(() => {
    const another =
      statusBefore.current !== undefined && status !== statusBefore.current
    statusBefore.current = status
    const focusLost =
      document.activeElement === null ||
      document.activeElement === document.body
    if (another && focusLost) {
      twoFactorHeading.current?.focus()
    }
  }, [status])

  const open = (dialog: Asked['dialog']): void =>
    setAsked(({ opening }) => ({ dialog, opening: opening + 1 }))
  const close = (): void =>
    setAsked(({ opening }) => ({ dialog: 'none', opening }))
  const readAgain = (): void => {
    close()
    void queryClient.invalidateQueries({ queryKey: OWN_ACCOUNT })
  }

  return match(read.data)
    .with(undefined, () => (
      <LoadingIndicator label={say(securityMessages.loadingAccount)} />
    ))
    .with({ type: 'found' }, ({ user }) => (
      <>
        <SecuritySummary
          user={user}
          passwordHref={passwordHref}
          twoFactorHref={twoFactorHref}
          onIssueBackupCodes={() => open('backupCodes')}
          onStopTwoFactor={() => open('stop')}
          twoFactorHeadingRef={twoFactorHeading}
          timeZone={timeZone}
        />
        {/* What changes a second factor that is on: its buttons are there only then */}
        {user.twoFactorStatus === 'enabled' && (
          <>
            <BackupCodes
              key={`backup-codes-${asked.opening}`}
              open={asked.dialog === 'backupCodes'}
              onClose={close}
              onChangedElsewhere={() => {
                readAgain()
                notify({ tone: 'warning', message: CHANGED_ELSEWHERE })
              }}
            />
            <StopTwoFactor
              key={`stop-${asked.opening}`}
              open={asked.dialog === 'stop'}
              onClose={close}
              onChangedElsewhere={() => {
                readAgain()
                notify({ tone: 'warning', message: CHANGED_ELSEWHERE })
              }}
              onStopped={() => {
                // Off at once: the buttons of a second factor that is on go
                queryClient.setQueryData<AccountRead>(OWN_ACCOUNT, (account) =>
                  withTwoFactorStatus(account, 'disabled'),
                )
                readAgain()
                notify({ tone: 'success', message: twoFactor.turnedOff })
              }}
            />
          </>
        )}
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={say(unreadMessageOf(names.account, reason))}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .exhaustive()
}

/**
 * The devices the account is signed in on, and the ways to sign them out:
 * one at a time, or all of them with this one.
 */
const Sessions = ({ timeZone }: PartProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const heading = useRef<HTMLHeadingElement>(null)
  const read = useInfiniteQuery({
    queryKey: OWN_SESSIONS,
    queryFn: ({ pageParam }) => readOwnSessions(pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Devices sign in and out elsewhere: the list is read whenever it is shown
    staleTime: 0,
  })
  const [asking, setAsking] = useState(false)
  /** What went wrong with the attempt to sign out everywhere: said in the dialog */
  const [unsent, setUnsent] = useState<LocalizedText>()
  /** A device was signed out here: its button went with its row */
  const answered = useRef(false)
  const listing =
    read.data === undefined ? undefined : listingOf(read.data.pages)
  const shown = listing?.type === 'listed' ? listing.sessions.length : 0
  const shownBefore = useRef(shown)

  // In the commit that takes the row away, before the browser paints
  useLayoutEffect(() => {
    if (answered.current && shown < shownBefore.current) {
      answered.current = false
      heading.current?.focus()
    }
    shownBefore.current = shown
  }, [shown])

  const end = useMutation({
    mutationFn: ({ id }: ModelsSessionResponse) => endSession(id),
    onSuccess: (outcome, { id }) =>
      match(outcome)
        // A session that had ended already is what the person asked for
        .with({ type: P.union('ended', 'gone') }, () => {
          answered.current = true
          queryClient.setQueryData<SessionPages>(OWN_SESSIONS, (data) =>
            data === undefined
              ? data
              : { ...data, pages: withoutSession(data.pages, id) },
          )
          // The row named where the next page begins: the pages are read
          // again behind the list, from its start
          void queryClient.invalidateQueries({ queryKey: OWN_SESSIONS })
          notify({ tone: 'success', message: sessions.signedOut })
        })
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) =>
          notify({ tone: 'danger', message: unsentMessageOf(reason) }),
        )
        .exhaustive(),
  })

  const everywhere = useMutation({
    mutationFn: () => signOutEverywhere(),
    onSuccess: (outcome) =>
      match(outcome)
        // Nobody is signed in here any more: the guard of the session shows
        // the sign-in screen in place of this one
        .with({ type: 'signedOut' }, () =>
          notify({
            tone: 'success',
            message: securityMessages.everywhere.signedOut,
          }),
        )
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) =>
          setUnsent(unsentMessageOf(reason)),
        )
        .exhaustive(),
  })

  const readMore = async (): Promise<void> => {
    const next = await read.fetchNextPage()
    // The device that ended the pages before has ended since: the pages
    // are read again from the start, as many as there were
    if (next.data !== undefined && endsWithGoneCursor(next.data.pages)) {
      await read.refetch()
    }
  }

  return (
    <Card title={say(sessions.title)} headingRef={heading}>
      <p>{say(sessions.description)}</p>
      {match(listing)
        .with(undefined, () => (
          <LoadingIndicator label={say(sessions.loading)} />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.devices, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed' }, ({ sessions, total, rest }) => (
          <SessionList
            sessions={sessions}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : readMore())
            }
            ending={end.isPending ? end.variables.id : undefined}
            onEnd={(session) => end.mutate(session)}
            timeZone={timeZone}
          />
        ))
        .exhaustive()}
      <SignOutEverywhere
        open={asking}
        onOpen={() => {
          // What was said about an attempt before is said no longer
          setUnsent(undefined)
          setAsking(true)
        }}
        onClose={() => setAsking(false)}
        message={unsent}
        pending={everywhere.isPending}
        onConfirm={() => everywhere.mutate()}
      />
    </Card>
  )
}

export type AccountSecurityScreenProps = {
  /** The address of the screen that changes the password */
  passwordHref: string
  /** The address of the screen that sets the second factor up */
  twoFactorHref: string
  /** The ways out of the screen, beside its heading: 「マイページへ戻る」 */
  actions?: ReactNode
}

/**
 * How the account of the session is kept from others: when its password was
 * changed and the way to change it, whether the sign-in asks for a second
 * factor, and the devices it is signed in on, with the ways to sign them
 * out. The application puts it behind the guard of the session, at an
 * address of its own.
 */
export const AccountSecurityScreen = ({
  passwordHref,
  twoFactorHref,
  actions,
}: AccountSecurityScreenProps) => {
  const say = useSay()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <>
      <PageHeader
        title={say(securityMessages.accountSecurity)}
        description={say(securityMessages.description)}
        actions={actions}
      />
      <Account
        passwordHref={passwordHref}
        twoFactorHref={twoFactorHref}
        timeZone={timeZone}
      />
      <Sessions timeZone={timeZone} />
    </>
  )
}
