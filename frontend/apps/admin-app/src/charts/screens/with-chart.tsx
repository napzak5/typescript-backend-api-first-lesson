import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsMedicalChartResponse } from '@beauty-salon-frontend/api-client'
import {
  LoadingIndicator,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import { chartKeyOf, readChart } from '../api/charts-api'

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
  const say = useSay()
  const read = useQuery({
    queryKey: chartKeyOf(customerId),
    queryFn: () => readChart(customerId),
    staleTime: 0,
    refetchOnWindowFocus: !fresh,
    refetchOnReconnect: !fresh,
  })

  return match(!fresh || read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <LoadingIndicator label={say(adminChartMessages.loading.chart)} />
    ))
    .with({ type: 'read' }, ({ chart }) => children(chart))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={say(unreadMessageOf(adminChartMessages.names.chart, reason))}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .exhaustive()
}
