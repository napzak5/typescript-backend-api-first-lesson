import {
  cursorAfter,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  LoadingIndicator,
  moreOf,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import { customerHrefOf, customerVersionHrefOf } from '../../navigation'
import { historyKeyOf, readHistoryPage } from '../api/customer-history-api'
import { CustomerHistory } from '../components/customer-history/customer-history'
import {
  changerNameOf,
  KEPT_BY_OTHERS,
  mayKeepCustomers,
} from '../utils/customer-history'
import { RemovedCustomer } from './removed-customer'
import { WithCustomer } from './with-customer'

const { history: words, names, titles, backToCustomer } = adminCustomerMessages

const TITLE = titles.history

type HistoryPartProps = {
  salon: ModelsSalonResponse
  customerId: string
  /** The account of the customer, when they have one: a version they made is named as theirs */
  customerAccount: string | null
}

/**
 * The versions of the customer, the latest first, a page at a time. Each
 * leads to its values; the way back leads to the customer.
 */
const HistoryPart = ({
  salon,
  customerId,
  customerAccount,
}: HistoryPartProps) => {
  const say = useSay()
  const session = useSession()
  const keeper =
    session.type === 'signedIn' && mayKeepCustomers(session.user.role)
  const me = session.type === 'signedIn' ? session.user.id : ''
  const read = useInfiniteQuery({
    queryKey: historyKeyOf(customerId),
    queryFn: ({ pageParam }) => readHistoryPage(customerId, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    enabled: keeper,
    // The ledger is written at every salon: the history is read whenever it is shown
    staleTime: 0,
  })

  return (
    <>
      <ButtonLink href={customerHrefOf(salon.id, customerId)}>
        {say(backToCustomer)}
      </ButtonLink>
      {keeper ? (
        match(read.data === undefined ? undefined : listingOf(read.data.pages))
          .with(undefined, () => (
            <LoadingIndicator label={say(words.loading)} />
          ))
          .with({ type: 'unread' }, ({ reason }) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.history, reason))}
              onRetry={() => void read.refetch()}
              pending={read.isFetching}
            />
          ))
          .with({ type: 'listed' }, ({ items, total, rest }) => (
            <CustomerHistory
              entries={items}
              total={total}
              more={moreOf(rest, {
                nextPage: read.isFetchingNextPage,
                again: read.isRefetching,
              })}
              onMore={() =>
                void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
              }
              versionHref={(version) =>
                customerVersionHrefOf(salon.id, customerId, version)
              }
              changerOf={(changedBy) =>
                changerNameOf(changedBy, { me, customer: customerAccount })
              }
              timezone={salon.timezone}
            />
          ))
          .exhaustive()
      ) : (
        <p>{say(KEPT_BY_OTHERS)}</p>
      )}
    </>
  )
}

type CustomerHistoryPageProps = {
  salon: ModelsSalonResponse
}

const CustomerHistoryPage = ({ salon }: CustomerHistoryPageProps) => {
  const say = useSay()

  return (
    <WithCustomer
      salon={salon}
      title={say(TITLE)}
      fresh={false}
      removed={(customerId) => (
        <RemovedCustomer
          salon={salon}
          customerId={customerId}
          title={say(TITLE)}
        >
          {() => (
            <HistoryPart
              salon={salon}
              customerId={customerId}
              customerAccount={null}
            />
          )}
        </RemovedCustomer>
      )}
    >
      {(customer) => (
        <HistoryPart
          salon={salon}
          customerId={customer.id}
          customerAccount={customer.userId}
        />
      )}
    </WithCustomer>
  )
}

/**
 * The history of a customer: who changed the ledger, when, and which items.
 * An owner or a manager reads it, of a customer in the ledger and of one
 * who left it; a member of the staff is told who does.
 */
export const CustomerHistoryScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(TITLE)}>
      {(salon) => <CustomerHistoryPage key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
