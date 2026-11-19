import type { ModelsSessionResponse } from '@beauty-salon-frontend/api-client'
import {
  Card,
  LoadingIndicator,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { match, P } from 'ts-pattern'
import { SecuritySummary } from './components/security-summary/security-summary'
import { SessionList } from './components/session-list/session-list'
import { SignOutEverywhere } from './components/sign-out-everywhere/sign-out-everywhere'
import { UnreadNotice } from './components/unread-notice/unread-notice'
import {
  endSession,
  OWN_ACCOUNT,
  OWN_SESSIONS,
  readOwnAccount,
  readOwnSessions,
  type SessionPage,
  signOutEverywhere,
} from './security-api'
import {
  afterUnsent,
  cursorAfter,
  endsWithGoneCursor,
  firstCursor,
  listingOf,
  moreOf,
  withoutSession,
} from './security-flow'

const UNSENT = P.union('tooManyRequests', 'failed')

type SessionPages = InfiniteData<SessionPage, string | undefined>

type PartProps = {
  /** The time zone of whoever reads: the moments are said in it */
  timeZone: string
}

type AccountProps = PartProps & {
  passwordHref: string
}

/** The password and the second factor, as the API has them now. */
const Account = ({ passwordHref, timeZone }: AccountProps) => {
  const read = useQuery({
    queryKey: OWN_ACCOUNT,
    queryFn: readOwnAccount,
    // The password is changed, and the second factor set up, on other
    // devices too: what is shown is read whenever the screen opens
    staleTime: 0,
  })

  return match(read.data)
    .with(undefined, () => (
      <LoadingIndicator label='アカウントを読み込んでいます' />
    ))
    .with({ type: 'found' }, ({ user }) => (
      <SecuritySummary
        user={user}
        passwordHref={passwordHref}
        timeZone={timeZone}
      />
    ))
    .with({ type: UNSENT }, (reason) => (
      <UnreadNotice
        what='アカウント'
        reason={reason}
        onRetry={() => void read.refetch()}
        retrying={read.isFetching}
      />
    ))
    .exhaustive()
}

/**
 * The devices the account is signed in on, and the ways to sign them out:
 * one at a time, or all of them with this one.
 */
const Sessions = ({ timeZone }: PartProps) => {
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
  const [unsent, setUnsent] = useState<string>()
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
          notify({
            tone: 'success',
            message:
              '端末をサインアウトさせました。その端末で使うには、もう一度サインインが必要です。',
          })
        })
        .with({ type: UNSENT }, (reason) =>
          notify({ tone: 'danger', message: afterUnsent(reason) }),
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
            message: 'すべての端末でサインアウトしました。',
          }),
        )
        .with({ type: UNSENT }, (reason) => setUnsent(afterUnsent(reason)))
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
    <Card title='サインインしている端末' headingRef={heading}>
      <p>
        このアカウントでサインインしている端末です。心当たりのない端末や、使わなくなった端末は、サインアウトさせてください。
      </p>
      {match(listing)
        .with(undefined, () => (
          <LoadingIndicator label='サインインしている端末を読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            what='サインインしている端末'
            reason={reason}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
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
  actions,
}: AccountSecurityScreenProps) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <>
      <PageHeader
        title='アカウントの安全'
        description='パスワードと 2 要素認証、このアカウントでサインインしている端末です。'
        actions={actions}
      />
      <Account passwordHref={passwordHref} timeZone={timeZone} />
      <Sessions timeZone={timeZone} />
    </>
  )
}
