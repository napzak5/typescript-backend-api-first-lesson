import type {
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  cursorAfter,
  firstCursor,
  listingOf,
  moreOf,
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
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { WithStaffAndServices } from '../bookings/with-booking'
import { customerKeyOf, readCustomer } from '../customers/customers-api'
import {
  bookingsHrefOf,
  customerHrefOf,
  treatmentHrefOf,
  treatmentStatisticsHrefOf,
} from '../navigation'
import { TreatmentFilter } from './components/treatment-filter/treatment-filter'
import { TreatmentTable } from './components/treatment-table/treatment-table'
import { customerCalled } from './treatment-format'
import {
  readTreatmentConditions,
  treatmentConditionsIn,
  treatmentQueryOf,
} from './treatment-search'
import { readTreatmentPage, TREATMENT_LISTS } from './treatments-api'

const TITLE = '施術記録'

type TreatmentListProps = {
  salon: ModelsSalonResponse
  staff: readonly ModelsStaffProfileResponse[]
  services: readonly ModelsServiceResponse[]
}

/**
 * The name of the customer of the conditions, as the filter says it; none
 * while it is not known. The list is of them, whether or not their name
 * could be read.
 */
const useCustomerName = (
  customerId: string | undefined,
): string | undefined => {
  const read = useQuery({
    queryKey: customerKeyOf(customerId ?? ''),
    queryFn: () => readCustomer(customerId ?? ''),
    enabled: customerId !== undefined,
  })

  return match(read.data)
    .returnType<string | undefined>()
    .with({ type: 'found' }, ({ customer }) => customerCalled(customer))
    .with({ type: 'notFound' }, () => customerCalled(undefined))
    .otherwise(() => undefined)
}

/**
 * The treatment records of the salon that meet the conditions, the latest
 * written first: the member of the staff who did the treatment, the
 * customer who had it, and the days the record was written on at the
 * salon. The conditions are in the query of the address.
 */
const TreatmentList = ({ salon, staff, services }: TreatmentListProps) => {
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const conditions = treatmentConditionsIn(query)
  const asked = treatmentQueryOf(conditions).toString()
  const narrowed = asked !== ''
  const customerName = useCustomerName(conditions.customer)
  const read = useInfiniteQuery({
    queryKey: [...TREATMENT_LISTS, salon.id, asked],
    queryFn: ({ pageParam }) =>
      readTreatmentPage(salon.id, conditions, salon.timezone, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Records are written at every visit: the list is read whenever it is shown
    staleTime: 0,
  })

  const filter = (values: FormData): void => {
    const filled = readTreatmentConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next = treatmentQueryOf(filled.request)
    if (next.toString() === asked) {
      // The same records again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  const { customer: _customer, ...withoutCustomer } = conditions
  const withoutCustomerQuery = treatmentQueryOf(withoutCustomer).toString()

  return (
    <>
      <TreatmentFilter
        conditions={conditions}
        staff={staff}
        customerName={customerName}
        withoutCustomerHref={`?${withoutCustomerQuery}`}
        errors={errors}
        clearHref={narrowed ? '?' : undefined}
        onSubmit={filter}
      />
      {match(read.data === undefined ? undefined : listingOf(read.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label='施術記録を読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('施術記録', reason)}
            onRetry={() => void read.refetch()}
            retrying={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title='条件に合う施術記録はありません'
              description='条件を変えて探してください。'
            />
          ) : (
            <EmptyState
              title='施術記録はありません'
              description='施術記録は、施術を始めた予約の画面から書きます。'
              action={
                <ButtonLink href={bookingsHrefOf(salon.id)} variant='secondary'>
                  今日の予約へ
                </ButtonLink>
              }
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <TreatmentTable
            // Other conditions are another list
            key={asked}
            caption={narrowed ? '条件に合う施術記録' : '施術記録'}
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
            staff={staff}
            services={services}
            treatmentHref={(id) => treatmentHrefOf(salon.id, id)}
            customerHref={(id) => customerHrefOf(salon.id, id)}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The treatment records of the salon of the address. */
export const TreatmentsScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <>
          <PageHeader
            title={TITLE}
            description={salon.name}
            actions={
              <ButtonLink
                href={treatmentStatisticsHrefOf(salon.id)}
                variant='secondary'
              >
                施術の統計
              </ButtonLink>
            }
          />
          <WithStaffAndServices salonId={salon.id} label='スタッフとメニュー'>
            {(staff, services) => (
              <TreatmentList
                key={salon.id}
                salon={salon}
                staff={staff}
                services={services}
              />
            )}
          </WithStaffAndServices>
        </>
      )}
    </WithSalon>
  )
}
