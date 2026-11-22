import {
  cursorAfter,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { chartHrefOf, customersHrefOf } from '../navigation'
import {
  chartConditionsIn,
  chartQueryOf,
  readChartConditions,
} from './chart-search'
import { CHART_LISTS, readChartPage } from './charts-api'
import { ChartFilter } from './components/chart-filter/chart-filter'
import { ChartTable } from './components/chart-table/chart-table'

const TITLE = 'カルテを探す'

type ChartSearchProps = {
  salon: ModelsSalonResponse
}

/**
 * The charts of the customers that meet the conditions, the latest made
 * first: a keyword of what to take care of, of the notes or of the names
 * of products, and whether the customer has allergies recorded. The
 * conditions are in the query of the address, as those of the ledger are.
 * The charts are those of every salon, as the ledger is.
 */
const ChartSearch = ({ salon }: ChartSearchProps) => {
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const conditions = chartConditionsIn(query)
  const asked = chartQueryOf(conditions).toString()
  const narrowed = asked !== ''
  const read = useInfiniteQuery({
    queryKey: [...CHART_LISTS, asked],
    queryFn: ({ pageParam }) => readChartPage(conditions, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Charts are written at every salon: the list is read whenever it is shown
    staleTime: 0,
  })

  const filter = (values: FormData): void => {
    const filled = readChartConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next = chartQueryOf(filled.request)
    if (next.toString() === asked) {
      // The same charts again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const ledger = (
    <ButtonLink href={customersHrefOf(salon.id)}>顧客台帳へ</ButtonLink>
  )

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} actions={ledger} />
      <ChartFilter
        conditions={conditions}
        errors={errors}
        clearHref={narrowed ? '?' : undefined}
        onSubmit={filter}
      />
      {match(read.data === undefined ? undefined : listingOf(read.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label='カルテを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('カルテ', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title='条件に合うカルテはありません'
              description='条件を変えて探してください。'
            />
          ) : (
            <EmptyState
              title='カルテはありません'
              description='カルテは、お客様の台帳から作ります。'
              actions={ledger}
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <ChartTable
            // Other conditions are another list
            key={asked}
            caption={narrowed ? '条件に合うカルテ' : 'カルテ'}
            rows={items}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
            timezone={salon.timezone}
            chartHref={(customerId) => chartHrefOf(salon.id, customerId)}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The search of the charts of the customers, below the salon of the address. */
export const ChartSearchScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <ChartSearch key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
