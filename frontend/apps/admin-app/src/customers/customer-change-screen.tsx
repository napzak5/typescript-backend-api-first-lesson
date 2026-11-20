import type {
  ModelsCustomerResponse,
  ModelsCustomerUpdateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { ButtonLink, useNotifications } from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { customerHrefOf } from '../navigation'
import { NOT_FOUND } from '../reading'
import { dayAt } from '../salon-time'
import { WithSalon } from '../salons/with-salon'
import { CustomerForm } from './components/customer-form/customer-form'
import { afterCustomerWrite, readCustomerChange } from './customer-form'
import {
  attemptCustomerChange,
  CUSTOMER_LISTS,
  type CustomerRead,
  customerKeyOf,
} from './customers-api'
import { WithCustomer } from './with-customer'

const TITLE = '台帳を直す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type CustomerChangeProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The form of a customer, opened with what the ledger has of them. It
 * sends what was changed and nothing else, and a form sent as it was
 * opened asks the API for nothing: what another salon wrote meanwhile
 * stays, unless the same value was changed here. The customer the API
 * answers with is what their page shows at once; the lists that were read
 * are dropped, since the customer may now meet other conditions.
 */
const CustomerChange = ({ salon, customer }: CustomerChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const key = customerKeyOf(customer.id)
  const back = customerHrefOf(salon.id, customer.id)
  const today = dayAt(new Date(), salon.timezone)
  const change = useMutation({
    mutationFn: (request: ModelsCustomerUpdateRequest) =>
      attemptCustomerChange(customer.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ customer: changed }) => {
          const read: CustomerRead = { type: 'found', customer: changed }
          queryClient.setQueryData(key, read)
          queryClient.removeQueries({ queryKey: CUSTOMER_LISTS })
          notify({ tone: 'success', message: '台帳を直しました。' })
          void navigate(back)
        })
        // The customer was removed from the ledger meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(key, NOT_FOUND)
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
          (refused) => setSaid(afterCustomerWrite(refused, 'change')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readCustomerChange(values, customer, today))
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
    <CustomerForm
      customer={customer}
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

/** Changes what the ledger keeps of a customer, below the salon of the address. */
export const CustomerChangeScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh>
          {(customer) => <CustomerChange salon={salon} customer={customer} />}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
