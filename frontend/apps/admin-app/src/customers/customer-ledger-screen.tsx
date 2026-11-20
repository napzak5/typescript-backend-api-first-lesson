import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { customerEntryHrefOf, customerHrefOf } from '../navigation'
import { cursorAfter, firstCursor, listingOf, moreOf } from '../pages'
import { unreadMessageOf } from '../reading'
import { WithSalon } from '../salons/with-salon'
import { CustomerFilter } from './components/customer-filter/customer-filter'
import { CustomerTable } from './components/customer-table/customer-table'
import {
  customerConditionsIn,
  customerQueryOf,
  isNarrowed,
  readCustomerConditions,
} from './customer-ledger'
import { CUSTOMER_LISTS, readCustomerPage } from './customers-api'

const TITLE = '顧客台帳'

type CustomerLedgerProps = {
  salon: ModelsSalonResponse
}

/**
 * The customers of the ledger, the latest registered first. The ledger is
 * one for every salon; it is shown below a salon so that the days a
 * customer was registered on are those of its clock. The conditions are
 * in the query of the address, as those of the bookings are: a reload, the
 * way back from a customer and an address that is passed on show the same
 * customers.
 */
const CustomerLedger = ({ salon }: CustomerLedgerProps) => {
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const conditions = customerConditionsIn(query)
  const asked = customerQueryOf(conditions).toString()
  const narrowed = isNarrowed(conditions)
  const read = useInfiniteQuery({
    queryKey: [...CUSTOMER_LISTS, 'ledger', salon.timezone, asked],
    queryFn: ({ pageParam }) =>
      readCustomerPage(conditions, salon.timezone, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Customers are registered at every salon: the ledger is read whenever it is shown
    staleTime: 0,
  })

  const filter = (values: FormData): void => {
    const filled = readCustomerConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next = customerQueryOf(filled.request)
    if (next.toString() === asked) {
      // The same customers again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const entry = (
    <ButtonLink href={customerEntryHrefOf(salon.id)} variant='primary'>
      お客様を登録する
    </ButtonLink>
  )

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} actions={entry} />
      <CustomerFilter
        conditions={conditions}
        errors={errors}
        clearHref={narrowed ? '?' : undefined}
        onSubmit={filter}
      />
      {match(read.data === undefined ? undefined : listingOf(read.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label='お客様を読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('顧客台帳', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title='条件に合うお客様はいません'
              description='条件を変えて探すか、新しいお客様として登録してください。'
              action={entry}
            />
          ) : (
            <EmptyState
              title='台帳にお客様はいません'
              description='最初のお客様を登録してください。'
              action={entry}
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <CustomerTable
            // Other conditions are another list
            key={asked}
            caption={narrowed ? '条件に合うお客様' : TITLE}
            rows={items}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
            customerHref={({ id }) => customerHrefOf(salon.id, id)}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The ledger of the customers, below the salon of the address. */
export const CustomerLedgerScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <CustomerLedger key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
