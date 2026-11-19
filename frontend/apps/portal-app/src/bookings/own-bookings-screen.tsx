import { RequireSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  Navigation,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery, useQueries } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { CUSTOMERS } from '../roles'
import {
  cursorAfter,
  firstCursor,
  listingOf,
  moreOf,
  unreadMessageOf,
} from '../salons/pages'
import { dateAt } from '../salons/salon-format'
import { readSalon } from '../salons/salons-api'
import { SignInHelp } from '../sign-in-help'
import { readOwnBookings, readService } from './bookings-api'
import { BookingList } from './components/booking-list/booking-list'
import {
  askedOf,
  listHrefOf,
  moreOfRows,
  namedBy,
  OWN_BOOKING_LISTS,
  rowsOf,
  type When,
  whenIn,
} from './own-bookings'

const TITLE = '予約の一覧'

const LIST_NAMES: Record<When, string> = {
  upcoming: 'これからの予約',
  past: 'これまでの予約',
}

const UNREAD_TYPES: readonly string[] = ['tooManyRequests', 'failed']

type BookingsProps = {
  when: When
}

/**
 * One of the two lists. A booking names its salon and its service by their
 * IDs: the list reads each of them once, under the keys the page of a
 * booking reads them, and shows a booking when its names are there.
 */
const Bookings = ({ when }: BookingsProps) => {
  // A customer books at salons of more than one time zone: the day that
  // parts the visits to come from those that were is the day where the
  // customer is
  const today = dateAt(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const read = useInfiniteQuery({
    queryKey: [...OWN_BOOKING_LISTS, when, today],
    queryFn: ({ pageParam }) =>
      readOwnBookings(askedOf(when, today), pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // The salon confirms a booking, and may change it: a list is read
    // whenever it is shown
    staleTime: 0,
  })
  const listing =
    read.data === undefined ? undefined : listingOf(read.data.pages)
  const bookings = listing?.type === 'listed' ? listing.items : []
  const { salonIds, services } = namedBy(bookings)
  const salons = useQueries({
    queries: salonIds.map((salonId) => ({
      queryKey: ['salons', salonId, 'salon'],
      queryFn: () => readSalon(salonId),
    })),
  })
  const names = useQueries({
    queries: services.map(({ salonId, serviceId }) => ({
      queryKey: ['salons', salonId, 'services', serviceId],
      queryFn: () => readService(salonId, serviceId),
    })),
  })
  const salonOf = new Map(
    salonIds.map((salonId, index) => [salonId, salons.at(index)?.data]),
  )
  const serviceOf = new Map(
    services.map(({ serviceId }, index) => [serviceId, names.at(index)?.data]),
  )
  const { rows, rest } = rowsOf(bookings, {
    salon: (salonId) => salonOf.get(salonId),
    service: (serviceId) => serviceOf.get(serviceId),
  })
  const named = [...salons, ...names]
  const readingNamesAgain = named.some((one) => one.isRefetching)
  const readNamesAgain = (): void => {
    for (const one of named) {
      if (UNREAD_TYPES.includes(one.data?.type ?? '')) {
        void one.refetch()
      }
    }
  }

  return match(listing)
    .with(undefined, () => <LoadingIndicator label='予約を読み込んでいます' />)
    .with({ type: 'unread' }, ({ reason }) => (
      <UnreadNotice
        message={unreadMessageOf('予約', reason)}
        onRetry={() => void read.refetch()}
        retrying={read.isFetching}
      />
    ))
    .with({ type: 'listed', items: [] }, () =>
      when === 'past' ? (
        <EmptyState title='これまでの予約はありません' />
      ) : (
        <EmptyState
          title='これからの予約はありません'
          description='サロンを探して、メニューから予約できます。'
          action={<ButtonLink href='/'>サロンを探す</ButtonLink>}
        />
      ),
    )
    .with({ type: 'listed' }, ({ total, rest: pages }) =>
      match([rows, rest])
        .with([[], { type: 'unread' }], ([, { reason }]) => (
          <UnreadNotice
            message={unreadMessageOf('予約', reason)}
            onRetry={readNamesAgain}
            retrying={readingNamesAgain}
          />
        ))
        .with([[], P._], () => (
          <LoadingIndicator label='予約を読み込んでいます' />
        ))
        .otherwise(() => (
          <BookingList
            title={LIST_NAMES[when]}
            rows={rows}
            total={total}
            more={moreOfRows(
              rest,
              moreOf(pages, {
                nextPage: read.isFetchingNextPage,
                again: read.isRefetching,
              }),
              readingNamesAgain,
            )}
            onMore={() => {
              if (rest.type === 'unread') {
                readNamesAgain()
                return
              }
              void (pages === 'unread' ? read.refetch() : read.fetchNextPage())
            }}
            bookingHref={({ id }) => `/bookings/${id}`}
          />
        )),
    )
    .exhaustive()
}

const OwnBookings = () => {
  const [query] = useSearchParams()
  const when = whenIn(query)

  return (
    <>
      <PageHeader
        title={TITLE}
        description='日時の変更とキャンセルは、それぞれの予約の内容の画面から行えます。'
      />
      <Navigation
        label='予約の時期'
        items={[
          {
            href: listHrefOf('upcoming'),
            label: LIST_NAMES.upcoming,
            current: when === 'upcoming',
          },
          {
            href: listHrefOf('past'),
            label: LIST_NAMES.past,
            current: when === 'past',
          },
        ]}
      />
      {/* The other list is another list: nothing of the one before is added to */}
      <Bookings key={when} when={when} />
    </>
  )
}

/**
 * The bookings of the customer who is signed in: the visits to come, and
 * behind a link those that were. Which of the two is shown is in the
 * address, so a reload and the way back from a booking show the same list.
 */
export const OwnBookingsScreen = () => (
  <RequireSession
    roles={CUSTOMERS}
    signInNotice='予約を確認するには、サインインしてください。'
    signInHelp={<SignInHelp />}
  >
    <OwnBookings />
  </RequireSession>
)
