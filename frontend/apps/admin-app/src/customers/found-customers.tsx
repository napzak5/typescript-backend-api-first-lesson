import {
  cursorAfter,
  firstCursor,
  listingOf,
  moreOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/salon-screens'
import {
  EmptyState,
  LoadingIndicator,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { match } from 'ts-pattern'
import {
  type ChooseCustomer,
  CustomerChoices,
} from './components/customer-choices/customer-choices'
import { CUSTOMER_LISTS, findCustomers } from './customers-api'

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
    .with(undefined, () => <LoadingIndicator label='お客様を探しています' />)
    .with({ type: 'unread' }, ({ reason }) => (
      <UnreadNotice
        message={unreadMessageOf('お客様', reason)}
        onRetry={() => void found.refetch()}
        retrying={found.isFetching}
      />
    ))
    .with({ type: 'listed', items: [] }, () => (
      <EmptyState
        title='キーワードに合うお客様が見つかりませんでした'
        description='キーワードを変えて、もう一度お探しください。'
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
