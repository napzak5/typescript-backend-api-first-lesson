import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  EmptyState,
  type FormErrors,
  inJapanese,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { saleHrefOf } from '../../navigation'
import { readSales, saleListsKeyOf } from '../api/sales-api'
import { LedgerFilter } from '../components/ledger-filter/ledger-filter'
import { SaleTable } from '../components/sale-table/sale-table'
import {
  ledgerConditionsIn,
  ledgerQueryOf,
  rangeNameOf,
  readLedgerConditions,
} from '../utils/sales-ledger'

const TITLE = '売上台帳'

type SalesLedgerProps = {
  salon: ModelsSalonResponse
}

/**
 * The sales of a salon, the latest first. The days they were entered on
 * and how far they were paid are in the query of the address, as the
 * conditions of the bookings are: a reload, the way back from a sale and
 * an address that is passed on show the same ledger. Without days it is
 * today at the salon.
 */
const SalesLedger = ({ salon }: SalesLedgerProps) => {
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const today = dayAt(new Date(), salon.timezone)
  const conditions = ledgerConditionsIn(query, today)
  const asked = ledgerQueryOf(conditions).toString()
  const read = useInfiniteQuery({
    queryKey: [...saleListsKeyOf(salon.id), asked],
    queryFn: ({ pageParam }) => readSales(salon.id, conditions, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: (page) =>
      page.type === 'forbidden' ? undefined : cursorAfter(page),
    // Sales are entered at the counter all day: the ledger is read whenever it is shown
    staleTime: 0,
  })
  const pages = read.data?.pages ?? []
  const narrowed =
    conditions.from !== today ||
    conditions.to !== today ||
    conditions.paymentStatus !== undefined

  const filter = (values: FormData): void => {
    const filled = readLedgerConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next = ledgerQueryOf(filled.value)
    if (next.toString() === asked) {
      // The same ledger again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const heading = `${rangeNameOf(conditions)}の売上`

  if (pages[0]?.type === 'forbidden') {
    return (
      <>
        <PageHeader title={TITLE} description={salon.name} />
        <OtherSalonNotice what={writtenInJapanese('売上')} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      <LedgerFilter
        conditions={conditions}
        errors={errors}
        clearHref={narrowed ? '?' : undefined}
        onSubmit={filter}
      />
      {match(
        read.data === undefined
          ? undefined
          : listingOf(
              // A page after the first is refused only when the account was
              // moved to another salon meanwhile: it ends the ledger there
              pages.map((page) => (page.type === 'forbidden' ? FAILED : page)),
            ),
      )
        .with(undefined, () => (
          <LoadingIndicator label='売上を読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={inJapanese(
              unreadMessageOf(writtenInJapanese('売上'), reason),
            )}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState
            title={
              conditions.paymentStatus === undefined
                ? `${heading}はありません`
                : `${heading}のうち、条件に合うものはありません`
            }
          />
        ))
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <SaleTable
            // Other days, or another state, is another ledger
            key={asked}
            caption={heading}
            rows={items}
            total={total}
            timezone={salon.timezone}
            currency={salon.currency}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
            saleHref={({ id }) => saleHrefOf(salon.id, id)}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The ledger of the sales of the salon of the address. */
export const SalesLedgerScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <SalesLedger key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
