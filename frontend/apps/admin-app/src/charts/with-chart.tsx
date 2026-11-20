import type { ModelsMedicalChartResponse } from '@beauty-salon-frontend/api-client'
import { LoadingIndicator, UnreadNotice } from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import { unreadMessageOf } from '../reading'
import { chartKeyOf, readChart } from './charts-api'

type WithChartProps = {
  customerId: string
  /**
   * Whether the chart is shown only once it was read anew: a screen that
   * writes it does, so that a form opens with what is stored now and is
   * not taken away by an answer nobody asked for
   */
  fresh: boolean
  /** The screen for the chart that was read; `null` for a customer who has none */
  children: (chart: ModelsMedicalChartResponse | null) => ReactNode
}

/**
 * A part of a screen that needs the chart of a customer. Charts are
 * written at every salon: the chart is read whenever the part is shown.
 */
export const WithChart = ({ customerId, fresh, children }: WithChartProps) => {
  const read = useQuery({
    queryKey: chartKeyOf(customerId),
    queryFn: () => readChart(customerId),
    staleTime: 0,
    refetchOnWindowFocus: !fresh,
    refetchOnReconnect: !fresh,
  })

  return match(!fresh || read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <LoadingIndicator label='カルテを読み込んでいます' />
    ))
    .with({ type: 'read' }, ({ chart }) => children(chart))
    .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
      <UnreadNotice
        message={unreadMessageOf('カルテ', reason)}
        onRetry={() => void read.refetch()}
        retrying={read.isFetching}
      />
    ))
    .exhaustive()
}
