import {
  cursorAfter,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerAllergyResponse,
  ModelsCustomerResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import { ButtonLink, moreOf, useNotifications } from '@beauty-salon-frontend/ui'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import {
  customerKeyOf,
  customerNameOf,
} from '../../customers/api/customers-api'
import { WithCustomer } from '../../customers/screens/with-customer'
import {
  allergyChangeHrefOf,
  allergyEntryHrefOf,
  chartChangeHrefOf,
  chartEntryHrefOf,
  customerHrefOf,
} from '../../navigation'
import {
  allergiesKeyOf,
  readAllergyPage,
  removeAllergy,
} from '../api/allergies-api'
import { CHART_LISTS } from '../api/charts-api'
import {
  type AllergiesShown,
  AllergyList,
} from '../components/allergy-list/allergy-list'
import { ChartRecord } from '../components/chart-record/chart-record'
import { afterAllergyRemoval, mayRemoveAllergies } from '../utils/allergies'
import { WithChart } from './with-chart'

const TITLE = 'カルテ'

type AllergiesPartProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The allergies of the customer, the heaviest first, a page at a time,
 * read whenever the part is shown: they are written at every salon. One
 * recorded by mistake is removed after a dialog that asks first. What was
 * removed, or what changed meanwhile, closes the dialog: the list is read
 * again, and the heading of the part takes the focus, as the button that
 * was pressed may be gone.
 */
const AllergiesPart = ({ salon, customer }: AllergiesPartProps) => {
  const session = useSession()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const heading = useRef<HTMLHeadingElement>(null)
  const key = allergiesKeyOf(customer.id)
  const read = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => readAllergyPage(customer.id, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    staleTime: 0,
  })
  const [removing, setRemoving] = useState<ModelsCustomerAllergyResponse>()
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  /** What changed meanwhile: said under the heading */
  const [refusal, setRefusal] = useState<string>()
  /** How many times the dialog closed on what it changed: the heading takes the focus each time */
  const [moves, setMoves] = useState(0)

  useLayoutEffect(() => {
    if (moves > 0) {
      heading.current?.focus()
    }
  }, [moves])

  const removal = useMutation({
    mutationFn: (allergy: ModelsCustomerAllergyResponse) =>
      removeAllergy(customer.id, allergy.id),
    onMutate: () => setMessage(undefined),
    onSuccess: (outcome, allergy) =>
      match(
        afterAllergyRemoval(
          outcome,
          customerNameOf(customer),
          allergy.allergenName,
        ),
      )
        .with({ type: 'done' }, ({ message: said }) => {
          setRemoving(undefined)
          setRefusal(undefined)
          setMoves((count) => count + 1)
          queryClient.removeQueries({ queryKey: CHART_LISTS })
          void queryClient.invalidateQueries({ queryKey: key })
          notify({ tone: 'success', message: said })
        })
        .with({ type: 'again' }, ({ message: said }) => setMessage(said))
        .with({ type: 'refused' }, ({ message: said }) => {
          setRemoving(undefined)
          setRefusal(said)
          setMoves((count) => count + 1)
          // The allergies, and the customer, who may have left the ledger
          void queryClient.invalidateQueries({
            queryKey: customerKeyOf(customer.id),
          })
        })
        .exhaustive(),
  })

  const listing =
    read.data === undefined ? undefined : listingOf(read.data.pages)
  const shown = match(listing)
    .returnType<AllergiesShown>()
    .with(undefined, () => ({ type: 'reading' }))
    .with({ type: 'unread' }, ({ reason }) => ({
      type: 'unread',
      message: unreadMessageOf('アレルギー', reason),
      retrying: read.isFetching,
    }))
    .with({ type: 'listed' }, ({ items, total, rest }) => ({
      type: 'listed',
      allergies: items,
      total,
      more: moreOf(rest, {
        nextPage: read.isFetchingNextPage,
        again: read.isRefetching,
      }),
    }))
    .exhaustive()

  return (
    <AllergyList
      shown={shown}
      onRetry={() => void read.refetch()}
      onMore={() =>
        void (listing?.type === 'listed' && listing.rest === 'unread'
          ? read.refetch()
          : read.fetchNextPage())
      }
      entryHref={allergyEntryHrefOf(salon.id, customer.id)}
      changeHrefOf={({ id }) => allergyChangeHrefOf(salon.id, customer.id, id)}
      removable={
        session.type === 'signedIn' && mayRemoveAllergies(session.user.role)
      }
      refusal={refusal}
      headingRef={heading}
      removing={removing}
      onOpen={(allergy) => {
        setMessage(undefined)
        setRemoving(allergy)
      }}
      onClose={() => setRemoving(undefined)}
      message={message}
      pending={removal.isPending}
      onRemove={() => {
        if (removing !== undefined) {
          removal.mutate(removing)
        }
      }}
    />
  )
}

/**
 * The chart of a customer, below the salon of the address: what a member
 * of the staff makes sure of before a treatment, the allergies first. The
 * chart and the allergies are the customer's, at every salon; the moment
 * the chart was written is shown on the clock of the salon.
 */
export const ChartScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh={false}>
          {(customer) => (
            <>
              <ButtonLink href={customerHrefOf(salon.id, customer.id)}>
                お客様の台帳へ
              </ButtonLink>
              <AllergiesPart
                key={customer.id}
                salon={salon}
                customer={customer}
              />
              <WithChart
                key={customer.id}
                customerId={customer.id}
                fresh={false}
              >
                {(chart) => (
                  <ChartRecord
                    chart={chart}
                    timezone={salon.timezone}
                    entryHref={chartEntryHrefOf(salon.id, customer.id)}
                    changeHref={chartChangeHrefOf(salon.id, customer.id)}
                  />
                )}
              </WithChart>
            </>
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
