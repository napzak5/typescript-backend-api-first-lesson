import type {
  ModelsCustomerCreateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { customerHrefOf, customersHrefOf } from '../navigation'
import { dayAt } from '../salon-time'
import { WithSalon } from '../salons/with-salon'
import { CustomerForm } from './components/customer-form/customer-form'
import {
  afterCustomerWrite,
  NO_REFERRER,
  readCustomerEntry,
} from './customer-form'
import {
  attemptCustomerEntry,
  CUSTOMER_LISTS,
  type CustomerRead,
  customerKeyOf,
  customerNameOf,
} from './customers-api'
import { ReferrerChoice } from './referrer-choice'

const TITLE = 'お客様を登録する'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type CustomerEntryProps = {
  salon: ModelsSalonResponse
}

/**
 * The form of a new customer of the ledger. The customer the API answers
 * with is what their page shows at once; the lists of customers that were
 * read are dropped, since the new one belongs in them.
 */
const CustomerEntry = ({ salon }: CustomerEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const entry = useMutation({
    mutationFn: (request: ModelsCustomerCreateRequest) =>
      attemptCustomerEntry(request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ customer }) => {
          const read: CustomerRead = { type: 'found', customer }
          queryClient.setQueryData(customerKeyOf(customer.id), read)
          queryClient.removeQueries({ queryKey: CUSTOMER_LISTS })
          notify({
            tone: 'success',
            message: `${customerNameOf(customer)} 様を台帳に登録しました。`,
          })
          void navigate(customerHrefOf(salon.id, customer.id))
        })
        .with(
          {
            type: P.union(
              'invalid',
              'duplicate',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterCustomerWrite(refused, 'entry')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readCustomerEntry(values, dayAt(new Date(), salon.timezone)))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        entry.mutate(request)
      })
      .exhaustive()

  return (
    <CustomerForm
      customer={null}
      today={dayAt(new Date(), salon.timezone)}
      referrer={NO_REFERRER}
      chooseReferrer={(choice) => (
        <ReferrerChoice {...choice} excluded={undefined} />
      )}
      submitLabel='登録する'
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={customersHrefOf(salon.id)} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/**
 * Registers a customer in the ledger: one who booked by phone, or who came
 * in without a booking, and who referred them when somebody did.
 */
export const CustomerEntryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <>
          <PageHeader title={TITLE} description={salon.name} />
          <CustomerEntry key={salon.id} salon={salon} />
        </>
      )}
    </WithSalon>
  )
}
