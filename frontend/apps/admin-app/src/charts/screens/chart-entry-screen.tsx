import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsMedicalChartCreateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  ButtonLink,
  type FormSays,
  NOTHING_TO_SAY,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  customerKeyOf,
  customerNameOf,
} from '../../customers/api/customers-api'
import { WithCustomer } from '../../customers/screens/with-customer'
import { chartChangeHrefOf, chartHrefOf } from '../../navigation'
import {
  CHART_LISTS,
  type ChartRead,
  chartKeyOf,
  createChart,
} from '../api/charts-api'
import { ChartForm } from '../components/chart-form/chart-form'
import {
  afterChartWrite,
  chartWrittenOf,
  readChartEntry,
} from '../utils/chart-form'
import { WithChart } from './with-chart'

const { entry: ENTRY, screens, titles, words } = adminChartMessages

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
  const say = useSay()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
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
          setSaid(aboutTheAttempt(ENTRY.exists))
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
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <ChartForm
      today={today}
      submitLabel={say(ENTRY.submit)}
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <>
          {exists && (
            <ButtonLink href={chartChangeHrefOf(salon.id, customer.id)}>
              {say(ENTRY.changeExisting)}
            </ButtonLink>
          )}
          <ButtonLink href={back} variant='quiet'>
            {say(words.cancel)}
          </ButtonLink>
        </>
      }
    />
  )
}

/** Makes the chart of a customer, below the salon of the address; one who has one is led to change it. */
export const ChartEntryScreen = () => {
  const { salonId = '' } = useParams()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.entry)}>
      {(salon) => (
        <WithCustomer
          key={salon.id}
          salon={salon}
          title={say(titles.entry)}
          fresh
        >
          {(customer) => (
            <WithChart key={customer.id} customerId={customer.id} fresh>
              {(chart) =>
                chart === null ? (
                  <ChartEntry salon={salon} customer={customer} />
                ) : (
                  <>
                    <p>{say(screens.exists)}</p>
                    <ButtonLink href={chartChangeHrefOf(salon.id, customer.id)}>
                      {say(words.change)}
                    </ButtonLink>
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
