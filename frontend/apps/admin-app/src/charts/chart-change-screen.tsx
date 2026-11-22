import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsMedicalChartResponse,
  ModelsMedicalChartUpdateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { customerKeyOf, customerNameOf } from '../customers/customers-api'
import { WithCustomer } from '../customers/with-customer'
import { chartEntryHrefOf, chartHrefOf } from '../navigation'
import { afterChartWrite, chartWrittenOf, readChartChange } from './chart-form'
import {
  CHART_LISTS,
  type ChartRead,
  chartKeyOf,
  updateChart,
} from './charts-api'
import { ChartForm } from './components/chart-form/chart-form'
import { WithChart } from './with-chart'

const TITLE = 'カルテを直す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type ChartChangeProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
  chart: ModelsMedicalChartResponse
}

/**
 * The form of a chart, opened with what is stored. It sends what was
 * changed and nothing else, and a form sent as it was opened asks the API
 * for nothing: what another account wrote meanwhile stays, unless the
 * same value was changed here.
 */
const ChartChange = ({ salon, customer, chart }: ChartChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const back = chartHrefOf(salon.id, customer.id)
  const today = dayAt(new Date(), salon.timezone)
  const change = useMutation({
    mutationFn: (request: ModelsMedicalChartUpdateRequest) =>
      updateChart(chart.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ chart: changed }) => {
          const read: ChartRead = { type: 'read', chart: changed }
          queryClient.setQueryData(chartKeyOf(customer.id), read)
          queryClient.removeQueries({ queryKey: CHART_LISTS })
          notify({
            tone: 'success',
            message: chartWrittenOf(customerNameOf(customer), 'change'),
          })
          void navigate(back)
        })
        // The customer was removed from the ledger meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(customerKeyOf(customer.id), NOT_FOUND)
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) => setSaid(afterChartWrite(refused, 'change')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readChartChange(values, chart, today))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: '変更はありませんでした。' })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        change.mutate(request)
      })
      .exhaustive()

  return (
    <ChartForm
      chart={chart}
      today={today}
      submitLabel='変更を保存する'
      message={said.message}
      errors={said.errors}
      pending={change.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** Changes the chart of a customer, below the salon of the address; one who has none is led to make it. */
export const ChartChangeScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh>
          {(customer) => (
            <WithChart key={customer.id} customerId={customer.id} fresh>
              {(chart) =>
                chart === null ? (
                  <EmptyState
                    title='このお客様のカルテは、まだありません。'
                    actions={
                      <ButtonLink
                        href={chartEntryHrefOf(salon.id, customer.id)}
                      >
                        カルテを作る
                      </ButtonLink>
                    }
                  />
                ) : (
                  <ChartChange
                    salon={salon}
                    customer={customer}
                    chart={chart}
                  />
                )
              }
            </WithChart>
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
