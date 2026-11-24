import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  UNREAD_TYPES,
  unreadMessageOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsBookingResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAfter,
  dayAt,
  dayNameOf,
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  moreOf,
  moreOfRows,
  PageHeader,
  PeriodSwitch,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  CUSTOMER_LISTS,
  type CustomersRead,
  readCustomers,
} from '../../customers/api/customers-api'
import { bookingEntryHrefOf, bookingHrefOf } from '../../navigation'
import {
  readServices,
  readStaffProfiles,
  servicesKeyOf,
  staffProfilesKeyOf,
} from '../../salons/api/salons-api'
import { bookingListsKeyOf, readDayBookings } from '../api/bookings-api'
import { BookingFilter } from '../components/booking-filter/booking-filter'
import { DayBookingTable } from '../components/day-booking-table/day-booking-table'
import {
  conditionsIn,
  conditionsOf,
  narrows,
  onDay,
  queryOf,
  wholeDay,
} from '../utils/booking-day'
import { customerIdsOf, rowsOf } from '../utils/day-bookings'

const { titles, names, ledger, words } = adminBookingMessages

type DayBookingsProps = {
  salon: ModelsSalonResponse
}

/**
 * The bookings of a salon on a day. The day, and the state and the member
 * of the staff that narrow the list, are in the query of the address: a
 * reload, the way back from a booking and an address that is passed on
 * show the same list. Without a day it is today at the salon.
 *
 * A booking names its customer, its member of the staff and its services
 * by their IDs: the staff and the services of the salon are read once, and
 * the customers of each page in one request.
 */
