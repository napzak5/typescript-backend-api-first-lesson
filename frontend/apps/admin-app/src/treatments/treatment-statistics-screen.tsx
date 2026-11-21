import type {
  ModelsSalonResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { WithStaffAndServices } from '../bookings/with-booking'
import { StatisticsPeriod } from '../customers/components/statistics-period/statistics-period'
import {
  type Period,
  periodNameOf,
  periodQueryOf,
  readDays,
} from '../customers/customer-statistics'
import { treatmentsHrefOf } from '../navigation'
import { TreatmentStatistics } from './components/treatment-statistics/treatment-statistics'
import { statisticsPeriodIn } from './treatment-statistics'
import {
  readTreatmentStatistics,
  treatmentStatisticsKeyOf,
} from './treatments-api'

const TITLE = '施術の統計'

const UNREAD = P.union('tooManyRequests', 'failed')

type StatisticsPartProps = {
  salon: ModelsSalonResponse
  services: readonly ModelsServiceResponse[]
}

/**
 * The treatment records the salon wrote over a period, counted: the month
 * up to today at the salon, or the days in the query of the address.
 * Another period is another address, so the way back shows the period that
 * was shown. The counts are read whenever they are shown: records are
 * written at every visit.
 */
const StatisticsPart = ({ salon, services }: StatisticsPartProps) => {
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const period = statisticsPeriodIn(query, dayAt(new Date(), salon.timezone))
  const read = useQuery({
    queryKey: treatmentStatisticsKeyOf(salon.id, period),
    queryFn: () => readTreatmentStatistics(salon.id, period, salon.timezone),
    staleTime: 0,
  })

  const count = (values: FormData): void => {
    const filled = readDays(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next: Period = filled.request
    if (periodQueryOf(next).toString() === periodQueryOf(period).toString()) {
      // The same days again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(periodQueryOf(next), { replace: true })
  }

  return (
    <>
      <StatisticsPeriod
        period={period}
        description='施術記録を書いた日（サロンの日付）で数えます。'
        errors={errors}
        onSubmit={count}
      />
      <p>{`${periodNameOf(period)}に書いた施術記録`}</p>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='施術記録を集計しています' />
        ))
        .with({ type: 'found', statistics: { totalTreatments: 0 } }, () => (
          <EmptyState
            title='この期間に書いた施術記録はありません'
            description='期間を変えて集計してください。'
          />
        ))
        .with({ type: 'found' }, ({ statistics }) => (
          <TreatmentStatistics statistics={statistics} services={services} />
        ))
        .with({ type: UNREAD }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('施術の統計', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The statistics of the treatment records of the salon of the address. */
export const TreatmentStatisticsScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <>
          <PageHeader
            title={TITLE}
            description={salon.name}
            actions={
              <ButtonLink href={treatmentsHrefOf(salon.id)} variant='secondary'>
                施術記録の一覧へ
              </ButtonLink>
            }
          />
          <WithStaffAndServices salonId={salon.id} label='スタッフとメニュー'>
            {(_staff, services) => (
              <StatisticsPart
                key={salon.id}
                salon={salon}
                services={services}
              />
            )}
          </WithStaffAndServices>
        </>
      )}
    </WithSalon>
  )
}
