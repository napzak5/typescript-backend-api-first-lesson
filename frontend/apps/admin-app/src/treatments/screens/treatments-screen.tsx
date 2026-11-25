import {
  cursorAfter,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
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
  adminBookingMessages,
  adminTreatmentMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { WithStaffAndServices } from '../../bookings/screens/with-booking'
import { customerKeyOf, readCustomer } from '../../customers/api/customers-api'
import {
  bookingsHrefOf,
  customerHrefOf,
  treatmentHrefOf,
  treatmentStatisticsHrefOf,
} from '../../navigation'
import { readTreatmentPage, TREATMENT_LISTS } from '../api/treatments-api'
import { TreatmentFilter } from '../components/treatment-filter/treatment-filter'
import { TreatmentTable } from '../components/treatment-table/treatment-table'
import { customerCalled } from '../utils/treatment-format'
import {
  readTreatmentConditions,
  treatmentConditionsIn,
  treatmentQueryOf,
} from '../utils/treatment-search'

const { list: LIST, names, titles } = adminTreatmentMessages

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
): LocalizedText | undefined => {
  const read = useQuery({
    queryKey: customerKeyOf(customerId ?? ''),
    queryFn:
      customerId === undefined ? skipToken : () => readCustomer(customerId),
  })

  return match(read.data)
    .returnType<LocalizedText | undefined>()
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
  const say = useSay()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors<LocalizedText> | undefined>(
    undefined,
  )
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
    const next = treatmentQueryOf(filled.value)
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
        .with(undefined, () => <LoadingIndicator label={say(LIST.loading)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.records, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title={say(LIST.noneMatching)}
              description={say(LIST.noneMatchingDescription)}
            />
          ) : (
            <EmptyState
              title={say(LIST.none)}
              description={say(LIST.noneDescription)}
              actions={
                <ButtonLink href={bookingsHrefOf(salon.id)}>
                  {say(adminBookingMessages.frame.toToday)}
                </ButtonLink>
              }
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <TreatmentTable
            // Other conditions are another list
            key={asked}
            caption={say(narrowed ? LIST.matching : LIST.records)}
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
  const say = useSay()
  const { salonId = '' } = useParams()
  const title = say(titles.list)

  return (
    <WithSalon salonId={salonId} title={title}>
      {(salon) => (
        <>
          <PageHeader
            title={title}
            description={salon.name}
            actions={
              <ButtonLink href={treatmentStatisticsHrefOf(salon.id)}>
                {say(adminTreatmentMessages.toStatistics)}
              </ButtonLink>
            }
          />
          <WithStaffAndServices salonId={salon.id}>
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
