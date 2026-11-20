import type {
  ModelsCustomerResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Card,
  type FormErrors,
  LoadingIndicator,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  bookingOfCustomerHrefOf,
  customerChangeHrefOf,
  customerHrefOf,
} from '../navigation'
import { unreadMessageOf } from '../reading'
import { dayAt } from '../salon-time'
import { OtherSalonNotice, WithSalon } from '../salons/with-salon'
import { CustomerPreferences } from './components/customer-preferences/customer-preferences'
import { CustomerRecord } from './components/customer-record/customer-record'
import { CustomerStatistics } from './components/customer-statistics/customer-statistics'
import { StatisticsPeriod } from './components/statistics-period/statistics-period'
import {
  type Period,
  periodIn,
  periodNameOf,
  periodQueryOf,
  readPeriod,
} from './customer-statistics'
import {
  preferencesKeyOf,
  readPreferences,
  readStatistics,
  statisticsKeyOf,
} from './customers-api'
import { WithCustomer } from './with-customer'

const TITLE = 'お客様の台帳'

const UNREAD = P.union('tooManyRequests', 'failed')

/** What a part says of a customer who was removed while the page was open */
const GONE = 'このお客様は、台帳から削除されました。'

type PartProps = {
  customer: ModelsCustomerResponse
}

/**
 * What the customer wants the salons to keep in mind, with the members of
 * the staff named. It is read with the page; the customer may change it
 * from the portal at any time.
 */
const PreferencesPart = ({ customer }: PartProps) => {
  const read = useQuery({
    queryKey: preferencesKeyOf(customer.id),
    queryFn: () => readPreferences(customer.id),
    staleTime: 0,
  })

  return (
    <Card title='好み設定'>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='好み設定を読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ preferences, staff }) => (
          <CustomerPreferences preferences={preferences} staff={staff} />
        ))
        .with({ type: 'notFound' }, () => <p>{GONE}</p>)
        .with({ type: UNREAD }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('好み設定', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

type UsePartProps = PartProps & {
  salon: ModelsSalonResponse
}

/**
 * What the customer did at the salon over a period: the year up to today
 * at the salon, or the days in the query of the address. Another period is
 * another address, so the way back shows the period that was shown.
 */
const UsePart = ({ salon, customer }: UsePartProps) => {
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const period = periodIn(query, dayAt(new Date(), salon.timezone))
  const read = useQuery({
    queryKey: statisticsKeyOf(customer.id, salon.id, period),
    queryFn: () => readStatistics(customer.id, salon.id, period),
    staleTime: 0,
  })

  const count = (values: FormData): void => {
    const filled = readPeriod(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next: Period = filled.request
    if (periodQueryOf(next).toString() === periodQueryOf(period).toString()) {
      void read.refetch()
      return
    }
    setQuery(periodQueryOf(next), { replace: true })
  }

  return (
    <Card title='このサロンでの利用'>
      <StatisticsPeriod period={period} errors={errors} onSubmit={count} />
      <p>{`${periodNameOf(period)}の集計`}</p>
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label='利用を集計しています' />
        ))
        .with({ type: 'found' }, ({ statistics }) => (
          <CustomerStatistics
            statistics={statistics}
            timezone={salon.timezone}
            currency={salon.currency}
          />
        ))
        .with({ type: 'notFound' }, () => <p>{GONE}</p>)
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what='利用の集計' />
        ))
        .with({ type: UNREAD }, (reason) => (
          <UnreadNotice
            message={unreadMessageOf('利用の集計', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

/**
 * A customer of the ledger: what the ledger keeps of them, what they want
 * the salons to keep in mind, and what they did at the salon of the
 * address. From here a booking of the customer is entered, and the ledger
 * is changed.
 */
export const CustomerScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh={false}>
          {(customer) => (
            <>
              <CustomerRecord
                customer={customer}
                timezone={salon.timezone}
                changeHref={customerChangeHrefOf(salon.id, customer.id)}
                bookingHref={bookingOfCustomerHrefOf(
                  salon.id,
                  dayAt(new Date(), salon.timezone),
                  customer.id,
                )}
                customerHref={(customerId) =>
                  customerHrefOf(salon.id, customerId)
                }
              />
              {/* Another customer (the one who referred this one) is another part */}
              <PreferencesPart
                key={`preferences-${customer.id}`}
                customer={customer}
              />
              <UsePart
                key={`use-${customer.id}`}
                salon={salon}
                customer={customer}
              />
            </>
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
