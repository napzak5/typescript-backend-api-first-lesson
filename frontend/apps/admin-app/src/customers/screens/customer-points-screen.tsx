import {
  cursorAfter,
  firstCursor,
  listingOf,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsPointTransactionResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  Link,
  LoadingIndicator,
  moreOf,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { bookingKeyOf, readBooking } from '../../bookings/api/bookings-api'
import {
  bookingHrefOf,
  customerHrefOf,
  pointEntryHrefOf,
  saleHrefOf,
} from '../../navigation'
import { readSale, saleKeyOf } from '../../sales/api/sales-api'
import {
  balanceKeyOf,
  EXPIRING_DAYS,
  expiringKeyOf,
  readBalance,
  readExpiring,
  readTransactionsPage,
  transactionsKeyOf,
} from '../api/points-api'
import { ExpiringPoints } from '../components/expiring-points/expiring-points'
import { PointBalance } from '../components/point-balance/point-balance'
import { PointHistory } from '../components/point-history/point-history'
import { WithCustomer } from './with-customer'

const { points: words, backToCustomer } = adminCustomerMessages
const { history, names } = words

const TITLE = words.title

/**
 * The sale a transaction was made for, by its number, leading to its page
 * at its own salon. A sale of a salon the account does not belong to is
 * not found, and is named as such; until it is read, it is named by its
 * kind.
 */
const SaleName = ({ saleId }: { saleId: string }) => {
  const say = useSay()
  const read = useQuery({
    queryKey: saleKeyOf(saleId),
    queryFn: () => readSale(saleId),
  })

  return match(read.data)
    .with({ type: 'found' }, ({ sale }) => (
      <Link href={saleHrefOf(sale.salonId, sale.id)}>
        {say(history.saleOf(sale.saleNumber))}
      </Link>
    ))
    .with({ type: P.union('notFound', 'forbidden') }, () =>
      say(history.saleOfOtherSalon),
    )
    .with(P.union(undefined, { type: P.union(...UNREAD_TYPES) }), () =>
      say(history.sale),
    )
    .exhaustive()
}

/** The booking a transaction was made for, as the sale is named. */
const BookingName = ({ bookingId }: { bookingId: string }) => {
  const say = useSay()
  const read = useQuery({
    queryKey: bookingKeyOf(bookingId),
    queryFn: () => readBooking(bookingId),
  })

  return match(read.data)
    .with({ type: 'found' }, ({ booking }) => (
      <Link href={bookingHrefOf(booking.salonId, booking.id)}>
        {say(history.bookingOf(booking.bookingNumber))}
      </Link>
    ))
    .with({ type: P.union('notFound', 'forbidden') }, () =>
      say(history.bookingOfOtherSalon),
    )
    .with(P.union(undefined, { type: P.union(...UNREAD_TYPES) }), () =>
      say(history.booking),
    )
    .exhaustive()
}

type PointsPartProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The points of the customer: the balance with the way to record points,
 * the points that expire soon, and the history, the latest first, a page
 * at a time. Points are written at every salon: each is read whenever it
 * is shown, and each says its own failure.
 */
const PointsPart = ({ salon, customer }: PointsPartProps) => {
  const say = useSay()
  const balance = useQuery({
    queryKey: balanceKeyOf(customer.id),
    queryFn: () => readBalance(customer.id),
    staleTime: 0,
  })
  const expiring = useQuery({
    queryKey: expiringKeyOf(customer.id),
    queryFn: () => readExpiring(customer.id),
    staleTime: 0,
  })
  const transactions = useInfiniteQuery({
    queryKey: transactionsKeyOf(customer.id),
    queryFn: ({ pageParam }) => readTransactionsPage(customer.id, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    staleTime: 0,
  })
  const referenceOf = ({
    referenceType,
    referenceId,
  }: ModelsPointTransactionResponse) =>
    match([referenceType, referenceId])
      .with(['sale', P.string], ([, id]) => <SaleName saleId={id} />)
      .with(['booking', P.string], ([, id]) => <BookingName bookingId={id} />)
      .with(['customer', P.string], ([, id]) => (
        <Link href={customerHrefOf(salon.id, id)}>
          {say(history.mergedCustomer)}
        </Link>
      ))
      .with([P._, null], [null, P._], () => '')
      .exhaustive()

  return (
    <>
      <ButtonLink href={customerHrefOf(salon.id, customer.id)}>
        {say(backToCustomer)}
      </ButtonLink>
      {match(balance.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(words.balance.loading)} />
        ))
        .with({ type: 'found' }, ({ balance: points }) => (
          <PointBalance
            balance={points}
            entryHref={pointEntryHrefOf(salon.id, customer.id)}
          />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.balance, reason))}
            onRetry={() => void balance.refetch()}
            pending={balance.isFetching}
          />
        ))
        .exhaustive()}
      {match(expiring.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(words.expiring.loading)} />
        ))
        .with({ type: 'found' }, ({ expiring: soon }) => (
          <ExpiringPoints
            expiring={soon}
            days={EXPIRING_DAYS}
            today={dayAt(new Date(), salon.timezone)}
            timezone={salon.timezone}
          />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.expiring, reason))}
            onRetry={() => void expiring.refetch()}
            pending={expiring.isFetching}
          />
        ))
        .exhaustive()}
      {match(
        transactions.data === undefined
          ? undefined
          : listingOf(transactions.data.pages),
      )
        .with(undefined, () => (
          <LoadingIndicator label={say(history.loading)} />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.history, reason))}
            onRetry={() => void transactions.refetch()}
            pending={transactions.isFetching}
          />
        ))
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <PointHistory
            transactions={items}
            total={total}
            more={moreOf(rest, {
              nextPage: transactions.isFetchingNextPage,
              again: transactions.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread'
                ? transactions.refetch()
                : transactions.fetchNextPage())
            }
            referenceOf={referenceOf}
            timezone={salon.timezone}
          />
        ))
        .exhaustive()}
    </>
  )
}

/**
 * The points of a customer of the ledger, below the salon of the address:
 * every member of a salon reads them and records them at the counter. The
 * points are the customer's, at every salon.
 */
export const CustomerPointsScreen = () => {
  const { salonId = '' } = useParams()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(TITLE)}>
      {(salon) => (
        <WithCustomer
          key={salon.id}
          salon={salon}
          title={say(TITLE)}
          fresh={false}
        >
          {(customer) => (
            <PointsPart key={customer.id} salon={salon} customer={customer} />
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
