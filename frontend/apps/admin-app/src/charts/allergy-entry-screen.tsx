import type {
  ModelsCustomerAllergyCreateRequest,
  ModelsCustomerResponse,
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
import { chartHrefOf } from '../navigation'
import { afterAllergyWrite, allergyWrittenOf, readAllergy } from './allergies'
import { addAllergy, allergiesKeyOf } from './allergies-api'
import { CHART_LISTS } from './charts-api'
import { AllergyForm } from './components/allergy-form/allergy-form'

const TITLE = 'アレルギーを記録する'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type AllergyEntryProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The form that records an allergy of a customer, with or without a chart.
 * An allergen the customer has already is said at its control, and what
 * was written stays in the form.
 */
const AllergyEntry = ({ salon, customer }: AllergyEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const back = chartHrefOf(salon.id, customer.id)
  const today = dayAt(new Date(), salon.timezone)
  const entry = useMutation({
    mutationFn: (request: ModelsCustomerAllergyCreateRequest) =>
      addAllergy(customer.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ allergy }) => {
          // The list, read anew on the chart; an allergy of the address is read anew whenever its screen opens
          queryClient.removeQueries({
            queryKey: allergiesKeyOf(customer.id),
            exact: true,
          })
          // Whether the customer has allergies is a condition of the search
          queryClient.removeQueries({ queryKey: CHART_LISTS })
          notify({
            tone: 'success',
            message: allergyWrittenOf(
              customerNameOf(customer),
              allergy.allergenName,
              'entry',
            ),
          })
          void navigate(back)
        })
        // The customer was removed from the ledger meanwhile
        .with({ type: 'notFound' }, () => {
          queryClient.setQueryData(customerKeyOf(customer.id), NOT_FOUND)
        })
        .with(
          {
            type: P.union(
              'invalid',
              'exists',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterAllergyWrite(refused, 'entry')),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readAllergy(values, today))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        entry.mutate(request)
      })
      .exhaustive()

  return (
    <AllergyForm
      today={today}
      submitLabel='記録する'
      message={said.message}
      errors={said.errors}
      pending={entry.isPending}
      onSubmit={submit}
      actions={
        <ButtonLink href={back} variant='quiet'>
          やめる
        </ButtonLink>
      }
    />
  )
}

/** Records an allergy of a customer, below the salon of the address. */
export const AllergyEntryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh>
          {(customer) => (
            <AllergyEntry key={customer.id} salon={salon} customer={customer} />
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
