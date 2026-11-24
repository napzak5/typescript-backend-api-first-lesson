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
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminChartMessages,
  adminCustomerMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { chartHrefOf, customersHrefOf } from '../../navigation'
import { CHART_LISTS, readChartPage } from '../api/charts-api'
import { ChartFilter } from '../components/chart-filter/chart-filter'
import { ChartTable } from '../components/chart-table/chart-table'
import {
  chartConditionsIn,
  chartQueryOf,
  readChartConditions,
} from '../utils/chart-search'

const { loading, names, search: SEARCH, titles } = adminChartMessages

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
  const say = useSay()
  const [errors, setErrors] = useState<FormErrors<LocalizedText> | undefined>(
    undefined,
  )
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
    const next = chartQueryOf(filled.value)
    if (next.toString() === asked) {
      // The same charts again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const ledger = (
    <ButtonLink href={customersHrefOf(salon.id)}>
      {say(adminCustomerMessages.notFound.toLedger)}
    </ButtonLink>
  )

  return (
    <>
      <PageHeader
        title={say(titles.search)}
        description={salon.name}
        actions={ledger}
      />
      <ChartFilter
        conditions={conditions}
        errors={errors}
        clearHref={narrowed ? '?' : undefined}
        onSubmit={filter}
      />
      {match(read.data === undefined ? undefined : listingOf(read.data.pages))
        .with(undefined, () => <LoadingIndicator label={say(loading.charts)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.charts, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title={say(SEARCH.noneMatching)}
              description={say(SEARCH.noneMatchingDescription)}
            />
          ) : (
            <EmptyState
              title={say(SEARCH.none)}
              description={say(SEARCH.noneDescription)}
              actions={ledger}
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <ChartTable
            // Other conditions are another list
            key={asked}
            caption={say(narrowed ? SEARCH.narrowedCaption : SEARCH.caption)}
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
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.search)}>
      {(salon) => <ChartSearch key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
