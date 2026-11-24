import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  type Period,
  periodNameOf,
  periodQueryOf,
  readDays,
  StatisticsPeriod,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { WithStaffAndServices } from '../../bookings/screens/with-booking'
import { treatmentsHrefOf } from '../../navigation'
import {
  readTreatmentStatistics,
  treatmentStatisticsKeyOf,
} from '../api/treatments-api'
import { TreatmentStatistics } from '../components/treatment-statistics/treatment-statistics'
import { statisticsPeriodIn } from '../utils/treatment-statistics'

const { names, statistics: WORDS, titles } = adminTreatmentMessages

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
  const say = useSay()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors<LocalizedText> | undefined>(
    undefined,
  )
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
    const next: Period = filled.value
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
        description={say(WORDS.periodDescription)}
        errors={errors}
        onSubmit={count}
      />
      <p>{say(WORDS.of(periodNameOf(period)))}</p>
      {match(read.data)
        .with(undefined, () => <LoadingIndicator label={say(WORDS.counting)} />)
        .with({ type: 'found', statistics: { totalTreatments: 0 } }, () => (
          <EmptyState
            title={say(WORDS.none)}
            description={say(WORDS.noneDescription)}
          />
        ))
        .with({ type: 'found' }, ({ statistics }) => (
          <TreatmentStatistics statistics={statistics} services={services} />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.statistics, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The statistics of the treatment records of the salon of the address. */
export const TreatmentStatisticsScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()
  const title = say(titles.statistics)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <>
          <PageHeader
            title={title}
            description={salon.name}
            actions={
              <ButtonLink href={treatmentsHrefOf(salon.id)}>
                {say(WORDS.toList)}
              </ButtonLink>
            }
          />
          <WithStaffAndServices salonId={salon.id}>
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
