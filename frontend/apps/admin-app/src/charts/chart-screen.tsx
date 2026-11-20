import { ButtonLink } from '@beauty-salon-frontend/ui'
import { useParams } from 'react-router'
import { WithCustomer } from '../customers/with-customer'
import {
  chartChangeHrefOf,
  chartEntryHrefOf,
  customerHrefOf,
} from '../navigation'
import { WithSalon } from '../salons/with-salon'
import { ChartRecord } from './components/chart-record/chart-record'
import { WithChart } from './with-chart'

const TITLE = 'カルテ'

/**
 * The chart of a customer, below the salon of the address: what a member
 * of the staff makes sure of before a treatment. The chart is the
 * customer's, at every salon; the moment it was written is shown on the
 * clock of the salon.
 */
export const ChartScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh={false}>
          {(customer) => (
            <>
              <p>
                <ButtonLink
                  href={customerHrefOf(salon.id, customer.id)}
                  variant='secondary'
                >
                  お客様の台帳へ
                </ButtonLink>
              </p>
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
