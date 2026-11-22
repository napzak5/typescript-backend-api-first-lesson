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
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import { customerHrefOf, customerVersionHrefOf } from '../navigation'
import { CustomerHistory } from './components/customer-history/customer-history'
import {
  changerNameOf,
  KEPT_BY_OTHERS,
  mayKeepCustomers,
} from './customer-history'
import { historyKeyOf, readHistoryPage } from './customer-history-api'
import { RemovedCustomer } from './removed-customer'
import { WithCustomer } from './with-customer'

const TITLE = '変更履歴'

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
        お客様の台帳へ
      </ButtonLink>
      {keeper ? (
        match(read.data === undefined ? undefined : listingOf(read.data.pages))
          .with(undefined, () => (
            <LoadingIndicator label='変更履歴を読み込んでいます' />
          ))
          .with({ type: 'unread' }, ({ reason }) => (
            <UnreadNotice
              message={unreadMessageOf('変更履歴', reason)}
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
        <p>{KEPT_BY_OTHERS}</p>
      )}
    </>
  )
}

type CustomerHistoryPageProps = {
  salon: ModelsSalonResponse
}

const CustomerHistoryPage = ({ salon }: CustomerHistoryPageProps) => (
  <WithCustomer
    salon={salon}
    title={TITLE}
    fresh={false}
    removed={(customerId) => (
      <RemovedCustomer salon={salon} customerId={customerId} title={TITLE}>
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

/**
 * The history of a customer: who changed the ledger, when, and which items.
 * An owner or a manager reads it, of a customer in the ledger and of one
 * who left it; a member of the staff is told who does.
 */
export const CustomerHistoryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <CustomerHistoryPage key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
