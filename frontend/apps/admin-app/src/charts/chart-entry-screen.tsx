import type {
  ModelsCustomerResponse,
  ModelsMedicalChartCreateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  NOT_FOUND,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import { ButtonLink, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { customerKeyOf, customerNameOf } from '../customers/customers-api'
import { WithCustomer } from '../customers/with-customer'
import { chartChangeHrefOf, chartHrefOf } from '../navigation'
import {
  afterChartWrite,
  CHART_EXISTS,
  chartWrittenOf,
  readChartEntry,
} from './chart-form'
import {
  CHART_LISTS,
  type ChartRead,
  chartKeyOf,
  createChart,
} from './charts-api'
import { ChartForm } from './components/chart-form/chart-form'
import { WithChart } from './with-chart'

const TITLE = 'カルテを作る'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type ChartEntryProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The form that makes the chart of a customer. A chart another account
 * made meanwhile is said to be there, and what was written here stays in
 * the form, to be added to that chart.
 */
const ChartEntry = ({ salon, customer }: ChartEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const [exists, setExists] = useState(false)
  const back = chartHrefOf(salon.id, customer.id)
  const today = dayAt(new Date(), salon.timezone)
  const entry = useMutation({
    mutationFn: (request: ModelsMedicalChartCreateRequest) =>
      createChart(request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ chart }) => {
          const read: ChartRead = { type: 'read', chart }
          queryClient.setQueryData(chartKeyOf(customer.id), read)
          queryClient.removeQueries({ queryKey: CHART_LISTS })
          notify({
            tone: 'success',
            message: chartWrittenOf(customerNameOf(customer), 'entry'),
          })
          void navigate(back)
        })
        .with({ type: 'exists' }, () => {
          setExists(true)
          setSaid({ message: CHART_EXISTS, errors: {} })
        })
        // The customer was removed from the ledger meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(customerKeyOf(customer.id), NOT_FOUND)
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterChartWrite(refused, 'entry')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readChartEntry(values, customer.id, today))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        entry.mutate(request)
      })
      .exhaustive()

  return (
    <ChartForm
      today={today}
      submitLabel='カルテを作る'
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <>
          {exists && (
            <ButtonLink href={chartChangeHrefOf(salon.id, customer.id)}>
              そのカルテを直す
            </ButtonLink>
          )}
          <ButtonLink href={back} variant='quiet'>
            やめる
          </ButtonLink>
        </>
      }
    />
  )
}

/** Makes the chart of a customer, below the salon of the address; one who has one is led to change it. */
export const ChartEntryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh>
          {(customer) => (
            <WithChart key={customer.id} customerId={customer.id} fresh>
              {(chart) =>
                chart === null ? (
                  <ChartEntry salon={salon} customer={customer} />
                ) : (
                  <>
                    <p>このお客様には、カルテがあります。</p>
                    <p>
                      <ButtonLink
                        href={chartChangeHrefOf(salon.id, customer.id)}
                      >
                        カルテを直す
                      </ButtonLink>
                    </p>
                  </>
                )
              }
            </WithChart>
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