const DayBookings = ({ salon }: DayBookingsProps) => {
  const say = useSay()
  const title = say(titles.ledger)
  const [query, setQuery] = useSearchParams()
  const today = dayAt(new Date(), salon.timezone)
  const conditions = conditionsIn(query, today)
  const asked = queryOf(conditions).toString()
  const read = useInfiniteQuery({
    queryKey: [...bookingListsKeyOf(salon.id), asked],
    queryFn: ({ pageParam }) =>
      readDayBookings(salon.id, conditions, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Bookings are made and changed at the counter, on the phone and by the
    // customers themselves: the list is read whenever it is shown
    staleTime: 0,
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })
  const services = useQuery({
    queryKey: servicesKeyOf(salon.id),
    queryFn: () => readServices(salon.id),
  })
  const pages = read.data?.pages ?? []
  const pagesOfBookings = pages.flatMap((page) =>
    page.type === 'found' ? [page.items] : [],
  )
  const customers = useQueries({
    queries: pagesOfBookings.map((bookings) => {
      const ids = customerIdsOf(bookings)

      return {
        queryKey: [...CUSTOMER_LISTS, 'of', ...ids],
        queryFn: () => readCustomers(ids),
      }
    }),
  })
  // What was read of the customers of a booking: those of its page
  const customersOfBookings = new Map(
    pagesOfBookings.flatMap((bookings, index) =>
      bookings.map((booking): [string, CustomersRead | undefined] => [
        booking.id,
        customers.at(index)?.data,
      ]),
    ),
  )
  const customersOf = (booking: ModelsBookingResponse) =>
    customersOfBookings.get(booking.id)
  const readingCustomersAgain = customers.some((one) => one.isRefetching)
  const readCustomersAgain = (): void => {
    for (const one of customers) {
      if (one.data !== undefined && one.data.type !== 'found') {
        void one.refetch()
      }
    }
  }

  const hrefOf = (date: string): string =>
    `?${queryOf(onDay(conditions, date)).toString()}`

  const filter = (values: FormData): void => {
    const next = queryOf(conditionsOf(values, today))
    if (next.toString() === asked) {
      // The same list again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const day = dayNameOf(conditions.date)

  if (pages[0]?.type === 'forbidden') {
    return (
      <>
        <PageHeader title={title} description={salon.name} />
        <OtherSalonNotice />
      </>
    )
  }
  const listing =
    read.data === undefined
      ? undefined
      : listingOf(
          // A page after the first is refused only when the account was
          // moved to another salon, or left its own, meanwhile: it ends the
          // list there
          pages.map((page) => (page.type === 'forbidden' ? FAILED : page)),
        )

  return (
    <>
      <PageHeader
        title={title}
        description={salon.name}
        actions={
          <ButtonLink
            href={bookingEntryHrefOf(salon.id, conditions.date)}
            variant='primary'
          >
            {say(words.entry)}
          </ButtonLink>
        }
      />
      {match([listing, staff.data, services.data])
        .with([P._, undefined, P._], [P._, P._, undefined], () => (
          <LoadingIndicator label={say(ledger.loading)} />
        ))
        .with(
          [P._, { type: P.union(...UNREAD_TYPES) }, P._],
          [P._, P._, { type: P.union(...UNREAD_TYPES, 'notFound') }],
          ([, ofStaff, ofServices]) => (
            <UnreadNotice
              message={say(
                unreadMessageOf(
                  names.staffAndServices,
                  whyUnread([ofStaff, ofServices]),
                ),
              )}
              onRetry={() => {
                void staff.refetch()
                void services.refetch()
              }}
              pending={staff.isFetching || services.isFetching}
            />
          ),
        )
        .with(
          [P._, { type: 'found' }, { type: 'found' }],
          ([ofBookings, ofStaff, ofServices]) => (
            <>
              <PeriodSwitch
                label={say(ledger.day)}
                unit='day'
                beforeHref={hrefOf(dayAfter(conditions.date, -1))}
                currentHref={hrefOf(today)}
                afterHref={hrefOf(dayAfter(conditions.date, 1))}
              />
              <BookingFilter
                conditions={conditions}
                staff={ofStaff.items}
                clearHref={
                  narrows(conditions)
                    ? `?${queryOf(wholeDay(conditions)).toString()}`
                    : undefined
                }
                onSubmit={filter}
              />
              {match(ofBookings)
                .with(undefined, () => (
                  <LoadingIndicator label={say(ledger.loading)} />
                ))
                .with({ type: 'unread' }, ({ reason }) => (
                  <UnreadNotice
                    message={say(unreadMessageOf(names.bookings, reason))}
                    onRetry={() => void read.refetch()}
                    pending={read.isFetching}
                  />
                ))
                .with({ type: 'listed', items: [] }, () => (
                  <EmptyState
                    title={say(
                      narrows(conditions)
                        ? ledger.noneMatchingOn(day)
                        : ledger.noneOn(day),
                    )}
                  />
                ))
                .with({ type: 'listed' }, ({ items, total, rest: pages }) => {
                  const { rows, rest } = rowsOf(items, {
                    staff: ofStaff.items,
                    services: ofServices.items,
                    customers: customersOf,
                  })

                  return match([rows, rest])
                    .with([[], { type: 'unread' }], ([, { reason }]) => (
                      <UnreadNotice
                        message={say(
                          unreadMessageOf(names.customersOfBookings, reason),
                        )}
                        onRetry={readCustomersAgain}
                        pending={readingCustomersAgain}
                      />
                    ))
                    .with([[], P._], () => (
                      <LoadingIndicator label={say(ledger.loading)} />
                    ))
                    .otherwise(() => (
                      <DayBookingTable
                        // Another day, or other conditions, is another list
                        key={asked}
                        caption={ledger.bookingsOn(day)}
                        rows={rows}
                        total={total}
                        timezone={salon.timezone}
                        more={moreOfRows(
                          rest,
                          moreOf(pages, {
                            nextPage: read.isFetchingNextPage,
                            again: read.isRefetching,
                          }),
                          readingCustomersAgain,
                        )}
                        onMore={() => {
                          if (rest.type === 'unread') {
                            readCustomersAgain()
                            return
                          }
                          void (pages === 'unread'
                            ? read.refetch()
                            : read.fetchNextPage())
                        }}
                        bookingHref={({ booking }) =>
                          bookingHrefOf(salon.id, booking.id)
                        }
                      />
                    ))
                })
                .exhaustive()}
            </>
          ),
        )
        .exhaustive()}
    </>
  )
}

/** The bookings of the salon of the address, a day at a time. */
export const DayBookingsScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.ledger)}>
      {(salon) => <DayBookings key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
