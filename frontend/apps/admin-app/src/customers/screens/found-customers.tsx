import {
  cursorAfter,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import {
  EmptyState,
  LoadingIndicator,
  moreOf,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery } from '@tanstack/react-query'
import { match } from 'ts-pattern'
import { CUSTOMER_LISTS, findCustomers } from '../api/customers-api'
import {
  type ChooseCustomer,
  CustomerChoices,
} from '../components/customer-choices/customer-choices'

const { names, choices } = adminCustomerMessages

/** The key of the customers a keyword finds: the search of a booking reads the same pages */
export const searchKeyOf = (keyword: string): string[] => [
  ...CUSTOMER_LISTS,
  'search',
  keyword,
]

type FoundCustomersProps = {
  keyword: string
  /** How a customer is chosen by their name */
  choose: ChooseCustomer
}

/**
 * The customers of the ledger that have the keyword, each chosen by their
 * name: the referrer of a customer, the customer to merge one with.
 */
export const FoundCustomers = ({ keyword, choose }: FoundCustomersProps) => {
  const say = useSay()
  const found = useInfiniteQuery({
    queryKey: searchKeyOf(keyword),
    queryFn: ({ pageParam }) => findCustomers(keyword, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Customers are registered at every salon of the platform
    staleTime: 0,
  })

  return match(
    found.data === undefined ? undefined : listingOf(found.data.pages),
  )
    .with(undefined, () => <LoadingIndicator label={say(choices.searching)} />)
    .with({ type: 'unread' }, ({ reason }) => (
      <UnreadNotice
        message={say(unreadMessageOf(names.customers, reason))}
        onRetry={() => void found.refetch()}
        pending={found.isFetching}
      />
    ))
    .with({ type: 'listed', items: [] }, () => (
      <EmptyState
        title={say(choices.noneFound)}
        description={say(choices.noneFoundDescription)}
      />
    ))
    .with({ type: 'listed' }, ({ items, total, rest }) => (
      <CustomerChoices
        customers={items}
        total={total}
        more={moreOf(rest, {
          nextPage: found.isFetchingNextPage,
          again: found.isRefetching,
        })}
        onMore={() =>
          void (rest === 'unread' ? found.refetch() : found.fetchNextPage())
        }
        choose={choose}
      />
    ))
    .exhaustive()
}
