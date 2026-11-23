import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsCustomerUpdateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { dayAt, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  inJapanese,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  UnreadNotice,
  useNotifications,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { customerHrefOf } from '../../navigation'
import {
  attemptCustomerChange,
  CUSTOMER_LISTS,
  type CustomerRead,
  customerKeyOf,
  readCustomer,
} from '../api/customers-api'
import { CustomerForm } from '../components/customer-form/customer-form'
import {
  afterCustomerWrite,
  NO_REFERRER,
  type Referrer,
  readCustomerChange,
  referrerOf,
} from '../utils/customer-form'
import { ReferrerChoice } from './referrer-choice'
import { WithCustomer } from './with-customer'

const TITLE = '台帳を直す'

type CustomerChangeProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
  /** Who referred the customer, as the form opens with them */
  referrer: Referrer
}

/**
 * The form of a customer, opened with what the ledger has of them. It
 * sends what was changed and nothing else, and a form sent as it was
 * opened asks the API for nothing: what another salon wrote meanwhile
 * stays, unless the same value was changed here. The customer the API
 * answers with is what their page shows at once; the lists that were read
 * are dropped, since the customer may now meet other conditions.
 */
const CustomerChange = ({ salon, customer, referrer }: CustomerChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_TO_SAY)
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
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(back)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        change.mutate(value)
      })
      .exhaustive()

  return (
    <CustomerForm
      customer={customer}
      today={today}
      referrer={referrer}
      chooseReferrer={(choice) => (
        <ReferrerChoice {...choice} excluded={customer.id} />
      )}
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

type CustomerToChangeProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The form opens once the customer who referred this one was read anew,
 * to be named: one who was removed from the ledger since is said to be
 * missing, and stays the referrer unless another is chosen.
 */
const CustomerToChange = ({ salon, customer }: CustomerToChangeProps) => {
  const { referredBy } = customer
  const read = useQuery({
    queryKey: customerKeyOf(referredBy ?? ''),
    queryFn: () => readCustomer(referredBy ?? ''),
    enabled: referredBy !== null,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const opened = (referrer: Referrer) => (
    <CustomerChange salon={salon} customer={customer} referrer={referrer} />
  )
  if (referredBy === null) {
    return opened(NO_REFERRER)
  }

  return match(read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <LoadingIndicator label='紹介元を読み込んでいます' />
    ))
    .with({ type: 'found' }, ({ customer: found }) => opened(referrerOf(found)))
    .with({ type: 'notFound' }, () => opened({ type: 'gone', id: referredBy }))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <UnreadNotice
        message={inJapanese(
          unreadMessageOf(writtenInJapanese('紹介元'), reason),
        )}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .exhaustive()
}

/** Changes what the ledger keeps of a customer, below the salon of the address. */
export const CustomerChangeScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh>
          {(customer) => (
            <CustomerToChange
              key={customer.id}
              salon={salon}
              customer={customer}
            />
          )}
        </WithCustomer>
      )}
    </WithSalon>
  )
}
