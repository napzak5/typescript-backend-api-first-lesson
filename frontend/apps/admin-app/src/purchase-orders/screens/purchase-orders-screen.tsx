import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import {
  purchaseOrderEntryHrefOf,
  purchaseOrderHrefOf,
  purchaseOrdersHrefOf,
  reorderSuggestionsHrefOf,
} from '../../navigation'
import { purchaseOrdersKeyOf, readOrderPage } from '../api/purchase-orders-api'
import { OrderFilter } from '../components/order-filter/order-filter'
import { OrderTable } from '../components/order-table/order-table'
import {
  orderConditionsIn,
  orderListParamsOf,
  orderQueryOf,
  readOrderConditions,
} from '../utils/order-search'

const { list, loading, names, titles, words } = adminPurchaseOrderMessages

/** What is done from the list: a new order, or the products the salon had better order */
const OrderLinks = ({ salonId }: { salonId: string }) => {
  const say = useSay()

  return (
    <>
      <ButtonLink href={purchaseOrderEntryHrefOf(salonId)} variant='primary'>
        {say(words.entry)}
      </ButtonLink>
      <ButtonLink href={reorderSuggestionsHrefOf(salonId)}>
        {say(words.suggestions)}
      </ButtonLink>
    </>
  )
}

/**
 * The purchase orders of a salon that meet the conditions of the address,
 * the latest made first: their status, their supplier and the days they
 * were made on at the salon.
 */
const OrdersPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors<LocalizedText> | undefined>(
    undefined,
  )
  const conditions = orderConditionsIn(query)
  const asked = orderQueryOf(conditions).toString()
  const narrowed = asked !== ''
  const read = useInfiniteQuery({
    queryKey: [...purchaseOrdersKeyOf(salon.id), 'list', asked],
    queryFn: ({ pageParam }) =>
      readOrderPage(
        orderListParamsOf(salon.id, conditions, salon.timezone),
        pageParam,
      ),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Orders move from one status to the next by other hands: the list is read whenever it is shown
    staleTime: 0,
  })

  const filter = (values: FormData): void => {
    const filled = readOrderConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next = orderQueryOf(filled.value)
    if (next.toString() === asked) {
      // The same orders again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const pages = read.data?.pages ?? []
  if (pages[0]?.type === 'forbidden') {
    return (
      <>
        <PageHeader title={say(titles.orders)} description={salon.name} />
        <OtherSalonNotice what={names.ordersOfTheSalon} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={say(titles.orders)}
        description={salon.name}
        actions={<OrderLinks salonId={salon.id} />}
      />
      <OrderFilter
        conditions={conditions}
        errors={errors}
        clearHref={narrowed ? purchaseOrdersHrefOf(salon.id) : undefined}
        onSubmit={filter}
      />
      {match(
        read.data === undefined
          ? undefined
          : listingOf(
              // A page after the first is refused only when the account
              // moved meanwhile: it ends the list there
              pages.map((page) => (page.type === 'forbidden' ? FAILED : page)),
            ),
      )
        .with(undefined, () => <LoadingIndicator label={say(loading.orders)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.orders, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title={say(list.noneMatching)}
              description={say(list.noneMatchingDescription)}
            />
          ) : (
            <EmptyState
              title={say(list.none)}
              description={say(list.noneDescription)}
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <OrderTable
            // Other conditions are another list
            key={asked}
            caption={say(narrowed ? list.matching : titles.orders)}
            orders={items}
            timezone={salon.timezone}
            currency={salon.currency}
            orderHref={(id) => purchaseOrderHrefOf(salon.id, id)}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The purchase orders of the salon of the address, for every member of its staff and an administrator. */
export const PurchaseOrdersScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.orders)}>
      {(salon) => <OrdersPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
